#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  IssueCollector,
  asArray,
  parseCliArgs,
  readJsonFile,
  resolveFromCwd,
  setExitCode
} from "./lib/screen-contract-utils.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(SCRIPT_DIRECTORY, "..");
const USAGE = [
  "node audit-theme-operational-evidence.mjs <screen-spec.json> <design-system.json> <craft-contract.json> <visual-composition-evidence.json>",
  "  [--json]",
  "  [--strict-warnings]"
].join("\n");

async function sha256(filePath) {
  return crypto.createHash("sha256").update(await fs.readFile(filePath)).digest("hex");
}

async function validateEvidenceSchema(evidence, collector, location) {
  const schema = JSON.parse(
    await fs.readFile(path.join(SKILL_ROOT, "assets/schemas/visual-composition-evidence.schema.json"), "utf8")
  );
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (!validate(evidence)) {
    for (const error of validate.errors ?? []) {
      collector.error("CRAFT_EVIDENCE_SCHEMA", `${error.instancePath || "/"} ${error.message}`, location);
    }
  }
}

function boxArea(box) {
  return Math.max(0, Number(box?.width || 0)) * Math.max(0, Number(box?.height || 0));
}

function conditionSignals(condition, result = new Set()) {
  if (!condition || typeof condition !== "object") return result;
  if (typeof condition.signal === "string") result.add(condition.signal);
  for (const item of condition.all || []) conditionSignals(item, result);
  for (const item of condition.any || []) conditionSignals(item, result);
  if (condition.not) conditionSignals(condition.not, result);
  return result;
}

function evaluatePredicate(predicate, signals) {
  const hasSignal = signals.has(predicate.signal);
  if (!hasSignal) return { resolved: false, value: false };
  const actual = signals.get(predicate.signal);
  switch (predicate.operator) {
    case "truthy": return { resolved: true, value: Boolean(actual) };
    case "falsy": return { resolved: true, value: !actual };
    case "eq": return { resolved: true, value: actual === predicate.value };
    case "neq": return { resolved: true, value: actual !== predicate.value };
    case "gt": return { resolved: true, value: actual > predicate.value };
    case "gte": return { resolved: true, value: actual >= predicate.value };
    case "lt": return { resolved: true, value: actual < predicate.value };
    case "lte": return { resolved: true, value: actual <= predicate.value };
    case "nonempty": return { resolved: true, value: Array.isArray(actual) ? actual.length > 0 : String(actual ?? "").length > 0 };
    case "empty": return { resolved: true, value: Array.isArray(actual) ? actual.length === 0 : String(actual ?? "").length === 0 };
    default: return { resolved: false, value: false };
  }
}

function evaluateCondition(condition, signals) {
  if (!condition) return { resolved: false, value: false };
  if (condition.signal) return evaluatePredicate(condition, signals);
  if (condition.all) {
    const values = condition.all.map((item) => evaluateCondition(item, signals));
    return { resolved: values.every((item) => item.resolved), value: values.every((item) => item.value) };
  }
  if (condition.any) {
    const values = condition.any.map((item) => evaluateCondition(item, signals));
    return { resolved: values.every((item) => item.resolved), value: values.some((item) => item.value) };
  }
  if (condition.not) {
    const value = evaluateCondition(condition.not, signals);
    return { resolved: value.resolved, value: !value.value };
  }
  return { resolved: false, value: false };
}

function renderedTargets(evidence, targetType, targetId) {
  if (targetType === "region") {
    return asArray(evidence.regions).filter((item) => item.id === targetId && item.rendered === true);
  }
  if (targetType === "component") {
    return [
      ...asArray(evidence.elements).filter((item) => item.componentUsageId === targetId && item.rendered !== false),
      ...asArray(evidence.interactions).filter((item) => item.componentUsageId === targetId && item.rendered === true)
    ];
  }
  if (targetType === "action") {
    return asArray(evidence.interactions).filter((item) => item.actionId === targetId && item.rendered === true);
  }
  if (targetType === "element") {
    return asArray(evidence.elements).filter((item) => item.id === targetId && item.rendered !== false);
  }
  return [];
}

