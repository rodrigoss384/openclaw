#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateJsonSchema } from "../../skills/spec-driven-engineering/scripts/lib/json-schema.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "../..");
const SCHEMA_PATH = path.join(SCRIPT_DIR, "global-retrieval.schema.json");
const BACKEND_SCHEMA_PATH = path.join(SCRIPT_DIR, "global-retrieval-backend.schema.json");

function parseArgs(argv) {
  const parsed = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      parsed._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) parsed[key] = true;
    else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeRepoPath(value) {
  return String(value || "").split("#", 1)[0].replaceAll("\\", "/").replace(/^\.\//, "");
}

function resolveRepoRef(root, ref, label, errors) {
  const relative = normalizeRepoPath(ref);
  if (!relative) {
    errors.push(`${label} must resolve to a repository path.`);
    return null;
  }
  const absolute = path.resolve(root, relative);
  const normalizedRoot = path.resolve(root);
  if (absolute !== normalizedRoot && !absolute.startsWith(`${normalizedRoot}${path.sep}`)) {
    errors.push(`${label} escapes the repository root: ${ref}`);
    return null;
  }
  if (!fs.existsSync(absolute)) {
    errors.push(`${label} does not exist: ${ref}`);
    return null;
  }
  return absolute;
}

function relativeRepoPath(root, filePath) {
  return path.relative(root, filePath).replaceAll("\\", "/");
}

function hasPlaceholder(value) {
  if (typeof value === "string") return /<[^>]+>|\{\{[^}]+\}\}|\b(?:TODO|TBD)\b/i.test(value);
  if (Array.isArray(value)) return value.some(hasPlaceholder);
  if (value && typeof value === "object") return Object.values(value).some(hasPlaceholder);
  return false;
}

function expectedApplicability(basis) {
  const required = basis.transversalRetrieval
    && basis.multipleEntityTypes
    && (basis.recurringQuickFind || basis.operationalHighFrequency);
  if (required) return "required";
  const any = Object.values(basis).some(Boolean);
  return any ? "optional" : "not-applicable";
}

function validateEvidence(root, contract, errors) {
  const signalByKey = {
    transversalRetrieval: "transversal-retrieval",
    multipleEntityTypes: "multiple-entity-types",
    recurringQuickFind: "recurring-quick-find",
    operationalHighFrequency: "operational-high-frequency"
  };
  for (const [key, signal] of Object.entries(signalByKey)) {
    if (!contract.applicabilityBasis[key]) continue;
    const matches = contract.evidence.filter((entry) => entry.signal === signal);
    if (matches.length === 0) errors.push(`evidence must include signal=${signal} because applicabilityBasis.${key}=true.`);
  }
  if (contract.applicability === "not-applicable" && !contract.evidence.some((entry) => entry.signal === "not-applicable")) {
    errors.push("not-applicable retrieval requires explicit not-applicable evidence.");
  }
  for (const [index, evidence] of contract.evidence.entries()) {
    resolveRepoRef(root, evidence.sourceRef, `evidence[${index}].sourceRef`, errors);
  }
}

function validateResultContract(resultContract, errors) {
  const requiredStates = new Set(["loading", "empty", "error", "results"]);
  const actualStates = new Set(resultContract.requiredStates || []);
  for (const state of requiredStates) {
    if (!actualStates.has(state)) errors.push(`resultContract.requiredStates must include ${state}.`);
  }
  const requiredFields = new Set(["entityType", "primaryLabel", "destination"]);
  const actualFields = new Set(resultContract.requiredSemanticFields || []);
  for (const field of requiredFields) {
    if (!actualFields.has(field)) errors.push(`resultContract.requiredSemanticFields must include ${field}.`);
  }
}

function validateBackendContract(root, globalContract, backendPath, errors) {
  let backend;
  try {
    backend = readJson(backendPath);
  } catch (error) {
    errors.push(`backendContractRef is not valid JSON: ${error.message}`);
    return;
  }
  const schema = readJson(BACKEND_SCHEMA_PATH);
  for (const error of validateJsonSchema(backend, schema)) errors.push(`backend contract schema: ${error}`);
  if (globalContract.status !== "draft" && backend.status === "draft") {
    errors.push("non-draft global retrieval cannot depend on a draft backend retrieval contract.");
  }
  if (backend.authorizationMode !== globalContract.authorizationMode) {
    errors.push(`backend authorizationMode must match global contract (${globalContract.authorizationMode}).`);
  }
  const refs = [
    [backend.sourceRef, "backend.sourceRef"],
    [backend.authentication?.mechanismRef, "backend.authentication.mechanismRef"],
    [backend.tenantIsolation?.negativeTestRef, "backend.tenantIsolation.negativeTestRef"],
    [backend.limits?.rateLimitRef, "backend.limits.rateLimitRef"],
    [backend.ranking?.strategyRef, "backend.ranking.strategyRef"],
    [backend.sensitiveDataHandling?.policyRef, "backend.sensitiveDataHandling.policyRef"]
  ];
  for (const [ref, label] of refs) resolveRepoRef(root, ref, label, errors);
  for (const [index, ref] of (backend.evidenceRefs || []).entries()) {
    resolveRepoRef(root, ref, `backend.evidenceRefs[${index}]`, errors);
  }
}

