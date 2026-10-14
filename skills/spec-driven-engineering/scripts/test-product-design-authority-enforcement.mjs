#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const capabilityRegistry = JSON.parse(fs.readFileSync(path.join(ROOT, "integrations/governance/enforcement-capabilities.json"), "utf8"));
const governancePolicy = JSON.parse(fs.readFileSync(path.join(ROOT, "prompts/spec-driven/governance-policy.json"), "utf8"));
const autonomyPolicy = JSON.parse(fs.readFileSync(path.join(ROOT, "prompts/spec-driven/autonomy-policy.json"), "utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "prompts/spec-driven/manifest.json"), "utf8"));
const promptContracts = {
  "prompts/spec-driven/05-design-readiness.prompt.md": [
    "product-design-authority:",
    "visualDirectionSelectedBy=agent",
    "Não transfira preferência visual para a pessoa",
    "product-design-readiness.json"
  ],
  "prompts/spec-driven/07-execute.prompt.md": [
    "product-design-consumption:",
    "product-design-readiness.json",
    "broad-build-authorization"
  ],
  "prompts/spec-driven/07.1-frontend-representative-gate.prompt.md": [
    "product-design-representative-order:",
    "product design -> browser evidence -> Impeccable critique -> UI Engineering Control Plane -> human truth/risk/build authorization",
    "aprovação estética vazia"
  ],
  "prompts/spec-driven/08-adversarial.prompt.md": [
    "product-design-adversarial:",
    "imitação de referência",
    "stock genérico",
    "AI slop",
    "preferência visual transferida à pessoa"
  ],
  "prompts/spec-driven/09-validate-evidence.prompt.md": [
    "product-design-evidence:",
    "frontend-product-design-authority",
    "frontend-open-visual-research",
    "frontend-asset-provenance",
    "frontend-human-asset-acquisition"
  ],
  "skills/spec-driven-engineering/references/frontend-overlay.md": [
    "Product Design Authority",
    "design-authority-bounded",
    "Styling Authority v2",
    "visualDirectionSelectedBy=agent"
  ]
};
const expected = {
  authority: { capability: "frontend-product-design-authority", rule: "RULE-FE-PDA-AUTHORITY-001" },
  research: { capability: "frontend-open-visual-research", rule: "RULE-FE-PDA-RESEARCH-001" },
  assets: { capability: "frontend-asset-provenance", rule: "RULE-FE-PDA-ASSET-001" },
  "human-scope": { capability: "frontend-human-asset-acquisition", rule: "RULE-FE-PDA-HUMAN-001" }
};
let assertions = 0;

const policy = manifest.frontendProductDesignPolicy;
assert.ok(policy, "manifest must register frontendProductDesignPolicy");
assert.equal(policy.controller, "integrations/frontend/product-design-control.mjs");
assert.equal(policy.schema, "integrations/frontend/product-design-control.schema.json");
assert.deepEqual(policy.subcommands, ["profile", "compile", "research", "decide", "request-asset", "ingest-asset", "gate", "verify"]);
assert.equal(policy.autonomyClass, "design-authority-bounded");
assertions += 4;

for (const [dimension, contract] of Object.entries(expected)) {
  // Promoted from shadow/advisory to primary/blocking: this was the only
  // non-blocking layer in the registry, which kept the visual-direction
  // decision (thesis, signature element, >=2 compared alternatives,
  // anti-generic-template proof) out of requiredEnforcements entirely.
  assert.equal(policy.rollout[dimension], "primary", `${dimension} must be primary`);
  assert.equal(policy.capabilities[dimension], contract.capability, `${dimension} capability mismatch`);
  const capability = capabilityRegistry.capabilities.find((item) => item.id === contract.capability);
  assert.ok(capability, `missing registered capability ${contract.capability}`);
  assert.equal(capability.entrypoint, "integrations/frontend/product-design-control.mjs");
  assert.equal(capability.failureSemantics.blocking, true, `${dimension} primary capability must block`);
  const rule = governancePolicy.rules.find((item) => item.id === contract.rule);
  assert.ok(rule, `missing governance rule ${contract.rule}`);
  assert.equal(rule.kind, "hard-invariant");
  assert.equal(rule.failure.severity, "blocking");
  assert.notEqual(rule.failure.route, "NONE", `${dimension} must route its failure somewhere actionable`);
  // enforcement.capability, not resolver: governance-control.mjs only collects
  // rule.enforcement.capability into requiredEnforcements.
  assert.equal(rule.enforcement.capability, contract.capability);
  assert.equal(rule.resolver, undefined, `${dimension} must not keep the advisory resolver shape`);
  assertions += 11;
}

assert.equal(new Set(Object.values(policy.capabilities)).size, 4, "rollout dimensions must promote independently");
const authorityClass = autonomyPolicy.decisionClasses.find((item) => item.id === "design-authority-bounded");
assert.equal(authorityClass?.defaultDisposition, "AUTONOMOUS_WITH_AUDIT");
assert.equal(authorityClass?.humanRequired, false);
assert.equal(autonomyPolicy.decisionClasses.find((item) => item.id === "brand-consequential")?.defaultDisposition, "HUMAN_REQUIRED");
assertions += 4;

for (const [relativePath, markers] of Object.entries(promptContracts)) {
  const source = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
  for (const marker of markers) {
    assert.ok(source.includes(marker), `${relativePath} must enforce product-design marker: ${marker}`);
    assertions += 1;
  }
}

for (const [script, args] of [
  ["integrations/governance/validate-governance-policy.mjs", ["--root", ROOT]],
  ["integrations/governance/validate-autonomy-policy.mjs", ["--root", ROOT]],
  ["skills/spec-driven-engineering/scripts/validate-workflow.mjs", ["--root", ROOT]]
]) {
  const result = spawnSync(process.execPath, [path.join(ROOT, script), ...args], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  assert.equal(result.status, 0, `${script} failed.\n${result.stdout}\n${result.stderr}`);
  assertions += 1;
}

console.log(`Product Design Authority enforcement contract passed (${assertions} assertions).`);
