#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../..");
const CONTROLLER = path.join(SCRIPT_DIR, "governance-control.mjs");
const SKILL = path.join(ROOT, "skills/spec-driven-engineering/SKILL.md");
const TEMP_DIR = path.join(SCRIPT_DIR, `.test-autonomy-consumption-${process.pid}`);
const EFFECTIVE_REF = path.relative(ROOT, path.join(TEMP_DIR, "effective-policy.json")).split(path.sep).join("/");
const REQUEST_REF = path.relative(ROOT, path.join(TEMP_DIR, "request.json")).split(path.sep).join("/");
const DECISION_REF = path.relative(ROOT, path.join(TEMP_DIR, "decision.json")).split(path.sep).join("/");
const TEST_FEATURE = `evh-autonomy-consumption-${process.pid}`;
const TEST_FEATURE_DIR = path.join(ROOT, ".specs/features", TEST_FEATURE);
fs.mkdirSync(TEST_FEATURE_DIR, { recursive: true });
let assertions = 0;

const HASH = "0".repeat(64);

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function effectivePolicy(overrides = {}) {
  return {
    $schema: "integrations/governance/effective-policy.schema.json",
    schemaVersion: "1.0.0",
    artifactKind: "derived-effective-policy",
    canonical: false,
    stage: "implementation",
    feature: TEST_FEATURE,
    task: "T-009C",
    applicability: {
      frontend: "not-applicable",
      backend: "not-applicable",
      behavioralUx: "not-applicable"
    },
    hardRules: ["RULE-SDE-ADMISSION-001"],
    defaults: [],
    advisories: [],
    escalations: [],
    requiredEnforcements: ["governance-rule-admission-validation"],
    sources: {
      governancePolicy: { ref: "prompts/spec-driven/governance-policy.json", sha256: HASH },
      capabilityRegistry: { ref: "integrations/governance/enforcement-capabilities.json", sha256: HASH },
      applicability: { ref: ".specs/features/phase9-autonomy-consumption-test/applicability.md", sha256: HASH }
    },
    ...overrides
  };
}

function candidate(id = "alpha", overrides = {}) {
  return {
    id,
    description: `Candidate ${id}`,
    canonicalContractMatch: true,
    contractRefs: ["docs/contracts/example.md"],
    precedentMatch: false,
    precedentRefs: [],
    changeSize: 10,
    complexity: 5,
    riskSurface: 5,
    objectiveScore: 50,
    reversible: true,
    evidenceRefs: [],
    equivalenceEvidenceRefs: [],
    ...overrides
  };
}

