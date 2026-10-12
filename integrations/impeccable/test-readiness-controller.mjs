#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { canonicalProductDesignDigest } from "../frontend/product-design-control.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIR, "../..");
const CONTROLLER = path.join(SCRIPT_DIR, "frontend-control.mjs");
const POLICY = path.join(REPOSITORY_ROOT, "prompts/spec-driven/frontend-craft-policy.json");
const CRAFT_SCHEMA = path.join(SCRIPT_DIR, "craft-contract.schema.json");
const READINESS_SCHEMA = path.join(SCRIPT_DIR, "frontend-readiness.schema.json");

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, typeof content === "string" ? content : `${JSON.stringify(content, null, 2)}\n`);
}

function hash(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function run(root, args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [CONTROLLER, ...args, "--root", root, "--policy", POLICY], {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  assert.equal(result.status, expectedStatus, `Unexpected exit code.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
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
      status: { componentFamily: "StatusBadge", consistency: "strict" }
    }
  };
}

function recipeFixture() {
  return {
    meta: { id: "searchable-list", name: "Searchable List", version: "1.1.0" },
    content: { density: "compact" },
    regions: [
      { id: "pageHeader", required: true, cardinality: { minimum: 1, maximum: 1 } },
      { id: "results", required: false, cardinality: { minimum: 0, maximum: 1 } }
    ],
    craftDefaults: {
      spatialComposition: {
        maxVisualNestingDepth: 2,
        regionAssignments: [
          { regionId: "pageHeader", widthStrategy: "fill-available", heightStrategy: "content-driven", emptyBehavior: "natural", allowNestedSurface: false },
          { regionId: "results", widthStrategy: "fill-available", heightStrategy: "content-driven", emptyBehavior: "collapse", allowNestedSurface: false }
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
      { targetType: "region", targetId: "results", policy: "conditional", condition: { signal: "results.count", operator: "gt", value: 0 } }
    ]
  };
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), "visual-craft-phase3-readiness-"));
const screenPath = path.join(root, "docs/frontend/screens/cases/screen-spec.json");
const designDirectionPath = path.join(root, "docs/frontend/design-direction.md");
const designSystemPath = path.join(root, "docs/frontend/design-system/design-system.json");
const stylingAuthorityPath = path.join(root, "docs/frontend/styling-authority.json");
const recipePath = path.join(root, "recipes/searchable-list.recipe.json");
const catalogPath = path.join(root, "catalogs/data-display.json");
const reportPath = path.join(root, ".tmp/frontend-readiness.json");
const craftPath = path.join(root, ".tmp/craft-contract.json");

write(path.join(root, "integrations/impeccable/craft-contract.schema.json"), fs.readFileSync(CRAFT_SCHEMA, "utf8"));
write(path.join(root, "integrations/impeccable/frontend-readiness.schema.json"), fs.readFileSync(READINESS_SCHEMA, "utf8"));
write(designDirectionPath, "# Design Direction\n\nCanonical baseline direction.\n");
write(designSystemPath, {
  themes: { supported: ["light", "dark"] },
  visualGrammar: { semanticTextStyles: {}, perceptualPolicy: perceptualPolicy() }
});
write(stylingAuthorityPath, { authority: "fixture" });
write(catalogPath, { meta: { id: "data-display", version: "1.0.0" }, components: { DataTable: { id: "data-table" } } });
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
      { screenRegionId: "results" }
    ]
  },
  componentMap: [{ id: "results-table", component: "DataTable", catalogSource: "catalogs/data-display.json" }],
  actions: [{ id: "open-case" }]
});

const canonicalFiles = [screenPath, designDirectionPath, designSystemPath, stylingAuthorityPath, recipePath, catalogPath];
const before = new Map(canonicalFiles.map((filePath) => [filePath, hash(filePath)]));
run(root, ["readiness", "--screen-spec", screenPath, "--output", reportPath, "--craft-output", craftPath, "--report-only", "--product-design-not-applicable", "craft-dimension fixture; product design is covered by its own assertions"]);
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));

assert.equal(report.schemaVersion, "1.0.0");
assert.equal(report.screenId, "cases");
assert.equal(report.visualFamilyId, "operate-searchable-list");
assert.equal(report.gate.status, "needs-resolution");
assert.deepEqual(report.gate.blockingDimensions, []);
assert.equal(report.relationships.length, 6);
assert.equal(report.relationships.find((item) => item.dimension === "spatialComposition").status, "resolved");
assert.ok(!report.shape.dimensions.includes("spatialComposition"), "resolved spatial composition must never be sent to shape");
assert.deepEqual(report.shape.dimensions.sort(), ["perceptualHierarchy", "typographyCoherence"].sort());
assert.equal(report.shape.allowed, true);
assert.equal(report.shape.required, true);

const productDesignPath = path.join(root, ".tmp/product-design-readiness.json");
const productDesignReadiness = {
  artifactKind: "product-design-readiness",
  schemaVersion: "1.0.0",
  subject: { project: "fixture", commit: "a".repeat(40) },
  briefDigest: "1".repeat(64), researchDigest: "2".repeat(64), decisionDigest: "3".repeat(64), assetDigests: [],
  policyDigest: "9".repeat(64), status: "passed", visualDirectionSelectedBy: "agent", blockingFindingIds: [],
  dependencyDigests: { brief: "1".repeat(64), research: "2".repeat(64), decision: "3".repeat(64), policy: "9".repeat(64), assets: "4".repeat(64) }
};
productDesignReadiness.semanticDigest = canonicalProductDesignDigest(productDesignReadiness);
write(productDesignPath, productDesignReadiness);
const productAwareReportPath = path.join(root, ".tmp/product-aware-readiness.json");
run(root, [
  "readiness", "--screen-spec", screenPath, "--output", productAwareReportPath,
  "--craft-output", path.join(root, ".tmp/product-aware-craft.json"),
  "--product-design-readiness", productDesignPath, "--report-only"
]);
const productAware = JSON.parse(fs.readFileSync(productAwareReportPath, "utf8"));
assert.equal(productAware.productDesign.status, "passed");
assert.equal(productAware.productDesign.required, true);
assert.deepEqual(productAware.gate.upstreamBlockers, []);

productDesignReadiness.status = "failed";
productDesignReadiness.blockingFindingIds = ["PDA-03"];
productDesignReadiness.semanticDigest = canonicalProductDesignDigest(productDesignReadiness);
write(productDesignPath, productDesignReadiness);
const productBlockedReportPath = path.join(root, ".tmp/product-blocked-readiness.json");
run(root, [
  "readiness", "--screen-spec", screenPath, "--output", productBlockedReportPath,
  "--craft-output", path.join(root, ".tmp/product-blocked-craft.json"),
  "--product-design-readiness", productDesignPath, "--report-only"
]);
const productBlocked = JSON.parse(fs.readFileSync(productBlockedReportPath, "utf8"));
assert.equal(productBlocked.gate.status, "blocked");
assert.equal(productBlocked.shape.allowed, false);
assert.ok(productBlocked.gate.upstreamBlockers.includes("product-design-readiness"));

for (const dimension of ["semanticPresentation", "interactionClarity", "decisionSupport"]) {
  const relationship = report.relationships.find((item) => item.dimension === dimension);
  assert.equal(relationship.status, "unresolved");
  assert.equal(relationship.providerEligible, false, `${dimension} must stay with its canonical owner`);
  assert.ok(!report.shape.dimensions.includes(dimension), `${dimension} must not leak into shape scope`);
}

assert.ok(report.nextActions.some((action) => action.type === "run-shape"));
assert.ok(report.nextActions.some((action) => action.type === "adopt-and-rederive"));
assert.ok(report.nextActions.some((action) => action.type === "resolve-canonical"));
run(root, ["readiness", "--screen-spec", screenPath, "--output", path.join(root, ".tmp/check-ready.json"), "--craft-output", path.join(root, ".tmp/check-ready-craft.json"), "--product-design-not-applicable", "craft-dimension fixture; product design is covered by its own assertions"], 2);

const missingReceiptPath = path.join(root, ".tmp/missing-product-design.json");
run(root, [
  "readiness", "--screen-spec", screenPath, "--output", missingReceiptPath,
  "--craft-output", path.join(root, ".tmp/missing-product-design-craft.json"),
  "--report-only"
]);
const missingReceipt = JSON.parse(fs.readFileSync(missingReceiptPath, "utf8"));
assert.equal(missingReceipt.productDesign.required, true, "Product Design Authority must be required without an explicit not-applicable declaration");
assert.equal(missingReceipt.shape.allowed, false, "a missing Product Design receipt must block provider shape by default");
assert.ok(missingReceipt.gate.upstreamBlockers.includes("product-design-readiness"));

for (const [filePath, digest] of before.entries()) {
  assert.equal(hash(filePath), digest, `readiness controller must not mutate canonical source ${filePath}`);
}

fs.unlinkSync(designSystemPath);
const blockedReportPath = path.join(root, ".tmp/blocked-readiness.json");
run(root, ["readiness", "--screen-spec", screenPath, "--output", blockedReportPath, "--craft-output", path.join(root, ".tmp/blocked-craft.json"), "--report-only", "--product-design-not-applicable", "craft-dimension fixture; product design is covered by its own assertions"]);
const blocked = JSON.parse(fs.readFileSync(blockedReportPath, "utf8"));
assert.equal(blocked.gate.status, "blocked");
assert.equal(blocked.shape.allowed, false, "missing canonical source must block provider shape");
assert.ok(blocked.gate.blockingDimensions.includes("perceptualHierarchy"));
assert.ok(blocked.gate.blockingDimensions.includes("typographyCoherence"));
write(designSystemPath, {
  themes: { supported: ["light", "dark"] },
  visualGrammar: { semanticTextStyles: {}, perceptualPolicy: perceptualPolicy() }
});

write(designDirectionPath, "# Design Direction\n\nCanonical baseline plus an explicitly adopted provider decision.\n");
const afterAdoptionPath = path.join(root, ".tmp/after-adoption.json");
run(root, [
  "readiness",
  "--screen-spec", screenPath,
  "--output", afterAdoptionPath,
  "--craft-output", path.join(root, ".tmp/after-adoption-craft.json"),
  "--after-adoption", reportPath,
  "--report-only",
  "--product-design-not-applicable", "craft-dimension fixture; product design is covered by its own assertions"
]);
const afterAdoption = JSON.parse(fs.readFileSync(afterAdoptionPath, "utf8"));
assert.notEqual(afterAdoption.contractSetSha256, report.contractSetSha256, "canonical adoption must change contract-set identity");
assert.equal(afterAdoption.shape.allowed, false, "provider shape must not loop when adopted decisions remain underived");
for (const dimension of report.shape.dimensions) {
  const relationship = afterAdoption.relationships.find((item) => item.dimension === dimension);
  assert.equal(relationship.status, "blocked");
  assert.match(relationship.rationale, /contract model cannot derive the adopted decision yet/i);
}

const resolvedDesignSystem = JSON.parse(fs.readFileSync(designSystemPath, "utf8"));
resolvedDesignSystem.visualGrammar.semanticTextStyles = {
  pageTitle: {
    familyToken: "tokens.semantic.font.family.interface",
    colorToken: "tokens.semantic.color.text.primary"
  }
};
resolvedDesignSystem.visualGrammar.perceptualPolicy.presentationRoles.results = {
  componentFamily: "DataTable",
  consistency: "strict"
};
write(designSystemPath, resolvedDesignSystem);

const resolvedCatalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
resolvedCatalog.components.Button = { id: "button" };
write(catalogPath, resolvedCatalog);

const resolvedScreen = JSON.parse(fs.readFileSync(screenPath, "utf8"));
resolvedScreen.visualHierarchy.visualPriorityLadder = [{
  elementId: "page-title",
  priority: "critical",
  visualRole: "pageTitle",
  signals: ["position", "weight"]
}];
resolvedScreen.componentMap.push({
  id: "open-case-button",
  regionId: "results",
  component: "Button",
  catalogSource: "catalogs/data-display.json",
  interactionOwner: "case navigation",
  states: ["default", "focus-visible", "disabled"]
});
resolvedScreen.actions = [{ id: "open-case", regionId: "results", owner: "case navigation" }];
resolvedScreen.semanticPresentation = {
  mode: "registry",
  assignments: [{ componentUsageId: "results-table", semanticRole: "results" }],
  rationale: "Results use the canonical DataTable presentation family."
};
resolvedScreen.decisionSupport = {
  mode: "not-applicable",
  rationale: "This fixture does not present a decision-support surface."
};
resolvedScreen.wayfinding = {
  mode: "not-applicable",
  parentRoute: null,
  rationale: "This fixture is a standalone route."
};
write(screenPath, resolvedScreen);

const resolvedReportPath = path.join(root, ".tmp/resolved-after-adoption.json");
run(root, [
  "readiness",
  "--screen-spec", screenPath,
  "--output", resolvedReportPath,
  "--craft-output", path.join(root, ".tmp/resolved-after-adoption-craft.json"),
  "--after-adoption", reportPath,
  "--product-design-not-applicable", "craft-dimension fixture; product design is covered by its own assertions"
]);
const resolvedAfterAdoption = JSON.parse(fs.readFileSync(resolvedReportPath, "utf8"));
assert.notEqual(resolvedAfterAdoption.contractSetSha256, report.contractSetSha256);
assert.equal(resolvedAfterAdoption.gate.status, "ready");
assert.deepEqual(resolvedAfterAdoption.gate.blockingDimensions, []);
assert.deepEqual(resolvedAfterAdoption.gate.unresolvedDimensions, []);
assert.equal(resolvedAfterAdoption.shape.allowed, false);
for (const dimension of ["perceptualHierarchy", "interactionClarity", "typographyCoherence"]) {
  const relationship = resolvedAfterAdoption.relationships.find((item) => item.dimension === dimension);
  assert.equal(relationship.status, "resolved", `${dimension} must derive from completed canonical contracts`);
}

console.log("Phase 3 frontend readiness controller tests passed.");
