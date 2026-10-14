#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scripts = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scripts, "..");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "backend-product-builder-"));
let assertions = 0;

function run(script, args, expectFailure = false) {
  const result = spawnSync("node", [path.join(scripts, script), ...args], { encoding: "utf8", cwd: root });
  if (expectFailure) assert.notEqual(result.status, 0, `${script} unexpectedly passed:\n${result.stdout}\n${result.stderr}`);
  else assert.equal(result.status, 0, `${script} failed:\n${result.stdout}\n${result.stderr}`);
  assertions += 1;
  return result;
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function noGateConditions() {
  return {
    newServiceOrSubsystem: false,
    publicContract: false,
    persistenceOrMigration: false,
    securityOrTenancy: false,
    materialOperationalCost: false,
    criticalRisk: false,
    largeOrComplex: false
  };
}

function fixture(name, mutate = () => {}) {
  const directory = path.join(temp, name);
  run("prepare-backend-representative-gate.mjs", ["--root", directory, "--feature", name]);
  const manifestPath = path.join(directory, "docs/backend", name, "backend-change-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  write(path.join(directory, "openapi/openapi.yaml"), "openapi: 3.1.0\ninfo:\n  title: fixture\n  version: 1.0.0\npaths: {}\n");
  mutate(manifest, directory);
  write(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { directory, manifestPath, manifest };
}

function backendReadinessPath(manifest) {
  return path.posix.join(path.posix.dirname(manifest.slice.scorecardPath), "backend-readiness.md");
}

function writeValidatorEvidence(manifest, directory) {
  for (const entry of manifest.interfaces) {
    const contract = path.join(directory, entry.contractPath);
    const evidence = {
      $schema: "../backend-validator-evidence.schema.json",
      schemaVersion: "1.0.0",
      interfaceId: entry.id,
      command: entry.validatorCommand,
      cwd: path.resolve(directory),
      contractPath: entry.contractPath,
      contractSha256: sha256(contract),
      startedAt: "2026-08-05T12:00:00Z",
      endedAt: "2026-08-05T12:00:01Z",
      exitCode: 0,
      result: "passed",
      stdout: "contract valid",
      stderr: ""
    };
    write(path.join(directory, entry.validatorEvidencePath), `${JSON.stringify(evidence, null, 2)}\n`);
    entry.validatorResult = "passed";
  }
}

function approveScorecard(manifest, directory, decision = "approved") {
  const scorecardPath = path.join(directory, manifest.slice.scorecardPath);
  const scorecard = JSON.parse(fs.readFileSync(scorecardPath, "utf8"));
  for (const dimension of scorecard.dimensions) {
    dimension.status = "passed";
    dimension.rationale = "Verified by representative integration fixture";
    dimension.evidencePaths = [backendReadinessPath(manifest)];
    dimension.findings = [];
  }
  scorecard.criticalFindings = [];
  scorecard.acceptedRisks = decision === "approved-with-accepted-risk"
    ? [{ id: "RISK-FIXTURE-001", authority: "fixture-owner", rationale: "Explicitly accepted test fixture risk" }]
    : [];
  scorecard.decision = decision;
  scorecard.reviewer = "independent-fixture-reviewer";
  scorecard.timestamp = "2026-08-05T12:00:02Z";
  write(scorecardPath, `${JSON.stringify(scorecard, null, 2)}\n`);
  if (manifest.technology?.selection === "rust-axum-default") {
    write(path.join(directory, `docs/backend/${manifest.feature}/evidence/rust-quality-gates.txt`), "FMT_EXIT=0\nCLIPPY_EXIT=0\n");
  }
}

function approve(manifest, directory, options = {}) {
  manifest.gate.status = "backend-broad-build-approved";
  manifest.slice.status = "passed";
  manifest.security.boundaries = [{
    trustBoundary: "authenticated request to protected fixture resource",
    resource: "tenant-owned fixture resource",
    identitySource: "verified fixture access-token subject",
    tenantBinding: "tenant id bound from authenticated fixture principal",
    authorizationPoint: "fixture resource lookup with deny-by-default tenant predicate",
    negativeTestIds: ["AT-FIXTURE-001"]
  }];
  for (const entry of manifest.interfaces) entry.validatorCommand = "node -e \"process.exit(0)\"";
  writeValidatorEvidence(manifest, directory);
  approveScorecard(manifest, directory, options.scorecardDecision || "approved");
  manifest.decision = manifest.gate.humanApprovalRequired
    ? { state: options.manifestDecision || "approved", approver: "authorized-human", timestamp: "2026-08-05T12:00:03Z" }
    : { state: "not-required", approver: "", timestamp: "" };
}

function save(fixtureValue) {
  write(fixtureValue.manifestPath, `${JSON.stringify(fixtureValue.manifest, null, 2)}\n`);
}

try {
  run("validate-skill-structure.mjs", []);
  run("test-enforcement-negative.mjs", []);

  const quick = fixture("backend-small-low", (manifest) => {
    manifest.mode = "quick-fix";
    manifest.complexity = "small";
    manifest.criticality = "low";
    manifest.gate = {
      required: false,
      reasons: ["Localized change with no representative condition"],
      conditions: noGateConditions(),
      humanApprovalRequired: false,
      status: "not-applicable"
    };
    manifest.slice.status = "not-applicable";
    manifest.decision.state = "not-required";
  });
  run("validate-backend-package.mjs", [quick.manifestPath, "--root", quick.directory, "--check-files"]);

  const rest = fixture("rest-standard");
  approve(rest.manifest, rest.directory);
  save(rest);
  run("audit-backend-representative-gate.mjs", [rest.manifestPath, "--root", rest.directory]);

  const executed = fixture("validator-execution");
  executed.manifest.interfaces[0].validatorCommand = "node -e \"process.exit(0)\"";
  executed.manifest.gate.status = "backend-broad-build-approved";
  executed.manifest.slice.status = "passed";
  executed.manifest.security.boundaries = [{
    trustBoundary: "authenticated request to protected fixture resource",
    resource: "tenant-owned fixture resource",
    identitySource: "verified fixture access-token subject",
    tenantBinding: "tenant id bound from authenticated fixture principal",
    authorizationPoint: "fixture resource lookup with deny-by-default tenant predicate",
    negativeTestIds: ["AT-FIXTURE-001"]
  }];
  executed.manifest.decision.state = "not-required";
  approveScorecard(executed.manifest, executed.directory);
  save(executed);
  run("audit-backend-representative-gate.mjs", [
    executed.manifestPath,
    "--root",
    executed.directory,
    "--run-contract-validators",
    "--timeout-ms",
    "5000"
  ]);
  const executedEvidence = JSON.parse(fs.readFileSync(path.join(executed.directory, executed.manifest.interfaces[0].validatorEvidencePath), "utf8"));
  assert.equal(executedEvidence.exitCode, 0);
  assertions += 1;

  const auth = fixture("authorization-tenancy-critical", (manifest) => {
    manifest.mode = "extension";
    manifest.criticality = "critical";
    manifest.gate.conditions = { ...noGateConditions(), securityOrTenancy: true, criticalRisk: true };
    manifest.gate.required = true;
    manifest.gate.humanApprovalRequired = true;
    manifest.gate.reasons = ["Material tenant authorization and critical risk"];
    manifest.security.materialChange = true;
  });
  approve(auth.manifest, auth.directory);
  save(auth);
  run("audit-backend-representative-gate.mjs", [auth.manifestPath, "--root", auth.directory]);

  const publicContract = fixture("public-contract-standard", (manifest) => {
    manifest.mode = "extension";
    manifest.interfaces[0].exposure = "public";
    manifest.interfaces[0].changeType = "compatible";
    manifest.gate.conditions = { ...noGateConditions(), publicContract: true };
    manifest.gate.required = true;
    manifest.gate.humanApprovalRequired = true;
    manifest.gate.reasons = ["Public API contract change requires approval"];
  });
  approve(publicContract.manifest, publicContract.directory);
  save(publicContract);
  run("audit-backend-representative-gate.mjs", [publicContract.manifestPath, "--root", publicContract.directory]);

  const migration = fixture("migration-expand-contract", (manifest) => {
    manifest.mode = "migration";
    manifest.gate.conditions = { ...noGateConditions(), persistenceOrMigration: true };
    manifest.gate.required = true;
    manifest.gate.humanApprovalRequired = true;
    manifest.gate.status = "ready-for-backend-slice";
    manifest.gate.reasons = ["Persistence migration requires representative proof and human approval"];
    manifest.data.applicable = true;
    manifest.data.evidencePath = backendReadinessPath(manifest);
    manifest.data.notApplicableReason = "";
    manifest.data.materialChange = true;
    manifest.data.migrationStrategy = "expand-contract";
    manifest.data.verificationCommand = "npm test -- migration";
    manifest.data.rollbackOrRecovery = "Forward recovery with reconciliation";
  });
  save(migration);
  run("audit-backend-representative-gate.mjs", [migration.manifestPath, "--root", migration.directory], true);

  for (const kind of ["event", "graphql", "grpc"]) {
    const item = fixture(`contract-${kind}`, (manifest, directory) => {
      manifest.interfaces[0].kind = kind;
      manifest.technology.httpFramework = "not-applicable";
      if (kind === "event") {
        manifest.interfaces[0].contractType = "asyncapi";
        manifest.interfaces[0].contractPath = "asyncapi/events.yaml";
        write(path.join(directory, manifest.interfaces[0].contractPath), "asyncapi: 3.0.0\ninfo:\n  title: fixture\n  version: 1.0.0\nchannels: {}\noperations: {}\n");
        manifest.reliability.idempotency = "Consumer deduplication key is tested";
        manifest.reliability.retries = "Bounded retry followed by DLQ";
      } else if (kind === "graphql") {
        manifest.interfaces[0].contractType = "graphql-sdl";
        manifest.interfaces[0].contractPath = "graphql/schema.graphql";
        write(path.join(directory, manifest.interfaces[0].contractPath), "type Query { health: String! }\n");
      } else {
        manifest.interfaces[0].contractType = "protobuf";
        manifest.interfaces[0].contractPath = "proto/fixture.proto";
        write(path.join(directory, manifest.interfaces[0].contractPath), "syntax = \"proto3\";\nservice Fixture { rpc Health (HealthRequest) returns (HealthReply); }\nmessage HealthRequest {}\nmessage HealthReply { string status = 1; }\n");
      }
    });
    approve(item.manifest, item.directory);
    save(item);
    run("audit-backend-representative-gate.mjs", [item.manifestPath, "--root", item.directory]);
  }

  const integration = fixture("external-integration", (manifest) => {
    manifest.mode = "integration";
    manifest.interfaces[0].exposure = "partner";
    manifest.interfaces[0].changeType = "new";
    manifest.gate.conditions = { ...noGateConditions(), publicContract: true };
    manifest.gate.required = true;
    manifest.gate.humanApprovalRequired = true;
    manifest.gate.reasons = ["Partner integration contract requires representative proof"];
    manifest.reliability.timeouts = "500 ms within the caller latency budget";
    manifest.reliability.retries = "Two idempotent retries with backoff";
    manifest.reliability.recovery = "Partial failure returned and reconciled asynchronously";
    manifest.reliability.externalDependencies = [{
      dependency: "fixture-partner-api",
      timeout: "500ms within caller latency budget",
      retry: { maxAttempts: 2, backoff: "exponential 100ms with jitter" },
      transientOnly: true,
      idempotency: "safe",
      failureMode: "surface-error",
      evidence: [backendReadinessPath(manifest)]
    }];
  });
  approve(integration.manifest, integration.directory);
  save(integration);
  run("audit-backend-representative-gate.mjs", [integration.manifestPath, "--root", integration.directory]);

  const justifiedArchitecture = fixture("justified-architecture", (manifest) => {
    manifest.architecture.introducedMechanisms = [{
      kind: "queue",
      justification: "REQ-JUSTIFIED-001 requires durable asynchronous recovery across dependency outages",
      driverIds: ["REQ-JUSTIFIED-001"],
      evidencePaths: [backendReadinessPath(manifest)]
    }];
  });
  approve(justifiedArchitecture.manifest, justifiedArchitecture.directory);
  save(justifiedArchitecture);
  run("audit-backend-representative-gate.mjs", [justifiedArchitecture.manifestPath, "--root", justifiedArchitecture.directory]);

  const drift = fixture("contract-drift");
  approve(drift.manifest, drift.directory);
  save(drift);
  write(path.join(drift.directory, drift.manifest.interfaces[0].contractPath), "openapi: 3.1.0\ninfo:\n  title: changed\n  version: 2.0.0\npaths: {}\n");
  run("audit-backend-representative-gate.mjs", [drift.manifestPath, "--root", drift.directory], true);

  const pendingScorecard = fixture("pending-scorecard");
  pendingScorecard.manifest.gate.status = "backend-broad-build-approved";
  pendingScorecard.manifest.slice.status = "passed";
  pendingScorecard.manifest.security.boundaries = [{
    trustBoundary: "authenticated request to protected fixture resource",
    resource: "tenant-owned fixture resource",
    identitySource: "verified fixture access-token subject",
    tenantBinding: "tenant id bound from authenticated fixture principal",
    authorizationPoint: "fixture resource lookup with deny-by-default tenant predicate",
    negativeTestIds: ["AT-FIXTURE-001"]
  }];
  pendingScorecard.manifest.decision.state = "not-required";
  for (const entry of pendingScorecard.manifest.interfaces) entry.validatorCommand = "node -e \"process.exit(0)\"";
  writeValidatorEvidence(pendingScorecard.manifest, pendingScorecard.directory);
  save(pendingScorecard);
  run("audit-backend-representative-gate.mjs", [pendingScorecard.manifestPath, "--root", pendingScorecard.directory], true);

  const degraded = fixture("no-git-context7-contract-tooling", (manifest) => {
    manifest.mode = "quick-fix";
    manifest.complexity = "small";
    manifest.criticality = "low";
    manifest.gate = {
      required: false,
      reasons: ["Localized change; contract tooling probe unavailable"],
      conditions: noGateConditions(),
      humanApprovalRequired: false,
      status: "not-applicable"
    };
    manifest.interfaces[0].validatorCommand = "probe reported validator unavailable";
    manifest.interfaces[0].validatorResult = "not-run";
    manifest.slice.status = "not-applicable";
    manifest.decision.state = "not-required";
  });
  save(degraded);
  const degradedResult = run("validate-backend-package.mjs", [degraded.manifestPath, "--root", degraded.directory, "--check-files"]);
  assert.match(degradedResult.stdout, /WARN.*contract validator is not-run/);
  assertions += 1;

  const unjustified = fixture("unjustified-architecture", (manifest) => {
    manifest.architecture.introducedMechanisms = [{
      kind: "microservice",
      justification: "",
      driverIds: [],
      evidencePaths: []
    }];
  });
  save(unjustified);
  run("validate-backend-package.mjs", [unjustified.manifestPath, "--root", unjustified.directory, "--check-files"], true);

  const duplicate = path.join(temp, "prepare-refuses-overwrite");
  run("prepare-backend-representative-gate.mjs", ["--root", duplicate, "--feature", "first"]);
  run("prepare-backend-representative-gate.mjs", ["--root", duplicate, "--feature", "second"]);
  run("prepare-backend-representative-gate.mjs", ["--root", duplicate, "--feature", "first"], true);

  console.log(`Backend Product Builder integration suite: passed (${assertions} assertions)`);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
