#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../..");
const ADAPTER = path.join(SCRIPT_DIR, "frontend-craft.mjs");
const AUDITOR = path.join(ROOT, "skills/frontend-product-builder/scripts/audit-theme-operational-evidence.mjs");
const POLICY = path.join(ROOT, "prompts/spec-driven/frontend-craft-policy.json");
const CRAFT_SCHEMA = path.join(SCRIPT_DIR, "craft-contract.schema.json");

function write(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`);
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function run(command, args, cwd = ROOT, expectedStatus = 0) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  assert.equal(result.status, expectedStatus, `Unexpected exit code.\nCOMMAND: ${command} ${args.join(" ")}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  return result;
}

function perceptualPolicy() {
  return {
    surfaceHierarchy: {
      levels: ["canvas", "surface", "surface-subtle", "surface-elevated"],
      separationModelByTheme: { light: "mixed", dark: "mixed" }
    },
    accentPolicy: {
      mode: "sparse",
      allowedSemanticRoles: ["primary-action", "active-navigation"],
      unregisteredRole: "error"
    },
    semanticColorPolicy: {
      roles: ["success", "warning", "danger", "info", "neutral", "inactive"],
      brandAccentMayRepresentStatus: false
    },
    textContrastHierarchy: {
      order: ["primary", "secondary", "muted", "disabled"],
      accessibilityFloor: "WCAG-2.2-AA"
    },
    borderPolicy: {
      roles: ["subtle", "default", "strong", "focus", "error", "selection"],
      strongAllowedFor: ["focus", "error", "selection", "explicit-structure"]
    },
    themeCalibration: {
      mode: "per-theme-context-validation",
      reuseExactColorValuesAllowedWhenValidated: true
    },
    geometryAcrossThemes: {
      defaultBehavior: "stable",
      exceptionsRequireApproval: true
    },
    presentationRoles: {
      status: { componentFamily: "StatusBadge", consistency: "strict" },
      "reusable-reference": { componentFamily: "ReferenceValue", consistency: "contextual" }
    }
  };
}

function recipeFixture() {
  return {
    meta: { id: "searchable-list", name: "Searchable List", version: "1.1.0" },
    content: { density: "compact" },
    regions: [
      { id: "pageHeader", required: true, cardinality: { minimum: 1, maximum: 1 } },
      { id: "activeFilterSummary", required: false, cardinality: { minimum: 0, maximum: 1 } },
      { id: "results", required: true, cardinality: { minimum: 1, maximum: 1 } }
    ],
    craftDefaults: {
      spatialComposition: {
        maxVisualNestingDepth: 2,
        regionAssignments: [
          { regionId: "pageHeader", widthStrategy: "fill-available", heightStrategy: "content-driven", emptyBehavior: "natural", allowNestedSurface: false },
          { regionId: "activeFilterSummary", widthStrategy: "fill-available", heightStrategy: "content-driven", emptyBehavior: "collapse", allowNestedSurface: false },
          { regionId: "results", widthStrategy: "fill-available", heightStrategy: "content-driven", emptyBehavior: "natural", allowNestedSurface: false }
        ]
      },
      perceptualHierarchy: {
        surfaceAssignments: [
          { regionId: "pageHeader", role: "canvas" },
          { regionId: "activeFilterSummary", role: "canvas" },
          { regionId: "results", role: "surface" }
        ]
      }
    },
    presenceDefaults: [
      { targetType: "region", targetId: "pageHeader", policy: "always", condition: null },
      { targetType: "region", targetId: "activeFilterSummary", policy: "conditional", condition: { signal: "activeFilters.count", operator: "gt", value: 0 } },
      { targetType: "region", targetId: "results", policy: "always", condition: null }
    ]
  };
}

