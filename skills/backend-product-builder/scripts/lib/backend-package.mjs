import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { validateJsonSchema, validateSchemaSupport } from "./json-schema.mjs";

const assetsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../assets");
const canonicalManifestSchema = JSON.parse(fs.readFileSync(path.join(assetsRoot, "backend-change-manifest.schema.json"), "utf8"));
const canonicalScorecardSchema = JSON.parse(fs.readFileSync(path.join(assetsRoot, "backend-representative-scorecard.schema.json"), "utf8"));
const canonicalValidatorEvidenceSchema = JSON.parse(fs.readFileSync(path.join(assetsRoot, "backend-validator-evidence.schema.json"), "utf8"));
const manifestSchemaSupportErrors = validateSchemaSupport(canonicalManifestSchema);
const scorecardSchemaSupportErrors = validateSchemaSupport(canonicalScorecardSchema);
const evidenceSchemaSupportErrors = validateSchemaSupport(canonicalValidatorEvidenceSchema);

export const resultStates = new Set(["passed", "failed", "partial", "not-run"]);
// This condition list is the same deriveBackendRepresentativeGate rule documented in
// skills/spec-driven-engineering/references/applicability-contract.md — the two must never diverge.
export const representativeConditionKeys = [
  "newServiceOrSubsystem",
  "publicContract",
  "persistenceOrMigration",
  "securityOrTenancy",
  "materialOperationalCost",
  "criticalRisk",
  "largeOrComplex"
];
export const humanApprovalConditionKeys = [
  "publicContract",
  "persistenceOrMigration",
  "securityOrTenancy",
  "materialOperationalCost",
  "criticalRisk"
];
export const scorecardDimensionIds = [
  "contract-traceability",
  "boundaries",
  "invariants-validation",
  "data-integrity",
  "security-tenancy",
  "concurrency-ordering",
  "resilience-recovery",
  "observability-sensitive-data",
  "migration-compatibility",
  "performance-slo",
  "documentation-drift",
  "speculative-complexity"
];

export function parseArgs(argv) {
  const result = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) {
      result._.push(item);
      continue;
    }
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) result[key] = true;
    else {
      result[key] = next;
      index += 1;
    }
  }
  return result;
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function resolveProjectPath(root, value) {
  if (!value || typeof value !== "string" || path.isAbsolute(value)) return null;
  const normalizedRoot = path.resolve(root);
  const resolved = path.resolve(normalizedRoot, value);
  return resolved === normalizedRoot || resolved.startsWith(`${normalizedRoot}${path.sep}`) ? resolved : null;
}

export function existsFrom(root, value) {
  const resolved = resolveProjectPath(root, value);
  return Boolean(resolved) && fs.existsSync(resolved);
}

function nonEmptyFile(root, value) {
  const resolved = resolveProjectPath(root, value);
  return Boolean(resolved) && fs.existsSync(resolved) && fs.statSync(resolved).isFile() && fs.statSync(resolved).size > 0;
}

