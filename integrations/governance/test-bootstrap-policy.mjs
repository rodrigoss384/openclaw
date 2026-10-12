#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../..");
const VALIDATOR = path.join(SCRIPT_DIR, "validate-bootstrap-policy.mjs");
const CONTROLLER = path.join(SCRIPT_DIR, "governance-control.mjs");
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ROOT, "prompts/spec-driven/manifest.json"), "utf8"));
const CURRENT_BOOTSTRAP = MANIFEST.contextBootstrap.governancePolicy;
const POLICY = JSON.parse(fs.readFileSync(path.join(ROOT, "prompts/spec-driven/governance-policy.json"), "utf8"));
const CAPABILITIES = JSON.parse(fs.readFileSync(path.join(ROOT, "integrations/governance/enforcement-capabilities.json"), "utf8"));
const TEMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "governance-bootstrap-phase8e1-"));
const RUNTIME_DIR = path.join(ROOT, "integrations/governance", `.test-bootstrap-policy-${process.pid}`);
let assertions = 0;

const EXPECTED_BINDINGS = [
  { promptId: "acceptance", stage: "acceptance" },
  { promptId: "behavior-tests", stage: "acceptance" },
  { promptId: "design-readiness", stage: "design-readiness" },
  { promptId: "test-plan-tasks", stage: "design-readiness" },
  { promptId: "execute", stage: "implementation" },
  { promptId: "frontend-representative-gate", stage: "frontend-representative" },
  { promptId: "backend-representative-gate", stage: "backend-representative" },
  { promptId: "adversarial", stage: "adversarial" },
  { promptId: "validate-evidence", stage: "evidence-release" }
];

const BASE_APPLICABILITY = {
  complexity: "large",
  criticality: "standard",
  frontend: "substantial",
  backend: "substantial",
  persistence: "not-applicable",
  "public-api": "new",
  auth: "not-applicable",
  tenancy: "not-applicable",
  concurrency: "not-applicable",
  migration: "not-applicable",
  "new-service-or-subsystem": "not-applicable",
  "material-operational-cost": "not-applicable",
  performance: "standard",
  accessibility: "required",
  "frontend-representative-gate": "required",
  "backend-representative-gate": "required",
  "browser-evidence": "hard-required",
  "contract-drift-check": "required",
  "interface-contract": "not-applicable",
  "interface-contract-kind": "none",
  "interface-contract-type": "none",
  "behavioral-ux": "not-applicable",
  "behavioral-ux-risk": "none",
  "outcome-evidence": "not-applicable"
};

function runValidator(root = ROOT) {
  return spawnSync(process.execPath, [VALIDATOR, "--root", root], { cwd: ROOT, encoding: "utf8" });
}

function copyFile(root, relativePath) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(ROOT, relativePath), target);
}

function makeFixture(label, mutate) {
  const root = path.join(TEMP_ROOT, label);
  fs.mkdirSync(path.join(root, "prompts"), { recursive: true });
  fs.cpSync(path.join(ROOT, "prompts/spec-driven"), path.join(root, "prompts/spec-driven"), { recursive: true });
  copyFile(root, "skills/spec-driven-engineering/SKILL.md");
  copyFile(root, "skills/spec-driven-engineering/references/context-bootstrap.md");
  copyFile(root, "rules.md");
  fs.mkdirSync(path.join(root, "integrations/governance"), { recursive: true });
  fs.writeFileSync(path.join(root, "integrations/governance/governance-control.mjs"), "// fixture bootstrap entrypoint\n");
  mutate?.(root);
  return root;
}

function expectRejected(label, mutate, expected) {
  const root = makeFixture(label, mutate);
  const result = runValidator(root);
  assert.notEqual(result.status, 0, `${label}: invalid bootstrap fixture was accepted.\n${result.stdout}\n${result.stderr}`);
  if (expected) assert.match(result.stderr, expected, `${label}: unexpected rejection.\n${result.stderr}`);
  assertions += expected ? 2 : 1;
}

