#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  validateJsonSchema,
  validateSchemaSupport
} from "../../skills/spec-driven-engineering/scripts/lib/json-schema.mjs";
import { routeFinding } from "./finding-router.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "../..");
const DEFAULT_POLICY = path.join(SCRIPT_DIR, "frontend-family-consistency-policy.json");
const POLICY_SCHEMA = path.join(SCRIPT_DIR, "frontend-family-consistency-policy.schema.json");
const MANIFEST_SCHEMA = path.join(SCRIPT_DIR, "frontend-family-consistency-manifest.schema.json");
const REPORT_SCHEMA = path.join(SCRIPT_DIR, "frontend-family-consistency-report.schema.json");
const PHASE5_AUDITOR = path.join(
  DEFAULT_ROOT,
  "skills/frontend-product-builder/scripts/audit-theme-operational-evidence.mjs"
);
const CRAFT_ADAPTER = path.join(DEFAULT_ROOT, "integrations/impeccable/frontend-craft.mjs");

function fail(message, code = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
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

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read JSON ${filePath}: ${error.message}`);
  }
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function normalizePath(value) {
  return String(value).split(path.sep).join("/");
}

function relativeToRoot(root, filePath) {
  const relative = path.relative(root, filePath);
  return relative && !relative.startsWith("..") ? normalizePath(relative) : normalizePath(filePath);
}

function resolveFrom(root, value) {
  if (!value) return null;
  const text = String(value);
  return path.isAbsolute(text) ? path.normalize(text) : path.resolve(root, text);
}

function validateDocument(value, schemaPath, label) {
  const schema = readJson(schemaPath);
  const unsupported = validateSchemaSupport(schema);
  if (unsupported.length) {
    throw new Error(`${label} schema uses unsupported keywords:\n- ${unsupported.join("\n- ")}`);
  }
  const errors = validateJsonSchema(value, schema);
  if (errors.length) throw new Error(`${label} is invalid:\n- ${errors.join("\n- ")}`);
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function stable(value) {
  if (Array.isArray(value)) return [...value].sort().join("|");
  if (value == null) return "<null>";
  return String(value);
}

function styleSignature(element) {
  const style = element?.computedStyle || {};
  return [
    element?.textRole,
    element?.contrastRole,
    style.fontSize,
    style.fontWeight,
    style.lineHeight,
    style.letterSpacing
  ].map(stable).join("::");
}

function geometryDelta(left, right) {
  const fields = ["x", "y", "width", "height"];
  return Math.max(...fields.map((field) => Math.abs(Number(left?.[field] || 0) - Number(right?.[field] || 0))));
}

function sameSet(left, right) {
  const a = [...new Set(left)].sort();
  const b = [...new Set(right)].sort();
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

function pairwise(values) {
  const result = [];
  for (let left = 0; left < values.length; left += 1) {
    for (let right = left + 1; right < values.length; right += 1) {
      result.push([values[left], values[right]]);
    }
  }
  return result;
}

function mapBy(items, keyFn) {
  const map = new Map();
  for (const item of items) map.set(keyFn(item), item);
  return map;
}

function routePhase7Finding({ root, craftPolicy, manifestPath, counter, scope, findingClass, defectKind, summary, subjects }) {
  const id = `phase7-${String(counter).padStart(3, "0")}`;
  const routed = routeFinding({
    root,
    policy: craftPolicy,
    finding: {
      id,
      class: findingClass,
      defectKind,
      summary,
      source: "objective-audit",
      severity: defectKind === "contract" ? "p1" : "p2",
      target: subjects.join(","),
      sourceArtifact: relativeToRoot(root, manifestPath)
    }
  });
  return {
    id,
    scope,
    class: findingClass,
    defectKind,
    summary,
    subjects: [...new Set(subjects)],
    route: {
      owner: routed.route.owner,
      affectedContracts: routed.route.affectedContracts,
      repairStrategy: routed.route.repairStrategy,
      providerCommand: routed.route.providerCommand,
      returnStage: routed.route.returnStage,
      revalidationSet: routed.route.revalidationSet
    }
  };
}

function runIndividualAudit(root, sample, craftPolicyPath) {
  const verify = spawnSync(
    process.execPath,
    [CRAFT_ADAPTER, "verify-craft", "--craft-contract", sample.craftContractPath, "--root", root, "--policy", craftPolicyPath],
    { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );
  if (verify.status !== 0) {
    return {
      ok: false,
      status: verify.status,
      stdout: verify.stdout || "",
      stderr: verify.stderr || "",
      failedStage: "verify-craft"
    };
  }
  const result = spawnSync(
    process.execPath,
    [PHASE5_AUDITOR, sample.screenSpecPath, sample.designSystemPath, sample.craftContractPath, sample.evidencePath, "--json"],
    { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    failedStage: result.status === 0 ? null : "phase5-audit"
  };
}

function loadSamples({ root, manifest, designSystemPath }) {
  const samples = [];
  const tupleSet = new Set();
  for (const entry of manifest.samples) {
    const screenSpecPath = resolveFrom(root, entry.screenSpec);
    const craftContractPath = resolveFrom(root, entry.craftContract);
    const evidencePath = resolveFrom(root, entry.evidence);
    for (const [label, filePath] of [
      ["screenSpec", screenSpecPath],
      ["craftContract", craftContractPath],
      ["evidence", evidencePath]
    ]) {
      if (!filePath || !fs.existsSync(filePath)) throw new Error(`Phase 7 sample ${label} not found: ${filePath || "<missing>"}`);
    }

    const screen = readJson(screenSpecPath);
    const craft = readJson(craftContractPath);
    const evidence = readJson(evidencePath);
    const screenId = screen?.screen?.id;
    const stateId = evidence?.meta?.stateId;
    const themeId = evidence?.theme?.id;
    if (!screenId || !stateId || !themeId) {
      throw new Error(`Phase 7 sample must expose screen.screen.id, evidence.meta.stateId and evidence.theme.id: ${entry.evidence}`);
    }
    if (craft.screenId !== screenId || evidence.meta?.screenId !== screenId) {
      throw new Error(`Phase 7 sample identity mismatch for '${entry.evidence}': screen=${screenId}, craft=${craft.screenId}, evidence=${evidence.meta?.screenId}.`);
    }
    if (craft.visualFamilyId !== manifest.visualFamilyId) {
      throw new Error(`Craft contract '${entry.craftContract}' belongs to '${craft.visualFamilyId}', expected '${manifest.visualFamilyId}'.`);
    }
    const tuple = `${screenId}\u0000${stateId}\u0000${themeId}`;
    if (tupleSet.has(tuple)) throw new Error(`Duplicate Phase 7 sample tuple '${screenId}/${stateId}/${themeId}'.`);
    tupleSet.add(tuple);

    samples.push({
      screenId,
      stateId,
      themeId,
      screenSpecPath,
      craftContractPath,
      evidencePath,
      designSystemPath,
      screen,
      craft,
      evidence,
      craftContractSha256: sha256(craftContractPath),
      contractSetSha256: craft.contractSetSha256
    });
  }
  return samples;
}

function compareCrossTheme({ samples, policy, addFinding }) {
  const groups = new Map();
  for (const sample of samples) {
    const key = `${sample.screenId}\u0000${sample.stateId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(sample);
  }

  let comparableGroups = 0;
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    comparableGroups += 1;

    for (const [left, right] of pairwise(group)) {
      const subjects = [
        `${left.screenId}/${left.stateId}/${left.themeId}`,
        `${right.screenId}/${right.stateId}/${right.themeId}`
      ];
      if (left.craftContractSha256 !== right.craftContractSha256 || left.contractSetSha256 !== right.contractSetSha256) {
        addFinding("cross-theme", "semantic-presentation", "contract",
          `The same screen/state is evaluated against different craft contract identities across themes.`, subjects);
        continue;
      }

      const leftRegions = mapBy(array(left.evidence.regions), (item) => `${item.viewport}\u0000${item.id}`);
      const rightRegions = mapBy(array(right.evidence.regions), (item) => `${item.viewport}\u0000${item.id}`);
      if (!sameSet([...leftRegions.keys()], [...rightRegions.keys()])) {
        addFinding("cross-theme", "surface-layering", "implementation",
          `Region structure changes between themes for '${left.screenId}/${left.stateId}'.`, subjects);
      }
      for (const key of [...leftRegions.keys()].filter((item) => rightRegions.has(item))) {
        const a = leftRegions.get(key);
        const b = rightRegions.get(key);
        const surfaceFields = ["surfaceRole", "surfaceLevel", "borderRole", "borderPurpose", "rendered"];
        if (surfaceFields.some((field) => stable(a[field]) !== stable(b[field]))) {
          addFinding("cross-theme", "surface-layering", "implementation",
            `Region '${a.id}' changes surface/border semantics between '${left.themeId}' and '${right.themeId}'.`, subjects);
        }
        if (stable(a.accentRole) !== stable(b.accentRole)) {
          addFinding("cross-theme", "accent-overuse", "implementation",
            `Region '${a.id}' changes accent semantics between themes.`, subjects);
        }
        if (stable(a.heightStrategyObserved) !== stable(b.heightStrategyObserved) || stable(a.nestingDepth) !== stable(b.nestingDepth)) {
          addFinding("cross-theme", "spatial-density", "implementation",
            `Region '${a.id}' changes spatial strategy between themes.`, subjects);
        }
        if (Math.abs(Number(a.contentOccupancy || 0) - Number(b.contentOccupancy || 0)) > policy.crossTheme.maxContentOccupancyDelta) {
          addFinding("cross-theme", "spatial-density", "implementation",
            `Region '${a.id}' content occupancy drifts beyond the Phase 7 tolerance across themes.`, subjects);
        }
        if (geometryDelta(a.containerBox, b.containerBox) > policy.crossTheme.maxGeometryDeltaPx ||
            geometryDelta(a.contentBox, b.contentBox) > policy.crossTheme.maxGeometryDeltaPx) {
          addFinding("cross-theme", "spatial-density", "implementation",
            `Region '${a.id}' geometry drifts by more than ${policy.crossTheme.maxGeometryDeltaPx}px across themes.`, subjects);
        }
      }

      const leftElements = mapBy(array(left.evidence.elements), (item) => `${item.viewport}\u0000${item.id}`);
      const rightElements = mapBy(array(right.evidence.elements), (item) => `${item.viewport}\u0000${item.id}`);
      if (!sameSet([...leftElements.keys()], [...rightElements.keys()])) {
        addFinding("cross-theme", "semantic-presentation", "implementation",
          `Rendered element structure changes between themes for '${left.screenId}/${left.stateId}'.`, subjects);
      }
      for (const key of [...leftElements.keys()].filter((item) => rightElements.has(item))) {
        const a = leftElements.get(key);
        const b = rightElements.get(key);
        if (stable(a.semanticDataRole) !== stable(b.semanticDataRole) ||
            stable(a.presentationFamily) !== stable(b.presentationFamily) ||
            stable(a.rendered) !== stable(b.rendered)) {
          addFinding("cross-theme", "semantic-presentation", "implementation",
            `Element '${a.id}' changes semantic role/presentation family between themes.`, subjects);
        }
        if (stable(a.textRole) !== stable(b.textRole) ||
            stable(a.priority) !== stable(b.priority) ||
            stable(a.contrastRole) !== stable(b.contrastRole)) {
          addFinding("cross-theme", "text-hierarchy", "implementation",
            `Element '${a.id}' changes hierarchy roles between themes.`, subjects);
        }
        if (stable(a.semanticColorRole) !== stable(b.semanticColorRole)) {
          addFinding("cross-theme", "semantic-color", "implementation",
            `Element '${a.id}' changes semantic color role between themes.`, subjects);
        }
        if (stable(a.accentRole) !== stable(b.accentRole)) {
          addFinding("cross-theme", "accent-overuse", "implementation",
            `Element '${a.id}' changes accent role between themes.`, subjects);
        }
        if (policy.crossTheme.requireStableTypography && styleSignature(a) !== styleSignature(b)) {
          addFinding("cross-theme", "text-hierarchy", "implementation",
            `Element '${a.id}' changes typographic metrics between themes.`, subjects);
        }
        if (geometryDelta(a.box, b.box) > policy.crossTheme.maxGeometryDeltaPx) {
          addFinding("cross-theme", "spatial-density", "implementation",
            `Element '${a.id}' geometry drifts by more than ${policy.crossTheme.maxGeometryDeltaPx}px across themes.`, subjects);
        }
      }

      const leftInteractions = mapBy(array(left.evidence.interactions), (item) => `${item.viewport}\u0000${item.id}`);
      const rightInteractions = mapBy(array(right.evidence.interactions), (item) => `${item.viewport}\u0000${item.id}`);
      if (!sameSet([...leftInteractions.keys()], [...rightInteractions.keys()])) {
        addFinding("cross-theme", "interaction-affordance", "implementation",
          `Interaction structure changes between themes for '${left.screenId}/${left.stateId}'.`, subjects);
      }
      for (const key of [...leftInteractions.keys()].filter((item) => rightInteractions.has(item))) {
        const a = leftInteractions.get(key);
        const b = rightInteractions.get(key);
        const fields = ["targetType", "targetId", "actionId", "componentUsageId", "purpose", "semanticElement", "accessibleRole", "accessibleName", "rendered"];
        if (fields.some((field) => stable(a[field]) !== stable(b[field])) ||
            !sameSet(array(a.states), array(b.states))) {
          addFinding("cross-theme", "interaction-affordance", "implementation",
            `Interaction '${a.id}' changes semantics/states between themes.`, subjects);
        }
      }

      const aWay = left.evidence.wayfinding || {};
      const bWay = right.evidence.wayfinding || {};
      if (["mode", "rendered", "targetId", "parentRoute"].some((field) => stable(aWay[field]) !== stable(bWay[field]))) {
        addFinding("cross-theme", "wayfinding", "implementation",
          `Wayfinding semantics change between themes for '${left.screenId}/${left.stateId}'.`, subjects);
      }

      const leftDecision = mapBy(array(left.evidence.decisionSignals), (item) => `${item.viewport}\u0000${item.id}`);
      const rightDecision = mapBy(array(right.evidence.decisionSignals), (item) => `${item.viewport}\u0000${item.id}`);
      if (!sameSet([...leftDecision.keys()], [...rightDecision.keys()])) {
        addFinding("cross-theme", "information-scent", "implementation",
          `Decision-support signal set changes between themes for '${left.screenId}/${left.stateId}'.`, subjects);
      } else {
        for (const key of leftDecision.keys()) {
          const a = leftDecision.get(key);
          const b = rightDecision.get(key);
          if (["targetType", "targetId", "rendered"].some((field) => stable(a[field]) !== stable(b[field]))) {
            addFinding("cross-theme", "information-scent", "implementation",
              `Decision-support signal '${a.id}' changes target/presence between themes.`, subjects);
          }
        }
      }

      if (policy.crossTheme.requireStableReadingOrder &&
          !sameSet(array(left.evidence.relations?.readingOrder), array(right.evidence.relations?.readingOrder))) {
        addFinding("cross-theme", "text-hierarchy", "implementation",
          `Reading-order membership changes between themes for '${left.screenId}/${left.stateId}'.`, subjects);
      } else if (policy.crossTheme.requireStableReadingOrder &&
                 array(left.evidence.relations?.readingOrder).join("\u0000") !== array(right.evidence.relations?.readingOrder).join("\u0000")) {
        addFinding("cross-theme", "text-hierarchy", "implementation",
          `Reading order changes between themes for '${left.screenId}/${left.stateId}'.`, subjects);
      }
    }
  }
  return comparableGroups;
}

