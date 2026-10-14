#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateJsonSchema } from "../../skills/spec-driven-engineering/scripts/lib/json-schema.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../..");
const ADAPTER = path.join(SCRIPT_DIR, "frontend-craft.mjs");
const POLICY = path.join(ROOT, "prompts/spec-driven/frontend-craft-policy.json");
const CRAFT_SCHEMA = path.join(SCRIPT_DIR, "craft-contract.schema.json");
const LAYOUT_SCHEMA_PATH = path.join(ROOT, "skills/frontend-product-builder/assets/schemas/layout-recipe.schema.json");
const RECIPES_DIR = path.join(ROOT, "skills/frontend-product-builder/assets/recipes");

const RECIPE_IDS = [
  "administration",
  "application-shell",
  "authentication",
  "dashboard",
  "entity-detail",
  "form-workflow",
  "review-approval",
  "searchable-list"
];

const EXPECTED_POLICIES = {
  "application-shell": {
    primaryNavigation: "always",
    globalHeader: "always",
    contentCanvas: "always",
    globalFeedback: "always"
  },
  authentication: {
    brandContext: "always",
    authenticationPanel: "always",
    securityFeedback: "conditional",
    alternativeAuthentication: "conditional",
    legalAndSupport: "conditional"
  },
  dashboard: {
    pageHeader: "always",
    criticalAttention: "conditional",
    globalFilters: "conditional",
    primaryMetrics: "always",
    analyticalContent: "conditional",
    actionQueue: "conditional"
  },
  "entity-detail": {
    breadcrumbs: "conditional",
    entityHeader: "always",
    criticalAttention: "conditional",
    sectionNavigation: "conditional",
    primaryContent: "always",
    contextualAside: "conditional",
    auditDetails: "conditional",
    entityActions: "conditional"
  },
  "form-workflow": {
    pageHeader: "always",
    workflowProgress: "conditional",
    formSummary: "conditional",
    formErrors: "conditional",
    formSections: "always",
    contextualHelp: "conditional",
    formActions: "always"
  },
  administration: {
    pageHeader: "always",
    administrationNavigation: "conditional",
    scopeSummary: "conditional",
    administrationContent: "always",
    sensitiveActions: "conditional",
    auditAndDiagnostics: "conditional"
  },
  "review-approval": {
    reviewHeader: "always",
    evidenceViewer: "always",
    evidenceNavigator: "conditional",
    criticalReviewContext: "always",
    proposalAndRecommendation: "always",
    decisionForm: "always",
    auditContext: "conditional"
  },
  "searchable-list": {
    pageHeader: "always",
    searchAndFilters: "always",
    activeFilterSummary: "conditional",
    bulkActions: "conditional",
    resultsSummary: "conditional",
    results: "conditional",
    pagination: "conditional",
    contextualDetails: "conditional"
  }
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function runAdapter(root, args) {
  const result = spawnSync(process.execPath, [ADAPTER, ...args, "--root", root, "--policy", POLICY], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  assert.equal(result.status, 0, `Adapter failed.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  return result;
}

function validPerceptualPolicy() {
  return {
    surfaceHierarchy: {
      levels: ["canvas", "surface", "surface-subtle", "surface-elevated"]
    },
    accentPolicy: {},
    semanticColorPolicy: {},
    textContrastHierarchy: {},
    borderPolicy: {},
    themeCalibration: {},
    geometryAcrossThemes: { defaultBehavior: "stable" },
    presentationRoles: {}
  };
}

const layoutSchema = readJson(LAYOUT_SCHEMA_PATH);
const recipes = new Map();

for (const id of RECIPE_IDS) {
  const filePath = path.join(RECIPES_DIR, `${id}.recipe.json`);
  const recipe = readJson(filePath);
  recipes.set(id, recipe);

  assert.equal(recipe.meta.id, id);
  assert.equal(recipe.meta.version, "1.1.0", `${id}: Phase 2B recipes must be version 1.1.0`);
  assert.deepEqual(validateJsonSchema(recipe, layoutSchema), [], `${id}: recipe must satisfy layout-recipe schema`);

  const regionIds = recipe.regions.map((region) => region.id);
  const spatial = recipe.craftDefaults?.spatialComposition;
  assert.ok(spatial, `${id}: spatial craft defaults are required after Phase 2B rollout`);
  assert.ok(Number.isInteger(spatial.maxVisualNestingDepth), `${id}: maxVisualNestingDepth must be explicit`);
  assert.equal(spatial.regionAssignments.length, regionIds.length, `${id}: every recipe region needs explicit geometry`);
  assert.deepEqual(new Set(spatial.regionAssignments.map((item) => item.regionId)), new Set(regionIds), `${id}: spatial defaults must cover exactly the recipe regions`);

  const presence = recipe.presenceDefaults || [];
  assert.equal(presence.length, regionIds.length, `${id}: every recipe region needs explicit presence semantics`);
  assert.deepEqual(new Set(presence.map((item) => item.targetId)), new Set(regionIds), `${id}: presence defaults must cover exactly the recipe regions`);

  const expected = EXPECTED_POLICIES[id];
  assert.ok(expected, `${id}: missing regression expectation`);
  for (const rule of presence) {
    const region = recipe.regions.find((item) => item.id === rule.targetId);
    assert.ok(region, `${id}: presence rule references unknown region ${rule.targetId}`);
    assert.equal(rule.targetType, "region");
    assert.equal(rule.policy, expected[rule.targetId], `${id}.${rule.targetId}: unexpected presence policy`);
    if (rule.policy === "always") {
      assert.equal(rule.condition, null, `${id}.${rule.targetId}: always must not carry a condition`);
      assert.equal(region.required, true, `${id}.${rule.targetId}: always requires required=true`);
      assert.ok(region.cardinality.minimum >= 1, `${id}.${rule.targetId}: always requires minimum >= 1`);
    } else if (rule.policy === "conditional") {
      assert.ok(rule.condition, `${id}.${rule.targetId}: conditional requires a typed condition`);
      assert.equal(region.required, false, `${id}.${rule.targetId}: conditional requires required=false`);
      assert.equal(region.cardinality.minimum, 0, `${id}.${rule.targetId}: conditional requires minimum=0`);
    }
  }
}

assert.deepEqual(
  recipes.get("administration").presenceDefaults.find((item) => item.targetId === "administrationNavigation").condition,
  { signal: "administration.capabilities.count", operator: "gt", value: 1 },
  "administration navigation must collapse when only one capability exists"
);
assert.equal(recipes.get("administration").regions.find((item) => item.id === "administrationNavigation").required, false);
assert.equal(recipes.get("administration").regions.find((item) => item.id === "administrationNavigation").cardinality.minimum, 0);

assert.equal(recipes.get("application-shell").presenceDefaults.find((item) => item.targetId === "globalFeedback").policy, "always", "global feedback infrastructure remains structurally mounted even when no overlay is visible");
assert.equal(recipes.get("dashboard").presenceDefaults.find((item) => item.targetId === "primaryMetrics").policy, "always", "dashboard primary metrics retain a region for honest empty/unavailable states");
assert.equal(recipes.get("review-approval").presenceDefaults.find((item) => item.targetId === "evidenceViewer").policy, "always", "evidence viewer remains present to render unavailable evidence honestly");
assert.equal(recipes.get("review-approval").presenceDefaults.find((item) => item.targetId === "proposalAndRecommendation").policy, "always", "proposal region remains present to render a missing recommendation honestly");
assert.equal(recipes.get("form-workflow").presenceDefaults.find((item) => item.targetId === "workflowProgress").condition.value, 1, "single-stage forms must not render progress chrome");
assert.equal(recipes.get("entity-detail").presenceDefaults.find((item) => item.targetId === "sectionNavigation").condition.value, 1, "single-section details must not render section navigation");
assert.equal(recipes.get("review-approval").presenceDefaults.find((item) => item.targetId === "evidenceNavigator").condition.value, 1, "single-evidence reviews must not render evidence navigation");

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "recipe-family-phase2b-"));
fs.mkdirSync(path.join(tempRoot, "integrations/impeccable"), { recursive: true });
fs.copyFileSync(CRAFT_SCHEMA, path.join(tempRoot, "integrations/impeccable/craft-contract.schema.json"));
writeJson(path.join(tempRoot, "docs/frontend/design-system/design-system.json"), {
  visualGrammar: { perceptualPolicy: validPerceptualPolicy() }
});

for (const id of RECIPE_IDS) {
  const recipe = recipes.get(id);
  const recipeTarget = path.join(tempRoot, "recipes", `${id}.recipe.json`);
  writeJson(recipeTarget, recipe);
  const screenId = `phase2b-${id}`;
  const screenPath = path.join(tempRoot, "screens", `${screenId}.json`);
  const outputPath = path.join(tempRoot, "contracts", `${screenId}.json`);
  writeJson(screenPath, {
    screen: { id: screenId, category: recipe.meta.category },
    recipe: {
      id,
      source: `recipes/${id}.recipe.json`,
      regions: recipe.regions.map((region) => ({ screenRegionId: region.id }))
    },
    componentMap: [],
    actions: []
  });

  runAdapter(tempRoot, ["derive-craft", "--screen-spec", screenPath, "--output", outputPath]);
  const contract = readJson(outputPath);
  assert.equal(contract.schemaVersion, "1.3.0", `${id}: craft contract schema version`);
  assert.equal(contract.dimensions.spatialComposition.status, "resolved", `${id}: all selected recipe geometry must resolve spatial composition`);
  assert.equal(contract.dimensions.spatialComposition.regionAssignments.length, recipe.regions.length, `${id}: all selected regions must project geometry`);
  assert.equal(contract.dimensions.interactionClarity.status, "partial", `${id}: typed presence resolves only the presence part of interaction clarity`);
  assert.equal(contract.dimensions.interactionClarity.presenceAssignments.length, recipe.regions.length, `${id}: every selected region must project presence semantics`);
  runAdapter(tempRoot, ["verify-craft", "--craft-contract", outputPath]);
}

console.log(`Phase 2B recipe family rollout passed for ${RECIPE_IDS.length} recipe families.`);
