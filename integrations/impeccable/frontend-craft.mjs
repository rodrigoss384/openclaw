#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  enrichCraftSemanticSignatures,
  sanitizeCraftForPhase9Core,
  validateExtendedCraft
} from "./semantic-differentiation.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "../..");
const CORE = path.join(SCRIPT_DIR, "frontend-craft-core.mjs");
const CORE_SCHEMA = path.join(SCRIPT_DIR, "craft-contract-core.schema.json");
const EXTENDED_SCHEMA = path.join(SCRIPT_DIR, "craft-contract.schema.json");

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
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function safeSlug(value) {
  return String(value || "screen")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "screen";
}

function replaceOption(argv, name, value) {
  const result = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== `--${name}`) {
      result.push(argv[index]);
      continue;
    }
    if (argv[index + 1] && !argv[index + 1].startsWith("--")) index += 1;
  }
  result.push(`--${name}`, value);
  return result;
}

function runCore(argv) {
  return spawnSync(process.execPath, [CORE, ...argv], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function forward(result) {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) {
    process.stderr.write(`${result.error.message}\n`);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}

function symlinkEntry(source, target) {
  const stat = fs.statSync(source);
  fs.symlinkSync(source, target, stat.isDirectory() ? "dir" : "file");
}

function createCoreRoot(root) {
  const shadowRoot = fs.mkdtempSync(path.join(os.tmpdir(), "frontend-craft-phase10a-root-"));
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name === "integrations") continue;
    symlinkEntry(path.join(root, entry.name), path.join(shadowRoot, entry.name));
  }

  const shadowImpeccable = path.join(shadowRoot, "integrations", "impeccable");
  fs.mkdirSync(shadowImpeccable, { recursive: true });
  const sourceImpeccable = path.join(root, "integrations", "impeccable");
  if (fs.existsSync(sourceImpeccable)) {
    for (const entry of fs.readdirSync(sourceImpeccable, { withFileTypes: true })) {
      if (entry.name === "craft-contract.schema.json") continue;
      symlinkEntry(path.join(sourceImpeccable, entry.name), path.join(shadowImpeccable, entry.name));
    }
  }
  fs.copyFileSync(CORE_SCHEMA, path.join(shadowImpeccable, "craft-contract.schema.json"));
  return shadowRoot;
}

function resolveOutputPath(root, args, policy) {
  if (args.output) return path.resolve(String(args.output));
  const screenPath = path.resolve(root, String(args["screen-spec"]));
  const screen = readJson(screenPath);
  const screenId = screen?.screen?.id;
  if (!screenId) throw new Error("Screen specification must declare screen.id.");
  return path.resolve(path.join(os.tmpdir(), "spec-driven-impeccable", "craft-contracts", safeSlug(screenId), policy.craftContract.artifact));
}

const argv = process.argv.slice(2);
const args = parseArgs(argv);
const command = args._[0] || "help";
const root = path.resolve(String(args.root || DEFAULT_ROOT));
const policyPath = path.resolve(String(args.policy || path.join(root, "prompts/spec-driven/frontend-craft-policy.json")));

if (!["derive-craft", "verify-craft"].includes(command)) forward(runCore(argv));

const policy = readJson(policyPath);
const coreRoot = createCoreRoot(root);
try {
  if (command === "derive-craft") {
    if (!args["screen-spec"]) throw new Error("derive-craft requires --screen-spec <path>");
    const outputPath = resolveOutputPath(root, args, policy);
    let coreArgs = replaceOption(argv, "root", coreRoot);
    coreArgs = replaceOption(coreArgs, "output", outputPath);
    const result = runCore(coreArgs);
    if (result.status !== 0) forward(result);

    const craft = readJson(outputPath);
    const enriched = enrichCraftSemanticSignatures({ root, craft });
    if (enriched.errors.length) throw new Error(`Semantic differentiation contract is invalid:\n- ${enriched.errors.join("\n- ")}`);
    enriched.craft.$schema = "craft-contract.schema.json";
    enriched.craft.schemaVersion = "1.3.0";
    const errors = validateExtendedCraft({ root, craft: enriched.craft, schemaPath: EXTENDED_SCHEMA });
    if (errors.length) throw new Error(`Derived Phase 10A craft contract is invalid:\n- ${errors.join("\n- ")}`);
    writeJson(outputPath, enriched.craft);
    process.stdout.write(`Craft contract derived: ${outputPath}\n`);
    process.stdout.write(`visualFamilyId=${enriched.craft.visualFamilyId}\n`);
    process.stdout.write(`contractSetSha256=${enriched.craft.contractSetSha256}\n`);
    process.stdout.write(`unresolved=${enriched.craft.unresolved.join(",") || "none"}\n`);
    process.exit(0);
  }

  if (!args["craft-contract"]) throw new Error("verify-craft requires --craft-contract <path>");
  const craftPath = path.resolve(root, String(args["craft-contract"]));
  if (!fs.existsSync(craftPath)) throw new Error(`Craft contract not found: ${craftPath}`);
  const craft = readJson(craftPath);
  const errors = validateExtendedCraft({ root, craft, schemaPath: EXTENDED_SCHEMA });
  if (errors.length) throw new Error(`Invalid Phase 10A craft contract:\n- ${errors.join("\n- ")}`);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "frontend-craft-phase10a-verify-"));
  try {
    const sanitizedPath = path.join(tempDir, "craft-contract-core.json");
    const sanitized = sanitizeCraftForPhase9Core(craft);
    sanitized.$schema = "craft-contract.schema.json";
    writeJson(sanitizedPath, sanitized);
    let coreArgs = replaceOption(argv, "root", coreRoot);
    coreArgs = replaceOption(coreArgs, "craft-contract", sanitizedPath);
    const result = runCore(coreArgs);
    if (result.status !== 0) forward(result);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  process.stdout.write(`Craft contract verified: ${craftPath}\n`);
  process.stdout.write(`visualFamilyId=${craft.visualFamilyId}\n`);
  process.stdout.write(`contractSetSha256=${craft.contractSetSha256}\n`);
  process.stdout.write(`unresolved=${craft.unresolved.join(",") || "none"}\n`);
  process.exit(0);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
} finally {
  fs.rmSync(coreRoot, { recursive: true, force: true });
}
