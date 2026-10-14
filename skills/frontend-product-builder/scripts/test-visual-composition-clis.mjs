#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SKILL_ROOT = path.resolve(SCRIPT_DIRECTORY, "..");

function parseArguments(argv) {
  const options = { root: DEFAULT_SKILL_ROOT, json: false, keepTemporaryRepository: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--root") {
      if (!argv[index + 1]) throw new Error("--root requires a directory path.");
      options.root = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (argument === "--json") {
      options.json = true;
      continue;
    }
    if (argument === "--keep-temp") {
      options.keepTemporaryRepository = true;
      continue;
    }
    throw new Error(`Unknown option '${argument}'.`);
  }
  return options;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function sha256(filePath) {
  return crypto.createHash("sha256").update(await fs.readFile(filePath)).digest("hex");
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    timeout: 20000,
    maxBuffer: 4 * 1024 * 1024
  });
  return {
    command,
    args,
    cwd,
    status: typeof result.status === "number" ? result.status : 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error ? result.error.message : null
  };
}

function output(result) {
  return [result.stdout, result.stderr, result.error ?? ""].filter(Boolean).join("\n");
}

function visualGrammar() {
  const style = (size, weight, color = "tokens.semantic.color.text.primary") => ({
    familyToken: "tokens.semantic.font.family.interface",
    sizeToken: size,
    weightToken: weight,
    lineHeightToken: "tokens.semantic.font.lineHeight.normal",
    trackingToken: "tokens.semantic.font.tracking.normal",
    colorToken: color,
    wrapping: "wrap",
    usage: ["Integration-test visual role."],
    exceptions: []
  });
  return {
    baseProfile: "productive",
    semanticTextStyles: {
      display: style("tokens.semantic.font.size.display", "tokens.semantic.font.weight.bold"),
      pageTitle: style("tokens.semantic.font.size.pageTitle", "tokens.semantic.font.weight.semibold"),
      sectionTitle: style("tokens.semantic.font.size.sectionTitle", "tokens.semantic.font.weight.semibold"),
      subsectionTitle: style("tokens.semantic.font.size.subsectionTitle", "tokens.semantic.font.weight.medium"),
      body: style("tokens.semantic.font.size.body", "tokens.semantic.font.weight.regular"),
      bodyStrong: style("tokens.semantic.font.size.body", "tokens.semantic.font.weight.medium"),
      label: style("tokens.semantic.font.size.label", "tokens.semantic.font.weight.medium", "tokens.semantic.color.text.secondary"),
      metadata: style("tokens.semantic.font.size.metadata", "tokens.semantic.font.weight.regular", "tokens.semantic.color.text.muted"),
      caption: style("tokens.semantic.font.size.caption", "tokens.semantic.font.weight.regular", "tokens.semantic.color.text.muted"),
      metric: style("tokens.semantic.font.size.metric", "tokens.semantic.font.weight.semibold"),
      code: {
        ...style("tokens.semantic.font.size.code", "tokens.semantic.font.weight.regular"),
        familyToken: "tokens.semantic.font.family.mono"
      }
    },
    spacingRelations: [
      { id: "internal", purpose: "internal", token: "tokens.semantic.space.internal", owner: "component" },
      { id: "related", purpose: "related-elements", token: "tokens.semantic.space.related", owner: "parent-layout" },
      { id: "group", purpose: "group-separation", token: "tokens.semantic.space.group", owner: "region" },
      { id: "region", purpose: "region-separation", token: "tokens.semantic.space.region", owner: "page" }
    ],
    alignmentPolicy: { rules: ["Use declared key lines."], evidence: ["visual-composition-evidence.json"] },
    emphasisPolicy: { rules: ["One focal point per state."], evidence: ["visual-quality-scorecard.json"] },
    contrastPolicy: { rules: ["Do not rely only on color."], evidence: ["visual-composition-evidence.json"] },
    responsiveTypePolicy: { rules: ["Preserve reading order."], evidence: ["screen-spec.json"] },
    momentOverrides: []
  };
}

