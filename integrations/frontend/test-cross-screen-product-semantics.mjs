#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateCrossScreenProductSemantics } from "./cross-screen-product-semantics.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../..");
let assertions = 0;

function check(value, message) {
  assertions += 1;
  assert.ok(value, message);
}

function equal(actual, expected, message) {
  assertions += 1;
  assert.equal(actual, expected, message);
}

function write(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function signature(overrides = {}) {
  return {
    variantRole: "badge-solid",
    semanticColorRole: "success",
    shapeRole: "pill",
    textRole: "label",
    ...overrides
  };
}

function semanticSection(role = null, value = null, usage = "semantic-target") {
  if (!role) return { applicability: "not-applicable", observations: [] };
  return {
    applicability: "required",
    observations: [{
      componentUsageId: usage,
      semanticRole: role,
      rendered: true,
      presentationSignature: value || signature()
    }]
  };
}

function navigationSection(overrides = {}) {
  return {
    applicability: "required",
    contractRef: "docs/frontend/navigation-capabilities.json",
    contractSha256: "a".repeat(64),
    modules: [{
      id: "cases",
      capabilityRef: "cases.read",
      availability: "active",
      presentation: "navigate",
      rendered: true,
      navigable: true,
      destination: "/cases",
      reasonVisible: false
    }],
    ...overrides
  };
}

function retrievalSection(overrides = {}) {
  return {
    applicability: "required",
    contractRef: "docs/frontend/global-retrieval.json",
    contractSha256: "b".repeat(64),
    trigger: {
      rendered: true,
      invocationMode: "command-menu",
      accessibleName: "Search everything",
      focusManaged: true,
      shortcutObserved: "Ctrl+P"
    },
    observedState: "results",
    resultAuthorization: {
      authorizationMode: "backend-authoritative-query-scope",
      authorizationFiltered: true,
      tenantScopeValidated: true,
      unauthorizedResultCount: 0,
      resultAnnouncementObserved: true,
      observedEntityTypes: ["case"],
      authorizationEvidenceRefs: ["tests/retrieval-auth.md"]
    },
    ...overrides
  };
}

function companion({ screenId, stateId = "data", semantic = null, navigation = null, retrieval = null }) {
  return {
    $schema: "../../integrations/frontend/product-semantics-evidence.schema.json",
    schemaVersion: "1.0.0",
    artifactKind: "product-semantics-evidence",
    status: "captured",
    screenId,
    stateId,
    semanticDifferentiation: semantic || semanticSection(),
    navigation: navigation || { applicability: "not-applicable", contractRef: null, contractSha256: null, modules: [] },
    globalRetrieval: retrieval || { applicability: "not-applicable", contractRef: null, contractSha256: null, trigger: null, observedState: "not-applicable", resultAuthorization: null }
  };
}

function screen(screenId, productContextRef, shell = false) {
  return {
    screen: {
      id: screenId,
      category: shell ? "application-shell" : "searchable-list",
      surface: shell ? "application-shell" : "route"
    },
    productContext: { source: productContextRef }
  };
}

function evidence(screenId, stateId, themeId, companionRef) {
  return {
    meta: { screenId, stateId },
    theme: { id: themeId },
    presenceSignals: [{ signal: "productSemantics.evidenceRef", value: companionRef }]
  };
}

function addSample(root, index, {
  screenId,
  productContextRef = "docs/frontend/product-context.md",
  shell = false,
  stateId = "data",
  themeId = "dark",
  companionValue
}) {
  const screenRef = `screens/${index}-${screenId}.json`;
  const evidenceRef = `evidence/${index}-${screenId}-${stateId}-${themeId}.json`;
  const companionRef = `evidence/${index}-${screenId}-${stateId}-${themeId}-product-semantics.json`;
  const craftRef = `craft/${index}-${screenId}.json`;
  write(path.join(root, screenRef), screen(screenId, productContextRef, shell));
  write(path.join(root, evidenceRef), evidence(screenId, stateId, themeId, companionRef));
  write(path.join(root, companionRef), companionValue);
  write(path.join(root, craftRef), { screenId, visualFamilyId: "operate-workbench" });
  return { screenSpec: screenRef, craftContract: craftRef, evidence: evidenceRef };
}

function runCase(sampleDefinitions) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "phase10e-cross-screen-"));
  const samples = sampleDefinitions.map((definition, index) => addSample(root, index + 1, definition));
  const manifest = {
    $schema: "frontend-family-consistency-manifest.schema.json",
    schemaVersion: "1.0.0",
    visualFamilyId: "operate-workbench",
    designSystem: "docs/frontend/design-system/design-system.json",
    samples
  };
  const findings = validateCrossScreenProductSemantics({ root, manifest });
  fs.rmSync(root, { recursive: true, force: true });
  return findings;
}

