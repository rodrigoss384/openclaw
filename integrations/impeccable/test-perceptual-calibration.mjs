#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validatePerceptualThemeEvidence } from "./perceptual-calibration.mjs";
import { validateCrossThemePerceptualCalibration } from "./perceptual-family-calibration.mjs";

let assertions = 0;
const check = (value, message) => { assertions += 1; assert.ok(value, message); };
const equal = (actual, expected, message) => { assertions += 1; assert.equal(actual, expected, message); };

function token(value) { return { value }; }
function themed(light, dark) { return { values: { light, dark } }; }

function design() {
  return {
    themes: { supported: ["light", "dark"], default: "dark" },
    tokens: {
      semantic: {
        background: {
          canvas: themed("#F8FAFC", "#020617"),
          surface: themed("#FFFFFF", "#0F172A"),
          surfaceSubtle: themed("#F1F5F9", "#1E293B"),
          surfaceElevated: themed("#FFFFFF", "#1E293B")
        },
        text: {
          primary: themed("#020617", "#F8FAFC"),
          muted: themed("#475569", "#94A3B8")
        },
        border: {
          default: themed("#E2E8F0", "#1E293B"),
          strong: themed("#94A3B8", "#475569")
        }
      }
    },
    visualGrammar: {
      perceptualPolicy: {
        surfaceHierarchy: { levels: ["canvas", "surface", "surface-subtle", "surface-elevated"] }
      }
    }
  };
}

function themeEvidence(id) {
  return { theme: { id, scheme: id, contextValidated: true }, regions: [], elements: [] };
}

const good = design();
equal(validatePerceptualThemeEvidence(good, themeEvidence("light")).length, 0, "neutral light surfaces and quiet borders must pass");
equal(validatePerceptualThemeEvidence(good, themeEvidence("dark")).length, 0, "neutral dark surfaces and quiet borders must pass");

const chromaticSurface = design();
chromaticSurface.tokens.semantic.background.surface = themed("#E0F2FE", "#0F172A");
const surfaceErrors = validatePerceptualThemeEvidence(chromaticSurface, themeEvidence("light"));
check(surfaceErrors.some((error) => error.code === "PERCEPTUAL_SURFACE_CHROMA_DOMINANCE"), "surface hierarchy must reject chromatic elevation instead of lightness-dominant elevation");

const fenceBorder = design();
fenceBorder.tokens.semantic.border.default = themed("#475569", "#1E293B");
const borderErrors = validatePerceptualThemeEvidence(fenceBorder, themeEvidence("light"));
check(borderErrors.some((error) => error.code === "PERCEPTUAL_BORDER_FENCE"), "ordinary borders must remain quieter than muted text");

function element({ id = "status", color, contrastRatio = 6, semanticColorRole = "success" }) {
  return {
    id,
    viewport: "wide",
    regionId: "content",
    rendered: true,
    contrastRole: "primary",
    contrastRatio,
    semanticColorRole,
    computedStyle: { color }
  };
}

function region({ occupancy = 0.7, x = 0, width = 800 }) {
  return {
    id: "content",
    viewport: "wide",
    surfaceRole: "surface",
    rendered: true,
    contentOccupancy: occupancy,
    containerBox: { x, y: 0, width, height: 200 },
    contentBox: { x, y: 0, width, height: 140 }
  };
}

function evidence(themeId, options = {}) {
  return {
    meta: { stateId: "data" },
    theme: { id: themeId, contextValidated: options.contextValidated ?? true },
    regions: [region({ occupancy: options.occupancy ?? 0.7, x: options.x ?? 0, width: options.width ?? 800 })],
    elements: [
      element({ color: options.statusColor, contrastRatio: options.primaryContrast ?? 6 }),
      element({ id: "body", color: themeId === "light" ? "rgb(2, 6, 23)" : "rgb(248, 250, 252)", contrastRatio: options.bodyContrast ?? options.primaryContrast ?? 6, semanticColorRole: null })
    ]
  };
}

function write(root, relative, value) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
  return relative;
}

function validatePair(lightEvidence, darkEvidence) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "perceptual-calibration-"));
  try {
    const designRef = write(root, "design.json", design());
    const screenRef = write(root, "screen.json", { screen: { id: "cases" } });
    const lightRef = write(root, "light.json", lightEvidence);
    const darkRef = write(root, "dark.json", darkEvidence);
    return validateCrossThemePerceptualCalibration({
      root,
      manifest: {
        designSystem: designRef,
        samples: [
          { screenSpec: screenRef, evidence: lightRef },
          { screenSpec: screenRef, evidence: darkRef }
        ]
      }
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const balanced = validatePair(
  evidence("light", { statusColor: "rgb(21, 128, 61)" }),
  evidence("dark", { statusColor: "rgb(22, 163, 74)" })
);
check(!balanced.some((finding) => finding.code === "PERCEPTUAL_THEME_COLOR_WEIGHT_DRIFT"), "theme-adjusted semantic colors with comparable perceptual weight must pass");

const reusedHeavy = validatePair(
  evidence("light", { statusColor: "rgb(34, 197, 94)" }),
  evidence("dark", { statusColor: "rgb(34, 197, 94)" })
);
check(reusedHeavy.some((finding) => finding.code === "PERCEPTUAL_THEME_COLOR_WEIGHT_DRIFT"), "same semantic color must fail when simultaneous background context changes its perceptual weight materially");

const ordinaryGeometryDrift = validatePair(
  evidence("light", { statusColor: "rgb(21, 128, 61)", x: 0 }),
  evidence("dark", { statusColor: "rgb(22, 163, 74)", x: 4 })
);
check(ordinaryGeometryDrift.some((finding) => finding.code === "PERCEPTUAL_GEOMETRY_DRIFT"), "ordinary light/dark themes must retain the existing stable-geometry envelope");

const uncompensatedContrast = validatePair(
  evidence("light", { statusColor: "rgb(21, 128, 61)", primaryContrast: 6, bodyContrast: 6, occupancy: 0.7 }),
  evidence("dark", { statusColor: "rgb(22, 163, 74)", primaryContrast: 10, bodyContrast: 10, occupancy: 0.7, x: 4 })
);
check(uncompensatedContrast.some((finding) => finding.code === "PERCEPTUAL_CONTRAST_DENSITY_NOT_COMPENSATED"), "materially higher contrast load must not keep equal-or-higher density");
check(!uncompensatedContrast.some((finding) => finding.code === "PERCEPTUAL_DENSITY_OVERRIDE_EXCESS"), "contrast-driven density may use the bounded geometry override instead of being rejected by ordinary 2px stability");

const compensatedContrast = validatePair(
  evidence("light", { statusColor: "rgb(21, 128, 61)", primaryContrast: 6, bodyContrast: 6, occupancy: 0.7 }),
  evidence("dark", { statusColor: "rgb(22, 163, 74)", primaryContrast: 10, bodyContrast: 10, occupancy: 0.68, x: 4 })
);
check(!compensatedContrast.some((finding) => finding.code === "PERCEPTUAL_CONTRAST_DENSITY_NOT_COMPENSATED"), "higher contrast with bounded additional separation must pass");

console.log(`Perceptual calibration regression suite passed (${assertions} assertions).`);
