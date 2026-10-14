#!/usr/bin/env node

// Contract for GATE-008/009/010/011 (responsive, accessibility, audits,
// defects) at the small-slice representative-gate preparer.
//
// These four checks used to be decided by grepping the narrative evidence
// files (implementation-journal.md, browser-validation.md,
// design-system-audit.md, defect-log.md) for a literal
// "**Gate status:** `validated`" marker — typing that exact string into an
// otherwise-empty file satisfied all four gates, in two independently
// duplicated implementations (prepare-representative-gate.mjs and
// audit-small-slice-evidence.mjs). The fix: both now read the evidence
// entry's own schema-validated `status` enum
// (small-slice-manifest.schema.json), and the markdown body is read only for
// placeholder scanning.
//
// This test proves both directions of the fix:
//   - status disagrees with the (untouched) markdown marker -> gates fail
//   - markdown marker is removed but status says "passed" -> gates still pass
// A test that only checked one direction could pass by accident (e.g. if the
// old regex check were merely made *additionally* required rather than
// replaced).

import assert from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(SCRIPT_DIR, "..");
const GENERATOR = path.join(SCRIPT_DIR, "test-representative-gate-preparer-cli.mjs");
const PREPARER = path.join(SCRIPT_DIR, "prepare-representative-gate.mjs");
const AUDITOR = path.join(SCRIPT_DIR, "audit-small-slice-evidence.mjs");
const SCREEN_DIRECTORY = "docs/frontend/screens/gate-preparation-screen";

const STATUS_BACKED_TYPES = [
  "implementation-journal",
  "browser-validation",
  "design-system-audit",
  "defect-log"
];

let assertions = 0;

function run(command, args, cwd, timeout = 90000) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    timeout,
    maxBuffer: 64 * 1024 * 1024
  });
  return {
    status: typeof result.status === "number" ? result.status : 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
}

