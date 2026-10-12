#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateJsonSchema } from "../../skills/spec-driven-engineering/scripts/lib/json-schema.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "../..");
const AUTONOMY_POLICY_REF = "prompts/spec-driven/autonomy-policy.json";
const AUTONOMY_DECISION_SCHEMA_REF = "integrations/governance/autonomy-decision.schema.json";
const AUTONOMY_EVIDENCE_SCHEMA_REF = "integrations/governance/autonomy-evidence.schema.json";
const AUTONOMY_VALIDATOR_REF = "integrations/governance/validate-autonomy-policy.mjs";

function usage() {
  return [
    "Usage:",
    "  node integrations/governance/autonomy-evidence.mjs record --root <project-root> --directive <autonomy-consumption-directive.json> [--ledger <autonomous-decisions.json>]",
    "  node integrations/governance/autonomy-evidence.mjs check --root <project-root> --ledger <autonomous-decisions.json>"
  ].join("\n");
}

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
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read JSON ${filePath}: ${error.message}`);
  }
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function withinRoot(root, filePath, label) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(filePath);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`${label} must be inside project root: ${resolved}`);
  }
  return resolved;
}

function repositoryRef(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

function resolveRepositoryFile(root, ref, label) {
  if (!ref || typeof ref !== "string") throw new Error(`${label} is required.`);
  if (path.isAbsolute(ref)) throw new Error(`${label} must be repository-relative: ${ref}`);
  const resolved = withinRoot(root, path.resolve(root, ref), label);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new Error(`${label} not found: ${ref}`);
  }
  return resolved;
}

function resolveRepositoryPath(root, ref, label) {
  if (!ref || typeof ref !== "string") throw new Error(`${label} is required.`);
  if (path.isAbsolute(ref)) throw new Error(`${label} must be repository-relative: ${ref}`);
  return withinRoot(root, path.resolve(root, ref), label);
}

function validateWithSchema(value, schemaPath, label) {
  const errors = validateJsonSchema(value, readJson(schemaPath));
  if (errors.length) {
    throw new Error(`${label} violates its schema:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  }
}

function runAutonomyValidator(root) {
  const entrypoint = path.resolve(root, AUTONOMY_VALIDATOR_REF);
  const result = spawnSync(process.execPath, [entrypoint, "--root", root], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`Autonomy policy rejected evidence operation${detail ? `:\n${detail}` : "."}`);
  }
}

function ownerEvidenceRef(feature) {
  return `.specs/features/${feature}/11-evidence.md`;
}

function canonicalLedgerRef(feature) {
  return `.specs/features/${feature}/autonomous-decisions.json`;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function recordComparable(record) {
  const { recordedAt, ...stable } = record;
  return JSON.stringify(canonicalize(stable));
}

function writeJsonAtomic(filePath, value) {
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  const temporary = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, serialized);
  fs.renameSync(temporary, filePath);
}

function validateLedgerSemantics({ root, ledgerPath, ledger, evidenceSchemaPath, requireOwnerFile }) {
  validateWithSchema(ledger, evidenceSchemaPath, "Autonomy decision evidence ledger");
  if (ledger.artifactKind !== "autonomy-decision-evidence-ledger") {
    throw new Error("Ledger must contain artifactKind=autonomy-decision-evidence-ledger.");
  }

  const expectedLedgerRef = canonicalLedgerRef(ledger.feature);
  const actualLedgerRef = repositoryRef(root, ledgerPath);
  if (actualLedgerRef !== expectedLedgerRef) {
    throw new Error(`Autonomy evidence ledger must use canonical path '${expectedLedgerRef}', got '${actualLedgerRef}'.`);
  }

  const expectedOwner = ownerEvidenceRef(ledger.feature);
  if (ledger.ownerEvidenceRef !== expectedOwner) {
    throw new Error(`Autonomy evidence ledger owner must be '${expectedOwner}'.`);
  }
  if (requireOwnerFile) {
    resolveRepositoryFile(root, expectedOwner, "11-evidence owner");
  }

  const seen = new Set();
  for (const record of ledger.records || []) {
    if (seen.has(record.decisionId)) {
      throw new Error(`Duplicate autonomy evidence decisionId '${record.decisionId}'.`);
    }
    seen.add(record.decisionId);
    if (record.feature !== ledger.feature) {
      throw new Error(`${record.decisionId}: record feature '${record.feature}' does not match ledger feature '${ledger.feature}'.`);
    }
    if (record.ownerEvidenceRef !== expectedOwner) {
      throw new Error(`${record.decisionId}: record ownerEvidenceRef must be '${expectedOwner}'.`);
    }
    if (record.durability !== "durable") {
      throw new Error(`${record.decisionId}: persistent autonomy ledger may contain only durability=durable records.`);
    }
  }

  return ledger;
}

