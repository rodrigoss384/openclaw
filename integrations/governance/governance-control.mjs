#!/usr/bin/env node
import crypto from "node:crypto";
import { materializeInvocation, loadExecutionContext, sourceSnapshot } from "./execution-context.mjs";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateJsonSchema } from "../../skills/spec-driven-engineering/scripts/lib/json-schema.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "../..");
const MANIFEST_REF = "prompts/spec-driven/manifest.json";
const POLICY_REF = "prompts/spec-driven/governance-policy.json";
const AUTONOMY_POLICY_REF = "prompts/spec-driven/autonomy-policy.json";
const AUTONOMY_DECISION_SCHEMA_REF = "integrations/governance/autonomy-decision.schema.json";
const EFFECTIVE_POLICY_SCHEMA_REF = "integrations/governance/effective-policy.schema.json";
const GOVERNANCE_VALIDATOR_REF = "integrations/governance/validate-governance-policy.mjs";
const CAPABILITY_VALIDATOR_REF = "integrations/governance/validate-enforcement-capabilities.mjs";
const AUTONOMY_VALIDATOR_REF = "integrations/governance/validate-autonomy-policy.mjs";
const APPLICABILITY_VALIDATOR_REF = "skills/spec-driven-engineering/scripts/validate-applicability-contract.mjs";
const STAGES = new Set([
  "discovery",
  "specification",
  "acceptance",
  "design-readiness",
  "implementation",
  "backend-representative",
  "frontend-representative",
  "adversarial",
  "evidence-release",
  "session-closure"
]);

function usage() {
  return [
    "Usage:",
    "  node integrations/governance/governance-control.mjs <resolve|bootstrap> --root <project-root> --stage <workflow-stage> --feature <feature-slug> --applicability <applicability.md> [--task <task-id>] [--output <effective-policy.json>]",
    "  node integrations/governance/governance-control.mjs decide --root <project-root> --request <autonomy-decision-request.json> [--output <autonomy-decision-result.json>]",
    "  node integrations/governance/governance-control.mjs consume --root <project-root> --decision <autonomy-decision-result.json> [--output <autonomy-consumption-directive.json>]",
    "  node integrations/governance/governance-control.mjs enforce --root <project-root> --stage <workflow-stage> --feature <feature-slug> [--applicability <applicability.md>] [--set <capabilityId>=<literal> ...] [--dry-run] [--output <enforcement-report.json>]"
  ].join("\n");
}

function parseArgs(argv) {
  const parsed = { _: [] };
  // A repeated flag accumulates into an array instead of overwriting. `enforce
  // --set` is repeatable by design (a capability can need several inputs:
  // frontend-product-semantics-evidence-control takes four), and plain
  // overwriting silently dropped every occurrence but the last -- the
  // substituted command then still carried an unresolved <placeholder> that
  // the caller believed they had supplied.
  const assign = (key, value) => {
    if (!Object.prototype.hasOwnProperty.call(parsed, key)) {
      parsed[key] = value;
      return;
    }
    if (Array.isArray(parsed[key])) parsed[key].push(value);
    else parsed[key] = [parsed[key], value];
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      parsed._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) assign(key, true);
    else {
      assign(key, next);
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

function sha256Text(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])])
    );
  }
  return value;
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

function runValidator(root, ref, args = []) {
  const entrypoint = path.resolve(root, ref);
  const result = spawnSync(process.execPath, [entrypoint, ...args], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`${ref} rejected resolver input${detail ? `:\n${detail}` : "."}`);
  }
}

