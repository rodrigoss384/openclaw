#!/usr/bin/env node
/**
 * Regression for WF-SOS-001: validate-feature-package must not require
 * 10-adversarial-review.md / 11-evidence.md before implementation.
 * Manifest artifactSequence marks both as after-implementation.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const validator = path.join(scriptDirectory, "validate-feature-package.mjs");

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function minimalPlanningPackage(directory) {
  const req = "REQ-LIFE-001";
  const ac = "AC-LIFE-001";
  const scn = "SCN-LIFE-001";
  const at = "AT-LIFE-001";
  const task = "T-LIFE-001";
  write(path.join(directory, "00-intent.md"), `# Intent\n\n${req}: planning-only package.\n`);
  write(path.join(directory, "01-spec.md"), `# Spec\n\n${req}: contract.\n`);
  write(path.join(directory, "02-assumptions.md"), `# Assumptions\n\nNenhuma.\n`);
  write(
    path.join(directory, "applicability.md"),
    "```text\ncomplexity: small\ncriticality: low\nfrontend: not-applicable\nbackend: not-applicable\npersistence: not-applicable\npublic-api: unchanged\nauth: not-applicable\ntenancy: not-applicable\nconcurrency: not-applicable\nmigration: not-applicable\nnew-service-or-subsystem: not-applicable\nmaterial-operational-cost: not-applicable\nperformance: standard\naccessibility: not-applicable\nfrontend-representative-gate: not-applicable\nbackend-representative-gate: not-applicable\nbrowser-evidence: not-applicable\ncontract-drift-check: not-applicable\ninterface-contract: not-applicable\nbehavioral-ux: not-applicable\nbehavioral-ux-risk: none\noutcome-evidence: not-applicable\n```\n"
  );
  write(path.join(directory, "03-acceptance-criteria.md"), `# Acceptance\n\n### ${ac}\n\n- Requisitos: ${req}.\n`);
  write(path.join(directory, "04-behavior-scenarios.feature"), `Funcionalidade: life\n  @${scn} @${ac} @${req}\n  Cenário: ok\n    Então passa\n`);
  write(
    path.join(directory, "05-executable-acceptance-tests.md"),
    `# AT\n\n| ${at} | ${req} / ${ac} / ${scn} | unit | setup | RED | runner |\n`
  );
  write(path.join(directory, "08-test-plan.md"), `# Plan\n\n${at} covered.\n`);
  write(
    path.join(directory, "09-tasks.md"),
    `# Tasks\n\n### \`${task}\` — implement ${req} ${ac} ${scn} ${at}\n\n- Status: pending.\n`
  );
}

function runValidator(featureDirectory, extraArgs = []) {
  const result = spawnSync(process.execPath, [validator, featureDirectory, ...extraArgs], {
    encoding: "utf8"
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout || "",
    stderr: result.stderr || ""
  };
}

function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sde-feature-lifecycle-"));
  try {
    const planning = path.join(root, "planning-only");
    minimalPlanningPackage(planning);
    const planningResult = runValidator(planning);
    assert.equal(
      planningResult.status,
      0,
      `planning-only package (00–09, no 10/11) must pass; got ${planningResult.status}\n${planningResult.stdout}\n${planningResult.stderr}`
    );
    assert.doesNotMatch(
      planningResult.stdout + planningResult.stderr,
      /Required artifact missing: 10-adversarial-review\.md/
    );
    assert.doesNotMatch(
      planningResult.stdout + planningResult.stderr,
      /Required artifact missing: 11-evidence\.md/
    );

    const partial = path.join(root, "partial-post");
    minimalPlanningPackage(partial);
    write(path.join(partial, "10-adversarial-review.md"), "# Adversarial\n\nADV-LIFE-001: open.\n");
    const partialResult = runValidator(partial);
    assert.notEqual(partialResult.status, 0, "10 without 11 must fail");
    assert.match(
      partialResult.stdout + partialResult.stderr,
      /11-evidence\.md/
    );

    const complete = path.join(root, "complete");
    minimalPlanningPackage(complete);
    write(path.join(complete, "10-adversarial-review.md"), "# Adversarial\n\nADV-LIFE-001: encerrado. Gate: passed.\n");
    write(
      path.join(complete, "11-evidence.md"),
      `# Evidence\n\nREQ-LIFE-001 → AC-LIFE-001 → SCN-LIFE-001 → AT-LIFE-001 → T-LIFE-001. Decision: approved. Gate: passed.\n`
    );
    const completeResult = runValidator(complete);
    assert.equal(
      completeResult.status,
      0,
      `complete package must pass; got ${completeResult.status}\n${completeResult.stdout}\n${completeResult.stderr}`
    );

    const forced = path.join(root, "forced-post");
    minimalPlanningPackage(forced);
    const forcedResult = runValidator(forced, ["--require-post-implementation"]);
    assert.notEqual(forcedResult.status, 0, "--require-post-implementation without 10/11 must fail");
    assert.match(forcedResult.stdout + forcedResult.stderr, /10-adversarial-review\.md|11-evidence\.md/);

    console.log("test-feature-package-lifecycle-enforcement: PASS");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

main();