function hasCode(findings, code) {
  return findings.some((finding) => finding.code === code);
}

// Same rendered role, same full signature across different screens is consistent.
{
  const findings = runCase([
    { screenId: "cases", companionValue: companion({ screenId: "cases", semantic: semanticSection("status", signature(), "cases-status") }) },
    { screenId: "tasks", companionValue: companion({ screenId: "tasks", semantic: semanticSection("status", signature(), "tasks-status") }) }
  ]);
  equal(findings.length, 0, "Equivalent semantic roles should remain consistent across screens.");
}

// Component IDs and literal screen identities are intentionally not compared.
{
  const findings = runCase([
    { screenId: "cases", companionValue: companion({ screenId: "cases", semantic: semanticSection("status", signature(), "case-state-chip") }) },
    { screenId: "tasks", companionValue: companion({ screenId: "tasks", semantic: semanticSection("status", signature(), "task-health-pill") }) }
  ]);
  equal(findings.length, 0, "Different component usage IDs must not create literal-content coupling.");
}

// Full presentation signature drift for one role is a cross-screen contract defect.
{
  const findings = runCase([
    { screenId: "cases", companionValue: companion({ screenId: "cases", semantic: semanticSection("status", signature(), "cases-status") }) },
    { screenId: "tasks", companionValue: companion({ screenId: "tasks", semantic: semanticSection("status", signature({ shapeRole: "square" }), "tasks-status") }) }
  ]);
  check(hasCode(findings, "CROSS_SCREEN_SEMANTIC_SIGNATURE_DRIFT"), "Same-role full signature drift must fail.");
  equal(findings.find((finding) => finding.code === "CROSS_SCREEN_SEMANTIC_SIGNATURE_DRIFT").defectKind, "contract", "Semantic drift must route as contract repair.");
}

// Stable navigation semantics across shell states/themes are accepted.
{
  const findings = runCase([
    { screenId: "app-shell", shell: true, stateId: "data", themeId: "dark", companionValue: companion({ screenId: "app-shell", navigation: navigationSection() }) },
    { screenId: "app-shell", shell: true, stateId: "loading", themeId: "light", companionValue: companion({ screenId: "app-shell", stateId: "loading", navigation: navigationSection() }) }
  ]);
  equal(findings.length, 0, "Navigation semantics may span shell states/themes without drift.");
}

{
  const changed = navigationSection({ contractRef: "docs/frontend/navigation-v2.json" });
  const findings = runCase([
    { screenId: "app-shell", shell: true, companionValue: companion({ screenId: "app-shell", navigation: navigationSection() }) },
    { screenId: "app-shell-alt", shell: true, companionValue: companion({ screenId: "app-shell-alt", navigation: changed }) }
  ]);
  check(hasCode(findings, "CROSS_SCREEN_NAVIGATION_CONTRACT_REF_DRIFT"), "Navigation contract ref drift must fail.");
}

{
  const changed = navigationSection({ contractSha256: "c".repeat(64) });
  const findings = runCase([
    { screenId: "app-shell", shell: true, companionValue: companion({ screenId: "app-shell", navigation: navigationSection() }) },
    { screenId: "app-shell-alt", shell: true, companionValue: companion({ screenId: "app-shell-alt", navigation: changed }) }
  ]);
  check(hasCode(findings, "CROSS_SCREEN_NAVIGATION_CONTRACT_HASH_DRIFT"), "Navigation revision drift must fail.");
}

{
  const changed = navigationSection();
  changed.modules[0] = { ...changed.modules[0], availability: "entitlement-locked", presentation: "disabled-with-reason", rendered: true, navigable: false, destination: null, reasonVisible: true };
  const findings = runCase([
    { screenId: "app-shell", shell: true, companionValue: companion({ screenId: "app-shell", navigation: navigationSection() }) },
    { screenId: "app-shell-alt", shell: true, companionValue: companion({ screenId: "app-shell-alt", navigation: changed }) }
  ]);
  check(hasCode(findings, "CROSS_SCREEN_NAVIGATION_PRESENTATION_DRIFT"), "Navigation availability/presentation drift must fail.");
}