async function copyRepository(source, destination) {
  await fs.cp(source, destination, { recursive: true });
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function gateStatusById(preparation) {
  const map = new Map();
  for (const check of preparation?.requiredChecks ?? []) {
    map.set(check.id, check.status === "passed");
  }
  return map;
}

// Every prior invocation of prepare-representative-gate.mjs against an
// uncommitted Git working tree leaves an untracked report file behind, and
// audit-small-slice-files.mjs (one of this script's own child audits) treats
// any untracked file outside the declared plan as SLICE_FILE_UNDECLARED_CHANGE
// -- including a *previous* run's own output. test-small-slice-auditor-clis.mjs
// hits the same thing and works around it the same way: clear prior outputs
// before each fresh invocation, and always write the canonical filename the
// manifest schema and the rest of this pipeline expect.
const CANONICAL_OUTPUT_NAME = "representative-gate-preparation.json";

async function cleanPreparerOutputs(repositoryRoot) {
  const screenDirectory = path.join(repositoryRoot, SCREEN_DIRECTORY);
  let entries;
  try {
    entries = await fs.readdir(screenDirectory, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isFile() && entry.name.startsWith("representative-gate-preparation") && entry.name.endsWith(".json")) {
      await fs.rm(path.join(screenDirectory, entry.name), { force: true });
    }
  }
}

async function prepareGate(repositoryRoot) {
  await cleanPreparerOutputs(repositoryRoot);
  const manifestPath = path.join(repositoryRoot, SCREEN_DIRECTORY, "small-slice-manifest.json");
  const outputPath = path.join(repositoryRoot, SCREEN_DIRECTORY, CANONICAL_OUTPUT_NAME);
  const result = run(process.execPath, [PREPARER, manifestPath, outputPath], repositoryRoot);
  let preparation = null;
  try {
    preparation = await readJson(outputPath);
  } catch {
    preparation = null;
  }
  return { result, preparation };
}

async function auditEvidence(repositoryRoot) {
  const manifestPath = path.join(repositoryRoot, SCREEN_DIRECTORY, "small-slice-manifest.json");
  return run(process.execPath, [AUDITOR, manifestPath, "--json"], repositoryRoot);
}

const generatorReportPath = path.join(
  SKILL_ROOT,
  "evals/files/contracts/representative-gate-preparer-integration-report.json"
);

const generatorRun = run(
  process.execPath,
  [GENERATOR, "--root", SKILL_ROOT, "--keep-temp", "--json"],
  SKILL_ROOT,
  180000
);
if (generatorRun.status !== 0) {
  throw new Error(`Unable to generate baseline fixtures:\n${generatorRun.stdout}\n${generatorRun.stderr}`.slice(0, 8000));
}

const generatorReport = await readJson(generatorReportPath);
const temporaryRoot = generatorReport?.meta?.temporaryRoot;
assert.ok(typeof temporaryRoot === "string", "fixture generator must expose meta.temporaryRoot");
const approvedRoot = path.join(temporaryRoot, "approved");

const statusMismatchRoot = path.join(temporaryRoot, "status-mismatch");
const contentMismatchRoot = path.join(temporaryRoot, "content-mismatch");

try {
  // Copy both scenario trees from the untouched fixture before anything
  // writes a preparer output into approvedRoot itself.
  await copyRepository(approvedRoot, statusMismatchRoot);
  await copyRepository(approvedRoot, contentMismatchRoot);

  // Sanity: the untouched "approved" fixture (evidence.status: "passed" for
  // all four types, matching markdown that also claims validated) passes all
  // four gates. This is the baseline every mutation below is compared against.
  const { preparation: baseline, result: baselineResult } = await prepareGate(approvedRoot);
  assert.equal(baselineResult.status, 0, `Baseline preparation must succeed.\n${baselineResult.stdout}${baselineResult.stderr}`);
  const baselineGates = gateStatusById(baseline);
  for (const id of ["GATE-008", "GATE-009", "GATE-010", "GATE-011"]) {
    assert.equal(baselineGates.get(id), true, `Baseline ${id} must pass.`);
    assertions += 1;
  }

  const baselineAudit = await auditEvidence(approvedRoot);
  assert.equal(baselineAudit.status, 0, `Baseline evidence audit must pass.\n${baselineAudit.stdout}${baselineAudit.stderr}`);
  assertions += 1;

  // Direction 1: flip evidence.status away from "passed" while leaving the
  // markdown bodies completely untouched (they still contain the
  // "**Gate status:** `validated`" marker). If the fix is real, the gates
  // that depend on this evidence must now fail — markdown content alone must
  // no longer be sufficient.
  const statusMismatchManifestPath = path.join(statusMismatchRoot, SCREEN_DIRECTORY, "small-slice-manifest.json");
  const statusMismatchManifest = await readJson(statusMismatchManifestPath);
  for (const entry of statusMismatchManifest.evidence) {
    if (STATUS_BACKED_TYPES.includes(entry.type)) {
      entry.status = "available";
    }
  }
  await writeJson(statusMismatchManifestPath, statusMismatchManifest);

  const { preparation: mismatchPreparation, result: mismatchResult } = await prepareGate(statusMismatchRoot);
  // Exit code reflects overall approval eligibility (0 = can request
  // approval, 1 = blocked), not whether the tool ran to completion — a
  // legitimately blocked run is expected to exit 1 here.
  assert.equal(mismatchResult.status, 1, `A blocked preparation must exit 1.\n${mismatchResult.stdout}${mismatchResult.stderr}`);
  assert.ok(mismatchPreparation, `Preparer must still write its report JSON when blocked.\n${mismatchResult.stdout}${mismatchResult.stderr}`);
  const mismatchGates = gateStatusById(mismatchPreparation);
  for (const id of ["GATE-008", "GATE-009", "GATE-010", "GATE-011"]) {
    assert.equal(
      mismatchGates.get(id),
      false,
      `${id} must fail when evidence.status disagrees with the untouched markdown marker — the marker text must not be sufficient on its own.`
    );
    assertions += 1;
  }

  const mismatchAudit = await auditEvidence(statusMismatchRoot);
  assert.notEqual(mismatchAudit.status, 0, "The evidence audit must reject evidence.status values other than 'passed'.");
  for (const type of STATUS_BACKED_TYPES) {
    const code = {
      "implementation-journal": "SLICE_EVIDENCE_JOURNAL_NOT_VALIDATED",
      "browser-validation": "SLICE_EVIDENCE_BROWSER_NOT_VALIDATED",
      "design-system-audit": "SLICE_EVIDENCE_DESIGN_AUDIT_NOT_VALIDATED",
      "defect-log": "SLICE_EVIDENCE_DEFECT_LOG_NOT_VALIDATED"
    }[type];
    assert.match(mismatchAudit.stdout, new RegExp(code), `Evidence audit must report ${code} for '${type}' with status other than passed.`);
    assertions += 1;
  }

  // Direction 2: the inverse. Keep evidence.status: "passed" (untouched) but
  // strip every trace of the old magic marker from the narrative bodies. The
  // gates must still pass — proving the structured field is authoritative
  // and the markdown body's content is no longer load-bearing for the
  // pass/fail outcome (it is still scanned separately for placeholders,
  // which is unrelated to this fix).
  const narrativeFiles = ["browser-validation.md", "design-system-audit.md", "defect-log.md", "small-slice-implementation-journal.md"];
  for (const fileName of narrativeFiles) {
    const filePath = path.join(contentMismatchRoot, SCREEN_DIRECTORY, fileName);
    try {
      await fs.writeFile(filePath, "This narrative carries no status marker of any kind.\n", "utf8");
    } catch {
      // Not every fixture necessarily has all four files under this exact
      // name; entries that don't exist are not part of this direction.
    }
  }
  const { preparation: contentPreparation, result: contentResult } = await prepareGate(contentMismatchRoot);
  assert.equal(contentResult.status, 0, `Preparer must run to completion.\n${contentResult.stdout}${contentResult.stderr}`);
  const contentGates = gateStatusById(contentPreparation);
  for (const id of ["GATE-008", "GATE-009", "GATE-010", "GATE-011"]) {
    assert.equal(
      contentGates.get(id),
      true,
      `${id} must still pass when evidence.status is "passed" even though the narrative body carries no status marker.`
    );
    assertions += 1;
  }

  const contentAudit = await auditEvidence(contentMismatchRoot);
  assert.equal(contentAudit.status, 0, `Evidence audit must pass on status alone, regardless of narrative body content.\n${contentAudit.stdout}${contentAudit.stderr}`);
  assertions += 1;

  console.log(`Evidence status authority contract passed (${assertions} assertions).`);
} finally {
  await fs.rm(path.join(temporaryRoot, "status-mismatch"), { recursive: true, force: true });
  await fs.rm(path.join(temporaryRoot, "content-mismatch"), { recursive: true, force: true });
}
