#!/usr/bin/env node
import { digest as executionDigest } from "../governance/execution-context.mjs";

// Contract for the two gates closest to release.
//
// 08-adversarial.prompt.md and 09-validate-evidence.prompt.md used to call
// `governance-control.mjs bootstrap` only (rollout-mode metadata, not a check)
// and enumerate individual scripts in prose instead — the exact
// remember-to-run-it pattern this workflow was built to eliminate everywhere
// else. Three of those prose-only scripts (audit-test-integrity.mjs,
// frontend-family-consistency.mjs, autonomy-evidence.mjs check) were not even
// registered as governance rules or capabilities: nothing could have run them
// mechanically even if the two prompts had called `enforce`.
//
// This locks in: all three are real capabilities that resolveEffectivePolicy
// surfaces at the correct stage, and the autonomy ledger check specifically
// integrates cleanly through `enforce` when no ledger exists (a legitimate
// not-applicable outcome for a feature with no durable-recording decision,
// not a failure to be worked around).
//
// Making frontend-family-consistency-control an unconditional hard-invariant
// created the same shape of problem for a different reason: a brand-new
// single-screen family has nothing to compare, but "no manifest" cannot mean
// "skip silently" the way it does for the autonomy ledger (there is no
// structural guarantee a missing manifest means the family is genuinely
// singular). The fix is an explicit, recorded --not-applicable declaration
// the adversarial stage can independently judge, not a free pass -- this also
// locks that both directions (a real manifest, and an explicit
// not-applicable) resolve through enforce's --set mechanism.

import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../..");
const CONTROLLER = path.join(SCRIPT_DIR, "governance-control.mjs");

const APPLICABILITY = `# adversarial-evidence-enforcement — Applicability Contract

\`\`\`text
complexity: medium
criticality: standard
frontend: substantial
backend: substantial
persistence: not-applicable
public-api: unchanged
auth: not-applicable
tenancy: not-applicable
concurrency: not-applicable
migration: not-applicable
new-service-or-subsystem: not-applicable
material-operational-cost: not-applicable
performance: not-applicable
accessibility: not-applicable
frontend-representative-gate: required
backend-representative-gate: not-required
browser-evidence: hard-required
contract-drift-check: not-applicable
interface-contract: not-applicable
interface-contract-kind: none
interface-contract-type: none
behavioral-ux: not-applicable
behavioral-ux-risk: none
outcome-evidence: not-applicable
\`\`\`

## Racional

Fixture used by test-adversarial-evidence-release-enforcement.mjs.
`;

let assertions = 0;
const featureSlug = `adv-evrel-${process.pid}`;
const featureDirectory = path.join(ROOT, ".specs", "features", featureSlug);
const createdFeaturesRoot = !fs.existsSync(path.join(ROOT, ".specs", "features"));

fs.mkdirSync(featureDirectory, { recursive: true });
fs.writeFileSync(path.join(featureDirectory, "applicability.md"), APPLICABILITY);