{
  const findings = runCase([
    { screenId: "app-shell", shell: true, companionValue: companion({ screenId: "app-shell", navigation: navigationSection() }) },
    { screenId: "app-shell-alt", shell: true, companionValue: companion({ screenId: "app-shell-alt" }) }
  ]);
  check(hasCode(findings, "CROSS_SCREEN_NAVIGATION_APPLICABILITY_DRIFT"), "Shell navigation applicability drift must fail.");
}

{
  const findings = runCase([
    { screenId: "cases", shell: false, companionValue: companion({ screenId: "cases", navigation: navigationSection() }) }
  ]);
  check(hasCode(findings, "CROSS_SCREEN_NAVIGATION_NON_SHELL_APPLICABLE"), "Navigation capability must not become a screen-local contract.");
}

// Different product contexts are isolated and may bind different navigation contracts.
{
  const alt = navigationSection({ contractRef: "docs/frontend/navigation-other.json", contractSha256: "d".repeat(64) });
  const findings = runCase([
    { screenId: "shell-a", shell: true, productContextRef: "docs/frontend/product-a.md", companionValue: companion({ screenId: "shell-a", navigation: navigationSection() }) },
    { screenId: "shell-b", shell: true, productContextRef: "docs/frontend/product-b.md", companionValue: companion({ screenId: "shell-b", navigation: alt }) }
  ]);
  equal(findings.length, 0, "Different product contexts must not be forced into one navigation contract.");
}

// Stable retrieval shell semantics are accepted even when literal labels/current states/results differ.
{
  const alternateState = retrievalSection({
    trigger: { ...retrievalSection().trigger, accessibleName: "Find records" },
    observedState: "loading",
    resultAuthorization: { ...retrievalSection().resultAuthorization, observedEntityTypes: [] }
  });
  const findings = runCase([
    { screenId: "app-shell", shell: true, companionValue: companion({ screenId: "app-shell", retrieval: retrievalSection() }) },
    { screenId: "app-shell-alt", shell: true, stateId: "loading", companionValue: companion({ screenId: "app-shell-alt", stateId: "loading", retrieval: alternateState }) }
  ]);
  equal(findings.length, 0, "Literal accessible labels/current retrieval state/result content must not be compared cross-screen.");
}

{
  const changed = retrievalSection({ contractRef: "docs/frontend/global-retrieval-v2.json" });
  const findings = runCase([
    { screenId: "shell-a", shell: true, companionValue: companion({ screenId: "shell-a", retrieval: retrievalSection() }) },
    { screenId: "shell-b", shell: true, companionValue: companion({ screenId: "shell-b", retrieval: changed }) }
  ]);
  check(hasCode(findings, "CROSS_SCREEN_RETRIEVAL_CONTRACT_REF_DRIFT"), "Retrieval contract ref drift must fail.");
}

{
  const changed = retrievalSection({ contractSha256: "e".repeat(64) });
  const findings = runCase([
    { screenId: "shell-a", shell: true, companionValue: companion({ screenId: "shell-a", retrieval: retrievalSection() }) },
    { screenId: "shell-b", shell: true, companionValue: companion({ screenId: "shell-b", retrieval: changed }) }
  ]);
  check(hasCode(findings, "CROSS_SCREEN_RETRIEVAL_CONTRACT_HASH_DRIFT"), "Retrieval revision drift must fail.");
}

{
  const changed = retrievalSection({ applicability: "optional" });
  const findings = runCase([
    { screenId: "shell-a", shell: true, companionValue: companion({ screenId: "shell-a", retrieval: retrievalSection() }) },
    { screenId: "shell-b", shell: true, companionValue: companion({ screenId: "shell-b", retrieval: changed }) }
  ]);
  check(hasCode(findings, "CROSS_SCREEN_RETRIEVAL_SHELL_SEMANTICS_DRIFT"), "Required/optional retrieval semantics must not drift inside one product shell.");
}

{
  const changed = retrievalSection();
  changed.trigger = { ...changed.trigger, invocationMode: "global-header" };
  const findings = runCase([
    { screenId: "shell-a", shell: true, companionValue: companion({ screenId: "shell-a", retrieval: retrievalSection() }) },
    { screenId: "shell-b", shell: true, companionValue: companion({ screenId: "shell-b", retrieval: changed }) }
  ]);
  check(hasCode(findings, "CROSS_SCREEN_RETRIEVAL_SHELL_SEMANTICS_DRIFT"), "Retrieval invocation mode drift must fail.");
}

