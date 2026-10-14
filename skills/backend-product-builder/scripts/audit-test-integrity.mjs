#!/usr/bin/env node
import fs from "node:fs";
import { assertionCount } from "./lib/test-integrity.mjs";
import { loadExecutionContext } from "../../../integrations/governance/execution-context.mjs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parseArgs, printReport, readJson } from "./lib/backend-package.mjs";
import { validateBackendGovernanceHardening } from "./lib/backend-governance-hardening.mjs";

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(String(args.root || process.cwd()));
const manifestPath = path.resolve(root, String(args.manifest || "docs/backend/backend-change-manifest.json"));
const base = String(args.base || "").trim();
const output = args.output ? path.resolve(root, String(args.output)) : null;

const DISABLE_OR_SKIP = /(?:\b(?:describe|it|test)\.(?:skip|only)\s*\(|\b(?:xdescribe|xit|xtest)\s*\(|@pytest\.mark\.skip\b|@unittest\.skip\b|@Disabled\b|\bt\.Skip\s*\(|#\[ignore\])/;
const CONTRACT_ID = /\b(?:REQ|AC|SCN|AT|PROP)-[A-Za-z0-9][A-Za-z0-9-]*-[0-9]{3}\b/g;

function git(argsList) {
  return spawnSync("git", argsList, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function isTestPath(file) {
  const normalized = file.replaceAll("\\", "/");
  return /(?:^|\/)(?:test|tests|spec|specs)(?:\/|$)/i.test(normalized)
    || /(?:\.test\.|\.spec\.|_test\.|\/test_[^/]+\.)/i.test(normalized);
}

function underDeclaredPath(file, declared) {
  const normalized = file.replaceAll("\\", "/");
  return declared.some((prefix) => {
    const p = prefix.replaceAll("\\", "/").replace(/\/$/, "");
    return normalized === p || normalized.startsWith(`${p}/`);
  });
}

function currentContractIds(testPaths) {
  const ids = new Set();
  const seen = new Set();
  function visit(target) {
    const resolved = path.resolve(root, target);
    if (!resolved.startsWith(`${root}${path.sep}`) && resolved !== root) return;
    if (!fs.existsSync(resolved)) return;
    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(resolved)) visit(path.relative(root, path.join(resolved, name)));
      return;
    }
    const rel = path.relative(root, resolved).replaceAll(path.sep, "/");
    if (!isTestPath(rel) || seen.has(rel)) return;
    seen.add(rel);
    const content = fs.readFileSync(resolved, "utf8");
    for (const match of content.matchAll(CONTRACT_ID)) ids.add(match[0]);
  }
  for (const testPath of testPaths) visit(testPath);
  return ids;
}

const errors = [];
const warnings = [];
let manifest;
try {
  manifest = readJson(manifestPath);
} catch (error) {
  errors.push(`Cannot read backend manifest: ${error.message}`);
}

if (!base) errors.push("--base <git-ref> is required; test integrity cannot infer the review baseline safely");
if (manifest) {
  try {
    const context = loadExecutionContext(root, manifest.feature);
    if (base !== context.baseCommit) errors.push("Test audit baseline differs from frozen execution context");
    const current = manifest.testIntegrity?.testPaths ?? [];
    if (!context.testPaths.length || context.testPaths.some(ref => !current.includes(ref))) errors.push("Frozen test inventory was reduced or is empty");
    const baselineManifest = git(["show", `${base}:${path.relative(root, manifestPath).split(path.sep).join("/")}`]);
    if (baselineManifest.status === 0) {
      const previous = JSON.parse(baselineManifest.stdout).testIntegrity?.testPaths ?? [];
      if (previous.some(ref => !current.includes(ref))) errors.push("Test inventory was reduced against baseline manifest");
    }
  } catch (error) { errors.push(error.message); }
  const hardening = validateBackendGovernanceHardening(manifest, root, { checkFiles: false });
  errors.push(...hardening.errors);
  warnings.push(...hardening.warnings);
}

const findings = [];
if (errors.length === 0) {
  const testPaths = manifest.testIntegrity.testPaths;
  const status = git(["diff", "--name-status", "--no-renames", base, "--", ...testPaths]);
  const diff = git(["diff", "--unified=0", "--no-color", "--no-renames", base, "--", ...testPaths]);
  if (status.status !== 0) errors.push(`Cannot compare test baseline '${base}': ${status.stderr.trim() || status.stdout.trim()}`);
  if (diff.status !== 0) errors.push(`Cannot read test diff from '${base}': ${diff.stderr.trim() || diff.stdout.trim()}`);

  if (errors.length === 0) {
    for (const line of status.stdout.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const [change, ...parts] = line.split(/\s+/);
      const file = parts.join(" ");
      if (change === "D" && isTestPath(file) && underDeclaredPath(file, testPaths)) {
        findings.push({ code: "TEST_FILE_DELETED", file, detail: "A declared-scope test file was deleted." });
      }
    }

    let removedAssertions = 0;
    let addedAssertions = 0;
    const removedContractIds = new Set();
    let currentFile = null;
    for (const line of diff.stdout.split(/\r?\n/)) {
      if (line.startsWith("+++ b/")) {
        currentFile = line.slice(6);
        continue;
      }
      if (line.startsWith("--- ") || line.startsWith("@@")) continue;
      if (!currentFile || !isTestPath(currentFile)) continue;
      if (line.startsWith("+") && !line.startsWith("+++")) {
        const body = line.slice(1);
        if (DISABLE_OR_SKIP.test(body)) {
          findings.push({ code: "TEST_DISABLED_OR_SKIPPED", file: currentFile, detail: body.trim().slice(0, 240) });
        }
        addedAssertions += assertionCount(body);
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        const body = line.slice(1);
        removedAssertions += assertionCount(body);
        for (const match of body.matchAll(CONTRACT_ID)) removedContractIds.add(match[0]);
      }
    }

    if (removedAssertions > addedAssertions) {
      findings.push({
        code: "NET_ASSERTION_REMOVAL",
        file: null,
        detail: `Removed assertion-like lines (${removedAssertions}) exceed added assertion-like lines (${addedAssertions}) across declared test paths.`
      });
    }

    const currentIds = currentContractIds(testPaths);
    for (const id of [...removedContractIds].sort()) {
      if (!currentIds.has(id)) {
        findings.push({ code: "CONTRACT_TEST_ID_REMOVED", file: null, detail: `Contract-linked test marker disappeared from current tests: ${id}` });
      }
    }
  }
}

for (const finding of findings) errors.push(`${finding.code}: ${finding.detail}${finding.file ? ` (${finding.file})` : ""}`);

const evidence = {
  schemaVersion: "1.0.0",
  artifactKind: "backend-test-integrity-evidence",
  baseRef: base || null,
  testPaths: manifest?.testIntegrity?.testPaths || [],
  contractualCoverage: manifest?.testIntegrity?.contractualCoverage || null,
  findings,
  result: errors.length === 0 ? "passed" : "failed",
  checkedAt: new Date().toISOString()
};

if (output) {
  if (output !== root && !output.startsWith(`${root}${path.sep}`)) errors.push("--output must stay inside project root");
  else {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`);
  }
}

const ok = printReport("Backend Product Builder — Test Integrity Audit", errors, warnings, [
  `Base: ${base || "<missing>"}`,
  `Findings: ${findings.length}`
]);
process.exitCode = ok ? 0 : 1;
