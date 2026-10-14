#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../..");
const VALIDATOR = path.join(SCRIPT_DIR, "validate-enforcement-capabilities.mjs");
const REGISTRY_PATH = path.join(SCRIPT_DIR, "enforcement-capabilities.json");
const SCHEMA_PATH = "integrations/governance/enforcement-capabilities.schema.json";
const POLICY_PATH = "prompts/spec-driven/governance-policy.json";
const baseline = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "governance-capabilities-phase8b-"));
let assertions = 0;

function execute(registryPath = REGISTRY_PATH) {
  return spawnSync(
    process.execPath,
    [VALIDATOR, "--root", ROOT, "--registry", registryPath, "--schema", SCHEMA_PATH, "--policy", POLICY_PATH],
    { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );
}

function expectValid(label, registry = baseline) {
  const registryPath = path.join(tempRoot, `${label}.json`);
  fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
  const result = execute(registryPath);
  assert.equal(result.status, 0, `${label}: expected valid registry.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  assertions += 1;
}

function expectRejected(label, mutate) {
  const registry = structuredClone(baseline);
  mutate(registry);
  const registryPath = path.join(tempRoot, `${label}.json`);
  fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
  const result = execute(registryPath);
  assert.notEqual(result.status, 0, `${label}: invalid registry was accepted.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  assertions += 1;
}

try {
  expectValid("baseline");

  expectRejected("duplicate-capability-id", (registry) => {
    registry.capabilities.push(structuredClone(registry.capabilities[0]));
  });

  expectRejected("unknown-owner", (registry) => {
    registry.capabilities[0].owner = "unknown-authority";
  });

  expectRejected("missing-entrypoint", (registry) => {
    registry.capabilities[0].entrypoint = "integrations/governance/missing-validator.mjs";
  });

  expectRejected("test-file-is-not-production-capability", (registry) => {
    registry.capabilities[0].entrypoint = "skills/spec-driven-engineering/scripts/test-context-bootstrap-enforcement.mjs";
    registry.capabilities[0].invocation.command = "node skills/spec-driven-engineering/scripts/test-context-bootstrap-enforcement.mjs";
  });

  expectRejected("schema-cannot-use-cli", (registry) => {
    const capability = registry.capabilities.find((item) => item.kind === "schema");
    capability.invocation = { mode: "cli", command: `node ${capability.entrypoint}` };
  });

  expectRejected("cli-requires-command", (registry) => {
    delete registry.capabilities[0].invocation.command;
  });

  expectRejected("command-must-invoke-entrypoint", (registry) => {
    registry.capabilities[0].invocation.command = "node some-other-validator.mjs";
  });

  expectRejected("duplicate-input-contract", (registry) => {
    registry.capabilities[0].inputContracts.push(structuredClone(registry.capabilities[0].inputContracts[0]));
  });

  expectRejected("schema-failure-mode", (registry) => {
    const capability = registry.capabilities.find((item) => item.kind === "schema");
    capability.failureSemantics.mode = "nonzero-exit";
  });

  expectRejected("cli-failure-mode", (registry) => {
    registry.capabilities[0].failureSemantics.mode = "schema-rejection";
  });

  // Five blocking capabilities used to register the subcommand itself as a
  // placeholder (e.g. <profile|compile|decide|gate|verify>). enforce
  // substitutes whatever --set supplies and then reports "passed", so the
  // agent could satisfy a blocking rule with the subcommand that only emits an
  // artifact instead of the one that fails on a real defect.
  expectRejected("caller-selected-subcommand", (registry) => {
    const capability = registry.capabilities[0];
    capability.invocation.command = capability.invocation.command.replace(
      capability.entrypoint,
      `${capability.entrypoint} <check|report>`
    );
  });

  const direct = execute();
  assert.equal(direct.status, 0, `Repository capability registry must validate directly.\n${direct.stdout}\n${direct.stderr}`);
  assertions += 1;

  console.log(`Enforcement capability registry Phase 8B regression suite passed (${assertions} assertions).`);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
