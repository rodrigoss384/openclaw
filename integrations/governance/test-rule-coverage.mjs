#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../..");
const AUDITOR = path.join(SCRIPT_DIR, "audit-rule-coverage.mjs");
const POLICY_PATH = path.join(ROOT, "prompts/spec-driven/governance-policy.json");
const TEMP_DIR = path.join(SCRIPT_DIR, `.test-rule-coverage-${process.pid}`);
const baseline = JSON.parse(fs.readFileSync(POLICY_PATH, "utf8"));
let assertions = 0;

function ruleById(policy, id) {
  const rule = policy.rules.find((candidate) => candidate.id === id);
  assert.ok(rule, `Fixture rule '${id}' not found in governance registry.`);
  return rule;
}

function writePolicy(name, mutate = null) {
  const policy = structuredClone(baseline);
  if (mutate) mutate(policy);
  const filePath = path.join(TEMP_DIR, `${name}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(policy, null, 2)}\n`);
  return path.relative(ROOT, filePath).split(path.sep).join("/");
}

// A fixture that drops enforcement from a rule leaves that rule's capability
// orphaned, which the reverse-coverage audit rejects by design. When the
// fixture is only exercising rule-kind coverage, pair it with a registry
// narrowed to the capabilities the fixture still references, so the orphan
// direction stays a real check against the repository registry instead of
// silently absorbing fixture noise.
function writeRegistryFor(name, policyRef) {
  const policy = JSON.parse(fs.readFileSync(path.resolve(ROOT, policyRef), "utf8"));
  const referenced = new Set(policy.rules.map((rule) => rule.enforcement?.capability).filter(Boolean));
  const registry = JSON.parse(fs.readFileSync(path.join(SCRIPT_DIR, "enforcement-capabilities.json"), "utf8"));
  registry.capabilities = registry.capabilities.filter((capability) => referenced.has(capability.id));
  const filePath = path.join(TEMP_DIR, `${name}-capabilities.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(registry, null, 2)}\n`);
  return path.relative(ROOT, filePath).split(path.sep).join("/");
}

