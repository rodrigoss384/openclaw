#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scripts = path.dirname(fileURLToPath(import.meta.url));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "backend-product-enforcement-"));
let assertions = 0;

function run(script, args) {
  return spawnSync("node", [path.join(scripts, script), ...args], { encoding: "utf8" });
}

function prepare(name, mutate) {
  const root = path.join(temp, name);
  const prepared = run("prepare-backend-representative-gate.mjs", ["--root", root, "--feature", name]);
  assert.equal(prepared.status, 0, prepared.stderr || prepared.stdout);
  const manifestPath = path.join(root, "docs/backend", name, "backend-change-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const contract = path.join(root, "openapi/openapi.yaml");
  fs.mkdirSync(path.dirname(contract), { recursive: true });
  fs.writeFileSync(contract, "openapi: 3.1.0\ninfo:\n  title: fixture\n  version: 1.0.0\npaths: {}\n");
  mutate(manifest, root);
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { root, manifestPath };
}

function mustReject(label, script, fixture, expectedFragment) {
  const result = run(script, [fixture.manifestPath, "--root", fixture.root, "--check-files"]);
  assert.notEqual(result.status, 0, `${label} was accepted:\n${result.stdout}\n${result.stderr}`);
  if (expectedFragment) assert.match(`${result.stdout}\n${result.stderr}`, expectedFragment, `${label} failed for the wrong reason`);
  assertions += 1;
}

function addPassingValidatorEvidence(manifest, root) {
  const entry = manifest.interfaces[0];
  entry.validatorCommand = "node -e \"process.exit(0)\"";
  entry.validatorResult = "passed";
  const contract = path.join(root, entry.contractPath);
  const evidence = {
    $schema: "../backend-validator-evidence.schema.json",
    schemaVersion: "1.0.0",
    interfaceId: entry.id,
    command: entry.validatorCommand,
    cwd: path.resolve(root),
    contractPath: entry.contractPath,
    contractSha256: crypto.createHash("sha256").update(fs.readFileSync(contract)).digest("hex"),
    startedAt: "2026-08-05T12:00:00Z",
    endedAt: "2026-08-05T12:00:01Z",
    exitCode: 0,
    result: "passed",
    stdout: "valid",
    stderr: ""
  };
  fs.mkdirSync(path.dirname(path.join(root, entry.validatorEvidencePath)), { recursive: true });
  fs.writeFileSync(path.join(root, entry.validatorEvidencePath), `${JSON.stringify(evidence, null, 2)}\n`);
}

try {
  const coexistenceRoot = path.join(temp, "coexistence");
  const firstPackage = run("prepare-backend-representative-gate.mjs", ["--root", coexistenceRoot, "--feature", "feature-one"]);
  const secondPackage = run("prepare-backend-representative-gate.mjs", ["--root", coexistenceRoot, "--feature", "feature-two"]);
  assert.equal(firstPackage.status, 0, firstPackage.stderr || firstPackage.stdout);
  assert.equal(secondPackage.status, 0, secondPackage.stderr || secondPackage.stdout);
  assert.ok(fs.existsSync(path.join(coexistenceRoot, "docs/backend/feature-one/backend-change-manifest.json")));
  assert.ok(fs.existsSync(path.join(coexistenceRoot, "docs/backend/feature-two/backend-change-manifest.json")));
  const repeatPackage = run("prepare-backend-representative-gate.mjs", ["--root", coexistenceRoot, "--feature", "feature-one"]);
  assert.notEqual(repeatPackage.status, 0, "preparer must still refuse to overwrite the same feature package");
  const unsafeSlug = run("prepare-backend-representative-gate.mjs", ["--root", coexistenceRoot, "--feature", "../escape"]);
  assert.notEqual(unsafeSlug.status, 0, "preparer must reject path-traversal feature slugs");
  assertions += 6;

  const invalidSchema = prepare("invalid-schema", (manifest) => {
    manifest.unexpectedRootField = true;
    manifest.mode = "quick-fix";
    manifest.complexity = "small";
    manifest.criticality = "low";
    manifest.gate = { required: "false", reasons: ["localized"], humanApprovalRequired: "false", status: "not-applicable" };
    manifest.security.authentication = "";
  });
  mustReject("Strict-schema violation", "validate-backend-package.mjs", invalidSchema, /Manifest schema/);

  const pendingScorecard = prepare("pending-scorecard", (manifest, root) => {
    manifest.gate.status = "backend-broad-build-approved";
    manifest.slice.status = "passed";
    manifest.decision.state = "not-required";
    addPassingValidatorEvidence(manifest, root);
  });
  mustReject("Untouched scorecard", "audit-backend-representative-gate.mjs", pendingScorecard, /Scorecard dimension .* not releasable: not-run/);

  const scorecardWithoutEvidence = prepare("scorecard-without-evidence", (manifest, root) => {
    manifest.gate.status = "backend-broad-build-approved";
    manifest.slice.status = "passed";
    manifest.decision.state = "not-required";
    addPassingValidatorEvidence(manifest, root);
    const scorecardPath = path.join(root, manifest.slice.scorecardPath);
    const scorecard = JSON.parse(fs.readFileSync(scorecardPath, "utf8"));
    for (const dimension of scorecard.dimensions) dimension.status = "passed";
    scorecard.decision = "approved";
    scorecard.reviewer = "reviewer";
    scorecard.timestamp = "2026-08-05T12:00:00Z";
    fs.writeFileSync(scorecardPath, `${JSON.stringify(scorecard, null, 2)}\n`);
  });
  mustReject("Passed scorecard without evidence", "audit-backend-representative-gate.mjs", scorecardWithoutEvidence, /passed without evidence/);

  const staleEvidence = prepare("stale-evidence", (manifest, root) => {
    manifest.gate.status = "backend-broad-build-approved";
    manifest.slice.status = "passed";
    manifest.decision.state = "not-required";
    addPassingValidatorEvidence(manifest, root);
    fs.appendFileSync(path.join(root, manifest.interfaces[0].contractPath), "# changed after validation\n");
  });
  mustReject("Stale contract validator evidence", "audit-backend-representative-gate.mjs", staleEvidence, /evidence is stale/);

  const humanApproval = prepare("human-approval", (manifest) => {
    manifest.mode = "extension";
    manifest.interfaces[0].exposure = "public";
    manifest.interfaces[0].changeType = "compatible";
    manifest.gate.conditions.newServiceOrSubsystem = false;
    manifest.gate.conditions.publicContract = true;
    manifest.gate.reasons = ["public API contract changed"];
    manifest.gate.humanApprovalRequired = false;
    manifest.gate.status = "ready-for-backend-slice";
  });
  mustReject("Public-contract approval bypass", "audit-backend-representative-gate.mjs", humanApproval, /humanApprovalRequired must equal structured approval applicability/);

  const hiddenPublicContract = prepare("hidden-public-contract", (manifest) => {
    manifest.mode = "extension";
    manifest.interfaces[0].exposure = "public";
    manifest.interfaces[0].changeType = "compatible";
    manifest.gate.conditions.newServiceOrSubsystem = false;
    manifest.gate.required = false;
    manifest.gate.humanApprovalRequired = false;
    manifest.gate.status = "not-applicable";
  });
  mustReject("Hidden public-contract applicability", "validate-backend-package.mjs", hiddenPublicContract, /conditions.publicContract must match manifest facts/);

  const speculative = prepare("speculative-architecture", (manifest) => {
    manifest.architecture.introducedMechanisms = [{
      kind: "microservice",
      justification: "",
      driverIds: [],
      evidencePaths: []
    }];
  });
  mustReject("Unjustified architecture", "audit-backend-representative-gate.mjs", speculative, /Manifest schema/);

  console.log(`Backend enforcement negative tests: passed (${assertions} assertions)`);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
