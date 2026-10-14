#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../..");
const CONTROLLER = path.join(SCRIPT_DIR, "governance-control.mjs");
const VALIDATOR = path.join(SCRIPT_DIR, "validate-autonomy-policy.mjs");
const TEMP_DIR = path.join(SCRIPT_DIR, `.test-design-authority-autonomy-${process.pid}`);
const EFFECTIVE_REF = path.relative(ROOT, path.join(TEMP_DIR, "effective-policy.json")).split(path.sep).join("/");
const REQUEST_REF = path.relative(ROOT, path.join(TEMP_DIR, "request.json")).split(path.sep).join("/");
const DECISION_REF = path.relative(ROOT, path.join(TEMP_DIR, "decision.json")).split(path.sep).join("/");
const HASH = "0".repeat(64);
const TEST_FEATURE = `evh-design-authority-autonomy-${process.pid}`;
const TEST_FEATURE_DIR = path.join(ROOT, ".specs/features", TEST_FEATURE);
fs.mkdirSync(TEST_FEATURE_DIR, { recursive: true });
let assertions = 0;

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function execute(script, args) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function effectivePolicy() {
  return {
    $schema: "integrations/governance/effective-policy.schema.json",
    schemaVersion: "1.0.0",
    artifactKind: "derived-effective-policy",
    canonical: false,
    stage: "implementation",
    feature: TEST_FEATURE,
    task: "T-PDA-102",
    applicability: {
      frontend: "substantial",
      backend: "not-applicable",
      behavioralUx: "applicable"
    },
    hardRules: ["RULE-SDE-ADMISSION-001"],
    defaults: [],
    advisories: [],
    escalations: [],
    requiredEnforcements: ["governance-rule-admission-validation"],
    sources: {
      governancePolicy: { ref: "prompts/spec-driven/governance-policy.json", sha256: HASH },
      capabilityRegistry: { ref: "integrations/governance/enforcement-capabilities.json", sha256: HASH },
      applicability: { ref: ".specs/features/delegated-product-design-authority/applicability.md", sha256: HASH }
    }
  };
}

function candidate(id, objectiveScore) {
  return {
    id,
    description: `Direction ${id}`,
    canonicalContractMatch: true,
    contractRefs: [".specs/features/delegated-product-design-authority/07-design.md"],
    precedentMatch: false,
    precedentRefs: [],
    changeSize: 10,
    complexity: 4,
    riskSurface: 3,
    objectiveScore,
    reversible: true,
    evidenceRefs: [`evidence/${id}-comparison.json`],
    equivalenceEvidenceRefs: []
  };
}

function evidence() {
  return [
    { source: "approved-product-context", ref: ".specs/features/delegated-product-design-authority/01-spec.md" },
    { source: "visual-research", ref: "evidence/visual-research.json" },
    { source: "candidate-comparison", ref: "evidence/direction-comparison.json" }
  ];
}

function request(overrides = {}) {
  return {
    $schema: "integrations/governance/autonomy-decision.schema.json",
    schemaVersion: "1.0.0",
    artifactKind: "autonomy-decision-request",
    decisionClass: "design-authority-bounded",
    stage: "implementation",
    feature: TEST_FEATURE,
    task: "T-PDA-102",
    effectivePolicyRef: EFFECTIVE_REF,
    humanGateRequired: false,
    candidates: [candidate("contextual", 92), candidate("generic", 48)],
    evidence: evidence(),
    ...overrides
  };
}

function decide(value) {
  writeJson(path.join(TEMP_DIR, "request.json"), value);
  return execute(CONTROLLER, [
    "decide",
    "--root", ROOT,
    "--request", REQUEST_REF,
    "--output", DECISION_REF
  ]);
}

try {
  writeJson(path.join(TEMP_DIR, "effective-policy.json"), effectivePolicy());

  const policyValidation = execute(VALIDATOR, ["--root", ROOT]);
  assert.equal(policyValidation.status, 0, `policy validation failed.\n${policyValidation.stderr}`);
  assertions += 1;

  const bounded = decide(request());
  assert.equal(bounded.status, 0, `bounded decision failed.\n${bounded.stderr}`);
  const boundedDecision = JSON.parse(fs.readFileSync(path.join(TEMP_DIR, "decision.json"), "utf8"));
  assert.equal(boundedDecision.disposition, "AUTONOMOUS_WITH_AUDIT");
  assert.equal(boundedDecision.selectedOption, "contextual");
  assert.equal(boundedDecision.reversible, true);
  assertions += 4;

  const consumed = execute(CONTROLLER, ["consume", "--root", ROOT, "--decision", DECISION_REF]);
  assert.equal(consumed.status, 0, `bounded consumption failed.\n${consumed.stderr}`);
  const directive = JSON.parse(consumed.stdout);
  assert.equal(directive.action, "record-and-execute");
  assert.equal(directive.askHuman, false);
  assert.equal(directive.executionAllowed, true);
  assert.equal(directive.recordDecision, true);
  assertions += 5;

  const missingResearch = decide(request({ evidence: evidence().filter((item) => item.source !== "visual-research") }));
  assert.equal(missingResearch.status, 0, `missing-evidence resolution failed.\n${missingResearch.stderr}`);
  const missingResearchDecision = JSON.parse(fs.readFileSync(path.join(TEMP_DIR, "decision.json"), "utf8"));
  assert.equal(missingResearchDecision.disposition, "BLOCKED");
  assert.ok(missingResearchDecision.reasonCodes.includes("MISSING_REQUIRED_EVIDENCE"));
  assertions += 3;

  const brand = decide(request({
    decisionClass: "brand-consequential",
    candidates: [candidate("brand-refresh", 90)],
    evidence: [
      { source: "approved-design-system", ref: "docs/frontend/design-system.md" },
      { source: "risk-assessment", ref: "evidence/brand-risk.json" }
    ]
  }));
  assert.equal(brand.status, 0, `brand decision failed.\n${brand.stderr}`);
  const brandDecision = JSON.parse(fs.readFileSync(path.join(TEMP_DIR, "decision.json"), "utf8"));
  assert.equal(brandDecision.disposition, "HUMAN_REQUIRED");
  assert.equal(brandDecision.selectedOption, null);
  assert.ok(brandDecision.reasonCodes.includes("CLASS_REQUIRES_HUMAN"));
  assertions += 4;

  console.log(`Design authority autonomy regression suite passed (${assertions} assertions).`);
} finally {
  fs.rmSync(TEST_FEATURE_DIR, { recursive: true, force: true });
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
}
