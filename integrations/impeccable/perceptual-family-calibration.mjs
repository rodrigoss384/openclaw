import fs from "node:fs";
import path from "node:path";
import { colorDelta, parseColor, sameRgb, surfaceColor, tokenColor } from "./perceptual-color.mjs";
import { loadPerceptualCalibrationPolicy } from "./perceptual-calibration.mjs";

const arr = (value) => Array.isArray(value) ? value : [];
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));
const resolveFrom = (root, value) => path.isAbsolute(String(value)) ? path.normalize(String(value)) : path.resolve(root, String(value));

function mapBy(items, key) {
  const result = new Map();
  for (const item of items) result.set(key(item), item);
  return result;
}

function geometryDelta(left, right) {
  return Math.max(...["x", "y", "width", "height"].map((field) => Math.abs(Number(left?.[field] || 0) - Number(right?.[field] || 0))));
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function contrastLoad(sample) {
  return median(arr(sample.evidence.elements)
    .filter((item) => item.rendered !== false && ["primary", "secondary", "muted"].includes(item.contrastRole))
    .map((item) => Number(item.contrastRatio))
    .filter((value) => value > 1));
}

function semanticSalience(design, sample, element) {
  const color = parseColor(element?.computedStyle?.color);
  if (!color) return null;
  const region = arr(sample.evidence.regions).find((item) => item.id === element.regionId && item.viewport === element.viewport);
  const background = surfaceColor(design, region?.surfaceRole || "canvas", sample.themeId) || surfaceColor(design, "canvas", sample.themeId);
  const primary = tokenColor(design, "tokens.semantic.text.primary", sample.themeId);
  if (!background || !primary) return null;
  const span = colorDelta(primary, background).distance;
  return span > 1e-6 ? colorDelta(color, background).distance / span : null;
}

function colorFindings(design, left, right, policy) {
  const findings = [];
  if (!design?.tokens) return findings;
  const aMap = mapBy(arr(left.evidence.elements), (item) => `${item.viewport}\u0000${item.id}`);
  const bMap = mapBy(arr(right.evidence.elements), (item) => `${item.viewport}\u0000${item.id}`);
  for (const [key, a] of aMap) {
    const b = bMap.get(key);
    if (!b || !a.semanticColorRole || a.semanticColorRole !== b.semanticColorRole || a.rendered === false || b.rendered === false) continue;
    const aColor = parseColor(a?.computedStyle?.color);
    const bColor = parseColor(b?.computedStyle?.color);
    const aWeight = semanticSalience(design, left, a);
    const bWeight = semanticSalience(design, right, b);
    if (aWeight == null || bWeight == null) continue;
    if (policy.themeColor.exactReuseRequiresContextValidation && sameRgb(aColor, bColor)
        && (left.evidence.theme?.contextValidated !== true || right.evidence.theme?.contextValidated !== true)) {
      findings.push({ code: "PERCEPTUAL_THEME_COLOR_REUSE_UNVALIDATED", class: "semantic-color", defectKind: "implementation", summary: `Element '${a.id}' reuses a semantic color across themes without per-theme context validation.` });
    }
    const drift = Math.abs(aWeight - bWeight) / Math.max(Math.min(aWeight, bWeight), 0.05);
    if (drift > policy.themeColor.maxRelativeSalienceDrift) {
      findings.push({ code: "PERCEPTUAL_THEME_COLOR_WEIGHT_DRIFT", class: "semantic-color", defectKind: "implementation", summary: `Element '${a.id}' (${a.semanticColorRole}) changes perceptual color weight across themes beyond the calibrated tolerance.` });
    }
  }
  return findings;
}

function densityFindings(left, right, policy) {
  const findings = [];
  const aMap = mapBy(arr(left.evidence.regions), (item) => `${item.viewport}\u0000${item.id}`);
  const bMap = mapBy(arr(right.evidence.regions), (item) => `${item.viewport}\u0000${item.id}`);
  const shared = [...aMap.keys()].filter((key) => bMap.has(key));
  if (!shared.length) return findings;
  const aLoad = contrastLoad(left);
  const bLoad = contrastLoad(right);
  const ratio = aLoad && bLoad ? Math.max(aLoad, bLoad) / Math.min(aLoad, bLoad) : 1;
  const compensate = ratio >= policy.density.contrastLoadTriggerRatio;
  const geometryLimit = compensate ? policy.density.compensatedMaxGeometryDeltaPx : policy.density.ordinaryMaxGeometryDeltaPx;
  const occupancyLimit = compensate ? policy.density.compensatedMaxContentOccupancyDelta : policy.density.ordinaryMaxContentOccupancyDelta;

  for (const key of shared) {
    const a = aMap.get(key);
    const b = bMap.get(key);
    const delta = Math.max(geometryDelta(a.containerBox, b.containerBox), geometryDelta(a.contentBox, b.contentBox));
    if (delta > geometryLimit) findings.push({ code: compensate ? "PERCEPTUAL_DENSITY_OVERRIDE_EXCESS" : "PERCEPTUAL_GEOMETRY_DRIFT", class: "spatial-density", defectKind: "implementation", summary: `Region '${a.id}' geometry exceeds the ${compensate ? "contrast-compensated" : "ordinary"} cross-theme envelope.` });
    if (Math.abs(Number(a.contentOccupancy || 0) - Number(b.contentOccupancy || 0)) > occupancyLimit) findings.push({ code: "PERCEPTUAL_DENSITY_OCCUPANCY_DRIFT", class: "spatial-density", defectKind: "implementation", summary: `Region '${a.id}' content occupancy exceeds the ${compensate ? "contrast-compensated" : "ordinary"} cross-theme envelope.` });
  }

  const aElements = mapBy(arr(left.evidence.elements), (item) => `${item.viewport}\u0000${item.id}`);
  const bElements = mapBy(arr(right.evidence.elements), (item) => `${item.viewport}\u0000${item.id}`);
  for (const [key, a] of aElements) {
    const b = bElements.get(key);
    if (!b || a.rendered === false || b.rendered === false || !a.box || !b.box) continue;
    const delta = geometryDelta(a.box, b.box);
    if (delta > geometryLimit) findings.push({ code: compensate ? "PERCEPTUAL_DENSITY_ELEMENT_OVERRIDE_EXCESS" : "PERCEPTUAL_ELEMENT_GEOMETRY_DRIFT", class: "spatial-density", defectKind: "implementation", summary: `Element '${a.id}' geometry exceeds the ${compensate ? "contrast-compensated" : "ordinary"} cross-theme envelope.` });
  }

  if (compensate) {
    const high = aLoad >= bLoad ? left : right;
    const low = high === left ? right : left;
    const average = (sample) => shared.reduce((sum, key) => {
      const region = (sample === left ? aMap : bMap).get(key);
      return sum + Number(region.contentOccupancy || 0);
    }, 0) / shared.length;
    if (average(high) > average(low) - policy.density.minimumOccupancyReduction + 1e-6) {
      findings.push({ code: "PERCEPTUAL_CONTRAST_DENSITY_NOT_COMPENSATED", class: "spatial-density", defectKind: "implementation", summary: `Theme '${high.themeId}' has materially higher contrast load than '${low.themeId}' but does not increase spatial separation.` });
    }
  }
  return findings;
}

export function validateCrossThemePerceptualCalibration({ root, manifest, policyPath }) {
  const designPath = resolveFrom(root, manifest.designSystem);
  if (!designPath || !fs.existsSync(designPath)) return [];
  const design = readJson(designPath);
  const policy = loadPerceptualCalibrationPolicy(policyPath);
  const samples = arr(manifest.samples).map((entry) => {
    const evidence = readJson(resolveFrom(root, entry.evidence));
    const screen = readJson(resolveFrom(root, entry.screenSpec));
    return { screenId: screen?.screen?.id, stateId: evidence?.meta?.stateId, themeId: evidence?.theme?.id, evidence };
  });
  const groups = new Map();
  for (const sample of samples) {
    const key = `${sample.screenId}\u0000${sample.stateId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(sample);
  }
  const findings = [];
  for (const group of groups.values()) {
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const left = group[i];
        const right = group[j];
        if (!left.themeId || !right.themeId || left.themeId === right.themeId) continue;
        const subjects = [`${left.screenId}/${left.stateId}/${left.themeId}`, `${right.screenId}/${right.stateId}/${right.themeId}`];
        for (const item of [...colorFindings(design, left, right, policy), ...densityFindings(left, right, policy)]) findings.push({ ...item, subjects });
      }
    }
  }
  return findings;
}
