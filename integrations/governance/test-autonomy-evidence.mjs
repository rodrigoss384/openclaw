#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../..");
const CONTROLLER = path.join(SCRIPT_DIR, "governance-control.mjs");
const EVIDENCE = path.join(SCRIPT_DIR, "autonomy-evidence.mjs");
const FEATURE = `phase9-autonomy-evidence-${process.pid}`;
const FEATURE_DIR = path.join(ROOT, ".specs", "features", FEATURE);
const LEDGER_REF = `.specs/features/${FEATURE}/autonomous-decisions.json`;
const LEDGER_PATH = path.join(ROOT, LEDGER_REF);
const OWNER_REF = `.specs/features/${FEATURE}/11-evidence.md`;
const EFFECTIVE_REF = `.specs/features/${FEATURE}/effective-policy.json`;
const EFFECTIVE_PATH = path.join(ROOT, EFFECTIVE_REF);
const HASH = "0".repeat(64);
let assertions = 0;

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function effectivePolicy(overrides = {}) {
  return {
    $schema: "integrations/governance/effective-policy.schema.json",
    schemaVersion: "1.0.0",
    artifactKind: "derived-effective-policy",
    canonical: false,
    stage: "implementation",
    feature: FEATURE,
    task: "T-009D",
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
      applicability: { ref: `.specs/features/${FEATURE}/applicability.md`, sha256: HASH }
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
    changeSize: 1,
    complexity: 1,
    riskSurface: 1,
    objectiveScore: 90,
    reversible: true,
    evidenceRefs: [],
    equivalenceEvidenceRefs: [],
    ...overrides
  };
}

function request(decisionClass, overrides = {}) {
  return {
    $schema: "integrations/governance/autonomy-decision.schema.json",
    schemaVersion: "1.0.0",
    artifactKind: "autonomy-decision-request",
    decisionClass,
    stage: "implementation",
    feature: FEATURE,
    task: "T-009D",
    effectivePolicyRef: EFFECTIVE_REF,
    humanGateRequired: false,
    candidates: [candidate()],
    evidence: [],
    ...overrides
  };
}

