#!/usr/bin/env node
import { digest as executionDigest } from "../../../integrations/governance/execution-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateBackendGovernanceHardening } from "./lib/backend-governance-hardening.mjs";

const scripts = path.dirname(fileURLToPath(import.meta.url));
const assets = path.resolve(scripts, "../assets");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "backend-governance-hardening-"));
let assertions = 0;

function baseManifest() {
  const manifest = JSON.parse(fs.readFileSync(path.join(assets, "backend-change-manifest.template.json"), "utf8").replaceAll("FEATURE_SLUG", "phase9e"));
  manifest.mode = "extension";
  manifest.gate.conditions.newServiceOrSubsystem = false;
  manifest.gate.required = false;
  manifest.gate.status = "not-applicable";
  manifest.security.boundaries = [{
    trustBoundary: "authenticated request to resource lookup",
    resource: "tenant-owned project",
    identitySource: "verified access token subject",
    tenantBinding: "tenant id from authenticated principal",
    authorizationPoint: "resource repository lookup with tenant predicate",
    negativeTestIds: ["AT-PHASE9E-001"]
  }];
  manifest.testIntegrity.testPaths = ["tests"];
  manifest.testIntegrity.evidencePaths = ["docs/backend/backend-readiness.md"];
  manifest.repairTrace.notApplicableReason = "This change is not a repair workflow";
  return manifest;
}

function dependency(overrides = {}) {
  return {
    dependency: "payment-provider",
    timeout: "1500ms request timeout",
    retry: { maxAttempts: 2, backoff: "exponential 100ms with jitter" },
    transientOnly: true,
    idempotency: "safe",
    failureMode: "surface-error",
    evidence: ["docs/backend/backend-readiness.md"],
    ...overrides
  };
}

function expectError(label, mutate, fragment) {
  const manifest = baseManifest();
  mutate(manifest);
  const result = validateBackendGovernanceHardening(manifest, temp, { checkFiles: false });
  assert.ok(result.errors.some((error) => fragment.test(error)), `${label}: expected ${fragment}, got ${result.errors.join(" | ")}`);
  assertions += 1;
}

