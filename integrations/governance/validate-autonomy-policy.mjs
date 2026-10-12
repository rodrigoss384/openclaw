#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateJsonSchema } from "../../skills/spec-driven-engineering/scripts/lib/json-schema.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "../..");
const DEFAULT_POLICY = "prompts/spec-driven/autonomy-policy.json";

const EXPECTED_DISPOSITIONS = new Map([
  ["SAFE_AUTONOMOUS", { selectionAllowed: true, executionAllowed: true, humanRequired: false, decisionRecordRequired: false }],
  ["AUTONOMOUS_WITH_AUDIT", { selectionAllowed: true, executionAllowed: true, humanRequired: false, decisionRecordRequired: true }],
  ["HUMAN_REQUIRED", { selectionAllowed: false, executionAllowed: false, humanRequired: true, decisionRecordRequired: true }],
  ["BLOCKED", { selectionAllowed: false, executionAllowed: false, humanRequired: false, decisionRecordRequired: true }]
]);

const AUTONOMOUS_CLASSES = new Set([
  "reversible-internal",
  "reversible-contract-bounded",
  "equivalent-variant",
  "design-authority-bounded"
]);

const HUMAN_CLASSES = new Set([
  "product-consequential",
  "security-consequential",
  "data-consequential",
  "cost-consequential",
  "legal-consequential",
  "brand-consequential",
  "behavioral-high-risk",
  "external-destructive"
]);

const EXPECTED_CLASSES = new Set([
  ...AUTONOMOUS_CLASSES,
  ...HUMAN_CLASSES,
  "unknown-consequential"
]);

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
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

function resolveRepositoryFile(root, ref, label, errors) {
  if (!ref || typeof ref !== "string") return;
  if (path.isAbsolute(ref)) {
    errors.push(`${label} must be repository-relative.`);
    return;
  }
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(root, ref);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    errors.push(`${label} escapes project root: '${ref}'.`);
    return;
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    errors.push(`${label} not found: '${ref}'.`);
  }
}

function validateDispositionContract(policy, errors) {
  const seen = new Set();
  const dispositions = new Map();
  for (const disposition of policy.dispositions || []) {
    if (seen.has(disposition.id)) errors.push(`Duplicate disposition '${disposition.id}'.`);
    seen.add(disposition.id);
    dispositions.set(disposition.id, disposition);

    const expected = EXPECTED_DISPOSITIONS.get(disposition.id);
    if (!expected) continue;
    for (const [field, value] of Object.entries(expected)) {
      if (disposition[field] !== value) {
        errors.push(`${disposition.id}: ${field} must be ${value}.`);
      }
    }
  }

  for (const id of EXPECTED_DISPOSITIONS.keys()) {
    if (!seen.has(id)) errors.push(`Missing disposition '${id}'.`);
  }
  return dispositions;
}

function validateEvidence(label, evidence, errors) {
  if (!evidence) return;
  if (evidence.required === true && evidence.minimumRefs < 1) {
    errors.push(`${label}: required evidence must require at least one evidence ref.`);
  }
  if (evidence.required === false && evidence.minimumRefs !== 0) {
    errors.push(`${label}: optional evidence must use minimumRefs=0.`);
  }
}