function execute(entrypoint, args) {
  return spawnSync(process.execPath, [entrypoint, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function controllerToFile(command, inputFlag, inputRef, outputRef) {
  const result = execute(CONTROLLER, [
    command,
    "--root", ROOT,
    inputFlag, inputRef,
    "--output", outputRef
  ]);
  assert.equal(result.status, 0, `${command} failed.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  assertions += 1;
}

function prepareDecision(label, decisionRequest, effective = effectivePolicy()) {
  writeJson(EFFECTIVE_PATH, effective);
  const requestRef = `.specs/features/${FEATURE}/${label}.request.json`;
  const decisionRef = `.specs/features/${FEATURE}/${label}.decision.json`;
  const directiveRef = `.specs/features/${FEATURE}/${label}.directive.json`;
  writeJson(path.join(ROOT, requestRef), decisionRequest);
  controllerToFile("decide", "--request", requestRef, decisionRef);
  controllerToFile("consume", "--decision", decisionRef, directiveRef);
  return { requestRef, decisionRef, directiveRef };
}

function record(directiveRef, extra = []) {
  return execute(EVIDENCE, ["record", "--root", ROOT, "--directive", directiveRef, ...extra]);
}

function check(extra = []) {
  return execute(EVIDENCE, ["check", "--root", ROOT, "--ledger", LEDGER_REF, ...extra]);
}

function expectRecordAccepted(label, directiveRef, extra = []) {
  const result = record(directiveRef, extra);
  assert.equal(result.status, 0, `${label}: record failed.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  assertions += 1;
  return JSON.parse(result.stdout);
}

function expectRecordRejected(label, directiveRef, expected, extra = []) {
  const result = record(directiveRef, extra);
  assert.notEqual(result.status, 0, `${label}: invalid evidence record was accepted.\n${result.stdout}`);
  assert.match(result.stderr, expected, `${label}: unexpected rejection.\n${result.stderr}`);
  assertions += 2;
}

try {
  fs.rmSync(FEATURE_DIR, { recursive: true, force: true });
  fs.mkdirSync(FEATURE_DIR, { recursive: true });
  fs.writeFileSync(path.join(ROOT, OWNER_REF), `# ${FEATURE} — Evidências\n`);

  const safe = prepareDecision("safe", request("reversible-internal"));
  const safeRecord = expectRecordAccepted("safe-ephemeral", safe.directiveRef);
  assert.equal(safeRecord.durability, "ephemeral");
  assert.equal(safeRecord.authority, "agent");
  assert.equal(safeRecord.selectedOption, "alpha");
  assert.equal(safeRecord.consumeAction, "execute");
  assert.equal(safeRecord.ownerEvidenceRef, OWNER_REF);
  assert.match(safeRecord.recordedAt, /^[0-9]{4}-[0-9]{2}-[0-9]{2}T/);
  assert.equal(fs.existsSync(LEDGER_PATH), false, "SAFE_AUTONOMOUS must not create the durable ledger.");
  assertions += 7;

  expectRecordRejected(
    "safe-cannot-be-persisted",
    safe.directiveRef,
    /ephemeral SAFE_AUTONOMOUS evidence must not be persisted/,
    ["--ledger", LEDGER_REF]
  );

  const audit = prepareDecision("audit", request("reversible-contract-bounded", {
    evidence: [{ source: "effective-policy", ref: EFFECTIVE_REF }]
  }));
  const auditRecord = expectRecordAccepted("audit-durable", audit.directiveRef);
  assert.equal(auditRecord.durability, "durable");
  assert.equal(auditRecord.authority, "agent");
  assert.equal(auditRecord.consumeAction, "record-and-execute");
  assert.equal(auditRecord.policyHashes.autonomyPolicy.length, 64);
  assert.equal(auditRecord.policyHashes.effectivePolicy.length, 64);
  assert.equal(fs.existsSync(LEDGER_PATH), true);
  assertions += 6;

  let ledger = readJson(LEDGER_PATH);
  assert.equal(ledger.canonical, false);
  assert.equal(ledger.feature, FEATURE);
  assert.equal(ledger.ownerEvidenceRef, OWNER_REF);
  assert.equal(ledger.records.length, 1);
  assert.equal(ledger.records[0].decisionId, auditRecord.decisionId);
  assertions += 5;

  const retainedLedger = fs.readFileSync(LEDGER_PATH);
  fs.unlinkSync(LEDGER_PATH);
  assert.notEqual(check().status, 0, "Deleting ledger while a consumed audited directive exists must block"); assertions++;
  fs.writeFileSync(LEDGER_PATH, retainedLedger);
  const removed = structuredClone(ledger); removed.records = [];
  writeJson(LEDGER_PATH, removed);
  assert.notEqual(check().status, 0, "Removing the required record must block"); assertions++;
  fs.writeFileSync(LEDGER_PATH, retainedLedger);

  const firstRecordedAt = ledger.records[0].recordedAt;
  const auditAgain = expectRecordAccepted("audit-idempotent-repeat", audit.directiveRef);
  ledger = readJson(LEDGER_PATH);
  assert.equal(ledger.records.length, 1, "Repeated record must not duplicate decisionId.");
  assert.equal(auditAgain.recordedAt, firstRecordedAt, "Idempotent repeat must retain original timestamp.");
  assertions += 2;

  const human = prepareDecision("human", request("product-consequential", {
    evidence: [
      { source: "approved-product-context", ref: "docs/product/context.md" },
      { source: "risk-assessment", ref: "evidence/product-risk.json" }
    ]
  }));
  const humanRecord = expectRecordAccepted("human-required-durable", human.directiveRef);
  assert.equal(humanRecord.durability, "durable");
  assert.equal(humanRecord.authority, "human");
  assert.equal(humanRecord.selectedOption, null);
  assert.equal(humanRecord.consumeAction, "request-human-decision");
  assertions += 4;

  const blocked = prepareDecision("blocked", request("unknown-consequential", {
    candidates: [],
    evidence: [{ source: "risk-assessment", ref: "evidence/unknown-risk.json" }]
  }));
  const blockedRecord = expectRecordAccepted("blocked-durable", blocked.directiveRef);
  assert.equal(blockedRecord.durability, "durable");
  assert.equal(blockedRecord.authority, "human");
  assert.equal(blockedRecord.selectedOption, null);
  assert.equal(blockedRecord.consumeAction, "report-blocker-and-request-human");
  assert.ok(blockedRecord.reasonCodes.includes("UNKNOWN_CONSEQUENTIAL"));
  assertions += 5;

  ledger = readJson(LEDGER_PATH);
  assert.equal(ledger.records.length, 3);
  assert.deepEqual(
    new Set(ledger.records.map((item) => item.disposition)),
    new Set(["AUTONOMOUS_WITH_AUDIT", "HUMAN_REQUIRED", "BLOCKED"])
  );
  assertions += 2;

  const checkResult = check();
  assert.equal(checkResult.status, 0, `ledger check failed.\n${checkResult.stderr}`);
  const checked = JSON.parse(checkResult.stdout);
  assert.equal(checked.records, 3);
  assert.equal(checked.ownerEvidenceRef, OWNER_REF);
  assertions += 3;

  expectRecordRejected(
    "noncanonical-ledger",
    human.directiveRef,
    /canonical ledger/,
    ["--ledger", `.specs/features/${FEATURE}/other-decisions.json`]
  );

  const originalAuditDirective = readJson(path.join(ROOT, audit.directiveRef));
  const tamperedAuditDirective = { ...originalAuditDirective, recordDecision: false };
  writeJson(path.join(ROOT, audit.directiveRef), tamperedAuditDirective);
  expectRecordRejected("record-flag-tamper", audit.directiveRef, /recordDecision does not match canonical autonomy policy/);
  writeJson(path.join(ROOT, audit.directiveRef), originalAuditDirective);

  const originalLedger = readJson(LEDGER_PATH);
  const conflicting = structuredClone(originalLedger);
  conflicting.records[0].selectedOption = "forged-option";
  writeJson(LEDGER_PATH, conflicting);
  expectRecordRejected("immutable-history", audit.directiveRef, /existing durable evidence differs|schema/);
  writeJson(LEDGER_PATH, originalLedger);

  const duplicate = structuredClone(originalLedger);
  duplicate.records.push(structuredClone(duplicate.records[0]));
  writeJson(LEDGER_PATH, duplicate);
  const duplicateCheck = check();
  assert.notEqual(duplicateCheck.status, 0, "Duplicate decisionId ledger was accepted.");
  assert.match(duplicateCheck.stderr, /Duplicate autonomy evidence decisionId/);
  assertions += 2;
  writeJson(LEDGER_PATH, originalLedger);

  const ephemeralInLedger = structuredClone(originalLedger);
  ephemeralInLedger.records[0].durability = "ephemeral";
  writeJson(LEDGER_PATH, ephemeralInLedger);
  const ephemeralCheck = check();
  assert.notEqual(ephemeralCheck.status, 0, "Persistent ledger accepted ephemeral record.");
  assert.match(ephemeralCheck.stderr, /durability=durable/);
  assertions += 2;
  writeJson(LEDGER_PATH, originalLedger);

  fs.unlinkSync(path.join(ROOT, OWNER_REF));
  const ownerMissing = check();
  assert.notEqual(ownerMissing.status, 0, "Ledger check accepted missing 11-evidence owner.");
  assert.match(ownerMissing.stderr, /11-evidence owner not found/);
  assertions += 2;
  fs.writeFileSync(path.join(ROOT, OWNER_REF), `# ${FEATURE} — Evidências\n`);

  const finalCheck = check();
  assert.equal(finalCheck.status, 0, `final ledger check failed.\n${finalCheck.stderr}`);
  assertions += 1;

  console.log(`Autonomy decision evidence Phase 9D regression suite passed (${assertions} assertions).`);
} finally {
  fs.rmSync(FEATURE_DIR, { recursive: true, force: true });
}
