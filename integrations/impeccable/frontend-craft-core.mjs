#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateJsonSchema, validateSchemaSupport } from "../../skills/spec-driven-engineering/scripts/lib/json-schema.mjs";
import { routeFindingToFile } from "./finding-router.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "../..");
const CRAFT_DIMENSIONS = [
  "spatialComposition",
  "perceptualHierarchy",
  "semanticPresentation",
  "interactionClarity",
  "decisionSupport",
  "typographyCoherence"
];
const PERCEPTUAL_POLICY_KEYS = [
  "surfaceHierarchy",
  "accentPolicy",
  "semanticColorPolicy",
  "textContrastHierarchy",
  "borderPolicy",
  "themeCalibration",
  "geometryAcrossThemes",
  "presentationRoles"
];
const PRESENCE_VALUE_OPERATORS = new Set(["eq", "neq", "gt", "gte", "lt", "lte"]);
const PRESENCE_VALUELESS_OPERATORS = new Set(["truthy", "falsy", "nonempty", "empty"]);

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
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(`Cannot read JSON ${filePath}: ${error.message}`);
  }
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hashFile(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function relativePosix(root, filePath) {
  const relative = path.relative(root, filePath);
  if (!relative.startsWith("..") && !path.isAbsolute(relative)) return relative.split(path.sep).join("/");
  return filePath.split(path.sep).join("/");
}

function safeSlug(value) {
  return String(value || "feature")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "feature";
}

function resolvePolicy(root, args) {
  return path.resolve(String(args.policy || path.join(root, "prompts/spec-driven/frontend-craft-policy.json")));
}

function resolveArtifactReference(root, reference) {
  if (!reference || typeof reference !== "string") return null;
  const value = reference.trim();
  if (!value) return null;

  const installedPrefix = "~/.agents/skills/frontend-product-builder/";
  if (value.startsWith(installedPrefix)) {
    const suffix = value.slice(installedPrefix.length);
    const installed = path.join(os.homedir(), ".agents/skills/frontend-product-builder", suffix);
    if (fs.existsSync(installed)) return installed;
    const repositoryCopy = path.join(root, "skills/frontend-product-builder", suffix);
    if (fs.existsSync(repositoryCopy)) return repositoryCopy;
    return installed;
  }

  if (value.startsWith("~/")) return path.join(os.homedir(), value.slice(2));
  if (path.isAbsolute(value)) return value;
  return path.resolve(root, value);
}

function validatePolicySemantics(policy) {
  const errors = [];
  if (policy?.provider?.id !== "impeccable") errors.push("provider.id must be 'impeccable'");
  if (!/^\d+\.\d+\.\d+$/.test(policy?.provider?.version || "")) errors.push("provider.version must be an exact semver");
  if (policy?.provider?.authority !== "bounded-advisory") errors.push("provider.authority must be bounded-advisory");
  if (policy?.contextBridge?.direction !== "canonical-to-provider-only") errors.push("contextBridge.direction must be canonical-to-provider-only");
  if (policy?.contextBridge?.providerArtifactsAreCanonical !== false) errors.push("provider artifacts must not be canonical");
  if (policy?.craftContract?.mode !== "derived") errors.push("craftContract.mode must be derived");
  if (policy?.craftContract?.canonical !== false) errors.push("derived craft contract must not become canonical project truth");
  if (policy?.craftContract?.unresolvedPolicy !== "explicit-never-infer-from-prompt") errors.push("unresolved craft decisions must never be silently inferred from prompt prose");
  if (policy?.representativeReview?.mayApproveGate !== false) errors.push("Impeccable may not approve representative gates");
  if (policy?.detector?.required !== true) errors.push("detector capability must be required");
  if (policy?.polish?.maxPolishRounds > 1) errors.push("maxPolishRounds must be <= 1");
  if (policy?.repairLoop?.classification !== "explicit-taxonomy-no-free-text-inference") errors.push("repairLoop classification must never infer taxonomy from critique prose");
if (JSON.stringify(policy?.repairLoop?.sequence || []) !== JSON.stringify(["evidence","objective-audit","critique","normalize","route","repair","rerender","reaudit","recritique"])) errors.push("repairLoop sequence must remain evidence -> objective-audit -> critique -> normalize -> route -> repair -> rerender -> reaudit -> recritique");
if (policy?.repairLoop?.maxCraftRounds !== policy?.polish?.maxVisualInspectionRounds) errors.push("repairLoop.maxCraftRounds must match maxVisualInspectionRounds");
if (policy?.repairLoop?.maxPolishRounds !== policy?.polish?.maxPolishRounds) errors.push("repairLoop.maxPolishRounds must match polish.maxPolishRounds");
if (policy?.repairLoop?.noMaterialFindingTransition !== "human-gate") errors.push("no material finding must transition to human-gate");
if (policy?.repairLoop?.contractFindingTransition !== "design-readiness") errors.push("contract findings must return to design-readiness");
  if (!Object.keys(policy?.visitorModes || {}).length) errors.push("visitorModes must contain at least one mapping");

  const nonCanonical = new Set(policy?.commands?.notCanonicalInManagedWorkflow || []);
  for (const command of ["init", "document"]) {
    if (!nonCanonical.has(command)) errors.push(`${command} must be non-canonical in managed workflow`);
  }
  const managed = new Set(policy?.commands?.managed || []);
  for (const forbidden of policy?.commands?.notCanonicalInManagedWorkflow || []) {
    if (managed.has(forbidden)) errors.push(`${forbidden} cannot be both managed and non-canonical`);
  }
  for (const restricted of policy?.commands?.strongExplicitApproval || []) {
    if (managed.has(restricted)) errors.push(`${restricted} cannot be both managed and strong-explicit-approval`);
  }
  return errors;
}

function loadAndValidatePolicy(policyPath) {
  const policy = readJson(policyPath);
  if (!policy.$schema) fail(`Frontend craft policy is missing $schema: ${policyPath}`);
  const schemaPath = path.resolve(path.dirname(policyPath), String(policy.$schema));
  if (!fs.existsSync(schemaPath)) fail(`Frontend craft policy schema not found: ${schemaPath}`);
  const schema = readJson(schemaPath);
  const supportErrors = validateSchemaSupport(schema);
  if (supportErrors.length) fail(`Frontend craft policy schema uses unsupported keywords:\n- ${supportErrors.join("\n- ")}`);
  const errors = [...validateJsonSchema(policy, schema), ...validatePolicySemantics(policy)];
  if (errors.length) fail(`Invalid frontend craft policy:\n- ${errors.join("\n- ")}`);
  return { policy, schemaPath };
}

function loadCraftSchema(root, policy) {
  const schemaPath = path.resolve(root, policy.craftContract.schema);
  if (!fs.existsSync(schemaPath)) fail(`Craft contract schema not found: ${schemaPath}`);
  const schema = readJson(schemaPath);
  const supportErrors = validateSchemaSupport(schema);
  if (supportErrors.length) fail(`Craft contract schema uses unsupported keywords:\n- ${supportErrors.join("\n- ")}`);
  return { schema, schemaPath };
}

function collectSources(root, featureDir, screenId) {
  const candidates = [
    ["product", path.join(featureDir, "00-intent.md")],
    ["product", path.join(featureDir, "01-spec.md")],
    ["product", path.join(root, "docs/frontend/product-context.md")],
    ["design", path.join(root, "docs/frontend/design-direction.md")],
    ["design", path.join(root, "docs/frontend/design-system/design-system.json")],
    ["design", path.join(root, "docs/frontend/styling-authority.json")]
  ];
  if (screenId) {
    candidates.push(
      ["design", path.join(root, "docs/frontend/screens", screenId, "screen-spec.json")],
      ["design", path.join(root, "docs/frontend/screens", screenId, "composition-proof.json")]
    );
  }
  return candidates
    .filter(([, filePath]) => fs.existsSync(filePath) && fs.statSync(filePath).isFile())
    .map(([kind, filePath]) => ({
      kind,
      path: filePath,
      relativePath: relativePosix(root, filePath),
      sha256: hashFile(filePath),
      content: fs.readFileSync(filePath, "utf8")
    }));
}

function renderProjection(title, authorityWarning, sources) {
  const sections = sources.map((source) => {
    const language = path.extname(source.path) === ".json" ? "json" : "markdown";
    return [
      `## Source: ${source.relativePath}`,
      "",
      `SHA-256: \`${source.sha256}\``,
      "",
      `\`\`\`${language}`,
      source.content.trimEnd(),
      "```"
    ].join("\n");
  });
  return [
    `# ${title}`,
    "",
    `> ${authorityWarning}`,
    "> This file is generated from canonical Spec-Driven artifacts. Do not edit it as project truth and do not copy provider-only decisions back without updating the canonical contracts through the normal workflow.",
    "",
    ...sections,
    ""
  ].join("\n");
}

function prepareContext({ root, featureDir, screenId, outputDir, policyPath }) {
  const { policy } = loadAndValidatePolicy(policyPath);
  if (!fs.existsSync(featureDir)) fail(`Feature directory not found: ${featureDir}`);
  const sources = collectSources(root, featureDir, screenId);
  const productSources = sources.filter((source) => source.kind === "product");
  const designSources = sources.filter((source) => source.kind === "design");
  if (!productSources.length) fail("No canonical product source found for Impeccable context projection.");

  fs.mkdirSync(outputDir, { recursive: true });
  const productPath = path.join(outputDir, policy.contextBridge.productProjection);
  const designPath = path.join(outputDir, policy.contextBridge.designProjection);
  const provenancePath = path.join(outputDir, policy.contextBridge.provenanceArtifact);
  fs.writeFileSync(productPath, renderProjection(
    "Impeccable Product Context Projection",
    "NON-AUTHORITATIVE PROVIDER PROJECTION — canonical product requirements remain in the numbered feature package.",
    productSources
  ));
  fs.writeFileSync(designPath, renderProjection(
    "Impeccable Design Context Projection",
    "NON-AUTHORITATIVE PROVIDER PROJECTION — canonical visual/design authority remains in docs/frontend and approved screen contracts.",
    designSources
  ));

  const provenance = {
    schemaVersion: 1,
    provider: policy.provider.id,
    providerVersion: policy.provider.version,
    rolloutPhase: policy.rollout.phase,
    contextDirectory: outputDir,
    canonicalRoot: root,
    featureDirectory: relativePosix(root, featureDir),
    screenId: screenId || null,
    generatedAt: new Date().toISOString(),
    sourceFiles: sources.map(({ kind, relativePath, sha256: digest }) => ({ kind, path: relativePath, sha256: digest })),
    projections: {
      product: { file: path.basename(productPath), sha256: hashFile(productPath) },
      design: { file: path.basename(designPath), sha256: hashFile(designPath) }
    },
    runs: []
  };
  fs.writeFileSync(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`);
  return { policy, productPath, designPath, provenancePath };
}

function sourceEntry(root, id, role, filePath, required) {
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    if (required) fail(`Required craft source '${role}' not found: ${filePath || "<missing>"}`);
    return null;
  }
  return { id, role, path: relativePosix(root, filePath), sha256: hashFile(filePath), required };
}

function collectComponentCatalogSources(root, screenSpec) {
  const resolved = new Map();
  for (const usage of screenSpec?.componentMap || []) {
    if (!usage?.catalogSource) continue;
    const catalogPath = resolveArtifactReference(root, usage.catalogSource);
    if (!catalogPath || !fs.existsSync(catalogPath) || !fs.statSync(catalogPath).isFile()) {
      fail(`Component catalog source cannot be resolved for '${usage.id || usage.component || "<unknown>"}': ${usage.catalogSource}`);
    }
    resolved.set(relativePosix(root, catalogPath), catalogPath);
  }
  return [...resolved.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, catalogPath], index) => sourceEntry(root, `component-catalog-${index + 1}`, "component-catalog", catalogPath, true));
}

function contractSetSha256(sources) {
  const canonical = [...sources]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((source) => [source.id, source.role, source.path, source.sha256, source.required ? "required" : "optional"].join("\u0000"))
    .join("\n");
  return sha256(canonical);
}

function unresolvedDimension(extra = {}) {
  return { status: "unresolved", resolvedBy: "unresolved", sourceRefs: [], ...extra };
}

function validatePerceptualPolicyShape(designSystem) {
  const policy = designSystem?.visualGrammar?.perceptualPolicy;
  if (policy == null) return { present: false, errors: [] };
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) {
    return { present: true, errors: ["design-system visualGrammar.perceptualPolicy must be an object"] };
  }
  const errors = [];
  for (const key of PERCEPTUAL_POLICY_KEYS) {
    if (!Object.hasOwn(policy, key)) errors.push(`design-system perceptualPolicy is missing '${key}'`);
  }
  if (policy.geometryAcrossThemes?.defaultBehavior && !["stable", "explicit-override"].includes(policy.geometryAcrossThemes.defaultBehavior)) {
    errors.push("design-system perceptualPolicy.geometryAcrossThemes.defaultBehavior must be stable or explicit-override");
  }
  return { present: true, errors };
}

function recipeRegions(recipe) {
  return new Map((recipe?.regions || []).map((region) => [region?.id, region]));
}

function selectedRegionIds(screenSpec) {
  return (screenSpec?.recipe?.regions || []).map((item) => item?.screenRegionId).filter(Boolean);
}

function contrastRoleFromColorToken(colorToken) {
  const role = String(colorToken || "").split(".").at(-1);
  return ["primary", "secondary", "muted", "disabled"].includes(role) ? role : null;
}

function projectTypographyCoherence(screenSpec, designSystem) {
  const declared = screenSpec?.visualHierarchy?.textRoleAssignments || [];
  const styles = designSystem?.visualGrammar?.semanticTextStyles || {};
  const hasDesignSystem = Boolean(designSystem?.visualGrammar?.semanticTextStyles);
  const assignments = declared.flatMap((assignment) => {
    const style = styles?.[assignment?.textRole];
    const contrastRole = contrastRoleFromColorToken(style?.colorToken);
    if (!assignment?.elementId || !assignment?.textRole || !style?.familyToken || !contrastRole) return [];
    return [{
      elementId: assignment.elementId,
      familyRole: String(style.familyToken).includes("mono") ? "identifier" : "interface",
      textRole: assignment.textRole,
      contrastRole
    }];
  });
  const complete = declared.length > 0 && assignments.length === declared.length;
  if (!declared.length) return { ...unresolvedDimension(), assignments: [] };
  return {
    status: complete ? "resolved" : "partial",
    resolvedBy: "derived-relationship",
    sourceRefs: hasDesignSystem ? ["screen-spec", "design-system"] : ["screen-spec"],
    rationale: complete
      ? "Every screen text role resolves to a canonical Design System family and contrast role."
      : "Some screen text roles do not resolve to a canonical Design System family and contrast role.",
    assignments
  };
}

function actionAffordance(componentName) {
  const normalized = String(componentName || "").toLowerCase();
  if (normalized.includes("button")) return "button";
  if (normalized.includes("link")) return "link";
  if (normalized.includes("row")) return "whole-row";
  return "explicit-control";
}

function projectActionAssignments(screenSpec) {
  const componentMap = screenSpec?.componentMap || [];
  return (screenSpec?.actions || []).flatMap((action) => {
    const usage = componentMap.find((candidate) =>
      candidate?.regionId === action?.regionId
      && candidate?.interactionOwner
      && candidate.interactionOwner === action?.owner
      && candidate.interactionOwner !== "none"
    );
    if (!action?.id || !usage) return [];
    const requiredStates = [...new Set((usage.states || []).filter((state) =>
      ["hover", "focus-visible", "active", "disabled"].includes(state)
    ))];
    return [{ actionId: action.id, affordance: actionAffordance(usage.component), requiredStates }];
  });
}

function validatePresenceConditionShape(condition, location, errors) {
  if (!condition || typeof condition !== "object" || Array.isArray(condition)) {
    errors.push(`${location}: condition must be an object`);
    return;
  }
  const keys = Object.keys(condition);
  const compound = ["all", "any", "not"].filter((key) => Object.hasOwn(condition, key));
  const isPredicate = Object.hasOwn(condition, "signal") || Object.hasOwn(condition, "operator");
  if (compound.length + (isPredicate ? 1 : 0) !== 1) {
    errors.push(`${location}: condition must be exactly one predicate, all, any, or not expression`);
    return;
  }
  if (isPredicate) {
    if (typeof condition.signal !== "string" || !condition.signal) errors.push(`${location}: predicate requires signal`);
    const operator = condition.operator;
    if (!PRESENCE_VALUE_OPERATORS.has(operator) && !PRESENCE_VALUELESS_OPERATORS.has(operator)) {
      errors.push(`${location}: unsupported predicate operator '${operator || "<missing>"}'`);
      return;
    }
    if (PRESENCE_VALUE_OPERATORS.has(operator) && !Object.hasOwn(condition, "value")) {
      errors.push(`${location}: operator '${operator}' requires value`);
    }
    if (PRESENCE_VALUELESS_OPERATORS.has(operator) && Object.hasOwn(condition, "value")) {
      errors.push(`${location}: operator '${operator}' must not declare value`);
    }
    return;
  }
  if (Object.hasOwn(condition, "not")) {
    validatePresenceConditionShape(condition.not, `${location}.not`, errors);
    return;
  }
  const key = Object.hasOwn(condition, "all") ? "all" : "any";
  const children = condition[key];
  if (!Array.isArray(children) || children.length === 0) {
    errors.push(`${location}.${key}: compound condition requires at least one child`);
    return;
  }
  children.forEach((child, index) => validatePresenceConditionShape(child, `${location}.${key}[${index}]`, errors));
}

function validateRecipeDefaults(recipe, screenSpec = null, designSystem = null) {
  const errors = [];
  const regionMap = recipeRegions(recipe);
  if (!regionMap.size) return errors;

  if (screenSpec) {
    for (const regionId of selectedRegionIds(screenSpec)) {
      if (!regionMap.has(regionId)) errors.push(`screen recipe region '${regionId}' does not exist in recipe '${recipe?.meta?.id || "<unknown>"}'`);
    }
  }

  const spatialSeen = new Set();
  for (const assignment of recipe?.craftDefaults?.spatialComposition?.regionAssignments || []) {
    if (!regionMap.has(assignment?.regionId)) errors.push(`recipe spatialComposition references unknown region '${assignment?.regionId}'`);
    if (spatialSeen.has(assignment?.regionId)) errors.push(`recipe spatialComposition duplicates region '${assignment?.regionId}'`);
    spatialSeen.add(assignment?.regionId);
  }

  const surfaceSeen = new Set();
  const allowedSurfaceRoles = new Set(designSystem?.visualGrammar?.perceptualPolicy?.surfaceHierarchy?.levels || []);
  for (const assignment of recipe?.craftDefaults?.perceptualHierarchy?.surfaceAssignments || []) {
    if (!regionMap.has(assignment?.regionId)) errors.push(`recipe perceptualHierarchy references unknown region '${assignment?.regionId}'`);
    if (surfaceSeen.has(assignment?.regionId)) errors.push(`recipe perceptualHierarchy duplicates region '${assignment?.regionId}'`);
    surfaceSeen.add(assignment?.regionId);
    if (allowedSurfaceRoles.size && !allowedSurfaceRoles.has(assignment?.role)) {
      errors.push(`recipe perceptualHierarchy role '${assignment?.role}' for '${assignment?.regionId}' is not declared by design-system surfaceHierarchy.levels`);
    }
  }

  const presenceSeen = new Set();
  for (const [index, rule] of (recipe?.presenceDefaults || []).entries()) {
    const region = regionMap.get(rule?.targetId);
    if (rule?.targetType !== "region") errors.push(`recipe presenceDefaults[${index}] targetType must be 'region'`);
    if (!region) errors.push(`recipe presenceDefaults[${index}] references unknown region '${rule?.targetId}'`);
    if (presenceSeen.has(rule?.targetId)) errors.push(`recipe presenceDefaults duplicates region '${rule?.targetId}'`);
    presenceSeen.add(rule?.targetId);
    if (!["always", "conditional", "never"].includes(rule?.policy)) errors.push(`recipe presenceDefaults[${index}] has unsupported policy '${rule?.policy}'`);

    if (rule?.policy === "conditional") {
      if (!rule?.condition) errors.push(`recipe presenceDefaults[${index}] conditional policy requires condition`);
      else validatePresenceConditionShape(rule.condition, `recipe presenceDefaults[${index}]`, errors);
      if (region?.required !== false || region?.cardinality?.minimum !== 0) {
        errors.push(`conditional region '${rule?.targetId}' must declare required=false and cardinality.minimum=0`);
      }
    } else {
      if (rule?.condition !== null) errors.push(`recipe presenceDefaults[${index}] policy '${rule?.policy}' must use condition=null`);
      if (rule?.policy === "always" && (region?.required !== true || Number(region?.cardinality?.minimum || 0) < 1)) {
        errors.push(`always-present region '${rule?.targetId}' must declare required=true and cardinality.minimum>=1`);
      }
      if (rule?.policy === "never" && (region?.required !== false || region?.cardinality?.minimum !== 0)) {
        errors.push(`never-present region '${rule?.targetId}' must declare required=false and cardinality.minimum=0`);
      }
    }
  }

  return errors;
}

function projectRecipeDefaults({ recipe, screenSpec, designSystem, designSystemSource }) {
  const selected = selectedRegionIds(screenSpec);
  const selectedSet = new Set(selected);
  const densityMode = screenSpec?.visualDirection?.density || recipe?.content?.density || null;
  const densityKnown = ["dense", "compact", "balanced", "comfortable-compact", "comfortable", "spacious", "mixed"].includes(densityMode);

  const spatialDefaults = recipe?.craftDefaults?.spatialComposition || null;
  const spatialAssignments = (spatialDefaults?.regionAssignments || []).filter((assignment) => selectedSet.has(assignment.regionId));
  const spatialComplete = densityKnown && Number.isInteger(spatialDefaults?.maxVisualNestingDepth) && selected.length > 0 && selected.every((regionId) => spatialAssignments.some((assignment) => assignment.regionId === regionId));
  const spatialHasAny = densityKnown || Number.isInteger(spatialDefaults?.maxVisualNestingDepth) || spatialAssignments.length > 0;
  const densityFromScreen = Boolean(screenSpec?.visualDirection?.density);
  const spatialSourceRefs = [...new Set([
    ...(densityFromScreen ? ["screen-spec"] : []),
    ...(spatialDefaults || (!densityFromScreen && densityKnown) ? ["recipe"] : [])
  ])];
  const spatialComposition = spatialHasAny ? {
    status: spatialComplete ? "resolved" : "partial",
    resolvedBy: spatialComplete && spatialSourceRefs.length > 1 ? "derived-relationship" : spatialDefaults ? "recipe-default" : "screen-contract",
    sourceRefs: spatialSourceRefs.length ? spatialSourceRefs : ["screen-spec"],
    rationale: spatialComplete
      ? "Density and geometry for every selected recipe region are resolved from structured screen/recipe contracts."
      : "Only part of the selected screen geometry is resolved; missing region geometry remains explicit.",
    densityMode: densityKnown ? densityMode : null,
    maxVisualNestingDepth: Number.isInteger(spatialDefaults?.maxVisualNestingDepth) ? spatialDefaults.maxVisualNestingDepth : null,
    regionAssignments: spatialAssignments
  } : {
    ...unresolvedDimension(),
    densityMode: null,
    maxVisualNestingDepth: null,
    regionAssignments: []
  };

  const policyCheck = validatePerceptualPolicyShape(designSystem);
  const surfaceAssignments = (recipe?.craftDefaults?.perceptualHierarchy?.surfaceAssignments || [])
    .filter((assignment) => selectedSet.has(assignment.regionId))
    .map((assignment) => ({ targetType: "region", targetId: assignment.regionId, role: assignment.role, tokenRole: null }));
  const semanticTextStyles = designSystem?.visualGrammar?.semanticTextStyles || {};
  const textRoleAssignments = screenSpec?.visualHierarchy?.textRoleAssignments || [];
  const textContrastAssignments = textRoleAssignments.flatMap((assignment) => {
    const style = semanticTextStyles?.[assignment?.textRole];
    const role = contrastRoleFromColorToken(style?.colorToken);
    if (!assignment?.elementId || !role) return [];
    return [{ targetType: "element", targetId: assignment.elementId, role, tokenRole: style.colorToken }];
  });
  const visualPriorityLadder = screenSpec?.visualHierarchy?.visualPriorityLadder || [];
  const surfaceComplete = selected.length > 0 && selected.every((regionId) =>
    surfaceAssignments.some((assignment) => assignment.targetId === regionId)
  );
  const priorityComplete = visualPriorityLadder.length > 0 && visualPriorityLadder.every((item) =>
    item?.elementId && item?.priority && item?.visualRole && Array.isArray(item?.signals) && item.signals.length > 0
  );
  const textContrastComplete = textRoleAssignments.length > 0 && textContrastAssignments.length === textRoleAssignments.length;
  const perceptualComplete = policyCheck.present && Boolean(designSystemSource) && surfaceComplete && priorityComplete && textContrastComplete;
  const perceptualHierarchy = policyCheck.present && designSystemSource ? {
    status: perceptualComplete ? "resolved" : "partial",
    resolvedBy: surfaceAssignments.length ? "derived-relationship" : "design-system",
    sourceRefs: [...new Set([
      "design-system",
      ...(surfaceAssignments.length ? ["recipe"] : []),
      ...(visualPriorityLadder.length || textRoleAssignments.length ? ["screen-spec"] : [])
    ])],
    rationale: perceptualComplete
      ? "The Design System policy, recipe surfaces, screen priority ladder and text-contrast assignments resolve the screen hierarchy. Empty accent or border assignments mean the canonical sparse/default policies apply without a screen exception."
      : surfaceAssignments.length
        ? "Structural surface roles are resolved, but the screen priority ladder or text-contrast mapping remains incomplete."
        : "The product-level perceptual policy is canonical in the design system; screen-level assignments remain to be resolved.",
    policyPointer: `${designSystemSource.path}#visualGrammar.perceptualPolicy`,
    surfaceAssignments,
    accentAssignments: [],
    textContrastAssignments,
    borderAssignments: []
  } : {
    ...unresolvedDimension(),
    policyPointer: null,
    surfaceAssignments: [],
    accentAssignments: [],
    textContrastAssignments: [],
    borderAssignments: []
  };

  const presenceAssignments = (recipe?.presenceDefaults || [])
    .filter((rule) => rule.targetType === "region" && selectedSet.has(rule.targetId))
    .map((rule) => ({ targetType: "region", targetId: rule.targetId, policy: rule.policy, condition: rule.condition }));
  const interactionClarity = presenceAssignments.length ? {
    status: "partial",
    resolvedBy: "recipe-default",
    sourceRefs: ["recipe"],
    rationale: "Region presence is governed by typed recipe conditions; screen-specific action affordances and wayfinding remain explicit.",
    actionAssignments: [],
    presenceAssignments,
    wayfinding: { mode: "unresolved", parentRoute: null, rationale: null }
  } : {
    ...unresolvedDimension(),
    actionAssignments: [],
    presenceAssignments: [],
    wayfinding: { mode: "unresolved", parentRoute: null, rationale: null }
  };

  return { spatialComposition, perceptualHierarchy, interactionClarity, policyCheck };
}

function catalogContainsComponent(catalog, componentFamily) {
  const components = catalog?.components;
  if (!components || typeof components !== "object" || Array.isArray(components)) return false;
  if (Object.hasOwn(components, componentFamily)) return true;
  return Object.values(components).some((component) => component?.name === componentFamily);
}

function projectSemanticPresentation({ root, screenSpec, designSystem, sources }) {
  const contract = screenSpec?.semanticPresentation;
  if (!contract) {
    return {
      dimension: {
        ...unresolvedDimension(),
        rationale: "Screen semantic presentation is not explicitly classified; the workflow may not infer semantic roles from component names or prompt prose.",
        assignments: []
      },
      errors: []
    };
  }

  if (contract.mode === "not-applicable") {
    const errors = [];
    if ((contract.assignments || []).length) errors.push("semanticPresentation mode 'not-applicable' must not declare assignments");
    if (typeof contract.rationale !== "string" || !contract.rationale.trim()) errors.push("semanticPresentation mode 'not-applicable' requires a rationale");
    return {
      dimension: {
        status: "resolved",
        resolvedBy: "screen-contract",
        sourceRefs: ["screen-spec"],
        rationale: contract.rationale || "Semantic presentation is explicitly not applicable to this bounded screen.",
        assignments: []
      },
      errors
    };
  }

  if (contract.mode !== "registry") {
    return { dimension: { ...unresolvedDimension(), assignments: [] }, errors: [`semanticPresentation has unsupported mode '${contract.mode || "<missing>"}'`] };
  }

  const declared = contract.assignments || [];
  if (!declared.length) {
    return { dimension: { ...unresolvedDimension(), assignments: [] }, errors: ["semanticPresentation registry mode requires at least one assignment"] };
  }

  const registry = designSystem?.visualGrammar?.perceptualPolicy?.presentationRoles;
  if (!registry || typeof registry !== "object" || Array.isArray(registry)) {
    return {
      dimension: {
        ...unresolvedDimension(),
        rationale: "The screen declares semantic presentation roles, but the canonical Design System presentationRoles registry is unavailable; do not infer presentation families.",
        assignments: []
      },
      errors: []
    };
  }

  const usageById = new Map((screenSpec?.componentMap || []).map((usage) => [usage?.id, usage]));
  const seen = new Set();
  const errors = [];
  const assignments = [];
  const sourceRefs = new Set(["screen-spec", "design-system"]);

  for (const assignment of declared) {
    const usageId = assignment?.componentUsageId;
    const semanticRole = assignment?.semanticRole;
    if (!usageId || !semanticRole) {
      errors.push("semanticPresentation assignment requires componentUsageId and semanticRole");
      continue;
    }
    if (seen.has(usageId)) {
      errors.push(`semanticPresentation duplicates component usage '${usageId}'`);
      continue;
    }
    seen.add(usageId);

    const usage = usageById.get(usageId);
    if (!usage) {
      errors.push(`semanticPresentation references unknown component usage '${usageId}'`);
      continue;
    }
    const role = registry[semanticRole];
    if (!role) {
      errors.push(`semantic presentation role '${semanticRole}' is not declared by design-system perceptualPolicy.presentationRoles`);
      continue;
    }
    const componentFamily = role.componentFamily;
    if (usage.component !== componentFamily) {
      errors.push(`same semantic role -> same component family violation: role '${semanticRole}' requires '${componentFamily}', but component usage '${usageId}' declares '${usage.component}'`);
      continue;
    }

    const catalogPath = resolveArtifactReference(root, usage.catalogSource);
    if (!catalogPath || !fs.existsSync(catalogPath)) {
      errors.push(`semanticPresentation cannot resolve component catalog for '${usageId}': ${usage.catalogSource || "<missing>"}`);
      continue;
    }
    const catalog = readJson(catalogPath);
    if (!catalogContainsComponent(catalog, componentFamily)) {
      errors.push(`semantic presentation component family '${componentFamily}' is not declared by component catalog '${relativePosix(root, catalogPath)}'`);
      continue;
    }
    const catalogRelative = relativePosix(root, catalogPath);
    const source = (sources || []).find((candidate) => candidate.role === "component-catalog" && candidate.path === catalogRelative);
    if (!source) {
      errors.push(`semanticPresentation component catalog '${catalogRelative}' is missing from the craft dependency graph`);
      continue;
    }
    sourceRefs.add(source.id);
    assignments.push({
      targetType: "component",
      targetId: usageId,
      semanticRole,
      presentationFamily: componentFamily,
      consistency: role.consistency
    });
  }

  if (errors.length) return { dimension: { ...unresolvedDimension(), assignments: [] }, errors };
  return {
    dimension: {
      status: "resolved",
      resolvedBy: "derived-relationship",
      sourceRefs: [...sourceRefs],
      rationale: "Every declared screen semantic role resolves through the canonical Design System presentation registry to the same component family used by the referenced component catalog.",
      assignments
    },
    errors: []
  };
}

function projectDecisionSupport(screenSpec) {
  const contract = screenSpec?.decisionSupport;
  if (!contract) return { ...unresolvedDimension(), decisionQuestion: null, signals: [] };
  if (contract.mode === "not-applicable") {
    return {
      status: "resolved",
      resolvedBy: "screen-contract",
      sourceRefs: ["screen-spec"],
      rationale: contract.rationale,
      decisionQuestion: null,
      signals: []
    };
  }
  return {
    status: "resolved",
    resolvedBy: "screen-contract",
    sourceRefs: ["screen-spec"],
    rationale: contract.rationale,
    decisionQuestion: contract.decisionQuestion,
    signals: (contract.signals || []).map((signal) => ({
      id: signal.id,
      role: signal.role,
      renderTargetType: signal.renderTargetType,
      renderTargetId: signal.renderTargetId
    }))
  };
}

function projectInteractionClarity(base, screenSpec) {
  const wayfinding = screenSpec?.wayfinding;
  const actions = screenSpec?.actions || [];
  const actionAssignments = projectActionAssignments(screenSpec);
  if (!wayfinding) return { ...base, actionAssignments };
  const sourceRefs = [...new Set([...(base.sourceRefs || []), "screen-spec"])];
  const complete = base.presenceAssignments.length > 0
    && wayfinding.mode !== "unresolved"
    && typeof wayfinding.rationale === "string"
    && wayfinding.rationale.trim().length > 0
    && actionAssignments.length === actions.length;
  return {
    ...base,
    status: complete ? "resolved" : "partial",
    resolvedBy: base.resolvedBy === "unresolved" ? "screen-contract" : "derived-relationship",
    sourceRefs,
    rationale: complete
      ? "Recipe presence, every declared action affordance and explicit wayfinding are resolved by canonical contracts."
      : [base.rationale, wayfinding.rationale].filter(Boolean).join(" "),
    actionAssignments,
    wayfinding: {
      mode: wayfinding.mode,
      parentRoute: wayfinding.parentRoute ?? null,
      rationale: wayfinding.rationale
    }
  };
}

function deriveCraftContract({ root, screenSpecPath, outputPath, policyPath }) {
  const { policy } = loadAndValidatePolicy(policyPath);
  const { schema } = loadCraftSchema(root, policy);
  const screenSpec = readJson(screenSpecPath);
  const screenId = screenSpec?.screen?.id;
  if (!screenId) fail("Screen specification must declare screen.id before craft derivation.");

  const recipeReference = screenSpec?.recipe?.source;
  const recipePath = resolveArtifactReference(root, recipeReference);
  if (!recipePath || !fs.existsSync(recipePath)) fail(`Selected recipe source cannot be resolved: ${recipeReference || "<missing>"}`);
  const recipe = readJson(recipePath);
  const recipeId = recipe?.meta?.id || screenSpec?.recipe?.id;
  if (!recipeId) fail("Selected recipe must expose meta.id or screenSpec.recipe.id.");
  if (screenSpec?.recipe?.id && screenSpec.recipe.id !== recipeId) fail(`Screen recipe.id '${screenSpec.recipe.id}' disagrees with recipe source id '${recipeId}'.`);

  const policyVisitorMode = policy.visitorModes?.[recipeId] || policy.visitorModes?.[screenSpec?.screen?.category];
  const explicitVisitorMode = screenSpec?.visualDirection?.visitorMode;
  if (policyVisitorMode && explicitVisitorMode && explicitVisitorMode !== policyVisitorMode) {
    fail(`Explicit visitor mode '${explicitVisitorMode}' cannot override canonical policy mapping '${policyVisitorMode}' for recipe '${recipeId}'.`);
  }
  const visitorMode = policyVisitorMode || explicitVisitorMode;
  if (!visitorMode) {
    fail(`No visitor mode mapping exists for recipe '${recipeId}' or category '${screenSpec?.screen?.category || "<missing>"}'; project-owned custom recipes must declare visualDirection.visitorMode explicitly.`);
  }

  const visualDirectionPath = resolveArtifactReference(root, screenSpec?.visualDirection?.source);
  const designSystemPath = path.join(root, "docs/frontend/design-system/design-system.json");
  const stylingAuthorityPath = path.join(root, "docs/frontend/styling-authority.json");
  const compositionProofPath = path.join(root, "docs/frontend/screens", screenId, "composition-proof.json");
  const sources = [
    sourceEntry(root, "screen-spec", "screen-spec", screenSpecPath, true),
    sourceEntry(root, "recipe", "recipe", recipePath, true),
    sourceEntry(root, "visual-direction", "visual-direction", visualDirectionPath, Boolean(screenSpec?.visualDirection?.source)),
    sourceEntry(root, "design-system", "design-system", designSystemPath, false),
    sourceEntry(root, "styling-authority", "styling-authority", stylingAuthorityPath, false),
    sourceEntry(root, "composition-proof", "composition-proof", compositionProofPath, false),
    sourceEntry(root, "craft-policy", "craft-policy", policyPath, true),
    ...collectComponentCatalogSources(root, screenSpec)
  ].filter(Boolean);

  const designSystemSource = sources.find((source) => source.role === "design-system");
  const designSystem = designSystemSource ? readJson(resolveArtifactReference(root, designSystemSource.path)) : null;
  const recipeErrors = validateRecipeDefaults(recipe, screenSpec, designSystem);
  if (recipeErrors.length) fail(`Recipe craft defaults are invalid:\n- ${recipeErrors.join("\n- ")}`);

  const projected = projectRecipeDefaults({ recipe, screenSpec, designSystem, designSystemSource });
  if (projected.policyCheck.errors.length) fail(`Design-system perceptual policy is invalid:\n- ${projected.policyCheck.errors.join("\n- ")}`);
  const semanticProjection = projectSemanticPresentation({ root, screenSpec, designSystem, sources });
  if (semanticProjection.errors.length) fail(`Semantic presentation contract is invalid:\n- ${semanticProjection.errors.join("\n- ")}`);

  const interactionProjection = projectInteractionClarity(projected.interactionClarity, screenSpec);
  const decisionSupportProjection = projectDecisionSupport(screenSpec);
  const typographyProjection = projectTypographyCoherence(screenSpec, designSystem);

  const dimensions = {
    spatialComposition: projected.spatialComposition,
    perceptualHierarchy: projected.perceptualHierarchy,
    semanticPresentation: semanticProjection.dimension,
    interactionClarity: interactionProjection,
    decisionSupport: decisionSupportProjection,
    typographyCoherence: typographyProjection
  };

  const contract = {
    $schema: path.basename(policy.craftContract.schema),
    schemaVersion: "1.2.0",
    generated: true,
    screenId,
    visitorMode,
    visualFamilyId: `${visitorMode}-${recipeId}`,
    generatedAt: new Date().toISOString(),
    sources,
    contractSetSha256: contractSetSha256(sources),
    dimensions,
    unresolved: CRAFT_DIMENSIONS.filter((dimension) => dimensions[dimension].status !== "resolved")
  };

  const schemaErrors = validateJsonSchema(contract, schema);
  const semanticErrors = validateCraftContractSemantics({ root, contract, screenSpec, recipe });
  const errors = [...schemaErrors, ...semanticErrors];
  if (errors.length) fail(`Derived craft contract is invalid:\n- ${errors.join("\n- ")}`);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(contract, null, 2)}\n`);
  return { contract, outputPath };
}

function idsFromScreenSpec(screenSpec) {
  const regions = new Set(selectedRegionIds(screenSpec));
  const components = new Set((screenSpec?.componentMap || []).map((item) => item?.id).filter(Boolean));
  const actions = new Set((screenSpec?.actions || []).map((item) => item?.id).filter(Boolean));
  const elements = new Set([
    ...(screenSpec?.visualHierarchy?.textRoleAssignments || []).map((item) => item?.elementId),
    ...(screenSpec?.visualHierarchy?.visualPriorityLadder || []).map((item) => item?.elementId),
    ...(screenSpec?.visualHierarchy?.semanticOutline || []).map((item) => item?.id)
  ].filter(Boolean));
  const textRoles = new Map((screenSpec?.visualHierarchy?.textRoleAssignments || []).map((item) => [item?.elementId, item?.textRole]));
  return { regions, components, actions, elements, textRoles };
}

function ownerForTarget(targetType, ids) {
  if (targetType === "region") return ids.regions;
  if (targetType === "component") return ids.components;
  if (targetType === "action") return ids.actions;
  return ids.elements;
}

function expectedCatalogPaths(root, screenSpec) {
  return [...new Set((screenSpec?.componentMap || [])
    .map((usage) => resolveArtifactReference(root, usage?.catalogSource))
    .filter(Boolean)
    .map((filePath) => relativePosix(root, filePath)))]
    .sort();
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validateCraftContractSemantics({ root, contract, screenSpec, recipe }) {
  const errors = [];
  const sourceIds = new Set();
  for (const source of contract.sources || []) {
    if (sourceIds.has(source.id)) errors.push(`duplicate source id '${source.id}'`);
    sourceIds.add(source.id);
    const sourcePath = resolveArtifactReference(root, source.path);
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      if (source.required) errors.push(`required source '${source.id}' is missing: ${source.path}`);
      continue;
    }
    if (hashFile(sourcePath) !== source.sha256) errors.push(`source hash drift for '${source.id}' (${source.path})`);
  }

  const expectedContractSet = contractSetSha256(contract.sources || []);
  if (contract.contractSetSha256 !== expectedContractSet) errors.push("contractSetSha256 does not match the canonical ordered source identity");

  const recipeId = recipe?.meta?.id || screenSpec?.recipe?.id;
  if (contract.screenId !== screenSpec?.screen?.id) errors.push("screenId does not match screen specification");
  if (contract.visualFamilyId !== `${contract.visitorMode}-${recipeId}`) errors.push("visualFamilyId must be derived from visitorMode + recipe id");

  const expectedUnresolved = CRAFT_DIMENSIONS.filter((dimension) => contract?.dimensions?.[dimension]?.status !== "resolved").sort();
  const actualUnresolved = [...(contract.unresolved || [])].sort();
  if (!sameJson(expectedUnresolved, actualUnresolved)) errors.push("unresolved list must exactly match non-resolved craft dimensions");

  for (const dimension of CRAFT_DIMENSIONS) {
    const value = contract?.dimensions?.[dimension];
    if (!value) continue;
    if (value.status === "resolved" && value.resolvedBy === "unresolved") errors.push(`${dimension}: resolved status cannot use resolvedBy=unresolved`);
    if (value.status === "partial" && value.resolvedBy === "unresolved") errors.push(`${dimension}: partial status requires a concrete resolution source`);
    if (value.status === "unresolved" && value.resolvedBy !== "unresolved") errors.push(`${dimension}: unresolved status must use resolvedBy=unresolved`);
    if (["resolved", "partial"].includes(value.status) && !(value.sourceRefs || []).length) errors.push(`${dimension}: ${value.status} decision requires at least one sourceRef`);
    for (const sourceRef of value.sourceRefs || []) {
      if (!sourceIds.has(sourceRef)) errors.push(`${dimension}: sourceRef '${sourceRef}' does not exist`);
    }
  }

  const actualCatalogs = (contract.sources || []).filter((source) => source.role === "component-catalog").map((source) => source.path).sort();
  const expectedCatalogs = expectedCatalogPaths(root, screenSpec);
  if (!sameJson(actualCatalogs, expectedCatalogs)) errors.push("component-catalog sources must exactly match screenSpec.componentMap catalogSource dependencies");

  const designSystemSource = (contract.sources || []).find((source) => source.role === "design-system");
  let designSystem = null;
  if (designSystemSource) {
    const sourcePath = resolveArtifactReference(root, designSystemSource.path);
    if (sourcePath && fs.existsSync(sourcePath)) designSystem = readJson(sourcePath);
  }
  const recipeErrors = validateRecipeDefaults(recipe, screenSpec, designSystem);
  errors.push(...recipeErrors);
  const projected = projectRecipeDefaults({ recipe, screenSpec, designSystem, designSystemSource });
  errors.push(...projected.policyCheck.errors);
  const semanticProjection = projectSemanticPresentation({ root, screenSpec, designSystem, sources: contract.sources || [] });
  errors.push(...semanticProjection.errors);
  const interactionProjection = projectInteractionClarity(projected.interactionClarity, screenSpec);
  const decisionSupportProjection = projectDecisionSupport(screenSpec);
  const typographyProjection = projectTypographyCoherence(screenSpec, designSystem);

  for (const key of ["spatialComposition", "perceptualHierarchy"]) {
    if (!sameJson(contract?.dimensions?.[key], projected[key])) {
      errors.push(`${key}: derived contract does not match the current structured recipe/design-system projection`);
    }
  }
  if (!sameJson(contract?.dimensions?.interactionClarity, interactionProjection)) {
    errors.push("interactionClarity: derived contract does not match recipe presence plus screen wayfinding projection");
  }
  if (!sameJson(contract?.dimensions?.decisionSupport, decisionSupportProjection)) {
    errors.push("decisionSupport: derived contract does not match the current screen decision-support projection");
  }
  if (!sameJson(contract?.dimensions?.semanticPresentation, semanticProjection.dimension)) {
    errors.push("semanticPresentation: derived contract does not match the current screen/design-system/component-catalog registry projection");
  }
  if (!sameJson(contract?.dimensions?.typographyCoherence, typographyProjection)) {
    errors.push("typographyCoherence: derived contract does not match screen text roles plus Design System typography projection");
  }

  const ids = idsFromScreenSpec(screenSpec);
  for (const assignment of contract?.dimensions?.spatialComposition?.regionAssignments || []) {
    if (!ids.regions.has(assignment.regionId)) errors.push(`spatialComposition references unknown region '${assignment.regionId}'`);
  }
  for (const group of ["surfaceAssignments", "accentAssignments", "textContrastAssignments", "borderAssignments"]) {
    for (const assignment of contract?.dimensions?.perceptualHierarchy?.[group] || []) {
      if (!ownerForTarget(assignment.targetType, ids).has(assignment.targetId)) errors.push(`perceptualHierarchy.${group} references unknown ${assignment.targetType} '${assignment.targetId}'`);
    }
  }
  for (const assignment of contract?.dimensions?.semanticPresentation?.assignments || []) {
    if (!ownerForTarget(assignment.targetType, ids).has(assignment.targetId)) errors.push(`semanticPresentation references unknown ${assignment.targetType} '${assignment.targetId}'`);
  }
  for (const assignment of contract?.dimensions?.interactionClarity?.actionAssignments || []) {
    if (!ids.actions.has(assignment.actionId)) errors.push(`interactionClarity references unknown action '${assignment.actionId}'`);
  }
  for (const assignment of contract?.dimensions?.interactionClarity?.presenceAssignments || []) {
    if (!ownerForTarget(assignment.targetType, ids).has(assignment.targetId)) errors.push(`interactionClarity presence references unknown ${assignment.targetType} '${assignment.targetId}'`);
  }
  for (const signal of contract?.dimensions?.decisionSupport?.signals || []) {
    if (!ownerForTarget(signal.renderTargetType, ids).has(signal.renderTargetId)) errors.push(`decisionSupport signal '${signal.id}' references unknown ${signal.renderTargetType} '${signal.renderTargetId}'`);
  }
  for (const assignment of contract?.dimensions?.typographyCoherence?.assignments || []) {
    if (!ids.elements.has(assignment.elementId)) errors.push(`typographyCoherence references unknown element '${assignment.elementId}'`);
    const expectedRole = ids.textRoles.get(assignment.elementId);
    if (expectedRole && expectedRole !== assignment.textRole) errors.push(`typographyCoherence textRole '${assignment.textRole}' disagrees with screen textRole '${expectedRole}' for '${assignment.elementId}'`);
  }

  return errors;
}

function verifyCraftContract({ root, craftContractPath, policyPath }) {
  const { policy } = loadAndValidatePolicy(policyPath);
  const { schema } = loadCraftSchema(root, policy);
  const contract = readJson(craftContractPath);
  const schemaErrors = validateJsonSchema(contract, schema);
  const sourceByRole = new Map((contract.sources || []).map((source) => [source.role, source]));
  const screenSource = sourceByRole.get("screen-spec");
  const recipeSource = sourceByRole.get("recipe");
  if (!screenSource || !recipeSource) fail("Craft contract must contain screen-spec and recipe sources.");

  const screenSpecPath = resolveArtifactReference(root, screenSource.path);
  const recipePath = resolveArtifactReference(root, recipeSource.path);
  if (!screenSpecPath || !fs.existsSync(screenSpecPath)) fail(`Screen source cannot be resolved: ${screenSource.path}`);
  if (!recipePath || !fs.existsSync(recipePath)) fail(`Recipe source cannot be resolved: ${recipeSource.path}`);
  const screenSpec = readJson(screenSpecPath);
  const recipe = readJson(recipePath);
  const semanticErrors = validateCraftContractSemantics({ root, contract, screenSpec, recipe });
  const errors = [...schemaErrors, ...semanticErrors];
  if (errors.length) fail(`Invalid craft contract:\n- ${errors.join("\n- ")}`);
  return contract;
}

function findImpeccableDetector(root, args) {
  const explicit = args["skill-dir"] || process.env.IMPECCABLE_SKILL_DIR;
  const candidates = [
    explicit,
    path.join(root, ".agents/skills/impeccable"),
    path.join(os.homedir(), ".agents/skills/impeccable"),
    path.join(root, ".opencode/skills/impeccable"),
    path.join(root, ".gemini/skills/impeccable"),
    path.join(root, ".claude/skills/impeccable")
  ].filter(Boolean);
  for (const skillDir of candidates) {
    const detector = path.join(path.resolve(skillDir), "scripts/detect.mjs");
    if (fs.existsSync(detector)) return detector;
  }
  return null;
}

function runPinnedCliDetector(policy, root, target, scope) {
  const executable = process.platform === "win32" ? "npx.cmd" : "npx";
  const cliArgs = ["--yes", `${policy.provider.package}@${policy.provider.version}`, "detect", "--json"];
  if (scope) cliArgs.push("--scope", scope);
  cliArgs.push(target);
  return spawnSync(executable, cliArgs, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function recordRun(provenancePath, run) {
  const provenance = readJson(provenancePath);
  provenance.runs = Array.isArray(provenance.runs) ? provenance.runs : [];
  provenance.runs.push({ ...run, recordedAt: new Date().toISOString() });
  fs.writeFileSync(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`);
}

