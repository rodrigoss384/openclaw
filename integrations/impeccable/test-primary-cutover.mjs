#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const integrationDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(integrationDir, "../..");
let assertions = 0;

function check(condition, message) {
  assertions += 1;
  assert.ok(condition, message);
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function json(relativePath) {
  return JSON.parse(read(relativePath));
}

const policy = json("prompts/spec-driven/frontend-craft-policy.json");
const manifest = json("prompts/spec-driven/manifest.json");

check(policy.provider?.id === "impeccable", "Impeccable must be the configured craft provider");
check(policy.provider?.version === "3.5.0", "Impeccable provider must stay pinned to 3.5.0 until a conscious upgrade");
check(policy.authority?.visualCraft === "impeccable", "visualCraft authority must be Impeccable");
check(policy.visualDirection?.mode === "primary", "visualDirection must be primary after cutover");
check(policy.visualDirection?.requiredWhen === "readiness-controller-provider-open", "shape must be triggered by the readiness controller rather than generic direction-open prose");
check(policy.readiness?.controller === "integrations/impeccable/frontend-control.mjs", "Phase 3 readiness controller must be canonical provider policy");
check(policy.readiness?.relationshipMode === "resolved-unresolved-blocked", "readiness must expose resolved/unresolved/blocked relationships");
check(policy.readiness?.shapeInvocation === "unresolved-provider-eligible-only", "shape must receive only provider-eligible unresolved dimensions");
check(policy.readiness?.canonicalAdoptionRequired === true && policy.readiness?.rederiveAfterAdoption === true, "provider decisions must be adopted canonically and re-derived");
check(policy.readiness?.unchangedAfterAdoption === "block-contract-model-do-not-repeat-shape", "Phase 3 must prevent endless shape loops after canonical adoption");
check(policy.representativeReview?.mode === "primary", "representativeReview must be primary after cutover");
check(policy.rollout?.phase === "primary", "rollout.phase must be primary after cutover");
check(policy.rollout?.frontendDesign === "legacy-fallback-explicit-only", "frontend-design must be legacy fallback only");
check(policy.rollout?.impeccable === "primary-visual-craft-authority", "Impeccable rollout role must be primary visual craft authority");
check(policy.representativeReview?.mayApproveGate === false, "Impeccable must never approve the representative gate");
check(policy.contextBridge?.providerArtifactsAreCanonical === false, "Provider PRODUCT.md/DESIGN.md projections must remain non-canonical");
check(policy.detector?.required === true, "Impeccable detector capability must remain required");
check(policy.polish?.maxVisualInspectionRounds === 2, "Visual inspection must remain bounded to two rounds");
check(policy.polish?.maxPolishRounds === 1, "Polish must remain bounded to one round");
check(policy.repairLoop?.controller === "integrations/impeccable/frontend-control.mjs", "Phase 6 representative repair loop must stay behind frontend-control.mjs");
check(policy.repairLoop?.maxCraftRounds === 2, "Phase 6 craft repair must remain bounded to two rounds");
check(policy.repairLoop?.maxPolishRounds === 1, "Phase 6 polish must remain bounded to one round");
check(policy.repairLoop?.classification === "explicit-taxonomy-no-free-text-inference", "Phase 6 must never infer finding taxonomy from critique prose");

const nonCanonical = new Set(policy.commands?.notCanonicalInManagedWorkflow || []);
check(nonCanonical.has("init") && nonCanonical.has("document"), "init and document must remain non-canonical in the managed workflow");
check((policy.commands?.designSystemMaintenanceOnly || []).includes("extract"), "extract must remain design-system-maintenance only");
check((policy.commands?.explicitApproval || []).includes("live"), "live must require explicit approval");
check((policy.commands?.strongExplicitApproval || []).includes("overdrive"), "overdrive must require strong explicit approval");

const impeccableRoutes = (manifest.skillRoutes || []).filter((route) => route.skill === "impeccable");
const frontendDesignRoutes = (manifest.skillRoutes || []).filter((route) => route.skill === "frontend-design");
check(impeccableRoutes.length === 1, "Manifest must contain exactly one Impeccable route");
check(impeccableRoutes[0]?.when === "any-user-visible-web-interface-change", "Impeccable must own the automatic user-visible frontend craft route");
check(impeccableRoutes[0]?.requirementLevel === "required-with-degraded-fallback", "Impeccable route must have an explicit degraded fallback");
check(String(impeccableRoutes[0]?.fallback || "").includes("frontend-design"), "Impeccable degraded fallback must name frontend-design");
check(String(impeccableRoutes[0]?.fallback || "").includes("unresolvedSkills"), "Impeccable degraded fallback must key on the workflow lock, not on the agent noticing");
check(frontendDesignRoutes.length === 1, "Manifest must retain exactly one frontend-design compatibility route");
// The fallback used to be "legacy-…-explicit-only", which made it a dead-letter
// route: nothing detected the missing Impeccable skill and promoted it, so the
// only creative mandate in the control plane was unreachable. It now activates
// off workflow.lock.json#unresolvedSkills.
check(frontendDesignRoutes[0]?.when === "impeccable-unresolved-in-workflow-lock", "frontend-design must activate from the workflow lock's unresolvedSkills");
check(!frontendDesignRoutes.some((route) => route.when === "any-user-visible-web-interface-change"), "frontend-design must never regain the automatic frontend craft route");

const sourceContracts = [
  ["prompts/spec-driven/05-design-readiness.prompt.md", ["Impeccable", "Visual Craft Authority", "frontend-control.mjs readiness", "shape.dimensions", "fallback legado"]],
  ["prompts/spec-driven/07-execute.prompt.md", ["impeccable-primary-build:", "frontend-craft.mjs detect", "fallback legado"]],
  ["prompts/spec-driven/07.1-frontend-representative-gate.prompt.md", ["impeccable-primary-critique:", "critique", "decisão humana", "fallback legado"]],
  ["skills/spec-driven-engineering/SKILL.md", ["Impeccable", "governed Visual Craft Authority", "frontend-control.mjs readiness", "explicit legacy fallback"]],
  ["skills/spec-driven-engineering/references/frontend-overlay.md", ["primary Visual Craft Authority", "frontend-control.mjs readiness", "explicit legacy fallback"]],
  ["skills/spec-driven-engineering/references/skill-routing.md", ["governed Visual Craft Authority", "frontend-control.mjs readiness", "unresolvedSkills"]],
  ["rules.md", ["Impeccable como **Visual Craft Authority**", "frontend-control.mjs readiness", "fallback legado explícito"]]
];

for (const [relativePath, fragments] of sourceContracts) {
  const content = read(relativePath);
  for (const fragment of fragments) {
    check(content.includes(fragment), `${relativePath} is missing primary-cutover contract fragment: ${fragment}`);
  }
  check(!content.includes("impeccable-shadow"), `${relativePath} still contains a shadow-mode marker`);
}

check(!read("prompts/spec-driven/05-design-readiness.prompt.md").includes("Em `VISUAL DIRECTION`, use Impeccable `shape`"), "05-design-readiness must not restore generic shape-first routing");
check(!read("rules.md").includes("Direção aberta exige Impeccable `shape`"), "rules.md must not restore narrative direction-open shape routing");

const forbiddenPrimaryFrontendDesignPhrases = [
  "Toda criação ou alteração de interface web visível deve usar a skill oficial `$frontend-design`",
  "Invoke the official `frontend-design` skill during `VISUAL DIRECTION` and during representative-slice critique",
  "Use the official `frontend-design` skill for every user-visible web-interface creation or change"
];

for (const relativePath of [
  "rules.md",
  "skills/spec-driven-engineering/SKILL.md",
  "skills/spec-driven-engineering/references/frontend-overlay.md",
  "skills/spec-driven-engineering/references/skill-routing.md"
]) {
  const content = read(relativePath);
  for (const phrase of forbiddenPrimaryFrontendDesignPhrases) {
    check(!content.includes(phrase), `${relativePath} still declares frontend-design as the primary visual authority`);
  }
}

const canonicalWorkflow = "DISCOVER -> PRIORITIZE -> VISUAL DIRECTION -> COMPOSITION PROOF -> CLASSIFY -> RECIPE -> TOKENS -> COMPONENT MAP -> PLAN -> SMALL SLICE -> BUILD -> BROWSER -> SCREENSHOTS -> COMPOSITION AUDIT -> DS AUDIT -> PATCH -> REPORT";
check(read("rules.md").includes(canonicalWorkflow), "Canonical frontend workflow changed during craft-provider cutover");

console.log(`Impeccable primary cutover enforcement: passed (${assertions} assertions)`);
