#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../../..");
const CLI = path.join(SCRIPT_DIRECTORY, "consumer-runtime.mjs");
const TEMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "consumer-runtime-bootstrap-"));
const TARGET_ROOT = path.join(TEMP_ROOT, "consumer-project");
let assertions = 0;

function verify(value, message) {
  assert.ok(value, message);
  assertions += 1;
}

function digest(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function write(relativePath, content) {
  const target = path.join(TARGET_ROOT, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
  return target;
}

function run(command, args, cwd = TARGET_ROOT) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  assert.equal(result.status, 0, `Command failed: ${command} ${args.join(" ")}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  assertions += 1;
  return result;
}

try {
  fs.mkdirSync(TARGET_ROOT, { recursive: true });
  run("git", ["init", "--quiet"], TARGET_ROOT);
  const protectedFiles = {
    "AGENTS.md": "# Product-owned agent instructions\n",
    "CLAUDE.md": "# Product-owned Claude instructions\n",
    ".github/workflows/product.yml": "name: Product CI\n",
    ".specs/features/existing/00-intent.md": "# Existing product feature\n"
  };
  const protectedDigests = {};
  for (const [relativePath, content] of Object.entries(protectedFiles)) {
    protectedDigests[relativePath] = digest(write(relativePath, content));
  }

  run(process.execPath, [CLI, "install", "--target", TARGET_ROOT, "--source", SOURCE_ROOT], SOURCE_ROOT);

  const installedCli = path.join(TARGET_ROOT, "skills/spec-driven-engineering/scripts/consumer-runtime.mjs");
  verify(fs.existsSync(installedCli), "The consumer project must contain its own runtime CLI.");
  run(process.execPath, [installedCli, "check", "--target", TARGET_ROOT]);
  run(process.execPath, ["skills/spec-driven-engineering/scripts/validate-workflow.mjs", "--root", "."]);
  run(process.execPath, ["integrations/governance/validate-governance-policy.mjs", "--root", "."]);
  run(process.execPath, ["skills/spec-driven-engineering/scripts/lock-workflow.mjs", "--root", ".", "--check"]);
  run(process.execPath, ["skills/spec-driven-engineering/scripts/test-human-guidance.mjs"]);

  const statePath = path.join(TARGET_ROOT, ".specs/workflow-runtime-install.json");
  const stateText = fs.readFileSync(statePath, "utf8");
  const state = JSON.parse(stateText);
  verify(state.managedFiles.length > 100, "The real distribution must contain the complete workflow runtime, not only the prompt pack.");
  verify(!stateText.includes(SOURCE_ROOT), "Install state must not retain the machine-specific source path.");
  verify(state.managedFiles.some((file) => file.path === "prompts/spec-driven/07-execute.prompt.md"), "Execution prompt must be installed.");
  verify(state.managedFiles.some((file) => file.path === "integrations/impeccable/frontend-control.mjs"), "Impeccable integration must be installed.");
  verify(state.managedFiles.some((file) => file.path === "skills/spec-driven-engineering/SKILL.md"), "Orchestrator skill must be installed.");
  verify(state.managedFiles.every((file) => !file.path.includes("node_modules") && !file.path.includes("/evals/")), "Excluded dependency and eval trees must not be installed.");

  for (const [relativePath, expectedDigest] of Object.entries(protectedDigests)) {
    assert.equal(digest(path.join(TARGET_ROOT, relativePath)), expectedDigest, `Product-owned file changed: ${relativePath}`);
    assertions += 1;
  }

  console.log(`Consumer runtime bootstrap tests passed (${assertions} assertions).`);
} finally {
  fs.rmSync(TEMP_ROOT, { recursive: true, force: true });
}
