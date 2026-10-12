#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { printReport } from "./lib/backend-package.mjs";
import { validateJsonSchema } from "./lib/json-schema.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const requiredFiles = [
  "SKILL.md",
  "agents/openai.yaml",
  "references/workflow.md",
  "references/contracts-and-documentation.md",
  "references/modeling-and-boundaries.md",
  "references/security.md",
  "references/reliability-observability.md",
  "references/representative-gate.md",
  "references/authority-routing.md",
  "assets/backend-change-manifest.schema.json",
  "assets/backend-change-manifest.template.json",
  "assets/backend-interface-scenario-matrix.template.md",
  "assets/backend-readiness.template.md",
  "assets/backend-representative-scorecard.schema.json",
  "assets/backend-representative-scorecard.template.json",
  "assets/backend-validator-evidence.schema.json",
  "scripts/validate-backend-package.mjs",
  "scripts/prepare-backend-representative-gate.mjs",
  "scripts/audit-backend-representative-gate.mjs",
  "scripts/audit-test-integrity.mjs",
  "scripts/audit-naming-language.mjs",
  "scripts/test-naming-language.mjs",
  "scripts/run-integration-suite.mjs",
  "scripts/test-enforcement-negative.mjs",
  "scripts/test-backend-governance-hardening.mjs",
  "scripts/test-technology-selection.mjs",
  "scripts/lib/backend-governance-hardening.mjs",
  "scripts/lib/json-schema.mjs"
];
for (const file of requiredFiles) if (!fs.existsSync(path.join(root, file))) errors.push(`Missing skill file: ${file}`);

const skill = fs.readFileSync(path.join(root, "SKILL.md"), "utf8");
for (const fragment of [
  "DISCOVER → CLASSIFY → CONTRACT",
  "ready-for-backend-slice",
  "backend-broad-build-approved",
  "Do not introduce a repository",
  "docs/backend/",
  "--run-contract-validators",
  "backend-representative-scorecard.template.json",
  "reliability.externalDependencies[]",
  "security.boundaries",
  "audit-test-integrity.mjs",
  "finding → systemicCause → canonicalAuthorityRef"
]) {
  if (!skill.includes(fragment)) errors.push(`SKILL.md is missing contract: ${fragment}`);
}
const forbiddenInstallFragment = [".agents", "skills"].join("/") + "/";
for (const file of requiredFiles.filter((item) => item.endsWith(".mjs"))) {
  const content = fs.existsSync(path.join(root, file)) ? fs.readFileSync(path.join(root, file), "utf8") : "";
  if (content.includes(forbiddenInstallFragment)) errors.push(`${file} hardcodes an installation path`);
}
try {
  const manifestSchema = JSON.parse(fs.readFileSync(path.join(root, "assets/backend-change-manifest.schema.json"), "utf8"));
  const manifestTemplate = JSON.parse(fs.readFileSync(path.join(root, "assets/backend-change-manifest.template.json"), "utf8"));
  const scorecardSchema = JSON.parse(fs.readFileSync(path.join(root, "assets/backend-representative-scorecard.schema.json"), "utf8"));
  const scorecardTemplate = JSON.parse(fs.readFileSync(path.join(root, "assets/backend-representative-scorecard.template.json"), "utf8"));
  JSON.parse(fs.readFileSync(path.join(root, "assets/backend-validator-evidence.schema.json"), "utf8"));
  for (const error of validateJsonSchema(manifestTemplate, manifestSchema)) errors.push(`Manifest template schema: ${error}`);
  for (const error of validateJsonSchema(scorecardTemplate, scorecardSchema)) errors.push(`Scorecard template schema: ${error}`);
} catch (error) {
  errors.push(`Invalid JSON asset: ${error.message}`);
}
const legacyScorecardTemplate = ["backend-representative-scorecard", "template", "md"].join(".");
if (fs.existsSync(path.join(root, "assets", legacyScorecardTemplate))) {
  errors.push("Legacy Markdown scorecard template must not coexist with the machine-readable scorecard");
}

const ok = printReport("Backend Product Builder — Structure Validation", errors, [], [`Files checked: ${requiredFiles.length}`]);
process.exitCode = ok ? 0 : 1;
