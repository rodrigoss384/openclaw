#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scripts = path.dirname(fileURLToPath(import.meta.url));
const validator = path.join(scripts, "validate-open-questions.mjs");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "open-question-closure-"));
let assertions = 0;

function run(files) {
  const feature = fs.mkdtempSync(path.join(tempRoot, "feature-"));
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(feature, name), content);
  return spawnSync(process.execPath, [validator, feature], { encoding: "utf8" });
}

function assumptions(rows) {
  return ["# Assumptions", "", "| ID | Status | Pergunta |", "|---|---|---|", ...rows, ""].join("\n");
}

function expect(label, files, passes, pattern) {
  const result = run(files);
  assert.equal(result.status === 0, passes, `${label}: expected ${passes ? "pass" : "fail"}\n${result.stdout}`);
  if (pattern) assert.match(result.stdout, pattern, label);
  assertions += 1;
}

try {
  expect("no questions", { "02-assumptions.md": "# Assumptions\n\nNenhuma pergunta.\n" }, true);
  expect("open blocks", { "02-assumptions.md": assumptions(["| Q-ABC-001 | Aberta; produto | Incluir X? |"]) }, false, /Q-ABC-001.*still open/);
  expect("resolved with decision", { "02-assumptions.md": assumptions(["| Q-ABC-001 | Resolvida por D-ABC-003 | Incluir X? |"]) }, true);
  expect("resolved with answer", { "02-assumptions.md": assumptions(["| `Q-ABC-001` | **Resolvida**: manter dois templates | Incluir X? |"]) }, true);
  expect("resolved without reference", { "02-assumptions.md": assumptions(["| Q-ABC-001 | Resolvida | Incluir X? |"]) }, false, /needs the D-\/AD- decision or the answer/);
  expect("deferred with DEF", { "02-assumptions.md": assumptions(["| Q-ABC-001 | Adiada para DEF-ABC-002 | Incluir X? |"]) }, true);
  expect("deferred without DEF", { "02-assumptions.md": assumptions(["| Q-ABC-001 | Adiada | Incluir X? |"]) }, false, /adiada needs the DEF-/);
  expect("missing status", { "02-assumptions.md": assumptions(["| Q-ABC-001 | Fonte do nome; ausência | Spec |"]) }, false, /must start with aberta, resolvida or adiada/);
  expect("02 owns over stale 00", {
    "00-intent.md": assumptions(["| Q-ABC-001 | Aberta | Incluir X? |"]),
    "02-assumptions.md": assumptions(["| Q-ABC-001 | Resolvida por D-ABC-003 | Incluir X? |"]),
  }, true);
  expect("00-only question counts", { "00-intent.md": assumptions(["| Q-ABC-009 | Aberta | Prazo? |"]) }, false, /Q-ABC-009/);
  const template = (row) => ["## Perguntas em aberto", "", "| ID | Pergunta | Autoridade | Bloqueia? | Status |", "|---|---|---|---|---|", row, ""].join("\n");
  expect("template layout open", { "02-assumptions.md": template("| `Q-ABC-001` | Incluir X? | Rodrigo | Sim | aberta |") }, false, /still open/);
  expect("template layout deferred", { "02-assumptions.md": template("| `Q-ABC-001` | Incluir X? | Rodrigo | Não | adiada para DEF-ABC-001 |") }, true);
  expect("template layout ignores other columns", { "02-assumptions.md": template("| `Q-ABC-001` | Resolvida? | Rodrigo | Sim | aberta |") }, false, /still open/);
  expect("no Status header falls back to keyword cell", {
    "02-assumptions.md": ["| ID | Pergunta | Situação |", "|---|---|---|", "| Q-ABC-001 | Incluir X? | Resolvida por D-ABC-002 |", ""].join("\n"),
  }, true);
  expect("mention outside a definition row is ignored", {
    "02-assumptions.md": assumptions(["| D-ABC-001 | Escopo | Q-ABC-001 continua para ampliação |"]),
  }, true);
  console.log(`Open question closure: passed (${assertions} assertions)`);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
