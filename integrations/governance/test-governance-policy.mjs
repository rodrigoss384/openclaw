#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../..");
const VALIDATOR = path.join(SCRIPT_DIR, "validate-governance-policy.mjs");
const CAPABILITY_SUITE = path.join(SCRIPT_DIR, "test-enforcement-capabilities.mjs");
const POLICY_PATH = path.join(ROOT, "prompts/spec-driven/governance-policy.json");
const SCHEMA_PATH = "integrations/governance/governance-policy.schema.json";
const baseline = JSON.parse(fs.readFileSync(POLICY_PATH, "utf8"));
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "governance-policy-phase8-"));
let assertions = 0;

function rule(policy, id) {
  const found = policy.rules.find((item) => item.id === id);
  assert.ok(found, `Missing fixture rule ${id}`);
  return found;
}

function execute(policyPath = POLICY_PATH) {
  return spawnSync(
    process.execPath,
    [VALIDATOR, "--root", ROOT, "--policy", policyPath, "--schema", SCHEMA_PATH],
    { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );
}

function expectValid(label, policy = baseline) {
  const policyPath = path.join(tempRoot, `${label}.json`);
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  const result = execute(policyPath);
  assert.equal(result.status, 0, `${label}: expected valid policy.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  assertions += 1;
}

function expectRejected(label, mutate) {
  const policy = structuredClone(baseline);
  mutate(policy);
  const policyPath = path.join(tempRoot, `${label}.json`);
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  const result = execute(policyPath);
  assert.notEqual(result.status, 0, `${label}: invalid policy was accepted.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  assertions += 1;
}

try {
  const capabilityResult = spawnSync(process.execPath, [CAPABILITY_SUITE], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  assert.equal(
    capabilityResult.status,
    0,
    `Capability registry regression suite failed.\nSTDOUT:\n${capabilityResult.stdout}\nSTDERR:\n${capabilityResult.stderr}`
  );
  assertions += 1;

  expectValid("baseline");

  expectRejected("hard-rule-without-enforcement", (policy) => {
    delete rule(policy, "RULE-SDE-PLACEHOLDER-001").enforcement;
  });

  expectRejected("deterministic-default-without-resolver", (policy) => {
    const target = rule(policy, "RULE-SDE-PLACEHOLDER-001");
    target.kind = "deterministic-default";
    delete target.enforcement;
  });

  expectRejected("consequential-decision-without-escalation", (policy) => {
    const target = rule(policy, "RULE-SDE-PLACEHOLDER-001");
    target.kind = "consequential-decision";
    delete target.enforcement;
  });

  expectRejected("advisory-rule-cannot-block", (policy) => {
    const target = rule(policy, "RULE-SDE-PLACEHOLDER-001");
    target.kind = "contextual-heuristic";
    delete target.enforcement;
  });

  expectRejected("duplicate-rule-id", (policy) => {
    policy.rules.push(structuredClone(rule(policy, "RULE-SDE-PLACEHOLDER-001")));
  });

  expectRejected("unknown-authority", (policy) => {
    rule(policy, "RULE-SDE-PLACEHOLDER-001").authority = "unregistered-authority";
  });

  expectRejected("broken-rules-reference", (policy) => {
    rule(policy, "RULE-SDE-PLACEHOLDER-001").rulesReference = "rules.md#heading-that-does-not-exist";
  });

  expectRejected("unknown-capability", (policy) => {
    rule(policy, "RULE-SDE-PLACEHOLDER-001").enforcement.capability = "missing-capability";
  });

  expectRejected("capability-owner-mismatch", (policy) => {
    rule(policy, "RULE-SDE-PLACEHOLDER-001").authority = "frontend-product-builder";
  });

  expectRejected("capability-stage-mismatch", (policy) => {
    rule(policy, "RULE-SDE-LOCK-001").stageScopes = ["implementation"];
  });

  expectRejected("direct-path-enforcement-is-not-allowed", (policy) => {
    rule(policy, "RULE-SDE-PLACEHOLDER-001").enforcement.ref = "skills/spec-driven-engineering/scripts/validate-feature-package.mjs";
  });

  expectRejected("conditional-without-selector", (policy) => {
    rule(policy, "RULE-FE-STYLING-001").applicability = { mode: "conditional" };
  });

  expectRejected("always-with-conditional-selector", (policy) => {
    rule(policy, "RULE-SDE-PLACEHOLDER-001").applicability = { mode: "always", frontend: ["substantial"] };
  });

  expectRejected("admission-hard-rule-without-enforcement", (policy) => {
    delete rule(policy, "RULE-SDE-ADMISSION-001").enforcement;
  });

  const direct = execute();
  assert.equal(direct.status, 0, `Repository policy must validate directly.\n${direct.stdout}\n${direct.stderr}`);
  assertions += 1;

  console.log(`Governance policy regression suite passed (${assertions} assertions, including capability registry suite).`);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