function hashFile(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function validateEvidencePath(root, value, label, errors) {
  if (!resolveProjectPath(root, value)) errors.push(`${label} must be a relative path inside the project root: ${value}`);
  else if (!nonEmptyFile(root, value)) errors.push(`${label} is missing or empty: ${value}`);
}

export function validateValidatorEvidence(entry, root) {
  const errors = evidenceSchemaSupportErrors.map((error) => `Validator evidence schema definition: ${error}`);
  if (!entry?.validatorEvidencePath) return ["validatorEvidencePath is required"];
  const evidenceFile = resolveProjectPath(root, entry.validatorEvidencePath);
  if (!evidenceFile) return [`Validator evidence path escapes the project root: ${entry.validatorEvidencePath}`];
  if (!fs.existsSync(evidenceFile)) return [`Validator evidence not found: ${entry.validatorEvidencePath}`];

  let evidence;
  try {
    evidence = readJson(evidenceFile);
  } catch (error) {
    return [`Validator evidence is invalid JSON: ${entry.validatorEvidencePath}: ${error.message}`];
  }
  for (const error of validateJsonSchema(evidence, canonicalValidatorEvidenceSchema)) {
    errors.push(`Validator evidence schema ${entry.id}: ${error}`);
  }
  if (evidence.interfaceId !== entry.id) errors.push(`Validator evidence interface mismatch for ${entry.id}`);
  if (evidence.command !== entry.validatorCommand) errors.push(`Validator evidence command mismatch for ${entry.id}`);
  if (evidence.contractPath !== entry.contractPath) errors.push(`Validator evidence contract path mismatch for ${entry.id}`);
  if (path.resolve(evidence.cwd || "") !== path.resolve(root)) errors.push(`Validator evidence cwd mismatch for ${entry.id}`);
  const contractFile = resolveProjectPath(root, entry.contractPath);
  if (contractFile && fs.existsSync(contractFile) && evidence.contractSha256 !== hashFile(contractFile)) {
    errors.push(`Validator evidence is stale for ${entry.id}; contract SHA-256 changed`);
  }
  if (evidence.result !== "passed" || evidence.exitCode !== 0) errors.push(`Validator evidence did not pass for ${entry.id}`);
  const started = Date.parse(evidence.startedAt || "");
  const ended = Date.parse(evidence.endedAt || "");
  if (Number.isNaN(started) || Number.isNaN(ended) || ended < started) errors.push(`Validator evidence timestamps are invalid for ${entry.id}`);
  return errors;
}

export function runContractValidators(manifest, root, options = {}) {
  const timeoutMs = Number(options.timeoutMs || 120000);
  const results = [];
  for (const entry of manifest.interfaces || []) {
    const contractFile = resolveProjectPath(root, entry.contractPath);
    const evidenceFile = resolveProjectPath(root, entry.validatorEvidencePath);
    if (!contractFile || !fs.existsSync(contractFile)) throw new Error(`Contract file not found or outside project: ${entry.contractPath}`);
    if (!evidenceFile) throw new Error(`Validator evidence path is outside project: ${entry.validatorEvidencePath}`);

    const startedAt = new Date().toISOString();
    const execution = spawnSync(entry.validatorCommand, {
      cwd: root,
      encoding: "utf8",
      shell: true,
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024
    });
    const endedAt = new Date().toISOString();
    const exitCode = Number.isInteger(execution.status) ? execution.status : -1;
    const result = exitCode === 0 ? "passed" : "failed";
    const evidence = {
      $schema: "../backend-validator-evidence.schema.json",
      schemaVersion: "1.0.0",
      interfaceId: entry.id,
      command: entry.validatorCommand,
      cwd: path.resolve(root),
      contractPath: entry.contractPath,
      contractSha256: hashFile(contractFile),
      startedAt,
      endedAt,
      exitCode,
      result,
      stdout: String(execution.stdout || "").slice(0, 65536),
      stderr: String(execution.stderr || execution.error?.message || "").slice(0, 65536)
    };
    fs.mkdirSync(path.dirname(evidenceFile), { recursive: true });
    fs.writeFileSync(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`);
    entry.validatorResult = result;
    results.push({ id: entry.id, result, evidencePath: entry.validatorEvidencePath });
  }
  return results;
}

export function validateScorecard(manifest, root) {
  const errors = scorecardSchemaSupportErrors.map((error) => `Scorecard schema definition: ${error}`);
  const scorecardFile = resolveProjectPath(root, manifest.slice?.scorecardPath);
  if (!scorecardFile) return [`Scorecard path escapes the project root: ${manifest.slice?.scorecardPath}`];
  if (!fs.existsSync(scorecardFile)) return [`Scorecard not found: ${manifest.slice?.scorecardPath}`];

  let scorecard;
  try {
    scorecard = readJson(scorecardFile);
  } catch (error) {
    return [`Scorecard is invalid JSON: ${error.message}`];
  }
  for (const error of validateJsonSchema(scorecard, canonicalScorecardSchema)) errors.push(`Scorecard schema: ${error}`);
  if (scorecard.feature !== manifest.feature) errors.push("Scorecard feature does not match manifest feature");

  const ids = (scorecard.dimensions || []).map((dimension) => dimension.id);
  if (new Set(ids).size !== ids.length) errors.push("Scorecard contains duplicate dimensions");
  for (const id of scorecardDimensionIds) if (!ids.includes(id)) errors.push(`Scorecard dimension is missing: ${id}`);

  for (const dimension of scorecard.dimensions || []) {
    if (dimension.status === "passed") {
      if (!dimension.evidencePaths?.length) errors.push(`Scorecard dimension ${dimension.id} passed without evidence`);
      for (const evidencePath of dimension.evidencePaths || []) {
        validateEvidencePath(root, evidencePath, `Scorecard evidence for ${dimension.id}`, errors);
      }
    } else if (dimension.status === "not-applicable") {
      if (!dimension.rationale || dimension.rationale.trim().length < 10) errors.push(`Scorecard dimension ${dimension.id} needs a concrete N/A rationale`);
    } else {
      errors.push(`Scorecard dimension ${dimension.id} is not releasable: ${dimension.status}`);
    }
  }

  if (scorecard.criticalFindings?.length) errors.push("Scorecard has open critical findings");
  if (!["approved", "approved-with-accepted-risk"].includes(scorecard.decision)) errors.push(`Scorecard decision is not approved: ${scorecard.decision}`);
  if (!scorecard.reviewer?.trim()) errors.push("Scorecard reviewer is required for approval");
  if (Number.isNaN(Date.parse(scorecard.timestamp || ""))) errors.push("Scorecard approval timestamp must be ISO-8601");
  if (scorecard.decision === "approved-with-accepted-risk" && !scorecard.acceptedRisks?.length) {
    errors.push("Scorecard approved-with-accepted-risk requires accepted risks with authority");
  }
  return errors;
}

export function validateManifest(manifest, root, options = {}) {
  const errors = manifestSchemaSupportErrors.map((error) => `Manifest schema definition: ${error}`);
  const warnings = [];
  if (manifest?.schemaVersion === "1.2.0") {
    errors.push("Backend manifest 1.2.0 is historical; migrate explicitly to 1.3.0 and record technology selection before reopening current work. Silent conversion is forbidden.");
  }
  for (const error of validateJsonSchema(manifest, canonicalManifestSchema)) errors.push(`Manifest schema: ${error}`);
  const required = ["schemaVersion", "feature", "mode", "complexity", "criticality", "technology", "gate", "interfaces", "architecture", "model", "data", "security", "reliability", "observability", "slice", "decision"];
  for (const key of required) if (!(key in manifest)) errors.push(`Missing manifest field: ${key}`);
  if (errors.length) return { errors, warnings };

  const conditions = manifest.gate.conditions;
  const inferredPublicContract = manifest.interfaces.some(
    (entry) => ["partner", "public"].includes(entry.exposure) && entry.changeType !== "unchanged"
  );
  const inferredNewService = manifest.mode === "new-build";
  const inferredPersistence = manifest.data.materialChange === true;
  const inferredSecurity = manifest.security.materialChange === true;
  const inferredCriticalRisk = manifest.criticality === "critical";
  const inferredLargeOrComplex = ["large", "complex"].includes(manifest.complexity);
  const inferredConditions = {
    newServiceOrSubsystem: inferredNewService,
    publicContract: inferredPublicContract,
    persistenceOrMigration: inferredPersistence,
    securityOrTenancy: inferredSecurity,
    criticalRisk: inferredCriticalRisk,
    largeOrComplex: inferredLargeOrComplex
  };
  for (const [key, expected] of Object.entries(inferredConditions)) {
    if (conditions[key] !== expected) errors.push(`gate.conditions.${key} must match manifest facts (${expected})`);
  }
  const gateRequired = representativeConditionKeys.some((key) => conditions[key] === true);
  const humanApprovalRequired = humanApprovalConditionKeys.some((key) => conditions[key] === true);
  if (manifest.gate.required !== gateRequired) errors.push(`gate.required must equal structured applicability (${gateRequired})`);
  if (manifest.gate.humanApprovalRequired !== humanApprovalRequired) errors.push(`humanApprovalRequired must equal structured approval applicability (${humanApprovalRequired})`);
  if (manifest.mode === "migration" && !manifest.data.materialChange) errors.push("migration mode requires data.materialChange true");
  if (manifest.data.migrationStrategy !== "none" && !manifest.data.materialChange) {
    errors.push("Migration strategy requires data.materialChange true");
  }
  if (!manifest.gate.required && manifest.gate.status !== "not-applicable") errors.push("A non-applicable gate must use status not-applicable");
  if (manifest.gate.required && manifest.gate.status === "not-applicable") errors.push("A required gate cannot use status not-applicable");

  const allowedContractTypesByKind = {
    http: ["openapi", "arazzo", "custom"],
    event: ["asyncapi", "arazzo", "custom"],
    graphql: ["graphql-sdl", "custom"],
    grpc: ["protobuf", "custom"],
    job: ["arazzo", "custom"],
    cli: ["custom"]
  };
  for (const entry of manifest.interfaces) {
    if (options.checkFiles && !existsFrom(root, entry.contractPath)) errors.push(`Contract file not found or outside project: ${entry.contractPath}`);
    if (options.checkFiles && !existsFrom(root, entry.scenarioMatrixPath)) errors.push(`Scenario matrix not found or outside project: ${entry.scenarioMatrixPath}`);
    const allowedContractTypes = allowedContractTypesByKind[entry.kind] || [];
    if (entry.contractType && !allowedContractTypes.includes(entry.contractType)) {
      errors.push(`Interface '${entry.id}' has kind '${entry.kind}' incompatible with contractType '${entry.contractType}' (allowed: ${allowedContractTypes.join(", ")})`);
    }
    if (entry.validatorResult === "passed" && options.checkFiles) {
      for (const error of validateValidatorEvidence(entry, root)) errors.push(error);
    }
  }

  for (const mechanism of manifest.architecture.introducedMechanisms) {
    for (const evidencePath of mechanism.evidencePaths) {
      if (options.checkFiles) validateEvidencePath(root, evidencePath, `Architecture evidence for ${mechanism.kind}`, errors);
    }
  }

  for (const sectionName of ["model", "data", "security", "reliability", "observability"]) {
    const section = manifest[sectionName];
    if (section.applicable && !section.evidencePath) errors.push(`${sectionName}.evidencePath is required when applicable`);
    if (!section.applicable && !section.notApplicableReason) errors.push(`${sectionName}.notApplicableReason is required when not applicable`);
    if (options.checkFiles && section.applicable) validateEvidencePath(root, section.evidencePath, `${sectionName} evidence`, errors);
  }

  if (manifest.data.applicable && !manifest.data.verificationCommand) errors.push("data.verificationCommand is required when data changes apply");
  if (!manifest.data.rollbackOrRecovery) errors.push("data.rollbackOrRecovery is required");
  if (manifest.security.applicable && !manifest.security.asvsVersion) errors.push("security.asvsVersion is required for applicable security review");
  if (options.checkFiles) {
    if (!existsFrom(root, manifest.slice.scorecardPath)) errors.push(`Scorecard not found or outside project: ${manifest.slice.scorecardPath}`);
    for (const evidencePath of manifest.slice.evidencePaths) validateEvidencePath(root, evidencePath, "Slice evidence", errors);
  }

  if (manifest.gate.status === "backend-broad-build-approved") {
    if (manifest.slice.status !== "passed") errors.push("Broad backend build requires a passed representative slice");
    if (manifest.interfaces.some((entry) => entry.validatorResult !== "passed")) errors.push("Broad backend build requires every interface contract validator to pass");
    if (options.checkFiles) errors.push(...validateScorecard(manifest, root));
    if (manifest.gate.humanApprovalRequired) {
      if (!["approved", "approved-with-accepted-risk"].includes(manifest.decision.state)) errors.push("Human-gated broad build requires an approved decision");
      if (!manifest.decision.approver || Number.isNaN(Date.parse(manifest.decision.timestamp))) {
        errors.push("Human-gated broad build requires approver and ISO-8601 timestamp");
      }
    } else if (manifest.decision.state !== "not-required") {
      errors.push("Non-human backend gate must use decision.state not-required");
    }
  }

  if (manifest.interfaces.some((entry) => entry.validatorResult === "not-run")) warnings.push("At least one contract validator is not-run; record attempted execution before approval");
  return { errors, warnings };
}

export function printReport(title, errors, warnings, details = []) {
  console.log(title);
  for (const detail of details) console.log(`  INFO  ${detail}`);
  for (const warning of warnings) console.log(`  WARN  ${warning}`);
  for (const error of errors) console.log(`  ERROR ${error}`);
  console.log(errors.length === 0 ? "Result: PASS" : "Result: FAIL");
  return errors.length === 0;
}
