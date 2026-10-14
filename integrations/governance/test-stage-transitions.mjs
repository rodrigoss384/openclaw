import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { freezeExecutionContext, advanceStage, verifyDelivery } from "./stage-control.mjs";
import { digest, gitOutput } from "./execution-context.mjs";
const root = path.resolve(import.meta.dirname, "../..");
const feature = `transition-fixture-${process.pid}`;
const directory = path.join(root, ".specs/features", feature);
const changed = path.join(root, `.evh-transition-${process.pid}.txt`);
const saved = { base: process.env.SDE_BASE_COMMIT, context: process.env.SDE_CONTEXT_SHA256 };
let assertions = 0;
const rejects = (fn, pattern) => { assert.throws(fn, pattern); assertions++; };
try {
  delete process.env.SDE_BASE_COMMIT; delete process.env.SDE_CONTEXT_SHA256;
  // Dedicated fixture: a frozen copy of external-validation-hardening, so validator hardening
  // never depends on (or rewrites) that feature's historical evidence.
  fs.cpSync(path.join(import.meta.dirname, "evals/stage-transition-feature"), directory, { recursive: true });
  const base = gitOutput(root, ["rev-parse", "HEAD"]).trim();
  rejects(() => advanceStage({ root, feature, stage: "implementation" }), /Frozen execution context missing/);
  const frozen = freezeExecutionContext({ root, feature, baseRef: base });
  rejects(() => freezeExecutionContext({ root, feature, baseRef: base }), /EEXIST/);
  rejects(() => advanceStage({ root, feature, stage: "implementation" }), /Prerequisite transition missing/);
  rejects(() => verifyDelivery({ root, feature, inputs: {} }), /trusted executor baseline/);
  const result = advanceStage({ root, feature, stage: "design-readiness" });
  assert.equal(result.status, "complete"); assertions++;
  const reportPath = path.join(directory, "design-readiness-enforcement.json");
  const reportBytes = fs.readFileSync(reportPath);
  fs.unlinkSync(reportPath);
  rejects(() => advanceStage({ root, feature, stage: "implementation" }), /ENOENT/);
  fs.writeFileSync(reportPath, reportBytes);
  const report = JSON.parse(reportBytes); report.dryRun = true;
  const bytes = JSON.stringify(report); fs.writeFileSync(reportPath, bytes);
  const statePath = path.join(directory, "stage-state.json");
  const state = JSON.parse(fs.readFileSync(statePath)); state.stages["design-readiness"].reportSha256 = digest(bytes);
  fs.writeFileSync(statePath, JSON.stringify(state));
  rejects(() => advanceStage({ root, feature, stage: "implementation" }), /diagnostic enforcement report/);
  advanceStage({ root, feature, stage: "design-readiness" });
  advanceStage({ root, feature, stage: "implementation" });
  fs.writeFileSync(changed, "snapshot changed after enforcement\n");
  rejects(() => advanceStage({ root, feature, stage: "adversarial" }), /transition is stale/);
  fs.unlinkSync(changed);
  const applicability = path.join(directory, "applicability.md");
  const original = fs.readFileSync(applicability); fs.appendFileSync(applicability, "\nchanged applicability\n");
  rejects(() => advanceStage({ root, feature, stage: "implementation" }), /Applicability differs/);
  fs.writeFileSync(applicability, original);
  process.env.SDE_BASE_COMMIT = base; process.env.SDE_CONTEXT_SHA256 = frozen.sha256;
  // Existing failed reports cannot substitute for executing each delivery stage.
  fs.writeFileSync(reportPath, JSON.stringify({ dryRun: true }));
  assert.equal(verifyDelivery({ root, feature, inputs: {} }).status, "passed"); assertions++;
  fs.unlinkSync(path.join(directory, "autonomy-required.json"));
  rejects(() => verifyDelivery({ root, feature, inputs: {} }), /Stage enforcement did not pass/);
} finally {
  fs.rmSync(directory, { recursive: true, force: true }); fs.rmSync(changed, { force: true });
  if (saved.base === undefined) delete process.env.SDE_BASE_COMMIT; else process.env.SDE_BASE_COMMIT = saved.base;
  if (saved.context === undefined) delete process.env.SDE_CONTEXT_SHA256; else process.env.SDE_CONTEXT_SHA256 = saved.context;
}
console.log(`Real stage transition and delivery tests passed (${assertions} assertions; canonical validators, no mocked execution).`);
