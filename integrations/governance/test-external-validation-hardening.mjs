import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { canonicalDigest, verifyCapabilityReceipt, createClientDeliveryAttestation } from "../frontend/ui-engineering-control.mjs";
const root = path.resolve(import.meta.dirname, "../..");
const run = (script, args = [], options = {}) => spawnSync(process.execPath, [path.join(root, script), ...args], { cwd: root, encoding: "utf8", ...options });

test("EVH-001 scalar arguments cannot select a different verification", async () => {
  const { materializeInvocation } = await import("./execution-context.mjs");
  const capability = { invocation: { argv: ["node", "check.mjs", "--principal", "<principal>"] } };
  assert.throws(() => materializeInvocation(capability, { principal: "human --receipt forged.json" }), /argument|flag|value/i);
  assert.throws(() => materializeInvocation(capability, { principal: "human --report-only" }));
  const reserved = run("integrations/governance/governance-control.mjs", ["enforce", "--root", root, "--feature", "external-validation-hardening", "--stage", "design-readiness", "--dry-run", "--set", "feature-package-validation=project-root=/tmp"]);
  assert.notEqual(reserved.status, 0); assert.match(reserved.stderr, /Reserved argument/);
  assert.deepEqual(materializeInvocation({ invocation: { argv: ["node", "check.mjs", "<file>"] } }, { file: "dir with spaces/input.json" }), ["node", "check.mjs", "dir with spaces/input.json"]);
});
test("EVH-002 recalculated hashes cannot validate empty execution evidence", () => {
  const receipt = { artifactKind: "capability-receipt", exitCode: 0, evidenceRoot: { scheme: "receipt-relative-v1", absolutePath: root }, inputs: [], outputs: [] };
  receipt.semanticDigest = canonicalDigest(receipt);
  assert.equal(verifyCapabilityReceipt(receipt).valid, false);
});
test("EVH-003 a rejection cannot authorize delivery", () => {
  const gate = { eligible: true, subject: { project: "fixture", commit: "a".repeat(40) }, policyDigest: "b".repeat(64), receiptDigests: [] };
  gate.semanticDigest = canonicalDigest(gate);
  assert.throws(() => createClientDeliveryAttestation(gate, { gateDigest: gate.semanticDigest, decision: "rejected" }), /approv|authoriz|reject/i);
});
test("EVH-004 unavailable Git comparison blocks applicability", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "evh-applicability-"));
  try {
    const source = fs.readFileSync(path.join(root, "skills/spec-driven-engineering/scripts/test-applicability-diff-crosscheck.mjs"), "utf8");
    const lines = [...source.matchAll(/^  "([a-z][a-z-]*: [a-z-]+)",?$/gm)].map(m => m[1]);
    const file = path.join(temp, "applicability.md"); fs.writeFileSync(file, lines.join("\n"));
    const r = run("skills/spec-driven-engineering/scripts/validate-applicability-contract.mjs", [file, "--root", temp, "--base-ref", "missing"]);
    assert.notEqual(r.status, 0, r.stdout + r.stderr);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
test("EVH-005 missing autonomy evidence is not evidence of no decisions", () => {
  const r = run("integrations/governance/autonomy-evidence.mjs", ["check", "--root", root, "--ledger", ".specs/features/nonexistent-evh/autonomous-decisions.json"]);
  assert.notEqual(r.status, 0, r.stdout + r.stderr);
});
test("EVH-006 Rust assertions removed from tracked tests block", async () => {
  const { assertionCount } = await import("../../skills/backend-product-builder/scripts/lib/test-integrity.mjs");
  for (const line of ["assert!(allowed);", "assert_eq!(status, 403);", "assert_ne!(a, b);"]) assert.equal(assertionCount(line), 1);
});
test("EVH-007 asset inventory may be empty only when source agrees", async () => {
  const { verifyAssetInventory } = await import("../frontend/product-design-control.mjs");
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "evh-assets-"));
  try {
    fs.mkdirSync(path.join(temp, "src")); fs.writeFileSync(path.join(temp, "src/form.tsx"), "export const Form = () => <form />;");
    assert.equal(verifyAssetInventory({ root: temp, sourceDirectories: ["src"], assets: [] }).status, "not-applicable");
    fs.writeFileSync(path.join(temp, "src/form.tsx"), "export const Form = () => <img src=\"./photo.png\" />;");
    assert.equal(verifyAssetInventory({ root: temp, sourceDirectories: ["src"], assets: [] }).status, "failed");
    fs.writeFileSync(path.join(temp, "src/form.tsx"), "export const Form = () => <form />;");
    fs.writeFileSync(path.join(temp, "src/style.css"), ".hero { background-image: url(/asset-without-extension); }");
    assert.equal(verifyAssetInventory({ root: temp, sourceDirectories: ["src"], assets: [] }).status, "failed");
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
test("EVH-008 failed, missing or dry-run reports cannot advance", async () => {
  const { validateStageReport } = await import("./execution-context.mjs");
  for (const report of [null, { dryRun: true }, { dryRun: false, executions: [], summary: { blockingFailures: 0 } }]) assert.throws(() => validateStageReport(report, "current"));
});