function buildEvidenceRecord({ root, directivePath }) {
  runAutonomyValidator(root);

  const decisionSchemaPath = resolveRepositoryFile(root, AUTONOMY_DECISION_SCHEMA_REF, "autonomy decision schema");
  const evidenceSchemaPath = resolveRepositoryFile(root, AUTONOMY_EVIDENCE_SCHEMA_REF, "autonomy evidence schema");
  const policyPath = resolveRepositoryFile(root, AUTONOMY_POLICY_REF, "autonomy policy");

  const directive = readJson(directivePath);
  validateWithSchema(directive, decisionSchemaPath, "Autonomy consumption directive");
  if (directive.artifactKind !== "autonomy-consumption-directive") {
    throw new Error("--directive must contain artifactKind=autonomy-consumption-directive.");
  }

  const decisionRef = directive.decisionProvenance?.ref;
  const decisionPath = resolveRepositoryFile(root, decisionRef, "directive decision provenance");
  if (sha256(decisionPath) !== directive.decisionProvenance.sha256) {
    throw new Error("Directive decision provenance is stale or tampered.");
  }

  const decision = readJson(decisionPath);
  validateWithSchema(decision, decisionSchemaPath, "Autonomy decision result");
  if (decision.artifactKind !== "autonomy-decision-result") {
    throw new Error("Directive provenance must target an autonomy-decision-result.");
  }
  if (decision.decisionId !== directive.decisionId || decision.disposition !== directive.disposition || decision.selectedOption !== directive.selectedOption) {
    throw new Error("Directive does not match its decision result identity/disposition/selection.");
  }

  const policy = readJson(policyPath);
  const classPolicy = (policy.decisionClasses || []).find((item) => item.id === decision.decisionClass);
  if (!classPolicy) throw new Error(`Unknown autonomy decision class '${decision.decisionClass}'.`);
  const dispositionPolicy = (policy.dispositions || []).find((item) => item.id === decision.disposition);
  if (!dispositionPolicy) throw new Error(`Unknown autonomy disposition '${decision.disposition}'.`);

  const currentPolicyHash = sha256(policyPath);
  if (decision.policyProvenance?.autonomyPolicy?.ref !== AUTONOMY_POLICY_REF || decision.policyProvenance.autonomyPolicy.sha256 !== currentPolicyHash) {
    throw new Error("Decision autonomy-policy provenance is stale or does not match the current policy at record time.");
  }

  const effectiveRef = decision.policyProvenance?.effectivePolicy?.ref;
  const effectivePolicyPath = resolveRepositoryFile(root, effectiveRef, "decision effective-policy provenance");
  if (sha256(effectivePolicyPath) !== decision.policyProvenance.effectivePolicy.sha256) {
    throw new Error("Decision effective-policy provenance is stale or tampered at record time.");
  }

  const expectedRecordDecision = dispositionPolicy.decisionRecordRequired === true || classPolicy.recordDecision === true;
  if (directive.recordDecision !== expectedRecordDecision) {
    throw new Error(`${decision.decisionId}: directive recordDecision does not match canonical autonomy policy.`);
  }

  const durability = expectedRecordDecision ? "durable" : "ephemeral";
  const record = {
    $schema: AUTONOMY_EVIDENCE_SCHEMA_REF,
    schemaVersion: "1.0.0",
    artifactKind: "autonomy-decision-evidence-record",
    decisionId: decision.decisionId,
    feature: decision.feature,
    task: decision.task || null,
    stage: decision.stage,
    decisionClass: decision.decisionClass,
    disposition: decision.disposition,
    consumeAction: directive.action,
    selectedOption: decision.selectedOption,
    alternatives: decision.rejectedOptions || [],
    authority: classPolicy.decisionAuthority,
    reasonCodes: decision.reasonCodes || [],
    evidenceRefs: decision.evidenceRefs || [],
    rulesApplied: decision.rulesApplied || [],
    policyRefs: {
      autonomyPolicy: decision.policyProvenance.autonomyPolicy.ref,
      effectivePolicy: decision.policyProvenance.effectivePolicy.ref
    },
    policyHashes: {
      autonomyPolicy: decision.policyProvenance.autonomyPolicy.sha256,
      effectivePolicy: decision.policyProvenance.effectivePolicy.sha256
    },
    decisionProvenance: {
      ref: decisionRef,
      sha256: directive.decisionProvenance.sha256
    },
    directiveProvenance: {
      ref: repositoryRef(root, directivePath),
      sha256: sha256(directivePath)
    },
    reversible: decision.reversible,
    durability,
    recordedAt: new Date().toISOString(),
    ownerEvidenceRef: ownerEvidenceRef(decision.feature)
  };

  validateWithSchema(record, evidenceSchemaPath, "Autonomy decision evidence record");
  return { record, evidenceSchemaPath };
}

