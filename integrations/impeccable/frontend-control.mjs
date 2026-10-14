#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateJsonSchema } from "../../skills/spec-driven-engineering/scripts/lib/json-schema.mjs";
import { validateProductDesignReadinessReceipt } from "../frontend/product-design-control.mjs";
import { runRepresentativeCli } from "./representative-control.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "../..");
const CRAFT_ADAPTER = path.join(SCRIPT_DIR, "frontend-craft.mjs");
const DIMENSIONS = [
  "spatialComposition",
  "perceptualHierarchy",
  "semanticPresentation",
  "interactionClarity",
  "decisionSupport",
  "typographyCoherence"
];

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(`Cannot read JSON ${filePath}: ${error.message}`);
  }
}

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

function resolveFrom(root, value) {
  if (!value) return null;
  return path.isAbsolute(String(value)) ? path.resolve(String(value)) : path.resolve(root, String(value));
}

function resolvePolicy(root, args) {
  return resolveFrom(root, args.policy || "prompts/spec-driven/frontend-craft-policy.json");
}

function runCraftAdapter(root, policyPath, commandArgs) {
  const result = spawnSync(
    process.execPath,
    [CRAFT_ADAPTER, ...commandArgs, "--root", root, "--policy", policyPath],
    { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );
  if (result.status !== 0) {
    if (result.stdout) process.stderr.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    fail(`Frontend craft adapter failed while running '${commandArgs[0]}'.`);
  }
  return result;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function routeFor(policy, dimension) {
  const route = policy?.readiness?.dimensionRoutes?.[dimension];
  if (!route) fail(`frontend-craft-policy.json is missing readiness.dimensionRoutes.${dimension}`);
  return route;
}

function validatePolicyReadiness(policy) {
  const readiness = policy?.readiness;
  if (!readiness) fail("frontend-craft-policy.json is missing the Phase 3 readiness policy.");
  if (readiness.relationshipMode !== "resolved-unresolved-blocked") fail("readiness.relationshipMode must be resolved-unresolved-blocked.");
  if (readiness.shapeInvocation !== "unresolved-provider-eligible-only") fail("readiness.shapeInvocation must be unresolved-provider-eligible-only.");
  if (readiness.canonicalAdoptionRequired !== true || readiness.rederiveAfterAdoption !== true) {
    fail("Phase 3 readiness requires canonical adoption followed by derivation.");
  }
  for (const dimension of DIMENSIONS) routeFor(policy, dimension);
}

function classifyRelationship({ dimension, contract, policy, previousReport }) {
  const craftDimension = contract?.dimensions?.[dimension];
  if (!craftDimension) fail(`Derived craft contract is missing dimension '${dimension}'.`);
  const route = routeFor(policy, dimension);
  const sourceRoles = new Set((contract.sources || []).map((source) => source.role));
  const requiredSourceRoles = unique(route.requiredSourceRoles || []);
  const missingSourceRoles = requiredSourceRoles.filter((role) => !sourceRoles.has(role));

  let status = craftDimension.status === "resolved" ? "resolved" : "unresolved";
  let rationale = craftDimension.rationale || `Derived craft dimension '${dimension}' is ${craftDimension.status}.`;

  if (status !== "resolved" && missingSourceRoles.length) {
    status = "blocked";
    rationale = `Cannot resolve '${dimension}' safely because canonical source roles are missing: ${missingSourceRoles.join(", ")}. Provider shape may not invent missing authority.`;
  }

  const previousProviderDimensions = new Set(previousReport?.shape?.dimensions || []);
  if (status !== "resolved" && previousReport && previousProviderDimensions.has(dimension)) {
    status = "blocked";
    const changed = previousReport.contractSetSha256 !== contract.contractSetSha256;
    rationale = changed
      ? `Canonical sources changed after provider adoption, but '${dimension}' is still ${craftDimension.status}. The contract model cannot derive the adopted decision yet; do not repeat shape for this dimension.`
      : `No canonical contract-set change was observed after provider resolution for '${dimension}'. Adopt the accepted decision into an approved canonical artifact before re-deriving; do not repeat shape.`;
  }

  return {
    dimension,
    craftStatus: craftDimension.status,
    status,
    owner: route.owner,
    providerEligible: route.providerEligible,
    sourceRefs: unique(craftDimension.sourceRefs || []),
    canonicalTargets: unique(route.canonicalTargets || []),
    requiredSourceRoles,
    missingSourceRoles,
    rationale
  };
}

function groupCanonicalActions(relationships) {
  const grouped = new Map();
  for (const relationship of relationships) {
    if (relationship.status !== "unresolved" || relationship.providerEligible) continue;
    const key = relationship.owner;
    const current = grouped.get(key) || { dimensions: [], targets: [] };
    current.dimensions.push(relationship.dimension);
    current.targets.push(...relationship.canonicalTargets);
    grouped.set(key, current);
  }
  return [...grouped.entries()].map(([owner, value]) => ({
    type: "resolve-canonical",
    dimensions: unique(value.dimensions),
    owner,
    canonicalTargets: unique(value.targets),
    instruction: `Resolve only these unresolved relationships in their existing canonical contracts, then rerun frontend-control.mjs readiness: ${unique(value.dimensions).join(", ")}.`
  }));
}

function buildReport({ root, screenSpecPath, policy, policyPath, outputPath, craftContractPath, previousReportPath, productDesignReadinessPath, productDesignRequired }) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.mkdirSync(path.dirname(craftContractPath), { recursive: true });

  runCraftAdapter(root, policyPath, ["derive-craft", "--screen-spec", screenSpecPath, "--output", craftContractPath]);
  runCraftAdapter(root, policyPath, ["verify-craft", "--craft-contract", craftContractPath]);
  const contract = readJson(craftContractPath);

  let previousReport = null;
  if (previousReportPath) {
    previousReport = readJson(previousReportPath);
    if (previousReport.screenId !== contract.screenId) {
      fail(`--after-adoption report screen '${previousReport.screenId}' does not match '${contract.screenId}'.`);
    }
  }

  const relationships = DIMENSIONS.map((dimension) => classifyRelationship({ dimension, contract, policy, previousReport }));
  const blocked = relationships.filter((item) => item.status === "blocked").map((item) => item.dimension);
  const unresolved = relationships.filter((item) => item.status === "unresolved").map((item) => item.dimension);
  const providerDimensions = relationships
    .filter((item) => item.status === "unresolved" && item.providerEligible)
    .map((item) => item.dimension);

  const productDesignReceipt = productDesignReadinessPath ? readJson(productDesignReadinessPath) : null;
  const productDesignVerification = productDesignReceipt
    ? validateProductDesignReadinessReceipt(productDesignReceipt)
    : { valid: false, passed: false, stale: false, status: "not-supplied", digest: "", errors: [] };
  const productDesignBlocked = productDesignReceipt
    ? !productDesignVerification.valid || !productDesignVerification.passed
    : productDesignRequired;

  const shapeAllowed = !productDesignBlocked && blocked.length === 0 && providerDimensions.length > 0;
  const shapeRequired = shapeAllowed;
  const shapeReason = productDesignBlocked
    ? "Shape is blocked until current Product Design Readiness passes; craft authority cannot replace missing product authority."
    : blocked.length
    ? `Shape is blocked until canonical blockers are repaired: ${blocked.join(", ")}.`
    : providerDimensions.length
      ? `Shape is scoped only to provider-eligible unresolved dimensions: ${providerDimensions.join(", ")}. Resolved and canonical-owner dimensions are out of scope.`
      : "No provider-eligible unresolved craft dimension requires shape.";

  const gateStatus = productDesignBlocked || blocked.length ? "blocked" : unresolved.length ? "needs-resolution" : "ready";
  const nextActions = groupCanonicalActions(relationships);

  if (productDesignBlocked) {
    nextActions.push({
      type: "resolve-product-design",
      dimensions: [],
      owner: "spec-driven-engineering",
      canonicalTargets: [productDesignReadinessPath || "product-design-readiness.json"],
      instruction: "Run Product Design Control through a current passed readiness receipt before invoking craft resolution. Do not use Impeccable or a generic human visual approval to replace this prerequisite."
    });
  }

  if (shapeAllowed) {
    const shapeTargets = unique(relationships.filter((item) => providerDimensions.includes(item.dimension)).flatMap((item) => item.canonicalTargets));
    nextActions.push({
      type: "run-shape",
      dimensions: providerDimensions,
      owner: "impeccable",
      canonicalTargets: shapeTargets,
      instruction: `Run Impeccable shape only for these unresolved dimensions: ${providerDimensions.join(", ")}. Do not revisit resolved relationships or canonical-owner decisions.`
    });
    nextActions.push({
      type: "adopt-and-rederive",
      dimensions: providerDimensions,
      owner: "workflow",
      canonicalTargets: shapeTargets,
      instruction: "After explicit selection when required, adopt only accepted provider decisions into the listed existing canonical artifacts. Then rerun readiness with --after-adoption pointing to this report. Provider artifacts and this report remain non-canonical."
    });
  }

  if (gateStatus === "ready") {
    nextActions.push({
      type: "ready",
      dimensions: [],
      owner: "workflow",
      canonicalTargets: [],
      instruction: "All six derived craft dimensions are resolved. Continue with the existing objective readiness validators; this controller does not approve a human gate."
    });
  }

  const report = {
    $schema: "frontend-readiness.schema.json",
    schemaVersion: "1.0.0",
    generated: true,
    generatedAt: new Date().toISOString(),
    screenId: contract.screenId,
    visualFamilyId: contract.visualFamilyId,
    contractSetSha256: contract.contractSetSha256,
    craftContractPath,
    productDesign: {
      required: productDesignRequired,
      supplied: Boolean(productDesignReceipt),
      receiptPath: productDesignReadinessPath,
      ...productDesignVerification
    },
    afterAdoptionOf: previousReport
      ? {
          reportPath: previousReportPath,
          contractSetSha256: previousReport.contractSetSha256,
          providerDimensions: unique(previousReport.shape?.dimensions || [])
        }
      : null,
    relationships,
    shape: {
      allowed: shapeAllowed,
      required: shapeRequired,
      dimensions: providerDimensions,
      reason: shapeReason
    },
    gate: {
      status: gateStatus,
      blockingDimensions: blocked,
      unresolvedDimensions: unresolved,
      providerDimensions,
      upstreamBlockers: productDesignBlocked ? ["product-design-readiness"] : []
    },
    nextActions
  };

  const schemaPath = resolveFrom(root, policy.readiness.reportSchema);
  if (!schemaPath || !fs.existsSync(schemaPath)) fail(`Frontend readiness schema not found: ${schemaPath || "<missing>"}`);
  const schemaErrors = validateJsonSchema(report, readJson(schemaPath));
  if (schemaErrors.length) fail(`Frontend readiness report is invalid:\n- ${schemaErrors.join("\n- ")}`);

  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

const args = parseArgs(process.argv.slice(2));
const command = args._[0] || "help";
const root = path.resolve(String(args.root || DEFAULT_ROOT));
const policyPath = resolvePolicy(root, args);

if (command === "help") {
  console.log([
    "Frontend stage controller",
    "",
    "readiness --screen-spec <path> [--product-design-readiness <path>] [--product-design-not-applicable \"<reason>\"] [--output <path>] [--craft-output <path>] [--after-adoption <report>] [--report-only] [--json] [--root <root>] [--policy <path>]",
    "representative --screen-spec <path> --design-system <path> --craft-contract <path> --evidence <path> [--critique <path>] [--previous <report>] [--request-polish] [--report-only] [--output <path>] [--json]",
    "",
    "Phase 3 contract: derive and verify the craft contract first; classify relationships as resolved/unresolved/blocked; expose shape only for provider-eligible unresolved dimensions; require accepted provider decisions to be adopted into existing canonical artifacts and then re-derived.",
    "The controller never invokes Impeccable shape, never writes production code, and never promotes its report or provider artifacts to canonical authority."
  ].join("\n"));
  process.exit(0);
}

if (command === "representative") {
  process.exit(runRepresentativeCli(process.argv.slice(3), { root, policyPath }));
}

if (command !== "readiness") fail(`Unknown command '${command}'. Run 'node frontend-control.mjs help'.`);
if (!args["screen-spec"]) fail("readiness requires --screen-spec <path>");
if (!policyPath || !fs.existsSync(policyPath)) fail(`Frontend craft policy not found: ${policyPath || "<missing>"}`);

const policy = readJson(policyPath);
validatePolicyReadiness(policy);
const screenSpecPath = resolveFrom(root, args["screen-spec"]);
if (!screenSpecPath || !fs.existsSync(screenSpecPath)) fail(`Screen specification not found: ${screenSpecPath || "<missing>"}`);
const screenSpec = readJson(screenSpecPath);
const screenId = screenSpec?.screen?.id;
if (!screenId) fail("Screen specification must declare screen.id.");

const baseDir = path.join(os.tmpdir(), "spec-driven-impeccable", "readiness", screenId);
const outputPath = resolveFrom(root, args.output || path.join(baseDir, "frontend-readiness.json"));
const craftContractPath = resolveFrom(root, args["craft-output"] || path.join(baseDir, policy.craftContract?.artifact || "craft-contract.json"));
const previousReportPath = args["after-adoption"] ? resolveFrom(root, args["after-adoption"]) : null;
if (previousReportPath && !fs.existsSync(previousReportPath)) fail(`--after-adoption report not found: ${previousReportPath}`);
const productDesignReadinessPath = args["product-design-readiness"] ? resolveFrom(root, args["product-design-readiness"]) : null;
if (productDesignReadinessPath && !fs.existsSync(productDesignReadinessPath)) fail(`--product-design-readiness receipt not found: ${productDesignReadinessPath}`);
const productDesignNotApplicable = args["product-design-not-applicable"];
if (productDesignNotApplicable !== undefined
  && (productDesignNotApplicable === true || String(productDesignNotApplicable).trim() === "")) {
  fail("--product-design-not-applicable requires an explicit reason: --product-design-not-applicable \"<reason>\"");
}
const productDesignRequired = productDesignNotApplicable === undefined;

const report = buildReport({ root, screenSpecPath, policy, policyPath, outputPath, craftContractPath, previousReportPath, productDesignReadinessPath, productDesignRequired });

if (args.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
else {
  console.log(`Frontend readiness report: ${outputPath}`);
  console.log(`screenId=${report.screenId}`);
  console.log(`visualFamilyId=${report.visualFamilyId}`);
  console.log(`contractSetSha256=${report.contractSetSha256}`);
  console.log(`gate=${report.gate.status}`);
  console.log(`unresolved=${report.gate.unresolvedDimensions.join(",") || "none"}`);
  console.log(`blocked=${report.gate.blockingDimensions.join(",") || "none"}`);
  console.log(`shape=${report.shape.allowed ? report.shape.dimensions.join(",") : "not-allowed"}`);
}

if (report.gate.status !== "ready" && args["report-only"] !== true) process.exit(2);
