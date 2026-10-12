#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { beginFeature, nextStep } from "./workflow-entry.mjs";

function git(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `git ${args.join(" ")} failed`);
}

const feature = "next-probe";
const root = fs.mkdtempSync(path.join(os.tmpdir(), "workflow-next-"));
const featureDir = path.join(root, ".specs/features", feature);
try {
  git(root, ["init", "-q", "-b", "main"]);
  git(root, ["config", "user.email", "test@example.com"]);
  git(root, ["config", "user.name", "test"]);
  fs.writeFileSync(path.join(root, "README.md"), "seed\n");
  git(root, ["add", "README.md"]);
  git(root, ["commit", "-q", "-m", "seed"]);

  const init = nextStep({ root, feature });
  assert.equal(init.status, "needs-init");
  assert.equal(init.command, "init");
  assert.equal(init.provider, "unselected");
  assert.equal(init.executes, false);

  fs.mkdirSync(path.join(root, ".specs/project"), { recursive: true });
  fs.writeFileSync(path.join(root, ".specs/project/workflow-entry.json"), "{}\n");
  assert.equal(nextStep({ root, feature }).command, "begin");

  beginFeature({ root, feature });
  const missing = nextStep({ root, feature });
  assert.equal(missing.status, "needs-specification");
  assert.deepEqual(missing.missing, ["applicability.md", "execution-paths.json"]);
  assert.equal(missing.executes, false);

  fs.writeFileSync(path.join(featureDir, "applicability.md"), "frontend-representative-gate: not-required\nbackend-representative-gate: not-required\n");
  assert.deepEqual(nextStep({ root, feature }).missing, ["execution-paths.json"]);
  fs.writeFileSync(path.join(featureDir, "execution-paths.json"), `${JSON.stringify({ frontendPaths: [], backendPaths: [], testPaths: [] })}\n`);
  assert.equal(nextStep({ root, feature }).command, "freeze");

  fs.writeFileSync(path.join(featureDir, "execution-context.json"), "{}\n");
  assert.equal(nextStep({ root, feature }).command, "inputs");
  fs.writeFileSync(path.join(featureDir, "enforcement-input-requirements.json"), `${JSON.stringify({ status: "needs-inputs" })}\n`);
  assert.equal(nextStep({ root, feature }).command, "inputs");
  fs.writeFileSync(path.join(featureDir, "enforcement-input-requirements.json"), `${JSON.stringify({ status: "ready" })}\n`);
  assert.deepEqual(
    { command: nextStep({ root, feature }).command, stage: nextStep({ root, feature }).stage },
    { command: "advance", stage: "design-readiness" }
  );

  const stages = ["design-readiness", "implementation", "adversarial", "evidence-release"];
  fs.writeFileSync(path.join(featureDir, "stage-state.json"), `${JSON.stringify({ stages: Object.fromEntries(stages.map(name => [name, { status: "complete" }])) })}\n`);
  assert.equal(nextStep({ root, feature }).command, "select-delivery");
  fs.writeFileSync(path.join(root, ".specs/delivery.json"), `${JSON.stringify({ feature })}\n`);
  const delivery = nextStep({ root, feature });
  assert.equal(delivery.command, "delivery");
  assert.equal(delivery.executes, false);
  assert.equal(fs.existsSync(path.join(featureDir, "execution-start.json")), true);
  console.log("workflow next command contract passed");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