function auditContractIdentity(screenPathRaw, designPathRaw, craftPathRaw, craft, evidence, collector) {
  return Promise.all([
    sha256(resolveFromCwd(screenPathRaw)),
    sha256(resolveFromCwd(designPathRaw)),
    sha256(resolveFromCwd(craftPathRaw))
  ]).then(([screenHash, designHash, craftHash]) => {
    const expected = {
      screenSpecSha256: screenHash,
      designSystemSha256: designHash,
      craftContractSha256: craftHash,
      contractSetSha256: craft.contractSetSha256
    };
    for (const [key, value] of Object.entries(expected)) {
      if (evidence.contractHashes?.[key] !== value) {
        collector.error(
          "CRAFT_EVIDENCE_HASH_DRIFT",
          `visual-composition-evidence.json has stale ${key}.`,
          `$.contractHashes.${key}`
        );
      }
    }
  });
}

function auditThemeAndPerception(design, evidence, collector) {
  const policy = design.visualGrammar?.perceptualPolicy;
  if (!policy) {
    collector.error("CRAFT_EVIDENCE_PERCEPTUAL_POLICY_MISSING", "Design System perceptualPolicy is required for Phase 5 evidence.", "$.visualGrammar.perceptualPolicy");
    return;
  }

  const theme = evidence.theme || {};
  const supportedThemes = new Set(asArray(design.themes?.supported));
  if (!supportedThemes.has(theme.id)) {
    collector.error("CRAFT_EVIDENCE_THEME_UNSUPPORTED", `Evidence theme '${theme.id}' is not declared by the Design System.`, "$.theme.id");
  }
  const expectedSeparation = policy.surfaceHierarchy?.separationModelByTheme?.[theme.id];
  if (expectedSeparation && theme.separationModelObserved !== expectedSeparation) {
    collector.error(
      "CRAFT_EVIDENCE_THEME_CALIBRATION",
      `Theme '${theme.id}' observed separation model '${theme.separationModelObserved}' but Design System requires '${expectedSeparation}'.`,
      "$.theme.separationModelObserved"
    );
  }
  if (policy.themeCalibration?.mode === "per-theme-context-validation" && theme.contextValidated !== true) {
    collector.error("CRAFT_EVIDENCE_THEME_CONTEXT_NOT_VALIDATED", `Theme '${theme.id}' lacks per-theme context validation evidence.`, "$.theme.contextValidated");
  }

  const surfaceLevels = asArray(policy.surfaceHierarchy?.levels);
  const surfaceIndex = new Map(surfaceLevels.map((role, index) => [role, index]));
  const borderRoles = new Set(asArray(policy.borderPolicy?.roles));
  const strongPurposes = new Set(asArray(policy.borderPolicy?.strongAllowedFor));
  const accentRoles = new Set(asArray(policy.accentPolicy?.allowedSemanticRoles));
  const semanticColorRoles = new Set(asArray(policy.semanticColorPolicy?.roles));

  for (const region of asArray(evidence.regions)) {
    if (region.surfaceRole !== "none") {
      if (!surfaceIndex.has(region.surfaceRole)) {
        collector.error("CRAFT_EVIDENCE_SURFACE_ROLE_UNKNOWN", `Region '${region.id}' uses unknown surface role '${region.surfaceRole}'.`, "$.regions");
      } else if (region.surfaceLevel !== surfaceIndex.get(region.surfaceRole)) {
        collector.error(
          "CRAFT_EVIDENCE_SURFACE_LEVEL_DRIFT",
          `Region '${region.id}' reports surfaceLevel=${region.surfaceLevel}, expected ${surfaceIndex.get(region.surfaceRole)} for '${region.surfaceRole}'.`,
          "$.regions"
        );
      }
    }
    if (region.accentRole && !accentRoles.has(region.accentRole)) {
      collector.error("CRAFT_EVIDENCE_ACCENT_ROLE_VIOLATION", `Region '${region.id}' uses unapproved accent role '${region.accentRole}'.`, "$.regions");
    }
    if (region.borderRole) {
      if (!borderRoles.has(region.borderRole)) {
        collector.error("CRAFT_EVIDENCE_BORDER_ROLE_UNKNOWN", `Region '${region.id}' uses unknown border role '${region.borderRole}'.`, "$.regions");
      }
      if (region.borderRole === "strong" && !strongPurposes.has(region.borderPurpose)) {
        collector.error(
          "CRAFT_EVIDENCE_STRONG_BORDER_MISUSE",
          `Region '${region.id}' uses strong border for unapproved purpose '${region.borderPurpose || "<missing>"}'.`,
          "$.regions"
        );
      }
    }
  }

  for (const element of asArray(evidence.elements)) {
    if (element.accentRole && !accentRoles.has(element.accentRole)) {
      collector.error("CRAFT_EVIDENCE_ACCENT_ROLE_VIOLATION", `Element '${element.id}' uses unapproved accent role '${element.accentRole}'.`, "$.elements");
    }
    if (element.semanticColorRole) {
      if (!semanticColorRoles.has(element.semanticColorRole)) {
        collector.error("CRAFT_EVIDENCE_SEMANTIC_COLOR_UNKNOWN", `Element '${element.id}' uses unknown semantic color role '${element.semanticColorRole}'.`, "$.elements");
      }
      if (policy.semanticColorPolicy?.brandAccentMayRepresentStatus === false && element.colorSource === "brand-accent" && !["neutral", "inactive"].includes(element.semanticColorRole)) {
        collector.error(
          "CRAFT_EVIDENCE_BRAND_AS_STATUS",
          `Element '${element.id}' uses brand accent to represent semantic state '${element.semanticColorRole}'.`,
          "$.elements"
        );
      }
    }
  }

  const contrastOrder = asArray(policy.textContrastHierarchy?.order);
  const contrastRank = new Map(contrastOrder.map((role, index) => [role, index]));
  const groups = new Map();
  for (const element of asArray(evidence.elements)) {
    if (!contrastRank.has(element.contrastRole) || typeof element.contrastRatio !== "number") continue;
    const key = `${element.viewport}\u0000${element.regionId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(element);
  }
  for (const elements of groups.values()) {
    for (let left = 0; left < elements.length; left += 1) {
      for (let right = 0; right < elements.length; right += 1) {
        if (left === right) continue;
        const a = elements[left];
        const b = elements[right];
        if (contrastRank.get(a.contrastRole) < contrastRank.get(b.contrastRole) && a.contrastRatio + 0.01 < b.contrastRatio) {
          collector.error(
            "CRAFT_EVIDENCE_TEXT_CONTRAST_ORDER",
            `Element '${a.id}' (${a.contrastRole}, ${a.contrastRatio}) has lower contrast than lower-priority '${b.id}' (${b.contrastRole}, ${b.contrastRatio}).`,
            "$.elements"
          );
        }
      }
    }
  }
}

function auditSpatial(craft, evidence, collector) {
  const spatial = craft.dimensions?.spatialComposition;
  if (!spatial || spatial.status === "unresolved") {
    collector.error("CRAFT_EVIDENCE_SPATIAL_CONTRACT_UNRESOLVED", "spatialComposition must be derived before Phase 5 spatial evidence can pass.", "$.dimensions.spatialComposition");
    return;
  }
  const assignments = new Map(asArray(spatial.regionAssignments).map((item) => [item.regionId, item]));
  const maxDepth = spatial.maxVisualNestingDepth;

  for (const region of asArray(evidence.regions)) {
    const containerArea = boxArea(region.containerBox);
    const contentArea = boxArea(region.contentBox);
    const measured = containerArea === 0 ? 0 : Math.min(1, contentArea / containerArea);
    if (Math.abs(measured - region.contentOccupancy) > 0.02) {
      collector.error(
        "CRAFT_EVIDENCE_CONTENT_OCCUPANCY_DRIFT",
        `Region '${region.id}' reports occupancy ${region.contentOccupancy}, measured ${measured.toFixed(3)} from content/container boxes.`,
        "$.regions"
      );
    }
    if (contentArea > containerArea + 0.01) {
      collector.error("CRAFT_EVIDENCE_CONTENT_OVERFLOW", `Region '${region.id}' content box exceeds its container box area.`, "$.regions");
    }
    if (Number.isInteger(maxDepth) && region.nestingDepth > maxDepth) {
      collector.error(
        "CRAFT_EVIDENCE_NESTING_DEPTH",
        `Region '${region.id}' nesting depth ${region.nestingDepth} exceeds contract max ${maxDepth}.`,
        "$.regions"
      );
    }
    const expected = assignments.get(region.id);
    if (!expected) continue;
    if (expected.heightStrategy !== region.heightStrategyObserved) {
      collector.error(
        "CRAFT_EVIDENCE_HEIGHT_STRATEGY_DRIFT",
        `Region '${region.id}' observed '${region.heightStrategyObserved}' but contract requires '${expected.heightStrategy}'.`,
        "$.regions"
      );
    }
    if (expected.allowNestedSurface === false && region.nestingDepth > 0 && region.surfaceRole !== "none") {
      collector.error(
        "CRAFT_EVIDENCE_NESTED_SURFACE_FORBIDDEN",
        `Region '${region.id}' renders a nested surface although its craft contract forbids nested surfaces.`,
        "$.regions"
      );
    }
  }
}

function auditPresence(craft, evidence, collector) {
  const signals = new Map(asArray(evidence.presenceSignals).map((item) => [item.signal, item.value]));
  const assignments = asArray(craft.dimensions?.interactionClarity?.presenceAssignments);
  for (const assignment of assignments) {
    let expected = null;
    if (assignment.policy === "always") expected = true;
    if (assignment.policy === "never") expected = false;
    if (assignment.condition) {
      const evaluation = evaluateCondition(assignment.condition, signals);
      if (!evaluation.resolved) {
        const missing = [...conditionSignals(assignment.condition)].filter((signal) => !signals.has(signal));
        collector.error(
          "CRAFT_EVIDENCE_PRESENCE_SIGNAL_MISSING",
          `Presence rule for '${assignment.targetType}:${assignment.targetId}' cannot be evaluated; missing signals: ${missing.join(", ") || "unknown"}.`,
          "$.presenceSignals"
        );
        continue;
      }
      expected = evaluation.value;
    }
    if (expected === null) continue;
    const rendered = renderedTargets(evidence, assignment.targetType, assignment.targetId).length > 0;
    if (rendered !== expected) {
      const specialized = conditionSignals(assignment.condition).has("activeFilters.count")
        ? "CRAFT_EVIDENCE_ACTIVE_FILTER_VISIBILITY"
        : "CRAFT_EVIDENCE_CONDITIONAL_PRESENCE";
      collector.error(
        specialized,
        `${assignment.targetType} '${assignment.targetId}' rendered=${rendered} but presence contract evaluates to ${expected}.`,
        "$.presenceSignals"
      );
    }
  }
}

function auditActionsAndAffordance(screen, evidence, collector) {
  const knownActions = new Set(asArray(screen.actions).map((action) => action.id));
  const interactions = asArray(evidence.interactions);
  for (const interaction of interactions) {
    if (interaction.actionId && !knownActions.has(interaction.actionId)) {
      collector.error("CRAFT_EVIDENCE_UNKNOWN_ACTION_TARGET", `Rendered interaction '${interaction.id}' references unknown action '${interaction.actionId}'.`, "$.interactions");
    }
    if (!interaction.rendered) continue;
    if (!interaction.accessibleRole || !interaction.accessibleName) {
      collector.error("CRAFT_EVIDENCE_INTERACTION_SEMANTICS", `Interaction '${interaction.id}' lacks accessible role/name evidence.`, "$.interactions");
    }
    const states = new Set(asArray(interaction.states));
    if (!states.has("focus-visible")) {
      collector.error("CRAFT_EVIDENCE_FOCUS_STATE_MISSING", `Interaction '${interaction.id}' lacks focus-visible evidence.`, "$.interactions");
    }
    if (!["disabled"].every((state) => !states.has(state)) && states.size === 1) continue;
    if (!["hover", "active", "selected", "checked", "expanded"].some((state) => states.has(state)) && !states.has("disabled")) {
      collector.error("CRAFT_EVIDENCE_VISIBLE_INTERACTION_STATE_MISSING", `Interaction '${interaction.id}' lacks a visible interaction-state sample.`, "$.interactions");
    }
  }

  const state = asArray(screen.states).find((item) => item.id === evidence.meta?.stateId);
  if (!state) {
    collector.error("CRAFT_EVIDENCE_SCREEN_STATE_UNKNOWN", `Evidence state '${evidence.meta?.stateId}' is not declared by the screen contract.`, "$.meta.stateId");
    return;
  }
  for (const actionId of asArray(state.enabledActions)) {
    if (!interactions.some((item) => item.actionId === actionId && item.rendered === true)) {
      collector.error("CRAFT_EVIDENCE_ENABLED_ACTION_NOT_RENDERED", `Enabled action '${actionId}' has no rendered interaction target.`, "$.interactions");
    }
  }
  for (const disabled of asArray(state.disabledActions)) {
    const targets = interactions.filter((item) => item.actionId === disabled.actionId && item.rendered === true);
    for (const target of targets) {
      if (!asArray(target.states).includes("disabled")) {
        collector.error("CRAFT_EVIDENCE_DISABLED_ACTION_STATE", `Disabled action '${disabled.actionId}' renders without disabled-state evidence.`, "$.interactions");
      }
    }
  }

  if (state.category === "empty") {
    if (!state.emptyKind) {
      collector.error("CRAFT_EVIDENCE_EMPTY_KIND_MISSING", `Empty state '${state.id}' must declare emptyKind for operational evidence.`, "$.states");
    } else if (state.emptyKind === "actionable" && asArray(state.enabledActions).length === 0) {
      collector.error("CRAFT_EVIDENCE_ACTIONABLE_EMPTY_WITHOUT_ACTION", `Actionable empty state '${state.id}' has no eligible enabled action.`, "$.states");
    } else if (state.emptyKind === "no-results" && asArray(state.recovery).length === 0) {
      collector.error("CRAFT_EVIDENCE_NO_RESULTS_WITHOUT_RECOVERY", `No-results state '${state.id}' has no recovery contract.`, "$.states");
    }
  }
}

function auditWayfinding(screen, evidence, collector) {
  const contract = screen.wayfinding;
  if (!contract) return;
  const rendered = evidence.wayfinding || {};
  if (contract.mode === "not-applicable") {
    if (rendered.rendered === true) {
      collector.error("CRAFT_EVIDENCE_WAYFINDING_UNEXPECTED", "Wayfinding rendered although the screen contract marks it not-applicable.", "$.wayfinding");
    }
    return;
  }
  if (rendered.rendered !== true || rendered.mode !== contract.mode) {
    collector.error("CRAFT_EVIDENCE_WAYFINDING_MISSING", `Screen requires '${contract.mode}' wayfinding but matching rendered evidence is absent.`, "$.wayfinding");
  }
  if ((contract.parentRoute || null) !== (rendered.parentRoute || null)) {
    collector.error("CRAFT_EVIDENCE_WAYFINDING_PARENT_DRIFT", `Rendered parent route '${rendered.parentRoute}' differs from contract '${contract.parentRoute}'.`, "$.wayfinding.parentRoute");
  }
}

function auditSemanticPresentation(screen, craft, evidence, collector) {
  const craftAssignments = asArray(craft.dimensions?.semanticPresentation?.assignments);
  const elementByUsage = new Map();
  for (const element of asArray(evidence.elements)) {
    if (!element.componentUsageId) continue;
    if (!elementByUsage.has(element.componentUsageId)) elementByUsage.set(element.componentUsageId, []);
    elementByUsage.get(element.componentUsageId).push(element);
  }

  for (const assignment of craftAssignments) {
    if (assignment.targetType !== "component") continue;
    const rendered = elementByUsage.get(assignment.targetId) || [];
    if (!rendered.length) {
      collector.error("CRAFT_EVIDENCE_SEMANTIC_COMPONENT_MISSING", `Semantic component usage '${assignment.targetId}' has no rendered evidence.`, "$.elements");
      continue;
    }
    for (const element of rendered) {
      if (element.semanticDataRole !== assignment.semanticRole || element.presentationFamily !== assignment.presentationFamily) {
        collector.error(
          "CRAFT_EVIDENCE_SEMANTIC_COMPONENT_DRIFT",
          `Component usage '${assignment.targetId}' rendered role/family '${element.semanticDataRole}/${element.presentationFamily}' but contract requires '${assignment.semanticRole}/${assignment.presentationFamily}'.`,
          "$.elements"
        );
      }
    }
  }

  const screenAssignments = asArray(screen.semanticPresentation?.assignments);
  for (const assignment of screenAssignments.filter((item) => item.semanticRole === "reusable-reference")) {
    const utility = assignment.referenceUtility;
    if (!utility) {
      collector.error("CRAFT_EVIDENCE_REFERENCE_UTILITY_CONTRACT_MISSING", `Reusable reference '${assignment.componentUsageId}' lacks referenceUtility contract.`, "$.semanticPresentation");
      continue;
    }
    if (utility.mode === "none-with-rationale") continue;
    if (!utility.actionId) {
      collector.error("CRAFT_EVIDENCE_REFERENCE_UTILITY_ACTION_MISSING", `Reusable reference '${assignment.componentUsageId}' utility '${utility.mode}' has no actionId.`, "$.semanticPresentation");
      continue;
    }
    const rendered = asArray(evidence.interactions).some((item) => item.actionId === utility.actionId && item.purpose === "reference-utility" && item.rendered === true);
    if (!rendered) {
      collector.error("CRAFT_EVIDENCE_REFERENCE_UTILITY_NOT_RENDERED", `Reusable reference utility action '${utility.actionId}' is not rendered.`, "$.interactions");
    }
  }
}

function auditDecisionSupport(screen, craft, evidence, collector) {
  const contract = screen.decisionSupport;
  if (!contract) return;
  if (contract.mode === "not-applicable") return;
  const derived = craft.dimensions?.decisionSupport;
  if (derived?.status !== "resolved") {
    collector.error("CRAFT_EVIDENCE_DECISION_SUPPORT_UNRESOLVED", "Screen requires decision support but the derived craft contract is not resolved.", "$.dimensions.decisionSupport");
    return;
  }
  const evidenceSignals = new Map(asArray(evidence.decisionSignals).map((item) => [item.id, item]));
  for (const signal of asArray(contract.signals)) {
    const observed = evidenceSignals.get(signal.id);
    if (!observed || observed.rendered !== true) {
      collector.error("CRAFT_EVIDENCE_DECISION_SIGNAL_MISSING", `Required decision signal '${signal.id}' is not rendered.`, "$.decisionSignals");
      continue;
    }
    if (observed.targetType !== signal.renderTargetType || observed.targetId !== signal.renderTargetId) {
      collector.error(
        "CRAFT_EVIDENCE_DECISION_SIGNAL_TARGET_DRIFT",
        `Decision signal '${signal.id}' rendered at '${observed.targetType}:${observed.targetId}' instead of '${signal.renderTargetType}:${signal.renderTargetId}'.`,
        "$.decisionSignals"
      );
    }
  }
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  if (options.positional.length < 4) throw new Error(`Missing input files.\nUsage: ${USAGE}`);

  const collector = new IssueCollector();
  const [screenPathRaw, designPathRaw, craftPathRaw, evidencePathRaw] = options.positional;
  const screen = await readJsonFile(screenPathRaw);
  const design = await readJsonFile(designPathRaw);
  const craft = await readJsonFile(craftPathRaw);
  const evidence = await readJsonFile(evidencePathRaw);

  await validateEvidenceSchema(evidence.value, collector, evidence.path);
  await auditContractIdentity(screenPathRaw, designPathRaw, craftPathRaw, craft.value, evidence.value, collector);
  auditThemeAndPerception(design.value, evidence.value, collector);
  auditSpatial(craft.value, evidence.value, collector);
  auditPresence(craft.value, evidence.value, collector);
  auditActionsAndAffordance(screen.value, evidence.value, collector);
  auditWayfinding(screen.value, evidence.value, collector);
  auditSemanticPresentation(screen.value, craft.value, evidence.value, collector);
  auditDecisionSupport(screen.value, craft.value, evidence.value, collector);

  collector.print("Frontend Theme + Operational Craft Evidence Audit", { json: options.json });
  setExitCode(collector, { strictWarnings: options.strictWarnings });
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