{
  const changed = retrievalSection();
  changed.trigger = { ...changed.trigger, shortcutObserved: null };
  const findings = runCase([
    { screenId: "shell-a", shell: true, companionValue: companion({ screenId: "shell-a", retrieval: retrievalSection() }) },
    { screenId: "shell-b", shell: true, companionValue: companion({ screenId: "shell-b", retrieval: changed }) }
  ]);
  check(hasCode(findings, "CROSS_SCREEN_RETRIEVAL_SHELL_SEMANTICS_DRIFT"), "Retrieval shortcut semantics drift must fail when a shortcut is contractually present.");
}

{
  const changed = retrievalSection();
  changed.resultAuthorization = { ...changed.resultAuthorization, authorizationMode: "backend-authoritative-per-result" };
  const findings = runCase([
    { screenId: "shell-a", shell: true, companionValue: companion({ screenId: "shell-a", retrieval: retrievalSection() }) },
    { screenId: "shell-b", shell: true, companionValue: companion({ screenId: "shell-b", retrieval: changed }) }
  ]);
  check(hasCode(findings, "CROSS_SCREEN_RETRIEVAL_SHELL_SEMANTICS_DRIFT"), "Retrieval authorization-mode drift must fail.");
}

{
  const findings = runCase([
    { screenId: "shell-a", shell: true, companionValue: companion({ screenId: "shell-a", retrieval: retrievalSection() }) },
    { screenId: "shell-b", shell: true, companionValue: companion({ screenId: "shell-b" }) }
  ]);
  check(hasCode(findings, "CROSS_SCREEN_RETRIEVAL_APPLICABILITY_DRIFT"), "Shell retrieval applicability drift must fail.");
}

{
  const findings = runCase([
    { screenId: "cases", shell: false, companionValue: companion({ screenId: "cases", retrieval: retrievalSection() }) }
  ]);
  check(hasCode(findings, "CROSS_SCREEN_RETRIEVAL_NON_SHELL_APPLICABLE"), "Global retrieval must not become a local screen feature.");
}

// Different product contexts may bind different retrieval contracts.
{
  const other = retrievalSection({ contractRef: "docs/frontend/global-retrieval-other.json", contractSha256: "f".repeat(64) });
  const findings = runCase([
    { screenId: "shell-a", shell: true, productContextRef: "docs/frontend/product-a.md", companionValue: companion({ screenId: "shell-a", retrieval: retrievalSection() }) },
    { screenId: "shell-b", shell: true, productContextRef: "docs/frontend/product-b.md", companionValue: companion({ screenId: "shell-b", retrieval: other }) }
  ]);
  equal(findings.length, 0, "Different product contexts must not be forced into one retrieval contract.");
}

const wrapper = fs.readFileSync(path.join(ROOT, "integrations/impeccable/frontend-family-consistency.mjs"), "utf8");
check(wrapper.includes("validateCrossScreenProductSemantics"), "Phase 7 public wrapper must import the 10E comparator.");
check(wrapper.includes("phase10eFindings"), "Phase 7 public wrapper must materialize 10E findings.");
check(wrapper.includes("report.checks.crossScreen = \"failed\""), "10E findings must fail the existing Phase 7 crossScreen check.");
check(wrapper.includes("report.transition = \"DESIGN_READINESS\""), "10E contract drift must return to DESIGN_READINESS.");

const prompt = fs.readFileSync(path.join(ROOT, "prompts/spec-driven/09-validate-evidence.prompt.md"), "utf8");
check(prompt.includes("cross-screen-product-semantics"), "Evidence release prompt must consume 10E cross-screen product semantics.");
check(prompt.includes("não compare conteúdo literal"), "10E runtime contract must explicitly reject literal-content equality as its invariant.");

const workflow = fs.readFileSync(path.join(ROOT, ".github/workflows/workflow-validation.yml"), "utf8");
check(workflow.includes("cross-screen product semantics"), "CI must contain a permanent Phase 10E gate.");
check(workflow.includes("test-cross-screen-product-semantics.mjs"), "CI Phase 10E gate must execute the focused regression suite.");

console.log(`Cross-screen product semantics Phase 10E regression suite passed (${assertions} assertions).`);
