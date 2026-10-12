#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  canonicalProductDesignDigest,
  evaluateProductDesignReadiness,
  verifyProductDesignReadiness
} from "./product-design-control.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../..");
const CONTROLLER = path.join(SCRIPT_DIR, "product-design-control.mjs");
const TEMP_DIR = path.join(SCRIPT_DIR, `.test-product-design-gate-${process.pid}`);
const INPUT_REF = path.relative(ROOT, path.join(TEMP_DIR, "input.json")).split(path.sep).join("/");
const VERIFY_REF = path.relative(ROOT, path.join(TEMP_DIR, "verify.json")).split(path.sep).join("/");
const OUTPUT_REF = path.relative(ROOT, path.join(TEMP_DIR, "output")).split(path.sep).join("/");
const subject = { project: "spec-driven-development", commit: "39ed012" };
const policyDigest = "9".repeat(64);
let assertions = 0;

function signed(artifactKind, value) {
  const result = { artifactKind, schemaVersion: "1.0.0", ...value };
  result.semanticDigest = canonicalProductDesignDigest(result);
  return result;
}

function fixture(overrides = {}) {
  const brief = signed("product-design-brief", { subject, feature: "delegated-product-design-authority" });
  const research = signed("visual-research", { subject, briefDigest: brief.semanticDigest, references: [] });
  const decision = signed("design-authority-decision", {
    subject,
    briefDigest: brief.semanticDigest,
    researchDigest: research.semanticDigest,
    selectedCandidateId: "contextual",
    visualDirectionSelectedBy: "agent",
    policyProvenance: { autonomyPolicy: { sha256: "8".repeat(64) }, effectivePolicy: { sha256: policyDigest } }
  });
  return {
    subject,
    brief,
    research,
    decision,
    assetRequirements: null,
    assetSidecars: [],
    policyDigest,
    findings: [],
    ...overrides
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

try {
  const ready = evaluateProductDesignReadiness(fixture());
  assert.equal(ready.readiness.status, "passed");
  assert.deepEqual(ready.findings, []);
  assert.equal(ready.readiness.visualDirectionSelectedBy, "agent");
  assert.equal(ready.readiness.dependencyDigests.brief, ready.readiness.briefDigest);
  assert.match(ready.readiness.semanticDigest, /^[a-f0-9]{64}$/);
  assertions += 5;

  const repeat = evaluateProductDesignReadiness(fixture());
  assert.equal(repeat.readiness.semanticDigest, ready.readiness.semanticDigest);
  assertions += 1;

  const staleFixture = fixture();
  staleFixture.research.references.push({ id: "mutated-after-freeze" });
  const stale = evaluateProductDesignReadiness(staleFixture);
  assert.equal(stale.readiness.status, "stale");
  assert.ok(stale.findings.some((item) => item.id === "PDA-06"));
  assertions += 2;

  const missing = evaluateProductDesignReadiness(fixture({ decision: null }));
  assert.equal(missing.readiness.status, "not-run");
  assert.ok(missing.findings.some((item) => item.id === "PDA-03"));
  assertions += 2;

  const blocked = evaluateProductDesignReadiness(fixture({
    findings: [{ id: "PDA-11", severity: "P0", source: "product-design-control", message: "Unsupported promise", findingKey: "claim-1" }]
  }));
  assert.equal(blocked.readiness.status, "failed");
  assert.ok(blocked.readiness.blockingFindingIds.includes("PDA-11"));
  assert.ok(blocked.findings.some((item) => item.id === "PDA-11"));
  assertions += 3;

  const assetRequirements = signed("asset-requirements", {
    subject,
    briefDigest: ready.readiness.briefDigest,
    decisionDigest: ready.readiness.decisionDigest,
    assets: [{ id: "hero", function: "orientation", essentiality: "essential", equivalentAvailable: false, materialLossWithoutAsset: true, acceptance: {} }]
  });
  const missingAsset = evaluateProductDesignReadiness(fixture({ assetRequirements }));
  assert.equal(missingAsset.readiness.status, "failed");
  assert.ok(missingAsset.findings.some((item) => item.id === "PDA-10"));
  assertions += 2;

  const verified = verifyProductDesignReadiness({ ...fixture(), readiness: ready.readiness });
  assert.equal(verified.status, "passed");
  assert.deepEqual(verified.findings, []);
  assertions += 2;

  const tamperedReadiness = structuredClone(ready.readiness);
  tamperedReadiness.dependencyDigests.research = "0".repeat(64);
  const tampered = verifyProductDesignReadiness({ ...fixture(), readiness: tamperedReadiness });
  assert.equal(tampered.status, "stale");
  assert.ok(tampered.findings.some((item) => item.id === "PDA-06"));
  assertions += 2;

  writeJson(path.join(TEMP_DIR, "input.json"), fixture());
  const gateCli = spawnSync(process.execPath, [
    CONTROLLER, "gate", "--input", INPUT_REF, "--output-dir", OUTPUT_REF
  ], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  assert.equal(gateCli.status, 0, `gate CLI failed.\n${gateCli.stderr}`);
  const cliReadiness = JSON.parse(fs.readFileSync(path.join(TEMP_DIR, "output", "product-design-readiness.json"), "utf8"));
  assert.equal(cliReadiness.status, "passed");
  assertions += 2;

  writeJson(path.join(TEMP_DIR, "verify.json"), { ...fixture(), readiness: cliReadiness });
  const verifyCli = spawnSync(process.execPath, [
    CONTROLLER, "verify", "--input", VERIFY_REF, "--output-dir", OUTPUT_REF
  ], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  assert.equal(verifyCli.status, 0, `verify CLI failed.\n${verifyCli.stderr}`);
  const verification = JSON.parse(verifyCli.stdout);
  assert.equal(verification.status, "passed");
  assertions += 2;

  console.log(`Product design readiness and verification suite passed (${assertions} assertions).`);
} finally {
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
}
