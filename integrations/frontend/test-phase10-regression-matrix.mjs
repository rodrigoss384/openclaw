#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateGlobalRetrieval } from "./global-retrieval.mjs";
import { validateProductSemanticsEvidence } from "./product-semantics-evidence.mjs";
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

function write(root, relative, value) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`);
  return target;
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function runSuite(label, relative, expectedFragment) {
  const result = spawnSync(process.execPath, [path.join(ROOT, relative)], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  equal(result.status, 0, `${label} must remain green.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  if (expectedFragment) check(result.stdout.includes(expectedFragment), `${label} must report '${expectedFragment}'.`);
  return result;
}

function source(relative) {
  return fs.readFileSync(path.join(ROOT, relative), "utf8");
}

function requiresTokens(relative, tokens) {
  const content = source(relative);
  for (const token of tokens) check(content.includes(token), `${relative} must retain regression coverage token '${token}'.`);
}

const suites = [
  ["10A semantic differentiation", "integrations/impeccable/test-cross-role-semantic-differentiation.mjs", "Cross-role semantic differentiation Phase 10A regression suite passed"],
  ["10A semantic runtime", "integrations/impeccable/test-cross-role-semantic-runtime.mjs", "Cross-role semantic runtime Phase 10A regression suite passed"],
  ["10B navigation", "integrations/frontend/test-navigation-capability.mjs", "Navigation capability Phase 10B regression suite passed"],
  ["10C global retrieval", "integrations/frontend/test-global-retrieval.mjs", "Global retrieval Phase 10C regression suite passed"],
  ["10D product semantics evidence", "integrations/frontend/test-product-semantics-evidence.mjs", "Product semantics evidence Phase 10D regression suite passed"],
  ["10E cross-screen product semantics", "integrations/frontend/test-cross-screen-product-semantics.mjs", "Cross-screen product semantics Phase 10E regression suite passed"],
  ["Phase 5 operational evidence", "integrations/impeccable/test-theme-operational-evidence.mjs", "Phase 5 theme-aware + operational craft evidence tests passed"],
  ["Phase 7 family consistency", "integrations/impeccable/test-family-consistency.mjs", "Phase 7 cross-screen + cross-theme family consistency tests passed"],
  ["Perceptual calibration", "integrations/impeccable/test-perceptual-calibration.mjs", "Perceptual calibration regression suite passed"],
  ["Passive data-as-control", "integrations/impeccable/test-passive-data-control.mjs", "Passive data-as-control regression suite passed"],
  ["Behavioral UX", "skills/frontend-product-builder/scripts/test-behavioral-ux-contract-cli.mjs", "Behavioral UX Contract CLI tests: passed"]
];

for (const suite of suites) runSuite(...suite);

requiresTokens("integrations/impeccable/test-cross-role-semantic-differentiation.mjs", [
  "semanticRole: \"phase\"",
  "semanticRole: \"status\"",
  "color-only differentiation is forbidden"
]);
requiresTokens("integrations/frontend/test-cross-screen-product-semantics.mjs", [
  "Equivalent semantic roles should remain consistent across screens."
]);

requiresTokens("integrations/frontend/test-navigation-capability.mjs", [
  "single-module",
  "coming-soon-without-roadmap",
  "upsell-without-commercial-source",
  "upsell-without-bux",
  "active-permission-missing"
]);

requiresTokens("integrations/frontend/test-global-retrieval.mjs", [
  "missing-backend-ref",
  "negative-na-shortcut"
]);
requiresTokens("integrations/frontend/test-product-semantics-evidence.mjs", [
  "retrieval trigger missing",
  "PRODUCT_SEMANTICS_RETRIEVAL_TRIGGER_MISSING",
  "unauthorizedResultCount"
]);

