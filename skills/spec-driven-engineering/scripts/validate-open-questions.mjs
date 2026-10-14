#!/usr/bin/env node
// Open-question closure (rules.md#perguntas-em-aberto): before adversarial and
// evidence-release, every Q- defined in the feature must be closed — status
// `resolvida` (with the D-/AD- decision or the answer) or `adiada` (with the
// DEF- that takes it out of scope). `aberta`, missing or unknown status blocks.
import fs from "node:fs";
import path from "node:path";
import { parseArgs, printReport } from "./lib/workflow-utils.mjs";

const args = parseArgs(process.argv.slice(2));
const featureDirectory = path.resolve(String(args._[0] || args["feature-dir"] || ""));
const errors = [];
const warnings = [];
const information = [];

// 02-assumptions.md is the canonical owner; 00-intent.md only counts for a Q-
// that 02 does not define (a stale "aberta" in 00 must not shadow 02).
const SOURCES = ["02-assumptions.md", "00-intent.md"];
const QUESTION_ID = /^[`*]*(Q-[A-Z0-9][A-Z0-9-]*-\d{3})[`*]*$/;
const SEPARATOR = /^\|?\s*:?-{3,}/;

function normalize(text) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[`*_]/g, "").trim().toLowerCase();
}

function cells(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

// Status column comes from the table header ("Status" — the template puts it
// last, older packages second); without that header, the first cell after
// the ID that starts with a status keyword.
function questionRows(text) {
  const rows = [];
  const lines = text.split("\n");
  let statusIndex = -1;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim().startsWith("|")) {
      statusIndex = -1;
      continue;
    }
    if (SEPARATOR.test(lines[index + 1]?.trim() || "")) {
      statusIndex = cells(line).findIndex((cell) => normalize(cell) === "status");
      continue;
    }
    const row = cells(line);
    const id = row[0]?.match(QUESTION_ID)?.[1];
    if (!id) continue;
    const status = statusIndex > 0
      ? row[statusIndex] ?? ""
      : row.slice(1).find((cell) => /^(aberta|resolvida|adiada)\b/.test(normalize(cell))) ?? row[1] ?? "";
    rows.push({ id, status, line });
  }
  return rows;
}

if (!featureDirectory || !fs.existsSync(featureDirectory)) {
  errors.push(`Feature directory not found: ${featureDirectory || "<empty>"}`);
} else {
  const definitions = new Map();
  for (const file of SOURCES) {
    const full = path.join(featureDirectory, file);
    if (!fs.existsSync(full)) continue;
    for (const { id, status, line } of questionRows(fs.readFileSync(full, "utf8"))) {
      if (!definitions.has(id)) definitions.set(id, { file, status, line });
    }
  }

  for (const [id, { file, status, line }] of definitions) {
    const value = normalize(status);
    const keyword = value.match(/^(aberta|resolvida|adiada)\b/)?.[1];
    if (!keyword) {
      errors.push(`${id} (${file}): status must start with aberta, resolvida or adiada — found "${status.trim() || "<empty>"}"`);
    } else if (keyword === "aberta") {
      errors.push(`${id} (${file}): still open — answer it (resolvida + D-/AD- or the answer) or defer it (adiada + DEF-)`);
    } else if (keyword === "resolvida") {
      const hasDecision = /\b(?:D|AD)-[A-Z0-9][A-Z0-9-]*\d{3}\b/.test(line);
      const hasAnswer = value.replace(/^resolvida\W*/, "").length >= 8;
      if (!hasDecision && !hasAnswer) errors.push(`${id} (${file}): resolvida needs the D-/AD- decision or the answer`);
    } else if (!/\bDEF-[A-Z0-9][A-Z0-9-]*\d{3}\b/.test(line)) {
      errors.push(`${id} (${file}): adiada needs the DEF- that takes it out of scope`);
    }
  }
  information.push(`Questions found: ${definitions.size}`);
}

const ok = printReport("Spec-Driven Engineering — Open Question Closure", errors, warnings, information);
process.exitCode = ok ? 0 : 1;
