#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "../..");
const DEFAULT_POLICY = "prompts/spec-driven/governance-policy.json";
const DEFAULT_POLICY_SCHEMA = "integrations/governance/governance-policy.schema.json";
const DEFAULT_CAPABILITIES = "integrations/governance/enforcement-capabilities.json";
const DEFAULT_CAPABILITY_SCHEMA = "integrations/governance/enforcement-capabilities.schema.json";
const GOVERNANCE_VALIDATOR = "integrations/governance/validate-governance-policy.mjs";
const CAPABILITY_VALIDATOR = "integrations/governance/validate-enforcement-capabilities.mjs";

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

function run(root, ref, args) {
  const result = spawnSync(process.execPath, [path.resolve(root, ref), ...args], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`${ref} rejected governance coverage input${detail ? `:\n${detail}` : "."}`);
  }
}

function auditCoverage(policy, capabilityRegistry) {
  const errors = [];
  const rows = [];
  const capabilities = new Map((capabilityRegistry.capabilities || []).map((item) => [item.id, item]));

  for (const rule of policy.rules || []) {
    let mechanism = null;
    let covered = false;

    if (rule.kind === "hard-invariant") {
      const capabilityId = rule.enforcement?.capability;
      const capability = capabilityId ? capabilities.get(capabilityId) : null;
      mechanism = capabilityId ? `capability:${capabilityId}` : null;
      covered = Boolean(capability && capability.failureSemantics?.blocking === true);
      if (!covered) errors.push(`${rule.id}: hard-invariant lacks a registered blocking enforcement capability.`);
    } else if (rule.kind === "deterministic-default") {
      mechanism = rule.resolver?.ref ? `resolver:${rule.resolver.ref}` : null;
      covered = Boolean(rule.resolver?.ref);
      if (!covered) errors.push(`${rule.id}: deterministic-default lacks a resolver.`);
    } else if (rule.kind === "consequential-decision") {
      mechanism = rule.escalation?.humanRequired === true ? "human-escalation" : null;
      covered = rule.escalation?.humanRequired === true && Array.isArray(rule.escalation?.reasonClasses) && rule.escalation.reasonClasses.length > 0;
      if (!covered) errors.push(`${rule.id}: consequential-decision lacks explicit human escalation coverage.`);
    } else if (rule.kind === "contextual-heuristic") {
      mechanism = "advisory-only";
      covered = rule.failure?.severity === "advisory" && rule.failure?.route === "NONE";
      if (!covered) errors.push(`${rule.id}: contextual-heuristic is not advisory-only.`);
    } else {
      errors.push(`${rule.id}: unknown rule kind '${rule.kind}'.`);
    }

    rows.push({ id: rule.id, kind: rule.kind, covered, mechanism });
  }

  // Reverse coverage. resolveEffectivePolicy builds requiredEnforcements from
  // rule.enforcement.capability only, so a capability that no rule references
  // is registered but never required at any stage -- `enforce` silently skips
  // it and prose claiming "enforce already runs this" becomes false with
  // nothing to contradict it. Rule->capability coverage above cannot see that
  // direction.
  const referenced = new Set(
    (policy.rules || [])
      .map((rule) => rule.enforcement?.capability)
      .filter(Boolean)
  );
  for (const [capabilityId, capability] of capabilities) {
    if (referenced.has(capabilityId)) continue;
    errors.push(
      `${capabilityId}: registered capability is referenced by no governance rule, so requiredEnforcements never includes it. Register a rule or remove the capability.`
    );
    rows.push({ id: capabilityId, kind: `capability:${capability.kind}`, covered: false, mechanism: "orphaned" });
  }

  // Third direction. `enforce` reports a non-CLI capability as
  // "not-executable" and does NOT count it as a failure, so a schema-mode
  // capability is never actually run by the stage runner. It therefore cannot
  // be the only enforcement a hard-invariant has at a stage. Today
  // backend-change-manifest-contract is fine only because
  // backend-technology-selection-validation invokes validate-backend-package.mjs
  // -- the very script that validates that schema -- at each of the same
  // stages. That pairing was implicit and could have been deleted silently.
  const covers = (rule, stage) => rule.stageScopes?.includes("every-stage") || rule.stageScopes?.includes(stage);
  const stagesOf = (rule) =>
    rule.stageScopes?.includes("every-stage")
      ? [...new Set((policy.rules || []).flatMap((item) => item.stageScopes || []))].filter((stage) => stage !== "every-stage")
      : rule.stageScopes || [];

  for (const rule of policy.rules || []) {
    if (rule.kind !== "hard-invariant") continue;
    const capability = capabilities.get(rule.enforcement?.capability);
    if (!capability || capability.invocation?.mode === "cli") continue;

    const scope = JSON.stringify(rule.applicability);
    for (const stage of stagesOf(rule)) {
      const executable = (policy.rules || []).some((sibling) => {
        if (sibling === rule || sibling.kind !== "hard-invariant") return false;
        if (sibling.authority !== rule.authority) return false;
        if (JSON.stringify(sibling.applicability) !== scope) return false;
        if (!covers(sibling, stage)) return false;
        return capabilities.get(sibling.enforcement?.capability)?.invocation?.mode === "cli";
      });
      if (!executable) {
        errors.push(
          `${rule.id}: enforcement '${capability.id}' has invocation mode '${capability.invocation?.mode ?? "unknown"}', which enforce reports as not-executable without failing. Stage '${stage}' has no CLI enforcement from '${rule.authority}' under the same applicability, so this hard-invariant is not mechanically checked there.`
        );
      }
    }
  }

  return { errors, rows };
}

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(String(args.root || DEFAULT_ROOT));
const policyRef = String(args.policy || DEFAULT_POLICY);
const policySchemaRef = String(args["policy-schema"] || DEFAULT_POLICY_SCHEMA);
const capabilitiesRef = String(args.capabilities || DEFAULT_CAPABILITIES);
const capabilitySchemaRef = String(args["capability-schema"] || DEFAULT_CAPABILITY_SCHEMA);

try {
  const policyPath = path.resolve(root, policyRef);
  const capabilitiesPath = path.resolve(root, capabilitiesRef);

  run(root, GOVERNANCE_VALIDATOR, [
    "--root", root,
    "--policy", policyRef,
    "--schema", policySchemaRef
  ]);
  run(root, CAPABILITY_VALIDATOR, [
    "--root", root,
    "--registry", capabilitiesRef,
    "--schema", capabilitySchemaRef,
    "--policy", policyRef
  ]);

  const policy = readJson(policyPath);
  const capabilityRegistry = readJson(capabilitiesPath);
  const { errors, rows } = auditCoverage(policy, capabilityRegistry);

  if (errors.length) {
    console.error("Governance rule coverage audit failed:");
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  const counts = rows.reduce((accumulator, row) => {
    accumulator[row.kind] = (accumulator[row.kind] || 0) + 1;
    return accumulator;
  }, {});
  console.log(`Governance rule coverage valid: ${rows.length}/${rows.length} rules covered.`);
  console.log(`Kinds: ${Object.entries(counts).map(([kind, count]) => `${kind}=${count}`).join(", ")}`);
  for (const row of rows) console.log(`- ${row.id} -> ${row.mechanism}`);
} catch (error) {
  console.error(`Governance rule coverage audit failed: ${error.message}`);
  process.exit(1);
}
