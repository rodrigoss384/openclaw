#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeUiFacts } from "./ui-engineering-control.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const matrix = JSON.parse(fs.readFileSync(path.join(scriptDirectory, "fixtures/ui-control/failure-matrix.json"), "utf8"));
let assertions = 0;

function authorityIds(fixture) {
  const prompt = fixture.prompt;
  const primary = /\$impeccable[^.\n]*(?:primária|primary)/i.test(prompt);
  const fallback = /\$frontend-design[^.\n]*fallback|fallback[^.\n]*\$frontend-design/i.test(prompt);
  const optional = /\$web-design-guidelines[^.\n]*opcional|opcional[^.\n]*\$web-design-guidelines/i.test(prompt);
  return primary && fallback && optional ? [] : ["UI-13"];
}

function ids(testCase, fixture) {
  if (testCase.id === "UI-13") return authorityIds(fixture);
  return analyzeUiFacts(fixture.expected, fixture.rendered).findings.map((finding) => finding.id);
}

assert.equal(matrix.cases.length, 13, "The canonical failure matrix must cover UI-01 through UI-13.");
assertions += 1;
for (const testCase of matrix.cases) {
  const invalid = ids(testCase, testCase.invalid);
  const valid = ids(testCase, testCase.valid);
  const mutation = ids(testCase, testCase.mutation);
  assert.ok(invalid.includes(testCase.id), `${testCase.id}: negative fixture did not produce the stable finding ID.`);
  assert.ok(!valid.includes(testCase.id), `${testCase.id}: valid equivalent still produced the finding.`);
  assert.ok(mutation.includes(testCase.id), `${testCase.id}: mutation did not preserve the stable finding ID.`);
  assertions += 3;
}

console.log(`UI failure matrix tests passed (${assertions} assertions).`);