function recordEvidence({ root, directivePath, ledgerArg }) {
  const suppliedDirective = readJson(directivePath);
  const decisionPath = resolveRepositoryFile(root, suppliedDirective.decisionProvenance?.ref, "decision provenance");
  const decision = readJson(decisionPath);
  const canonical = path.join(root, ".specs", "features", decision.feature, "autonomy-directives", `${decision.decisionId}.json`);
  if (fs.existsSync(canonical) && sha256(canonical) === sha256(directivePath)) directivePath = canonical;
  const { record, evidenceSchemaPath } = buildEvidenceRecord({ root, directivePath });

  if (record.durability === "ephemeral") {
    if (ledgerArg) {
      throw new Error(`${record.decisionId}: ephemeral SAFE_AUTONOMOUS evidence must not be persisted in autonomous-decisions.json.`);
    }
    return record;
  }

  const expectedLedgerRef = canonicalLedgerRef(record.feature);
  if (ledgerArg && ledgerArg !== expectedLedgerRef) {
    throw new Error(`Durable autonomy evidence must use canonical ledger '${expectedLedgerRef}'.`);
  }
  const ledgerRef = ledgerArg || expectedLedgerRef;
  const ledgerPath = resolveRepositoryPath(root, ledgerRef, "autonomy evidence ledger");
  const featureDirectory = path.dirname(ledgerPath);
  if (!fs.existsSync(featureDirectory) || !fs.statSync(featureDirectory).isDirectory()) {
    throw new Error(`Feature directory must exist before recording autonomy evidence: ${repositoryRef(root, featureDirectory)}`);
  }

  let ledger;
  if (fs.existsSync(ledgerPath)) {
    ledger = validateLedgerSemantics({
      root,
      ledgerPath,
      ledger: readJson(ledgerPath),
      evidenceSchemaPath,
      requireOwnerFile: false
    });
  } else {
    ledger = {
      $schema: AUTONOMY_EVIDENCE_SCHEMA_REF,
      schemaVersion: "1.0.0",
      artifactKind: "autonomy-decision-evidence-ledger",
      canonical: false,
      feature: record.feature,
      ownerEvidenceRef: record.ownerEvidenceRef,
      records: []
    };
  }

  const existing = (ledger.records || []).find((item) => item.decisionId === record.decisionId);
  if (existing) {
    if (recordComparable(existing) !== recordComparable(record)) {
      throw new Error(`${record.decisionId}: existing durable evidence differs from the newly derived record; refusing to rewrite decision history.`);
    }
    return existing;
  }

  ledger.records.push(record);
  ledger.records.sort((left, right) => left.recordedAt.localeCompare(right.recordedAt) || left.decisionId.localeCompare(right.decisionId));
  validateLedgerSemantics({ root, ledgerPath, ledger, evidenceSchemaPath, requireOwnerFile: false });
  writeJsonAtomic(ledgerPath, ledger);
  return record;
}

