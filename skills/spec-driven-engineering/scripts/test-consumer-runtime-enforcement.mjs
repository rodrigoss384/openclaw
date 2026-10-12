#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateJsonSchema } from "./lib/json-schema.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIRECTORY, "../../..");
let assertions = 0;

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function json(relativePath) {
  return JSON.parse(read(relativePath));
}

function verify(value, message) {
  assert.ok(value, message);
  assertions += 1;
}

const workflow = json("prompts/spec-driven/manifest.json");
const distribution = json("prompts/spec-driven/consumer-runtime.manifest.json");
const distributionSchema = json("prompts/spec-driven/consumer-runtime.manifest.schema.json");
const stateSchema = json("skills/spec-driven-engineering/assets/consumer-runtime-install.schema.json");
const guide = read("prompts/spec-driven/CONSUMER-RUNTIME.md");
const cli = read("skills/spec-driven-engineering/scripts/consumer-runtime.mjs");
const batchCli = read("skills/spec-driven-engineering/scripts/consumer-runtime-all.mjs");
const ci = read(".github/workflows/workflow-validation.yml");

assert.deepEqual(validateJsonSchema(distribution, distributionSchema), [], "Consumer runtime manifest must satisfy its schema.");
assertions += 1;
assert.deepEqual(workflow.consumerRuntime.commands, ["install", "update", "check", "uninstall"]);
assertions += 1;
assert.equal(workflow.consumerRuntime.distributionManifest, "prompts/spec-driven/consumer-runtime.manifest.json");
assertions += 1;
assert.equal(workflow.consumerRuntime.stateSchema, "skills/spec-driven-engineering/assets/consumer-runtime-install.schema.json");
assertions += 1;
assert.equal(workflow.consumerRuntime.batchInstaller, "skills/spec-driven-engineering/scripts/consumer-runtime-all.mjs");
assertions += 1;
assert.deepEqual(workflow.consumerRuntime.batchCommands, ["sync", "install", "update", "check"]);
assertions += 1;

const requiredEntries = [
  "rules.md",
  "workflow.lock.json",
  "prompts/spec-driven",
  "integrations/governance",
  "integrations/frontend",
  "integrations/impeccable",
  ".github/agents",
  ".github/hooks/impeccable.json",
  ".github/skills/impeccable"
];
const fixedPaths = new Set(distribution.fixedEntries.map((entry) => entry.path));
for (const entry of requiredEntries) verify(fixedPaths.has(entry), `Distribution entry missing: ${entry}`);
for (const segment of [".git", ".gitnexus", "evals", "node_modules"]) verify(distribution.excludedSegments.includes(segment), `Excluded segment missing: ${segment}`);

for (const command of ["install", "update", "check", "uninstall"]) verify(cli.includes(`command${command[0].toUpperCase()}${command.slice(1)}`), `CLI implementation missing command: ${command}`);
for (const reasonCode of ["UNMANAGED_FILE_CONFLICT", "MANAGED_FILE_MODIFIED", "SOURCE_DISTRIBUTION_MISMATCH", "ADOPTION_EVIDENCE_MISSING", "TARGET_SYMLINK_ABSOLUTE", "TARGET_SYMLINK_DANGLING", "TARGET_SYMLINK_CHANGED"]) verify(cli.includes(reasonCode), `Stable reason code missing: ${reasonCode}`);
verify(cli.includes('args["adopt-existing"] === true'), "Legacy adoption must require an explicit CLI flag.");
verify(batchCli.includes('command === "sync"') && batchCli.includes('runSingleProject("check"'), "Batch sync must choose a per-project action and finish with source-aware check.");
verify(batchCli.includes('process.exitCode = failed === 0 && agentHomes !== "failed" ? 0 : 2'), "Batch must fail when any project or agent home remains incomplete.");
verify(batchCli.includes('["--all", "--root", sourceRoot]') && batchCli.includes('["--install", "--check"]'), "Batch sync must install and then verify the locked skills in every agent home.");
verify(batchCli.includes("PROJECT_MARKERS") && batchCli.includes("reason=git-root-required"), "Batch must not silently skip recognizable projects without Git.");
verify(stateSchema.required.includes("managedFiles") && stateSchema.required.includes("adoptedFiles"), "Install state must account for managed and adopted files.");
verify(stateSchema.properties.targetSymlinks?.type === "array", "Install state must account for accepted internal symlink topology.");
verify(guide.includes("--adopt-existing"), "Guide must explain legacy adoption.");
verify(guide.includes("symlinks preexistentes") && guide.includes("nunca substitui o link"), "Guide must explain safe internal symlink adoption and preservation.");
verify(guide.includes("não gerencia") && guide.includes("AGENTS.md") && guide.includes(".github/workflows/"), "Guide must identify product-owned boundaries.");

for (const suite of ["test-consumer-runtime.mjs", "test-consumer-runtime-all.mjs", "test-consumer-runtime-bootstrap.mjs", "test-consumer-runtime-enforcement.mjs", "test-consumer-runtime-conformance.mjs", "test-consumer-runtime-internal-symlink-conformance.mjs"]) {
  verify(ci.includes(suite), `CI must execute or explicitly route ${suite}.`);
}

console.log(`Consumer runtime enforcement tests passed (${assertions} assertions).`);
