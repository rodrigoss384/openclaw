#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { IssueCollector, parseCliArgs, resolveFromCwd } from "./lib/screen-contract-utils.mjs";

const collector = new IssueCollector();

function selectorPreludes(css) {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const preludes = [];
  let buffer = "";
  for (const character of source) {
    if (character === "{") {
      const candidate = buffer.slice(buffer.lastIndexOf(";") + 1).trim();
      if (candidate && !candidate.startsWith("@")) preludes.push(candidate);
      buffer = "";
      continue;
    }
    if (character === "}") {
      buffer = "";
      continue;
    }
    buffer += character;
  }
  return preludes;
}

function classTokens(selector) {
  return [...selector.matchAll(/\.[_a-zA-Z][_a-zA-Z0-9-]*/g)].map((match) => match[0]);
}

const ignoredDirectories = new Set([
  ".git",
  ".next",
  ".nuxt",
  ".output",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "public",
  "vendor"
]);

const stylesheetExtensions = new Set([".css", ".less", ".sass", ".scss"]);

function isModuleStylesheet(filePath) {
  return /\.module\.(css|less|sass|scss)$/i.test(filePath);
}

async function discoverNonModuleStylesheets(root) {
  const discovered = [];

  async function visit(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name)) await visit(absolute);
        continue;
      }
      if (!entry.isFile() || !stylesheetExtensions.has(path.extname(entry.name).toLowerCase())) continue;
      if (!isModuleStylesheet(entry.name)) discovered.push(absolute);
    }
  }

  await visit(root);
  return discovered;
}

function normalizedRelative(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

function hasApprovedException(contract, relativePath) {
  return (contract.exceptions || []).some(
    (item) => item.status === "approved" && (item.scope === relativePath || item.scope.includes(relativePath))
  );
}

try {
  const options = parseCliArgs(process.argv.slice(2));
  const contractArgument = options.positional[0];
  if (!contractArgument) throw new Error("Provide the styling-authority JSON path as the first positional argument.");
  const projectRoot = options.positional[1] ? resolveFromCwd(options.positional[1]) : process.cwd();
  const contractPath = resolveFromCwd(contractArgument);
  const contract = JSON.parse(await fs.readFile(contractPath, "utf8"));
  const registeredStylesheets = new Set(
    (contract.authority?.globalStylesheets || []).map((item) => path.resolve(projectRoot, item.path))
  );

  if (contract.authority?.primaryMechanism !== "global-css-legacy") {
    for (const filePath of await discoverNonModuleStylesheets(projectRoot)) {
      if (registeredStylesheets.has(filePath)) continue;
      const relativePath = normalizedRelative(projectRoot, filePath);
      if (hasApprovedException(contract, relativePath)) continue;
      const css = await fs.readFile(filePath, "utf8");
      if (selectorPreludes(css).length === 0) continue;
      collector.error(
        "UNREGISTERED_GLOBAL_STYLESHEET",
        "A non-module stylesheet with global rules is not registered by the styling authority. Register its bounded responsibility, convert it to the canonical local mechanism, or remove it.",
        relativePath
      );
    }
  }

  for (const stylesheet of contract.authority?.globalStylesheets || []) {
    const filePath = path.resolve(projectRoot, stylesheet.path);
    let css;
    try {
      css = await fs.readFile(filePath, "utf8");
    } catch (error) {
      collector.error("GLOBAL_STYLESHEET_UNREADABLE", error.message, stylesheet.path);
      continue;
    }

    if (stylesheet.componentSelectors !== "forbidden") {
      collector.info("GLOBAL_SELECTOR_SCAN_DELEGATED", "Selector ownership is governed by the declared legacy authority or approved exception.", stylesheet.path);
      continue;
    }

    const allowed = new Set(stylesheet.allowedSelectors || []);
    for (const selector of selectorPreludes(css)) {
      for (const token of classTokens(selector)) {
        if (allowed.has(token) || allowed.has(selector.trim())) continue;
        collector.error(
          "UNAUTHORIZED_GLOBAL_CLASS_SELECTOR",
          `Global selector '${selector}' contains unauthorized class '${token}'. Move it to the canonical owner or record an approved exception.`,
          stylesheet.path
        );
      }
    }
  }

  if (!collector.hasErrors()) collector.info("GLOBAL_STYLESHEETS_CONFORM", "Registered global stylesheets conform to the declared selector boundary.", contractPath);

  // WF-SOS-004: when policies forbid arbitrary/raw/inline in feature code, scan feature sources
  // (not just the authority JSON) so validators cannot green-wash restricted policies.
  const policies = contract.policies || {};
  const scanFeatureCode =
    policies.arbitraryUtilityValues === "forbidden-unless-approved-exception" ||
    policies.rawValuesInFeatureCode === "forbidden-unless-approved-exception" ||
    policies.inlineStyles === "runtime-only-with-rationale" ||
    policies.inlineStyles === "forbidden-unless-approved-exception";

  if (scanFeatureCode) {
    const featureFiles = await discoverFeatureSources(projectRoot);
    for (const filePath of featureFiles) {
      const relativePath = normalizedRelative(projectRoot, filePath);
      if (hasApprovedException(contract, relativePath)) continue;
      const source = await fs.readFile(filePath, "utf8");

      if (
        policies.arbitraryUtilityValues === "forbidden-unless-approved-exception" &&
        /(?:^|[\s"'`])[a-zA-Z][\w-:]*\[[^\]]+\]/.test(source)
      ) {
        collector.error(
          "FEATURE_ARBITRARY_UTILITY",
          "Feature source uses Tailwind arbitrary values while policies.arbitraryUtilityValues forbids them without an approved exception.",
          relativePath
        );
      }

      if (
        (policies.inlineStyles === "runtime-only-with-rationale" ||
          policies.inlineStyles === "forbidden-unless-approved-exception") &&
        /style=\{\{/.test(source)
      ) {
        collector.error(
          "FEATURE_INLINE_STYLE",
          "Feature source uses static inline style objects while inlineStyles policy requires runtime-only rationale or an approved exception.",
          relativePath
        );
      }
    }
  }

  collector.print("Frontend Styling Authority Audit", { json: options.json });
  process.exitCode = collector.shouldFail(options.strictWarnings) ? 1 : 0;
} catch (error) {
  collector.error("AUDIT_FAILED", error.message);
  collector.print("Frontend Styling Authority Audit");
  process.exitCode = 1;
}

async function discoverFeatureSources(root) {
  const discovered = [];
  const extensions = new Set([".tsx", ".jsx", ".vue", ".svelte", ".css"]);

  async function visit(directory) {
    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name)) await visit(absolute);
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!extensions.has(ext)) continue;
      if (isModuleStylesheet(entry.name)) continue;
      const relative = normalizedRelative(root, absolute);
      if (
        relative.includes("/features/") ||
        relative.includes("/screens/") ||
        relative.includes("/pages/") ||
        /(^|\/)src\/routes\//.test(relative)
      ) {
        discovered.push(absolute);
      }
    }
  }

  await visit(root);
  return discovered;
}
