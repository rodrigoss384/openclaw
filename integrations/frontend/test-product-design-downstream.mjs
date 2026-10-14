#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  canonicalProductDesignDigest,
  validateProductDesignReadinessReceipt
} from "./product-design-control.mjs";
import { deriveUiQualityGate } from "./ui-engineering-control.mjs";

const subject = { project: "spec-driven-development", commit: "39ed012" };
const policyDigest = "9".repeat(64);
let assertions = 0;

function readiness(status = "passed") {
  const value = {
    artifactKind: "product-design-readiness",
    schemaVersion: "1.0.0",
    subject,
    briefDigest: "1".repeat(64),
    researchDigest: "2".repeat(64),
    decisionDigest: "3".repeat(64),
    assetDigests: [],
    policyDigest,
    status,
    visualDirectionSelectedBy: "agent",
    blockingFindingIds: status === "passed" ? [] : ["PDA-03"],
    dependencyDigests: {
      brief: "1".repeat(64), research: "2".repeat(64), decision: "3".repeat(64), policy: policyDigest, assets: "4".repeat(64)
    }
  };
  value.semanticDigest = canonicalProductDesignDigest(value);
  return value;
}

const passed = validateProductDesignReadinessReceipt(readiness(), { subject, policyDigest });
assert.equal(passed.valid, true);
assert.equal(passed.passed, true);
assert.equal(passed.stale, false);
assert.deepEqual(passed.errors, []);
assertions += 4;

const failed = validateProductDesignReadinessReceipt(readiness("failed"), { subject, policyDigest });
assert.equal(failed.valid, true);
assert.equal(failed.passed, false);
assert.equal(failed.stale, false);
assertions += 3;

const wrongPolicy = validateProductDesignReadinessReceipt(readiness(), { subject, policyDigest: "0".repeat(64) });
assert.equal(wrongPolicy.valid, false);
assert.equal(wrongPolicy.stale, true);
assert.ok(wrongPolicy.errors.some((error) => /policy/i.test(error)));
assertions += 3;

const findingsInput = { subject, policyDigest, productDesignRequired: true, findings: [] };
const missingGate = deriveUiQualityGate(findingsInput, {}, [], null);
assert.ok(missingGate.blockingFindingIds.includes("UI-PRODUCT-DESIGN-NOT-RUN"));
assertions += 1;

const failedGate = deriveUiQualityGate(findingsInput, {}, [], readiness("failed"));
assert.ok(failedGate.blockingFindingIds.includes("UI-PRODUCT-DESIGN-FAILED"));
assertions += 1;

const staleReceipt = readiness();
staleReceipt.policyDigest = "0".repeat(64);
const staleGate = deriveUiQualityGate(findingsInput, {}, [], staleReceipt);
assert.ok(staleGate.blockingFindingIds.includes("UI-PRODUCT-DESIGN-STALE"));
assertions += 1;

const passedGate = deriveUiQualityGate(findingsInput, {}, [], readiness());
assert.equal(passedGate.productDesignVerification.passed, true);
assert.ok(!passedGate.blockingFindingIds.some((id) => id.startsWith("UI-PRODUCT-DESIGN-")));
assertions += 2;

console.log(`Product design downstream gate suite passed (${assertions} assertions).`);
