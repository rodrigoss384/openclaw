#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const CORE = path.join(SCRIPT_DIR, "audit-theme-operational-evidence-core.mjs");

// This is the only auditor that reaches outside the skill, into
// integrations/impeccable and integrations/frontend. A fixed "../../.." breaks
// at the documented install root ($HOME/.agents/skills/frontend-product-builder),
// where no integrations/ tree exists, and the failure is a bare
// ERR_MODULE_NOT_FOUND that silently removes the perceptual, passive-control,
// semantic-differentiation and product-semantics checks. Resolve the tree
// instead of assuming its depth.
const INTEGRATIONS_PROBE = path.join(
  "integrations",
  "impeccable",
  "semantic-differentiation.mjs"
);

function resolveIntegrationsRoot() {
  const candidates = [];

  if (process.env.AGENTS_INTEGRATIONS_ROOT) {
    candidates.push(path.resolve(process.env.AGENTS_INTEGRATIONS_ROOT));
  }

  for (let directory = SCRIPT_DIR; ; ) {
    candidates.push(directory);
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }

  for (let directory = path.resolve(process.cwd()); ; ) {
    candidates.push(directory);
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, INTEGRATIONS_PROBE))) {
      return candidate;
    }
  }

  return null;
}

const INTEGRATIONS_ROOT = resolveIntegrationsRoot();

if (!INTEGRATIONS_ROOT) {
  process.stderr.write(
    "[THEME_EVIDENCE_INTEGRATIONS_UNRESOLVED] Cannot locate the integrations/ tree " +
    "required by this auditor (integrations/impeccable, integrations/frontend). Run it " +
    "from a project or control-plane root that carries integrations/, or set " +
    "AGENTS_INTEGRATIONS_ROOT to that root.\n"
  );
  process.exit(1);
}

async function loadIntegration(relativePath) {
  const target = path.join(INTEGRATIONS_ROOT, "integrations", relativePath);
  if (!fs.existsSync(target)) {
    process.stderr.write(
      `[THEME_EVIDENCE_INTEGRATIONS_INCOMPLETE] Missing integrations module: ${target}\n`
    );
    process.exit(1);
  }
  return import(pathToFileURL(target).href);
}

const { validateOperationalSemanticEvidence } =
  await loadIntegration("impeccable/semantic-differentiation.mjs");
const { validatePassiveDataAsControl } =
  await loadIntegration("impeccable/passive-data-control.mjs");
const { validatePerceptualThemeEvidence } =
  await loadIntegration("impeccable/perceptual-calibration.mjs");
const { validateProductSemanticsEvidence } =
  await loadIntegration("frontend/product-semantics-evidence.mjs");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8"));
}

function relativeRepoPath(root, filePath) {
  return path.relative(root, path.resolve(filePath)).replaceAll("\\", "/");
}

const argv = process.argv.slice(2);
const core = spawnSync(process.execPath, [CORE, ...argv], {
  cwd: process.cwd(),
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"]
});
if (core.stdout) process.stdout.write(core.stdout);
if (core.stderr) process.stderr.write(core.stderr);
if (core.error) {
  process.stderr.write(`${core.error.message}\n`);
  process.exit(1);
}
if (core.status !== 0) process.exit(core.status ?? 1);

const positional = argv.filter((token) => !token.startsWith("--"));
if (positional.length < 4) process.exit(0);
const [screenPath, designPath, craftPath, evidencePath] = positional;
const screen = readJson(screenPath);
const designSystem = readJson(designPath);
const craft = readJson(craftPath);
const evidence = readJson(evidencePath);

const perceptualErrors = validatePerceptualThemeEvidence(designSystem, evidence);
if (perceptualErrors.length) {
  for (const error of perceptualErrors) process.stderr.write(`[${error.code}] ${error.message}\n`);
  process.exit(1);
}

const passiveControlErrors = validatePassiveDataAsControl(screen, evidence);
if (passiveControlErrors.length) {
  for (const error of passiveControlErrors) process.stderr.write(`[${error.code}] ${error.message}\n`);
  process.exit(1);
}

const semanticErrors = validateOperationalSemanticEvidence(designSystem, craft, evidence);
if (semanticErrors.length) {
  for (const error of semanticErrors) process.stderr.write(`[${error.code}] ${error.message}\n`);
  process.exit(1);
}

const root = process.cwd();
const productSemanticsErrors = validateProductSemanticsEvidence({
  root,
  screenRef: relativeRepoPath(root, screenPath),
  screen,
  designSystem,
  craft,
  evidence
});
if (productSemanticsErrors.length) {
  for (const error of productSemanticsErrors) process.stderr.write(`[${error.code}] ${error.message}\n`);
  process.exit(1);
}
process.exit(0);
