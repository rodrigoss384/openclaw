#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { FINDING_CLASSES, routeFinding } from "./finding-router.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../..");
const ADAPTER = path.join(SCRIPT_DIR, "frontend-craft.mjs");
const POLICY_PATH = path.join(ROOT, "prompts/spec-driven/frontend-craft-policy.json");
const policy = JSON.parse(fs.readFileSync(POLICY_PATH, "utf8"));

const expectedClasses = [
  "spatial-density",
  "surface-layering",
  "surface-economy",
  "accent-overuse",
  "semantic-color",
  "semantic-presentation",
  "text-hierarchy",
  "interaction-affordance",
  "system-status-visibility",
  "control-presence",
  "empty-recovery",
  "wayfinding",
  "information-scent",
  "reference-utility",
  "responsive-composition",
  "content-clarity"
];

assert.deepEqual(FINDING_CLASSES, expectedClasses, "router taxonomy must match the V3 Phase 4 taxonomy exactly");
assert.deepEqual(Object.keys(policy.findingRouter.classes), expectedClasses, "policy must govern every taxonomy class exactly once and in canonical order");
assert.equal(policy.findingRouter.classification, "explicit-taxonomy-no-free-text-inference");

for (const findingClass of expectedClasses) {
  const definition = policy.findingRouter.classes[findingClass];
  const implementation = routeFinding({
    root: ROOT,
    policy,
    finding: {
      id: `implementation-${findingClass}`,
      class: findingClass,
      defectKind: "implementation",
      summary: `Implementation defect for ${findingClass}`,
      source: "objective-audit",
      severity: "p2"
    }
  });

  assert.equal(implementation.route.class, findingClass);
  assert.equal(implementation.route.owner, definition.implementationOwner);
  assert.equal(implementation.route.returnStage, "PATCH");
  assert.equal(implementation.route.repairStrategy, "targeted-implementation-repair");
  assert.deepEqual(implementation.route.affectedContracts, definition.affectedContracts);
  assert.deepEqual(implementation.route.revalidationSet, definition.revalidationSet);
  if (definition.providerCommand === null) {
    assert.equal(implementation.route.providerCommand, null, `${findingClass} must not invent a provider command`);
  } else {
    assert.equal(implementation.route.providerCommand.name, definition.providerCommand);
    const governedGroups = ["managed", "findingDriven", "explicitApproval", "strongExplicitApproval", "designSystemMaintenanceOnly"];
    assert.ok(governedGroups.includes(implementation.route.providerCommand.governance));
    assert.ok(!policy.commands.notCanonicalInManagedWorkflow.includes(implementation.route.providerCommand.name));
  }

  const contract = routeFinding({
    root: ROOT,
    policy,
    finding: {
      id: `contract-${findingClass}`,
      class: findingClass,
      defectKind: "contract",
      summary: `Contract defect for ${findingClass}`,
      source: "impeccable-critique",
      severity: "p1"
    }
  });

  assert.equal(contract.route.owner, definition.contractOwner);
  assert.equal(contract.route.returnStage, "DESIGN_READINESS");
  assert.equal(contract.route.repairStrategy, "canonical-contract-repair");
  assert.equal(contract.route.providerCommand, null, `${findingClass} contract defects must never be silently repaired by the provider`);
  assert.ok(contract.route.revalidationSet.includes("frontend-readiness"), `${findingClass} contract defects must re-enter readiness`);
  for (const revalidation of definition.revalidationSet) assert.ok(contract.route.revalidationSet.includes(revalidation));
}

const accent = routeFinding({
  root: ROOT,
  policy,
  finding: {
    id: "accent-too-dominant",
    class: "accent-overuse",
    defectKind: "implementation",
    summary: "Accent is used outside approved semantic roles.",
    source: "impeccable-critique"
  }
});
assert.equal(accent.route.providerCommand?.name, "quieter");
assert.equal(accent.route.providerCommand?.governance, "explicitApproval");
assert.equal(accent.route.providerCommand?.requiresExplicitApproval, true);

const semantic = routeFinding({
  root: ROOT,
  policy,
  finding: {
    id: "status-family-mismatch",
    class: "semantic-presentation",
    defectKind: "implementation",
    summary: "One status uses a different presentation family.",
    source: "objective-audit"
  }
});
assert.equal(semantic.route.providerCommand, null);
assert.ok(semantic.route.affectedContracts.includes("design-system"));
assert.ok(semantic.route.affectedContracts.includes("screen-specification"));
assert.ok(semantic.route.affectedContracts.includes("component-catalog"));

assert.throws(
  () => routeFinding({ root: ROOT, policy, finding: { id: "unknown-class", class: "visual-vibes", defectKind: "implementation", summary: "x", source: "manual-review" } }),
  /finding\.class must be one of the governed taxonomy classes/
);
assert.throws(
  () => routeFinding({ root: ROOT, policy, finding: { id: "bad-kind", class: "wayfinding", defectKind: "maybe", summary: "x", source: "manual-review" } }),
  /finding\.defectKind must be implementation or contract/
);

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "phase4-finding-router-"));
const findingPath = path.join(temp, "finding.json");
const outputPath = path.join(temp, "route.json");
fs.writeFileSync(findingPath, `${JSON.stringify({
  id: "responsive-breakage",
  class: "responsive-composition",
  defectKind: "implementation",
  summary: "Compact composition loses the approved priority order.",
  source: "impeccable-critique",
  target: "cases"
}, null, 2)}\n`);
const cli = spawnSync(process.execPath, [
  ADAPTER,
  "route-finding",
  "--root", ROOT,
  "--policy", POLICY_PATH,
  "--finding", findingPath,
  "--output", outputPath
], { cwd: ROOT, encoding: "utf8" });
assert.equal(cli.status, 0, `route-finding CLI failed:\n${cli.stdout}\n${cli.stderr}`);
assert.ok(fs.existsSync(outputPath));
const cliRoute = JSON.parse(fs.readFileSync(outputPath, "utf8"));
assert.equal(cliRoute.route.class, "responsive-composition");
assert.equal(cliRoute.route.providerCommand?.name, "adapt");
assert.equal(cliRoute.route.returnStage, "PATCH");

console.log("Phase 4 finding router tests passed for all 16 taxonomy classes.");