function screenFixture() {
  return {
    screen: { id: "cases", category: "searchable-list" },
    visualDirection: { density: "compact" },
    visualHierarchy: {
      textRoleAssignments: [
        { elementId: "case-name", textRole: "bodyStrong" },
        { elementId: "case-status-value", textRole: "body" },
        { elementId: "case-reference-value", textRole: "metadata" }
      ],
      visualPriorityLadder: [
        { elementId: "case-name" },
        { elementId: "case-status-value" },
        { elementId: "case-reference-value" }
      ],
      semanticOutline: [
        { id: "case-name" },
        { id: "case-status-value" },
        { id: "case-reference-value" }
      ]
    },
    recipe: {
      id: "searchable-list",
      source: "recipes/searchable-list.recipe.json",
      regions: [
        { screenRegionId: "pageHeader" },
        { screenRegionId: "activeFilterSummary" },
        { screenRegionId: "results" }
      ]
    },
    componentMap: [
      { id: "case-status", component: "StatusBadge", catalogSource: "catalogs/data-display.json" },
      { id: "case-reference", component: "ReferenceValue", catalogSource: "catalogs/data-display.json" }
    ],
    semanticPresentation: {
      mode: "registry",
      assignments: [
        { componentUsageId: "case-status", semanticRole: "status" },
        {
          componentUsageId: "case-reference",
          semanticRole: "reusable-reference",
          referenceUtility: { mode: "copy", actionId: "copy-case-reference", rationale: "The case reference is reused outside this screen." }
        }
      ],
      rationale: "Status and case references use registered presentation families."
    },
    decisionSupport: {
      mode: "required",
      decisionQuestion: "Which case requires attention?",
      signals: [
        { id: "case-identity", role: "identity", renderTargetType: "element", renderTargetId: "case-name" },
        { id: "case-state", role: "state", renderTargetType: "component", renderTargetId: "case-status" }
      ],
      rationale: "Operators compare identity and current state before opening a case."
    },
    wayfinding: {
      mode: "back-link",
      parentRoute: "/cases",
      rationale: "The screen is exercised as a drill-down state in this evidence fixture."
    },
    states: [
      {
        id: "data",
        category: "data",
        enabledActions: ["open-case", "copy-case-reference"],
        disabledActions: [],
        recovery: []
      }
    ],
    actions: [
      { id: "open-case" },
      { id: "copy-case-reference" }
    ]
  };
}

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "phase5-theme-operational-"));
  write(path.join(root, "integrations/impeccable/craft-contract.schema.json"), fs.readFileSync(CRAFT_SCHEMA, "utf8"));
  write(path.join(root, "recipes/searchable-list.recipe.json"), recipeFixture());
  write(path.join(root, "catalogs/data-display.json"), {
    meta: { id: "data-display" },
    components: {
      StatusBadge: { id: "status-badge" },
      ReferenceValue: { id: "reference-value" }
    }
  });
  write(path.join(root, "docs/frontend/design-system/design-system.json"), {
    themes: { supported: ["light", "dark"], default: "dark" },
    visualGrammar: { perceptualPolicy: perceptualPolicy() }
  });
  return root;
}

function derive(root, screen = screenFixture(), suffix = "base") {
  const screenPath = path.join(root, `screens/${suffix}.json`);
  const craftPath = path.join(root, `.tmp/${suffix}-craft.json`);
  write(screenPath, screen);
  run(process.execPath, [ADAPTER, "derive-craft", "--screen-spec", screenPath, "--output", craftPath, "--root", root, "--policy", POLICY]);
  run(process.execPath, [ADAPTER, "verify-craft", "--craft-contract", craftPath, "--root", root, "--policy", POLICY]);
  return { screenPath, craftPath, craft: JSON.parse(fs.readFileSync(craftPath, "utf8")), screen };
}

function region(id, surfaceRole, surfaceLevel) {
  return {
    id,
    viewport: "wide",
    parentRegionId: null,
    surfaceRole,
    surfaceLevel,
    accentRole: null,
    borderRole: null,
    borderPurpose: null,
    containerBox: { x: 0, y: 0, width: 800, height: 100 },
    contentBox: { x: 0, y: 0, width: 800, height: 100 },
    contentOccupancy: 1,
    nestingDepth: 0,
    heightStrategyObserved: "content-driven",
    rendered: true,
    presenceSignal: id === "activeFilterSummary" ? "activeFilters.count" : null
  };
}

function element({ id, regionId = "results", componentUsageId = null, textRole, priority, semanticDataRole = null, presentationFamily = null, contrastRole, contrastRatio, semanticColorRole = null, colorSource = "neutral-token" }) {
  return {
    id,
    viewport: "wide",
    regionId,
    componentUsageId,
    semanticElement: "span",
    textRole,
    priority,
    semanticDataRole,
    presentationFamily,
    contrastRole,
    contrastRatio,
    semanticColorRole,
    colorSource,
    accentRole: null,
    box: { x: 20, y: 20, width: 180, height: 24 },
    containerBox: { x: 20, y: 20, width: 180, height: 24 },
    contentBox: { x: 20, y: 20, width: 180, height: 24 },
    computedStyle: { fontSize: "14px", fontWeight: "400", lineHeight: "20px", letterSpacing: "0px", color: "rgb(226, 232, 240)" },
    tokens: [],
    rendered: true,
    presenceSignal: null
  };
}

