#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  canonicalDigest,
  createCapabilityReceipt,
  createHumanDecisionDraft,
  verifyCapabilityReceipt,
  verifyHumanDecision
} from "../frontend/ui-engineering-control.mjs";

let assertions = 0;
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "ui-receipts-"));

function equal(actual, expected, message) {
  assertions += 1;
  assert.deepEqual(actual, expected, message);
}

function ok(value, message) {
  assertions += 1;
  assert.ok(value, message);
}

try {
  const input = path.join(temp, "input.json");
  const output = path.join(temp, "output.json");
  fs.writeFileSync(input, '{"input":"governed"}\n');
  fs.writeFileSync(output, '{"output":"derived"}\n');

  const receipt = createCapabilityReceipt({
    capabilityId: "frontend-ui-policy-control",
    command: ["profile", "--input", "input.json"],
    subject: { project: "fixture", commit: "b".repeat(40) },
    policyDigest: "c".repeat(64),
    adapterDigest: "d".repeat(64),
    browserDigest: null,
    fixtureDigest: "e".repeat(64),
    inputs: [input],
    outputs: [output],
    exitCode: 0
  });
  equal(verifyCapabilityReceipt(receipt, { baseDirectory: temp }), { valid: true, successful: true, errors: [] }, "An intact real-execution receipt must verify.");

  const failedExecution = createCapabilityReceipt({
    capabilityId: "frontend-ui-source-control",
    command: ["lint"],
    subject: receipt.subject,
    policyDigest: receipt.policyDigest,
    inputs: [input],
    outputs: [output],
    exitCode: 1
  });
  equal(verifyCapabilityReceipt(failedExecution, { baseDirectory: temp }).valid, true, "A failed real execution still has a verifiable integrity receipt.");
  equal(verifyCapabilityReceipt(failedExecution, { baseDirectory: temp }).successful, false, "A failed execution receipt must not claim success.");
  equal(verifyCapabilityReceipt(failedExecution, { baseDirectory: temp, requireSuccess: true }).valid, false, "A failed execution receipt cannot release a gate.");

  const stale = structuredClone(receipt);
  stale.subject.commit = "f".repeat(40);
  ok(!verifyCapabilityReceipt(stale, { baseDirectory: temp }).valid, "Changing the commit must invalidate a receipt.");

  fs.writeFileSync(output, '{"output":"tampered"}\n');
  ok(!verifyCapabilityReceipt(receipt, { baseDirectory: temp }).valid, "Changing an output must invalidate a receipt.");
  fs.writeFileSync(output, '{"output":"derived"}\n');

  const blocked = { artifactKind: "ui-quality-gate", eligible: false, blockingFindingIds: ["UI-01"] };
  assert.throws(() => createHumanDecisionDraft(blocked, { principal: "reviewer", decision: "approved" }), /eligible/i);
  assertions += 1;

  const gate = {
    artifactKind: "ui-quality-gate",
    schemaVersion: "1.0.0",
    eligible: true,
    blockingFindingIds: [],
    subject: receipt.subject,
    policyDigest: receipt.policyDigest,
    receiptDigests: [receipt.semanticDigest]
  };
  gate.semanticDigest = canonicalDigest(gate);
  const decision = createHumanDecisionDraft(gate, {
    principal: "reviewer",
    decision: "approved",
    authorityScope: { kind: "release-authorization", evidenceRefs: ["evidence/objective-gate.json"] }
  });
  const decisionPath = path.join(temp, "human-decision-receipt.json");
  const keyPath = path.join(temp, "reviewer_key");
  const allowedSigners = path.join(temp, "allowed_signers");
  fs.writeFileSync(decisionPath, `${JSON.stringify(decision, null, 2)}\n`);

  const keygen = spawnSync("ssh-keygen", ["-q", "-t", "ed25519", "-N", "", "-f", keyPath], { encoding: "utf8" });
  equal(keygen.status, 0, `ssh-keygen failed: ${keygen.stderr}`);
  fs.writeFileSync(allowedSigners, `reviewer ${fs.readFileSync(`${keyPath}.pub`, "utf8").trim()}\n`);
  const sign = spawnSync("ssh-keygen", ["-Y", "sign", "-f", keyPath, "-n", "sde-human-decision-v1", decisionPath], { encoding: "utf8" });
  equal(sign.status, 0, `OpenSSH signing failed: ${sign.stderr}`);

  const verified = verifyHumanDecision({
    decisionPath,
    signaturePath: `${decisionPath}.sig`,
    allowedSignersPath: allowedSigners,
    principal: "reviewer", gate, purpose: "release-authorization"
  });
  equal(verified.valid, true, `Signed human decision must verify: ${verified.errors?.join(", ")}`);

  // Every negative decision below is signed with the same valid fixture key.
  for (const [label, mutate] of [
    ["rejected", value => { value.decision = "rejected"; }],
    ["other gate", value => { value.gateDigest = "f".repeat(64); }],
    ["other project", value => { value.subject.project = "another-project"; }],
    ["product authority", value => { value.authorityScope.kind = "product-truth"; }],
    ["pending conditions", value => { value.conditions = ["review pending"]; }],
    ["expired risk", value => { value.decision = "approved-with-accepted-risk"; value.risk = { id: "R-1", owner: "team", scope: "fixture", expiry: "2000-01-01", mitigation: "pending" }; }]
  ]) {
    const candidate = structuredClone(decision); mutate(candidate); candidate.semanticDigest = canonicalDigest(candidate);
    const candidatePath = path.join(temp, `${label.replaceAll(" ", "-")}.json`);
    fs.writeFileSync(candidatePath, JSON.stringify(candidate));
    equal(spawnSync("ssh-keygen", ["-Y", "sign", "-f", keyPath, "-n", "sde-human-decision-v1", candidatePath]).status, 0, "Negative fixture must have a real signature");
    equal(verifyHumanDecision({ decisionPath: candidatePath, signaturePath: `${candidatePath}.sig`, allowedSignersPath: allowedSigners, principal: "reviewer", gate, purpose: "release-authorization" }).valid, false, `${label} cannot authorize current gate`);
  }

  const wrongPrincipal = verifyHumanDecision({
    decisionPath,
    signaturePath: `${decisionPath}.sig`,
    allowedSignersPath: allowedSigners,
    principal: "other-reviewer", gate, purpose: "release-authorization"
  });
  equal(wrongPrincipal.valid, false, "A different principal must not verify.");

  assert.throws(() => createHumanDecisionDraft(gate, {
    principal: "reviewer",
    decision: "approved-with-accepted-risk",
    authorityScope: { kind: "accepted-risk", evidenceRefs: ["evidence/risk.json"] },
    risk: { id: "R-1", owner: "team" }
  }), /scope|expiry|mitigation/i);
  assertions += 1;
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

console.log(`UI evidence receipt tests passed (${assertions} assertions).`);
