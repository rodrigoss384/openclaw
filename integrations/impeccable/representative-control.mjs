#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateJsonSchema, validateSchemaSupport } from "../../skills/spec-driven-engineering/scripts/lib/json-schema.mjs";
import { canonicalDigest, verifyCapabilityReceipt } from "../frontend/ui-engineering-control.mjs";
import { normalizeFindingBatch } from "./finding-normalizer.mjs";
import { routeFinding } from "./finding-router.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "../..");
const PHASES = new Set(["critique-required", "repair-required", "polish-required", "design-readiness-return", "human-gate-ready", "exhausted"]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function hashFile(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      args._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) args[key] = true;
    else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

function resolveFrom(root, value) {
  if (!value) return null;
  return path.isAbsolute(String(value)) ? path.resolve(String(value)) : path.resolve(root, String(value));
}

function loadPolicy(root, policyPath) {
  const policy = readJson(policyPath);
  if (!policy.repairLoop) throw new Error("frontend-craft-policy.json is missing repairLoop.");
  if (policy.repairLoop.maxCraftRounds !== policy.polish.maxVisualInspectionRounds) {
    throw new Error("repairLoop.maxCraftRounds must match polish.maxVisualInspectionRounds.");
  }
  if (policy.repairLoop.maxPolishRounds !== policy.polish.maxPolishRounds) {
    throw new Error("repairLoop.maxPolishRounds must match polish.maxPolishRounds.");
  }
  const schemaPath = resolveFrom(root, policy.repairLoop.reportSchema);
  const schema = readJson(schemaPath);
  const supportErrors = validateSchemaSupport(schema);
  if (supportErrors.length) throw new Error(`Representative loop schema uses unsupported keywords:\n- ${supportErrors.join("\n- ")}`);
  return { policy, schema, schemaPath };
}

function runObjectiveAudit({ root, screenSpecPath, designSystemPath, craftContractPath, evidencePath, uiQualityGatePath = null, uiReceiptPaths = [] }) {
  if (uiQualityGatePath) {
    const gate = readJson(uiQualityGatePath);
    const problems = [];
    if (gate.artifactKind !== "ui-quality-gate" || gate.schemaVersion !== "1.0.0") problems.push("ui-quality-gate artifact identity/version is invalid");
    if (gate.semanticDigest !== canonicalDigest(gate)) problems.push("ui-quality-gate semantic digest is invalid");
    if (gate.eligible !== true || (gate.blockingFindingIds ?? []).length > 0) problems.push("ui-quality-gate is not objectively eligible");
    if (uiReceiptPaths.length === 0) problems.push("ui-quality-gate has no supplied capability receipts");
    const receipts = uiReceiptPaths.map((receiptPath) => ({ path: receiptPath, value: readJson(receiptPath) }));
    for (const receipt of receipts) {
      const verification = verifyCapabilityReceipt(receipt.value, { baseDirectory: path.dirname(receipt.path), requireSuccess: true });
      if (!verification.valid) problems.push(...verification.errors.map((error) => `${path.basename(receipt.path)}: ${error}`));
      if (receipt.value.subject?.commit !== gate.subject?.commit) problems.push(`${path.basename(receipt.path)}: commit differs from gate`);
      if (gate.policyDigest && receipt.value.policyDigest && receipt.value.policyDigest !== gate.policyDigest) problems.push(`${path.basename(receipt.path)}: policy differs from gate`);
    }
    const suppliedDigests = new Set(receipts.map((receipt) => receipt.value.semanticDigest));
    for (const digest of gate.receiptDigests ?? []) {
      if (!suppliedDigests.has(digest)) problems.push(`gate receipt digest is not supplied: ${digest}`);
    }
    if (problems.length > 0) {
      const error = new Error(`Deterministic UI quality gate failed before Impeccable critique.\n- ${problems.join("\n- ")}`);
      error.exitCode = 2;
      throw error;
    }
  }
  const auditor = path.join(root, "skills/frontend-product-builder/scripts/audit-theme-operational-evidence.mjs");
  const result = spawnSync(process.execPath, [auditor, screenSpecPath, designSystemPath, craftContractPath, evidencePath, "--json"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    const error = new Error(`Phase 5 objective audit failed before critique. Repair the objective evidence violations and rerun the representative controller.\n${output}`);
    error.exitCode = 2;
    throw error;
  }
  return {
    status: "passed",
    command: uiQualityGatePath
      ? `ui-quality-gate verify -> node ${path.relative(root, auditor)} <screen-spec> <design-system> <craft-contract> <evidence>`
      : `node ${path.relative(root, auditor)} <screen-spec> <design-system> <craft-contract> <evidence>`
  };
}

function validateFreshness({ screenSpecPath, designSystemPath, craftContractPath, evidence }) {
  const screenSpecHash = hashFile(screenSpecPath);
  const designSystemHash = hashFile(designSystemPath);
  const craftHash = hashFile(craftContractPath);
  const problems = [];
  if (evidence.contractHashes?.screenSpecSha256 !== screenSpecHash) problems.push("screenSpecSha256 is stale");
  if (evidence.contractHashes?.designSystemSha256 !== designSystemHash) problems.push("designSystemSha256 is stale");
  if (evidence.contractHashes?.craftContractSha256 !== craftHash) problems.push("craftContractSha256 is stale");
  const craft = readJson(craftContractPath);
  if (evidence.contractHashes?.contractSetSha256 !== craft.contractSetSha256) problems.push("contractSetSha256 is stale");
  if (evidence.meta?.screenId !== craft.screenId) problems.push("evidence screenId does not match craft contract");
  if (problems.length) throw new Error(`Representative evidence is not fresh:\n- ${problems.join("\n- ")}`);
  return { craft, craftHash, screenSpecHash, designSystemHash };
}

function previousCounters(previousReport, evidenceSha256) {
  if (!previousReport) return { craftRoundsUsed: 0, polishRoundsUsed: 0 };
  if (!PHASES.has(previousReport.phase)) throw new Error(`Previous representative report has unknown phase '${previousReport.phase}'.`);
  let craftRoundsUsed = Number(previousReport.counters?.craftRoundsUsed || 0);
  let polishRoundsUsed = Number(previousReport.counters?.polishRoundsUsed || 0);
  if (previousReport.phase === "repair-required") craftRoundsUsed += 1;
  if (previousReport.phase === "polish-required") polishRoundsUsed += 1;
  if ((previousReport.phase === "repair-required" || previousReport.phase === "polish-required") && previousReport.evidenceSha256 === evidenceSha256) {
    throw new Error("A repair/polish transition requires rerendered evidence. The evidence SHA-256 is unchanged from the previous report.");
  }
  return { craftRoundsUsed, polishRoundsUsed };
}

function routeSummary(routeReport) {
  return {
    findingId: routeReport.finding.id,
    class: routeReport.finding.class,
    defectKind: routeReport.finding.defectKind,
    owner: routeReport.route.owner,
    affectedContracts: routeReport.route.affectedContracts,
    repairStrategy: routeReport.route.repairStrategy,
    providerCommand: routeReport.route.providerCommand,
    returnStage: routeReport.route.returnStage,
    revalidationSet: routeReport.route.revalidationSet
  };
}

export function buildRepresentativeTransition({
  root = DEFAULT_ROOT,
  policy,
  reportSchema,
  screenId,
  stateId,
  evidenceSha256,
  craftContractSha256,
  contractSetSha256,
  previousReport = null,
  critiqueEnvelope = null,
  polishRequested = false,
  objectiveAudit = { status: "passed", command: "objective-audit" }
}) {
  const counters = previousCounters(previousReport, evidenceSha256);
  if (counters.craftRoundsUsed > policy.repairLoop.maxCraftRounds) throw new Error("Previous report exceeds maxCraftRounds.");
  if (counters.polishRoundsUsed > policy.repairLoop.maxPolishRounds) throw new Error("Previous report exceeds maxPolishRounds.");

  let normalizedBatch = null;
  let routes = [];
  let phase = "critique-required";
  let humanGate = { eligible: false, reason: "Impeccable critique is required after objective evidence passes." };
  let nextActions = [{ type: "run-critique", stage: "REPORT", command: "critique", findingIds: [], requiresHumanApproval: false }];

  if (critiqueEnvelope) {
    if (critiqueEnvelope.screenId !== screenId) throw new Error(`Critique screen '${critiqueEnvelope.screenId}' does not match '${screenId}'.`);
    normalizedBatch = normalizeFindingBatch({ root, policy, envelope: critiqueEnvelope });
    const materialFindings = normalizedBatch.findings.filter((finding) => finding.material);
    routes = materialFindings.map((finding) => routeSummary(routeFinding({ root, policy, finding })));
    const contractRoutes = routes.filter((route) => route.defectKind === "contract");
    const implementationRoutes = routes.filter((route) => route.defectKind === "implementation");

    if (contractRoutes.length) {
      phase = "design-readiness-return";
      humanGate = { eligible: false, reason: "At least one material finding is a canonical contract defect; automatic implementation repair is suppressed." };
      nextActions = [{
        type: "return-design-readiness",
        stage: "DESIGN_READINESS",
        command: null,
        findingIds: contractRoutes.map((route) => route.findingId),
        requiresHumanApproval: false,
        affectedContracts: unique(contractRoutes.flatMap((route) => route.affectedContracts)),
        revalidationSet: unique(contractRoutes.flatMap((route) => route.revalidationSet))
      }];
    } else if (implementationRoutes.length) {
      if (counters.craftRoundsUsed >= policy.repairLoop.maxCraftRounds) {
        phase = "exhausted";
        humanGate = { eligible: false, reason: `Material implementation findings remain after ${policy.repairLoop.maxCraftRounds} craft rounds.` };
        nextActions = [{
          type: "stop-escalate",
          stage: "REPORT",
          command: null,
          findingIds: implementationRoutes.map((route) => route.findingId),
          requiresHumanApproval: true
        }];
      } else {
        phase = "repair-required";
        humanGate = { eligible: false, reason: "Material implementation findings require another bounded repair round." };
        const providerActions = implementationRoutes
          .filter((route) => route.providerCommand?.name)
          .map((route) => ({
            type: "provider-repair",
            stage: "PATCH",
            command: route.providerCommand.name,
            findingIds: [route.findingId],
            requiresHumanApproval: Boolean(route.providerCommand.requiresExplicitApproval)
          }));
        nextActions = [
          {
            type: "targeted-implementation-repair",
            stage: "PATCH",
            command: null,
            findingIds: implementationRoutes.map((route) => route.findingId),
            requiresHumanApproval: false,
            revalidationSet: unique(implementationRoutes.flatMap((route) => route.revalidationSet))
          },
          ...providerActions,
          { type: "rerender", stage: "BROWSER", command: null, findingIds: implementationRoutes.map((route) => route.findingId), requiresHumanApproval: false },
          { type: "reaudit", stage: "COMPOSITION AUDIT", command: "phase5-objective-audit", findingIds: implementationRoutes.map((route) => route.findingId), requiresHumanApproval: false },
          { type: "recritique", stage: "REPORT", command: "critique", findingIds: implementationRoutes.map((route) => route.findingId), requiresHumanApproval: false }
        ];
      }
    } else if (polishRequested && counters.polishRoundsUsed < policy.repairLoop.maxPolishRounds) {
      phase = "polish-required";
      humanGate = { eligible: false, reason: "No material finding remains, but one explicitly requested bounded polish round is available." };
      nextActions = [
        { type: "provider-polish", stage: "PATCH", command: "polish", findingIds: [], requiresHumanApproval: false },
        { type: "rerender", stage: "BROWSER", command: null, findingIds: [], requiresHumanApproval: false },
        { type: "reaudit", stage: "COMPOSITION AUDIT", command: "phase5-objective-audit", findingIds: [], requiresHumanApproval: false },
        { type: "recritique", stage: "REPORT", command: "critique", findingIds: [], requiresHumanApproval: false }
      ];
    } else {
      phase = "human-gate-ready";
      humanGate = { eligible: true, reason: "No material finding remains. Automated craft convergence is complete; only the human representative decision may approve the gate." };
      nextActions = [{ type: "request-human-gate", stage: "REPORT", command: null, findingIds: [], requiresHumanApproval: true }];
    }
  }

  const report = {
    $schema: "frontend-representative-loop.schema.json",
    schemaVersion: "1.0.0",
    generated: true,
    generatedAt: new Date().toISOString(),
    screenId,
    stateId,
    evidenceSha256,
    craftContractSha256,
    contractSetSha256,
    previous: previousReport ? {
      phase: previousReport.phase,
      evidenceSha256: previousReport.evidenceSha256,
      craftRoundsUsed: Number(previousReport.counters?.craftRoundsUsed || 0),
      polishRoundsUsed: Number(previousReport.counters?.polishRoundsUsed || 0)
    } : null,
    counters: {
      craftRoundsUsed: counters.craftRoundsUsed,
      maxCraftRounds: policy.repairLoop.maxCraftRounds,
      polishRoundsUsed: counters.polishRoundsUsed,
      maxPolishRounds: policy.repairLoop.maxPolishRounds
    },
    objectiveAudit,
    critique: {
      status: critiqueEnvelope ? "normalized" : "missing",
      sourceArtifact: critiqueEnvelope?.sourceArtifact || null,
      totalFindings: normalizedBatch?.findings.length || 0,
      materialFindings: normalizedBatch?.findings.filter((finding) => finding.material).length || 0
    },
    normalizedFindings: normalizedBatch?.findings || [],
    routes,
    phase,
    humanGate,
    nextActions
  };
  const schemaErrors = validateJsonSchema(report, reportSchema);
  if (schemaErrors.length) throw new Error(`Representative loop report is invalid:\n- ${schemaErrors.join("\n- ")}`);
  return report;
}

export function runRepresentativeCli(argv, inherited = {}) {
  try {
    const args = parseArgs(argv);
    const root = path.resolve(String(args.root || inherited.root || DEFAULT_ROOT));
    const policyPath = resolveFrom(root, args.policy || inherited.policyPath || "prompts/spec-driven/frontend-craft-policy.json");
    const { policy, schema } = loadPolicy(root, policyPath);
    const workflowManifest = readJson(path.join(root, "prompts/spec-driven/manifest.json"));
    const uiControlPrimary = workflowManifest.frontendUiControlPolicy?.rollout === "primary";
    for (const key of ["screen-spec", "design-system", "craft-contract", "evidence"]) {
      if (!args[key]) throw new Error(`representative requires --${key} <path>`);
    }
    const screenSpecPath = resolveFrom(root, args["screen-spec"]);
    const designSystemPath = resolveFrom(root, args["design-system"]);
    const craftContractPath = resolveFrom(root, args["craft-contract"]);
    const evidencePath = resolveFrom(root, args.evidence);
    const uiQualityGatePath = args["ui-quality-gate"] ? resolveFrom(root, args["ui-quality-gate"]) : null;
    const uiReceiptPaths = String(args["ui-receipts"] ?? "")
      .split(",")
      .filter(Boolean)
      .map((value) => resolveFrom(root, value));
    if (uiControlPrimary && !uiQualityGatePath) throw new Error("representative requires --ui-quality-gate <path> while frontendUiControlPolicy is primary");
    if (uiControlPrimary && uiReceiptPaths.length === 0) throw new Error("representative requires --ui-receipts <comma-separated paths> while frontendUiControlPolicy is primary");
    for (const [label, filePath] of [["screen spec", screenSpecPath], ["design system", designSystemPath], ["craft contract", craftContractPath], ["evidence", evidencePath]]) {
      if (!fs.existsSync(filePath)) throw new Error(`Representative ${label} not found: ${filePath}`);
    }
    const screen = readJson(screenSpecPath);
    const evidence = readJson(evidencePath);
    const freshness = validateFreshness({ screenSpecPath, designSystemPath, craftContractPath, evidence });
    if (uiQualityGatePath && !fs.existsSync(uiQualityGatePath)) throw new Error(`Representative UI quality gate not found: ${uiQualityGatePath}`);
    for (const receiptPath of uiReceiptPaths) if (!fs.existsSync(receiptPath)) throw new Error(`Representative UI capability receipt not found: ${receiptPath}`);
    const objectiveAudit = runObjectiveAudit({ root, screenSpecPath, designSystemPath, craftContractPath, evidencePath, uiQualityGatePath, uiReceiptPaths });
    const previousReport = args.previous ? readJson(resolveFrom(root, args.previous)) : null;
    if (previousReport && previousReport.screenId !== freshness.craft.screenId) throw new Error("Previous representative report belongs to another screen.");
    const critiqueEnvelope = args.critique ? readJson(resolveFrom(root, args.critique)) : null;
    const report = buildRepresentativeTransition({
      root,
      policy,
      reportSchema: schema,
      screenId: freshness.craft.screenId || screen.screen?.id,
      stateId: evidence.meta?.stateId || "unknown",
      evidenceSha256: hashFile(evidencePath),
      craftContractSha256: freshness.craftHash,
      contractSetSha256: freshness.craft.contractSetSha256,
      previousReport,
      critiqueEnvelope,
      polishRequested: Boolean(args["request-polish"]),
      objectiveAudit
    });
    const outputPath = resolveFrom(root, args.output || path.join(".specs", "evidence", freshness.craft.screenId, "frontend-representative-loop.json"));
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
    if (args.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else {
      console.log(`Frontend representative loop report: ${outputPath}`);
      console.log(`phase=${report.phase}`);
      console.log(`craftRounds=${report.counters.craftRoundsUsed}/${report.counters.maxCraftRounds}`);
      console.log(`polishRounds=${report.counters.polishRoundsUsed}/${report.counters.maxPolishRounds}`);
      console.log(`materialFindings=${report.critique.materialFindings}`);
      console.log(`humanGate=${report.humanGate.eligible ? "eligible" : "blocked"}`);
    }
    if (!report.humanGate.eligible && args["report-only"] !== true) return 2;
    return 0;
  } catch (error) {
    console.error(error.message);
    return Number(error.exitCode || 1);
  }
}

function isMainModule(realPath) {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync(path.resolve(process.argv[1])) === realPath;
  } catch {
    return false;
  }
}

if (isMainModule(fileURLToPath(import.meta.url))) {
  process.exitCode = runRepresentativeCli(process.argv.slice(2));
}
