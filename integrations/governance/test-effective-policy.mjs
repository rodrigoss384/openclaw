#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../..");
const CONTROLLER = path.join(SCRIPT_DIR, "governance-control.mjs");
const TEMP_DIR = path.join(SCRIPT_DIR, `.test-effective-policy-${process.pid}`);
let assertions = 0;

const BASE = {
  complexity: "small",
  criticality: "standard",
  frontend: "not-applicable",
  backend: "not-applicable",
  persistence: "not-applicable",
  "public-api": "unchanged",
  auth: "not-applicable",
  tenancy: "not-applicable",
  concurrency: "not-applicable",
  migration: "not-applicable",
  "new-service-or-subsystem": "not-applicable",
  "material-operational-cost": "not-applicable",
  performance: "not-applicable",
  accessibility: "not-applicable",
  "frontend-representative-gate": "not-required",
  "backend-representative-gate": "not-required",
  "browser-evidence": "not-required",
  "contract-drift-check": "not-applicable",
  "interface-contract": "not-applicable",
  "interface-contract-kind": "none",
  "interface-contract-type": "none",
  "behavioral-ux": "not-applicable",
  "behavioral-ux-risk": "none",
  "outcome-evidence": "not-applicable"
};

function writeApplicability(name, overrides = {}) {
  const values = { ...BASE, ...overrides };
  const filePath = path.join(TEMP_DIR, `${name}.md`);
  const content = Object.entries(values).map(([key, value]) => `${key}: ${value}`).join("\n") + "\n";
  fs.writeFileSync(filePath, content);
  return filePath;
}

