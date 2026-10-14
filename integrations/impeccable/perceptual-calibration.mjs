import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateJsonSchema, validateSchemaSupport } from "../../skills/spec-driven-engineering/scripts/lib/json-schema.mjs";
import { colorDelta, contrastRatio, surfaceColor, tokenColor } from "./perceptual-color.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_POLICY = path.join(DIR, "perceptual-calibration-policy.json");
const POLICY_SCHEMA = path.join(DIR, "perceptual-calibration-policy.schema.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function loadPerceptualCalibrationPolicy(policyPath = DEFAULT_POLICY) {
  const policy = readJson(policyPath);
  const schema = readJson(POLICY_SCHEMA);
  const unsupported = validateSchemaSupport(schema);
  if (unsupported.length) throw new Error(`Perceptual calibration schema uses unsupported keywords: ${unsupported.join(", ")}`);
  const errors = validateJsonSchema(policy, schema);
  if (errors.length) throw new Error(`Invalid perceptual calibration policy: ${errors.join(" | ")}`);
  if (policy.surface.maxDistanceFractionOfPrimaryTextDistance <= 0) {
    throw new Error("Invalid perceptual calibration policy: surface.maxDistanceFractionOfPrimaryTextDistance must be > 0.");
  }
  if (policy.density.contrastLoadTriggerRatio <= 1) {
    throw new Error("Invalid perceptual calibration policy: density.contrastLoadTriggerRatio must be > 1.");
  }
  return policy;
}

function validateSurfaceLayering(design, evidence, policy) {
  const errors = [];
  const themeId = evidence?.theme?.id;
  const levels = design.visualGrammar?.perceptualPolicy?.surfaceHierarchy?.levels || [];
  const canvas = surfaceColor(design, "canvas", themeId);
  const primary = tokenColor(design, "tokens.semantic.text.primary", themeId);
  if (!canvas || !primary) return errors;
  const textDistance = colorDelta(primary, canvas).distance;
  if (textDistance <= 0) return errors;

  for (let index = 0; index < levels.length - 1; index += 1) {
    const fromRole = levels[index];
    const toRole = levels[index + 1];
    const from = surfaceColor(design, fromRole, themeId);
    const to = surfaceColor(design, toRole, themeId);
    if (!from || !to) continue;
    const delta = colorDelta(from, to);
    if (delta.distance <= 1e-6) continue;
    const noise = textDistance * policy.surface.chromaNoiseFractionOfPrimaryTextDistance;
    if (delta.dChromatic > Math.max(noise, delta.dL * policy.surface.maxChromaticToLightnessRatio)) {
      errors.push({
        code: "PERCEPTUAL_SURFACE_CHROMA_DOMINANCE",
        class: "surface-layering",
        defectKind: "contract",
        message: `Surface transition '${fromRole}' -> '${toRole}' in '${themeId}' is driven by chromatic change instead of lightness hierarchy.`
      });
    }
    if (delta.distance > textDistance * policy.surface.maxDistanceFractionOfPrimaryTextDistance) {
      errors.push({
        code: "PERCEPTUAL_SURFACE_LAYER_TOO_LOUD",
        class: "surface-layering",
        defectKind: "contract",
        message: `Surface transition '${fromRole}' -> '${toRole}' in '${themeId}' is too strong relative to the theme's own text contrast span.`
      });
    }
  }
  return errors;
}

function validateBorderQuietness(design, evidence, policy) {
  const errors = [];
  const themeId = evidence?.theme?.id;
  const surface = surfaceColor(design, "surface", themeId) || surfaceColor(design, "canvas", themeId);
  const normal = tokenColor(design, "tokens.semantic.border.default", themeId);
  const strong = tokenColor(design, "tokens.semantic.border.strong", themeId);
  const muted = tokenColor(design, "tokens.semantic.text.muted", themeId);
  if (!surface || !normal) return errors;
  const normalContrast = contrastRatio(normal, surface);

  if (policy.border.defaultMustNotExceedStrong && strong && normalContrast > contrastRatio(strong, surface) + 0.01) {
    errors.push({
      code: "PERCEPTUAL_BORDER_ROLE_INVERSION",
      class: "surface-layering",
      defectKind: "contract",
      message: `Default border in '${themeId}' is perceptually stronger than the strong-border token.`
    });
  }
  if (policy.border.defaultMustBeQuieterThanMutedText && muted && normalContrast >= contrastRatio(muted, surface) - 0.01) {
    errors.push({
      code: "PERCEPTUAL_BORDER_FENCE",
      class: "surface-layering",
      defectKind: "contract",
      message: `Default border in '${themeId}' competes with muted text; structural boundaries must remain suggestive rather than fence-like.`
    });
  }
  return errors;
}

export function validatePerceptualThemeEvidence(design, evidence, options = {}) {
  if (!design?.tokens) return [];
  const policy = options.policy || loadPerceptualCalibrationPolicy(options.policyPath);
  return [
    ...validateSurfaceLayering(design, evidence, policy),
    ...validateBorderQuietness(design, evidence, policy)
  ];
}
