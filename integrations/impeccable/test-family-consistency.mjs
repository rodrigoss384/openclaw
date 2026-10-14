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
const FAMILY_AUDITOR = path.join(SCRIPT_DIR, "frontend-family-consistency.mjs");
const CRAFT_POLICY = path.join(ROOT, "prompts/spec-driven/frontend-craft-policy.json");
const CRAFT_POLICY_SCHEMA = path.join(SCRIPT_DIR, "frontend-craft-policy.schema.json");
const CRAFT_SCHEMA = path.join(SCRIPT_DIR, "craft-contract.schema.json");
const FINDING_ROUTE_SCHEMA = path.join(SCRIPT_DIR, "finding-route.schema.json");

function write(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`);
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function run(command, args, cwd = ROOT, expectedStatus = 0) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  assert.equal(
    result.status,
    expectedStatus,
    `Unexpected exit code.\nCOMMAND: ${command} ${args.join(" ")}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
  );
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

function recipeFixture(density = "compact") {
  return {
    meta: { id: "searchable-list", name: "Searchable List", version: "1.1.0" },
    content: { density },
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

function screenFixture(screenId, recipeSource = "recipes/searchable-list.recipe.json") {
  return {
    screen: { id: screenId, category: "searchable-list" },
    visualDirection: { density: "compact" },
    visualHierarchy: {
      textRoleAssignments: [
        { elementId: `${screenId}-name`, textRole: "bodyStrong" },
        { elementId: `${screenId}-status-value`, textRole: "body" },
        { elementId: `${screenId}-reference-value`, textRole: "metadata" }
      ],
      visualPriorityLadder: [
        { elementId: `${screenId}-name` },
        { elementId: `${screenId}-status-value` },
        { elementId: `${screenId}-reference-value` }
      ],
      semanticOutline: [
        { id: `${screenId}-name` },
        { id: `${screenId}-status-value` },
        { id: `${screenId}-reference-value` }
      ]
    },
    recipe: {
      id: "searchable-list",
      source: recipeSource,
      regions: [
        { screenRegionId: "pageHeader" },
        { screenRegionId: "activeFilterSummary" },
        { screenRegionId: "results" }
      ]
    },
    componentMap: [
      { id: `${screenId}-status`, component: "StatusBadge", catalogSource: "catalogs/data-display.json" },
      { id: `${screenId}-reference`, component: "ReferenceValue", catalogSource: "catalogs/data-display.json" }
    ],
    semanticPresentation: {
      mode: "registry",
      assignments: [
        { componentUsageId: `${screenId}-status`, semanticRole: "status" },
        {
          componentUsageId: `${screenId}-reference`,
          semanticRole: "reusable-reference",
          referenceUtility: {
            mode: "copy",
            actionId: `copy-${screenId}-reference`,
            rationale: "The reference is reused outside this screen."
          }
        }
      ],
      rationale: "Registered semantic presentation."
    },
    decisionSupport: {
      mode: "required",
      decisionQuestion: `Which ${screenId} requires attention?`,
      signals: [
        { id: `${screenId}-identity`, role: "identity", renderTargetType: "element", renderTargetId: `${screenId}-name` },
        { id: `${screenId}-state`, role: "state", renderTargetType: "component", renderTargetId: `${screenId}-status` }
      ],
      rationale: "Operators compare identity and state."
    },
    wayfinding: {
      mode: "back-link",
      parentRoute: `/${screenId}`,
      rationale: "Fixture wayfinding."
    },
    states: [
      {
        id: "data",
        category: "data",
        enabledActions: [`open-${screenId}`, `copy-${screenId}-reference`],
        disabledActions: [],
        recovery: []
      }
    ],
    actions: [
      { id: `open-${screenId}` },
      { id: `copy-${screenId}-reference` }
    ]
  };
}

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "phase7-family-consistency-"));
  write(path.join(root, "integrations/impeccable/frontend-craft-policy.schema.json"), fs.readFileSync(CRAFT_POLICY_SCHEMA, "utf8"));
  write(path.join(root, "integrations/impeccable/craft-contract.schema.json"), fs.readFileSync(CRAFT_SCHEMA, "utf8"));
  write(path.join(root, "integrations/impeccable/finding-route.schema.json"), fs.readFileSync(FINDING_ROUTE_SCHEMA, "utf8"));
  write(path.join(root, "prompts/spec-driven/frontend-craft-policy.json"), fs.readFileSync(CRAFT_POLICY, "utf8"));
  write(path.join(root, "recipes/searchable-list.recipe.json"), recipeFixture("compact"));
  const variantRecipe = recipeFixture("compact");
  variantRecipe.craftDefaults.spatialComposition.maxVisualNestingDepth = 3;
  write(path.join(root, "recipes/searchable-list-variant.recipe.json"), variantRecipe);
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

