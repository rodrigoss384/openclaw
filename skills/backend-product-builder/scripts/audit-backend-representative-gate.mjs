#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { parseArgs, printReport, readJson, runContractValidators, validateManifest } from "./lib/backend-package.mjs";
import { validateBackendGovernanceHardening } from "./lib/backend-governance-hardening.mjs";

const args = parseArgs(process.argv.slice(2));
const manifestPath = path.resolve(String(args._[0] || "docs/backend/backend-change-manifest.json"));
const root = path.resolve(String(args.root || process.cwd()));
let manifest;
try {
  manifest = readJson(manifestPath);
} catch (error) {
  printReport("Backend Product Builder — Representative Gate Audit", [`Cannot read manifest: ${error.message}`], []);
  process.exitCode = 1;
}

if (manifest) {
  const executionErrors = [];
  if (args["run-contract-validators"]) {
    try {
      const executions = runContractValidators(manifest, root, { timeoutMs: args["timeout-ms"] });
      fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
      for (const execution of executions) {
        console.log(`Contract validator ${execution.id}: ${execution.result} (${execution.evidencePath})`);
      }
    } catch (error) {
      executionErrors.push(`Cannot execute contract validators: ${error.message}`);
    }
  }
  const result = validateManifest(manifest, root, { checkFiles: true });
  const hardening = validateBackendGovernanceHardening(manifest, root, { checkFiles: true });
  result.errors.unshift(...executionErrors);
  result.errors.push(...hardening.errors);
  result.warnings.push(...hardening.warnings);
  if (manifest.gate?.required && manifest.gate.status !== "backend-broad-build-approved") {
    result.errors.push(`Representative gate is applicable but not released: ${manifest.gate?.status}`);
  }
  const ok = printReport("Backend Product Builder — Representative Gate Audit", result.errors, result.warnings, [
    `Feature: ${manifest.feature}`,
    `Human approval required: ${manifest.gate?.humanApprovalRequired}`
  ]);
  process.exitCode = ok ? 0 : 1;
}