requiresTokens("integrations/impeccable/test-theme-operational-evidence.mjs", [
  "theme-calibration",
  "surface-level",
  "accent-role",
  "contrast-order",
  "border-role",
  "semantic-color",
  "action-target",
  "empty-actionable",
  "wayfinding",
  "active-filter",
  "decision-signal",
  "reference-utility",
  "semantic-family"
]);
requiresTokens("integrations/impeccable/test-perceptual-calibration.mjs", [
  "PERCEPTUAL_SURFACE_CHROMA_DOMINANCE",
  "PERCEPTUAL_BORDER_FENCE",
  "PERCEPTUAL_THEME_COLOR_WEIGHT_DRIFT",
  "PERCEPTUAL_CONTRAST_DENSITY_NOT_COMPENSATED",
  "ordinary light/dark themes must retain the existing stable-geometry envelope",
  "higher contrast with bounded additional separation must pass"
]);
requiresTokens("integrations/impeccable/test-passive-data-control.mjs", [
  "PASSIVE_DATA_AS_CONTROL",
  "READ_ONLY_CONTROL_RATIONALE_MISSING",
  "display-only data rendered as ordinary text must pass",
  "form-owned editable control must pass"
]);

function optionalAbsentContract() {
  return {
    $schema: "../../integrations/frontend/global-retrieval.schema.json",
    schemaVersion: "1.0.0",
    artifactKind: "global-retrieval-applicability",
    status: "ready",
    owner: "product-team",
    productContextRef: "docs/frontend/product-context.md",
    applicationShellScreenRef: null,
    applicability: "optional",
    applicabilityBasis: {
      transversalRetrieval: true,
      multipleEntityTypes: false,
      recurringQuickFind: false,
      operationalHighFrequency: false
    },
    reason: "Cross-area retrieval is plausible but local navigation is sufficient for the approved workflow.",
    searchableEntityTypes: [],
    invocation: {
      mode: "none",
      globalEntryRequired: false,
      accessibleTriggerRequired: false,
      focusManagementRequired: false
    },
    shortcut: null,
    authorizationMode: "not-applicable",
    resultContract: null,
    backendContractRef: null,
    evidence: [
      {
        signal: "transversal-retrieval",
        sourceRef: "docs/frontend/product-context.md",
        statement: "The context has a transversal lookup opportunity, but no global retrieval runtime is required."
      }
    ]
  };
}

function notApplicableInventedCommandPalette() {
  const value = optionalAbsentContract();
  value.applicability = "not-applicable";
  value.applicabilityBasis = {
    transversalRetrieval: false,
    multipleEntityTypes: false,
    recurringQuickFind: false,
    operationalHighFrequency: false
  };
  value.reason = "No global retrieval job is approved.";
  value.evidence = [{
    signal: "not-applicable",
    sourceRef: "docs/frontend/product-context.md",
    statement: "No global retrieval job is approved."
  }];
  value.invocation = {
    mode: "command-menu",
    globalEntryRequired: true,
    accessibleTriggerRequired: true,
    focusManagementRequired: true
  };
  return value;
}

const closureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "phase10f-regression-matrix-"));
try {
  write(closureRoot, "docs/frontend/product-context.md", "# Product Context\n");

  const optionalPath = write(closureRoot, "docs/frontend/global-retrieval.json", optionalAbsentContract());
  const optionalResult = validateGlobalRetrieval({ root: closureRoot, contractPath: optionalPath });
  check(optionalResult.valid, `optional retrieval may remain absent: ${optionalResult.errors.join(" | ")}`);
  equal(optionalResult.summary.applicability, "optional", "optional applicability must be retained");
  equal(optionalResult.summary.implementationMode, "absent", "optional absence must be explicit in the validator summary");
  equal(optionalResult.summary.invocationMode, "none", "optional absence must not invent a global trigger");
  equal(optionalResult.summary.backendContractRef, null, "optional absence must not invent a backend retrieval contract");

  const inventedPath = write(closureRoot, "docs/frontend/global-retrieval-invented.json", notApplicableInventedCommandPalette());
  const inventedResult = validateGlobalRetrieval({ root: closureRoot, contractPath: inventedPath });
  check(!inventedResult.valid, "not-applicable retrieval must reject an invented command palette");
  check(inventedResult.errors.some((error) => error.includes("invocation.mode=none")), `invented command palette must report the absence contract: ${inventedResult.errors.join(" | ")}`);

  const screenRef = "screens/cases.json";
  const companionRef = "evidence/cases-product-semantics.json";
  const screen = {
    screen: { id: "cases", category: "searchable-list", surface: "route" },
    productContext: { source: "docs/frontend/product-context.md" },
    architecture: { integrationContracts: [] }
  };
  write(closureRoot, screenRef, screen);
  const companion = {
    $schema: "../../integrations/frontend/product-semantics-evidence.schema.json",
    schemaVersion: "1.0.0",
    artifactKind: "product-semantics-evidence",
    status: "captured",
    screenId: "cases",
    stateId: "data",
    semanticDifferentiation: { applicability: "not-applicable", observations: [] },
    navigation: { applicability: "not-applicable", contractRef: null, contractSha256: null, modules: [] },
    globalRetrieval: {
      applicability: "optional",
      contractRef: "docs/frontend/global-retrieval.json",
      contractSha256: sha256(optionalPath),
      trigger: null,
      observedState: "not-applicable",
      resultAuthorization: null
    }
  };
  write(closureRoot, companionRef, companion);
  const evidence = {
    meta: { screenId: "cases", stateId: "data" },
    elements: [],
    presenceSignals: [{ signal: "productSemantics.evidenceRef", value: companionRef }]
  };
  const evidenceErrors = validateProductSemanticsEvidence({
    root: closureRoot,
    screenRef,
    screen,
    designSystem: {},
    craft: { dimensions: { semanticPresentation: { assignments: [] } } },
    evidence
  });
  equal(evidenceErrors.length, 0, `10D optional-absence evidence must pass without fabricated runtime evidence: ${JSON.stringify(evidenceErrors)}`);

  const screen2Ref = "screens/tasks.json";
  const companion2Ref = "evidence/tasks-product-semantics.json";
  write(closureRoot, screen2Ref, {
    screen: { id: "tasks", category: "searchable-list", surface: "route" },
    productContext: { source: "docs/frontend/product-context.md" },
    architecture: { integrationContracts: [] }
  });
  write(closureRoot, companion2Ref, { ...companion, screenId: "tasks" });
  const evidence1Ref = "evidence/cases.json";
  const evidence2Ref = "evidence/tasks.json";
  write(closureRoot, evidence1Ref, { meta: { screenId: "cases", stateId: "data" }, theme: { id: "dark" }, presenceSignals: [{ signal: "productSemantics.evidenceRef", value: companionRef }] });
  write(closureRoot, evidence2Ref, { meta: { screenId: "tasks", stateId: "data" }, theme: { id: "dark" }, presenceSignals: [{ signal: "productSemantics.evidenceRef", value: companion2Ref }] });
  write(closureRoot, "craft/cases.json", { screenId: "cases", visualFamilyId: "operate-workbench" });
  write(closureRoot, "craft/tasks.json", { screenId: "tasks", visualFamilyId: "operate-workbench" });
  const matrixFindings = validateCrossScreenProductSemantics({
    root: closureRoot,
    manifest: {
      visualFamilyId: "operate-workbench",
      samples: [
        { screenSpec: screenRef, craftContract: "craft/cases.json", evidence: evidence1Ref },
        { screenSpec: screen2Ref, craftContract: "craft/tasks.json", evidence: evidence2Ref }
      ]
    }
  });
  check(!matrixFindings.some((finding) => finding.code === "CROSS_SCREEN_RETRIEVAL_NON_SHELL_APPLICABLE"), "10E must not flag optional absence as a screen-local global retrieval capability");
} finally {
  fs.rmSync(closureRoot, { recursive: true, force: true });
}

console.log(`Phase 10F regression matrix passed (${assertions} assertions; ${suites.length} inherited suites revalidated).`);
