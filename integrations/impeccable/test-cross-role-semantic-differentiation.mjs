#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateSemanticDifferentiation } from "./semantic-differentiation.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../..");
const ADAPTER = path.join(SCRIPT_DIR, "frontend-craft.mjs");
const POLICY = path.join(ROOT, "prompts/spec-driven/frontend-craft-policy.json");
let assertions = 0;

function write(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function run(root, args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [ADAPTER, ...args, "--root", root, "--policy", POLICY], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  assert.equal(result.status, expectedStatus, `Unexpected exit code.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  assertions += 1;
  return result;
}

function signature({ variantRole, semanticColorRole, shapeRole, textRole }) {
  return { variantRole, semanticColorRole, shapeRole, textRole };
}

function perceptualPolicy(overrides = {}) {
  return {
    surfaceHierarchy: { levels: ["canvas", "surface"], separationModelByTheme: { light: "mixed", dark: "mixed" } },
    accentPolicy: { mode: "sparse", allowedSemanticRoles: ["primary-action"], unregisteredRole: "error" },
    semanticColorPolicy: { roles: ["success", "warning", "danger", "info", "neutral", "inactive", "progress"], brandAccentMayRepresentStatus: false },
    textContrastHierarchy: { order: ["primary", "secondary", "muted", "disabled"], accessibilityFloor: "WCAG-2.2-AA" },
    borderPolicy: { roles: ["subtle", "default", "strong", "focus", "error", "selection"], strongAllowedFor: ["focus", "error", "selection", "explicit-structure"] },
    themeCalibration: { mode: "per-theme-context-validation", reuseExactColorValuesAllowedWhenValidated: true },
    geometryAcrossThemes: { defaultBehavior: "stable", exceptionsRequireApproval: true },
    presentationRoles: {
      phase: {
        componentFamily: "PhaseBadge",
        consistency: "strict",
        presentationSignature: signature({ variantRole: "progress-step", semanticColorRole: "progress", shapeRole: "soft-square", textRole: "metadata" })
      },
      status: {
        componentFamily: "StatusBadge",
        consistency: "strict",
        presentationSignature: signature({ variantRole: "state-pill", semanticColorRole: "success", shapeRole: "pill", textRole: "label" })
      }
    },
    semanticDifferentiation: {
      roles: ["phase", "status"],
      minimumDistinctDimensions: 1,
      dimensions: ["variantRole", "semanticColorRole", "shapeRole", "textRole"],
      colorOnlyAllowed: false
    },
    ...overrides
  };
}

function recipeFixture() {
  return {
    meta: { id: "searchable-list", name: "Searchable List", version: "1.1.0" },
    content: { density: "compact" },
    regions: [{ id: "results", required: true, cardinality: { minimum: 1, maximum: 1 } }],
    craftDefaults: {
      spatialComposition: {
        maxVisualNestingDepth: 1,
        regionAssignments: [{ regionId: "results", widthStrategy: "fill-available", heightStrategy: "content-driven", emptyBehavior: "natural", allowNestedSurface: false }]
      },
      perceptualHierarchy: { surfaceAssignments: [{ regionId: "results", role: "surface" }] }
    },
    presenceDefaults: [{ targetType: "region", targetId: "results", policy: "always", condition: null }]
  };
}

function screenFixture() {
  return {
    screen: { id: "workflow-list", category: "searchable-list" },
    visualDirection: { density: "compact" },
    visualHierarchy: {
      textRoleAssignments: [{ elementId: "title", textRole: "pageTitle" }],
      visualPriorityLadder: [{ elementId: "title" }],
      semanticOutline: [{ id: "title" }]
    },
    recipe: { id: "searchable-list", source: "recipes/searchable-list.recipe.json", regions: [{ screenRegionId: "results" }] },
    componentMap: [
      { id: "workflow-phase", component: "PhaseBadge", catalogSource: "catalogs/data-display.json" },
      { id: "workflow-status", component: "StatusBadge", catalogSource: "catalogs/data-display.json" }
    ],
    semanticPresentation: {
      mode: "registry",
      assignments: [
        { componentUsageId: "workflow-phase", semanticRole: "phase" },
        { componentUsageId: "workflow-status", semanticRole: "status" }
      ],
      rationale: "Phase and status are distinct product concepts and use differentiated presentation signatures."
    },
    actions: []
  };
}

function setup(policy = perceptualPolicy()) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "phase10a-semantic-differentiation-"));
  write(path.join(root, "recipes/searchable-list.recipe.json"), recipeFixture());
  write(path.join(root, "catalogs/data-display.json"), {
    meta: { id: "data-display" },
    components: { PhaseBadge: { id: "phase-badge" }, StatusBadge: { id: "status-badge" } }
  });
  write(path.join(root, "docs/frontend/design-system/design-system.json"), { visualGrammar: { perceptualPolicy: policy } });
  return root;
}

function derive(root, screen = screenFixture(), suffix = "case", expectedStatus = 0) {
  const screenPath = path.join(root, `screens/${suffix}.json`);
  const craftPath = path.join(root, `.tmp/${suffix}-craft.json`);
  write(screenPath, screen);
  const result = run(root, ["derive-craft", "--screen-spec", screenPath, "--output", craftPath], expectedStatus);
  return { result, craftPath, craft: expectedStatus === 0 ? JSON.parse(fs.readFileSync(craftPath, "utf8")) : null };
}

const goodPolicy = perceptualPolicy();
assert.deepEqual(validateSemanticDifferentiation({ visualGrammar: { perceptualPolicy: goodPolicy } }), []);
assertions += 1;

const root = setup(goodPolicy);
const good = derive(root, screenFixture(), "good");
run(root, ["verify-craft", "--craft-contract", good.craftPath]);
assert.equal(good.craft.schemaVersion, "1.3.0");
assertions += 1;
const assignments = new Map(good.craft.dimensions.semanticPresentation.assignments.map((item) => [item.semanticRole, item]));
assert.deepEqual(assignments.get("phase").presentationSignature, goodPolicy.presentationRoles.phase.presentationSignature);
assert.deepEqual(assignments.get("status").presentationSignature, goodPolicy.presentationRoles.status.presentationSignature);
assertions += 2;

const sameSignature = perceptualPolicy();
sameSignature.presentationRoles.phase.presentationSignature = structuredClone(sameSignature.presentationRoles.status.presentationSignature);
const sameErrors = validateSemanticDifferentiation({ visualGrammar: { perceptualPolicy: sameSignature } });
assert.ok(sameErrors.some((error) => /differ in 0 configured dimensions/.test(error)));
assertions += 1;
const sameRoot = setup(sameSignature);
const sameResult = derive(sameRoot, screenFixture(), "same-signature", 1);
assert.match(`${sameResult.result.stdout}\n${sameResult.result.stderr}`, /differ in 0 configured dimensions/);
assertions += 1;

const colorOnly = perceptualPolicy();
colorOnly.presentationRoles.phase.presentationSignature = structuredClone(colorOnly.presentationRoles.status.presentationSignature);
colorOnly.presentationRoles.phase.presentationSignature.semanticColorRole = "progress";
const colorErrors = validateSemanticDifferentiation({ visualGrammar: { perceptualPolicy: colorOnly } });
assert.ok(colorErrors.some((error) => /color-only differentiation is forbidden/.test(error)));
assertions += 1;
const colorRoot = setup(colorOnly);
const colorResult = derive(colorRoot, screenFixture(), "color-only", 1);
assert.match(`${colorResult.result.stdout}\n${colorResult.result.stderr}`, /color-only differentiation is forbidden/);
assertions += 1;

const missingSignature = perceptualPolicy();
delete missingSignature.presentationRoles.phase.presentationSignature;
const missingErrors = validateSemanticDifferentiation({ visualGrammar: { perceptualPolicy: missingSignature } });
assert.ok(missingErrors.some((error) => /requires presentationSignature/.test(error)));
assertions += 1;

const driftRoot = setup(goodPolicy);
const drift = derive(driftRoot, screenFixture(), "craft-drift");
const driftCraft = JSON.parse(fs.readFileSync(drift.craftPath, "utf8"));
driftCraft.dimensions.semanticPresentation.assignments.find((item) => item.semanticRole === "phase").presentationSignature.shapeRole = "pill";
write(drift.craftPath, driftCraft);
const verifyDrift = run(driftRoot, ["verify-craft", "--craft-contract", drift.craftPath], 1);
assert.match(`${verifyDrift.stdout}\n${verifyDrift.stderr}`, /presentationSignature drifted/);
assertions += 1;

const sameRoleScreen = screenFixture();
sameRoleScreen.semanticPresentation.assignments[0].semanticRole = "status";
const sameRoleRoot = setup(goodPolicy);
const sameRole = derive(sameRoleRoot, sameRoleScreen, "same-role-family-inconsistency", 1);
assert.match(`${sameRole.result.stdout}\n${sameRole.result.stderr}`, /same semantic role.*same component family|requires 'StatusBadge'/i);
assertions += 1;

console.log(`Cross-role semantic differentiation Phase 10A regression suite passed (${assertions} assertions).`);
