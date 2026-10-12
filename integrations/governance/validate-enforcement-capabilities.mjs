#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateJsonSchema } from "../../skills/spec-driven-engineering/scripts/lib/json-schema.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "../..");

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
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

function resolveRepositoryFile(root, ref, label, errors) {
  if (!ref || typeof ref !== "string") return null;
  if (path.isAbsolute(ref)) {
    errors.push(`${label}: entrypoint must be repository-relative, got '${ref}'.`);
    return null;
  }
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(root, ref);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    errors.push(`${label}: entrypoint escapes project root: '${ref}'.`);
    return null;
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    errors.push(`${label}: entrypoint does not exist as a file: '${ref}'.`);
    return null;
  }
  if (path.basename(ref).startsWith("test-")) {
    errors.push(`${label}: regression test files cannot be registered as production capabilities: '${ref}'.`);
  }
  return resolved;
}

function validateSemantics(registry, policy, root) {
  const errors = [];
  const authorityIds = new Set((policy.authorities || []).map((item) => item.id));
  const capabilityIds = new Set();

  for (const capability of registry.capabilities || []) {
    const label = capability.id || "<capability-without-id>";
    if (capabilityIds.has(capability.id)) errors.push(`Duplicate capability id '${capability.id}'.`);
    capabilityIds.add(capability.id);

    if (!authorityIds.has(capability.owner)) {
      errors.push(`${label}: unknown owner authority '${capability.owner}'.`);
    }

    resolveRepositoryFile(root, capability.entrypoint, `${label}.entrypoint`, errors);

    const inputIds = new Set();
    for (const input of capability.inputContracts || []) {
      if (inputIds.has(input.id)) errors.push(`${label}: duplicate input contract id '${input.id}'.`);
      inputIds.add(input.id);
    }

    if (capability.kind === "schema") {
      if (capability.invocation?.mode !== "schema") errors.push(`${label}: schema capability must use invocation.mode=schema.`);
      if (capability.invocation?.command) errors.push(`${label}: schema capability must not declare a CLI command.`);
      if (capability.failureSemantics?.mode !== "schema-rejection") errors.push(`${label}: schema capability must use failureSemantics.mode=schema-rejection.`);
      if (!capability.entrypoint?.endsWith(".schema.json")) errors.push(`${label}: schema capability entrypoint must end in .schema.json.`);
    } else {
      if (capability.invocation?.mode !== "cli") errors.push(`${label}: ${capability.kind} capability must use invocation.mode=cli.`);
      if (!capability.invocation?.command) errors.push(`${label}: CLI capability requires invocation.command.`);
      if (!Array.isArray(capability.invocation?.argv) || capability.invocation.argv.join(" ") !== capability.invocation.command) errors.push(`${label}: invocation.argv must be tokenized and match its command projection.`);
      if (capability.invocation?.command && !capability.invocation.command.includes(capability.entrypoint)) {
        errors.push(`${label}: invocation.command must invoke its registered entrypoint '${capability.entrypoint}'.`);
      }
      if (capability.failureSemantics?.mode !== "nonzero-exit") errors.push(`${label}: CLI capability must use failureSemantics.mode=nonzero-exit.`);
      // An alternation placeholder such as <profile|compile|decide|gate|verify>
      // makes the caller choose how strictly the capability checks itself.
      // `enforce` substitutes whatever the agent passes via --set and then
      // reports "passed", so the weakest subcommand satisfies a blocking rule.
      // A placeholder is an input; the subcommand is policy and must be pinned.
      for (const alternation of capability.invocation?.command?.match(/<[^>]*\|[^>]*>/g) || []) {
        errors.push(`${label}: invocation.command offers a caller-selected alternative '${alternation}'. Pin the subcommand that decides (the one exiting non-zero on a real defect); a placeholder may only stand for an input value.`);
      }
    }
  }

  return errors;
}

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(String(args.root || DEFAULT_ROOT));
const registryPath = path.resolve(root, String(args.registry || "integrations/governance/enforcement-capabilities.json"));
const schemaPath = path.resolve(root, String(args.schema || "integrations/governance/enforcement-capabilities.schema.json"));
const policyPath = path.resolve(root, String(args.policy || "prompts/spec-driven/governance-policy.json"));

let registry;
let schema;
let policy;
try {
  registry = readJson(registryPath);
  schema = readJson(schemaPath);
  policy = readJson(policyPath);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const schemaErrors = validateJsonSchema(registry, schema).map((error) => `schema: ${error}`);
const semanticErrors = validateSemantics(registry, policy, root);
const errors = [...schemaErrors, ...semanticErrors];

if (errors.length) {
  console.error("Enforcement capability registry validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const counts = (registry.capabilities || []).reduce((accumulator, capability) => {
  accumulator[capability.kind] = (accumulator[capability.kind] || 0) + 1;
  return accumulator;
}, {});

console.log(`Enforcement capability registry valid: ${registry.capabilities.length} capabilities.`);
console.log(`Kinds: ${Object.entries(counts).map(([kind, count]) => `${kind}=${count}`).join(", ")}`);