function validateClassContract(policy, dispositions, errors) {
  const seen = new Set();

  for (const decisionClass of policy.decisionClasses || []) {
    const label = decisionClass.id || "<decision-class>";
    if (seen.has(decisionClass.id)) errors.push(`Duplicate decision class '${decisionClass.id}'.`);
    seen.add(decisionClass.id);

    const disposition = dispositions.get(decisionClass.defaultDisposition);
    if (disposition?.humanRequired === true && decisionClass.humanRequired !== true) {
      errors.push(`${label}: HUMAN_REQUIRED disposition requires humanRequired=true.`);
    }
    if (disposition?.decisionRecordRequired === true && decisionClass.recordDecision !== true) {
      errors.push(`${label}: ${decisionClass.defaultDisposition} requires recordDecision=true.`);
    }

    if (!decisionClass.allowedSources?.includes("canonical-contracts")) {
      errors.push(`${label}: canonical-contracts must remain an allowed source.`);
    }

    validateEvidence(label, decisionClass.evidenceRequirements, errors);

    if (AUTONOMOUS_CLASSES.has(decisionClass.id)) {
      if (decisionClass.decisionAuthority !== "agent") errors.push(`${label}: autonomous class authority must be agent.`);
      if (decisionClass.humanRequired !== false) errors.push(`${label}: autonomous class cannot require a human by default.`);
      if (!["SAFE_AUTONOMOUS", "AUTONOMOUS_WITH_AUDIT"].includes(decisionClass.defaultDisposition)) {
        errors.push(`${label}: autonomous class must default to an autonomous disposition.`);
      }
      if (decisionClass.candidateRequirements?.minimumCandidates < 1) errors.push(`${label}: autonomous class requires at least one valid candidate.`);
      if (decisionClass.candidateRequirements?.mustSatisfyCanonicalContracts !== true) errors.push(`${label}: autonomous candidates must satisfy canonical contracts.`);
      if (decisionClass.candidateRequirements?.reversibleRequired !== true) errors.push(`${label}: autonomous class requires reversibility.`);
    }

    if (decisionClass.id === "reversible-internal") {
      if (decisionClass.defaultDisposition !== "SAFE_AUTONOMOUS") errors.push(`${label}: must default to SAFE_AUTONOMOUS.`);
      if (decisionClass.recordDecision !== false) errors.push(`${label}: SAFE_AUTONOMOUS internal choices do not require durable decision recording.`);
    }

    if (decisionClass.id === "reversible-contract-bounded") {
      if (decisionClass.defaultDisposition !== "AUTONOMOUS_WITH_AUDIT") errors.push(`${label}: must default to AUTONOMOUS_WITH_AUDIT.`);
      if (decisionClass.recordDecision !== true) errors.push(`${label}: must record the decision.`);
      if (decisionClass.evidenceRequirements?.policyProvenanceRequired !== true) errors.push(`${label}: policy provenance is required.`);
    }

    if (decisionClass.id === "equivalent-variant") {
      if (decisionClass.defaultDisposition !== "AUTONOMOUS_WITH_AUDIT") errors.push(`${label}: must default to AUTONOMOUS_WITH_AUDIT.`);
      if (decisionClass.candidateRequirements?.equivalenceProofRequired !== true) errors.push(`${label}: equivalent variants require equivalence proof.`);
    }

    if (decisionClass.id === "design-authority-bounded") {
      const requiredSources = new Set(decisionClass.evidenceRequirements?.requiredSources || []);
      if (decisionClass.defaultDisposition !== "AUTONOMOUS_WITH_AUDIT") errors.push(`${label}: must default to AUTONOMOUS_WITH_AUDIT.`);
      if (decisionClass.recordDecision !== true) errors.push(`${label}: must record the decision.`);
      if (decisionClass.candidateRequirements?.minimumCandidates < 2) errors.push(`${label}: requires at least two objectively comparable candidates.`);
      if (decisionClass.evidenceRequirements?.policyProvenanceRequired !== true) errors.push(`${label}: policy provenance is required.`);
      for (const source of ["approved-product-context", "visual-research", "candidate-comparison"]) {
        if (!requiredSources.has(source)) errors.push(`${label}: requiredSources must include ${source}.`);
        if (!decisionClass.allowedSources?.includes(source)) errors.push(`${label}: allowedSources must include ${source}.`);
      }
    }

    if (HUMAN_CLASSES.has(decisionClass.id)) {
      if (decisionClass.decisionAuthority !== "human") errors.push(`${label}: consequential class authority must be human.`);
      if (decisionClass.defaultDisposition !== "HUMAN_REQUIRED") errors.push(`${label}: consequential class must default to HUMAN_REQUIRED.`);
      if (decisionClass.humanRequired !== true) errors.push(`${label}: consequential class requires humanRequired=true.`);
      if (decisionClass.recordDecision !== true) errors.push(`${label}: consequential decisions must be recorded.`);
      if (decisionClass.candidateRequirements?.minimumCandidates < 1) errors.push(`${label}: consequential decision requires at least one candidate before human choice.`);
      if (decisionClass.candidateRequirements?.explicitAuthorizationRequired !== true) errors.push(`${label}: consequential decision requires explicit authorization.`);
      if (decisionClass.evidenceRequirements?.required !== true) errors.push(`${label}: consequential decision requires evidence.`);
      if (decisionClass.evidenceRequirements?.policyProvenanceRequired !== true) errors.push(`${label}: consequential decision requires policy provenance.`);
      if (decisionClass.evidenceRequirements?.riskAssessmentRequired !== true) errors.push(`${label}: consequential decision requires risk assessment.`);
      if (!decisionClass.allowedSources?.includes("human-direction")) errors.push(`${label}: human-direction must be an allowed source.`);
    }

    if (decisionClass.id === "unknown-consequential") {
      if (decisionClass.decisionAuthority !== "human") errors.push(`${label}: unresolved consequential authority remains human.`);
      if (decisionClass.defaultDisposition !== "BLOCKED") errors.push(`${label}: must default to BLOCKED.`);
      if (decisionClass.humanRequired !== true) errors.push(`${label}: requires a human to resolve authority or classification.`);
      if (decisionClass.recordDecision !== true) errors.push(`${label}: blocked consequential decisions must be recorded.`);
      if (decisionClass.candidateRequirements?.explicitAuthorizationRequired !== true) errors.push(`${label}: explicit authorization is required before leaving BLOCKED.`);
      if (decisionClass.evidenceRequirements?.required !== true) errors.push(`${label}: missing classification still requires evidence to unblock.`);
      if (decisionClass.evidenceRequirements?.riskAssessmentRequired !== true) errors.push(`${label}: risk assessment is required before unblocking.`);
    }
  }

  for (const id of EXPECTED_CLASSES) {
    if (!seen.has(id)) errors.push(`Missing decision class '${id}'.`);
  }
}