function request(overrides = {}) {
  return {
    $schema: "integrations/governance/autonomy-decision.schema.json",
    schemaVersion: "1.0.0",
    artifactKind: "autonomy-decision-request",
    decisionClass: "reversible-internal",
    stage: "implementation",
    feature: TEST_FEATURE,
    task: "T-009C",
    effectivePolicyRef: EFFECTIVE_REF,
    humanGateRequired: false,
    candidates: [candidate()],
    evidence: [],
    ...overrides
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function execute(command, args) {
  return spawnSync(process.execPath, [CONTROLLER, command, "--root", ROOT, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function decide(decisionRequest, effective = effectivePolicy()) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
  writeJson(path.join(TEMP_DIR, "effective-policy.json"), effective);
  writeJson(path.join(TEMP_DIR, "request.json"), decisionRequest);
  const result = execute("decide", ["--request", REQUEST_REF, "--output", DECISION_REF]);
  assert.equal(result.status, 0, `decide failed.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  assertions += 1;
  return JSON.parse(fs.readFileSync(path.join(TEMP_DIR, "decision.json"), "utf8"));
}

function consume() {
  return execute("consume", ["--decision", DECISION_REF]);
}

function accepted(label, decisionRequest, effective = effectivePolicy()) {
  decide(decisionRequest, effective);
  const result = consume();
  assert.equal(result.status, 0, `${label}: consume failed.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  assertions += 1;
  return JSON.parse(result.stdout);
}

function rejectedAfterMutation(label, decisionRequest, mutate, expected, effective = effectivePolicy()) {
  const value = decide(decisionRequest, effective);
  mutate(value);
  writeJson(path.join(TEMP_DIR, "decision.json"), value);
  const result = consume();
  assert.notEqual(result.status, 0, `${label}: tampered decision was consumed.\n${result.stdout}`);
  assert.match(result.stderr, expected, `${label}: unexpected rejection.\n${result.stderr}`);
  assertions += 2;
}

try {
  fs.mkdirSync(TEMP_DIR, { recursive: true });

  const safe = accepted("safe-autonomous", request());
  assert.equal(safe.action, "execute");
  assert.equal(safe.askHuman, false);
  assert.equal(safe.executionAllowed, true);
  assert.equal(safe.recordDecision, false);
  assert.equal(safe.selectedOption, "alpha");
  assert.equal(safe.humanResolvableBlocker, false);
  assert.deepEqual(safe.humanReasonCodes, []);
  assert.deepEqual(safe.blockerReasonCodes, []);
  assertions += 8;

  const audit = accepted("autonomous-with-audit", request({
    decisionClass: "reversible-contract-bounded",
    evidence: [{ source: "effective-policy", ref: EFFECTIVE_REF }]
  }));
  assert.equal(audit.action, "record-and-execute");
  assert.equal(audit.askHuman, false);
  assert.equal(audit.executionAllowed, true);
  assert.equal(audit.recordDecision, true);
  assert.equal(audit.selectedOption, "alpha");
  assertions += 5;

  const consequential = accepted("human-required", request({
    decisionClass: "product-consequential",
    evidence: [
      { source: "approved-product-context", ref: "docs/product/context.md" },
      { source: "risk-assessment", ref: "evidence/product-risk.json" }
    ]
  }));
  assert.equal(consequential.action, "request-human-decision");
  assert.equal(consequential.askHuman, true);
  assert.equal(consequential.executionAllowed, false);
  assert.equal(consequential.recordDecision, true);
  assert.equal(consequential.selectedOption, null);
  assert.ok(consequential.humanReasonCodes.includes("CLASS_REQUIRES_HUMAN"));
  assertions += 6;

  const existingGate = accepted("existing-human-gate", request({ humanGateRequired: true }));
  assert.equal(existingGate.action, "request-human-decision");
  assert.equal(existingGate.askHuman, true);
  assert.ok(existingGate.humanReasonCodes.includes("EXISTING_HUMAN_GATE"));
  assertions += 3;

  const escalated = accepted(
    "effective-policy-escalation",
    request(),
    effectivePolicy({ escalations: ["RULE-SDE-PLACEHOLDER-001"] })
  );
  assert.equal(escalated.action, "request-human-decision");
  assert.equal(escalated.askHuman, true);
  assert.ok(escalated.humanReasonCodes.includes("EFFECTIVE_POLICY_ESCALATION"));
  assertions += 3;

  const unknown = accepted("unknown-consequential", request({
    decisionClass: "unknown-consequential",
    candidates: [],
    evidence: [{ source: "risk-assessment", ref: "evidence/unknown-risk.json" }]
  }));
  assert.equal(unknown.action, "report-blocker-and-request-human");
  assert.equal(unknown.askHuman, true);
  assert.equal(unknown.executionAllowed, false);
  assert.equal(unknown.humanResolvableBlocker, true);
  assert.deepEqual(unknown.humanReasonCodes, ["UNKNOWN_CONSEQUENTIAL"]);
  assert.ok(unknown.blockerReasonCodes.includes("DECISION_BLOCKED"));
  assert.ok(unknown.blockerReasonCodes.includes("UNKNOWN_CONSEQUENTIAL"));
  assertions += 7;

  const noCandidate = accepted("non-human-resolvable-blocker", request({ candidates: [] }));
  assert.equal(noCandidate.action, "report-blocker");
  assert.equal(noCandidate.askHuman, false);
  assert.equal(noCandidate.executionAllowed, false);
  assert.equal(noCandidate.humanResolvableBlocker, false);
  assert.deepEqual(noCandidate.humanReasonCodes, []);
  assert.ok(noCandidate.blockerReasonCodes.includes("NO_VALID_CANDIDATE"));
  assertions += 6;

  rejectedAfterMutation(
    "stale-autonomy-policy",
    request(),
    (value) => { value.policyProvenance.autonomyPolicy.sha256 = HASH; },
    /autonomy policy provenance is stale/
  );

  rejectedAfterMutation(
    "stale-effective-policy",
    request(),
    (value) => { value.policyProvenance.effectivePolicy.sha256 = HASH; },
    /effective policy provenance is stale/
  );

  rejectedAfterMutation(
    "human-class-cannot-be-forged-autonomous",
    request({
      decisionClass: "product-consequential",
      evidence: [
        { source: "approved-product-context", ref: "docs/product/context.md" },
        { source: "risk-assessment", ref: "evidence/product-risk.json" }
      ]
    }),
    (value) => {
      value.disposition = "SAFE_AUTONOMOUS";
      value.selectedOption = "alpha";
      value.reversible = true;
      value.reasonCodes = ["AUTONOMOUS_CLASS_DEFAULT", "CANDIDATE_SELECTED"];
    },
    /autonomous consumption requires agent authority/
  );

  rejectedAfterMutation(
    "blocked-cannot-select-option",
    request({ candidates: [] }),
    (value) => { value.selectedOption = "alpha"; },
    /BLOCKED consumption must not receive a selected option/
  );

  const forgedEscalation = decide(request());
  const escalatedPolicy = effectivePolicy({ escalations: ["RULE-SDE-PLACEHOLDER-001"] });
  writeJson(path.join(TEMP_DIR, "effective-policy.json"), escalatedPolicy);
  forgedEscalation.policyProvenance.effectivePolicy.sha256 = sha256(path.join(TEMP_DIR, "effective-policy.json"));
  writeJson(path.join(TEMP_DIR, "decision.json"), forgedEscalation);
  const escalationOverride = consume();
  assert.notEqual(escalationOverride.status, 0, "forged autonomous result over escalation was consumed.");
  assert.match(escalationOverride.stderr, /cannot override effective-policy escalations/);
  assertions += 2;

  const skill = fs.readFileSync(SKILL, "utf8");
  assert.match(skill, /## Runtime autonomy/);
  assert.match(skill, /governance-control\.mjs decide/);
  assert.match(skill, /governance-control\.mjs consume/);
  assert.match(skill, /SAFE_AUTONOMOUS.*AUTONOMOUS_WITH_AUDIT/s);
  assert.match(skill, /não peça preferência|sem pedir preferência/i);
  assert.match(skill, /HUMAN_REQUIRED/);
  assert.match(skill, /BLOCKED/);
  assertions += 7;

  console.log(`Autonomy runtime consumption Phase 9C regression suite passed (${assertions} assertions).`);
} finally {
  fs.rmSync(TEST_FEATURE_DIR, { recursive: true, force: true });
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
}