function validateAbsentRuntime(contract, label, errors) {
  if (contract.searchableEntityTypes.length !== 0) errors.push(`${label} retrieval without a global runtime must have zero searchableEntityTypes.`);
  if (contract.invocation.mode !== "none") errors.push(`${label} retrieval without a global runtime requires invocation.mode=none.`);
  for (const key of ["globalEntryRequired", "accessibleTriggerRequired", "focusManagementRequired"]) {
    if (contract.invocation[key]) errors.push(`${label} retrieval without a global runtime requires invocation.${key}=false.`);
  }
  if (contract.shortcut !== null) errors.push(`${label} retrieval without a global runtime requires shortcut=null.`);
  if (contract.authorizationMode !== "not-applicable") errors.push(`${label} retrieval without a global runtime requires authorizationMode=not-applicable.`);
  if (contract.resultContract !== null) errors.push(`${label} retrieval without a global runtime requires resultContract=null.`);
  if (contract.backendContractRef !== null) errors.push(`${label} retrieval without a global runtime requires backendContractRef=null.`);
}

export function validateGlobalRetrieval({ root, contractPath }) {
  const errors = [];
  const schema = readJson(SCHEMA_PATH);
  const contract = readJson(contractPath);
  for (const error of validateJsonSchema(contract, schema)) errors.push(`schema: ${error}`);
  if (errors.length) return { valid: false, errors, contract };

  if (contract.status !== "draft" && hasPlaceholder(contract)) {
    errors.push(`status=${contract.status} forbids unresolved placeholders/TODO/TBD values.`);
  }

  const productContextPath = resolveRepoRef(root, contract.productContextRef, "productContextRef", errors);
  const expected = expectedApplicability(contract.applicabilityBasis);
  if (contract.applicability !== expected) {
    errors.push(`applicability must be ${expected} for the declared applicabilityBasis, got ${contract.applicability}.`);
  }
  validateEvidence(root, contract, errors);

  const ids = new Set();
  for (const [index, entity] of contract.searchableEntityTypes.entries()) {
    if (ids.has(entity.id)) errors.push(`duplicate searchable entity id: ${entity.id}`);
    ids.add(entity.id);
    resolveRepoRef(root, entity.sourceRef, `searchableEntityTypes[${index}].sourceRef`, errors);
  }
  if (contract.applicabilityBasis.multipleEntityTypes && contract.searchableEntityTypes.length < 2) {
    errors.push("multipleEntityTypes=true requires at least two searchableEntityTypes.");
  }

  let shell = null;
  if (contract.applicationShellScreenRef !== null) {
    const shellPath = resolveRepoRef(root, contract.applicationShellScreenRef, "applicationShellScreenRef", errors);
    if (shellPath) {
      try {
        shell = readJson(shellPath);
      } catch (error) {
        errors.push(`applicationShellScreenRef is not valid JSON: ${error.message}`);
      }
    }
    if (shell) {
      if (shell.screen?.category !== "application-shell" && shell.screen?.surface !== "application-shell") {
        errors.push("applicationShellScreenRef must point to an application-shell screen.");
      }
      if (normalizeRepoPath(shell.productContext?.source) !== normalizeRepoPath(contract.productContextRef)) {
        errors.push("application-shell productContext.source must match global retrieval productContextRef.");
      }
      const contractRelative = relativeRepoPath(root, contractPath);
      const integrations = (shell.architecture?.integrationContracts || []).map(normalizeRepoPath);
      if (!integrations.includes(contractRelative)) {
        errors.push(`application-shell architecture.integrationContracts must include ${contractRelative}.`);
      }
    }
  }

  const optionalAbsent = contract.applicability === "optional" && contract.invocation.mode === "none";

  if (contract.applicability === "not-applicable") {
    validateAbsentRuntime(contract, "not-applicable", errors);
  } else if (optionalAbsent) {
    if (!productContextPath) errors.push("optional retrieval requires a valid productContextRef even when no global runtime is selected.");
    validateAbsentRuntime(contract, "optional", errors);
  } else {
    if (!productContextPath) errors.push("implemented retrieval requires a valid productContextRef.");
    if (contract.applicationShellScreenRef === null || !shell) errors.push("implemented retrieval requires a valid applicationShellScreenRef.");
    if (contract.searchableEntityTypes.length === 0) errors.push("implemented retrieval requires at least one searchableEntityType.");
    if (contract.invocation.mode === "none") errors.push("implemented retrieval requires a concrete invocation mode.");
    if (!contract.invocation.globalEntryRequired) errors.push("implemented retrieval requires a discoverable global entry.");
    if (!contract.invocation.accessibleTriggerRequired) errors.push("implemented retrieval requires an accessible trigger.");
    if (!contract.invocation.focusManagementRequired) errors.push("implemented retrieval requires focus management.");
    if (contract.authorizationMode === "not-applicable") errors.push("implemented retrieval requires backend-authoritative authorizationMode.");
    if (contract.resultContract === null) errors.push("implemented retrieval requires resultContract.");
    else validateResultContract(contract.resultContract, errors);
    if (contract.backendContractRef === null) errors.push("implemented retrieval requires backendContractRef.");

    if (shell) {
      const permissions = new Map((shell.productContext?.permissions || []).map((entry) => [entry.capability, entry]));
      for (const entity of contract.searchableEntityTypes) {
        const permission = permissions.get(entity.capabilityRef);
        if (!permission) errors.push(`searchable entity ${entity.id} capabilityRef must exist in application-shell productContext.permissions: ${entity.capabilityRef}.`);
        else if (!["allowed", "read-only"].includes(permission.frontendTreatment)) {
          errors.push(`searchable entity ${entity.id} capability must be allowed or read-only, got ${permission.frontendTreatment}.`);
        }
      }
    }

    if (contract.backendContractRef !== null) {
      const backendPath = resolveRepoRef(root, contract.backendContractRef, "backendContractRef", errors);
      if (backendPath) validateBackendContract(root, contract, backendPath, errors);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    contract,
    summary: {
      applicability: contract.applicability,
      implementationMode: optionalAbsent || contract.applicability === "not-applicable" ? "absent" : "implemented",
      invocationMode: contract.invocation.mode,
      shortcut: contract.shortcut,
      searchableEntityTypes: contract.searchableEntityTypes.map((entry) => entry.id),
      authorizationMode: contract.authorizationMode,
      productContextRef: contract.productContextRef,
      applicationShellScreenRef: contract.applicationShellScreenRef,
      backendContractRef: contract.backendContractRef
    }
  };
}

function writeOutput(outputPath, value) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(value, null, 2)}\n`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0] || "help";
  if (command !== "check") {
    process.stderr.write("Usage: node integrations/frontend/global-retrieval.mjs check --root <repo> --contract <docs/frontend/global-retrieval.json> [--output <report.json>]\n");
    process.exit(2);
  }
  const root = path.resolve(String(args.root || DEFAULT_ROOT));
  if (!args.contract) {
    process.stderr.write("--contract is required.\n");
    process.exit(2);
  }
  const contractPath = path.resolve(root, String(args.contract));
  if (contractPath !== root && !contractPath.startsWith(`${root}${path.sep}`)) {
    process.stderr.write("Contract path escapes repository root.\n");
    process.exit(2);
  }
  if (!fs.existsSync(contractPath)) {
    process.stderr.write(`Global retrieval contract not found: ${contractPath}\n`);
    process.exit(1);
  }
  try {
    const result = validateGlobalRetrieval({ root, contractPath });
    const report = {
      schemaVersion: "1.0.0",
      valid: result.valid,
      contract: relativeRepoPath(root, contractPath),
      ...result.summary,
      errors: result.errors
    };
    if (args.output) writeOutput(path.resolve(root, String(args.output)), report);
    if (!result.valid) {
      process.stderr.write(`Global retrieval contract failed:\n- ${result.errors.join("\n- ")}\n`);
      process.exit(1);
    }
    process.stdout.write(`Global retrieval contract valid: ${report.contract}\n`);
    process.stdout.write(`applicability=${report.applicability}\n`);
    process.stdout.write(`implementation=${report.implementationMode}\n`);
    process.stdout.write(`invocation=${report.invocationMode}\n`);
    process.stdout.write(`searchableEntityTypes=${report.searchableEntityTypes.join(",") || "none"}\n`);
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exit(1);
  }
}

function isMainModule(realPath) {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync(path.resolve(process.argv[1])) === realPath;
  } catch {
    return false;
  }
}

if (isMainModule(fileURLToPath(import.meta.url))) main();