function validateRuntimeConsumption(policy, root, errors) {
  const runtime = policy.runtimeConsumption || {};
  resolveRepositoryFile(root, runtime.controller, "runtimeConsumption.controller", errors);
  resolveRepositoryFile(root, runtime.decisionContract, "runtimeConsumption.decisionContract", errors);

  if (runtime.existingHumanGates !== policy.precedence?.existingHumanGates) {
    errors.push("runtimeConsumption.existingHumanGates must preserve the same precedence as policy.precedence.existingHumanGates.");
  }
  if (runtime.effectivePolicyEscalations !== policy.precedence?.effectivePolicyEscalations) {
    errors.push("runtimeConsumption.effectivePolicyEscalations must preserve the same precedence as policy.precedence.effectivePolicyEscalations.");
  }
  if (policy.precedence?.autonomousPreferenceQuestion !== "forbidden") {
    errors.push("Autonomous preference questions must remain forbidden.");
  }
  if (!Array.isArray(runtime.blockedHumanResolvableReasonCodes) || !runtime.blockedHumanResolvableReasonCodes.includes("UNKNOWN_CONSEQUENTIAL")) {
    errors.push("Runtime consumption must keep UNKNOWN_CONSEQUENTIAL explicitly human-resolvable.");
  }
}

function validateSemantics(policy, root) {
  const errors = [];
  resolveRepositoryFile(root, policy.governancePolicy, "governancePolicy", errors);
  resolveRepositoryFile(root, policy.workflowManifest, "workflowManifest", errors);
  const dispositions = validateDispositionContract(policy, errors);
  validateClassContract(policy, dispositions, errors);
  validateRuntimeConsumption(policy, root, errors);
  return errors;
}

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(String(args.root || DEFAULT_ROOT));
const policyPath = path.resolve(root, String(args.policy || DEFAULT_POLICY));

let policy;
try {
  policy = readJson(policyPath);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const schemaPath = args.schema
  ? path.resolve(root, String(args.schema))
  : path.resolve(path.dirname(policyPath), String(policy.$schema || ""));

if (!fs.existsSync(schemaPath)) {
  console.error(`Autonomy policy schema not found: ${schemaPath}`);
  process.exit(1);
}

const schemaErrors = validateJsonSchema(policy, readJson(schemaPath));
const semanticErrors = validateSemantics(policy, root);
const errors = [...schemaErrors.map((error) => `schema: ${error}`), ...semanticErrors];

if (errors.length) {
  console.error("Autonomy policy validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const dispositionCounts = (policy.decisionClasses || []).reduce((accumulator, decisionClass) => {
  accumulator[decisionClass.defaultDisposition] = (accumulator[decisionClass.defaultDisposition] || 0) + 1;
  return accumulator;
}, {});

console.log(`Autonomy policy valid: ${policy.decisionClasses.length} decision classes, ${policy.dispositions.length} dispositions.`);
console.log(`Defaults: ${Object.entries(dispositionCounts).map(([id, count]) => `${id}=${count}`).join(", ")}`);
console.log("Authority precedence preserved: effective-policy escalations and existing human gates always prevail.");
console.log(`Runtime consumption: controller=${policy.runtimeConsumption.controller}, contract=${policy.runtimeConsumption.decisionContract}.`);
