#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeFindingBatch } from "./finding-normalizer.mjs";
import { buildRepresentativeTransition } from "./representative-control.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../..");
const policy = JSON.parse(fs.readFileSync(path.join(ROOT, "prompts/spec-driven/frontend-craft-policy.json"), "utf8"));
const reportSchema = JSON.parse(fs.readFileSync(path.join(ROOT, "integrations/impeccable/frontend-representative-loop.schema.json"), "utf8"));
const H = (ch) => ch.repeat(64);
const objectiveAudit = { status: "passed", command: "phase5-objective-audit" };

function critique(findings, overrides = {}) {
  return {
    screenId: "cases",
    source: "impeccable-critique",
    provider: { id: "impeccable", version: "3.5.0" },
    command: "critique",
    sourceArtifact: "evidence/critique.json",
    findings,
    ...overrides
  };
}

function finding(className, defectKind = "implementation", material = true, extra = {}) {
  return {
    class: className,
    defectKind,
    summary: `${className} example`,
    severity: "p2",
    material,
    evidenceRefs: ["screenshot:wide"],
    ...extra
  };
}

function transition({ evidence = H("a"), previousReport = null, envelope = null, polishRequested = false } = {}) {
  return buildRepresentativeTransition({
    root: ROOT,
    policy,
    reportSchema,
    screenId: "cases",
    stateId: "data",
    evidenceSha256: evidence,
    craftContractSha256: H("b"),
    contractSetSha256: H("c"),
    previousReport,
    critiqueEnvelope: envelope,
    polishRequested,
    objectiveAudit
  });
}

assert.equal(policy.repairLoop.maxCraftRounds, 2);
assert.equal(policy.repairLoop.maxPolishRounds, 1);
assert.equal(policy.repairLoop.noMaterialFindingTransition, "human-gate");
assert.equal(policy.repairLoop.contractFindingTransition, "design-readiness");

const initial = transition();
assert.equal(initial.phase, "critique-required");
assert.equal(initial.nextActions[0].type, "run-critique");

const clean = transition({ envelope: critique([]) });
assert.equal(clean.phase, "human-gate-ready");
assert.equal(clean.humanGate.eligible, true);

const implementation = transition({ envelope: critique([finding("spatial-density")]) });
assert.equal(implementation.phase, "repair-required");
assert.equal(implementation.counters.craftRoundsUsed, 0);
assert.equal(implementation.routes[0].returnStage, "PATCH");
assert.equal(implementation.routes[0].providerCommand.name, "layout");
assert.deepEqual(implementation.nextActions.slice(-3).map((action) => action.type), ["rerender", "reaudit", "recritique"]);

const explicitApproval = transition({ envelope: critique([finding("accent-overuse")]) });
const quieter = explicitApproval.nextActions.find((action) => action.command === "quieter");
assert.ok(quieter);
assert.equal(quieter.requiresHumanApproval, true);

const contractReturn = transition({ envelope: critique([finding("wayfinding", "contract")]) });
assert.equal(contractReturn.phase, "design-readiness-return");
assert.equal(contractReturn.humanGate.eligible, false);
assert.equal(contractReturn.routes[0].providerCommand, null);
assert.equal(contractReturn.nextActions[0].stage, "DESIGN_READINESS");

const round2 = transition({ evidence: H("d"), previousReport: implementation, envelope: critique([finding("text-hierarchy")]) });
assert.equal(round2.phase, "repair-required");
assert.equal(round2.counters.craftRoundsUsed, 1);

const afterRound2 = transition({ evidence: H("e"), previousReport: round2, envelope: critique([finding("surface-economy")]) });
assert.equal(afterRound2.phase, "exhausted");
assert.equal(afterRound2.counters.craftRoundsUsed, 2);
assert.equal(afterRound2.nextActions[0].type, "stop-escalate");

assert.throws(
  () => transition({ evidence: implementation.evidenceSha256, previousReport: implementation, envelope: critique([]) }),
  /rerendered evidence/
);

const polish = transition({ envelope: critique([]), polishRequested: true });
assert.equal(polish.phase, "polish-required");
assert.equal(polish.counters.polishRoundsUsed, 0);
assert.equal(polish.nextActions[0].command, "polish");

const afterPolish = transition({ evidence: H("f"), previousReport: polish, envelope: critique([]), polishRequested: true });
assert.equal(afterPolish.phase, "human-gate-ready");
assert.equal(afterPolish.counters.polishRoundsUsed, 1);

assert.throws(
  () => normalizeFindingBatch({ root: ROOT, policy, envelope: critique([{ summary: "free text only", material: true }]) }),
  /never infers class, defectKind, or materiality/
);
assert.throws(
  () => normalizeFindingBatch({ root: ROOT, policy, envelope: critique([finding("spatial-density")], { provider: { id: "impeccable", version: "3.5.1" } }) }),
  /exactly impeccable@3.5.0/
);

const nonMaterial = transition({ envelope: critique([finding("content-clarity", "implementation", false)]) });
assert.equal(nonMaterial.phase, "human-gate-ready");
assert.equal(nonMaterial.critique.totalFindings, 1);
assert.equal(nonMaterial.critique.materialFindings, 0);

console.log("Phase 6 representative closed repair loop tests passed.");