function interaction({ id, actionId, componentUsageId = null, purpose = "action" }) {
  return {
    id,
    viewport: "wide",
    targetType: "action",
    targetId: actionId,
    actionId,
    componentUsageId,
    purpose,
    semanticElement: "button",
    accessibleRole: "button",
    accessibleName: id,
    states: ["default", "hover", "focus-visible"],
    rendered: true,
    box: { x: 20, y: 60, width: 120, height: 40 },
    presenceSignal: null
  };
}

function evidenceFor(root, derived, stateId = "data") {
  const designPath = path.join(root, "docs/frontend/design-system/design-system.json");
  return {
    $schema: "../schemas/visual-composition-evidence.schema.json",
    meta: { screenId: "cases", stateId, capturedAt: "2026-08-14T16:00:00Z", runner: "playwright-skill" },
    contractHashes: {
      screenSpecSha256: sha256(derived.screenPath),
      designSystemSha256: sha256(designPath),
      compositionProofSha256: "c".repeat(64),
      craftContractSha256: sha256(derived.craftPath),
      contractSetSha256: derived.craft.contractSetSha256
    },
    theme: { id: "dark", scheme: "dark", separationModelObserved: "mixed", contextValidated: true },
    viewports: [{ id: "wide", width: 1440, height: 900 }],
    regions: [
      region("pageHeader", "canvas", 0),
      region("activeFilterSummary", "canvas", 0),
      region("results", "surface", 1)
    ],
    elements: [
      element({ id: "case-name", textRole: "bodyStrong", priority: "primary", contrastRole: "primary", contrastRatio: 12 }),
      element({ id: "case-status-value", componentUsageId: "case-status", textRole: "body", priority: "supporting", semanticDataRole: "status", presentationFamily: "StatusBadge", contrastRole: "secondary", contrastRatio: 8, semanticColorRole: "success", colorSource: "semantic-token" }),
      element({ id: "case-reference-value", componentUsageId: "case-reference", textRole: "metadata", priority: "contextual", semanticDataRole: "reusable-reference", presentationFamily: "ReferenceValue", contrastRole: "muted", contrastRatio: 5 })
    ],
    presenceSignals: [{ signal: "activeFilters.count", value: 1 }],
    interactions: [
      interaction({ id: "Open case", actionId: "open-case" }),
      interaction({ id: "Copy reference", actionId: "copy-case-reference", componentUsageId: "case-reference", purpose: "reference-utility" })
    ],
    wayfinding: { mode: "back-link", rendered: true, targetId: "back-to-cases", parentRoute: "/cases" },
    decisionSignals: [
      { id: "case-identity", viewport: "wide", targetType: "element", targetId: "case-name", rendered: true },
      { id: "case-state", viewport: "wide", targetType: "component", targetId: "case-status", rendered: true }
    ],
    relations: {
      readingOrder: ["case-name", "case-status-value", "case-reference-value"],
      alignment: [{ id: "case-left-keyline", status: "passed", evidence: "Rendered elements share the governed left keyline." }],
      proximity: [{ id: "case-related-content", status: "passed", evidence: "Related case content uses the compiled related-content gap." }],
      contrast: [{ id: "case-priority", status: "passed", evidence: "Primary, supporting and contextual roles remain distinguishable." }]
    }
  };
}

function runAudit(root, derived, evidence, suffix, expectedStatus = 0, expectedPattern = null) {
  const evidencePath = path.join(root, `.tmp/${suffix}-evidence.json`);
  write(evidencePath, evidence);
  const designPath = path.join(root, "docs/frontend/design-system/design-system.json");
  const result = run(process.execPath, [AUDITOR, derived.screenPath, designPath, derived.craftPath, evidencePath], ROOT, expectedStatus);
  if (expectedPattern) assert.match(`${result.stdout}\n${result.stderr}`, expectedPattern, `Expected audit finding ${expectedPattern}`);
  return result;
}

function mutateCase(root, derived, base, name, mutate, pattern) {
  const candidate = structuredClone(base);
  mutate(candidate);
  runAudit(root, derived, candidate, name, 1, pattern);
}

const root = setup();
const derived = derive(root);
assert.equal(derived.craft.dimensions.decisionSupport.status, "resolved");
assert.equal(derived.craft.dimensions.decisionSupport.decisionQuestion, "Which case requires attention?");
assert.equal(derived.craft.dimensions.interactionClarity.wayfinding.mode, "back-link");
assert.equal(derived.craft.dimensions.interactionClarity.wayfinding.parentRoute, "/cases");

