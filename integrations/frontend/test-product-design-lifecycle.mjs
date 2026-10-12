#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  canonicalProductDesignDigest,
  evaluateProductDesignReadiness,
  verifyProductDesignReadiness
} from "./product-design-control.mjs";

const subject = { project: "lifecycle-fixture", commit: "a".repeat(40) };
const policyDigest = "b".repeat(64);
let assertions = 0;

function seal(artifactKind, fields, artifactSubject = subject) {
  const value = { artifactKind, schemaVersion: "1.0.0", subject: artifactSubject, ...fields };
  value.semanticDigest = canonicalProductDesignDigest(value);
  return value;
}

function baseline() {
  const brief = seal("product-design-brief", { product: { name: "Evidence Control" }, audience: { primary: "operator" }, task: { dominant: "verify" } });
  const research = seal("visual-research", { briefDigest: brief.semanticDigest, references: [{ id: "REF-1" }] });
  const decision = seal("design-authority-decision", { briefDigest: brief.semanticDigest, researchDigest: research.semanticDigest, visualDirectionSelectedBy: "agent", thesis: "contextual evidence rail" });
  const assetRequirements = seal("asset-requirements", { decisionDigest: decision.semanticDigest, assets: [{ id: "hero", equivalentAvailable: false, materialLossWithoutAsset: true }] });
  const assetSidecar = seal("approved-product-asset", { assetId: "hero", fileDigest: "c".repeat(64), license: { id: "CC0-1.0", sourceUrl: "https://example.com/license", verifiedAt: "2026-08-26" }, rightsAttestation: { origin: "fixture", rightToUse: true, attestedAt: "2026-08-26" } });
  return { subject, brief, research, decision, assetRequirements, assetSidecars: [assetSidecar], policyDigest, humanReceipts: [] };
}

const pathA = { z: 1, originalPath: "/home/person/inbox/a.png", nested: { b: 2, a: 1 }, capturedAt: "2026-08-26T10:00:00Z" };
const pathB = { nested: { a: 1, b: 2 }, capturedAt: "2030-01-01T00:00:00Z", originalPath: "/tmp/other.png", z: 1 };
assert.equal(canonicalProductDesignDigest(pathA), canonicalProductDesignDigest(pathB), "Digest must ignore paths/timestamps and key order.");
assertions += 1;

const input = baseline();
const initial = evaluateProductDesignReadiness(input);
assert.equal(initial.readiness.status, "passed");
assert.equal(verifyProductDesignReadiness({ ...input, readiness: initial.readiness }).status, "passed");
assert.equal(evaluateProductDesignReadiness(baseline()).readiness.semanticDigest, initial.readiness.semanticDigest, "Frozen inputs must produce the same readiness digest.");
assertions += 3;

const mutations = [
  ["product", "PDA-01", (value) => { value.brief.product.name = "Mutated"; }],
  ["direction", "PDA-03", (value) => { value.decision.thesis = "mutated"; }],
  ["research", "PDA-06", (value) => { value.research.references.push({ id: "REF-X" }); }],
  ["asset", "PDA-10", (value) => { value.assetSidecars[0].fileDigest = "d".repeat(64); }],
  ["license", "PDA-10", (value) => { value.assetSidecars[0].license.id = "CC-BY-SA-4.0"; }],
  ["commit", "PDA-01", (value) => { value.brief.subject = { ...value.brief.subject, commit: "e".repeat(40) }; value.brief.semanticDigest = canonicalProductDesignDigest(value.brief); }],
  ["policy", "PDA-13", (value) => { value.policyDigest = "invalid"; }]
];
for (const [name, expected, mutate] of mutations) {
  const changed = structuredClone(input);
  mutate(changed);
  const result = evaluateProductDesignReadiness(changed);
  assert.notEqual(result.readiness.semanticDigest, initial.readiness.semanticDigest, `${name}: dependent readiness digest must change.`);
  assert.ok(result.findings.some((finding) => finding.id === expected), `${name}: expected ${expected}.`);
  assert.notEqual(result.readiness.status, "passed", `${name}: stale dependency cannot pass.`);
  assertions += 3;
}

const downstreamReceipt = (browserDigest) => canonicalProductDesignDigest({
  productDesignReadinessDigest: initial.readiness.semanticDigest,
  browserDigest,
  commit: subject.commit,
  policyDigest
});
assert.notEqual(downstreamReceipt("1".repeat(64)), downstreamReceipt("2".repeat(64)), "Browser mutation must invalidate its downstream receipt digest without changing the upstream Product Design decision.");
assertions += 1;

console.log(`Product design lifecycle tests passed (${assertions} assertions).`);