function compareCrossScreen({ samples, policy, addFinding }) {
  const byScreen = new Map();
  for (const sample of samples) {
    if (!byScreen.has(sample.screenId)) byScreen.set(sample.screenId, sample);
  }
  const screens = [...byScreen.values()];
  if (screens.length < 2) return 0;

  if (policy.crossScreen.stableDensityModeWithinVisualFamily) {
    const values = new Map();
    for (const sample of screens) {
      const density = sample.craft.dimensions?.spatialComposition?.densityMode;
      if (!values.has(stable(density))) values.set(stable(density), []);
      values.get(stable(density)).push(sample.screenId);
    }
    if (values.size > 1) {
      addFinding("cross-screen", "spatial-density", "contract",
        `Screens in visual family '${samples[0].craft.visualFamilyId}' derive different density modes.`, screens.map((item) => item.screenId));
    }
  }

  if (policy.crossScreen.stableMaxNestingDepthWithinVisualFamily) {
    const values = new Map();
    for (const sample of screens) {
      const depth = sample.craft.dimensions?.spatialComposition?.maxVisualNestingDepth;
      if (!values.has(stable(depth))) values.set(stable(depth), []);
      values.get(stable(depth)).push(sample.screenId);
    }
    if (values.size > 1) {
      addFinding("cross-screen", "surface-layering", "contract",
        `Screens in the same visual family derive different maximum visual nesting depths.`, screens.map((item) => item.screenId));
    }
  }

  if (policy.crossScreen.strictSemanticRolePresentationFamily) {
    const roles = new Map();
    for (const sample of screens) {
      for (const assignment of array(sample.craft.dimensions?.semanticPresentation?.assignments)) {
        if (assignment.consistency !== "strict") continue;
        if (!roles.has(assignment.semanticRole)) roles.set(assignment.semanticRole, new Map());
        const families = roles.get(assignment.semanticRole);
        if (!families.has(assignment.presentationFamily)) families.set(assignment.presentationFamily, new Set());
        families.get(assignment.presentationFamily).add(sample.screenId);
      }
    }
    for (const [role, families] of roles) {
      if (families.size <= 1) continue;
      addFinding("cross-screen", "semantic-presentation", "contract",
        `Strict semantic role '${role}' maps to multiple presentation families within one visual family.`,
        [...new Set([...families.values()].flatMap((set) => [...set]))]);
    }
  }

  if (policy.crossScreen.stableTypographyFamilyRoleContract) {
    const roles = new Map();
    for (const sample of screens) {
      for (const assignment of array(sample.craft.dimensions?.typographyCoherence?.assignments)) {
        const signature = `${assignment.textRole}::${assignment.contrastRole}`;
        if (!roles.has(assignment.familyRole)) roles.set(assignment.familyRole, new Map());
        const signatures = roles.get(assignment.familyRole);
        if (!signatures.has(signature)) signatures.set(signature, new Set());
        signatures.get(signature).add(sample.screenId);
      }
    }
    for (const [familyRole, signatures] of roles) {
      if (signatures.size <= 1) continue;
      addFinding("cross-screen", "text-hierarchy", "contract",
        `Typography family role '${familyRole}' maps to multiple text/contrast role contracts within one visual family.`,
        [...new Set([...signatures.values()].flatMap((set) => [...set]))]);
    }
  }

  if (policy.crossScreen.stableObservedTypographyByTheme) {
    const observed = new Map();
    for (const sample of samples) {
      const elements = mapBy(array(sample.evidence.elements), (item) => item.id);
      for (const assignment of array(sample.craft.dimensions?.typographyCoherence?.assignments)) {
        const element = elements.get(assignment.elementId);
        if (!element || element.rendered === false) continue;
        const key = `${sample.themeId}\u0000${assignment.familyRole}`;
        if (!observed.has(key)) observed.set(key, new Map());
        const signatures = observed.get(key);
        const signature = styleSignature(element);
        if (!signatures.has(signature)) signatures.set(signature, new Set());
        signatures.get(signature).add(sample.screenId);
      }
    }
    for (const [key, signatures] of observed) {
      if (signatures.size <= 1) continue;
      const [themeId, familyRole] = key.split("\u0000");
      addFinding("cross-screen", "text-hierarchy", "implementation",
        `Observed typography for family role '${familyRole}' is inconsistent across screens in theme '${themeId}'.`,
        [...new Set([...signatures.values()].flatMap((set) => [...set]))]);
    }
  }

  return screens.length;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    process.stdout.write([
      "Frontend family consistency audit — Phase 7",
      "",
      "node integrations/impeccable/frontend-family-consistency.mjs --manifest <manifest.json>",
      "  [--root <project-root>] [--policy <phase7-policy.json>] [--output <report.json>]",
      "  [--json] [--check]"
    ].join("\n") + "\n");
    return;
  }
  if (!args.manifest) fail("Phase 7 audit requires --manifest <frontend-family-consistency-manifest.json>.");

  const root = path.resolve(String(args.root || DEFAULT_ROOT));
  const manifestPath = resolveFrom(root, args.manifest);
  const policyPath = resolveFrom(root, args.policy || DEFAULT_POLICY);
  if (!fs.existsSync(manifestPath)) fail(`Phase 7 manifest not found: ${manifestPath}`);
  if (!fs.existsSync(policyPath)) fail(`Phase 7 policy not found: ${policyPath}`);

  const manifest = readJson(manifestPath);
  const policy = readJson(policyPath);
  validateDocument(manifest, MANIFEST_SCHEMA, "Phase 7 manifest");
  validateDocument(policy, POLICY_SCHEMA, "Phase 7 policy");

  const designSystemPath = resolveFrom(root, manifest.designSystem);
  if (!designSystemPath || !fs.existsSync(designSystemPath)) fail(`Phase 7 design system not found: ${designSystemPath || "<missing>"}`);
  const designSystem = readJson(designSystemPath);
  const craftPolicyPath = path.join(root, "prompts/spec-driven/frontend-craft-policy.json");
  const craftPolicy = readJson(craftPolicyPath);
  const samples = loadSamples({ root, manifest, designSystemPath });

  const sampleReports = samples.map((sample) => ({
    screenId: sample.screenId,
    stateId: sample.stateId,
    themeId: sample.themeId,
    screenSpec: relativeToRoot(root, sample.screenSpecPath),
    craftContract: relativeToRoot(root, sample.craftContractPath),
    evidence: relativeToRoot(root, sample.evidencePath),
    craftContractSha256: sample.craftContractSha256,
    contractSetSha256: sample.contractSetSha256
  }));

  const phase5Results = samples.map((sample) => ({ sample, result: runIndividualAudit(root, sample, craftPolicyPath) }));
  const phase5Failures = phase5Results.filter((item) => !item.result.ok);
  const requiredThemes = policy.themeCoverage.mode === "all-design-system-supported"
    ? array(designSystem.themes?.supported)
    : [];
  const observedThemes = [...new Set(samples.map((sample) => sample.themeId))];
  const screenIds = [...new Set(samples.map((sample) => sample.screenId))];

  const evidenceGaps = [];
  const coverageGroups = new Map();
  for (const sample of samples) {
    const key = `${sample.screenId}\u0000${sample.stateId}`;
    if (!coverageGroups.has(key)) coverageGroups.set(key, new Set());
    coverageGroups.get(key).add(sample.themeId);
  }
  let gapCounter = 1;
  for (const [key, themes] of coverageGroups) {
    const [screenId, stateId] = key.split("\u0000");
    for (const theme of requiredThemes) {
      if (themes.has(theme)) continue;
      evidenceGaps.push({
        id: `phase7-evidence-gap-${String(gapCounter++).padStart(3, "0")}`,
        screenId,
        stateId,
        missingTheme: theme,
        transition: "CAPTURE_EVIDENCE",
        summary: `Missing '${theme}' evidence for '${screenId}/${stateId}'.`
      });
    }
  }

  const findings = [];
  const findingKeys = new Set();
  let findingCounter = 1;
  const addFinding = (scope, findingClass, defectKind, summary, subjects) => {
    const normalizedSubjects = [...new Set(subjects)].sort();
    const key = [scope, findingClass, defectKind, summary, normalizedSubjects.join("|")].join("\u0000");
    if (findingKeys.has(key)) return;
    findingKeys.add(key);
    findings.push(routePhase7Finding({
      root,
      craftPolicy,
      manifestPath,
      counter: findingCounter++,
      scope,
      findingClass,
      defectKind,
      summary,
      subjects: normalizedSubjects
    }));
  };

  let comparableThemeGroups = 0;
  let comparableScreens = 0;
  if (!phase5Failures.length) {
    comparableThemeGroups = compareCrossTheme({ samples, policy, addFinding });
    comparableScreens = compareCrossScreen({ samples, policy, addFinding });
  }

  const hasContractFinding = findings.some((finding) => finding.defectKind === "contract");
  const hasImplementationFinding = findings.some((finding) => finding.defectKind === "implementation");
  let transition = "CONSISTENT";
  let status = "passed";
  if (phase5Failures.length) {
    transition = "BLOCKED";
    status = "blocked";
  } else if (hasContractFinding) {
    transition = policy.routing.contractReturnStage;
    status = "failed";
  } else if (evidenceGaps.length) {
    transition = policy.routing.evidenceGapTransition;
    status = "blocked";
  } else if (hasImplementationFinding) {
    transition = policy.routing.implementationReturnStage;
    status = "failed";
  }

  const report = {
    $schema: "frontend-family-consistency-report.schema.json",
    schemaVersion: "1.0.0",
    generated: true,
    generatedAt: new Date().toISOString(),
    visualFamilyId: manifest.visualFamilyId,
    designSystem: {
      path: relativeToRoot(root, designSystemPath),
      sha256: sha256(designSystemPath)
    },
    samples: sampleReports,
    coverage: {
      screenIds,
      requiredThemes,
      observedThemes
    },
    checks: {
      individualEvidence: phase5Failures.length ? "blocked" : "passed",
      themeCoverage: evidenceGaps.length ? "failed" : "passed",
      crossTheme: phase5Failures.length ? "blocked" : (comparableThemeGroups ? (findings.some((finding) => finding.scope === "cross-theme") ? "failed" : "passed") : "not-applicable"),
      crossScreen: phase5Failures.length ? "blocked" : (comparableScreens ? (findings.some((finding) => finding.scope === "cross-screen") ? "failed" : "passed") : "not-applicable")
    },
    evidenceGaps,
    findings,
    transition,
    status
  };

  if (phase5Failures.length) {
    for (const failure of phase5Failures) {
      process.stderr.write(
        `Phase 7 blocked: individual ${failure.result.failedStage || "audit"} failed for ${failure.sample.screenId}/${failure.sample.stateId}/${failure.sample.themeId}.\n${failure.result.stdout}${failure.result.stderr}\n`
      );
    }
  }

  validateDocument(report, REPORT_SCHEMA, "Phase 7 report");
  const outputPath = resolveFrom(
    root,
    args.output || path.join(path.dirname(manifestPath), "frontend-family-consistency-report.json")
  );
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);

  if (args.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else {
    process.stdout.write([
      `Phase 7 family consistency report: ${outputPath}`,
      `visualFamilyId=${report.visualFamilyId}`,
      `samples=${report.samples.length}`,
      `screens=${report.coverage.screenIds.length}`,
      `themes=${report.coverage.observedThemes.join(",") || "none"}`,
      `findings=${report.findings.length}`,
      `evidenceGaps=${report.evidenceGaps.length}`,
      `transition=${report.transition}`,
      `status=${report.status}`
    ].join("\n") + "\n");
  }

  if (args.check && report.status !== "passed") process.exitCode = 2;
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