const good = evidenceFor(root, derived);
runAudit(root, derived, good, "good");

// Perceptual/theme group.
mutateCase(root, derived, good, "theme-calibration", (value) => { value.theme.contextValidated = false; }, /THEME_CONTEXT_NOT_VALIDATED/);
mutateCase(root, derived, good, "surface-level", (value) => { value.regions.find((item) => item.id === "results").surfaceLevel = 0; }, /SURFACE_LEVEL_DRIFT/);
mutateCase(root, derived, good, "accent-role", (value) => { value.elements[0].accentRole = "decorative-emphasis"; }, /ACCENT_ROLE_VIOLATION/);
mutateCase(root, derived, good, "contrast-order", (value) => { value.elements.find((item) => item.id === "case-status-value").contrastRatio = 13; }, /TEXT_CONTRAST_ORDER/);
mutateCase(root, derived, good, "border-role", (value) => { const target = value.regions[0]; target.borderRole = "strong"; target.borderPurpose = "decoration"; }, /STRONG_BORDER_MISUSE/);
mutateCase(root, derived, good, "semantic-color", (value) => { value.elements.find((item) => item.id === "case-status-value").colorSource = "brand-accent"; }, /BRAND_AS_STATUS/);

// Spatial group.
mutateCase(root, derived, good, "occupancy", (value) => { value.regions.find((item) => item.id === "results").contentOccupancy = 0.4; }, /CONTENT_OCCUPANCY_DRIFT/);
mutateCase(root, derived, good, "nesting", (value) => { value.regions.find((item) => item.id === "results").nestingDepth = 3; }, /NESTING_DEPTH/);
mutateCase(root, derived, good, "height-strategy", (value) => { value.regions.find((item) => item.id === "results").heightStrategyObserved = "fill-available"; }, /HEIGHT_STRATEGY_DRIFT/);

// Operational group.
mutateCase(root, derived, good, "active-filter", (value) => { value.regions.find((item) => item.id === "activeFilterSummary").rendered = false; }, /ACTIVE_FILTER_VISIBILITY/);
mutateCase(root, derived, good, "action-target", (value) => { value.interactions = value.interactions.filter((item) => item.actionId !== "open-case"); }, /ENABLED_ACTION_NOT_RENDERED/);
mutateCase(root, derived, good, "wayfinding", (value) => { value.wayfinding.rendered = false; }, /WAYFINDING_MISSING/);
mutateCase(root, derived, good, "semantic-family", (value) => { value.elements.find((item) => item.componentUsageId === "case-status").presentationFamily = "GenericBadge"; }, /SEMANTIC_COMPONENT_DRIFT/);
mutateCase(root, derived, good, "reference-utility", (value) => { value.interactions = value.interactions.filter((item) => item.actionId !== "copy-case-reference"); }, /REFERENCE_UTILITY_NOT_RENDERED/);

// Decision support group.
mutateCase(root, derived, good, "decision-signal", (value) => { value.decisionSignals = value.decisionSignals.filter((item) => item.id !== "case-state"); }, /DECISION_SIGNAL_MISSING/);

// Empty-state actionability is tested with its own canonical screen state.
const actionableScreen = screenFixture();
actionableScreen.states.push({
  id: "empty-actionable",
  category: "empty",
  emptyKind: "actionable",
  enabledActions: [],
  disabledActions: [],
  recovery: []
});
const actionable = derive(root, actionableScreen, "empty-actionable");
const actionableEvidence = evidenceFor(root, actionable, "empty-actionable");
actionableEvidence.interactions = [];
runAudit(root, actionable, actionableEvidence, "empty-actionable", 1, /ACTIONABLE_EMPTY_WITHOUT_ACTION/);

const noResultsScreen = screenFixture();
noResultsScreen.states.push({
  id: "empty-no-results",
  category: "empty",
  emptyKind: "no-results",
  enabledActions: [],
  disabledActions: [],
  recovery: []
});
const noResults = derive(root, noResultsScreen, "empty-no-results");
const noResultsEvidence = evidenceFor(root, noResults, "empty-no-results");
noResultsEvidence.interactions = [];
runAudit(root, noResults, noResultsEvidence, "empty-no-results", 1, /NO_RESULTS_WITHOUT_RECOVERY/);

console.log("Phase 5 theme-aware + operational craft evidence tests passed.");
