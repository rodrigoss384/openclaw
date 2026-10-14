#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../..");
const ADAPTER = path.join(SCRIPT_DIR, "frontend-craft.mjs");
const POLICY = path.join(ROOT, "prompts/spec-driven/frontend-craft-policy.json");
const CRAFT_SCHEMA = path.join(SCRIPT_DIR, "craft-contract.schema.json");

function write(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`);
}

function run(root, args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [ADAPTER, ...args, "--root", root, "--policy", POLICY], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  assert.equal(result.status, expectedStatus, `Unexpected adapter exit code.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  return result;
}

function perceptualPolicy(presentationRoles) {
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
    presentationRoles
  };
}

function recipeFixture() {
  return {
    meta: { id: "searchable-list", name: "Searchable List", version: "1.1.0" },
    content: { density: "compact" },
    regions: [
      { id: "pageHeader", required: true, cardinality: { minimum: 1, maximum: 1 } },
      { id: "results", required: true, cardinality: { minimum: 1, maximum: 1 } }
    ],
    craftDefaults: {
      spatialComposition: {
        maxVisualNestingDepth: 2,
        regionAssignments: [
          { regionId: "pageHeader", widthStrategy: "fill-available", heightStrategy: "content-driven", emptyBehavior: "natural", allowNestedSurface: false },
          { regionId: "results", widthStrategy: "fill-available", heightStrategy: "content-driven", emptyBehavior: "natural", allowNestedSurface: false }
        ]
      },
      perceptualHierarchy: {
        surfaceAssignments: [
          { regionId: "pageHeader", role: "canvas" },
          { regionId: "results", role: "surface" }
        ]
      }
    },
    presenceDefaults: [
      { targetType: "region", targetId: "pageHeader", policy: "always", condition: null },
      { targetType: "region", targetId: "results", policy: "always", condition: null }
    ]
  };
}

function screenFixture({ semanticPresentation, component = "StatusBadge", semanticRole = "status" } = {}) {
  return {
    screen: { id: "cases", category: "searchable-list" },
    visualDirection: { density: "compact" },
    visualHierarchy: {
      textRoleAssignments: [{ elementId: "page-title", textRole: "pageTitle" }],
      visualPriorityLadder: [{ elementId: "page-title" }],
      semanticOutline: [{ id: "page-title" }]
    },
    recipe: {
      id: "searchable-list",
      source: "recipes/searchable-list.recipe.json",
      regions: [
        { screenRegionId: "pageHeader" },
        { screenRegionId: "results" }
      ]
    },
    componentMap: [
      {
        id: "case-status",
        component,
        catalogSource: "catalogs/data-display.json"
      }
    ],
    actions: [],
    ...(semanticPresentation !== undefined
      ? { semanticPresentation }
      : {
          semanticPresentation: {
            mode: "registry",
            assignments: [{ componentUsageId: "case-status", semanticRole }],
            rationale: "Case status uses the canonical status presentation family."
          }
        })
  };
}

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "phase4-semantic-presentation-"));
  write(path.join(root, "integrations/impeccable/craft-contract.schema.json"), fs.readFileSync(CRAFT_SCHEMA, "utf8"));
  write(path.join(root, "recipes/searchable-list.recipe.json"), recipeFixture());
  write(path.join(root, "catalogs/data-display.json"), {
    meta: { id: "data-display" },
    components: {
      StatusBadge: { id: "status-badge" },
      ClassificationBadge: { id: "classification-badge" },
      ReferenceValue: { id: "reference-value" }
    }
  });
  write(path.join(root, "docs/frontend/design-system/design-system.json"), {
    visualGrammar: {
      perceptualPolicy: perceptualPolicy({
        status: { componentFamily: "StatusBadge", consistency: "strict" },
        classification: { componentFamily: "ClassificationBadge", consistency: "strict" },
        "reusable-reference": { componentFamily: "ReferenceValue", consistency: "contextual" }
      })
    }
  });
  return root;
}

function derive(root, screen, suffix = "default", expectedStatus = 0) {
  const screenPath = path.join(root, `screens/${suffix}.json`);
  const craftPath = path.join(root, `.tmp/${suffix}-craft.json`);
  write(screenPath, screen);
  const result = run(root, ["derive-craft", "--screen-spec", screenPath, "--output", craftPath], expectedStatus);
  return { result, screenPath, craftPath, contract: expectedStatus === 0 ? JSON.parse(fs.readFileSync(craftPath, "utf8")) : null };
}

