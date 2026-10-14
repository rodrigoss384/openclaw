#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VALIDATOR = path.join(SKILL_ROOT, "scripts/validate-styling-authority.mjs");
const MIGRATOR = path.join(SKILL_ROOT, "scripts/migrate-styling-authority-v2.mjs");
const TEMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "styling-authority-v2-"));
const HASH = "a".repeat(64);
let assertions = 0;

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => key !== "semanticDigest")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, canonical(child)]));
}

function digest(value) {
  return crypto.createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

function writeJson(relative, value) {
  const target = path.join(TEMP_ROOT, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
  return target;
}

function run(script, args, status = 0) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: TEMP_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  assert.equal(result.status, status, `Unexpected status for ${path.basename(script)}.\n${result.stdout}\n${result.stderr}`);
  assertions += 1;
  return result;
}

function baseContract() {
  return {
    $schema: "../schemas/styling-authority.schema.json",
    version: "2.0.0",
    status: "ready",
    repositoryEvidence: {
      inspectedFiles: ["docs/frontend/design-system.json"],
      detectedMechanisms: ["tailwind-utilities"],
      classOwnershipTraces: []
    },
    authority: {
      primaryMechanism: "tailwind-utilities",
      tokenSources: ["docs/frontend/design-system.json"],
      componentSources: ["src/components/Button.tsx"],
      globalStylesheets: []
    },
    policies: {
      preserveExistingArchitecture: true,
      parallelStylingArchitectureAllowed: false,
      classOwnershipTraceRequired: true,
      unresolvedClassMayBeOverridden: false,
      componentSelectorsInGlobalStyles: "forbidden-unless-legacy-authority-or-approved-exception",
      rawValuesInFeatureCode: "forbidden-unless-approved-exception",
      arbitraryUtilityValues: "forbidden-unless-approved-exception",
      inlineStyles: "runtime-only-with-rationale",
      rawValuesInTokenAuthority: "allowed"
    },
    visualResearch: { ref: "docs/frontend/visual-research.json", semanticDigest: HASH },
    visualReferences: [{
      referenceId: "REF-001",
      status: "adopted",
      appliedTo: ["screen:cases", "decision:contextual"],
      visualResearchDigest: HASH
    }],
    exceptions: []
  };
}

try {
  fs.mkdirSync(path.join(TEMP_ROOT, "docs/frontend"), { recursive: true });
  fs.writeFileSync(path.join(TEMP_ROOT, "docs/frontend/design-system.json"), "{}\n");
  fs.mkdirSync(path.join(TEMP_ROOT, "src/components"), { recursive: true });
  fs.writeFileSync(path.join(TEMP_ROOT, "src/components/Button.tsx"), "export const Button = () => null;\n");
  const research = { artifactKind: "visual-research", schemaVersion: "1.0.0", subject: { project: "fixture", commit: "abc" }, references: [{ id: "REF-001" }] };
  research.semanticDigest = digest(research);
  const researchPath = writeJson("docs/frontend/visual-research.json", research);

  const contract = baseContract();
  contract.visualResearch.semanticDigest = research.semanticDigest;
  contract.visualReferences[0].visualResearchDigest = research.semanticDigest;
  const contractPath = writeJson("docs/frontend/styling-authority.json", contract);
  run(VALIDATOR, [contractPath, "--check-references"]);

  const duplicated = structuredClone(contract);
  duplicated.visualReferences[0].source = "https://example.com/copied-provenance";
  const duplicatedPath = writeJson("docs/frontend/styling-authority-duplicated.json", duplicated);
  run(VALIDATOR, [duplicatedPath], 1);

  const stale = structuredClone(contract);
  stale.visualResearch.semanticDigest = "0".repeat(64);
  stale.visualReferences[0].visualResearchDigest = "0".repeat(64);
  const stalePath = writeJson("docs/frontend/styling-authority-stale.json", stale);
  const staleResult = run(VALIDATOR, [stalePath, "--check-references"], 1);
  assert.match(`${staleResult.stdout}${staleResult.stderr}`, /VISUAL_RESEARCH_DIGEST_STALE/);
  assertions += 1;

  const legacy = JSON.parse(fs.readFileSync(path.join(SKILL_ROOT, "evals/files/contracts/valid/styling-authority.valid.json"), "utf8"));
  legacy.version = "1.0.0";
  delete legacy.visualResearch;
  legacy.visualReferences = [{
    id: "VREF-EXAMPLE-001",
    kind: "existing-product",
    source: "docs/frontend/design-system.json",
    status: "approved",
    approvedAspects: ["layout-rhythm"],
    excludedAspects: ["brand-identity"],
    evidence: ["src/components/Button.tsx"]
  }];
  legacy.repositoryEvidence.inspectedFiles = ["docs/frontend/design-system.json", "src/components/Button.tsx"];
  legacy.authority.tokenSources = ["docs/frontend/design-system.json"];
  legacy.authority.componentSources = ["src/components/Button.tsx"];
  legacy.authority.globalStylesheets = [];
  const legacyPath = writeJson("docs/frontend/styling-authority-v1.json", legacy);
  const legacyResult = run(VALIDATOR, [legacyPath]);
  assert.match(`${legacyResult.stdout}${legacyResult.stderr}`, /STYLING_AUTHORITY_V1_SHADOW_ONLY/);
  assertions += 1;

  const applicationsPath = writeJson("docs/frontend/visual-reference-applications.json", {
    "VREF-EXAMPLE-001": { referenceId: "REF-001", appliedTo: ["screen:cases", "decision:contextual"] }
  });
  const migratedPath = path.join(TEMP_ROOT, "docs/frontend/styling-authority-migrated.json");
  run(MIGRATOR, [legacyPath, "--visual-research", researchPath, "--applications", applicationsPath, "--output", migratedPath]);
  const migrated = JSON.parse(fs.readFileSync(migratedPath, "utf8"));
  assert.equal(migrated.version, "2.0.0");
  assert.deepEqual(Object.keys(migrated.visualReferences[0]).sort(), ["appliedTo", "referenceId", "status", "visualResearchDigest"].sort());
  run(VALIDATOR, [migratedPath, "--check-references"]);
  assertions += 2;

  console.log(`Styling Authority v2 suite passed (${assertions} assertions).`);
} finally {
  fs.rmSync(TEMP_ROOT, { recursive: true, force: true });
}
