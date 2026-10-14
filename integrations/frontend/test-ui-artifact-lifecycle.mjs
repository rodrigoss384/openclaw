#!/usr/bin/env node
import assert from "node:assert/strict";
import { canonicalDigest, createClientDeliveryAttestation, scanPrivateContent } from "./ui-engineering-control.mjs";

let assertions = 0;
function equal(actual, expected, message) {
  assertions += 1;
  assert.deepEqual(actual, expected, message);
}

const gate = {
  artifactKind: "ui-quality-gate",
  schemaVersion: "1.0.0",
  subject: { project: "fixture", commit: "a".repeat(40) },
  policyDigest: "b".repeat(64),
  semanticDigest: "c".repeat(64),
  eligible: true,
  blockingFindingIds: [],
  receiptDigests: ["d".repeat(64)]
};
gate.semanticDigest = canonicalDigest(gate);
const decision = {
  artifactKind: "human-decision-receipt",
  schemaVersion: "1.0.0",
  principal: "reviewer",
  decision: "approved",
  subject: gate.subject, policyDigest: gate.policyDigest, receiptDigests: gate.receiptDigests,
  authorityScope: { kind: "release-authorization", evidenceRefs: ["evidence/gate.json"] },
  gateDigest: gate.semanticDigest,
  semanticDigest: "e".repeat(64)
};

const attestation = createClientDeliveryAttestation(gate, decision);
equal(Object.keys(attestation).sort(), [
  "artifactKind",
  "decision",
  "decisionDigest",
  "gateDigest",
  "policyDigest",
  "receiptDigests",
  "schemaVersion",
  "semanticDigest",
  "subject"
].sort(), "Client delivery must use a closed metadata allowlist.");
equal(scanPrivateContent(attestation), [], "A sanitized attestation must pass privacy scan.");

for (const mutation of [
  { ...attestation, screenshot: "data:image/png;base64,AAAA" },
  { ...attestation, domText: "Cliente Maria da Silva" },
  { ...attestation, debugPath: "/home/rodrigo/private/evidence.json" },
  { ...attestation, token: "ghp_123456789012345678901234567890123456" },
  { ...attestation, contact: "private@example.com" }
]) {
  assert.ok(scanPrivateContent(mutation).length > 0, "Private delivery mutation must be blocked.");
  assertions += 1;
}

assert.throws(() => createClientDeliveryAttestation({ ...gate, eligible: false }, decision), /eligible/i);
assertions += 1;
assert.throws(() => createClientDeliveryAttestation(gate, { ...decision, gateDigest: "f".repeat(64) }), /gate digest/i);
assertions += 1;

console.log(`UI artifact lifecycle tests passed (${assertions} assertions).`);
