#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../..");
const VALIDATOR = path.join(SCRIPT_DIR, "validate-governance-policy.mjs");
const POLICY_PATH = path.join(ROOT, "prompts/spec-driven/governance-policy.json");
const SCHEMA_PATH = "integrations/governance/governance-policy.schema.json";

const RATIONALE = [
  "abstração-só-quando-a-dor-justificar",
  "bootstrap-de-contexto-em-janela-limpa",
  "bugs-e-validação",
  "contrato-do-spec-driven-engineering",
  "ddd-estratégico-e-bounded-context",
  "encapsulamento",
  "gates-canônicos",
  "índice-de-aplicabilidade",
  "overengineering",
  "princípio-base",
  "responsabilidade-antes-de-camada",
  "sincronização-de-docs-do-projeto",
  "solid-pragmático",
  "yagni"
];

function execute(policyPath) {
  return spawnSync(
    process.execPath,
    [VALIDATOR, "--root", ROOT, "--policy", policyPath, "--schema", SCHEMA_PATH],
    { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );
}

const policy = JSON.parse(fs.readFileSync(POLICY_PATH, "utf8"));
const listed = policy.rationaleSections.map((section) => section.anchor).sort((left, right) => left.localeCompare(right));
assert.deepEqual(listed, [...RATIONALE].sort((left, right) => left.localeCompare(right)));
for (const section of policy.rationaleSections) {
  assert.equal(section.destination, "rationale");
  assert.ok(section.reason.length >= 8);
}

const direct = execute(POLICY_PATH);
assert.equal(direct.status, 0, `${direct.stdout}\n${direct.stderr}`);

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "section-inventory-"));
const silent = structuredClone(policy);
silent.rationaleSections = silent.rationaleSections.filter((section) => section.anchor !== "yagni");
const silentPath = path.join(temp, "silent.json");
fs.writeFileSync(silentPath, `${JSON.stringify(silent, null, 2)}\n`);
const rejected = execute(silentPath);
assert.notEqual(rejected.status, 0);
assert.match(rejected.stderr, /Silent rules.md section '#yagni'/);

console.log("section inventory: 14 rationale headings, silent section rejected");
