#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import Ajv2020 from "../../skills/frontend-product-builder/node_modules/ajv/dist/2020.js";
import {
  createClientDeliveryAttestation,
  projectVisualCompositionEvidenceV2,
  projectVisualQualityScorecardV2
} from "./ui-engineering-control.mjs";

import { createUiExecutionFixture } from "./fixtures/execution.mjs";
const executionFixture = await createUiExecutionFixture();
const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const CONTROLLER = path.join(SCRIPT_DIRECTORY, "ui-engineering-control.mjs");
const SCHEMA = JSON.parse(fs.readFileSync(path.join(SCRIPT_DIRECTORY, "ui-engineering-control.schema.json"), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validate = ajv.compile(SCHEMA);
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "ui-artifact-schema-"));
let assertions = 0;

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function run(command, args, receipt, cwd = ROOT) {
  const result = spawnSync(process.execPath, [CONTROLLER, command, ...args, ...(receipt ? ["--receipt", receipt] : [])], {
    cwd,
    encoding: "utf8"
  });
  assert.equal(result.status, 0, `${command} failed:\n${result.stderr}\n${result.stdout}`);
  return result;
}

function validArtifact(filePath) {
  const value = readJson(filePath);
  assertions += 1;
  assert.equal(validate(value), true, `${path.basename(filePath)} failed schema validation: ${ajv.errorsText(validate.errors)}`);
  return value;
}

