#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../..");
const VALIDATOR = path.join(SCRIPT_DIR, "validate-governance-policy.mjs");
const TEMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "governance-rule-admission-"));
let assertions = 0;

const POLICY_REF = "prompts/spec-driven/governance-policy.json";
const POLICY_SCHEMA_REF = "integrations/governance/governance-policy.schema.json";
const CAPABILITIES_REF = "integrations/governance/enforcement-capabilities.json";
const CAPABILITY_SCHEMA_REF = "integrations/governance/enforcement-capabilities.schema.json";

function copy(relativePath) {
  const target = path.join(TEMP_ROOT, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(ROOT, relativePath), target);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(TEMP_ROOT, relativePath), "utf8"));
}

function writeJson(relativePath, value) {
  fs.writeFileSync(path.join(TEMP_ROOT, relativePath), `${JSON.stringify(value, null, 2)}\n`);
}

function gitBlobSha(filePath) {
  const content = fs.readFileSync(filePath);
  const header = Buffer.from(`blob ${content.length}\0`, "utf8");
  return crypto.createHash("sha1").update(header).update(content).digest("hex");
}

function execute() {
  return spawnSync(process.execPath, [
    VALIDATOR,
    "--root", TEMP_ROOT,
    "--policy", POLICY_REF,
    "--schema", POLICY_SCHEMA_REF
  ], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function expectAccepted(label) {
  const result = execute();
  assert.equal(result.status, 0, `${label}: expected accepted admission state.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  assertions += 1;
}

function expectRejected(label, expected) {
  const result = execute();
  assert.notEqual(result.status, 0, `${label}: invalid admission state was accepted.\n${result.stdout}`);
  if (expected) assert.match(result.stderr, expected, `${label}: unexpected rejection.\n${result.stderr}`);
  assertions += expected ? 2 : 1;
}

function resetFixture() {
  fs.rmSync(TEMP_ROOT, { recursive: true, force: true });
  fs.mkdirSync(TEMP_ROOT, { recursive: true });
  for (const ref of [POLICY_REF, POLICY_SCHEMA_REF, CAPABILITIES_REF, CAPABILITY_SCHEMA_REF, "rules.md"]) copy(ref);
  const policy = readJson(POLICY_REF);
  const resolverRefs = [...new Set(policy.rules.map((rule) => rule?.resolver?.ref).filter((ref) =>
    typeof ref === "string" && fs.existsSync(path.join(ROOT, ref))))];
  for (const ref of resolverRefs) copy(ref);
}

function appendRules(text) {
  const file = path.join(TEMP_ROOT, "rules.md");
  fs.appendFileSync(file, `\n${text.trim()}\n`);
  return gitBlobSha(file);
}

function listRationale(anchor) {
  const policy = readJson(POLICY_REF);
  policy.rationaleSections.push({
    anchor,
    destination: "rationale",
    reason: "Fixture heading admitted as rationale, not as a gate."
  });
  writeJson(POLICY_REF, policy);
}

function addAdmission({ kind, sha, ruleIds = [], note = "8F regression fixture admission." }) {
  const policy = readJson(POLICY_REF);
  const next = String(policy.admissionBoundary.admissions.length + 1).padStart(3, "0");
  policy.admissionBoundary.admissions.push({
    id: `ADM-RULES-${next}`,
    kind,
    rulesFileGitBlobSha: sha,
    ruleIds,
    note
  });
  writeJson(POLICY_REF, policy);
}

try {
  resetFixture();
  expectAccepted("frozen-legacy-baseline");

  resetFixture();
  appendRules("## Nova regra prose-only\n\nToda implementação deve usar um framework hipotético.");
  expectRejected("unadmitted-rules-revision", /rules\.md revision is not admitted/);

  resetFixture();
  const rationaleSha = appendRules("## Nota de rationale\n\nContexto histórico sem autoridade operacional.");
  addAdmission({ kind: "rationale-only", sha: rationaleSha });
  listRationale("nota-de-rationale");
  expectAccepted("rationale-only-explicitly-admitted");

  resetFixture();
  const rationaleWithRuleSha = appendRules("## Nota de rationale inválida\n\nNão deve reivindicar rule id.");
  addAdmission({ kind: "rationale-only", sha: rationaleWithRuleSha, ruleIds: ["RULE-SDE-PLACEHOLDER-001"] });
  expectRejected("rationale-only-cannot-claim-rule", /rationale-only admission cannot claim operational rule ids|schema:/);

  resetFixture();
  const registeredNoRuleSha = appendRules("## Governança sem registry id\n\nMudança classificada incorretamente.");
  addAdmission({ kind: "registered-governance", sha: registeredNoRuleSha, ruleIds: [] });
  expectRejected("registered-governance-requires-rule", /registered-governance admission requires at least one registered rule id|schema:/);

  resetFixture();
  const unknownRuleSha = appendRules("## Governança com id inexistente\n\nMudança classificada incorretamente.");
  addAdmission({ kind: "registered-governance", sha: unknownRuleSha, ruleIds: ["RULE-SDE-UNKNOWN-999"] });
  expectRejected("registered-governance-rejects-unknown-rule", /unknown registry rule/);

  resetFixture();
  const registeredSha = appendRules("## Ajuste governado\n\nRevisão ligada explicitamente a uma regra registrada existente.");
  addAdmission({ kind: "registered-governance", sha: registeredSha, ruleIds: ["RULE-SDE-ADMISSION-001"] });
  listRationale("ajuste-governado");
  expectAccepted("registered-governance-explicitly-admitted");

  resetFixture();
  const duplicatePolicy = readJson(POLICY_REF);
  duplicatePolicy.admissionBoundary.admissions.push({
    id: "ADM-RULES-002",
    kind: "rationale-only",
    rulesFileGitBlobSha: duplicatePolicy.admissionBoundary.admissions[0].rulesFileGitBlobSha,
    ruleIds: [],
    note: "Duplicate revision must be rejected."
  });
  writeJson(POLICY_REF, duplicatePolicy);
  expectRejected("duplicate-admitted-revision", /already admitted/);

  resetFixture();
  const baselineMismatch = readJson(POLICY_REF);
  baselineMismatch.admissionBoundary.legacyBaseline.rulesFileGitBlobSha = "0000000000000000000000000000000000000000";
  writeJson(POLICY_REF, baselineMismatch);
  expectRejected("legacy-baseline-must-match-first-admission", /legacyBaseline\.rulesFileGitBlobSha must match/);

  resetFixture();
  const nonOperational = readJson(POLICY_REF);
  nonOperational.admissionBoundary.unregisteredAdditions = "operative";
  writeJson(POLICY_REF, nonOperational);
  expectRejected("unregistered-additions-cannot-be-operative", /Unregistered rules\.md additions must be non-operative|schema:/);

  console.log(`Governance rule admission Phase 8F regression suite passed (${assertions} assertions).`);
} finally {
  fs.rmSync(TEMP_ROOT, { recursive: true, force: true });
}
