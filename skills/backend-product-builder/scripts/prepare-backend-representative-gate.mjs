#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "./lib/backend-package.mjs";

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(String(args.root || process.cwd()));
const feature = String(args.feature || "").trim();
if (!feature) {
  console.error("Usage: prepare-backend-representative-gate.mjs --root PROJECT_ROOT --feature FEATURE_SLUG");
  process.exit(1);
}
if (!/^[a-z0-9][a-z0-9._-]*$/.test(feature)) {
  console.error("FEATURE_SLUG must be a lowercase repository-safe slug containing only a-z, 0-9, dot, underscore, or hyphen.");
  process.exit(1);
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const assets = path.resolve(scriptDirectory, "../assets");
const outputRelative = path.posix.join("docs/backend", feature);
const outputDirectory = path.join(root, ...outputRelative.split("/"));
const files = [
  ["backend-change-manifest.template.json", "backend-change-manifest.json"],
  ["backend-interface-scenario-matrix.template.md", "backend-interface-scenario-matrix.md"],
  ["backend-readiness.template.md", "backend-readiness.md"],
  ["backend-representative-scorecard.template.json", "backend-representative-scorecard.json"]
];
const schemas = ["backend-change-manifest.schema.json", "backend-representative-scorecard.schema.json", "backend-validator-evidence.schema.json"];
const conflicts = [
  ...files.map(([, output]) => path.join(outputDirectory, output)),
  ...schemas.map((schema) => path.join(outputDirectory, schema))
].filter((file) => fs.existsSync(file));
if (conflicts.length) {
  console.error(`Refusing to overwrite existing backend artifacts:\n${conflicts.join("\n")}`);
  process.exit(1);
}

fs.mkdirSync(outputDirectory, { recursive: true });
for (const [template, output] of files) {
  const content = fs.readFileSync(path.join(assets, template), "utf8")
    .replaceAll("FEATURE_SLUG", feature)
    .replaceAll("docs/backend", outputRelative);
  fs.writeFileSync(path.join(outputDirectory, output), content);
  console.log(`Created ${path.relative(root, path.join(outputDirectory, output))}`);
}
for (const schema of schemas) {
  fs.copyFileSync(path.join(assets, schema), path.join(outputDirectory, schema));
  console.log(`Created ${path.relative(root, path.join(outputDirectory, schema))}`);
}
