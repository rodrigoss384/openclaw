#!/usr/bin/env node
import crypto from "node:crypto";
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

function gitBlobSha(filePath) {
  const content = fs.readFileSync(filePath);
  const header = Buffer.from(`blob ${content.length}\0`, "utf8");
  return crypto.createHash("sha1").update(header).update(content).digest("hex");
}

function slugHeading(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[`*_~]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function markdownAnchors(filePath) {
  const anchors = new Set();
  const h2 = new Set();
  const counts = new Map();
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (!match) continue;
    const base = slugHeading(match[2]);
    if (!base) continue;
    const count = counts.get(base) || 0;
    const anchor = count === 0 ? base : `${base}-${count}`;
    counts.set(base, count + 1);
    anchors.add(anchor);
    if (match[1].length === 2) h2.add(anchor);
  }
  return { anchors, h2 };
}

function resolveRepositoryRef(root, ref, label, errors) {
  if (!ref || typeof ref !== "string") return null;
  if (path.isAbsolute(ref)) {
    errors.push(`${label}: repository ref must be relative, got '${ref}'.`);
    return null;
  }
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(root, ref);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    errors.push(`${label}: repository ref escapes project root: '${ref}'.`);
    return null;
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    errors.push(`${label}: resolver ref does not exist as a file: '${ref}'.`);
    return null;
  }
  if (path.basename(ref).startsWith("test-")) {
    errors.push(`${label}: regression test files cannot be registered as production resolvers: '${ref}'.`);
  }
  return resolved;
}

function loadCapabilities(policy, root, errors) {
  const registryRef = policy.capabilityRegistry;
  if (!registryRef || typeof registryRef !== "string") return new Map();
  const registryPath = path.resolve(root, registryRef);
  if (!fs.existsSync(registryPath)) {
    errors.push(`capabilityRegistry not found: ${registryRef}`);
    return new Map();
  }

  let registry;
  try {
    registry = readJson(registryPath);
  } catch (error) {
    errors.push(error.message);
    return new Map();
  }

  const registrySchemaPath = path.resolve(path.dirname(registryPath), String(registry.$schema || ""));
  if (!fs.existsSync(registrySchemaPath)) {
    errors.push(`capabilityRegistry schema not found: ${registrySchemaPath}`);
  } else {
    for (const error of validateJsonSchema(registry, readJson(registrySchemaPath))) {
      errors.push(`capabilityRegistry schema: ${error}`);
    }
  }

  const byId = new Map();
  for (const capability of registry.capabilities || []) {
    if (byId.has(capability.id)) errors.push(`Duplicate capability id '${capability.id}'.`);
    byId.set(capability.id, capability);
  }
  return byId;
}

function validateAdmissionBoundary(policy, rulesFile, registeredRuleIds, errors) {
  const boundary = policy.admissionBoundary;
  if (!boundary || !fs.existsSync(rulesFile)) return;

  if (boundary.mode !== "registry-first") errors.push("admissionBoundary.mode must be registry-first.");
  if (boundary.legacyBaseline?.operational !== true) errors.push("admissionBoundary legacy baseline must remain operational during progressive migration.");
  if (boundary.unregisteredAdditions !== "non-operative") errors.push("Unregistered rules.md additions must be non-operative.");
  if (boundary.rationaleOnlyOperational !== false) errors.push("rationale-only admissions cannot become operational governance.");

  const admissions = Array.isArray(boundary.admissions) ? boundary.admissions : [];
  if (admissions.length === 0) {
    errors.push("admissionBoundary requires at least the frozen legacy-baseline admission.");
    return;
  }

  const admissionIds = new Set();
  const admittedHashes = new Set();
  let legacyCount = 0;

  for (let index = 0; index < admissions.length; index += 1) {
    const admission = admissions[index];
    const label = admission.id || `<admission-${index}>`;
    if (admissionIds.has(admission.id)) errors.push(`Duplicate admission id '${admission.id}'.`);
    admissionIds.add(admission.id);
    if (admittedHashes.has(admission.rulesFileGitBlobSha)) {
      errors.push(`${label}: rulesFileGitBlobSha was already admitted; every admitted revision must have a unique Git blob SHA.`);
    }
    admittedHashes.add(admission.rulesFileGitBlobSha);

    if (admission.kind === "legacy-baseline") {
      legacyCount += 1;
      if (index !== 0) errors.push(`${label}: legacy-baseline must be the first admission.`);
      if ((admission.ruleIds || []).length !== 0) errors.push(`${label}: legacy-baseline must not claim registry rule IDs.`);
    } else if (admission.kind === "registered-governance") {
      if (!Array.isArray(admission.ruleIds) || admission.ruleIds.length === 0) {
        errors.push(`${label}: registered-governance admission requires at least one registered rule id.`);
      }
    } else if (admission.kind === "rationale-only") {
      if ((admission.ruleIds || []).length !== 0) {
        errors.push(`${label}: rationale-only admission cannot claim operational rule ids.`);
      }
    }

    for (const ruleId of admission.ruleIds || []) {
      if (!registeredRuleIds.has(ruleId)) errors.push(`${label}: admission references unknown registry rule '${ruleId}'.`);
    }
  }

  if (legacyCount !== 1) errors.push(`admissionBoundary must contain exactly one legacy-baseline admission, found ${legacyCount}.`);
  const first = admissions[0];
  if (first?.rulesFileGitBlobSha !== boundary.legacyBaseline?.rulesFileGitBlobSha) {
    errors.push("admissionBoundary.legacyBaseline.rulesFileGitBlobSha must match the first legacy-baseline admission.");
  }

  const currentHash = gitBlobSha(rulesFile);
  const latest = admissions.at(-1);
  if (latest?.rulesFileGitBlobSha !== currentHash) {
    errors.push(`rules.md revision is not admitted: current Git blob SHA ${currentHash}, latest admitted ${latest?.rulesFileGitBlobSha || "<none>"}. Add an explicit registered-governance or rationale-only admission before this revision can become operational.`);
  }
}

function validateSemantics(policy, root) {
  const errors = [];
  const authorityIds = new Set();
  for (const authority of policy.authorities || []) {
    if (authorityIds.has(authority.id)) errors.push(`Duplicate authority id '${authority.id}'.`);
    authorityIds.add(authority.id);
  }

  const capabilities = loadCapabilities(policy, root, errors);
  const rulesFile = path.resolve(root, policy.rulesFile || "rules.md");
  if (!fs.existsSync(rulesFile)) errors.push(`rulesFile not found: ${policy.rulesFile}`);
  const headingIndex = fs.existsSync(rulesFile) ? markdownAnchors(rulesFile) : { anchors: new Set(), h2: new Set() };
  const anchors = headingIndex.anchors;
  const ruleIds = new Set();

  for (const rule of policy.rules || []) {
    const label = rule.id || "<rule-without-id>";
    if (ruleIds.has(rule.id)) errors.push(`Duplicate rule id '${rule.id}'.`);
    ruleIds.add(rule.id);

    if (!authorityIds.has(rule.authority)) errors.push(`${label}: unknown authority '${rule.authority}'.`);

    const applicability = rule.applicability || {};
    const selectors = ["frontend", "backend", "behavioralUx"].filter((key) => Array.isArray(applicability[key]) && applicability[key].length > 0);
    if (applicability.mode === "always" && selectors.length > 0) {
      errors.push(`${label}: applicability.mode=always must not declare conditional selectors (${selectors.join(", ")}).`);
    }
    if (applicability.mode === "conditional" && selectors.length === 0) {
      errors.push(`${label}: applicability.mode=conditional requires at least one structured selector.`);
    }

    if (rule.resolver) resolveRepositoryRef(root, rule.resolver.ref, `${label}.resolver`, errors);

    if (rule.enforcement?.capability) {
      const capability = capabilities.get(rule.enforcement.capability);
      if (!capability) {
        errors.push(`${label}: unknown enforcement capability '${rule.enforcement.capability}'.`);
      } else {
        if (capability.owner !== rule.authority) {
          errors.push(`${label}: capability '${capability.id}' is owned by '${capability.owner}', not rule authority '${rule.authority}'.`);
        }
        for (const stage of rule.stageScopes || []) {
          const supported = capability.supportedStages?.includes("every-stage") || capability.supportedStages?.includes(stage);
          if (!supported) errors.push(`${label}: capability '${capability.id}' does not support stage '${stage}'.`);
        }
        if (rule.kind === "hard-invariant" && capability.failureSemantics?.blocking !== true) {
          errors.push(`${label}: hard-invariant capability '${capability.id}' must have blocking failure semantics.`);
        }
      }
    }

    if (rule.kind === "hard-invariant") {
      if (!rule.enforcement) errors.push(`${label}: hard-invariant requires enforcement.`);
      if (rule.resolver) errors.push(`${label}: hard-invariant must not masquerade as a deterministic resolver.`);
      if (rule.escalation) errors.push(`${label}: hard-invariant must not use consequential escalation as its enforcement.`);
      if (rule.failure?.severity !== "blocking") errors.push(`${label}: hard-invariant failure severity must be blocking.`);
      if (rule.failure?.route === "NONE") errors.push(`${label}: hard-invariant failure route cannot be NONE.`);
    } else if (rule.kind === "deterministic-default") {
      if (!rule.resolver) errors.push(`${label}: deterministic-default requires a resolver.`);
      if (rule.escalation) errors.push(`${label}: deterministic-default must not declare human escalation.`);
    } else if (rule.kind === "contextual-heuristic") {
      if (rule.failure?.severity !== "advisory" || rule.failure?.route !== "NONE") {
        errors.push(`${label}: contextual-heuristic may advise but cannot independently block or route execution.`);
      }
      if (rule.escalation) errors.push(`${label}: contextual-heuristic cannot independently require human escalation.`);
    } else if (rule.kind === "consequential-decision") {
      if (!rule.escalation || rule.escalation.humanRequired !== true) {
        errors.push(`${label}: consequential-decision requires explicit human escalation.`);
      }
      if (rule.resolver) errors.push(`${label}: consequential-decision cannot be silently resolved by an autonomous resolver.`);
    }

    if (typeof rule.rulesReference === "string") {
      const separator = rule.rulesReference.indexOf("#");
      const fileRef = separator >= 0 ? rule.rulesReference.slice(0, separator) : rule.rulesReference;
      const anchor = separator >= 0 ? rule.rulesReference.slice(separator + 1) : "";
      if (fileRef !== policy.rulesFile) {
        errors.push(`${label}: rulesReference must target canonical '${policy.rulesFile}', got '${fileRef}'.`);
      } else if (!anchor || !anchors.has(anchor)) {
        errors.push(`${label}: rulesReference anchor not found in ${policy.rulesFile}: '#${anchor}'.`);
      }
    }
  }

  if (fs.existsSync(rulesFile)) validateSectionInventory(policy, headingIndex.h2, errors);
  validateAdmissionBoundary(policy, rulesFile, ruleIds, errors);
  return errors;
}

function validateSectionInventory(policy, h2Anchors, errors) {
  const referenced = new Set();
  for (const rule of policy.rules || []) {
    if (typeof rule.rulesReference !== "string") continue;
    const separator = rule.rulesReference.indexOf("#");
    const anchor = separator >= 0 ? rule.rulesReference.slice(separator + 1) : "";
    if (h2Anchors.has(anchor)) referenced.add(anchor);
  }

  const listed = new Set();
  if (!Array.isArray(policy.rationaleSections)) {
    errors.push("rationaleSections must list every rules.md h2 that is not a registered rule reference.");
    return;
  }
  for (const section of policy.rationaleSections) {
    const anchor = section?.anchor;
    if (listed.has(anchor)) errors.push(`Duplicate rationale section '#${anchor}'.`);
    listed.add(anchor);
    if (!h2Anchors.has(anchor)) errors.push(`rationaleSections anchor is not an h2 in rules.md: '#${anchor}'.`);
    if (referenced.has(anchor)) errors.push(`Section '#${anchor}' is both a registered rule reference and rationale.`);
  }
  for (const anchor of h2Anchors) {
    if (!referenced.has(anchor) && !listed.has(anchor)) {
      errors.push(`Silent rules.md section '#${anchor}' has no rulesReference and no rationaleSections entry.`);
    }
  }
}

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(String(args.root || DEFAULT_ROOT));
const policyPath = path.resolve(root, String(args.policy || "prompts/spec-driven/governance-policy.json"));
let policy;
try {
  policy = readJson(policyPath);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const schemaPath = args.schema
  ? path.resolve(root, String(args.schema))
  : path.resolve(path.dirname(policyPath), String(policy.$schema || ""));

if (!fs.existsSync(schemaPath)) {
  console.error(`Governance policy schema not found: ${schemaPath}`);
  process.exit(1);
}

const schemaErrors = validateJsonSchema(policy, readJson(schemaPath));
const semanticErrors = validateSemantics(policy, root);
const errors = [...schemaErrors.map((error) => `schema: ${error}`), ...semanticErrors];

if (errors.length) {
  console.error("Governance policy validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const counts = (policy.rules || []).reduce((accumulator, rule) => {
  accumulator[rule.kind] = (accumulator[rule.kind] || 0) + 1;
  return accumulator;
}, {});

console.log(`Governance policy valid: ${policy.rules.length} rules, ${policy.authorities.length} authorities.`);
console.log(`Kinds: ${Object.entries(counts).map(([kind, count]) => `${kind}=${count}`).join(", ")}`);
console.log(`Capability registry: ${policy.capabilityRegistry}`);
console.log(`Rules admission: ${policy.admissionBoundary.admissions.length} admitted revisions, latest=${policy.admissionBoundary.admissions.at(-1).kind}`);