function run(command, args, cwd) {
  return spawnSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function makeGitFixture(name, mutate) {
  const root = path.join(temp, name);
  fs.mkdirSync(path.join(root, "docs/backend"), { recursive: true });
  fs.mkdirSync(path.join(root, "tests"), { recursive: true });
  fs.writeFileSync(path.join(root, "docs/backend/backend-readiness.md"), "backend readiness evidence\n");
  const manifest = baseManifest();
  fs.writeFileSync(path.join(root, "docs/backend/backend-change-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(root, "tests/service.test.js"), [
    "// AT-PHASE9E-001",
    "test('tenant boundary', () => {",
    "  expect(authorize('tenant-a')).toBe(true);",
    "});",
    ""
  ].join("\n"));
  assert.equal(run("git", ["init", "-q"], root).status, 0);
  assert.equal(run("git", ["config", "user.email", "phase9e@example.invalid"], root).status, 0);
  assert.equal(run("git", ["config", "user.name", "Phase 9E"], root).status, 0);
  assert.equal(run("git", ["add", "."], root).status, 0);
  assert.equal(run("git", ["commit", "-qm", "baseline"], root).status, 0);
  const base = run("git", ["rev-parse", "HEAD"], root).stdout.trim();
  const featureDir = path.join(root, ".specs/features", manifest.feature);
  fs.mkdirSync(featureDir, { recursive: true });
  fs.writeFileSync(path.join(featureDir, "applicability.md"), "backend: substantial\n");
  fs.writeFileSync(path.join(featureDir, "execution-context.json"), JSON.stringify({ feature: manifest.feature, baseCommit: base, applicabilitySha256: executionDigest(fs.readFileSync(path.join(featureDir, "applicability.md"))), frontendPaths: [], backendPaths: ["tests"], testPaths: ["tests"] }));
  mutate(root);
  return { root, base };
}

function auditFixture(label, fixture, expectedStatus, fragment = null) {
  const result = run(process.execPath, [
    path.join(scripts, "audit-test-integrity.mjs"),
    "--root", fixture.root,
    "--manifest", "docs/backend/backend-change-manifest.json",
    "--base", fixture.base
  ], fixture.root);
  assert.equal(result.status, expectedStatus, `${label}:\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  if (fragment) assert.match(`${result.stdout}\n${result.stderr}`, fragment, `${label}: wrong failure`);
  assertions += fragment ? 2 : 1;
}

try {
  const valid = baseManifest();
  valid.reliability.externalDependencies = [dependency()];
  const validResult = validateBackendGovernanceHardening(valid, temp, { checkFiles: false });
  assert.deepEqual(validResult.errors, []);
  assertions += 1;

  expectError("integration-dependency-required", (manifest) => {
    manifest.mode = "integration";
    manifest.reliability.externalDependencies = [];
  }, /requires at least one reliability\.externalDependencies/);

  expectError("retry-transient-only", (manifest) => {
    manifest.reliability.externalDependencies = [dependency({ transientOnly: false })];
  }, /transientOnly=true/);

  expectError("retry-unsafe-idempotency", (manifest) => {
    manifest.reliability.externalDependencies = [dependency({ idempotency: "unsafe" })];
  }, /retries are forbidden when idempotency=unsafe/);

  expectError("security-boundary-required", (manifest) => {
    manifest.security.boundaries = [];
  }, /security\.boundaries must contain at least one/);

  expectError("duplicate-security-boundary", (manifest) => {
    manifest.security.boundaries.push({ ...manifest.security.boundaries[0], negativeTestIds: ["AT-PHASE9E-002"] });
  }, /Duplicate security boundary/);

  expectError("repair-trace-required", (manifest) => {
    manifest.mode = "repair";
    manifest.repairTrace.applicable = false;
    manifest.repairTrace.notApplicableReason = "repair";
  }, /repair mode requires repairTrace\.applicable=true/);

  const repair = baseManifest();
  repair.mode = "repair";
  repair.repairTrace = {
    applicable: true,
    finding: "Cross-tenant lookup accepted an unauthorized resource identifier",
    systemicCause: "Resource repository lookup omitted the canonical tenant ownership predicate",
    canonicalAuthorityRef: "docs/backend/backend-change-manifest.json#security.boundaries",
    repairEvidencePaths: ["docs/backend/backend-readiness.md"],
    regressionTestIds: ["AT-PHASE9E-003"],
    notApplicableReason: ""
  };
  assert.deepEqual(validateBackendGovernanceHardening(repair, temp, { checkFiles: false }).errors, []);
  assertions += 1;

  const clean = makeGitFixture("clean-addition", (root) => {
    fs.appendFileSync(path.join(root, "tests/service.test.js"), "test('extra invariant', () => expect(1).toBe(1));\n");
  });
  auditFixture("clean-addition", clean, 0);

  const skipped = makeGitFixture("skip-added", (root) => {
    fs.appendFileSync(path.join(root, "tests/service.test.js"), "test.skip('disabled contract test', () => expect(1).toBe(1));\n");
  });
  auditFixture("skip-added", skipped, 1, /TEST_DISABLED_OR_SKIPPED/);

  const assertionRemoved = makeGitFixture("assertion-removed", (root) => {
    const file = path.join(root, "tests/service.test.js");
    fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("  expect(authorize('tenant-a')).toBe(true);\n", ""));
  });
  auditFixture("assertion-removed", assertionRemoved, 1, /NET_ASSERTION_REMOVAL/);

  for (const macro of ["assert!(tenant_a != tenant_b);", "assert_eq!(status, 403);", "assert_ne!(tenant_a, tenant_b);"]) {
    const fixture = makeGitFixture(`rust-${macro.split("!")[0]}`, () => {});
    const file = path.join(fixture.root, "tests/security.rs");
    fs.writeFileSync(file, `// AT-PHASE9E-001\n#[test]\nfn tenant_boundary() {\n  ${macro}\n}\n`);
    assert.equal(run("git", ["add", "tests/security.rs"], fixture.root).status, 0);
    assert.equal(run("git", ["commit", "-qm", "Rust baseline before removal"], fixture.root).status, 0);
    fixture.base = run("git", ["rev-parse", "HEAD"], fixture.root).stdout.trim();
    const contextPath = path.join(fixture.root, ".specs/features/phase9e/execution-context.json");
    const context = JSON.parse(fs.readFileSync(contextPath)); context.baseCommit = fixture.base;
    fs.writeFileSync(contextPath, JSON.stringify(context));
    auditFixture("Rust assertion retained", fixture, 0);
    fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace(`  ${macro}\n`, ""));
    auditFixture("Rust macro removed", fixture, 1, /NET_ASSERTION_REMOVAL/);
    assert.equal(run("git", ["add", "tests/security.rs"], fixture.root).status, 0);
    assert.equal(run("git", ["commit", "-qm", "Removed assertion"], fixture.root).status, 0);
    const later = run("git", ["rev-parse", "HEAD"], fixture.root).stdout.trim();
    auditFixture("Caller cannot hide deletion with newer base", { ...fixture, base: later }, 1, /baseline differs/);
  }
  const reduced = makeGitFixture("reduced-inventory", root => {
    const file = path.join(root, "docs/backend/backend-change-manifest.json");
    const manifest = JSON.parse(fs.readFileSync(file)); manifest.testIntegrity.testPaths = ["other-tests"];
    fs.writeFileSync(file, JSON.stringify(manifest));
  });
  auditFixture("Reduced test inventory", reduced, 1, /inventory was reduced/);

  const contractIdRemoved = makeGitFixture("contract-id-removed", (root) => {
    const file = path.join(root, "tests/service.test.js");
    fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("// AT-PHASE9E-001\n", ""));
  });
  auditFixture("contract-id-removed", contractIdRemoved, 1, /CONTRACT_TEST_ID_REMOVED/);

  const deleted = makeGitFixture("test-file-deleted", (root) => {
    fs.rmSync(path.join(root, "tests/service.test.js"));
  });
  auditFixture("test-file-deleted", deleted, 1, /TEST_FILE_DELETED/);

  // WF-SOS-003: released rust-axum-default requires unambiguous FMT/CLIPPY exit markers.
  const rustRoot = path.join(temp, "rust-quality");
  fs.mkdirSync(path.join(rustRoot, "docs/backend/phase9e/evidence"), { recursive: true });
  const rustManifest = baseManifest();
  rustManifest.feature = "phase9e";
  rustManifest.technology.selection = "rust-axum-default";
  rustManifest.technology.language = "rust";
  rustManifest.technology.httpFramework = "axum";
  rustManifest.technology.runtimeContext = "new-production-runtime";
  rustManifest.gate.status = "backend-broad-build-approved";
  rustManifest.gate.required = true;
  let rustResult = validateBackendGovernanceHardening(rustManifest, rustRoot, { checkFiles: true });
  assert.ok(rustResult.errors.some((error) => /WF-SOS-003/.test(error)), rustResult.errors.join(" | "));
  assertions += 1;
  fs.writeFileSync(path.join(rustRoot, "docs/backend/phase9e/evidence/rust-quality-gates.txt"), "FMT_EXIT=1\nCLIPPY_EXIT=0\n");
  rustResult = validateBackendGovernanceHardening(rustManifest, rustRoot, { checkFiles: true });
  assert.ok(rustResult.errors.some((error) => /failing FMT_EXIT|WF-SOS-003/.test(error)), rustResult.errors.join(" | "));
  assertions += 1;
  fs.writeFileSync(path.join(rustRoot, "docs/backend/phase9e/evidence/rust-quality-gates.txt"), "FMT_EXIT=0\nCLIPPY_EXIT=0\n");
  rustResult = validateBackendGovernanceHardening(rustManifest, rustRoot, { checkFiles: true });
  assert.equal(rustResult.errors.filter((error) => /WF-SOS-003|FMT_EXIT|CLIPPY_EXIT/.test(error)).length, 0, rustResult.errors.join(" | "));
  assertions += 1;

  console.log(`Backend governance hardening Phase 9E regression suite passed (${assertions} assertions).`);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