const root = setup();
const good = derive(root, screenFixture(), "good");
run(root, ["verify-craft", "--craft-contract", good.craftPath]);
assert.equal(good.contract.dimensions.semanticPresentation.status, "resolved");
assert.equal(good.contract.dimensions.semanticPresentation.resolvedBy, "derived-relationship");
assert.ok(!good.contract.unresolved.includes("semanticPresentation"));
assert.deepEqual(good.contract.dimensions.semanticPresentation.assignments, [
  {
    targetType: "component",
    targetId: "case-status",
    semanticRole: "status",
    presentationFamily: "StatusBadge",
    consistency: "strict"
  }
]);
assert.ok(good.contract.dimensions.semanticPresentation.sourceRefs.includes("screen-spec"));
assert.ok(good.contract.dimensions.semanticPresentation.sourceRefs.includes("design-system"));
assert.ok(good.contract.dimensions.semanticPresentation.sourceRefs.some((id) => id.startsWith("component-catalog-")));

const absent = derive(root, screenFixture({ semanticPresentation: undefined }), "missing-explicit-contract");
// screenFixture's default branch adds the registry; remove it explicitly for this case.
const absentScreen = JSON.parse(fs.readFileSync(absent.screenPath, "utf8"));
delete absentScreen.semanticPresentation;
write(absent.screenPath, absentScreen);
const absentCraft = path.join(root, ".tmp/missing-explicit-contract-2-craft.json");
run(root, ["derive-craft", "--screen-spec", absent.screenPath, "--output", absentCraft]);
const absentContract = JSON.parse(fs.readFileSync(absentCraft, "utf8"));
assert.equal(absentContract.dimensions.semanticPresentation.status, "unresolved");
assert.ok(absentContract.unresolved.includes("semanticPresentation"));

const notApplicable = derive(root, screenFixture({
  semanticPresentation: {
    mode: "not-applicable",
    assignments: [],
    rationale: "This bounded screen has no semantic data presentation role."
  }
}), "not-applicable");
assert.equal(notApplicable.contract.dimensions.semanticPresentation.status, "resolved");
assert.equal(notApplicable.contract.dimensions.semanticPresentation.resolvedBy, "screen-contract");
assert.deepEqual(notApplicable.contract.dimensions.semanticPresentation.assignments, []);

const mismatch = derive(root, screenFixture({ component: "GenericBadge" }), "family-mismatch", 1);
assert.match(`${mismatch.result.stdout}\n${mismatch.result.stderr}`, /same semantic role|component family|StatusBadge/i);

const unknownRole = derive(root, screenFixture({ semanticRole: "mystery-state" }), "unknown-role", 1);
assert.match(`${unknownRole.result.stdout}\n${unknownRole.result.stderr}`, /semantic role.*mystery-state|presentationRoles/i);

const duplicateScreen = screenFixture();
duplicateScreen.semanticPresentation.assignments.push({ componentUsageId: "case-status", semanticRole: "status" });
const duplicate = derive(root, duplicateScreen, "duplicate", 1);
assert.match(`${duplicate.result.stdout}\n${duplicate.result.stderr}`, /duplicate.*case-status/i);

const missingFamilyRoot = setup();
write(path.join(missingFamilyRoot, "catalogs/data-display.json"), {
  meta: { id: "data-display" },
  components: { GenericBadge: { id: "generic-badge" } }
});
const missingFamily = derive(missingFamilyRoot, screenFixture(), "missing-family", 1);
assert.match(`${missingFamily.result.stdout}\n${missingFamily.result.stderr}`, /StatusBadge.*catalog|component family.*catalog/i);

const driftRoot = setup();
const drift = derive(driftRoot, screenFixture(), "drift");
const designSystemPath = path.join(driftRoot, "docs/frontend/design-system/design-system.json");
const designSystem = JSON.parse(fs.readFileSync(designSystemPath, "utf8"));
designSystem.visualGrammar.perceptualPolicy.presentationRoles.status.componentFamily = "ClassificationBadge";
write(designSystemPath, designSystem);
const verifyDrift = run(driftRoot, ["verify-craft", "--craft-contract", drift.craftPath], 1);
assert.match(`${verifyDrift.stdout}\n${verifyDrift.stderr}`, /source hash drift|semanticPresentation.*projection|component family/i);

console.log("Phase 4 semantic presentation registry tests passed.");