function execute({ stage, feature = "effective-policy-fixture", applicability, task = null, output = null }) {
  const args = [
    CONTROLLER,
    "resolve",
    "--root", ROOT,
    "--stage", stage,
    "--feature", feature,
    "--applicability", applicability
  ];
  if (task) args.push("--task", task);
  if (output) args.push("--output", output);
  return spawnSync(process.execPath, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function resolve(label, options) {
  const output = path.join(TEMP_DIR, `${label}.json`);
  const result = execute({ ...options, output });
  assert.equal(result.status, 0, `${label}: resolver failed.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  assertions += 1;
  return JSON.parse(fs.readFileSync(output, "utf8"));
}

function expectRejected(label, options, expectedText) {
  const result = execute(options);
  assert.notEqual(result.status, 0, `${label}: invalid input was accepted.\nSTDOUT:\n${result.stdout}`);
  if (expectedText) {
    assert.match(result.stderr, expectedText, `${label}: rejection reason did not match.\nSTDERR:\n${result.stderr}`);
    assertions += 1;
  }
  assertions += 1;
}

fs.mkdirSync(TEMP_DIR, { recursive: true });

try {
  const substantialFrontend = writeApplicability("frontend-substantial", {
    frontend: "substantial",
    performance: "standard",
    accessibility: "required",
    "frontend-representative-gate": "required",
    "browser-evidence": "hard-required"
  });
  const lightweightFrontend = writeApplicability("frontend-lightweight", {
    frontend: "lightweight",
    performance: "standard",
    accessibility: "required",
    "browser-evidence": "hard-required"
  });
  const substantialBackend = writeApplicability("backend-substantial", {
    complexity: "large",
    backend: "substantial",
    "public-api": "new",
    performance: "standard",
    "backend-representative-gate": "required",
    "contract-drift-check": "required"
  });
  const noProductSurface = writeApplicability("no-product-surface");
  // behavioralUx was the only applicability selector the schema accepted that
  // no rule ever used: rules.md declares prohibited patterns a block and
  // HIGH-RISK surfaces gated, while validate-behavioral-ux-contract.mjs sat
  // unreferenced by any capability. Lock both directions of the selector.
  const behavioralUxApplicable = writeApplicability("behavioral-ux-applicable", {
    frontend: "substantial",
    performance: "standard",
    accessibility: "required",
    "frontend-representative-gate": "required",
    "browser-evidence": "hard-required",
    "behavioral-ux": "applicable",
    "behavioral-ux-risk": "high-risk",
    "outcome-evidence": "applicable"
  });

  const frontendReadiness = resolve("frontend-readiness", {
    stage: "design-readiness",
    applicability: substantialFrontend,
    task: "TASK-FE-001"
  });
  assert.equal(frontendReadiness.canonical, false);
  assert.equal(frontendReadiness.artifactKind, "derived-effective-policy");
  assert.equal(frontendReadiness.task, "TASK-FE-001");
  assert.deepEqual(frontendReadiness.applicability, {
    frontend: "substantial",
    backend: "not-applicable",
    behavioralUx: "not-applicable"
  });
  assert.deepEqual(frontendReadiness.hardRules, [
    "RULE-FE-COMPOSITION-001",
    "RULE-FE-NAV-001",
    "RULE-FE-PDA-AUTHORITY-001",
    "RULE-FE-PDA-HUMAN-001",
    "RULE-FE-PDA-RESEARCH-001",
    "RULE-FE-RETRIEVAL-001",
    "RULE-FE-SEMANTIC-001",
    "RULE-FE-STYLING-001",
    "RULE-FE-UI-POLICY-001",
    "RULE-SDE-ADMISSION-001",
    "RULE-SDE-GATE-STATUS-001",
    "RULE-SDE-P0-TRACE-001",
    "RULE-SDE-PLACEHOLDER-001"
  ]);
  assert.deepEqual(frontendReadiness.requiredEnforcements, [
    "feature-package-validation",
    "frontend-composition-contract-validation",
    "frontend-craft-contract-control",
    "frontend-global-retrieval-control",
    "frontend-human-asset-acquisition",
    "frontend-navigation-capability-control",
    "frontend-open-visual-research",
    "frontend-product-design-authority",
    "frontend-styling-authority-validation",
    "frontend-ui-policy-control",
    "governance-rule-admission-validation"
  ]);
  assert.match(frontendReadiness.sources.governancePolicy.sha256, /^[a-f0-9]{64}$/);
  assert.match(frontendReadiness.sources.capabilityRegistry.sha256, /^[a-f0-9]{64}$/);
  assert.match(frontendReadiness.sources.applicability.sha256, /^[a-f0-9]{64}$/);
  assertions += 9;

  const lightweightReadiness = resolve("frontend-lightweight-readiness", {
    stage: "design-readiness",
    applicability: lightweightFrontend
  });
  assert.deepEqual(lightweightReadiness.hardRules, [
    "RULE-FE-NAV-001",
    "RULE-FE-PDA-AUTHORITY-001",
    "RULE-FE-PDA-HUMAN-001",
    "RULE-FE-PDA-RESEARCH-001",
    "RULE-FE-RETRIEVAL-001",
    "RULE-FE-STYLING-001",
    "RULE-FE-UI-POLICY-001",
    "RULE-SDE-ADMISSION-001",
    "RULE-SDE-GATE-STATUS-001",
    "RULE-SDE-P0-TRACE-001",
    "RULE-SDE-PLACEHOLDER-001"
  ]);
  assert.deepEqual(lightweightReadiness.requiredEnforcements, [
    "feature-package-validation",
    "frontend-global-retrieval-control",
    "frontend-human-asset-acquisition",
    "frontend-navigation-capability-control",
    "frontend-open-visual-research",
    "frontend-product-design-authority",
    "frontend-styling-authority-validation",
    "frontend-ui-policy-control",
    "governance-rule-admission-validation"
  ]);
  assertions += 2;

  const behavioralUxReadiness = resolve("behavioral-ux-readiness", {
    stage: "design-readiness",
    applicability: behavioralUxApplicable
  });
  assert.ok(
    behavioralUxReadiness.hardRules.includes("RULE-FE-BUX-001"),
    "behavioral-ux: applicable must require the Behavioral UX Contract rule"
  );
  assert.ok(
    behavioralUxReadiness.requiredEnforcements.includes("frontend-behavioral-ux-contract-validation"),
    "behavioral-ux: applicable must require the contract validator"
  );
  assert.equal(
    frontendReadiness.hardRules.includes("RULE-FE-BUX-001"),
    false,
    "behavioral-ux: not-applicable must not drag the Behavioral UX rule in"
  );
  assertions += 3;

  const backendImplementation = resolve("backend-implementation", {
    stage: "implementation",
    applicability: substantialBackend
  });
  assert.deepEqual(backendImplementation.hardRules, [
    "RULE-BE-ARCH-001",
    "RULE-BE-LANG-001",
    "RULE-BE-STACK-001",
    "RULE-SDE-ADMISSION-001",
    "RULE-SDE-GATE-STATUS-001",
    "RULE-SDE-P0-TRACE-001",
    "RULE-SDE-PLACEHOLDER-001"
  ]);
  assert.deepEqual(backendImplementation.requiredEnforcements, [
    "backend-change-manifest-contract",
    "backend-naming-language-audit",
    "backend-technology-selection-validation",
    "feature-package-validation",
    "governance-rule-admission-validation"
  ]);
  assertions += 2;

  const noBackendImplementation = resolve("no-backend-implementation", {
    stage: "implementation",
    applicability: noProductSurface
  });
  assert.equal(noBackendImplementation.hardRules.includes("RULE-BE-STACK-001"), false);
  assert.equal(noBackendImplementation.requiredEnforcements.includes("backend-technology-selection-validation"), false);
  assertions += 2;

  const sessionClosure = resolve("session-closure", {
    stage: "session-closure",
    applicability: noProductSurface
  });
  assert.deepEqual(sessionClosure.hardRules, [
    "RULE-SDE-ADMISSION-001",
    "RULE-SDE-GATE-STATUS-001",
    "RULE-SDE-HANDOFF-001",
    "RULE-SDE-P0-TRACE-001",
    "RULE-SDE-PLACEHOLDER-001"
  ]);
  assert.deepEqual(sessionClosure.requiredEnforcements, [
    "feature-package-validation",
    "governance-rule-admission-validation",
    "session-handoff-control"
  ]);
  assertions += 2;

  const deterministicA = resolve("deterministic-a", {
    stage: "design-readiness",
    applicability: substantialFrontend
  });
  const deterministicB = resolve("deterministic-b", {
    stage: "design-readiness",
    applicability: substantialFrontend
  });
  assert.deepEqual(deterministicA, deterministicB, "same sources and inputs must produce byte-equivalent policy data");
  assertions += 1;

  assert.notEqual(
    frontendReadiness.sources.applicability.sha256,
    lightweightReadiness.sources.applicability.sha256,
    "different applicability sources must have different provenance hashes"
  );
  assertions += 1;

  const invalidApplicability = writeApplicability("invalid-applicability", {
    frontend: "substantial",
    "frontend-representative-gate": "not-required",
    "browser-evidence": "not-required"
  });
  expectRejected("invalid-applicability", {
    stage: "design-readiness",
    applicability: invalidApplicability
  }, /validate-applicability-contract\.mjs rejected resolver input/);

  expectRejected("unknown-stage", {
    stage: "made-up-stage",
    applicability: noProductSurface
  }, /Unknown workflow stage/);

  expectRejected("missing-feature", {
    stage: "design-readiness",
    feature: "",
    applicability: noProductSurface
  }, /--feature is required/);

  const outsideRoot = path.join(path.dirname(ROOT), `outside-applicability-${process.pid}.md`);
  fs.writeFileSync(outsideRoot, fs.readFileSync(noProductSurface));
  try {
    expectRejected("outside-root-applicability", {
      stage: "design-readiness",
      applicability: outsideRoot
    }, /must be inside project root/);
  } finally {
    fs.rmSync(outsideRoot, { force: true });
  }

  console.log(`Effective governance policy Phase 8C regression suite passed (${assertions} assertions).`);
} finally {
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
}
