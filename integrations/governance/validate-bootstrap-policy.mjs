#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "../..");
const RESOLVER = "integrations/governance/governance-control.mjs resolve";
const BOOTSTRAP = "integrations/governance/governance-control.mjs bootstrap";
const APPLICABILITY_SOURCE = ".specs/features/{{FEATURE_SLUG}}/applicability.md";
const GOVERNANCE_POLICY = "prompts/spec-driven/governance-policy.json";

// The rollout/context-load semantics were duplicated verbatim in nine prompts.
// They now live once here, and each bound prompt must reference this path.
const SHARED_BOOTSTRAP = "prompts/spec-driven/CONTEXT-BOOTSTRAP.md";
const SHARED_BOOTSTRAP_REF = "CONTEXT-BOOTSTRAP.md";
const SHARED_BOOTSTRAP_FRAGMENTS = [
  "policy-rollout",
  "context-load",
  "bootstrap.rulesAdmission",
  "shadow",
  "primary",
  "registered-rules-only",
  "unregisteredAdditions=non-operative",
  "rationaleOnlyOperational=false",
  "human gates",
  "workflow-entry.mjs",
  "`advance`",
  "`delivery`",
  "stage-state.json"
];
const CANONICAL_BOOTSTRAP_SOURCES = {
  skill: "skills/spec-driven-engineering/SKILL.md",
  reference: "skills/spec-driven-engineering/references/context-bootstrap.md",
  rules: "rules.md"
};
const EXPECTED_BINDINGS = [
  { promptId: "acceptance", stage: "acceptance" },
  { promptId: "behavior-tests", stage: "acceptance" },
  { promptId: "design-readiness", stage: "design-readiness" },
  { promptId: "test-plan-tasks", stage: "design-readiness" },
  { promptId: "execute", stage: "implementation" },
  { promptId: "frontend-representative-gate", stage: "frontend-representative" },
  { promptId: "backend-representative-gate", stage: "backend-representative" },
  { promptId: "adversarial", stage: "adversarial" },
  { promptId: "validate-evidence", stage: "evidence-release" }
];

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

function sameBindings(actual) {
  return JSON.stringify(actual || []) === JSON.stringify(EXPECTED_BINDINGS);
}

function requireFragments(errors, root, relativePath, required = [], forbidden = []) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    errors.push(`Canonical bootstrap source not found: ${relativePath}`);
    return;
  }
  const content = fs.readFileSync(filePath, "utf8");
  for (const fragment of required) {
    if (!content.includes(fragment)) errors.push(`${relativePath} is missing canonical bootstrap fragment: ${fragment}`);
  }
  for (const fragment of forbidden) {
    if (content.includes(fragment)) errors.push(`${relativePath} retains obsolete full-rules bootstrap semantics: ${fragment}`);
  }
}

