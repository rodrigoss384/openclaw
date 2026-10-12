#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scripts = path.dirname(fileURLToPath(import.meta.url));
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "behavioral-ux-contract-cli-"));
let assertions = 0;

function run(args, expectedStatus) {
  const result = spawnSync("node", [path.join(scripts, "validate-behavioral-ux-contract.mjs"), ...args], {
    cwd: tempRoot,
    encoding: "utf8"
  });
  assert.equal(result.status, expectedStatus, `unexpected result:\n${result.stdout}\n${result.stderr}`);
  assertions += 1;
  return result;
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

const validContract = {
  "$schema": "../schemas/behavioral-ux-contract.schema.json",
  id: "BUX-ONBOARDING-001",
  surface: "onboarding",
  userGoal: "completar o cadastro inicial rapidamente",
  productGoal: "activation",
  principle: "truthful-progress",
  hypothesis: "mostrar o passo real concluido melhora orientacao e reduz abandono",
  evidenceGrade: "B",
  userBenefit: "o usuario sabe exatamente quanto falta",
  businessBenefit: "reduz abandono no onboarding",
  truthful: true,
  reversible: true,
  userControl: "preserved",
  manipulationRisk: "low",
  experimentRequired: true,
  primaryMetric: "activation-rate-7d",
  guardrails: ["setup-error-rate"],
  notes: null
};

try {
  const validPath = path.join(tempRoot, "valid.json");
  writeJson(validPath, validContract);
  run([validPath], 0);

  const badId = structuredClone(validContract);
  badId.id = "BUX-<SURFACE>-001";
  const badIdPath = path.join(tempRoot, "bad-id.json");
  writeJson(badIdPath, badId);
  const badIdResult = run([badIdPath], 1);
  assert.match(badIdResult.stdout, /BUX_SCHEMA_VIOLATION/);
  assertions += 1;

  const additionalProperty = structuredClone(validContract);
  additionalProperty.unexpectedField = "not allowed by the schema";
  const additionalPropertyPath = path.join(tempRoot, "additional-property.json");
  writeJson(additionalPropertyPath, additionalProperty);
  const additionalPropertyResult = run([additionalPropertyPath], 1);
  assert.match(additionalPropertyResult.stdout, /BUX_SCHEMA_VIOLATION/);
  assertions += 1;

  const prohibited = structuredClone(validContract);
  prohibited.hypothesis = "usar fake scarcity aumenta conversao";
  const prohibitedPath = path.join(tempRoot, "prohibited.json");
  writeJson(prohibitedPath, prohibited);
  const prohibitedResult = run([prohibitedPath], 1);
  assert.match(prohibitedResult.stdout, /BUX_PROHIBITED_PATTERN_LANGUAGE/);
  assertions += 1;

  const reducedControlNoJustification = structuredClone(validContract);
  reducedControlNoJustification.userControl = "reduced";
  reducedControlNoJustification.manipulationRisk = "high";
  const reducedControlPath = path.join(tempRoot, "reduced-control.json");
  writeJson(reducedControlPath, reducedControlNoJustification);
  const reducedControlResult = run([reducedControlPath], 1);
  assert.match(reducedControlResult.stdout, /BUX_REDUCED_CONTROL_WITHOUT_JUSTIFICATION/);
  assertions += 1;

  const underclassified = structuredClone(validContract);
  underclassified.surface = "pricing";
  underclassified.principle = "relevant-comparative-context";
  const underclassifiedPath = path.join(tempRoot, "underclassified.json");
  writeJson(underclassifiedPath, underclassified);
  const underclassifiedResult = run([underclassifiedPath], 0);
  assert.match(underclassifiedResult.stdout, /BUX_RISK_UNDERCLASSIFIED/);
  assertions += 1;
  run([underclassifiedPath, "--strict-warnings"], 1);

  console.log(`Behavioral UX Contract CLI tests: passed (${assertions} assertions)`);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
