#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalProductDesignDigest,
  validateProductDesignReadinessReceipt
} from "../frontend/product-design-control.mjs";
import { deriveUiQualityGate } from "../frontend/ui-engineering-control.mjs";
import { buildRepresentativeTransition } from "./representative-control.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, "../..");
const policy = JSON.parse(fs.readFileSync(path.join(root, "prompts/spec-driven/frontend-craft-policy.json"), "utf8"));
const reportSchema = JSON.parse(fs.readFileSync(path.join(root, "integrations/impeccable/frontend-representative-loop.schema.json"), "utf8"));
const hash = (character) => character.repeat(64);
const subject = { project: "fixture", commit: "a".repeat(40) };
const productReadiness = {
  artifactKind: "product-design-readiness", schemaVersion: "1.0.0", subject,
  briefDigest: hash("1"), researchDigest: hash("2"), decisionDigest: hash("3"), assetDigests: [], policyDigest: hash("9"),
  status: "passed", visualDirectionSelectedBy: "agent", blockingFindingIds: [],
  dependencyDigests: { brief: hash("1"), research: hash("2"), decision: hash("3"), policy: hash("9"), assets: hash("4"), humanScope: hash("5") }
};
productReadiness.semanticDigest = canonicalProductDesignDigest(productReadiness);
let assertions = 0;

const validReceipt = validateProductDesignReadinessReceipt(productReadiness, { subject, policyDigest: hash("9") });
assert.equal(validReceipt.passed, true, "Product Design readiness must pass before browser/craft control begins.");
assertions += 1;

const failedReceipt = structuredClone(productReadiness);
failedReceipt.status = "failed";
failedReceipt.blockingFindingIds = ["PDA-03"];
failedReceipt.semanticDigest = canonicalProductDesignDigest(failedReceipt);
assert.equal(validateProductDesignReadinessReceipt(failedReceipt, { subject, policyDigest: hash("9") }).passed, false, "Failed Product Design readiness must block downstream craft.");
assertions += 1;

function transition(critiqueEnvelope = null) {
  return buildRepresentativeTransition({
    root, policy, reportSchema, screenId: "cases", stateId: "data",
    evidenceSha256: hash("a"), craftContractSha256: hash("b"), contractSetSha256: hash("c"),
    critiqueEnvelope, objectiveAudit: { status: "passed", command: "phase5-objective-audit" }
  });
}

const afterBrowserEvidence = transition();
assert.equal(afterBrowserEvidence.phase, "critique-required", "Fresh browser/objective evidence must precede Impeccable critique.");
assert.equal(afterBrowserEvidence.nextActions[0].type, "run-critique");
assertions += 2;

const afterCritique = transition({
  screenId: "cases", source: "impeccable-critique", provider: { id: "impeccable", version: "3.5.0" }, command: "critique",
  sourceArtifact: "evidence/critique.json", findings: []
});
assert.equal(afterCritique.phase, "human-gate-ready", "Only post-browser critique convergence may reach the scoped human gate.");
assertions += 1;

const objectiveFindings = {
  subject, policyDigest: hash("9"), productDesignRequired: true,
  findings: [{ id: "UI-01", severity: "P0", source: "ui-engineering-control", message: "Broken grid relation", findingKey: "UI-01:grid" }]
};
const gate = deriveUiQualityGate(objectiveFindings, { impeccable: { findings: [], summary: "looks good" } }, [], productReadiness);
assert.equal(gate.eligible, false, "A positive/empty perceptual critique cannot erase an objective finding.");
assert.ok(gate.blockingFindingIds.includes("UI-01"), "The objective finding ID must survive perceptual synthesis.");
assert.equal(gate.productDesignVerification.passed, true, "Objective UI blocking is downstream and independent from passed Product Design readiness.");
assertions += 3;

console.log(`Product Design readiness ordering tests passed (${assertions} assertions).`);
