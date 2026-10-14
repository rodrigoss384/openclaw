#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { ensureDirectory, parseArgs, timestamp } from "./lib/workflow-utils.mjs";

const args = parseArgs(process.argv.slice(2));
const featureDirectory = path.resolve(String(args["feature-dir"] || args._[0] || ""));
const apply = Boolean(args.apply);
const legacyFiles = ["context.md", "requirements.md", "spec.md", "design.md", "tasks.md"];
const targets = ["00-intent.md", "01-spec.md", "02-assumptions.md", "03-acceptance-criteria.md", "07-design.md", "09-tasks.md"];

if (!featureDirectory || !fs.existsSync(featureDirectory)) {
  console.error(`Feature directory not found: ${featureDirectory || "<empty>"}`);
  process.exit(1);
}
const presentLegacy = legacyFiles.filter((file) => fs.existsSync(path.join(featureDirectory, file)));
if (presentLegacy.length === 0) {
  console.error("No legacy v1 artifacts were found.");
  process.exit(1);
}
const conflicts = targets.filter((file) => fs.existsSync(path.join(featureDirectory, file)));
if (conflicts.length > 0) {
  console.error(`Refusing migration because numbered targets exist: ${conflicts.join(", ")}`);
  process.exit(1);
}

function source(file) {
  const filePath = path.join(featureDirectory, file);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8").trim() : "";
}

const notice = (files) => [
  `> Migrado estruturalmente de: ${files.join(", ")}.`,
  "> Preserve IDs legados. Revise semanticamente este conteúdo com o prompt migrate-v1 antes de aprovar o gate.",
  ""
].join("\n");

const outputs = new Map();
if (source("context.md")) {
  outputs.set("00-intent.md", `${notice(["context.md"])}# Intenção migrada\n\n${source("context.md")}\n`);
  outputs.set("02-assumptions.md", `${notice(["context.md"])}# Suposições e ambiguidades migradas\n\n${source("context.md")}\n`);
}
const requirementsAndSpec = [
  source("requirements.md") ? `## Fonte: requirements.md\n\n${source("requirements.md")}` : "",
  source("spec.md") ? `## Fonte: spec.md\n\n${source("spec.md")}` : ""
].filter(Boolean).join("\n\n");
if (requirementsAndSpec) {
  outputs.set("01-spec.md", `${notice(["requirements.md", "spec.md"].filter((file) => source(file)))}# Especificação migrada\n\n${requirementsAndSpec}\n`);
}
if (source("spec.md")) {
  outputs.set("03-acceptance-criteria.md", `${notice(["spec.md"])}# Critérios de aceitação a extrair\n\n${source("spec.md")}\n`);
}
if (source("design.md")) outputs.set("07-design.md", `${notice(["design.md"])}${source("design.md")}\n`);
if (source("tasks.md")) outputs.set("09-tasks.md", `${notice(["tasks.md"])}${source("tasks.md")}\n`);

console.log(`Mode: ${apply ? "APPLY" : "DRY-RUN"}`);
console.log(`Feature: ${featureDirectory}`);
console.log(`Legacy inputs: ${presentLegacy.join(", ")}`);
console.log(`Planned outputs: ${[...outputs.keys()].join(", ")}`);
if (!apply) {
  console.log("No files changed. Re-run with --apply after reviewing this plan.");
  process.exit(0);
}

let specsRoot = featureDirectory;
while (path.basename(specsRoot) !== ".specs" && path.dirname(specsRoot) !== specsRoot) {
  specsRoot = path.dirname(specsRoot);
}
if (path.basename(specsRoot) !== ".specs") specsRoot = path.join(path.dirname(featureDirectory), ".specs");
const backupDirectory = path.join(specsRoot, "migrations", `${path.basename(featureDirectory)}-${timestamp()}`);
ensureDirectory(path.dirname(backupDirectory));
fs.cpSync(featureDirectory, backupDirectory, { recursive: true, errorOnExist: true });
for (const [file, content] of outputs) fs.writeFileSync(path.join(featureDirectory, file), content);
console.log(`Backup created: ${backupDirectory}`);
console.log(`Migration scaffold created. Semantic review remains mandatory.`);