function validateWithSchema(value, schemaPath, label) {
  const errors = validateJsonSchema(value, readJson(schemaPath));
  if (errors.length) {
    throw new Error(`${label} violates its schema:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  }
}

function parseApplicability(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const fields = new Map();
  for (const match of content.matchAll(/^([a-z][a-z-]*):\s*(.+)$/gm)) {
    fields.set(match[1], match[2].trim().replace(/^<|>$/g, ""));
  }
  return {
    frontend: fields.get("frontend"),
    backend: fields.get("backend"),
    behavioralUx: fields.get("behavioral-ux")
  };
}

function stageApplies(rule, stage) {
  return rule.stageScopes.includes("every-stage") || rule.stageScopes.includes(stage);
}

function applicabilityApplies(rule, applicability) {
  if (rule.applicability.mode === "always") return true;
  const selectors = ["frontend", "backend", "behavioralUx"];
  return selectors.every((selector) => {
    const accepted = rule.applicability[selector];
    return !accepted || accepted.includes(applicability[selector]);
  });
}

function classifyRules(rules) {
  const buckets = {
    hardRules: [],
    defaults: [],
    advisories: [],
    escalations: []
  };
  for (const rule of rules) {
    if (rule.kind === "hard-invariant") buckets.hardRules.push(rule.id);
    else if (rule.kind === "deterministic-default") buckets.defaults.push(rule.id);
    else if (rule.kind === "contextual-heuristic") buckets.advisories.push(rule.id);
    else if (rule.kind === "consequential-decision") buckets.escalations.push(rule.id);
  }
  for (const values of Object.values(buckets)) values.sort();
  return buckets;
}

function extractRecordedRulesRef(projectContent) {
  for (const line of projectContent.split(/\r?\n/)) {
    if (!/(?:workflow\.)?rulesFile/.test(line)) continue;
    const quoted = line.match(/(?:workflow\.)?rulesFile`?\s*[:=]\s*`([^`]+)`/);
    if (quoted?.[1]) return quoted[1].trim();
    const plain = line.match(/(?:workflow\.)?rulesFile`?\s*[:=]\s*([^\s#]+)/);
    if (plain?.[1]) return plain[1].trim().replace(/^['"]|['"]$/g, "");
  }
  return null;
}

function resolveRulesSource(root, manifest) {
  const sharedRules = (manifest.sharedRules || []).find((entry) => entry.id === "engineering-rules");
  if (!sharedRules) throw new Error("manifest sharedRules engineering-rules contract is missing.");
  if (sharedRules.pathResolution !== "required-every-prompt") {
    throw new Error("engineering-rules pathResolution must be required-every-prompt.");
  }
  if (sharedRules.contentLoading !== "governed-by-context-bootstrap") {
    throw new Error("engineering-rules contentLoading must be governed-by-context-bootstrap.");
  }

  const [projectRecordRef] = String(sharedRules.projectRecord || "").split("#");
  const projectRecordPath = projectRecordRef ? path.resolve(root, projectRecordRef) : null;
  if (projectRecordPath && fs.existsSync(projectRecordPath) && fs.statSync(projectRecordPath).isFile()) {
    const recordedRef = extractRecordedRulesRef(fs.readFileSync(projectRecordPath, "utf8"));
    if (recordedRef) {
      const recordedPath = withinRoot(root, path.isAbsolute(recordedRef) ? recordedRef : path.resolve(root, recordedRef), "recorded rules source");
      if (!fs.existsSync(recordedPath) || !fs.statSync(recordedPath).isFile()) {
        throw new Error(`Recorded rules source not found: ${recordedPath}`);
      }
      return {
        ref: repositoryRef(root, recordedPath),
        sha256: sha256(recordedPath)
      };
    }
  }

  const candidates = (sharedRules.candidates || []).map((candidate) => {
    const candidatePath = withinRoot(root, path.resolve(root, candidate), "rules candidate");
    return { ref: candidate, path: candidatePath };
  });
  const existing = candidates.filter((candidate) => fs.existsSync(candidate.path) && fs.statSync(candidate.path).isFile());
  if (existing.length === 0) {
    throw new Error(`No approved rules source found. Probed: ${candidates.map((candidate) => candidate.ref).join(", ")}`);
  }
  if (existing.length > 1) {
    const hashes = new Set(existing.map((candidate) => sha256(candidate.path)));
    if (hashes.size > 1) {
      throw new Error(`Conflicting fallback rules sources found: ${existing.map((candidate) => candidate.ref).join(", ")}. Record the canonical source in .specs/project/PROJECT.md before continuing.`);
    }
  }
  const selected = existing[0];
  return {
    ref: repositoryRef(root, selected.path),
    sha256: sha256(selected.path)
  };
}

function validateEffectivePolicy(output, effectiveSchemaPath) {
  validateWithSchema(output, effectiveSchemaPath, "Resolved effective policy");
}

function resolveEffectivePolicy({ root, stage, feature, task, applicabilityPath }) {
  if (!feature || typeof feature !== "string") throw new Error("--feature is required.");
  const context = loadExecutionContext(root, feature, { required: false });
  if (!STAGES.has(stage)) throw new Error(`Unknown workflow stage '${stage}'.`);
  if (!feature || typeof feature !== "string") throw new Error("--feature is required.");

  const policyPath = path.resolve(root, POLICY_REF);
  const effectiveSchemaPath = path.resolve(root, EFFECTIVE_POLICY_SCHEMA_REF);
  const resolvedApplicability = withinRoot(root, applicabilityPath, "applicability");
  if (context && resolvedApplicability !== path.join(root, ".specs", "features", feature, "applicability.md")) throw new Error("Applicability override differs from frozen feature contract");

  if (!fs.existsSync(resolvedApplicability) || !fs.statSync(resolvedApplicability).isFile()) {
    throw new Error(`applicability.md not found: ${resolvedApplicability}`);
  }

  runValidator(root, GOVERNANCE_VALIDATOR_REF, ["--root", root]);
  runValidator(root, CAPABILITY_VALIDATOR_REF, ["--root", root]);
  runValidator(root, APPLICABILITY_VALIDATOR_REF, [resolvedApplicability, "--root", root, ...(context ? ["--base-ref", context.baseCommit, "--context", context.ref] : [])]);

  const policy = readJson(policyPath);
  const capabilityRegistryPath = path.resolve(root, policy.capabilityRegistry);
  const applicability = parseApplicability(resolvedApplicability);
  const applicableRules = (policy.rules || []).filter(
    (rule) => stageApplies(rule, stage) && applicabilityApplies(rule, applicability)
  );
  const buckets = classifyRules(applicableRules);
  const requiredEnforcements = [...new Set(
    applicableRules
      .map((rule) => rule.enforcement?.capability)
      .filter(Boolean)
  )].sort();

  const output = {
    $schema: EFFECTIVE_POLICY_SCHEMA_REF,
    schemaVersion: "1.0.0",
    artifactKind: "derived-effective-policy",
    canonical: false,
    stage,
    feature,
    task: task || null,
    applicability,
    ...buckets,
    requiredEnforcements,
    sources: {
      governancePolicy: {
        ref: POLICY_REF,
        sha256: sha256(policyPath)
      },
      capabilityRegistry: {
        ref: policy.capabilityRegistry,
        sha256: sha256(capabilityRegistryPath)
      },
      applicability: {
        ref: repositoryRef(root, resolvedApplicability),
        sha256: sha256(resolvedApplicability)
      }
    }
  };

  validateEffectivePolicy(output, effectiveSchemaPath);
  return output;
}

function resolveBootstrapPolicy(options) {
  const { root } = options;
  const manifestPath = path.resolve(root, MANIFEST_REF);
  if (!fs.existsSync(manifestPath) || !fs.statSync(manifestPath).isFile()) {
    throw new Error(`Bootstrap manifest not found: ${manifestPath}`);
  }
  const manifest = readJson(manifestPath);
  const bootstrapPolicy = manifest.contextBootstrap?.governancePolicy;
  if (!bootstrapPolicy) throw new Error("contextBootstrap.governancePolicy is required for bootstrap.");
  if (!["shadow", "primary"].includes(bootstrapPolicy.mode)) {
    throw new Error(`Unknown governance bootstrap mode '${bootstrapPolicy.mode}'.`);
  }
  if (bootstrapPolicy.primaryScope !== "registered-rules-only") {
    throw new Error("governance bootstrap primaryScope must be registered-rules-only.");
  }
  const expectedRulesResolution = bootstrapPolicy.mode === "shadow"
    ? "preserved-full-read"
    : "policy-primary-registered-rules-rationale-fallback";
  if (bootstrapPolicy.rulesResolution !== expectedRulesResolution) {
    throw new Error(`${bootstrapPolicy.mode} bootstrap requires rulesResolution=${expectedRulesResolution}.`);
  }
  if (bootstrapPolicy.humanGates !== "unchanged") {
    throw new Error("Governance bootstrap must preserve existing human gates.");
  }

  const effectivePolicy = resolveEffectivePolicy(options);
  const rulesSource = resolveRulesSource(root, manifest);
  const governancePolicy = readJson(path.resolve(root, POLICY_REF));
  const admissionBoundary = governancePolicy.admissionBoundary;
  const latestAdmission = admissionBoundary?.admissions?.at(-1);
  if (!admissionBoundary || !latestAdmission) {
    throw new Error("governance rule admission boundary must be validated before bootstrap.");
  }

  const output = {
    ...effectivePolicy,
    bootstrap: {
      mode: bootstrapPolicy.mode,
      primaryScope: bootstrapPolicy.primaryScope,
      manifest: {
        ref: MANIFEST_REF,
        sha256: sha256(manifestPath)
      },
      rulesSource,
      rulesContentLoading: bootstrapPolicy.mode === "shadow" ? "full" : "rationale-and-admitted-legacy-only",
      rulesResolution: bootstrapPolicy.rulesResolution,
      rulesAdmission: {
        mode: admissionBoundary.mode,
        legacyBaselineOperational: admissionBoundary.legacyBaseline.operational,
        unregisteredAdditions: admissionBoundary.unregisteredAdditions,
        rationaleOnlyOperational: admissionBoundary.rationaleOnlyOperational,
        latestAdmissionKind: latestAdmission.kind,
        latestRulesFileGitBlobSha: latestAdmission.rulesFileGitBlobSha
      },
      humanGates: bootstrapPolicy.humanGates
    }
  };
  validateEffectivePolicy(output, path.resolve(root, EFFECTIVE_POLICY_SCHEMA_REF));
  return output;
}

function candidateRejectionCodes(candidate, classPolicy) {
  const codes = [];
  const requirements = classPolicy.candidateRequirements || {};
  if (requirements.mustSatisfyCanonicalContracts === true && candidate.canonicalContractMatch !== true) {
    codes.push("CANDIDATE_CONTRACT_MISMATCH");
  }
  if (requirements.reversibleRequired === true && candidate.reversible !== true) {
    codes.push("CANDIDATE_NOT_REVERSIBLE");
  }
  if (requirements.equivalenceProofRequired === true && (candidate.equivalenceEvidenceRefs || []).length === 0) {
    codes.push("CANDIDATE_EQUIVALENCE_UNPROVEN");
  }
  return codes;
}

const LOW_AUTONOMY_CLASSES = new Set([
  "reversible-internal",
  "reversible-contract-bounded",
  "equivalent-variant"
]);

function applicabilityIsMaterial(text) {
  const values = new Map();
  for (const match of text.matchAll(/^([a-z][a-z-]*):\s*(.+)$/gm)) values.set(match[1], match[2].trim());
  return values.get("auth") === "affected"
    || values.get("tenancy") === "affected"
    || values.get("persistence") === "affected"
    || values.get("migration") === "required"
    || values.get("material-operational-cost") === "applicable"
    || values.get("public-api") === "breaking"
    || values.get("public-api") === "new";
}

function compareCandidates(left, right, decisionClass) {
  const comparisons = [
    [Number(right.canonicalContractMatch), Number(left.canonicalContractMatch)],
    [Number(right.precedentMatch), Number(left.precedentMatch)]
  ];
  if (!LOW_AUTONOMY_CLASSES.has(decisionClass)) {
    comparisons.push(
      [left.changeSize, right.changeSize],
      [left.complexity, right.complexity],
      [left.riskSurface, right.riskSurface],
      [right.objectiveScore, left.objectiveScore]
    );
  }
  comparisons.push([Number(right.reversible), Number(left.reversible)]);
  for (const [a, b] of comparisons) {
    if (a < b) return -1;
    if (a > b) return 1;
  }
  return left.id.localeCompare(right.id);
}

function collectEvidenceRefs(request) {
  const refs = new Set((request.evidence || []).map((item) => item.ref));
  for (const candidate of request.candidates || []) {
    for (const field of ["contractRefs", "precedentRefs", "evidenceRefs", "equivalenceEvidenceRefs"]) {
      for (const ref of candidate[field] || []) refs.add(ref);
    }
  }
  return [...refs].sort();
}

function rulesAppliedByPolicy(effectivePolicy) {
  return [...new Set([
    ...(effectivePolicy.hardRules || []),
    ...(effectivePolicy.defaults || []),
    ...(effectivePolicy.escalations || [])
  ])].sort();
}

function resolveAutonomyDecision({ root, requestPath }) {
  runValidator(root, AUTONOMY_VALIDATOR_REF, ["--root", root]);

  const autonomyPolicyPath = resolveRepositoryFile(root, AUTONOMY_POLICY_REF, "autonomy policy");
  const decisionSchemaPath = resolveRepositoryFile(root, AUTONOMY_DECISION_SCHEMA_REF, "autonomy decision schema");
  const effectiveSchemaPath = resolveRepositoryFile(root, EFFECTIVE_POLICY_SCHEMA_REF, "effective policy schema");
  const request = readJson(requestPath);
  validateWithSchema(request, decisionSchemaPath, "Autonomy decision request");
  if (request.artifactKind !== "autonomy-decision-request") {
    throw new Error("--request must contain artifactKind=autonomy-decision-request.");
  }

  const effectivePolicyPath = resolveRepositoryFile(root, request.effectivePolicyRef, "effectivePolicyRef");
  const effectivePolicy = readJson(effectivePolicyPath);
  validateWithSchema(effectivePolicy, effectiveSchemaPath, "Effective policy input");
  if (effectivePolicy.artifactKind !== "derived-effective-policy") {
    throw new Error("effectivePolicyRef must target a derived-effective-policy artifact.");
  }
  if (effectivePolicy.stage !== request.stage) {
    throw new Error(`Decision request stage '${request.stage}' does not match effective policy stage '${effectivePolicy.stage}'.`);
  }
  if (effectivePolicy.feature !== request.feature) {
    throw new Error(`Decision request feature '${request.feature}' does not match effective policy feature '${effectivePolicy.feature}'.`);
  }
  if ((effectivePolicy.task || null) !== (request.task || null)) {
    throw new Error("Decision request task does not match effective policy task.");
  }

  const autonomyPolicy = readJson(autonomyPolicyPath);
  const classPolicy = (autonomyPolicy.decisionClasses || []).find((item) => item.id === request.decisionClass);
  if (!classPolicy) throw new Error(`Unknown autonomy decision class '${request.decisionClass}'.`);

  const reasonCodes = new Set();
  const rejectedById = new Map();
  const validCandidates = [];
  for (const candidate of request.candidates || []) {
    const codes = candidateRejectionCodes(candidate, classPolicy);
    if (codes.length) rejectedById.set(candidate.id, codes);
    else validCandidates.push(candidate);
  }

  const disallowedEvidence = (request.evidence || []).filter(
    (item) => !(classPolicy.allowedSources || []).includes(item.source)
  );
  if (disallowedEvidence.length) reasonCodes.add("DISALLOWED_EVIDENCE_SOURCE");

  const uniqueEvidenceRefs = new Set((request.evidence || []).map((item) => item.ref));
  const suppliedEvidenceSources = new Set((request.evidence || []).map((item) => item.source));
  const evidenceRequirements = classPolicy.evidenceRequirements || {};
  if (evidenceRequirements.required === true && uniqueEvidenceRefs.size < evidenceRequirements.minimumRefs) {
    reasonCodes.add("MISSING_REQUIRED_EVIDENCE");
  }
  if ((evidenceRequirements.requiredSources || []).some((source) => !suppliedEvidenceSources.has(source))) {
    reasonCodes.add("MISSING_REQUIRED_EVIDENCE");
  }
  if (evidenceRequirements.riskAssessmentRequired === true && !(request.evidence || []).some((item) => item.source === "risk-assessment")) {
    reasonCodes.add("MISSING_RISK_ASSESSMENT");
  }

  const minimumCandidates = classPolicy.candidateRequirements?.minimumCandidates || 0;
  if (validCandidates.length < minimumCandidates) {
    reasonCodes.add(validCandidates.length === 0 ? "NO_VALID_CANDIDATE" : "INSUFFICIENT_VALID_CANDIDATES");
  }

  if (LOW_AUTONOMY_CLASSES.has(request.decisionClass) && /^[a-z0-9][a-z0-9-]*$/.test(request.feature)) {
    const applicabilityPath = path.resolve(root, ".specs/features", request.feature, "applicability.md");
    if (applicabilityPath.startsWith(`${path.resolve(root)}${path.sep}`) && fs.existsSync(applicabilityPath) && fs.statSync(applicabilityPath).isFile() && applicabilityIsMaterial(fs.readFileSync(applicabilityPath, "utf8"))) {
      reasonCodes.add("CLASS_CONTRADICTS_APPLICABILITY");
    }
  }
  if (request.decisionClass === "unknown-consequential") reasonCodes.add("UNKNOWN_CONSEQUENTIAL");
  if (request.humanGateRequired === true) reasonCodes.add("EXISTING_HUMAN_GATE");
  if ((effectivePolicy.escalations || []).length > 0) reasonCodes.add("EFFECTIVE_POLICY_ESCALATION");

  const blockingCodes = new Set([
    "DISALLOWED_EVIDENCE_SOURCE",
    "MISSING_REQUIRED_EVIDENCE",
    "MISSING_RISK_ASSESSMENT",
    "NO_VALID_CANDIDATE",
    "INSUFFICIENT_VALID_CANDIDATES",
    "UNKNOWN_CONSEQUENTIAL",
    "CLASS_CONTRADICTS_APPLICABILITY"
  ]);
  const blocked = [...reasonCodes].some((code) => blockingCodes.has(code));

  let disposition;
  let selectedCandidate = null;
  if (blocked) {
    disposition = "BLOCKED";
    reasonCodes.add("DECISION_BLOCKED");
  } else if (request.humanGateRequired === true || (effectivePolicy.escalations || []).length > 0) {
    disposition = "HUMAN_REQUIRED";
    reasonCodes.add("GOVERNANCE_PRECEDENCE_REQUIRES_HUMAN");
  } else if (classPolicy.defaultDisposition === "HUMAN_REQUIRED") {
    disposition = "HUMAN_REQUIRED";
    reasonCodes.add("CLASS_REQUIRES_HUMAN");
    if (classPolicy.candidateRequirements?.explicitAuthorizationRequired === true) {
      reasonCodes.add("EXPLICIT_AUTHORIZATION_REQUIRED");
    }
  } else if (classPolicy.defaultDisposition === "BLOCKED") {
    disposition = "BLOCKED";
    reasonCodes.add("CLASS_DEFAULT_BLOCKED");
  } else {
    const ranked = [...validCandidates].sort((left, right) => compareCandidates(left, right, request.decisionClass));
    selectedCandidate = ranked[0] || null;
    if (!selectedCandidate) {
      disposition = "BLOCKED";
      reasonCodes.add("NO_VALID_CANDIDATE");
      reasonCodes.add("DECISION_BLOCKED");
    } else {
      disposition = classPolicy.defaultDisposition;
      reasonCodes.add("AUTONOMOUS_CLASS_DEFAULT");
      reasonCodes.add("CANDIDATE_SELECTED");
    }
  }

  for (const candidate of validCandidates) {
    if (selectedCandidate?.id === candidate.id) continue;
    if (rejectedById.has(candidate.id)) continue;
    if (disposition === "HUMAN_REQUIRED") rejectedById.set(candidate.id, ["HUMAN_SELECTION_REQUIRED"]);
    else if (disposition === "BLOCKED") rejectedById.set(candidate.id, ["DECISION_BLOCKED"]);
    else rejectedById.set(candidate.id, ["TIE_BREAK_LOWER_RANK"]);
  }

  const autonomyPolicyHash = sha256(autonomyPolicyPath);
  const effectivePolicyHash = sha256(effectivePolicyPath);
  const decisionSeed = JSON.stringify(canonicalize({
    request,
    autonomyPolicySha256: autonomyPolicyHash,
    effectivePolicySha256: effectivePolicyHash
  }));

  const result = {
    $schema: AUTONOMY_DECISION_SCHEMA_REF,
    schemaVersion: "1.0.0",
    artifactKind: "autonomy-decision-result",
    decisionId: `DEC-${sha256Text(decisionSeed).slice(0, 16).toUpperCase()}`,
    decisionClass: request.decisionClass,
    stage: request.stage,
    feature: request.feature,
    task: request.task || null,
    disposition,
    selectedOption: selectedCandidate?.id || null,
    rejectedOptions: [...rejectedById.entries()]
      .map(([id, codes]) => ({ id, reasonCodes: [...new Set(codes)].sort() }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    reasonCodes: [...reasonCodes].sort(),
    rulesApplied: rulesAppliedByPolicy(effectivePolicy),
    evidenceRefs: collectEvidenceRefs(request),
    reversible: selectedCandidate ? selectedCandidate.reversible : null,
    policyProvenance: {
      autonomyPolicy: {
        ref: AUTONOMY_POLICY_REF,
        sha256: autonomyPolicyHash
      },
      effectivePolicy: {
        ref: repositoryRef(root, effectivePolicyPath),
        sha256: effectivePolicyHash
      }
    }
  };

  if (["HUMAN_REQUIRED", "BLOCKED"].includes(result.disposition) && result.selectedOption !== null) {
    throw new Error(`${result.disposition} result must not select an option.`);
  }
  if (["SAFE_AUTONOMOUS", "AUTONOMOUS_WITH_AUDIT"].includes(result.disposition) && result.selectedOption === null) {
    throw new Error(`${result.disposition} result requires a selected option.`);
  }

  validateWithSchema(result, decisionSchemaPath, "Autonomy decision result");
  return result;
}

function consumeAutonomyDecision({ root, decisionPath }) {
  runValidator(root, AUTONOMY_VALIDATOR_REF, ["--root", root]);

  const autonomyPolicyPath = resolveRepositoryFile(root, AUTONOMY_POLICY_REF, "autonomy policy");
  const decisionSchemaPath = resolveRepositoryFile(root, AUTONOMY_DECISION_SCHEMA_REF, "autonomy decision schema");
  const effectiveSchemaPath = resolveRepositoryFile(root, EFFECTIVE_POLICY_SCHEMA_REF, "effective policy schema");
  const decision = readJson(decisionPath);
  validateWithSchema(decision, decisionSchemaPath, "Autonomy decision result");
  if (decision.artifactKind !== "autonomy-decision-result") {
    throw new Error("--decision must contain artifactKind=autonomy-decision-result.");
  }

  const autonomyPolicy = readJson(autonomyPolicyPath);
  const runtimePolicy = autonomyPolicy.runtimeConsumption;
  if (!runtimePolicy) throw new Error("Autonomy runtimeConsumption policy is required.");

  const classPolicy = (autonomyPolicy.decisionClasses || []).find((item) => item.id === decision.decisionClass);
  if (!classPolicy) throw new Error(`Unknown autonomy decision class '${decision.decisionClass}'.`);
  const dispositionPolicy = (autonomyPolicy.dispositions || []).find((item) => item.id === decision.disposition);
  if (!dispositionPolicy) throw new Error(`Unknown autonomy disposition '${decision.disposition}'.`);

  const autonomyProvenance = decision.policyProvenance?.autonomyPolicy;
  if (autonomyProvenance?.ref !== AUTONOMY_POLICY_REF) {
    throw new Error(`Decision autonomy policy provenance must reference '${AUTONOMY_POLICY_REF}'.`);
  }
  const currentAutonomyHash = sha256(autonomyPolicyPath);
  if (autonomyProvenance.sha256 !== currentAutonomyHash) {
    throw new Error("Decision autonomy policy provenance is stale or does not match the current autonomy policy.");
  }

  const effectiveProvenance = decision.policyProvenance?.effectivePolicy;
  const effectivePolicyPath = resolveRepositoryFile(root, effectiveProvenance?.ref, "decision effective policy provenance");
  const currentEffectiveHash = sha256(effectivePolicyPath);
  if (effectiveProvenance.sha256 !== currentEffectiveHash) {
    throw new Error("Decision effective policy provenance is stale or does not match the referenced effective policy.");
  }
  const effectivePolicy = readJson(effectivePolicyPath);
  validateWithSchema(effectivePolicy, effectiveSchemaPath, "Decision effective policy");
  if (effectivePolicy.artifactKind !== "derived-effective-policy") {
    throw new Error("Decision effective policy provenance must target a derived-effective-policy artifact.");
  }
  if (effectivePolicy.stage !== decision.stage || effectivePolicy.feature !== decision.feature || (effectivePolicy.task || null) !== (decision.task || null)) {
    throw new Error("Decision context does not match its effective-policy provenance.");
  }

  const autonomousDisposition = ["SAFE_AUTONOMOUS", "AUTONOMOUS_WITH_AUDIT"].includes(decision.disposition);
  if (autonomousDisposition) {
    if (classPolicy.decisionAuthority !== "agent" || classPolicy.humanRequired !== false) {
      throw new Error(`${decision.decisionClass}: autonomous consumption requires agent authority without a default human requirement.`);
    }
    if (classPolicy.defaultDisposition !== decision.disposition) {
      throw new Error(`${decision.decisionClass}: autonomous result disposition does not match the canonical class default.`);
    }
    if (dispositionPolicy.executionAllowed !== true || dispositionPolicy.humanRequired !== false) {
      throw new Error(`${decision.disposition}: autonomous consumption contract cannot disable execution or require a human.`);
    }
    if (decision.selectedOption === null) {
      throw new Error(`${decision.disposition}: autonomous consumption requires a selected option.`);
    }
    if ((effectivePolicy.escalations || []).length > 0) {
      throw new Error("Autonomous consumption cannot override effective-policy escalations.");
    }
    if ((decision.reasonCodes || []).includes("EXISTING_HUMAN_GATE") || (decision.reasonCodes || []).includes("EFFECTIVE_POLICY_ESCALATION")) {
      throw new Error("Autonomous consumption cannot override an existing human gate or effective-policy escalation recorded by the resolver.");
    }
  }

  if (["HUMAN_REQUIRED", "BLOCKED"].includes(decision.disposition) && decision.selectedOption !== null) {
    throw new Error(`${decision.disposition} consumption must not receive a selected option.`);
  }
  if (decision.disposition === "HUMAN_REQUIRED") {
    const humanAuthorityReasons = new Set([
      "CLASS_REQUIRES_HUMAN",
      "EXPLICIT_AUTHORIZATION_REQUIRED",
      "EXISTING_HUMAN_GATE",
      "EFFECTIVE_POLICY_ESCALATION",
      "GOVERNANCE_PRECEDENCE_REQUIRES_HUMAN"
    ]);
    if (!(decision.reasonCodes || []).some((code) => humanAuthorityReasons.has(code))) {
      throw new Error("HUMAN_REQUIRED consumption requires an explicit human-authority or governance-precedence reason.");
    }
  }
  if (decision.disposition === "BLOCKED") {
    const knownBlockerReasons = new Set([
      "DECISION_BLOCKED",
      "CLASS_DEFAULT_BLOCKED",
      "UNKNOWN_CONSEQUENTIAL",
      "DISALLOWED_EVIDENCE_SOURCE",
      "MISSING_REQUIRED_EVIDENCE",
      "MISSING_RISK_ASSESSMENT",
      "NO_VALID_CANDIDATE",
      "INSUFFICIENT_VALID_CANDIDATES"
    ]);
    if (!(decision.reasonCodes || []).some((code) => knownBlockerReasons.has(code))) {
      throw new Error("BLOCKED consumption requires an explicit blocker reason.");
    }
  }

  const humanResolvableCodes = new Set(runtimePolicy.blockedHumanResolvableReasonCodes || []);
  const humanReasonCodes = decision.disposition === "HUMAN_REQUIRED"
    ? [...new Set(decision.reasonCodes || [])].sort()
    : decision.disposition === "BLOCKED"
      ? [...new Set((decision.reasonCodes || []).filter((code) => humanResolvableCodes.has(code)))].sort()
      : [];
  const blockerReasonCodes = decision.disposition === "BLOCKED"
    ? [...new Set(decision.reasonCodes || [])].sort()
    : [];
  const humanResolvableBlocker = decision.disposition === "BLOCKED" && humanReasonCodes.length > 0;

  let action;
  if (decision.disposition === "SAFE_AUTONOMOUS") action = "execute";
  else if (decision.disposition === "AUTONOMOUS_WITH_AUDIT") action = "record-and-execute";
  else if (decision.disposition === "HUMAN_REQUIRED") action = "request-human-decision";
  else action = humanResolvableBlocker ? "report-blocker-and-request-human" : "report-blocker";

  const askHuman = decision.disposition === "HUMAN_REQUIRED" || humanResolvableBlocker;
  const executionAllowed = dispositionPolicy.executionAllowed === true;
  const recordDecision = dispositionPolicy.decisionRecordRequired === true || classPolicy.recordDecision === true;

  if (autonomousDisposition && askHuman) {
    throw new Error("Autonomous consumption cannot ask the human for a preference.");
  }
  if (decision.disposition === "BLOCKED" && askHuman && !humanResolvableBlocker) {
    throw new Error("BLOCKED consumption may ask a human only for an explicitly human-resolvable blocker.");
  }

  const directive = {
    $schema: AUTONOMY_DECISION_SCHEMA_REF,
    schemaVersion: "1.0.0",
    artifactKind: "autonomy-consumption-directive",
    decisionId: decision.decisionId,
    disposition: decision.disposition,
    action,
    askHuman,
    executionAllowed,
    recordDecision,
    selectedOption: decision.selectedOption,
    humanResolvableBlocker,
    humanReasonCodes,
    blockerReasonCodes,
    decisionProvenance: {
      ref: repositoryRef(root, decisionPath),
      sha256: sha256(decisionPath)
    }
  };

  validateWithSchema(directive, decisionSchemaPath, "Autonomy consumption directive");
  if (recordDecision) {
    const directory = withinRoot(root, path.join(root, ".specs", "features", decision.feature), "feature");
    if (!fs.existsSync(directory)) throw new Error("Feature must exist before consuming an audited decision");
    const lock = path.join(directory, ".autonomy-consume.lock");
    fs.mkdirSync(lock); // exclusive ownership; a crashed writer blocks reconciliation instead of losing history
    try {
      const directiveRef = `.specs/features/${decision.feature}/autonomy-directives/${decision.decisionId}.json`;
      const retained = path.join(root, directiveRef);
      fs.mkdirSync(path.dirname(retained), { recursive: true });
      const bytes = `${JSON.stringify(directive, null, 2)}\n`;
      if (fs.existsSync(retained)) {
        if (fs.readFileSync(retained, "utf8") !== bytes) throw new Error("Audited directive identity drift");
      } else fs.writeFileSync(retained, bytes, { flag: "wx" });
      const expectedPath = path.join(directory, "autonomy-required.json");
      const expected = fs.existsSync(expectedPath) ? readJson(expectedPath) : { feature: decision.feature, directives: [] };
      if (!expected.directives.includes(directiveRef)) expected.directives.push(directiveRef);
      const temporary = `${expectedPath}.${process.pid}.tmp`;
      fs.writeFileSync(temporary, `${JSON.stringify(expected, null, 2)}\n`);
      fs.renameSync(temporary, expectedPath);
      runValidator(root, "integrations/governance/autonomy-evidence.mjs", ["record", "--root", root, "--directive", directiveRef]);
    } finally { fs.rmdirSync(lock); }
  }
  return directive;
}

// Materializes the registered invocation for every capability the stage
// requires, runs them, and fails with the list that is missing or failing.
//
// resolveEffectivePolicy already derives requiredEnforcements, but it only
// emits capability IDs. The concrete command lives in
// enforcement-capabilities.json#invocation.command and, until now, nothing
// consumed that field: the agent had to remember ~20 invocations and their
// flags per stage. That is exactly the step a degraded context skips.
function enforceStage({ root, stage, feature, task, applicabilityPath, substitutions, dryRun }) {
  const context = loadExecutionContext(root, feature, { required: !dryRun });
  const policy = resolveEffectivePolicy({ root, stage, feature, task, applicabilityPath });
  const snapshot = dryRun ? null : sourceSnapshot(root);
  const capabilityRegistryPath = path.resolve(root, readJson(path.resolve(root, POLICY_REF)).capabilityRegistry);
  const registry = readJson(capabilityRegistryPath);
  const byId = new Map((registry.capabilities || []).map((capability) => [capability.id, capability]));

  const executions = [];
  let unresolvedPlaceholders = 0;
  let failed = 0;

  // Human release verification consumes the gate produced in this same run.
  const orderedEnforcements = [...policy.requiredEnforcements].sort((a, b) => Number(a === "frontend-human-decision-verification") - Number(b === "frontend-human-decision-verification"));
  for (const capabilityId of orderedEnforcements) {
    const capability = byId.get(capabilityId);

    if (!capability) {
      executions.push({
        capabilityId,
        status: "unregistered",
        command: null,
        blocking: true,
        detail: `Capability '${capabilityId}' is required by the effective policy but absent from ${registry.$schema ? "the capability registry" : capabilityRegistryPath}.`
      });
      failed += 1;
      continue;
    }

    const blocking = capability.failureSemantics?.blocking === true;

    if (capability.invocation?.mode !== "cli") {
      // Schema-mode capabilities are enforced by whoever validates that schema.
      executions.push({
        capabilityId,
        status: "not-executable",
        command: null,
        blocking,
        detail: `Capability mode '${capability.invocation?.mode ?? "unknown"}' is not a CLI invocation; it is enforced by its owning validator.`
      });
      continue;
    }

    if (capabilityId === "frontend-human-decision-verification" && !dryRun && !executions.some(row => row.capabilityId === "frontend-ui-evidence-integrity" && row.status === "passed")) {
      executions.push({ capabilityId, status: "failed", command: null, blocking: true, exitCode: 1, detail: "Fresh UI gate must pass in this enforcement run before release authorization" });
      failed += 1;
      continue;
    }
    const provided = substitutions.get(capabilityId) || {};
    for (const key of ["project-root", "feature-directory", "feature-slug", "baseline-git-ref"]) {
      if (Object.hasOwn(provided, key)) throw new Error(`Reserved argument cannot be overridden: ${key}`);
    }
    let parts;
    let command = capability.invocation.command;
    try {
      parts = materializeInvocation(capability, {
        ...provided,
        "project-root": root,
        "feature-slug": feature,
        "feature-directory": path.join(".specs", "features", feature),
        ...(context ? { "baseline-git-ref": context.baseCommit } : {})
      });
      command = parts.map(part => /\s/.test(part) ? JSON.stringify(part) : part).join(" ");
    } catch (error) {
      if (!error.placeholders) throw error;
      executions.push({ capabilityId, status: "unresolved-input", command, blocking,
        detail: `Provide the missing input(s): ${error.placeholders.map(name => `--set ${capabilityId}=${name}=<value>`).join(" ")}` });
      unresolvedPlaceholders += 1;
      if (blocking) failed += 1;
      continue;
    }

    if (dryRun) {
      executions.push({ capabilityId, status: "planned", command, blocking, detail: null });
      continue;
    }

    const result = spawnSync(parts[0] === "node" ? process.execPath : parts[0], parts.slice(1), {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });

    const exitCode = result.status ?? 1;
    const passed = exitCode === 0;
    const notRun = exitCode === 3;
    if (!passed && blocking) failed += 1;

    executions.push({
      capabilityId,
      status: passed ? "passed" : notRun ? "not-run" : "failed",
      command,
      blocking,
      exitCode,
      detail: passed
        ? null
        : [result.stdout, result.stderr].filter(Boolean).join("\n").trim().slice(0, 4000) || null
    });
  }

  for (const entry of executions.filter(row => row.status === "not-executable")) {
    if (entry.capabilityId === "backend-change-manifest-contract") entry.coveredBy = "backend-technology-selection-validation";
    if (!dryRun && !executions.some(row => row.capabilityId === entry.coveredBy && row.status === "passed")) failed += 1;
  }
  if (!dryRun && sourceSnapshot(root) !== snapshot) throw new Error("Source changed during enforcement");
  return {
    $schema: null,
    schemaVersion: "1.0.0",
    artifactKind: "stage-enforcement-report",
    canonical: false,
    stage,
    feature,
    task: task || null,
    dryRun: Boolean(dryRun),
    snapshot,
    requiredEnforcements: policy.requiredEnforcements,
    executions,
    summary: {
      required: policy.requiredEnforcements.length,
      passed: executions.filter((item) => item.status === "passed").length,
      failed: executions.filter((item) => item.status === "failed").length,
      notRun: executions.filter((item) => item.status === "not-run").length,
      planned: executions.filter((item) => item.status === "planned").length,
      unresolvedInputs: unresolvedPlaceholders,
      notExecutable: executions.filter((item) => item.status === "not-executable").length,
      blockingFailures: failed
    },
    sources: policy.sources
  };
}

const args = parseArgs(process.argv.slice(2));
const command = args._[0];
if (!new Set(["resolve", "bootstrap", "decide", "consume", "enforce"]).has(command)) {
  console.error(command ? `Unknown command '${command}'.\n${usage()}` : usage());
  process.exit(1);
}

try {
  const root = path.resolve(String(args.root || DEFAULT_ROOT));
  let output;

  if (command === "decide") {
    if (typeof args.request !== "string") throw new Error("decide requires --request <autonomy-decision-request.json>.\n" + usage());
    const requestPath = resolveRepositoryFile(root, String(args.request), "decision request");
    output = resolveAutonomyDecision({ root, requestPath });
  } else if (command === "consume") {
    if (typeof args.decision !== "string") throw new Error("consume requires --decision <autonomy-decision-result.json>.\n" + usage());
    const decisionPath = resolveRepositoryFile(root, String(args.decision), "decision result");
    output = consumeAutonomyDecision({ root, decisionPath });
  } else {
    const feature = typeof args.feature === "string" ? args.feature : "";
    const stage = typeof args.stage === "string" ? args.stage : "";
    const applicabilityArg = typeof args.applicability === "string"
      ? args.applicability
      : feature
        ? `.specs/features/${feature}/applicability.md`
        : "";
    if (!applicabilityArg) throw new Error("--applicability or --feature is required.\n" + usage());

    const applicabilityPath = path.isAbsolute(applicabilityArg)
      ? applicabilityArg
      : path.resolve(root, applicabilityArg);
    const options = {
      root,
      stage,
      feature,
      task: typeof args.task === "string" ? args.task : null,
      applicabilityPath
    };
    if (command === "enforce") {
      // --set <capabilityId>=<placeholder>=<value>, repeatable.
      const substitutions = new Map();
      const rawSets = Array.isArray(args.set) ? args.set : args.set ? [args.set] : [];

      for (const entry of rawSets) {
        const text = String(entry);
        const firstSeparator = text.indexOf("=");
        if (firstSeparator < 1) {
          throw new Error(`--set expects <capabilityId>=<placeholder>=<value>, received '${text}'.\n` + usage());
        }
        const capabilityId = text.slice(0, firstSeparator);
        const rest = text.slice(firstSeparator + 1);
        const secondSeparator = rest.indexOf("=");
        if (secondSeparator < 1) {
          throw new Error(`--set expects <capabilityId>=<placeholder>=<value>, received '${text}'.\n` + usage());
        }
        const placeholder = rest.slice(0, secondSeparator);
        const value = rest.slice(secondSeparator + 1);
        const existing = substitutions.get(capabilityId) || {};
        if (Object.hasOwn(existing, placeholder)) throw new Error(`Repeated substitution: ${capabilityId}=${placeholder}`);
        existing[placeholder] = value;
        substitutions.set(capabilityId, existing);
      }

      output = enforceStage({
        ...options,
        substitutions,
        dryRun: args["dry-run"] === true
      });
    } else {
      output = command === "bootstrap"
        ? resolveBootstrapPolicy(options)
        : resolveEffectivePolicy(options);
    }
  }

  const serialized = `${JSON.stringify(output, null, 2)}\n`;
  if (typeof args.output === "string") {
    const outputPath = path.isAbsolute(args.output) ? args.output : path.resolve(root, args.output);
    withinRoot(root, outputPath, "output");
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, serialized);
    const label = command === "decide"
      ? "Autonomy decision result"
      : command === "consume"
        ? "Autonomy consumption directive"
        : command === "enforce"
          ? "Stage enforcement report"
          : "Effective governance policy";
    console.log(`${label} written: ${outputPath}`);
  } else {
    process.stdout.write(serialized);
  }

  if (command === "enforce") {
    const summary = output.summary;
    console.error(
      `stage=${output.stage} required=${summary.required} passed=${summary.passed} ` +
      `failed=${summary.failed} not-run=${summary.notRun} unresolved-inputs=${summary.unresolvedInputs} ` +
      `not-executable=${summary.notExecutable}`
    );
    for (const execution of output.executions) {
      if (execution.status === "passed" || execution.status === "planned") continue;
      console.error(`[${execution.status}] ${execution.capabilityId}${execution.detail ? `: ${execution.detail}` : ""}`);
    }
    // Fail closed: a required blocking enforcement that did not run and pass
    // is indistinguishable from one that failed.
    if (summary.blockingFailures > 0) process.exit(2);
  }
} catch (error) {
  const label = command === "decide"
    ? "Governance autonomy decision failed"
    : command === "consume"
      ? "Governance autonomy consumption failed"
      : command === "enforce"
        ? "Governance stage enforcement failed"
        : "Governance effective-policy resolution failed";
  console.error(`${label}: ${error.message}`);
  process.exit(1);
}