function enforce(stage, extraArgs = []) {
  const result = spawnSync(
    process.execPath,
    [
      CONTROLLER, "enforce",
      "--root", ROOT,
      "--stage", stage,
      "--feature", featureSlug,
      ...extraArgs
    ],
    { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );

  let report = null;
  try {
    report = JSON.parse(result.stdout || "{}");
  } catch {
    report = null;
  }

  return { status: result.status, stdout: result.stdout, stderr: result.stderr, report };
}

try {
  // 1. The three previously prose-only checks must now be registered rules
  //    that resolveEffectivePolicy actually surfaces at the right stage.
  const adversarial = enforce("adversarial", ["--dry-run"]);
  assert.ok(adversarial.report, `enforce adversarial --dry-run must emit a report.\n${adversarial.stderr}`);
  assert.ok(
    adversarial.report.requiredEnforcements.includes("frontend-family-consistency-control"),
    "cross-screen/cross-theme family consistency must be required at the adversarial stage"
  );
  assertions += 2;

  const evidenceRelease = enforce("evidence-release", ["--dry-run"]);
  assert.ok(evidenceRelease.report, `enforce evidence-release --dry-run must emit a report.\n${evidenceRelease.stderr}`);
  for (const capabilityId of [
    "backend-test-integrity-audit",
    "frontend-family-consistency-control",
    "autonomy-decision-evidence-check"
  ]) {
    assert.ok(
      evidenceRelease.report.requiredEnforcements.includes(capabilityId),
      `${capabilityId} must be required at the evidence-release stage`
    );
    assertions += 1;
  }

  // 2. The test-integrity audit needs an explicit Git baseline that enforce
  //    cannot guess -- it must be named as unresolved, never silently skipped
  //    or auto-defaulted to something like HEAD~1.
  const testIntegrityRow = evidenceRelease.report.executions.find(
    (item) => item.capabilityId === "backend-test-integrity-audit"
  );
  assert.ok(testIntegrityRow, "backend-test-integrity-audit must have an execution row");
  assert.equal(testIntegrityRow.status, "unresolved-input");
  assert.match(testIntegrityRow.detail, /--set/);
  assert.match(testIntegrityRow.detail, /base/);
  assertions += 3;

  // 3. autonomy-decision-evidence-check needs no --set at all: <project-root>
  //    and <feature-directory> both auto-resolve, so a real (non-dry-run) run
  //    can execute it directly.
  const baseCommit = spawnSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).stdout.trim();
  fs.writeFileSync(path.join(featureDirectory, "execution-context.json"), JSON.stringify({ feature: featureSlug, baseCommit, applicabilitySha256: executionDigest(fs.readFileSync(path.join(featureDirectory, "applicability.md"))), frontendPaths: [], backendPaths: [], testPaths: [] }));
  fs.writeFileSync(path.join(featureDirectory, "autonomy-required.json"), JSON.stringify({ feature: featureSlug, directives: [] }));
  const real = enforce("evidence-release");
  const autonomyRow = real.report?.executions.find(
    (item) => item.capabilityId === "autonomy-decision-evidence-check"
  );
  assert.ok(autonomyRow, "autonomy-decision-evidence-check must have an execution row");
  assert.ok(
    !/<[a-z-]+>/i.test(autonomyRow.command || ""),
    `autonomy-decision-evidence-check must be fully auto-resolved, no --set needed.\nCommand: ${autonomyRow.command}`
  );
  assertions += 2;

  // No autonomous-decisions.json exists for this fixture feature (no
  // decision ever required durable recording) -- that must come back as a
  // clean pass through `enforce`, not a blocking failure the agent has to
  // work around.
  assert.equal(
    autonomyRow.status,
    "passed",
    `A missing ledger for a feature with no durable-recording decision must not block.\n${JSON.stringify(autonomyRow, null, 2)}`
  );
  assertions += 1;

  // 4. Without --set, frontend-family-consistency-control must be named as
  //    unresolved -- a single-screen family cannot silently skip the check
  //    the way a missing autonomy ledger does.
  const familyRow = evidenceRelease.report.executions.find(
    (item) => item.capabilityId === "frontend-family-consistency-control"
  );
  assert.ok(familyRow, "frontend-family-consistency-control must have an execution row");
  assert.equal(familyRow.status, "unresolved-input");
  assert.match(familyRow.detail, /--set/);
  assertions += 2;

  // 5. An explicit --not-applicable declaration, supplied as one --set value,
  //    must resolve into a passing execution -- proving the escape hatch is
  //    reachable through enforce, not just through the standalone script.
  const notApplicableRun = enforce("evidence-release", [
    "--set", "frontend-family-consistency-control=manifest-or-not-applicable=not-applicable",
    "--set", "frontend-family-consistency-control=not-applicable-reason=single-screen-family-single-theme"
  ]);
  const familyNotApplicableRow = notApplicableRun.report?.executions.find(
    (item) => item.capabilityId === "frontend-family-consistency-control"
  );
  assert.ok(familyNotApplicableRow, "frontend-family-consistency-control must have an execution row");
  assert.equal(
    familyNotApplicableRow.status,
    "passed",
    `An explicit --not-applicable declaration must pass through enforce.\n${JSON.stringify(familyNotApplicableRow, null, 2)}`
  );
  assert.ok(
    !/<[a-z-]+>/i.test(familyNotApplicableRow.command || ""),
    "the manifest-or-not-applicable placeholder must be fully substituted, not left as a token"
  );
  assertions += 2;

  // 6. A malformed --not-applicable (no reason) must still fail loudly
  //    through the full enforce path, not just when the script is run
  //    directly.
  const malformedNotApplicable = enforce("evidence-release", [
    "--set", "frontend-family-consistency-control=manifest-or-not-applicable=not-applicable"
  ]);
  const malformedRow = malformedNotApplicable.report?.executions.find(
    (item) => item.capabilityId === "frontend-family-consistency-control"
  );
  assert.ok(malformedRow, "frontend-family-consistency-control must have an execution row");
  assert.equal(malformedRow.status, "unresolved-input", "a --not-applicable with no reason must block before execution");
  assert.notEqual(malformedNotApplicable.status, 0);
  assertions += 1;

  // 7. Three more capabilities were registered but referenced by no rule, so
  //    resolveEffectivePolicy never surfaced them at any stage -- while 09's
  //    prose already claimed "enforce ja roda" each of them. Registering
  //    RULE-FE-NAV-001 / RULE-FE-RETRIEVAL-001 / RULE-FE-SEMANTICS-EVIDENCE-001
  //    is what makes that claim true; lock the stages so the claim cannot
  //    silently become false again.
  for (const capabilityId of [
    "frontend-navigation-capability-control",
    "frontend-global-retrieval-control",
    "frontend-product-semantics-evidence-control"
  ]) {
    assert.ok(
      evidenceRelease.report.requiredEnforcements.includes(capabilityId),
      `${capabilityId} must be required at the evidence-release stage`
    );
    const row = evidenceRelease.report.executions.find((item) => item.capabilityId === capabilityId);
    assert.ok(row, `${capabilityId} must have an execution row`);
    assert.equal(
      row.status,
      "unresolved-input",
      `${capabilityId} must name its missing contract instead of skipping silently.\n${JSON.stringify(row, null, 2)}`
    );
    assertions += 3;
  }

  const frontendRepresentative = enforce("frontend-representative", ["--dry-run"]);
  assert.ok(frontendRepresentative.report, `enforce frontend-representative --dry-run must emit a report.\n${frontendRepresentative.stderr}`);
  for (const capabilityId of [
    "frontend-navigation-capability-control",
    "frontend-global-retrieval-control",
    "frontend-product-semantics-evidence-control"
  ]) {
    assert.ok(
      frontendRepresentative.report.requiredEnforcements.includes(capabilityId),
      `${capabilityId} must be required at the frontend-representative stage`
    );
    assertions += 1;
  }
  assertions += 1;

  // 8. Navigation is the one of the three with no structural guarantee its
  //    contract exists (a feature can touch zero navigation surface), so it
  //    carries the same explicit --not-applicable escape as family
  //    consistency. Prove it resolves through enforce, and that omitting the
  //    reason still fails.
  const navNotApplicable = enforce("evidence-release", [
    "--set", "frontend-navigation-capability-control=contract-or-not-applicable=not-applicable",
    "--set", "frontend-navigation-capability-control=not-applicable-reason=no-navigation-surface-changed"
  ]);
  const navRow = navNotApplicable.report?.executions.find(
    (item) => item.capabilityId === "frontend-navigation-capability-control"
  );
  assert.ok(navRow, "frontend-navigation-capability-control must have an execution row");
  assert.equal(
    navRow.status,
    "passed",
    `An explicit navigation --not-applicable must pass through enforce.\n${JSON.stringify(navRow, null, 2)}`
  );
  assert.ok(
    !/<[a-z-]+>/i.test(navRow.command || ""),
    "the contract-or-not-applicable placeholder must be fully substituted, not left as a token"
  );
  assertions += 3;

  const navMalformed = enforce("evidence-release", [
    "--set", "frontend-navigation-capability-control=contract-or-not-applicable=not-applicable"
  ]);
  const navMalformedRow = navMalformed.report?.executions.find(
    (item) => item.capabilityId === "frontend-navigation-capability-control"
  );
  assert.ok(navMalformedRow, "frontend-navigation-capability-control must have an execution row");
  assert.equal(navMalformedRow.status, "unresolved-input", "a navigation --not-applicable with no reason must not silently pass");
  assertions += 2;

  // 9. Four more enforcement paths existed as working scripts that `enforce`
  //    could never reach:
  //    - the whole screen-audit tree and the small-slice audits were reachable
  //      only by remembering to run the skill's own aggregators;
  //    - the entity-projection auditor had zero invocation anywhere;
  //    - the OpenSSH signature on the human decision was required in prose by
  //      09 and verified by nothing, because `gate` only checks receipts.
  for (const capabilityId of [
    "frontend-screen-readiness-audit",
    "frontend-entity-projection-consistency",
    "frontend-human-decision-verification"
  ]) {
    assert.ok(
      evidenceRelease.report.requiredEnforcements.includes(capabilityId),
      `${capabilityId} must be required at the evidence-release stage`
    );
    assertions += 1;
  }

  for (const capabilityId of [
    "frontend-screen-readiness-audit",
    "frontend-small-slice-gate-audit",
    "frontend-entity-projection-consistency"
  ]) {
    assert.ok(
      frontendRepresentative.report.requiredEnforcements.includes(capabilityId),
      `${capabilityId} must be required at the frontend-representative stage`
    );
    assertions += 1;
  }

  // The signature check belongs to release, not to the representative gate:
  // the decision receipt is only signed after the gate is derived.
  assert.ok(
    !frontendRepresentative.report.requiredEnforcements.includes("frontend-human-decision-verification"),
    "human decision signature verification must not be demanded before the decision exists"
  );
  assertions += 1;

  console.log(`Adversarial/evidence-release enforcement contract passed (${assertions} assertions).`);
} finally {
  fs.rmSync(featureDirectory, { recursive: true, force: true });
  if (createdFeaturesRoot) {
    fs.rmSync(path.join(ROOT, ".specs", "features"), { recursive: true, force: true });
  }
}