const args = parseArgs(process.argv.slice(2));
const command = args._[0] || "help";
const root = path.resolve(String(args.root || DEFAULT_ROOT));
const policyPath = resolvePolicy(root, args);

if (command === "help") {
  console.log([
    "Frontend craft adapter (Impeccable)",
    "",
    "prepare --feature-dir <path> [--screen-id <id>] [--output-dir <path>] [--root <root>]",
    "derive-craft --screen-spec <path> [--output <path>] [--root <root>]",
    "verify-craft --craft-contract <path> [--root <root>]",
    "verify-policy [--root <root>]",
    "route-finding --finding <path> [--output <path>] [--root <root>]",
    "detect --target <path> [--scope <scope>] [--skill-dir <path>] [--root <root>]",
    "record --context-dir <path> --provider-command <name> --status <status> [--visitor-mode <mode>] [--target <path>] [--artifact <path>]",
    "",
    "Craft decisions are derived from canonical artifacts, typed recipe defaults, the Design System semantic presentation registry, and dependency hashes. Partial or unresolved dimensions stay explicit and may not be invented from prompt prose.",
    "Finding routing requires an explicit governed taxonomy class and defect kind; it never classifies critique prose with NLP or silently repairs canonical contracts.",
    "Detection prefers an installed Impeccable skill and falls back to the exact pinned npm CLI version from frontend-craft-policy.json.",
    "This adapter never promotes provider PRODUCT.md/DESIGN.md or craft-contract.json to canonical project authority."
  ].join("\n"));
  process.exit(0);
}