function checkLedger({ root, ledgerPath }) {
  runAutonomyValidator(root);
  const evidenceSchemaPath = resolveRepositoryFile(root, AUTONOMY_EVIDENCE_SCHEMA_REF, "autonomy evidence schema");
  const ledger = readJson(ledgerPath);
  validateLedgerSemantics({ root, ledgerPath, ledger, evidenceSchemaPath, requireOwnerFile: true });
  const expectedPath = path.join(path.dirname(ledgerPath), "autonomy-required.json");
  if (!fs.existsSync(expectedPath)) throw new Error("Expected autonomy decision inventory is missing");
  const expected = readJson(expectedPath);
  if (expected.feature !== ledger.feature || !Array.isArray(expected.directives)) throw new Error("Invalid expected autonomy inventory");
  const retainedDirectory = path.join(path.dirname(ledgerPath), "autonomy-directives");
  const retained = fs.existsSync(retainedDirectory) ? fs.readdirSync(retainedDirectory).filter(name => name.endsWith(".json")).map(name => repositoryRef(root, path.join(retainedDirectory, name))) : [];
  if (retained.some(ref => !expected.directives.includes(ref))) throw new Error("Consumed audited directive omitted from expected inventory");
  const requiredIds = expected.directives.map(ref => {
    const directivePath = resolveRepositoryFile(root, ref, "required directive");
    const { record } = buildEvidenceRecord({ root, directivePath });
    if (record.feature !== ledger.feature || record.durability !== "durable") throw new Error("Expected directive has wrong feature or durability");
    const retained = ledger.records.find(item => item.decisionId === record.decisionId);
    if (!retained || recordComparable(retained) !== recordComparable(record)) throw new Error(`Required audited decision missing or changed: ${record.decisionId}`);
    return record.decisionId;
  });
  if (ledger.records.some(record => !requiredIds.includes(record.decisionId))) throw new Error("Ledger contains a decision outside the expected inventory");
  if ((ledger.records || []).length === 0) {
    throw new Error("Autonomy evidence ledger must not be empty when it exists.");
  }
  return {
    artifactKind: "autonomy-decision-evidence-check",
    feature: ledger.feature,
    ledger: repositoryRef(root, ledgerPath),
    ownerEvidenceRef: ledger.ownerEvidenceRef,
    records: ledger.records.length,
    decisionIds: ledger.records.map((record) => record.decisionId).sort()
  };
}

const args = parseArgs(process.argv.slice(2));
const command = args._[0];
if (!new Set(["record", "check"]).has(command)) {
  console.error(command ? `Unknown command '${command}'.\n${usage()}` : usage());
  process.exit(1);
}

try {
  const root = path.resolve(String(args.root || DEFAULT_ROOT));
  let output;

  if (command === "record") {
    if (typeof args.directive !== "string") throw new Error("record requires --directive <autonomy-consumption-directive.json>.\n" + usage());
    const directivePath = resolveRepositoryFile(root, String(args.directive), "autonomy consumption directive");
    const ledgerArg = typeof args.ledger === "string" ? String(args.ledger) : null;
    output = recordEvidence({ root, directivePath, ledgerArg });
  } else {
    if (typeof args.ledger !== "string") throw new Error("check requires --ledger <autonomous-decisions.json>.\n" + usage());
    const ledgerReference = String(args.ledger);
    if (path.isAbsolute(ledgerReference)) throw new Error(`autonomy evidence ledger must be repository-relative: ${ledgerReference}`);
    const candidatePath = withinRoot(root, path.resolve(root, ledgerReference), "autonomy evidence ledger");
    if (!fs.existsSync(candidatePath)) {
      const featureDirectory = path.dirname(candidatePath);
      const expectedPath = path.join(featureDirectory, "autonomy-required.json");
      if (!fs.existsSync(expectedPath)) throw new Error("Missing autonomy evidence and expected decision inventory; absence does not prove non-applicability");
      const expected = readJson(expectedPath);
      if (ledgerReference !== canonicalLedgerRef(expected.feature)) throw new Error("Autonomy evidence must use canonical ledger path");
      const retainedDirectory = path.join(featureDirectory, "autonomy-directives");
      if (fs.existsSync(retainedDirectory) && fs.readdirSync(retainedDirectory).length) throw new Error("Consumed audited decisions require a ledger");
      if (expected.feature !== path.basename(featureDirectory) || !Array.isArray(expected.directives) || expected.directives.length !== 0) throw new Error("Required autonomy evidence ledger is missing");
      output = { artifactKind: "autonomy-decision-evidence-check", status: "not-applicable", reason: "The executor inventory contains zero required decisions", ledger: repositoryRef(root, candidatePath) };
    } else {
      const ledgerPath = resolveRepositoryFile(root, ledgerReference, "autonomy evidence ledger");
      output = { status: "passed", ...checkLedger({ root, ledgerPath }) };
    }
  }

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
} catch (error) {
  console.error(`Autonomy decision evidence ${command || "operation"} failed: ${error.message}`);
  process.exit(1);
}