function validate(root) {
  const errors = [];
  const manifestPath = path.join(root, "prompts/spec-driven/manifest.json");
  if (!fs.existsSync(manifestPath)) return [`Manifest not found: ${manifestPath}`];

  let manifest;
  try {
    manifest = readJson(manifestPath);
  } catch (error) {
    return [error.message];
  }

  const sharedRules = (manifest.sharedRules || []).find((entry) => entry.id === "engineering-rules");
  if (!sharedRules) {
    errors.push("sharedRules must declare the engineering-rules source.");
  } else {
    if (sharedRules.pathResolution !== "required-every-prompt") {
      errors.push("engineering-rules.pathResolution must be required-every-prompt.");
    }
    if (sharedRules.contentLoading !== "governed-by-context-bootstrap") {
      errors.push("engineering-rules.contentLoading must be governed-by-context-bootstrap.");
    }
    if (Object.prototype.hasOwnProperty.call(sharedRules, "load")) {
      errors.push("engineering-rules.load is obsolete; path resolution and content loading must be separate contracts.");
    }
    if (sharedRules.missing !== "blocked" || sharedRules.conflict !== "blocked") {
      errors.push("engineering-rules missing/conflict semantics must remain blocked.");
    }
  }

  const governanceRegistryPath = path.join(root, GOVERNANCE_POLICY);
  if (!fs.existsSync(governanceRegistryPath) || !fs.statSync(governanceRegistryPath).isFile()) {
    errors.push(`Governance policy not found: ${GOVERNANCE_POLICY}`);
  } else {
    const governanceRegistry = readJson(governanceRegistryPath);
    const admission = governanceRegistry.admissionBoundary;
    if (!admission) {
      errors.push("governance-policy.json#admissionBoundary is required by canonical bootstrap.");
    } else {
      if (admission.mode !== "registry-first") errors.push("bootstrap requires admissionBoundary.mode=registry-first.");
      if (admission.legacyBaseline?.operational !== true) errors.push("bootstrap requires the admitted legacy baseline to remain operational during migration.");
      if (admission.unregisteredAdditions !== "non-operative") errors.push("bootstrap requires admissionBoundary.unregisteredAdditions=non-operative.");
      if (admission.rationaleOnlyOperational !== false) errors.push("bootstrap requires admissionBoundary.rationaleOnlyOperational=false.");
      if (!Array.isArray(admission.admissions) || admission.admissions.length === 0) errors.push("bootstrap requires at least one admitted rules revision.");
    }
  }

  const policy = manifest.contextBootstrap?.governancePolicy;
  if (!policy) return [...errors, "contextBootstrap.governancePolicy is required for Phase 8E bootstrap integration."];

  if (!["shadow", "primary"].includes(policy.mode)) errors.push(`Unknown governance bootstrap mode '${policy.mode}'.`);
  if (policy.primaryScope !== "registered-rules-only") errors.push("governancePolicy.primaryScope must be registered-rules-only.");
  if (policy.resolver !== RESOLVER) errors.push(`governancePolicy.resolver must be '${RESOLVER}'.`);
  if (policy.bootstrap !== BOOTSTRAP) errors.push(`governancePolicy.bootstrap must be '${BOOTSTRAP}'.`);
  if (policy.applicabilitySource !== APPLICABILITY_SOURCE) errors.push(`governancePolicy.applicabilitySource must be '${APPLICABILITY_SOURCE}'.`);
  if (policy.effectivePolicy !== "temporary-noncanonical") errors.push("governancePolicy.effectivePolicy must be temporary-noncanonical.");
  if (policy.preApplicabilityRules !== "full-read-required") errors.push("governancePolicy.preApplicabilityRules must be full-read-required.");
  if (policy.onFailure !== "blocked" || policy.onMismatch !== "blocked") errors.push("governance bootstrap failures and mismatches must block.");
  if (policy.humanGates !== "unchanged") errors.push("Phase 8E must preserve existing human gates.");
  if (policy.mode === "shadow" && policy.rulesResolution !== "preserved-full-read") {
    errors.push("shadow mode requires rulesResolution=preserved-full-read.");
  }
  if (policy.mode === "primary" && policy.rulesResolution !== "policy-primary-registered-rules-rationale-fallback") {
    errors.push("primary mode requires rulesResolution=policy-primary-registered-rules-rationale-fallback.");
  }
  if (!sameBindings(policy.stageBindings)) errors.push("governancePolicy.stageBindings diverges from the canonical Phase 8E prompt→stage map.");

  const bootstrapEntrypoint = path.join(root, policy.bootstrap?.replace(/\s+bootstrap$/, "") || "");
  if (!fs.existsSync(bootstrapEntrypoint) || !fs.statSync(bootstrapEntrypoint).isFile()) {
    errors.push(`governance bootstrap entrypoint not found: ${bootstrapEntrypoint}`);
  }

  // The rollout semantics must exist exactly once, in the shared source.
  const sharedBootstrapPath = path.join(root, SHARED_BOOTSTRAP);
  if (!fs.existsSync(sharedBootstrapPath) || !fs.statSync(sharedBootstrapPath).isFile()) {
    errors.push(`shared bootstrap source not found: ${SHARED_BOOTSTRAP}`);
  } else {
    const shared = fs.readFileSync(sharedBootstrapPath, "utf8");
    for (const fragment of SHARED_BOOTSTRAP_FRAGMENTS) {
      if (!shared.includes(fragment)) {
        errors.push(`${SHARED_BOOTSTRAP} is missing bootstrap policy fragment: ${fragment}`);
      }
    }
  }

  const promptById = new Map((manifest.prompts || []).map((prompt) => [prompt.id, prompt]));
  const boundIds = new Set();
  for (const binding of EXPECTED_BINDINGS) {
    if (boundIds.has(binding.promptId)) errors.push(`Duplicate bootstrap binding '${binding.promptId}'.`);
    boundIds.add(binding.promptId);
    const prompt = promptById.get(binding.promptId);
    if (!prompt) {
      errors.push(`Bootstrap binding references unknown prompt '${binding.promptId}'.`);
      continue;
    }
    const promptPath = path.join(root, "prompts/spec-driven", prompt.file);
    if (!fs.existsSync(promptPath)) {
      errors.push(`Bound prompt file not found: ${prompt.file}`);
      continue;
    }
    const content = fs.readFileSync(promptPath, "utf8");

    // Fragments that must appear in the prompt itself: the stage markers and the
    // stage-specific bootstrap invocation.
    const requiredFragments = [
      "rules-resolution:",
      "policy-resolution:",
      "policy-rollout:",
      "context-load:",
      "integrations/governance/governance-control.mjs bootstrap",
      `--stage \"${binding.stage}\"`,
      "--root \"{{PROJECT_ROOT}}\"",
      "--feature \"{{FEATURE_SLUG}}\"",
      "--applicability \".specs/features/{{FEATURE_SLUG}}/applicability.md\"",
      "effective-policy.json",
      // The prompt must point at the shared bootstrap source rather than
      // restating it; the rollout semantics themselves are asserted once,
      // against that file, below.
      SHARED_BOOTSTRAP_REF
    ];
    for (const fragment of requiredFragments) {
      if (!content.includes(fragment)) errors.push(`${prompt.file} is missing bootstrap policy fragment: ${fragment}`);
    }
    if (content.includes("integrations/governance/governance-control.mjs resolve --root")) {
      errors.push(`${prompt.file} bypasses the canonical bootstrap boundary by invoking resolve directly.`);
    }
    if (content.includes("governança ainda não registrada")) {
      errors.push(`${prompt.file} treats post-baseline unregistered governance as operational; use the admitted legacy baseline contract instead.`);
    }
  }

  for (const prompt of manifest.prompts || []) {
    if (boundIds.has(prompt.id)) continue;
    const promptPath = path.join(root, "prompts/spec-driven", prompt.file);
    if (!fs.existsSync(promptPath)) continue;
    const content = fs.readFileSync(promptPath, "utf8");
    if (content.includes("policy-resolution:")) {
      errors.push(`${prompt.file} is not mapped to a canonical governance stage but declares policy-resolution.`);
    }
  }

  requireFragments(errors, root, CANONICAL_BOOTSTRAP_SOURCES.skill, [
    "Path resolution is mandatory on every execution; full-content loading is governed by the canonical bootstrap policy",
    "integrations/governance/validate-governance-policy.mjs --root <PROJECT_ROOT>",
    "integrations/governance/governance-control.mjs bootstrap",
    "Before frozen `applicability.md` exists",
    "governance legacy captured by the admitted baseline",
    "additions after that baseline are non-operative",
    "Existing human gates remain unchanged"
  ], [
    "Read all applicable repository `AGENTS.md` files and the canonical project rules. Missing or conflicting rules block the stage.",
    "rationale and legacy/unregistered governance"
  ]);

  requireFragments(errors, root, CANONICAL_BOOTSTRAP_SOURCES.reference, [
    "Path resolution is required on every execution and is distinct from reading the full rules content.",
    "integrations/governance/validate-governance-policy.mjs --root <project-root>",
    "integrations/governance/governance-control.mjs bootstrap",
    "Before a frozen feature `applicability.md` exists",
    "governance legacy captured by the admitted baseline",
    "bootstrap.rulesAdmission.unregisteredAdditions=non-operative",
    "human gates remain unchanged"
  ], [
    "Read the resolved rules on every execution.",
    "rationale and legacy/unregistered governance"
  ]);

  requireFragments(errors, root, CANONICAL_BOOTSTRAP_SOURCES.rules, [
    "Resolver o path das regras é obrigatório em toda execução e não implica ler seu conteúdo integralmente.",
    "integrations/governance/governance-control.mjs bootstrap",
    "governança registrada",
    "human gates"
  ], [
    "Este arquivo é sempre a fonte carregada",
    "Leia as regras de engenharia em toda execução."
  ]);

  return errors;
}

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(String(args.root || DEFAULT_ROOT));
const errors = validate(root);
if (errors.length) {
  console.error("Governance bootstrap integration validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Governance bootstrap integration valid.");
const policy = readJson(path.join(root, "prompts/spec-driven/manifest.json")).contextBootstrap.governancePolicy;
console.log(`Mode: ${policy.mode}`);
console.log(`Rules resolution: ${policy.rulesResolution}`);
console.log(`Bindings: ${EXPECTED_BINDINGS.length}`);