if (command === "verify-policy") {
  const { policy, schemaPath } = loadAndValidatePolicy(policyPath);
  loadCraftSchema(root, policy);
  console.log(`Frontend craft policy verified: Impeccable ${policy.provider.version}, rollout=${policy.rollout.phase}.`);
  console.log(`Schema: ${schemaPath}`);
  console.log(`Craft contract schema: ${path.resolve(root, policy.craftContract.schema)}`);
  process.exit(0);
}

if (command === "prepare") {
  if (!args["feature-dir"]) fail("prepare requires --feature-dir <path>");
  const featureDir = path.resolve(root, String(args["feature-dir"]));
  const featureSlug = safeSlug(path.basename(featureDir));
  const outputDir = path.resolve(String(args["output-dir"] || path.join(os.tmpdir(), "spec-driven-impeccable", featureSlug)));
  const result = prepareContext({ root, featureDir, screenId: args["screen-id"] ? String(args["screen-id"]) : null, outputDir, policyPath });
  console.log(`Impeccable context prepared: ${outputDir}`);
  console.log(`export IMPECCABLE_CONTEXT_DIR=${JSON.stringify(outputDir)}`);
  console.log(`Product projection: ${result.productPath}`);
  console.log(`Design projection: ${result.designPath}`);
  console.log(`Provenance: ${result.provenancePath}`);
  process.exit(0);
}

