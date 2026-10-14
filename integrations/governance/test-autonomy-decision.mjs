#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../..");
const CONTROLLER = path.join(SCRIPT_DIR, "governance-control.mjs");
const TEMP_DIR = path.join(SCRIPT_DIR, `.test-autonomy-decision-${process.pid}`);
const EFFECTIVE_REF = path.relative(ROOT, path.join(TEMP_DIR, "effective-policy.json")).split(path.sep).join("/");
const REQUEST_REF = path.relative(ROOT, path.join(TEMP_DIR, "request.json")).split(path.sep).join("/");
let assertions = 0;

const HASH = "0".repeat(64);

function effectivePolicy(overrides = {}) {
  return {
    $schema: "integrations/governance/effective-policy.schema.json",
    schemaVersion: "1.0.0",
    artifactKind: "derived-effective-policy",
    canonical: false,
    stage: "implementation",
    feature: "phase9-autonomy-test",
    task: "T-009B",
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
      applicability: { ref: ".specs/features/phase9-autonomy-test/applicability.md", sha256: HASH }
    },
    ...overrides
  };
}

function candidate(id, overrides = {}) {
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
    feature: "phase9-autonomy-test",
    task: "T-009B",
    effectivePolicyRef: EFFECTIVE_REF,
    humanGateRequired: false,
    candidates: [candidate("alpha")],
    evidence: [],
    ...overrides
  };
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function execute(decisionRequest, effective = effectivePolicy()) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
  writeJson(path.join(TEMP_DIR, "effective-policy.json"), effective);
  writeJson(path.join(TEMP_DIR, "request.json"), decisionRequest);
  return spawnSync(process.execPath, [
    CONTROLLER,
    "decide",
    "--root", ROOT,
    "--request", REQUEST_REF
  ], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function accepted(label, decisionRequest, effective = effectivePolicy()) {
  const result = execute(decisionRequest, effective);
  assert.equal(result.status, 0, `${label}: resolver failed.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  const parsed = JSON.parse(result.stdout);
  assertions += 1;
  return parsed;
}

function rejected(label, decisionRequest, expected, effective = effectivePolicy()) {
  const result = execute(decisionRequest, effective);
  assert.notEqual(result.status, 0, `${label}: invalid request was accepted.\n${result.stdout}`);
  assert.match(result.stderr, expected, `${label}: unexpected error.\n${result.stderr}`);
  assertions += 2;
}

function expectSelected(label, candidates, expectedId) {
  const result = accepted(label, request({ candidates }));
  assert.equal(result.disposition, "SAFE_AUTONOMOUS", `${label}: wrong disposition.`);
  assert.equal(result.selectedOption, expectedId, `${label}: wrong selected candidate.`);
  assertions += 2;
}

try {
  fs.mkdirSync(TEMP_DIR, { recursive: true });

  const baseline = accepted("safe-autonomous-baseline", request());
  assert.equal(baseline.disposition, "SAFE_AUTONOMOUS");
  assert.equal(baseline.selectedOption, "alpha");
  assert.equal(baseline.reversible, true);
  assert.deepEqual(baseline.rulesApplied, ["RULE-SDE-ADMISSION-001"]);
  assert.match(baseline.decisionId, /^DEC-[A-F0-9]{16}$/);
  assertions += 5;

  const baselineAgain = accepted("deterministic-repeat", request());
  assert.equal(baselineAgain.decisionId, baseline.decisionId);
  assert.equal(baselineAgain.selectedOption, baseline.selectedOption);
  assertions += 2;

  const validBeatsInvalid = accepted("invalid-contract-candidate-rejected", request({
    candidates: [
      candidate("invalid", { canonicalContractMatch: false }),
      candidate("valid")
    ]
  }));
  assert.equal(validBeatsInvalid.selectedOption, "valid");
  assert.deepEqual(validBeatsInvalid.rejectedOptions.find((item) => item.id === "invalid")?.reasonCodes, ["CANDIDATE_CONTRACT_MISMATCH"]);
  assertions += 2;

  const noValid = accepted("no-valid-candidate-blocked", request({
    candidates: [candidate("invalid", { canonicalContractMatch: false })]
  }));
  assert.equal(noValid.disposition, "BLOCKED");
  assert.equal(noValid.selectedOption, null);
  assert.ok(noValid.reasonCodes.includes("NO_VALID_CANDIDATE"));
  assertions += 3;

  const nonReversible = accepted("reversibility-required", request({
    candidates: [candidate("irreversible", { reversible: false })]
  }));
  assert.equal(nonReversible.disposition, "BLOCKED");
  assert.deepEqual(nonReversible.rejectedOptions[0].reasonCodes, ["CANDIDATE_NOT_REVERSIBLE"]);
  assertions += 2;

  const auditMissingEvidence = accepted("audit-class-missing-evidence", request({
    decisionClass: "reversible-contract-bounded"
  }));
  assert.equal(auditMissingEvidence.disposition, "BLOCKED");
  assert.ok(auditMissingEvidence.reasonCodes.includes("MISSING_REQUIRED_EVIDENCE"));
  assertions += 2;

  const auditReady = accepted("audit-class-ready", request({
    decisionClass: "reversible-contract-bounded",
    evidence: [{ source: "effective-policy", ref: EFFECTIVE_REF }]
  }));
  assert.equal(auditReady.disposition, "AUTONOMOUS_WITH_AUDIT");
  assert.equal(auditReady.selectedOption, "alpha");
  assertions += 2;

  const equivalentMissingProof = accepted("equivalent-variant-needs-proof", request({
    decisionClass: "equivalent-variant",
    evidence: [{ source: "effective-policy", ref: EFFECTIVE_REF }]
  }));
  assert.equal(equivalentMissingProof.disposition, "BLOCKED");
  assert.deepEqual(equivalentMissingProof.rejectedOptions[0].reasonCodes, ["CANDIDATE_EQUIVALENCE_UNPROVEN"]);
  assertions += 2;

  const equivalentReady = accepted("equivalent-variant-ready", request({
    decisionClass: "equivalent-variant",
    candidates: [candidate("alpha", { equivalenceEvidenceRefs: ["evidence/equivalence.json"] })],
    evidence: [{ source: "effective-policy", ref: EFFECTIVE_REF }]
  }));
  assert.equal(equivalentReady.disposition, "AUTONOMOUS_WITH_AUDIT");
  assert.equal(equivalentReady.selectedOption, "alpha");
  assertions += 2;

  const consequentialMissingRisk = accepted("consequential-missing-risk", request({
    decisionClass: "product-consequential",
    evidence: [{ source: "approved-product-context", ref: "docs/product/context.md" }]
  }));
  assert.equal(consequentialMissingRisk.disposition, "BLOCKED");
  assert.ok(consequentialMissingRisk.reasonCodes.includes("MISSING_RISK_ASSESSMENT"));
  assertions += 2;

  const consequentialReady = accepted("consequential-human-required", request({
    decisionClass: "product-consequential",
    evidence: [
      { source: "approved-product-context", ref: "docs/product/context.md" },
      { source: "risk-assessment", ref: "evidence/product-risk.json" }
    ]
  }));
  assert.equal(consequentialReady.disposition, "HUMAN_REQUIRED");
  assert.equal(consequentialReady.selectedOption, null);
  assert.ok(consequentialReady.reasonCodes.includes("CLASS_REQUIRES_HUMAN"));
  assert.ok(consequentialReady.reasonCodes.includes("EXPLICIT_AUTHORIZATION_REQUIRED"));
  assertions += 4;

  const humanGate = accepted("existing-human-gate-prevails", request({ humanGateRequired: true }));
  assert.equal(humanGate.disposition, "HUMAN_REQUIRED");
  assert.equal(humanGate.selectedOption, null);
  assert.ok(humanGate.reasonCodes.includes("EXISTING_HUMAN_GATE"));
  assertions += 3;

  const escalation = accepted(
    "effective-policy-escalation-prevails",
    request(),
    effectivePolicy({ escalations: ["RULE-SDE-PLACEHOLDER-001"] })
  );
  assert.equal(escalation.disposition, "HUMAN_REQUIRED");
  assert.equal(escalation.selectedOption, null);
  assert.ok(escalation.reasonCodes.includes("EFFECTIVE_POLICY_ESCALATION"));
  assertions += 3;

  const unknown = accepted("unknown-consequential-blocked", request({
    decisionClass: "unknown-consequential",
    candidates: [],
    evidence: [
      { source: "risk-assessment", ref: "evidence/unknown-risk.json" }
    ]
  }));
  assert.equal(unknown.disposition, "BLOCKED");
  assert.equal(unknown.selectedOption, null);
  assert.ok(unknown.reasonCodes.includes("UNKNOWN_CONSEQUENTIAL"));
  assertions += 3;

  const noCandidate = accepted("no-candidate-blocked", request({ candidates: [] }));
  assert.equal(noCandidate.disposition, "BLOCKED");
  assert.ok(noCandidate.reasonCodes.includes("NO_VALID_CANDIDATE"));
  assertions += 2;

  const disallowedEvidence = accepted("disallowed-evidence-blocked", request({
    evidence: [{ source: "risk-assessment", ref: "evidence/risk.json" }]
  }));
  assert.equal(disallowedEvidence.disposition, "BLOCKED");
  assert.ok(disallowedEvidence.reasonCodes.includes("DISALLOWED_EVIDENCE_SOURCE"));
  assertions += 2;

  expectSelected("precedent-tiebreak", [
    candidate("without-precedent"),
    candidate("with-precedent", { precedentMatch: true, precedentRefs: ["docs/precedent.md"] })
  ], "with-precedent");

  expectSelected("change-size-ignored-for-low-class", [
    candidate("larger", { changeSize: 20 }),
    candidate("smaller", { changeSize: 5 })
  ], "larger");

  expectSelected("complexity-ignored-for-low-class", [
    candidate("complex", { complexity: 8 }),
    candidate("simple", { complexity: 2 })
  ], "complex");

  expectSelected("risk-ignored-for-low-class", [
    candidate("riskier", { riskSurface: 8 }),
    candidate("safer", { riskSurface: 2 })
  ], "riskier");

  expectSelected("objective-score-ignored-for-low-class", [
    candidate("lower-score", { objectiveScore: 60 }),
    candidate("higher-score", { objectiveScore: 90 })
  ], "higher-score");

  const applicabilityDir = path.join(ROOT, ".specs/features/phase9-autonomy-test");
  const applicabilityFile = path.join(applicabilityDir, "applicability.md");
  fs.mkdirSync(applicabilityDir, { recursive: true });
  fs.writeFileSync(applicabilityFile, "auth: affected\n");
  try {
    const contradicted = accepted("low-class-contradicts-material-applicability", request());
    assert.equal(contradicted.disposition, "BLOCKED");
    assert.equal(contradicted.selectedOption, null);
    assert.ok(contradicted.reasonCodes.includes("CLASS_CONTRADICTS_APPLICABILITY"));
    assertions += 3;
  } finally {
    fs.rmSync(applicabilityFile, { force: true });
    try { fs.rmdirSync(applicabilityDir); } catch (error) { if (error.code !== "ENOTEMPTY") throw error; }
  }

  expectSelected("lexical-total-order", [candidate("zeta"), candidate("alpha")], "alpha");

  rejected(
    "stage-mismatch",
    request({ stage: "adversarial" }),
    /does not match effective policy stage/
  );

  rejected(
    "request-ref-cannot-escape-root",
    request({ effectivePolicyRef: "../outside.json" }),
    /schema:|violates its schema/
  );

  console.log(`Autonomy runtime decision resolver Phase 9B regression suite passed (${assertions} assertions).`);
} finally {
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
}
