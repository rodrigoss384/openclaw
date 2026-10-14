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
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "workflow-schema-enforcement-"));

try {
  const prompts = path.join(temp, "prompts/spec-driven");
  fs.mkdirSync(path.dirname(prompts), { recursive: true });
  fs.cpSync(path.join(workflowRoot, "prompts/spec-driven"), prompts, { recursive: true });
  const manifestPath = path.join(prompts, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.unexpectedRootField = "must fail strict schema";
  manifest.gates.find((gate) => gate.id === "backend-representative").order = 99;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const result = spawnSync("node", [path.join(scripts, "validate-workflow.mjs"), "--root", temp], { encoding: "utf8" });
  assert.notEqual(result.status, 0, `Invalid workflow manifest was accepted:\n${result.stdout}\n${result.stderr}`);
  console.log("Workflow manifest schema enforcement: passed (1 assertion)");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
