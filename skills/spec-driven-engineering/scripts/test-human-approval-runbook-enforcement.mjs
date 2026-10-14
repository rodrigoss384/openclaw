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
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "human-approval-runbook-enforcement-"));
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
  assert.notEqual(result.status, 0, `${label}: invalid approval workflow was accepted:\n${result.stdout}\n${result.stderr}`);
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

  expectRejected("missing-runbook-policy", (root) => {
    const file = path.join(root, "prompts/spec-driven/manifest.json");
    const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
    delete manifest.sessionClosure.humanApprovalRunbook;
    fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
  });

  expectRejected("missing-execute-runbook", (root) => {
    const file = path.join(root, "prompts/spec-driven/07-execute.prompt.md");
    replaceRequired(file, "human-approval-runbook:", "human-approval-runbook-removed:");
  });

  for (const key of ["validator", "publication"]) {
    expectRejected(`missing-runbook-${key}`, (root) => {
      const file = path.join(root, "prompts/spec-driven/manifest.json");
      const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
      delete manifest.sessionClosure.humanApprovalRunbook[key];
      fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
    });
  }

  expectRejected("missing-design-decision-runbook", (root) => {
    const file = path.join(root, "prompts/spec-driven/05-design-readiness.prompt.md");
    replaceRequired(file, "human-approval-runbook:", "human-approval-runbook-removed:");
  });

  expectRejected("missing-frontend-runbook", (root) => {
    const file = path.join(root, "prompts/spec-driven/07.1-frontend-representative-gate.prompt.md");
    replaceRequired(file, "approval-response-contract:", "approval-response-contract-removed:");
  });

  expectRejected("missing-backend-runbook", (root) => {
    const file = path.join(root, "prompts/spec-driven/07.2-backend-representative-gate.prompt.md");
    replaceRequired(file, "approval-response-contract:", "approval-response-contract-removed:");
  });

  expectRejected("missing-evidence-decision-runbook", (root) => {
    const file = path.join(root, "prompts/spec-driven/09-validate-evidence.prompt.md");
    replaceRequired(file, "human-approval-runbook:", "human-approval-runbook-removed:");
  });

  expectRejected("missing-handoff-human-action", (root) => {
    const file = path.join(root, "prompts/spec-driven/07-execute.prompt.md");
    replaceRequired(file, "## Ação humana pendente", "## Ação removida");
  });

  expectRejected("missing-rules-human-approval", (root) => {
    const file = path.join(root, "rules.md");
    replaceRequired(file, "## Aprovação Humana Acionável", "## Aprovação removida");
  });

  expectRejected("execution-implies-approval", (root) => {
    const file = path.join(root, "rules.md");
    replaceRequired(file, "Rodar um comando com sucesso não significa aprovar", "Rodar um comando com sucesso aprova");
  });

  console.log(`Human approval runbook enforcement: passed (${assertions} assertions)`);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