function derive(root, screenId, recipeSource = "recipes/searchable-list.recipe.json", suffix = screenId) {
  const screen = screenFixture(screenId, recipeSource);
  const screenPath = path.join(root, `screens/${suffix}.json`);
  const craftPath = path.join(root, `.tmp/${suffix}-craft.json`);
  write(screenPath, screen);
  run(process.execPath, [
    ADAPTER, "derive-craft",
    "--screen-spec", screenPath,
    "--output", craftPath,
    "--root", root,
    "--policy", CRAFT_POLICY
  ]);
  run(process.execPath, [
    ADAPTER, "verify-craft",
    "--craft-contract", craftPath,
    "--root", root,
    "--policy", CRAFT_POLICY
  ]);
  return {
    screenId,
    screenPath,
    craftPath,
    craft: JSON.parse(fs.readFileSync(craftPath, "utf8"))
  };
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

function element({ id, componentUsageId = null, textRole, priority, semanticDataRole = null, presentationFamily = null, contrastRole, contrastRatio, semanticColorRole = null, colorSource = "neutral-token" }) {
  return {
    id,
    viewport: "wide",
    regionId: "results",
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
    computedStyle: {
      fontSize: "14px",
      fontWeight: "400",
      lineHeight: "20px",
      letterSpacing: "0px",
      color: "rgb(226, 232, 240)"
    },
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

function evidenceFor(root, derived, themeId) {
  const screenId = derived.screenId;
  const designPath = path.join(root, "docs/frontend/design-system/design-system.json");
  return {
    $schema: "../schemas/visual-composition-evidence.schema.json",
    meta: {
      screenId,
      stateId: "data",
      capturedAt: "2026-08-14T17:00:00Z",
      runner: "playwright-skill"
    },
    contractHashes: {
      screenSpecSha256: sha256(derived.screenPath),
      designSystemSha256: sha256(designPath),
      compositionProofSha256: "c".repeat(64),
      craftContractSha256: sha256(derived.craftPath),
      contractSetSha256: derived.craft.contractSetSha256
    },
    theme: {
      id: themeId,
      scheme: themeId,
      separationModelObserved: "mixed",
      contextValidated: true
    },
    viewports: [{ id: "wide", width: 1440, height: 900 }],
    regions: [
      region("pageHeader", "canvas", 0),
      region("activeFilterSummary", "canvas", 0),
      region("results", "surface", 1)
    ],
    elements: [
      element({
        id: `${screenId}-name`,
        textRole: "bodyStrong",
        priority: "primary",
        contrastRole: "primary",
        contrastRatio: 12
      }),
      element({
        id: `${screenId}-status-value`,
        componentUsageId: `${screenId}-status`,
        textRole: "body",
        priority: "supporting",
        semanticDataRole: "status",
        presentationFamily: "StatusBadge",
        contrastRole: "secondary",
        contrastRatio: 8,
        semanticColorRole: "success",
        colorSource: "semantic-token"
      }),
      element({
        id: `${screenId}-reference-value`,
        componentUsageId: `${screenId}-reference`,
        textRole: "metadata",
        priority: "contextual",
        semanticDataRole: "reusable-reference",
        presentationFamily: "ReferenceValue",
        contrastRole: "muted",
        contrastRatio: 5
      })
    ],
    presenceSignals: [{ signal: "activeFilters.count", value: 1 }],
    interactions: [
      interaction({ id: `Open ${screenId}`, actionId: `open-${screenId}` }),
      interaction({
        id: `Copy ${screenId} reference`,
        actionId: `copy-${screenId}-reference`,
        componentUsageId: `${screenId}-reference`,
        purpose: "reference-utility"
      })
    ],
    wayfinding: {
      mode: "back-link",
      rendered: true,
      targetId: `back-to-${screenId}`,
      parentRoute: `/${screenId}`
    },
    decisionSignals: [
      {
        id: `${screenId}-identity`,
        viewport: "wide",
        targetType: "element",
        targetId: `${screenId}-name`,
        rendered: true
      },
      {
        id: `${screenId}-state`,
        viewport: "wide",
        targetType: "component",
        targetId: `${screenId}-status`,
        rendered: true
      }
    ],
    relations: {
      readingOrder: [
        `${screenId}-name`,
        `${screenId}-status-value`,
        `${screenId}-reference-value`
      ],
      alignment: [{ id: `${screenId}-left-keyline`, status: "passed", evidence: "Rendered family elements share the governed left keyline." }],
      proximity: [{ id: `${screenId}-related-content`, status: "passed", evidence: "Related family content uses the compiled proximity relationship." }],
      contrast: [{ id: `${screenId}-priority`, status: "passed", evidence: "Primary, supporting and contextual roles remain distinguishable." }]
    }
  };
}

function writeEvidence(root, derived, themeId, suffix = `${derived.screenId}-${themeId}`, mutate = null) {
  const evidence = evidenceFor(root, derived, themeId);
  if (mutate) mutate(evidence);
  const evidencePath = path.join(root, `evidence/${suffix}.json`);
  write(evidencePath, evidence);
  return evidencePath;
}

function sample(root, derived, evidencePath) {
  return {
    screenSpec: path.relative(root, derived.screenPath),
    craftContract: path.relative(root, derived.craftPath),
    evidence: path.relative(root, evidencePath)
  };
}

function writeManifest(root, visualFamilyId, samples, name) {
  const manifestPath = path.join(root, `manifests/${name}.json`);
  write(manifestPath, {
    $schema: "frontend-family-consistency-manifest.schema.json",
    schemaVersion: "1.0.0",
    visualFamilyId,
    designSystem: "docs/frontend/design-system/design-system.json",
    samples
  });
  return manifestPath;
}

function runFamily(root, manifestPath, name, expectedStatus = 0) {
  const reportPath = path.join(root, `reports/${name}.json`);
  run(process.execPath, [
    FAMILY_AUDITOR,
    "--root", root,
    "--manifest", manifestPath,
    "--output", reportPath,
    "--check"
  ], ROOT, expectedStatus);
  return JSON.parse(fs.readFileSync(reportPath, "utf8"));
}

const root = setup();
const cases = derive(root, "cases");
const matters = derive(root, "matters");
assert.equal(cases.craft.visualFamilyId, matters.craft.visualFamilyId);

const casesDark = writeEvidence(root, cases, "dark");
const casesLight = writeEvidence(root, cases, "light");
const mattersDark = writeEvidence(root, matters, "dark");
const mattersLight = writeEvidence(root, matters, "light");

const goodSamples = [
  sample(root, cases, casesDark),
  sample(root, cases, casesLight),
  sample(root, matters, mattersDark),
  sample(root, matters, mattersLight)
];

const goodManifest = writeManifest(root, cases.craft.visualFamilyId, goodSamples, "good");
const good = runFamily(root, goodManifest, "good");
assert.equal(good.status, "passed");
assert.equal(good.transition, "CONSISTENT");
assert.equal(good.findings.length, 0);
assert.equal(good.evidenceGaps.length, 0);
assert.equal(good.checks.crossTheme, "passed");
assert.equal(good.checks.crossScreen, "passed");

// Missing supported-theme evidence is an evidence capture problem, not an implementation/contract finding.
const missingManifest = writeManifest(root, cases.craft.visualFamilyId, goodSamples.filter((_, index) => index !== 3), "missing-theme");
const missing = runFamily(root, missingManifest, "missing-theme", 2);
assert.equal(missing.status, "blocked");
assert.equal(missing.transition, "CAPTURE_EVIDENCE");
assert.equal(missing.evidenceGaps.length, 1);
assert.equal(missing.evidenceGaps[0].missingTheme, "light");

// Each theme may pass Phase 5 independently while typography still drifts across themes.
const casesLightTypographyDrift = writeEvidence(root, cases, "light", "cases-light-typography-drift", (value) => {
  value.elements.find((item) => item.id === "cases-name").computedStyle.fontSize = "15px";
});
const typographyManifest = writeManifest(root, cases.craft.visualFamilyId, [
  sample(root, cases, casesDark),
  sample(root, cases, casesLightTypographyDrift),
  sample(root, matters, mattersDark),
  sample(root, matters, mattersLight)
], "typography-drift");
const typography = runFamily(root, typographyManifest, "typography-drift", 2);
assert.equal(typography.status, "failed");
assert.equal(typography.transition, "PATCH");
assert.ok(typography.findings.some((finding) =>
  finding.scope === "cross-theme" &&
  finding.class === "text-hierarchy" &&
  finding.defectKind === "implementation" &&
  finding.route.returnStage === "PATCH"
));

// Geometry may satisfy every per-screen contract yet still drift across themes.
const casesLightGeometryDrift = writeEvidence(root, cases, "light", "cases-light-geometry-drift", (value) => {
  const element = value.elements.find((item) => item.id === "cases-name");
  element.box.x += 6;
  element.containerBox.x += 6;
  element.contentBox.x += 6;
});
const geometryManifest = writeManifest(root, cases.craft.visualFamilyId, [
  sample(root, cases, casesDark),
  sample(root, cases, casesLightGeometryDrift),
  sample(root, matters, mattersDark),
  sample(root, matters, mattersLight)
], "geometry-drift");
const geometry = runFamily(root, geometryManifest, "geometry-drift", 2);
assert.equal(geometry.transition, "PATCH");
assert.ok(geometry.findings.some((finding) =>
  finding.scope === "cross-theme" &&
  finding.class === "spatial-density" &&
  finding.defectKind === "implementation"
));

// Two valid canonical recipe projections with the same recipe id but different nesting contracts
// are a contract-level family drift and must return to DESIGN_READINESS.
const mattersVariant = derive(root, "matters-variant", "recipes/searchable-list-variant.recipe.json", "matters-variant");
assert.equal(cases.craft.visualFamilyId, mattersVariant.craft.visualFamilyId);
const mattersVariantDark = writeEvidence(root, mattersVariant, "dark");
const mattersVariantLight = writeEvidence(root, mattersVariant, "light");
const contractManifest = writeManifest(root, cases.craft.visualFamilyId, [
  sample(root, cases, casesDark),
  sample(root, cases, casesLight),
  sample(root, mattersVariant, mattersVariantDark),
  sample(root, mattersVariant, mattersVariantLight)
], "contract-drift");
const contract = runFamily(root, contractManifest, "contract-drift", 2);
assert.equal(contract.status, "failed");
assert.equal(contract.transition, "DESIGN_READINESS");
assert.ok(contract.findings.some((finding) =>
  finding.scope === "cross-screen" &&
  finding.class === "surface-layering" &&
  finding.defectKind === "contract" &&
  finding.route.returnStage === "DESIGN_READINESS" &&
  finding.route.providerCommand === null
));

// Tampering with a derived craft contract blocks Phase 7 before family comparison.
const staleCraftPath = path.join(root, ".tmp/cases-stale-craft.json");
const staleCraft = structuredClone(cases.craft);
staleCraft.dimensions.spatialComposition.densityMode = "comfortable";
write(staleCraftPath, staleCraft);
const staleEvidence = evidenceFor(root, cases, "dark");
staleEvidence.contractHashes.craftContractSha256 = sha256(staleCraftPath);
const staleEvidencePath = path.join(root, "evidence/cases-stale.json");
write(staleEvidencePath, staleEvidence);
const staleManifest = writeManifest(root, cases.craft.visualFamilyId, [
  {
    screenSpec: path.relative(root, cases.screenPath),
    craftContract: path.relative(root, staleCraftPath),
    evidence: path.relative(root, staleEvidencePath)
  },
  sample(root, cases, casesLight)
], "stale-craft");
const stale = runFamily(root, staleManifest, "stale-craft", 2);
assert.equal(stale.status, "blocked");
assert.equal(stale.transition, "BLOCKED");
assert.equal(stale.checks.individualEvidence, "blocked");

console.log("Phase 7 cross-screen + cross-theme family consistency tests passed.");
