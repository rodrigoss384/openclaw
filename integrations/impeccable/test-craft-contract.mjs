#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateJsonSchema } from "../../skills/spec-driven-engineering/scripts/lib/json-schema.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIR, "../..");
const ADAPTER = path.join(SCRIPT_DIR, "frontend-craft.mjs");
const POLICY = path.join(REPOSITORY_ROOT, "prompts/spec-driven/frontend-craft-policy.json");
const CRAFT_SCHEMA = path.join(SCRIPT_DIR, "craft-contract.schema.json");
const DESIGN_SYSTEM_SCHEMA = path.join(REPOSITORY_ROOT, "skills/frontend-product-builder/assets/schemas/design-system.schema.json");

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, typeof content === "string" ? content : `${JSON.stringify(content, null, 2)}\n`);
}

function run(root, args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [ADAPTER, ...args, "--root", root, "--policy", POLICY], {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  assert.equal(result.status, expectedStatus, `Unexpected exit code.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  return result;
}

function validPerceptualPolicy() {
  return {
    surfaceHierarchy: {
      levels: ["canvas", "surface", "surface-subtle", "surface-elevated"],
      separationModelByTheme: {
        light: "tonal-or-subtle-boundary",
        dark: "tonal-or-subtle-boundary"
      }
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
      "reusable-reference": { componentFamily: "ReferenceValue", consistency: "strict" }
    }
  };
}

function recipeFixture() {
  return {
    meta: { id: "searchable-list", name: "Searchable List" },
    content: { density: "compact" },
    regions: [
      { id: "pageHeader", required: true, cardinality: { minimum: 1, maximum: 1 } },
      { id: "results", required: false, cardinality: { minimum: 0, maximum: 1 } },
      { id: "pagination", required: false, cardinality: { minimum: 0, maximum: 1 } }
    ],
    craftDefaults: {
      spatialComposition: {
        maxVisualNestingDepth: 2,
        regionAssignments: [
          { regionId: "pageHeader", widthStrategy: "fill-available", heightStrategy: "content-driven", emptyBehavior: "natural", allowNestedSurface: false },
          { regionId: "results", widthStrategy: "fill-available", heightStrategy: "content-driven", emptyBehavior: "collapse", allowNestedSurface: false },
          { regionId: "pagination", widthStrategy: "fill-available", heightStrategy: "content-driven", emptyBehavior: "collapse", allowNestedSurface: false }
        ]
      },
      perceptualHierarchy: {
        surfaceAssignments: [
          { regionId: "pageHeader", role: "canvas" },
          { regionId: "results", role: "surface" },
          { regionId: "pagination", role: "canvas" }
        ]
      }
    },
    presenceDefaults: [
      { targetType: "region", targetId: "pageHeader", policy: "always", condition: null },
      { targetType: "region", targetId: "results", policy: "conditional", condition: { signal: "results.count", operator: "gt", value: 0 } },
      {
        targetType: "region",
        targetId: "pagination",
        policy: "conditional",
        condition: {
          any: [
            { signal: "pagination.totalPages", operator: "gt", value: 1 },
            { signal: "pagination.pageSizeControlRelevant", operator: "truthy" }
          ]
        }
      }
    ]
  };
}

const designSystemSchema = JSON.parse(fs.readFileSync(DESIGN_SYSTEM_SCHEMA, "utf8"));
assert.deepEqual(validateJsonSchema(validPerceptualPolicy(), designSystemSchema.$defs.perceptualPolicy), [], "perceptual policy fixture must satisfy the canonical design-system schema contract supported by the workflow validator");
const invalidPerceptualPolicy = structuredClone(validPerceptualPolicy());
delete invalidPerceptualPolicy.accentPolicy.allowedSemanticRoles;
assert.ok(validateJsonSchema(invalidPerceptualPolicy, designSystemSchema.$defs.perceptualPolicy).length > 0, "canonical design-system schema must reject incomplete perceptual policy");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "visual-craft-closure-phase2-"));
const screenPath = path.join(root, "docs/frontend/screens/cases/screen-spec.json");
const outputPath = path.join(root, ".tmp/craft-contract.json");
const recipePath = path.join(root, "recipes/searchable-list.recipe.json");
const designDirectionPath = path.join(root, "docs/frontend/design-direction.md");
const designSystemPath = path.join(root, "docs/frontend/design-system/design-system.json");
const catalogPath = path.join(root, "catalogs/data-display.json");

write(path.join(root, "integrations/impeccable/craft-contract.schema.json"), fs.readFileSync(CRAFT_SCHEMA, "utf8"));
write(
  designDirectionPath,
  [
    "# Design Direction",
    "",
    "Compact operational legal workspace.",
    "Prompt prose says every row should be clickable and pagination should always be visible, but those decisions are intentionally not canonical structured contracts."
  ].join("\n") + "\n"
);
write(designSystemPath, {
  themes: { supported: ["light", "dark"] },
  visualGrammar: { semanticTextStyles: {}, perceptualPolicy: validPerceptualPolicy() }
});
write(path.join(root, "docs/frontend/styling-authority.json"), { authority: "fixture" });
write(catalogPath, {
  meta: { id: "data-display", version: "1.0.0" },
  components: { DataTable: { id: "data-table" } }
});
write(recipePath, recipeFixture());
write(screenPath, {
  screen: { id: "cases", category: "searchable-list" },
  visualDirection: { source: "docs/frontend/design-direction.md", density: "compact" },
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
      { screenRegionId: "results" },
      { screenRegionId: "pagination" }
    ]
  },
  componentMap: [{ id: "results-table", component: "DataTable", catalogSource: "catalogs/data-display.json" }],
  actions: [{ id: "open-case" }]
});

run(root, ["verify-policy"]);
const derive = run(root, ["derive-craft", "--screen-spec", screenPath, "--output", outputPath]);
assert.match(derive.stdout, /visualFamilyId=operate-searchable-list/);
assert.match(derive.stdout, /contractSetSha256=[a-f0-9]{64}/);
assert.ok(fs.existsSync(outputPath));

let contract = JSON.parse(fs.readFileSync(outputPath, "utf8"));
assert.equal(contract.schemaVersion, "1.3.0");
assert.equal(contract.visualFamilyId, "operate-searchable-list");
assert.equal(contract.visitorMode, "operate");
assert.match(contract.contractSetSha256, /^[a-f0-9]{64}$/);

assert.equal(contract.dimensions.spatialComposition.status, "resolved");
assert.equal(contract.dimensions.spatialComposition.resolvedBy, "derived-relationship");
assert.equal(contract.dimensions.spatialComposition.densityMode, "compact");
assert.equal(contract.dimensions.spatialComposition.maxVisualNestingDepth, 2);
assert.equal(contract.dimensions.spatialComposition.regionAssignments.length, 3);

assert.equal(contract.dimensions.perceptualHierarchy.status, "partial");
assert.equal(contract.dimensions.perceptualHierarchy.resolvedBy, "derived-relationship");
assert.match(contract.dimensions.perceptualHierarchy.policyPointer, /#visualGrammar\.perceptualPolicy$/);
assert.equal(contract.dimensions.perceptualHierarchy.surfaceAssignments.length, 3);

assert.equal(contract.dimensions.interactionClarity.status, "partial");
assert.equal(contract.dimensions.interactionClarity.resolvedBy, "recipe-default");
assert.deepEqual(contract.dimensions.interactionClarity.actionAssignments, [], "free-form prompt/design prose must not invent row affordances");
const paginationPresence = contract.dimensions.interactionClarity.presenceAssignments.find((item) => item.targetId === "pagination");
assert.deepEqual(paginationPresence, {
  targetType: "region",
  targetId: "pagination",
  policy: "conditional",
  condition: {
    any: [
      { signal: "pagination.totalPages", operator: "gt", value: 1 },
      { signal: "pagination.pageSizeControlRelevant", operator: "truthy" }
    ]
  }
});
assert.equal(contract.dimensions.semanticPresentation.status, "unresolved");
assert.equal(contract.dimensions.decisionSupport.status, "unresolved");
assert.deepEqual(contract.unresolved.sort(), [
  "perceptualHierarchy",
  "semanticPresentation",
  "interactionClarity",
  "decisionSupport",
  "typographyCoherence"
].sort());
assert.ok(!contract.unresolved.includes("spatialComposition"));
assert.ok(contract.sources.some((source) => source.role === "screen-spec"));
assert.ok(contract.sources.some((source) => source.role === "recipe"));
assert.ok(contract.sources.some((source) => source.role === "craft-policy"));
assert.ok(contract.sources.some((source) => source.role === "design-system"));
assert.ok(contract.sources.some((source) => source.role === "component-catalog"));

run(root, ["verify-craft", "--craft-contract", outputPath]);

const customRecipe = recipeFixture();
customRecipe.meta.id = "operational-status-panel";
write(recipePath, customRecipe);
const customScreen = JSON.parse(fs.readFileSync(screenPath, "utf8"));
customScreen.screen.category = "custom";
customScreen.recipe.id = "operational-status-panel";
customScreen.visualDirection.visitorMode = "operate";
write(screenPath, customScreen);
run(root, ["derive-craft", "--screen-spec", screenPath, "--output", outputPath]);
let customContract = JSON.parse(fs.readFileSync(outputPath, "utf8"));
assert.equal(customContract.visitorMode, "operate");
assert.equal(customContract.visualFamilyId, "operate-operational-status-panel");

delete customScreen.visualDirection.visitorMode;
write(screenPath, customScreen);
const missingCustomVisitorMode = run(root, ["derive-craft", "--screen-spec", screenPath, "--output", outputPath], 1);
assert.match(missingCustomVisitorMode.stderr, /custom recipes must declare visualDirection\.visitorMode explicitly/);

write(recipePath, recipeFixture());
const mappedScreen = JSON.parse(fs.readFileSync(screenPath, "utf8"));
mappedScreen.screen.category = "searchable-list";
mappedScreen.recipe.id = "searchable-list";
mappedScreen.visualDirection.visitorMode = "persuade";
write(screenPath, mappedScreen);
const canonicalOverride = run(root, ["derive-craft", "--screen-spec", screenPath, "--output", outputPath], 1);
assert.match(canonicalOverride.stderr, /cannot override canonical policy mapping 'operate'/);

delete mappedScreen.visualDirection.visitorMode;
write(screenPath, mappedScreen);
run(root, ["derive-craft", "--screen-spec", screenPath, "--output", outputPath]);

contract.dimensions.interactionClarity.presenceAssignments.find((item) => item.targetId === "pagination").condition = {
  signal: "pagination.totalPages",
  operator: "gt",
  value: 0
};
write(outputPath, contract);
const presenceTamper = run(root, ["verify-craft", "--craft-contract", outputPath], 1);
assert.match(presenceTamper.stderr, /interactionClarity: derived contract does not match/);

run(root, ["derive-craft", "--screen-spec", screenPath, "--output", outputPath]);
contract = JSON.parse(fs.readFileSync(outputPath, "utf8"));
contract.contractSetSha256 = "0".repeat(64);
write(outputPath, contract);
const identityDrift = run(root, ["verify-craft", "--craft-contract", outputPath], 1);
assert.match(identityDrift.stderr, /contractSetSha256 does not match/);

run(root, ["derive-craft", "--screen-spec", screenPath, "--output", outputPath]);
write(catalogPath, {
  meta: { id: "data-display", version: "1.0.1" },
  components: { DataTable: { id: "data-table" } }
});
const catalogDrift = run(root, ["verify-craft", "--craft-contract", outputPath], 1);
assert.match(catalogDrift.stderr, /source hash drift for 'component-catalog-1'/);
write(catalogPath, {
  meta: { id: "data-display", version: "1.0.0" },
  components: { DataTable: { id: "data-table" } }
});

run(root, ["derive-craft", "--screen-spec", screenPath, "--output", outputPath]);
write(designDirectionPath, "# Design Direction\n\nChanged after derivation.\n");
const directionDrift = run(root, ["verify-craft", "--craft-contract", outputPath], 1);
assert.match(directionDrift.stderr, /source hash drift for 'visual-direction'/);
write(designDirectionPath, "# Design Direction\n\nRestored fixture.\n");

const badRequiredRecipe = recipeFixture();
const badPaginationRegion = badRequiredRecipe.regions.find((region) => region.id === "pagination");
badPaginationRegion.required = true;
badPaginationRegion.cardinality.minimum = 1;
write(recipePath, badRequiredRecipe);
const requiredConditional = run(root, ["derive-craft", "--screen-spec", screenPath, "--output", outputPath], 1);
assert.match(requiredConditional.stderr, /conditional region 'pagination' must declare required=false and cardinality\.minimum=0/);

const badOperatorRecipe = recipeFixture();
badOperatorRecipe.presenceDefaults.find((rule) => rule.targetId === "pagination").condition = {
  signal: "pagination.pageSizeControlRelevant",
  operator: "truthy",
  value: true
};
write(recipePath, badOperatorRecipe);
const valueOnTruthy = run(root, ["derive-craft", "--screen-spec", screenPath, "--output", outputPath], 1);
assert.match(valueOnTruthy.stderr, /operator 'truthy' must not declare value/);

const badSurfaceRecipe = recipeFixture();
badSurfaceRecipe.craftDefaults.perceptualHierarchy.surfaceAssignments.find((item) => item.regionId === "results").role = "invented-surface";
write(recipePath, badSurfaceRecipe);
const invalidSurface = run(root, ["derive-craft", "--screen-spec", screenPath, "--output", outputPath], 1);
assert.match(invalidSurface.stderr, /role 'invented-surface'.*not declared by design-system surfaceHierarchy\.levels/);

write(recipePath, recipeFixture());
const malformedDesignSystem = JSON.parse(fs.readFileSync(designSystemPath, "utf8"));
delete malformedDesignSystem.visualGrammar.perceptualPolicy.accentPolicy;
write(designSystemPath, malformedDesignSystem);
const malformedPolicy = run(root, ["derive-craft", "--screen-spec", screenPath, "--output", outputPath], 1);
assert.match(malformedPolicy.stderr, /perceptualPolicy is missing 'accentPolicy'/);

console.log("Derived craft contract Phase 2 structured recipe semantics tests passed.");