function visualHierarchy(screen) {
  const regionId = screen.recipe?.regions?.[0]?.screenRegionId ?? "mainRegion";
  return {
    applicability: "full",
    baseProfile: "productive",
    dominantTask: screen.screen?.primaryTask ?? "Complete the primary task",
    focalPointByState: [
      { stateId: "data", elementId: "primary-heading", priority: "primary", rationale: "Orient the user before action." }
    ],
    semanticOutline: [
      { id: "primary-heading", level: 1, text: "Primary heading", regionId, purpose: "Document orientation." }
    ],
    visualPriorityLadder: [
      { id: "primary-priority", elementId: "primary-heading", priority: "primary", visualRole: "pageTitle", signals: ["size", "weight", "position"] },
      { id: "supporting-priority", elementId: "supporting-summary", priority: "supporting", visualRole: "body", signals: ["proximity", "body role"] }
    ],
    readingPath: [
      { order: 1, elementId: "primary-heading", expectedAttention: "primary" },
      { order: 2, elementId: "supporting-summary", expectedAttention: "supporting" }
    ],
    textRoleAssignments: [
      { elementId: "primary-heading", semanticElement: "h1", textRole: "pageTitle", tokenSource: "design-system.visualGrammar.semanticTextStyles.pageTitle" },
      { elementId: "supporting-summary", semanticElement: "p", textRole: "body", tokenSource: "design-system.visualGrammar.semanticTextStyles.body" }
    ],
    alignmentAnchors: [
      { id: "main-left-keyline", axis: "x", owner: regionId, elements: ["primary-heading", "supporting-summary"], tolerancePx: 1 }
    ],
    proximityGroups: [
      { id: "heading-summary", elements: ["primary-heading", "supporting-summary"], relationship: "Summary explains heading.", closerThan: ["secondary-region"] }
    ],
    whitespaceZones: [
      { id: "region-space", owner: regionId, purpose: "Separate primary and supporting regions.", token: "tokens.semantic.space.region" }
    ],
    repetitionRules: ["Repeated items keep role and key-line consistency."],
    balanceStrategy: ["One focal point per state."],
    emphasisBudget: { maxDominantFocalPointsPerState: 1, maxPrimaryActionsPerState: 1, colorOnlyHierarchyAllowed: false },
    responsivePriority: [
      { viewport: "compact", preservedPriorities: ["primary-heading"], transformations: ["Keep heading before metadata."] }
    ],
    exceptions: []
  };
}

