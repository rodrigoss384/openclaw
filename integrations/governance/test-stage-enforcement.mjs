#!/usr/bin/env node

// Contract for `governance-control.mjs enforce`.
//
// resolveEffectivePolicy emits capability IDs; the concrete command lives in
// enforcement-capabilities.json#invocation.command and nothing consumed it, so
// the agent had to remember ~20 invocations and their flags per stage. That is
// the step a degraded context skips, and skipping it used to be invisible.
//
// The contract this locks in: one command enumerates every required
// enforcement for a stage, names each unresolved input instead of guessing,
// executes what it can, and exits non-zero when a required blocking
// enforcement did not run and pass.

import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../..");
const CONTROLLER = path.join(SCRIPT_DIR, "governance-control.mjs");

const APPLICABILITY = `# enforce-contract — Applicability Contract

\`\`\`text
complexity: medium
criticality: standard
frontend: substantial
backend: not-applicable
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

Fixture used by test-stage-enforcement.mjs.
`;

let assertions = 0;
const featureSlug = `enforce-contract-${process.pid}`;
const featureDirectory = path.join(ROOT, ".specs", "features", featureSlug);
const createdFeaturesRoot = !fs.existsSync(path.join(ROOT, ".specs", "features"));

fs.mkdirSync(featureDirectory, { recursive: true });
fs.writeFileSync(path.join(featureDirectory, "applicability.md"), APPLICABILITY);