if (command === "derive-craft") {
  if (!args["screen-spec"]) fail("derive-craft requires --screen-spec <path>");
  const { policy } = loadAndValidatePolicy(policyPath);
  const screenSpecPath = path.resolve(root, String(args["screen-spec"]));
  if (!fs.existsSync(screenSpecPath)) fail(`Screen specification not found: ${screenSpecPath}`);
  const screenSpec = readJson(screenSpecPath);
  const screenId = screenSpec?.screen?.id;
  if (!screenId) fail("Screen specification must declare screen.id.");
  const outputPath = path.resolve(String(args.output || path.join(os.tmpdir(), "spec-driven-impeccable", "craft-contracts", safeSlug(screenId), policy.craftContract.artifact)));
  const result = deriveCraftContract({ root, screenSpecPath, outputPath, policyPath });
  console.log(`Craft contract derived: ${result.outputPath}`);
  console.log(`visualFamilyId=${result.contract.visualFamilyId}`);
  console.log(`contractSetSha256=${result.contract.contractSetSha256}`);
  console.log(`unresolved=${result.contract.unresolved.join(",") || "none"}`);
  process.exit(0);
}

if (command === "verify-craft") {
  if (!args["craft-contract"]) fail("verify-craft requires --craft-contract <path>");
  const craftContractPath = path.resolve(root, String(args["craft-contract"]));
  if (!fs.existsSync(craftContractPath)) fail(`Craft contract not found: ${craftContractPath}`);
  const contract = verifyCraftContract({ root, craftContractPath, policyPath });
  console.log(`Craft contract verified: ${craftContractPath}`);
  console.log(`visualFamilyId=${contract.visualFamilyId}`);
  console.log(`contractSetSha256=${contract.contractSetSha256}`);
  console.log(`unresolved=${contract.unresolved.join(",") || "none"}`);
  process.exit(0);
}