async function prepare(root, tempRoot) {
  const screen = await readJson(path.join(root, "evals/files/contracts/valid/screen-specification.valid.json"));
  const design = await readJson(path.join(root, "evals/files/contracts/valid/design-system.valid.json"));
  screen.visualHierarchy = visualHierarchy(screen);
  design.visualGrammar = visualGrammar();

  const screenPath = path.join(tempRoot, "screen-spec.json");
  const designPath = path.join(tempRoot, "design-system.json");
  const proofPath = path.join(tempRoot, "composition-proof.json");
  const evidencePath = path.join(tempRoot, "visual-composition-evidence.json");
  const scorecardPath = path.join(tempRoot, "visual-quality-scorecard.json");

  await writeJson(screenPath, screen);
  await writeJson(designPath, design);
  const proof = {
    $schema: "../schemas/composition-proof.schema.json",
    meta: { feature: "integration", screenId: "example-screen", version: "1.1.0", status: "approved" },
    applicability: "full",
    baseProfile: "productive",
    screenSpec: screenPath,
    designSystem: designPath,
    contentSource: "integration fixture",
    alternatives: [
      { id: "alternative-a", profile: "productive", rationale: "Clear operational hierarchy.", dominantTask: "Complete the primary task", focalPoint: "primary-heading", readingPath: ["primary-heading", "supporting-summary"], grayscale: true },
      { id: "alternative-b", profile: "productive", rationale: "Summary-led entry that front-loads status before the task.", dominantTask: "Complete the primary task", focalPoint: "supporting-summary", readingPath: ["supporting-summary", "primary-heading"], grayscale: false }
    ],
    viewports: [{ width: 390, height: 844, purpose: "compact" }, { width: 1440, height: 900, purpose: "wide" }],
    captures: ["screenshots/composition-proof-wide.png"],
    contractHashes: { screenSpecSha256: await sha256(screenPath), designSystemSha256: await sha256(designPath) },
    humanDecision: { status: "approved", approvedAlternative: "alternative-a", approvedBy: "Integration Test", decidedAt: "2026-01-01T12:00:00Z", notes: "Approved for test." }
  };
  await writeJson(proofPath, proof);

  const regionId = screen.recipe?.regions?.[0]?.screenRegionId ?? "mainRegion";
  const primaryBox = { x: 32, y: 32, width: 360, height: 32 };
  const supportingBox = { x: 32, y: 72, width: 420, height: 24 };
  const evidence = {
    $schema: "../schemas/visual-composition-evidence.schema.json",
    meta: { screenId: "example-screen", stateId: "data", capturedAt: "2026-01-01T12:00:00Z", runner: "integration-test" },
    contractHashes: {
      screenSpecSha256: await sha256(screenPath),
      designSystemSha256: await sha256(designPath),
      compositionProofSha256: await sha256(proofPath),
      craftContractSha256: "d".repeat(64),
      contractSetSha256: "e".repeat(64)
    },
    theme: { id: "light", scheme: "light", separationModelObserved: "mixed", contextValidated: true },
    viewports: [{ id: "wide", width: 1440, height: 900 }],
    regions: [
      {
        id: regionId,
        viewport: "wide",
        parentRegionId: null,
        surfaceRole: "canvas",
        surfaceLevel: 0,
        accentRole: null,
        borderRole: null,
        borderPurpose: null,
        containerBox: { x: 0, y: 0, width: 800, height: 200 },
        contentBox: { x: 0, y: 0, width: 800, height: 200 },
        contentOccupancy: 1,
        nestingDepth: 0,
        heightStrategyObserved: "content-driven",
        rendered: true,
        presenceSignal: null
      }
    ],
    elements: [
      {
        id: "primary-heading",
        viewport: "wide",
        regionId,
        componentUsageId: null,
        semanticElement: "h1",
        textRole: "pageTitle",
        priority: "primary",
        semanticDataRole: null,
        presentationFamily: null,
        contrastRole: "primary",
        contrastRatio: 12,
        semanticColorRole: null,
        colorSource: "neutral-token",
        accentRole: null,
        box: primaryBox,
        containerBox: primaryBox,
        contentBox: primaryBox,
        computedStyle: { fontSize: "24px", fontWeight: "600", lineHeight: "32px", letterSpacing: "0px", color: "rgb(15, 23, 42)" },
        tokens: ["tokens.semantic.font.size.pageTitle"],
        rendered: true,
        presenceSignal: null
      },
      {
        id: "supporting-summary",
        viewport: "wide",
        regionId,
        componentUsageId: null,
        semanticElement: "p",
        textRole: "body",
        priority: "supporting",
        semanticDataRole: null,
        presentationFamily: null,
        contrastRole: "secondary",
        contrastRatio: 8,
        semanticColorRole: null,
        colorSource: "neutral-token",
        accentRole: null,
        box: supportingBox,
        containerBox: supportingBox,
        contentBox: supportingBox,
        computedStyle: { fontSize: "16px", fontWeight: "400", lineHeight: "24px", letterSpacing: "0px", color: "rgb(15, 23, 42)" },
        tokens: ["tokens.semantic.font.size.body"],
        rendered: true,
        presenceSignal: null
      }
    ],
    presenceSignals: [],
    interactions: [],
    wayfinding: { mode: "not-applicable", rendered: false, targetId: null, parentRoute: null },
    decisionSignals: [],
    relations: {
      readingOrder: ["primary-heading", "supporting-summary"],
      alignment: [{ id: "main-left-keyline", status: "passed", evidence: "0px delta" }],
      proximity: [{ id: "heading-summary", status: "passed", evidence: "related group is closer than unrelated groups" }],
      contrast: [{ id: "primary-heading", status: "passed", evidence: "AA contrast observed" }]
    }
  };
  await writeJson(evidencePath, evidence);
  const passed = (id) => ({ id, result: "passed", evidence: "integration evidence", blocking: true });
  const scorecard = {
    $schema: "../schemas/visual-quality-scorecard.schema.json",
    meta: { screenId: "example-screen", version: "1.1.0", reviewedAt: "2026-01-01T12:00:00Z", reviewer: "Integration Test" },
    criteria: [
      "semantic-outline", "visual-priority", "reading-path", "typographic-distinction", "proximity", "alignment", "whitespace", "emphasis-budget", "responsive-priority", "non-success-state", "aesthetic-critique"
    ].map(passed),
    decision: { status: "approved", humanApprovalRequired: true, approvedBy: "Integration Test", approvedAt: "2026-01-01T12:00:00Z", notes: "Approved for test.", risk: null }
  };
  await writeJson(scorecardPath, scorecard);
  return { screenPath, designPath, proofPath, evidencePath, scorecardPath };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "fpb-composition-"));
  const files = await prepare(options.root, tempRoot);
  const targets = [
    {
      id: "composition-contract",
      args: [path.join(options.root, "scripts/validate-visual-composition-contract.mjs"), files.screenPath, files.designPath, files.proofPath]
    },
    {
      id: "composition-evidence",
      args: [path.join(options.root, "scripts/audit-visual-composition-evidence.mjs"), files.screenPath, files.designPath, files.proofPath, files.evidencePath]
    },
    {
      id: "visual-scorecard",
      args: [path.join(options.root, "scripts/validate-visual-quality-scorecard.mjs"), files.scorecardPath]
    }
  ];
  const results = targets.map((target) => {
    const result = run("node", target.args, tempRoot);
    return { id: target.id, status: result.status, output: output(result).slice(0, 4000), passed: result.status === 0 };
  });
  const summary = {
    total: results.length,
    passed: results.filter((result) => result.passed).length,
    expectationMismatches: results.filter((result) => !result.passed).length,
    tempRoot: options.keepTemporaryRepository ? tempRoot : null
  };
  if (!options.keepTemporaryRepository) {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
  const report = { title: "Visual Composition CLI Integration Tests", summary, results };
  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`${report.title}\n`);
    process.stdout.write(`${"=".repeat(report.title.length)}\n`);
    for (const result of results) {
      process.stdout.write(`${result.passed ? "PASS" : "FAIL"} ${result.id}\n`);
      if (!result.passed) process.stdout.write(`${result.output}\n`);
    }
    process.stdout.write(`\nExpectation mismatches: ${summary.expectationMismatches}\n`);
  }
  process.exitCode = summary.expectationMismatches === 0 ? 0 : 1;
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