function execute(
  policyRef = "prompts/spec-driven/governance-policy.json",
  capabilitiesRef = "integrations/governance/enforcement-capabilities.json"
) {
  return spawnSync(
    process.execPath,
    [
      AUDITOR,
      "--root", ROOT,
      "--policy", policyRef,
      "--policy-schema", "integrations/governance/governance-policy.schema.json",
      "--capabilities", capabilitiesRef,
      "--capability-schema", "integrations/governance/enforcement-capabilities.schema.json"
    ],
    { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );
}

function expectRejected(label, mutate, expected) {
  const ref = writePolicy(label, mutate);
  const result = execute(ref);
  assert.notEqual(result.status, 0, `${label}: uncovered policy was accepted.\nSTDOUT:\n${result.stdout}`);
  assert.match(result.stderr, expected, `${label}: unexpected rejection.\nSTDERR:\n${result.stderr}`);
  assertions += 2;
}

fs.mkdirSync(TEMP_DIR, { recursive: true });

try {
  const expectedRuleCount = baseline.rules.length;
  const direct = execute();
  assert.equal(direct.status, 0, `Repository coverage audit failed.\nSTDOUT:\n${direct.stdout}\nSTDERR:\n${direct.stderr}`);
  assert.match(direct.stdout, new RegExp(`Governance rule coverage valid: ${expectedRuleCount}/${expectedRuleCount} rules covered`));
  assertions += 2;

  const allKindsRef = writePolicy("all-kinds-covered", (policy) => {
    const defaultRule = ruleById(policy, "RULE-SDE-PLACEHOLDER-001");
    defaultRule.kind = "deterministic-default";
    delete defaultRule.enforcement;
    defaultRule.resolver = { ref: "integrations/governance/governance-control.mjs" };

    const heuristicRule = ruleById(policy, "RULE-SDE-LOCK-001");
    heuristicRule.kind = "contextual-heuristic";
    delete heuristicRule.enforcement;
    heuristicRule.failure = { severity: "advisory", route: "NONE" };

    const consequentialRule = ruleById(policy, "RULE-FE-STYLING-001");
    consequentialRule.kind = "consequential-decision";
    delete consequentialRule.enforcement;
    consequentialRule.escalation = {
      humanRequired: true,
      reasonClasses: ["product-consequential"]
    };
  });
  const allKinds = execute(allKindsRef, writeRegistryFor("all-kinds-covered", allKindsRef));
  const expectedKindCounts = baseline.rules.reduce((counts, rule) => {
    counts[rule.kind] = (counts[rule.kind] ?? 0) + 1;
    return counts;
  }, {});
  expectedKindCounts["hard-invariant"] -= 3;
  expectedKindCounts["deterministic-default"] = (expectedKindCounts["deterministic-default"] ?? 0) + 1;
  expectedKindCounts["contextual-heuristic"] = (expectedKindCounts["contextual-heuristic"] ?? 0) + 1;
  expectedKindCounts["consequential-decision"] = (expectedKindCounts["consequential-decision"] ?? 0) + 1;
  assert.equal(allKinds.status, 0, `Covered mixed-kind policy failed.\nSTDOUT:\n${allKinds.stdout}\nSTDERR:\n${allKinds.stderr}`);
  assert.match(allKinds.stdout, new RegExp(`hard-invariant=${expectedKindCounts["hard-invariant"]}`));
  assert.match(allKinds.stdout, new RegExp(`deterministic-default=${expectedKindCounts["deterministic-default"]}`));
  assert.match(allKinds.stdout, new RegExp(`contextual-heuristic=${expectedKindCounts["contextual-heuristic"]}`));
  assert.match(allKinds.stdout, new RegExp(`consequential-decision=${expectedKindCounts["consequential-decision"]}`));
  assertions += 5;

  expectRejected("hard-without-enforcement", (policy) => {
    delete ruleById(policy, "RULE-SDE-PLACEHOLDER-001").enforcement;
  }, /hard-invariant requires enforcement/);

  expectRejected("hard-with-unknown-capability", (policy) => {
    ruleById(policy, "RULE-SDE-PLACEHOLDER-001").enforcement.capability = "missing-production-capability";
  }, /unknown enforcement capability/);

  expectRejected("default-without-resolver", (policy) => {
    const rule = ruleById(policy, "RULE-SDE-PLACEHOLDER-001");
    rule.kind = "deterministic-default";
    delete rule.enforcement;
  }, /deterministic-default requires a resolver/);

  expectRejected("consequential-without-escalation", (policy) => {
    const rule = ruleById(policy, "RULE-SDE-PLACEHOLDER-001");
    rule.kind = "consequential-decision";
    delete rule.enforcement;
  }, /consequential-decision requires explicit human escalation/);

  expectRejected("heuristic-cannot-block", (policy) => {
    const rule = ruleById(policy, "RULE-SDE-PLACEHOLDER-001");
    rule.kind = "contextual-heuristic";
    delete rule.enforcement;
  }, /contextual-heuristic may advise but cannot independently block/);

  // Reverse direction: a registered capability that no rule points at never
  // enters requiredEnforcements, so `enforce` skips it while prose claims it
  // runs. Rule->capability coverage alone cannot see this.
  expectRejected("capability-without-rule", (policy) => {
    policy.rules = policy.rules.filter((rule) => rule.id !== "RULE-FE-NAV-001");
  }, /frontend-navigation-capability-control: registered capability is referenced by no governance rule/);

  // Third direction: a schema-mode capability is reported by enforce as
  // not-executable and never counted as a failure, so it needs a CLI sibling
  // covering the same stage. RULE-BE-GATE-001/RULE-BE-ARCH-001 rely on
  // RULE-BE-STACK-001 running validate-backend-package.mjs -- the script that
  // validates that same schema -- at every stage they claim.
  expectRejected("schema-capability-without-cli-sibling", (policy) => {
    for (const ruleId of ["RULE-BE-STACK-001", "RULE-BE-LANG-001"]) {
      const rule = ruleById(policy, ruleId);
      rule.stageScopes = rule.stageScopes.filter((stage) => stage !== "adversarial");
    }
  }, /enforce reports as not-executable without failing\. Stage 'adversarial'/);

  console.log(`Governance rule coverage Phase 8D regression suite passed (${assertions} assertions).`);
} finally {
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
}
