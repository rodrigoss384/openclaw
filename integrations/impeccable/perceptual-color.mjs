export function parseColor(value) {
  const text = String(value || "").trim();
  let match = text.match(/^#([0-9a-f]{3})$/i);
  if (match) return match[1].split("").map((c) => parseInt(`${c}${c}`, 16));
  match = text.match(/^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/i);
  if (match) return [0, 2, 4].map((i) => parseInt(match[1].slice(i, i + 2), 16));
  match = text.match(/^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)/i);
  if (match) return match.slice(1, 4).map((v) => Math.max(0, Math.min(255, Number(v))));
  return null;
}

function linear(channel) {
  const value = Number(channel) / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function contrastRatio(left, right) {
  const luminance = (rgb) => {
    const [r, g, b] = rgb.map(linear);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const a = luminance(left);
  const b = luminance(right);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function oklab(rgb) {
  const [r, g, b] = rgb.map(linear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  };
}

export function colorDelta(left, right) {
  const a = oklab(left);
  const b = oklab(right);
  const dL = Math.abs(a.L - b.L);
  const dChromatic = Math.hypot(a.a - b.a, a.b - b.b);
  return { dL, dChromatic, distance: Math.hypot(dL, dChromatic) };
}

export function sameRgb(left, right) {
  return Boolean(left && right && left.length === right.length && left.every((v, i) => Math.abs(v - right[i]) < 0.5));
}

function nodeAt(design, tokenPath) {
  let current = design;
  for (const part of String(tokenPath).split(".")) {
    if (!current || typeof current !== "object" || !(part in current)) return null;
    current = current[part];
  }
  return current;
}

export function tokenColor(design, tokenPath, themeId, seen = new Set()) {
  if (seen.has(tokenPath)) return null;
  seen.add(tokenPath);
  const node = nodeAt(design, tokenPath);
  if (!node || typeof node !== "object") return null;
  let raw = node.values && typeof node.values === "object" ? node.values[themeId] : node.value;
  if (raw == null && node.value != null) raw = node.value;
  if (typeof raw !== "string") return null;
  const reference = raw.match(/^\{([^}]+)\}$/);
  return reference ? tokenColor(design, `tokens.${reference[1]}`, themeId, seen) : parseColor(raw);
}

const SURFACE_TOKEN = {
  canvas: "tokens.semantic.background.canvas",
  surface: "tokens.semantic.background.surface",
  "surface-subtle": "tokens.semantic.background.surfaceSubtle",
  "surface-elevated": "tokens.semantic.background.surfaceElevated"
};

export function surfaceColor(design, role, themeId) {
  return SURFACE_TOKEN[role] ? tokenColor(design, SURFACE_TOKEN[role], themeId) : null;
}