if (command === "route-finding") {
  if (!args.finding) fail("route-finding requires --finding <path>");
  const { policy } = loadAndValidatePolicy(policyPath);
  const findingPath = path.resolve(root, String(args.finding));
  if (!fs.existsSync(findingPath)) fail(`Normalized finding not found: ${findingPath}`);
  const base = safeSlug(path.basename(findingPath, path.extname(findingPath)));
  const outputPath = path.resolve(String(args.output || path.join(os.tmpdir(), "spec-driven-impeccable", "finding-routes", `${base}-route.json`)));
  let report;
  try {
    report = routeFindingToFile({ root, policy, findingPath, outputPath });
  } catch (error) {
    fail(error.message);
  }
  console.log(`Finding route written: ${outputPath}`);
  console.log(`class=${report.route.class}`);
  console.log(`owner=${report.route.owner}`);
  console.log(`returnStage=${report.route.returnStage}`);
  console.log(`providerCommand=${report.route.providerCommand?.name || "none"}`);
  console.log(`revalidation=${report.route.revalidationSet.join(",")}`);
  process.exit(0);
}

if (command === "detect") {
  if (!args.target) fail("detect requires --target <path>");
  const { policy } = loadAndValidatePolicy(policyPath);
  const target = path.resolve(root, String(args.target));
  const detector = findImpeccableDetector(root, args);
  let result;
  if (detector) {
    const detectorArgs = [detector, "--json"];
    if (args.scope) detectorArgs.push("--scope", String(args.scope));
    detectorArgs.push(target);
    result = spawnSync(process.execPath, detectorArgs, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } else {
    result = runPinnedCliDetector(policy, root, target, args.scope ? String(args.scope) : null);
  }
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) fail(`Impeccable detector execution failed: ${result.error.message}`);
  process.exit(result.status ?? 1);
}

if (command === "record") {
  if (!args["context-dir"]) fail("record requires --context-dir <path>");
  if (!args["provider-command"]) fail("record requires --provider-command <name>");
  if (!args.status) fail("record requires --status <status>");
  const { policy } = loadAndValidatePolicy(policyPath);
  const governedCommands = new Set(Object.values(policy.commands).flat());
  const providerCommand = String(args["provider-command"]);
  if (!governedCommands.has(providerCommand)) fail(`Provider command is not governed by frontend-craft-policy.json: ${providerCommand}`);
  const contextDir = path.resolve(String(args["context-dir"]));
  const provenancePath = path.join(contextDir, policy.contextBridge.provenanceArtifact);
  if (!fs.existsSync(provenancePath)) fail(`Provenance artifact not found: ${provenancePath}`);
  recordRun(provenancePath, { command: providerCommand, visitorMode: args["visitor-mode"] || null, target: args.target || null, status: String(args.status), artifact: args.artifact || null });
  console.log(`Provider run recorded: ${provenancePath}`);
  process.exit(0);
}

fail(`Unknown command '${command}'. Run 'node frontend-craft.mjs help'.`);