try {
  const subject = { project: "schema-fixture", commit: "a".repeat(40) };
  const profileInput = path.join(temp, "inputs", "profile.json");
  const bundleInput = path.join(temp, "inputs", "bundle.json");
  const sourcePath = path.join(temp, "inputs", "App.tsx");
  const lintInput = path.join(temp, "inputs", "lint.json");
  const collectionInput = path.join(temp, "inputs", "collection.json");
  const profileOutput = path.join(temp, "outputs", "profile");
  const compileOutput = path.join(temp, "outputs", "compile");
  const lintOutput = path.join(temp, "outputs", "lint");
  const collectOutput = path.join(temp, "outputs", "collect");
  const analyzeOutput = path.join(temp, "outputs", "analyze");
  const gateOutput = path.join(executionFixture.root, ".specs", "gate");
  const receiptsDirectory = path.join(temp, "receipts");
  const receipt = (name) => path.join(receiptsDirectory, `${name}.json`);

  writeJson(profileInput, {
    subject,
    uiSurfaces: [{ id: "web", framework: "react", styling: "tailwind-v4", runtime: "web-dom" }]
  });
  writeJson(bundleInput, {
    subject,
    tokens: {
      "text.section-title": { type: "typography", value: { fontSize: "1.5rem", fontWeight: 700 } },
      "surface.canvas": { type: "color", value: "oklch(0.98 0 0)" },
      "space.related": { type: "length", value: "0.5rem" },
      "status.success": { type: "color", value: "oklch(0.55 0.16 145)" }
    },
    recipes: [{
      id: "dashboard",
      owner: "design-system",
      requiredPrimitives: ["PageHeader"],
      tokenRefs: ["text.section-title", "surface.canvas", "space.related"],
      expected: [{ id: "page-title", screenId: "dashboard", role: "page-title" }]
    }],
    components: [{ id: "PageHeader", owner: "design-system" }],
    statuses: { approved: { semanticRole: "success", variant: "success", tokenRef: "status.success" } },
    locale: { id: "pt-BR", catalog: ["Painel"] }
  });
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(sourcePath, "export function App() { return <header><h1 className=\"text-section-title\">Painel</h1></header>; }\n");
  writeJson(lintInput, { subject, files: [sourcePath] });
  writeJson(collectionInput, {
    subject,
    adapterId: "normalized-html-css",
    browser: { name: "chromium", version: "fixture", playwright: "1.61.0" },
    fixtureDigest: "f".repeat(64),
    observations: [{ id: "page-title", role: "page-title", box: { x: 0, y: 0, width: 240, height: 40 } }],
    relations: {},
    accessibility: []
  });

  run("profile", ["--input", profileInput, "--output-dir", profileOutput], receipt("profile"));
  run("compile", [
    "--input", bundleInput,
    "--profile", path.join(profileOutput, "ui-platform-profile.json"),
    "--adapter", path.join(profileOutput, "ui-adapter-resolution.json"),
    "--output-dir", compileOutput
  ], receipt("compile"));
  run("lint", [
    "--input", lintInput,
    "--policy", path.join(compileOutput, "ui-policy.compiled.json"),
    "--output-dir", lintOutput
  ], receipt("lint"));
  run("collect", ["--input", collectionInput, "--output-dir", collectOutput], receipt("collect"));
  run("analyze", [
    "--expected", path.join(compileOutput, "expected-render-model.json"),
    "--rendered", path.join(collectOutput, "rendered-ui-evidence.json"),
    "--source", path.join(lintOutput, "source-ui-facts.json"),
    "--output-dir", analyzeOutput
  ], receipt("analyze"));
  const humanScopePath = path.join(temp, "human-scope.json");
  writeJson(humanScopePath, { kind: "release-authorization", evidenceRefs: ["evidence/objective-gate.json"] });
  run("gate", [
    "--execution", executionFixture.executionPath,
    "--findings", path.join(analyzeOutput, "ui-findings.json"),
    "--receipts", ["profile", "compile", "lint", "collect", "analyze"].map(receipt).join(","),
    "--decision", "approved",
    "--principal", "schema-reviewer",
    "--human-scope", humanScopePath,
    "--output-dir", gateOutput
  ], receipt("gate"), executionFixture.root);

  const artifactPaths = [
    path.join(profileOutput, "ui-platform-profile.json"),
    path.join(profileOutput, "ui-adapter-resolution.json"),
    path.join(compileOutput, "ui-policy.compiled.json"),
    path.join(compileOutput, "ui-token-resolution.json"),
    path.join(compileOutput, "expected-render-model.json"),
    path.join(compileOutput, "ui-findings.json"),
    path.join(lintOutput, "source-ui-facts.json"),
    path.join(collectOutput, "rendered-ui-evidence.json"),
    path.join(analyzeOutput, "ui-findings.json"),
    path.join(gateOutput, "ui-quality-gate.json"),
    path.join(gateOutput, "human-decision-receipt.json"),
    ...["profile", "compile", "lint", "collect", "analyze", "gate"].map(receipt)
  ];
  for (const artifactPath of artifactPaths) validArtifact(artifactPath);

  const gate = readJson(path.join(gateOutput, "ui-quality-gate.json"));
  const decision = readJson(path.join(gateOutput, "human-decision-receipt.json"));
  const findings = readJson(path.join(analyzeOutput, "ui-findings.json")).findings;
  for (const generated of [
    createClientDeliveryAttestation(gate, decision),
    projectVisualCompositionEvidenceV2({ findings, gate }),
    projectVisualQualityScorecardV2({ findings, gate })
  ]) {
    assertions += 1;
    assert.equal(validate(generated), true, `${generated.artifactKind} failed schema validation: ${ajv.errorsText(validate.errors)}`);
  }

  const invalid = readJson(receipt("profile"));
  invalid.inputs[0].ref = "../escape.json";
  assertions += 1;
  assert.equal(validate(invalid), false, "Receipt refs that escape the evidence root must fail schema validation.");

  const incompleteRisk = { ...decision, decision: "approved-with-accepted-risk", risk: { id: "R-1", owner: "team" } };
  assertions += 1;
  assert.equal(validate(incompleteRisk), false, "Accepted risk without scope, expiry and mitigation must fail schema validation.");
} finally {
  await executionFixture.close();
  fs.rmSync(temp, { recursive: true, force: true });
}

console.log(`UI artifact schema tests passed (${assertions} assertions).`);
