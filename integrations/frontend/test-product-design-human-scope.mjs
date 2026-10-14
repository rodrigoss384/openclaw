#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  canonicalProductDesignDigest,
  evaluateProductDesignReadiness,
  validateHumanDecisionScope
} from "./product-design-control.mjs";
import { createHumanDecisionDraft } from "./ui-engineering-control.mjs";

const allowedScopes = [
  "product-truth",
  "brand-or-asset-rights",
  "critical-consequence",
  "accepted-risk",
  "broad-build-authorization",
  "release-authorization"
];
const subject = { project: "fixture", commit: "a".repeat(40) };
const policyDigest = "9".repeat(64);
let assertions = 0;

function signed(artifactKind, value) {
  const result = { artifactKind, schemaVersion: "1.0.0", ...value };
  result.semanticDigest = canonicalProductDesignDigest(result);
  return result;
}

function receipt(kind) {
  return { kind, evidenceRefs: ["evidence/human-authority.json"] };
}

function gateInput(humanReceipts) {
  const brief = signed("product-design-brief", { subject });
  const research = signed("visual-research", { subject, briefDigest: brief.semanticDigest });
  const decision = signed("design-authority-decision", {
    subject,
    briefDigest: brief.semanticDigest,
    researchDigest: research.semanticDigest,
    visualDirectionSelectedBy: "agent"
  });
  return { subject, brief, research, decision, assetRequirements: null, assetSidecars: [], policyDigest, findings: [], humanReceipts };
}

for (const kind of allowedScopes) {
  assert.deepEqual(validateHumanDecisionScope(receipt(kind)), { valid: true, errors: [] });
  assertions += 1;
}

const aesthetic = validateHumanDecisionScope(receipt("visual-quality-approval"));
assert.equal(aesthetic.valid, false);
assert.ok(aesthetic.errors.some((error) => /scope/i.test(error)));
assertions += 2;

const empty = validateHumanDecisionScope({ kind: "product-truth", evidenceRefs: [] });
assert.equal(empty.valid, false);
assertions += 1;

const objectiveGate = {
  eligible: true,
  subject,
  semanticDigest: "1".repeat(64),
  policyDigest,
  receiptDigests: []
};
const draft = createHumanDecisionDraft(objectiveGate, {
  principal: "release-owner",
  decision: "approved",
  authorityScope: receipt("broad-build-authorization")
});
assert.equal(draft.authorityScope.kind, "broad-build-authorization");
assertions += 1;

assert.throws(() => createHumanDecisionDraft(objectiveGate, {
  principal: "designer",
  decision: "approved",
  authorityScope: receipt("visual-quality-approval")
}), /scope/i);
assertions += 1;

const validGate = evaluateProductDesignReadiness(gateInput([receipt("product-truth")]));
assert.equal(validGate.readiness.status, "passed");
assertions += 1;

const invalidGate = evaluateProductDesignReadiness(gateInput([receipt("visual-quality-approval")]));
assert.equal(invalidGate.readiness.status, "failed");
assert.ok(invalidGate.findings.some((item) => item.id === "PDA-13"));
assertions += 2;

console.log(`Product design human authority scope suite passed (${assertions} assertions).`);
