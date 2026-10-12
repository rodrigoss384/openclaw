#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../..");
const VALIDATOR = path.join(SCRIPT_DIR, "validate-autonomy-policy.mjs");
const TEMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "autonomy-policy-"));
const POLICY_REF = "prompts/spec-driven/autonomy-policy.json";
const SCHEMA_REF = "integrations/governance/autonomy-policy.schema.json";
let assertions = 0;

function copy(relativePath) {
  const target = path.join(TEMP_ROOT, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(ROOT, relativePath), target);
}

function resetFixture() {
  fs.rmSync(TEMP_ROOT, { recursive: true, force: true });
  fs.mkdirSync(TEMP_ROOT, { recursive: true });
  for (const ref of [
    POLICY_REF,
    SCHEMA_REF,
    "prompts/spec-driven/governance-policy.json",
    "prompts/spec-driven/manifest.json",
    "integrations/governance/governance-control.mjs",
    "integrations/governance/autonomy-decision.schema.json"
  ]) copy(ref);
}

function readPolicy() {
  return JSON.parse(fs.readFileSync(path.join(TEMP_ROOT, POLICY_REF), "utf8"));
}

function writePolicy(policy) {
  fs.writeFileSync(path.join(TEMP_ROOT, POLICY_REF), `${JSON.stringify(policy, null, 2)}\n`);
}

function byId(policy, id) {
  const value = policy.decisionClasses.find((item) => item.id === id);
  assert.ok(value, `fixture missing decision class ${id}`);
  return value;
}

function execute() {
  return spawnSync(process.execPath, [
    VALIDATOR,
    "--root", TEMP_ROOT,
    "--policy", POLICY_REF,
    "--schema", SCHEMA_REF
  ], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function expectAccepted(label) {
  const result = execute();
  assert.equal(result.status, 0, `${label}: expected accepted policy.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  assertions += 1;
}

function expectRejected(label, mutate, expected) {
  resetFixture();
  const policy = readPolicy();
  mutate(policy);
  writePolicy(policy);
  const result = execute();
  assert.notEqual(result.status, 0, `${label}: invalid policy was accepted.\n${result.stdout}`);
  assert.match(result.stderr, expected, `${label}: unexpected rejection.\n${result.stderr}`);
  assertions += 2;
}

try {
  resetFixture();
  const baseline = execute();
  assert.equal(baseline.status, 0, `Repository autonomy policy failed.\nSTDOUT:\n${baseline.stdout}\nSTDERR:\n${baseline.stderr}`);
  assert.match(baseline.stdout, /Autonomy policy valid: 13 decision classes, 4 dispositions/);
  assert.match(baseline.stdout, /SAFE_AUTONOMOUS=1/);
  assert.match(baseline.stdout, /AUTONOMOUS_WITH_AUDIT=3/);
  assert.match(baseline.stdout, /HUMAN_REQUIRED=8/);
  assert.match(baseline.stdout, /BLOCKED=1/);
  assert.match(baseline.stdout, /Runtime consumption: controller=integrations\/governance\/governance-control\.mjs/);
  assertions += 7;

  expectRejected("missing-class", (policy) => {
    policy.decisionClasses = policy.decisionClasses.filter((item) => item.id !== "brand-consequential");
  }, /schema:|Missing decision class 'brand-consequential'/);

  expectRejected("duplicate-disposition", (policy) => {
    policy.dispositions[3].id = "HUMAN_REQUIRED";
  }, /Duplicate disposition 'HUMAN_REQUIRED'|Missing disposition 'BLOCKED'/);

  expectRejected("autonomous-human-authority", (policy) => {
    byId(policy, "reversible-contract-bounded").decisionAuthority = "human";
  }, /autonomous class authority must be agent/);

  expectRejected("consequential-autonomous", (policy) => {
    const item = byId(policy, "security-consequential");
    item.defaultDisposition = "AUTONOMOUS_WITH_AUDIT";
    item.humanRequired = false;
  }, /consequential class must default to HUMAN_REQUIRED|consequential class requires humanRequired=true/);

  expectRejected("human-decision-not-recorded", (policy) => {
    byId(policy, "product-consequential").recordDecision = false;
  }, /requires recordDecision=true|consequential decisions must be recorded/);

  expectRejected("unknown-not-blocked", (policy) => {
    byId(policy, "unknown-consequential").defaultDisposition = "HUMAN_REQUIRED";
  }, /must default to BLOCKED/);

  expectRejected("equivalent-without-proof", (policy) => {
    byId(policy, "equivalent-variant").candidateRequirements.equivalenceProofRequired = false;
  }, /equivalent variants require equivalence proof/);

  expectRejected("consequential-without-evidence", (policy) => {
    const evidence = byId(policy, "data-consequential").evidenceRequirements;
    evidence.required = false;
    evidence.minimumRefs = 0;
  }, /consequential decision requires evidence/);

  expectRejected("destructive-without-authorization", (policy) => {
    byId(policy, "external-destructive").candidateRequirements.explicitAuthorizationRequired = false;
  }, /consequential decision requires explicit authorization/);

  expectRejected("human-gate-precedence-weakened", (policy) => {
    policy.precedence.existingHumanGates = "may-be-overridden";
  }, /schema:/);

  expectRejected("runtime-human-precedence-weakened", (policy) => {
    policy.runtimeConsumption.existingHumanGates = "may-be-overridden";
  }, /schema:|must preserve the same precedence/);

  expectRejected("autonomous-question-enabled", (policy) => {
    policy.precedence.autonomousPreferenceQuestion = "allowed";
  }, /schema:|must remain forbidden/);

  resetFixture();
  expectAccepted("final-baseline");

  console.log(`Autonomy decision classification Phase 9A/9C policy regression suite passed (${assertions} assertions).`);
} finally {
  fs.rmSync(TEMP_ROOT, { recursive: true, force: true });
}
