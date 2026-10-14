#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scripts = path.dirname(fileURLToPath(import.meta.url));
const installedLayoutCandidate = path.resolve(scripts, "../../..");
const workflowRoot = fs.existsSync(path.join(process.cwd(), "prompts/spec-driven/manifest.json"))
  ? process.cwd()
  : installedLayoutCandidate;
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "frontend-styling-enforcement-"));
let assertions = 0;

function validateWorkflow(root) {
  return spawnSync("node", [path.join(scripts, "validate-workflow.mjs"), "--root", root], {
    cwd: workflowRoot,
    encoding: "utf8"
  });
}

function expectRejected(label, mutate) {
  const root = path.join(tempRoot, label);
  const destination = path.join(root, "prompts/spec-driven");
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(path.join(workflowRoot, "prompts/spec-driven"), destination, { recursive: true });
  fs.copyFileSync(path.join(workflowRoot, "rules.md"), path.join(root, "rules.md"));
  mutate(root);
  const result = validateWorkflow(root);
  assert.notEqual(result.status, 0, `${label}: invalid styling workflow was accepted:\n${result.stdout}\n${result.stderr}`);
  assertions += 1;
}

function replaceRequired(file, from, to) {
  const content = fs.readFileSync(file, "utf8");
  assert.ok(content.includes(from), `Test precondition missing in ${file}: ${from}`);
  fs.writeFileSync(file, content.replace(from, to));
}

try {
  const baseline = validateWorkflow(workflowRoot);
  assert.equal(baseline.status, 0, `Baseline workflow failed:\n${baseline.stdout}\n${baseline.stderr}`);
  assertions += 1;

  expectRejected("missing-styling-policy", (root) => {
    const file = path.join(root, "prompts/spec-driven/manifest.json");
    const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
    delete manifest.frontendStylingPolicy;
    fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
  });

  expectRejected("redesign-route-not-required", (root) => {
    const file = path.join(root, "prompts/spec-driven/manifest.json");
    const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
    manifest.skillRoutes.find((route) => route.skill === "ui-audit-redesign-engineer").required = false;
    fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
  });

  expectRejected("missing-styling-authority-design", (root) => {
    const file = path.join(root, "prompts/spec-driven/05-design-readiness.prompt.md");
    replaceRequired(file, "styling-authority:", "styling-authority-removed:");
  });

  expectRejected("missing-canonical-design-evidence", (root) => {
    const file = path.join(root, "prompts/spec-driven/05-design-readiness.prompt.md");
    replaceRequired(file, "canonical-design-evidence:", "canonical-design-evidence-removed:");
  });

  expectRejected("missing-class-ownership-execution", (root) => {
    const file = path.join(root, "prompts/spec-driven/07-execute.prompt.md");
    replaceRequired(file, "class-ownership-trace:", "class-ownership-trace-removed:");
  });

  expectRejected("missing-global-css-gate", (root) => {
    const file = path.join(root, "prompts/spec-driven/07.1-frontend-representative-gate.prompt.md");
    replaceRequired(file, "global-css-policy:", "global-css-policy-removed:");
  });

  expectRejected("missing-reference-drift-review", (root) => {
    const file = path.join(root, "prompts/spec-driven/08-adversarial.prompt.md");
    replaceRequired(file, "reference-drift:", "reference-drift-removed:");
  });

  expectRejected("missing-rules-styling-section", (root) => {
    const file = path.join(root, "rules.md");
    replaceRequired(file, "## Autoridade de Estilização Frontend", "## Autoridade removida");
  });

  console.log(`Frontend styling enforcement: passed (${assertions} assertions)`);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