function enforce(extraArgs = []) {
  const result = spawnSync(
    process.execPath,
    [
      CONTROLLER, "enforce",
      "--root", ROOT,
      "--stage", "frontend-representative",
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
  const planned = enforce(["--dry-run"]);

  assert.ok(planned.report, `enforce --dry-run must emit a JSON report.\n${planned.stderr}`);
  assert.equal(planned.report.artifactKind, "stage-enforcement-report");
  assert.equal(planned.report.canonical, false, "the report is derived, never canonical");
  assert.equal(planned.report.stage, "frontend-representative");
  assert.equal(planned.report.dryRun, true);
  assertions += 5;

  // The stage's required set must come from the effective policy, and the
  // Product Design Authority must be part of it now that it is blocking.
  assert.ok(
    planned.report.requiredEnforcements.length > 0,
    "a substantial frontend representative stage must require enforcements"
  );
  assert.ok(
    planned.report.requiredEnforcements.includes("frontend-product-design-authority"),
    "the promoted Product Design Authority must appear in requiredEnforcements"
  );
  assert.ok(
    planned.report.requiredEnforcements.includes("frontend-ui-render-control"),
    "deterministic render control must appear in requiredEnforcements"
  );
  assertions += 3;

  // Every required capability gets an execution row: nothing is silently dropped.
  assert.equal(
    planned.report.executions.length,
    planned.report.requiredEnforcements.length,
    "every required enforcement needs an execution row"
  );
  assertions += 1;

  // Unresolved inputs are named, never guessed.
  const unresolved = planned.report.executions.filter((item) => item.status === "unresolved-input");
  assert.ok(unresolved.length > 0, "capabilities with unsupplied inputs must report unresolved-input");
  for (const execution of unresolved) {
    assert.match(
      execution.detail,
      /--set/,
      "an unresolved input must tell the caller how to supply it"
    );
    assertions += 1;
  }
  assertions += 1;

  // Fail closed: a required blocking enforcement that did not run and pass is
  // indistinguishable from one that failed.
  assert.equal(planned.status, 2, "unresolved blocking enforcements must exit 2");
  assert.ok(planned.report.summary.blockingFailures > 0);
  assertions += 2;

  // --set must be substituted into the registered command template.
  const withSet = enforce([
    "--dry-run",
    "--set", "frontend-styling-authority-validation=styling-authority.json=docs/frontend/styling-authority.json"
  ]);
  const styling = withSet.report.executions.find(
    (item) => item.capabilityId === "frontend-styling-authority-validation"
  );
  assert.ok(styling, "the styling authority capability must be required at this stage");
  assert.equal(styling.status, "planned", "a fully resolved capability must become planned");
  assert.match(styling.command, /docs\/frontend\/styling-authority\.json/);
  assert.ok(!/<[a-z-]+>/i.test(styling.command), "a planned command must carry no placeholders");
  assertions += 4;

  // <project-root> resolves without an explicit --set.
  assert.ok(
    withSet.report.executions.some((item) => item.command && item.command.includes(ROOT)),
    "<project-root> must be substituted automatically"
  );
  assertions += 1;

  // Malformed --set is rejected rather than silently ignored.
  const malformed = enforce(["--dry-run", "--set", "frontend-styling-authority-validation"]);
  assert.notEqual(malformed.status, 0, "a malformed --set must fail");
  assert.match(malformed.stderr, /--set expects/);
  assertions += 2;

  // --set is repeatable: a capability can need several inputs
  // (frontend-composition-contract-validation takes three). A parser that
  // overwrites instead of accumulating silently drops every occurrence but
  // the last, and the caller only finds out because the substituted command
  // still carries an unresolved <placeholder> they believed they supplied.
  const multiSet = enforce([
    "--dry-run",
    "--set", "frontend-composition-contract-validation=screen-spec.json=docs/frontend/screens/x/screen-spec.json",
    "--set", "frontend-composition-contract-validation=design-system.json=docs/frontend/design-system/design-system.json",
    "--set", "frontend-composition-contract-validation=composition-proof.json=docs/frontend/screens/x/composition-proof.json"
  ]);
  const composition = multiSet.report.executions.find(
    (item) => item.capabilityId === "frontend-composition-contract-validation"
  );
  assert.ok(composition, "the composition contract capability must be required at this stage");
  assert.equal(
    composition.status,
    "planned",
    `Every repeated --set must be applied, not just the last one.\n${JSON.stringify(composition, null, 2)}`
  );
  for (const supplied of ["screen-spec.json", "design-system.json", "composition-proof.json"]) {
    assert.ok(
      composition.command.includes(supplied),
      `the value supplied for ${supplied} must survive into the command`
    );
    assertions += 1;
  }
  assert.ok(
    !/<[a-z0-9|._-]+>/i.test(composition.command),
    `no placeholder may remain once every input was supplied.\nCommand: ${composition.command}`
  );
  assertions += 3;

  // A stage that carries blocking rules but whose prompt never calls the
  // runner is back to "the agent remembers ~15 invocations", which is the one
  // thing this runner exists to remove. The four gates were wired first and
  // design-readiness/implementation were left calling `bootstrap` only --
  // rollout metadata, not a check. Lock every stage that has rules.
  const policy = JSON.parse(fs.readFileSync(path.join(ROOT, "prompts/spec-driven/governance-policy.json"), "utf8"));
  const promptsDir = path.join(ROOT, "prompts/spec-driven");
  const promptText = fs.readdirSync(promptsDir)
    .filter((name) => name.endsWith(".prompt.md"))
    .map((name) => fs.readFileSync(path.join(promptsDir, name), "utf8"))
    .join("\n");

  const ruleStages = new Set(policy.rules.flatMap((rule) => rule.stageScopes));
  ruleStages.delete("every-stage");
  // session-closure has no prompt in the pack: it is governed by
  // update-handoff.mjs, invoked directly (rules.md "Session Closure Gate").
  ruleStages.delete("session-closure");

  for (const stage of [...ruleStages].sort()) {
    assert.ok(
      promptText.includes(`<!-- workflow-entry:${stage} -->`),
      `Stage '${stage}' has no published transition command. This is an editorial binding check; test-prompt-lifecycle.mjs exercises the actual commands.`
    );
    assertions += 1;
  }

  console.log(`Stage enforcement runner contract passed (${assertions} assertions).`);
} finally {
  fs.rmSync(featureDirectory, { recursive: true, force: true });
  if (createdFeaturesRoot) {
    fs.rmSync(path.join(ROOT, ".specs", "features"), { recursive: true, force: true });
  }
}