function mutateJson(root, relativePath, mutate) {
  const file = path.join(root, relativePath);
  const value = JSON.parse(fs.readFileSync(file, "utf8"));
  mutate(value);
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function writeApplicability() {
  fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  const file = path.join(RUNTIME_DIR, "applicability.md");
  fs.writeFileSync(file, Object.entries(BASE_APPLICABILITY).map(([key, value]) => `${key}: ${value}`).join("\n") + "\n");
  return file;
}

try {
  const direct = runValidator();
  assert.equal(direct.status, 0, `Repository bootstrap contract must validate.\n${direct.stdout}\n${direct.stderr}`);
  assertions += 1;

  // Editorial coverage follows the executable lifecycle; execution itself is
  // exercised by test-prompt-lifecycle.mjs, not inferred from these fragments.
  for (const fragment of ["workflow-entry.mjs", "`advance`", "`delivery`", "stage-state.json"]) {
    expectRejected(`missing-lifecycle-${fragment.replaceAll(/[^a-z]/g, "")}`, (root) => {
      const file = path.join(root, "prompts/spec-driven/CONTEXT-BOOTSTRAP.md");
      fs.writeFileSync(file, fs.readFileSync(file, "utf8").replaceAll(fragment, "removed-lifecycle-binding"));
    }, /missing bootstrap policy fragment/);
  }

  const shadowFixture = makeFixture("shadow-valid", (root) => {
    mutateJson(root, "prompts/spec-driven/manifest.json", (manifest) => {
      manifest.contextBootstrap.governancePolicy.mode = "shadow";
      manifest.contextBootstrap.governancePolicy.rulesResolution = "preserved-full-read";
    });
  });
  const shadowResult = runValidator(shadowFixture);
  assert.equal(shadowResult.status, 0, `Shadow cutover contract must validate.\n${shadowResult.stderr}`);
  assertions += 1;

  const primaryFixture = makeFixture("primary-valid", (root) => {
    mutateJson(root, "prompts/spec-driven/manifest.json", (manifest) => {
      manifest.contextBootstrap.governancePolicy.mode = "primary";
      manifest.contextBootstrap.governancePolicy.rulesResolution = "policy-primary-registered-rules-rationale-fallback";
    });
  });
  const primaryResult = runValidator(primaryFixture);
  assert.equal(primaryResult.status, 0, `Primary cutover contract must validate.\n${primaryResult.stderr}`);
  assertions += 1;

  expectRejected("missing-governance-policy", (root) => {
    mutateJson(root, "prompts/spec-driven/manifest.json", (manifest) => {
      delete manifest.contextBootstrap.governancePolicy;
    });
  }, /governancePolicy is required/);

  expectRejected("wrong-mode-pairing", (root) => {
    mutateJson(root, "prompts/spec-driven/manifest.json", (manifest) => {
      manifest.contextBootstrap.governancePolicy.mode = "primary";
      manifest.contextBootstrap.governancePolicy.rulesResolution = "preserved-full-read";
    });
  }, /primary mode requires/);

  expectRejected("missing-bootstrap-boundary", (root) => {
    mutateJson(root, "prompts/spec-driven/manifest.json", (manifest) => {
      delete manifest.contextBootstrap.governancePolicy.bootstrap;
    });
  }, /governancePolicy\.bootstrap/);

  expectRejected("pre-app-full-read-regression", (root) => {
    mutateJson(root, "prompts/spec-driven/manifest.json", (manifest) => {
      manifest.contextBootstrap.governancePolicy.preApplicabilityRules = "policy-only";
    });
  }, /preApplicabilityRules must be full-read-required/);

  expectRejected("shared-rules-content-loading-regression", (root) => {
    mutateJson(root, "prompts/spec-driven/manifest.json", (manifest) => {
      manifest.sharedRules[0].contentLoading = "full-read-every-prompt";
    });
  }, /contentLoading must be governed-by-context-bootstrap/);

  expectRejected("legacy-shared-rules-load", (root) => {
    mutateJson(root, "prompts/spec-driven/manifest.json", (manifest) => {
      manifest.sharedRules[0].load = "required-every-prompt";
    });
  }, /engineering-rules\.load is obsolete/);

  expectRejected("wrong-stage-map", (root) => {
    mutateJson(root, "prompts/spec-driven/manifest.json", (manifest) => {
      manifest.contextBootstrap.governancePolicy.stageBindings[0].stage = "implementation";
    });
  }, /stageBindings diverges/);

  expectRejected("missing-policy-resolution", (root) => {
    const file = path.join(root, "prompts/spec-driven/03-acceptance.prompt.md");
    fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("policy-resolution:", "policy-resolution-removed:"));
  }, /policy-resolution:/);

  expectRejected("direct-resolve-bypass", (root) => {
    const file = path.join(root, "prompts/spec-driven/03-acceptance.prompt.md");
    fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("governance-control.mjs bootstrap", "governance-control.mjs resolve"));
  }, /bootstrap|bypasses the canonical bootstrap boundary/);

  expectRejected("wrong-prompt-stage", (root) => {
    const file = path.join(root, "prompts/spec-driven/07-execute.prompt.md");
    fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace('--stage "implementation"', '--stage "acceptance"'));
  }, /--stage/);

  expectRejected("unmapped-prompt-policy", (root) => {
    const file = path.join(root, "prompts/spec-driven/02-spec-assumptions.prompt.md");
    fs.appendFileSync(file, "\n- `policy-resolution:` must not run before applicability exists.\n");
  }, /not mapped to a canonical governance stage/);

  expectRejected("canonical-skill-full-read-regression", (root) => {
    const file = path.join(root, "skills/spec-driven-engineering/SKILL.md");
    const content = fs.readFileSync(file, "utf8")
      .replace("Path resolution is mandatory on every execution; full-content loading is governed by the canonical bootstrap policy, not by path resolution itself.", "Read all applicable repository `AGENTS.md` files and the canonical project rules. Missing or conflicting rules block the stage.");
    fs.writeFileSync(file, content);
  }, /obsolete full-rules bootstrap semantics|missing canonical bootstrap fragment/);

  expectRejected("canonical-reference-full-read-regression", (root) => {
    const file = path.join(root, "skills/spec-driven-engineering/references/context-bootstrap.md");
    fs.appendFileSync(file, "\nRead the resolved rules on every execution.\n");
  }, /obsolete full-rules bootstrap semantics/);

  expectRejected("rules-full-read-regression", (root) => {
    const file = path.join(root, "rules.md");
    fs.appendFileSync(file, "\nLeia as regras de engenharia em toda execução.\n");
  }, /obsolete full-rules bootstrap semantics/);

  const applicability = writeApplicability();
  const uniqueStages = [...new Set(EXPECTED_BINDINGS.map((binding) => binding.stage))];
  const capabilities = new Map(CAPABILITIES.capabilities.map((capability) => [capability.id, capability]));
  const rules = new Map(POLICY.rules.map((rule) => [rule.id, rule]));
  const expectedRulesResolution = CURRENT_BOOTSTRAP.mode === "shadow"
    ? "preserved-full-read"
    : "policy-primary-registered-rules-rationale-fallback";
  const expectedContentLoading = CURRENT_BOOTSTRAP.mode === "shadow"
    ? "full"
    : "rationale-and-admitted-legacy-only";

  for (const stage of uniqueStages) {
    const result = spawnSync(process.execPath, [
      CONTROLLER,
      "bootstrap",
      "--root", ROOT,
      "--stage", stage,
      "--feature", "bootstrap-phase8e1-fixture",
      "--applicability", applicability
    ], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    assert.equal(result.status, 0, `${stage}: bootstrap failed during integration test.\n${result.stderr}`);
    const effective = JSON.parse(result.stdout);
    assert.equal(effective.stage, stage);
    assert.equal(effective.canonical, false);
    assert.equal(effective.bootstrap.mode, CURRENT_BOOTSTRAP.mode);
    assert.equal(effective.bootstrap.primaryScope, "registered-rules-only");
    assert.equal(effective.bootstrap.rulesContentLoading, expectedContentLoading);
    assert.equal(effective.bootstrap.rulesResolution, expectedRulesResolution);
    assert.equal(effective.bootstrap.rulesAdmission.mode, "registry-first");
    assert.equal(effective.bootstrap.rulesAdmission.legacyBaselineOperational, true);
    assert.equal(effective.bootstrap.rulesAdmission.unregisteredAdditions, "non-operative");
    assert.equal(effective.bootstrap.rulesAdmission.rationaleOnlyOperational, false);
    assert.ok(["legacy-baseline", "registered-governance", "rationale-only"].includes(effective.bootstrap.rulesAdmission.latestAdmissionKind));
    assert.match(effective.bootstrap.rulesAdmission.latestRulesFileGitBlobSha, /^[a-f0-9]{40}$/);
    assert.equal(effective.bootstrap.humanGates, "unchanged");
    assert.equal(effective.bootstrap.rulesSource.ref, "rules.md");
    assert.match(effective.bootstrap.rulesSource.sha256, /^[a-f0-9]{64}$/);
    assert.match(effective.bootstrap.manifest.sha256, /^[a-f0-9]{64}$/);
    assert.ok(effective.hardRules.includes("RULE-SDE-ADMISSION-001"), `${stage}: rule admission invariant missing`);
    assert.ok(effective.hardRules.includes("RULE-SDE-PLACEHOLDER-001"), `${stage}: every-stage hard rule missing`);
    assertions += 18;

    for (const ruleId of effective.hardRules) {
      const rule = rules.get(ruleId);
      assert.ok(rule?.enforcement?.capability, `${stage}/${ruleId}: hard rule has no capability`);
      assert.ok(effective.requiredEnforcements.includes(rule.enforcement.capability), `${stage}/${ruleId}: capability missing from effective policy`);
      const capability = capabilities.get(rule.enforcement.capability);
      assert.ok(capability, `${stage}/${ruleId}: capability not registered`);
      assert.ok(capability.supportedStages.includes("every-stage") || capability.supportedStages.includes(stage), `${stage}/${ruleId}: capability does not support stage`);
      assertions += 4;
    }
  }

  console.log(`Governance bootstrap Phase 8E.1 regression suite passed (${assertions} assertions, rollout=${CURRENT_BOOTSTRAP.mode}).`);
} finally {
  fs.rmSync(TEMP_ROOT, { recursive: true, force: true });
  fs.rmSync(RUNTIME_DIR, { recursive: true, force: true });
}
