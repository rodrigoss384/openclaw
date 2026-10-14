#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateCrossScreenProductSemantics } from "../frontend/cross-screen-product-semantics.mjs";
import { validateFamilySemanticSignatures } from "./semantic-differentiation.mjs";
import { validateCrossThemePerceptualCalibration } from "./perceptual-family-calibration.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "../..");
const CORE = path.join(SCRIPT_DIR, "frontend-family-consistency-core.mjs");

function parseArgs(argv) {
  const parsed = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      parsed._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) parsed[key] = true;
    else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function replaceOption(argv, name, value) {
  const result = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== `--${name}`) {
      result.push(argv[index]);
      continue;
    }
    if (argv[index + 1] && !argv[index + 1].startsWith("--")) index += 1;
  }
  result.push(`--${name}`, value);
  return result;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function resolveFrom(root, value) {
  return path.isAbsolute(String(value)) ? path.normalize(String(value)) : path.resolve(root, String(value));
}

function semanticRoute() {
  return {
    owner: "frontend-product-builder",
    affectedContracts: ["design-system", "screen-specification", "component-catalog"],
    repairStrategy: "canonical-contract-repair",
    providerCommand: null,
    returnStage: "DESIGN_READINESS",
    revalidationSet: ["craft-contract", "screen-specification", "component-catalog", "design-system", "browser-evidence"]
  };
}

function perceptualRoute(finding) {
  const contract = finding.defectKind === "contract";
  return {
    owner: "frontend-product-builder",
    affectedContracts: finding.class === "spatial-density"
      ? ["recipe", "screen-specification", "composition-proof"]
      : ["design-system", "screen-specification"],
    repairStrategy: contract ? "canonical-contract-repair" : "targeted-implementation-repair",
    providerCommand: finding.class === "semantic-color" ? "colorize" : "layout",
    returnStage: contract ? "DESIGN_READINESS" : "PATCH",
    revalidationSet: ["craft-contract", "design-system", "browser-evidence", "impeccable-detector"]
  };
}

function productSemanticsRoute(error) {
  return {
    owner: "frontend-product-builder",
    affectedContracts: error.affectedContracts,
    repairStrategy: "canonical-contract-repair",
    providerCommand: null,
    returnStage: "DESIGN_READINESS",
    revalidationSet: error.revalidationSet
  };
}

function phase10aFindings({ root, manifest, report }) {
  const design = readJson(resolveFrom(root, manifest.designSystem));
  const crafts = (manifest.samples || []).map((sample) => readJson(resolveFrom(root, sample.craftContract)));
  return validateFamilySemanticSignatures(design, crafts).map((error, index) => ({
    id: `phase10a-semantic-${String(index + 1).padStart(3, "0")}`,
    scope: "cross-screen",
    class: "semantic-presentation",
    defectKind: "contract",
    summary: error.message,
    subjects: error.subjects?.length ? error.subjects : (report.coverage?.screenIds?.length ? report.coverage.screenIds : [report.visualFamilyId]),
    route: semanticRoute()
  }));
}

function perceptualFindings({ root, manifest }) {
  return validateCrossThemePerceptualCalibration({ root, manifest }).map((finding, index) => ({
    id: `perceptual-calibration-${String(index + 1).padStart(3, "0")}`,
    scope: "cross-theme",
    class: finding.class,
    defectKind: finding.defectKind,
    summary: finding.summary,
    subjects: finding.subjects,
    route: perceptualRoute(finding)
  }));
}

function phase10eFindings({ root, manifest }) {
  return validateCrossScreenProductSemantics({ root, manifest }).map((error, index) => ({
    id: `phase10e-product-${String(index + 1).padStart(3, "0")}`,
    scope: "cross-screen",
    class: error.class,
    defectKind: error.defectKind,
    summary: error.summary,
    subjects: error.subjects,
    route: productSemanticsRoute(error)
  }));
}

const argv = process.argv.slice(2);
const args = parseArgs(argv);

// RULE-FE-FAMILY-CONSISTENCY-001 applies to every substantial frontend
// feature, but Phase 7 comparison itself is only meaningful when a family has
// 2+ screens or the design system supports 2+ themes (rules.md#composição-
// visual-frontend, frontend-overlay.md). A brand-new single-screen family has
// nothing to compare, so it must not be forced to fabricate a manifest --
// but it also must not silently skip the check. --not-applicable requires an
// explicit, recorded reason (mirrors frontend-control.mjs's
// --product-design-not-applicable); the adversarial stage independently
// judges whether that claim is honest against real project structure.
if (!args.manifest) {
  const notApplicable = args["not-applicable"];
  if (notApplicable !== undefined) {
    if (notApplicable === true || String(notApplicable).trim() === "") {
      process.stderr.write("--not-applicable requires an explicit reason: --not-applicable \"<reason>\"\n");
      process.exit(1);
    }
    process.stdout.write(`${JSON.stringify({
      artifactKind: "frontend-family-consistency-report",
      status: "not-applicable",
      reason: String(notApplicable)
    }, null, 2)}\n`);
    process.exit(0);
  }
  const result = spawnSync(process.execPath, [CORE, ...argv], { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}

const root = path.resolve(String(args.root || DEFAULT_ROOT));
const manifestPath = resolveFrom(root, args.manifest);
const manifest = readJson(manifestPath);
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "phase10-family-"));
const outputPath = resolveFrom(root, args.output || path.join(tempDir, "frontend-family-consistency-report.json"));
const coreArgs = replaceOption(argv, "output", outputPath);
const result = spawnSync(process.execPath, [CORE, ...coreArgs], { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) {
  process.stderr.write(`${result.error.message}\n`);
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status ?? 1);

try {
  const report = readJson(outputPath);
  const extra = [
    ...perceptualFindings({ root, manifest }),
    ...phase10aFindings({ root, manifest, report }),
    ...phase10eFindings({ root, manifest })
  ];
  if (extra.length) {
    report.findings.push(...extra);
    if (extra.some((finding) => finding.scope === "cross-theme")) report.checks.crossTheme = "failed";
    if (extra.some((finding) => finding.scope === "cross-screen")) report.checks.crossScreen = "failed";
    if (extra.some((finding) => finding.defectKind === "contract")) report.transition = "DESIGN_READINESS";
    else report.transition = "PATCH";
    report.status = "failed";
    writeJson(outputPath, report);
    for (const finding of extra) process.stderr.write(`[${finding.id}] ${finding.summary}\n`);
    if (args["report-only"] !== true) process.exit(2);
  }
  process.exit(0);
} finally {
  if (!args.output) fs.rmSync(tempDir, { recursive: true, force: true });
}
