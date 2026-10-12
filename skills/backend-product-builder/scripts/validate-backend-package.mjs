#!/usr/bin/env node
import path from "node:path";
import { parseArgs, printReport, readJson, validateManifest } from "./lib/backend-package.mjs";
import { validateBackendGovernanceHardening } from "./lib/backend-governance-hardening.mjs";

const args = parseArgs(process.argv.slice(2));
const manifestPath = path.resolve(String(args._[0] || "docs/backend/backend-change-manifest.json"));
const root = path.resolve(String(args.root || process.cwd()));
let manifest;
try {
  manifest = readJson(manifestPath);
} catch (error) {
  printReport("Backend Product Builder — Package Validation", [`Cannot read manifest: ${error.message}`], []);
  process.exitCode = 1;
}

if (manifest) {
  const result = validateManifest(manifest, root, { checkFiles: true });
  const hardening = validateBackendGovernanceHardening(manifest, root, { checkFiles: true });
  result.errors.push(...hardening.errors);
  result.warnings.push(...hardening.warnings);
  const ok = printReport("Backend Product Builder — Package Validation", result.errors, result.warnings, [
    `Feature: ${manifest.feature}`,
    `Mode: ${manifest.mode}`,
    `Gate: ${manifest.gate?.status}`
  ]);
  process.exitCode = ok ? 0 : 1;
}
