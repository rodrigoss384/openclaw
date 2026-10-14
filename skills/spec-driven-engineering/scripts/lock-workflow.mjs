#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { hashTree, parseArgs, readJson } from "./lib/workflow-utils.mjs";

const USAGE = [
  "node lock-workflow.mjs --root <project-root> [--check] [--lock-file <path>]"
].join(" ");

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(String(args.root || process.cwd()));
const lockFilePath = path.resolve(String(args["lock-file"] || path.join(root, "workflow.lock.json")));

const manifestPath = path.join(root, "prompts/spec-driven/manifest.json");
if (!fs.existsSync(manifestPath)) {
  console.error(`Manifest not found: ${manifestPath}\nUsage: ${USAGE}`);
  process.exit(1);
}

const manifest = readJson(manifestPath);
const routedSkillNames = [...new Set((manifest.skillRoutes || []).map((route) => route.skill))].sort();
const requirementLevelBySkill = new Map((manifest.skillRoutes || []).map((route) => [route.skill, route.requirementLevel]));

const localSkillsRoot = path.join(root, "skills");

function resolveSkillDirectories(directory) {
  const byName = new Map();
  if (!fs.existsSync(directory)) return byName;
  const pending = [directory];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const child = path.join(current, entry.name);
      const skillFile = path.join(child, "SKILL.md");
      if (fs.existsSync(skillFile)) {
        const frontmatterName = fs.readFileSync(skillFile, "utf8").match(/^name:\s*([^\n]+)$/m)?.[1]?.trim();
        byName.set(frontmatterName || entry.name, child);
      } else if (!entry.name.startsWith(".")) {
        pending.push(child);
      }
    }
  }
  return byName;
}

const skillDirectoriesByName = resolveSkillDirectories(localSkillsRoot);
const entries = [];
const unresolved = [];

for (const name of routedSkillNames) {
  const skillPath = skillDirectoriesByName.get(name);
  if (!skillPath) {
    unresolved.push(name);
    continue;
  }
  const { digest, files } = hashTree(skillPath, ["evals", "node_modules"]);
  entries.push({ name, source: path.relative(root, skillPath).split(path.sep).join("/"), sha256: digest, files });
}

const lock = {
  generatedAt: new Date().toISOString(),
  workflowVersion: manifest.workflowVersion,
  unresolvedSkills: unresolved,
  skills: entries
};

const hardRequiredUnresolved = unresolved.filter((name) => requirementLevelBySkill.get(name) === "hard-required");
if (hardRequiredUnresolved.length > 0) {
  console.error(
    `Hard-required skill(s) could not be resolved under skills/: ${hardRequiredUnresolved.join(", ")}. A hard-required route with no local copy to lock is a broken workflow, not a degraded fallback.`
  );
  process.exit(1);
}

if (args.check) {
  if (!fs.existsSync(lockFilePath)) {
    console.error(`Lock file not found: ${lockFilePath}. Run without --check to generate it.`);
    process.exit(1);
  }
  const committed = readJson(lockFilePath);
  const committedByName = new Map((committed.skills || []).map((entry) => [entry.name, entry]));
  const currentByName = new Map(entries.map((entry) => [entry.name, entry]));
  const drift = [];

  if (committed.workflowVersion !== manifest.workflowVersion) {
    drift.push(`Lock was generated for workflowVersion '${committed.workflowVersion}' but manifest.json now declares '${manifest.workflowVersion}'. Re-run lock-workflow.mjs after a conscious version bump — a stale lock is not a valid proof of "same version everywhere".`);
  }

  const committedNames = new Set((committed.skills || []).map((entry) => entry.name));
  const currentNames = new Set(entries.map((entry) => entry.name));
  const committedUnresolved = new Set(committed.unresolvedSkills || []);
  const currentUnresolved = new Set(unresolved);
  for (const name of routedSkillNames) {
    const inCommittedLock = committedNames.has(name) || committedUnresolved.has(name);
    const inCurrentLock = currentNames.has(name) || currentUnresolved.has(name);
    if (!inCommittedLock) drift.push(`'${name}' is routed but absent from both the committed lock's skills[] and unresolvedSkills[] — the lock does not account for it.`);
    if (!inCurrentLock) drift.push(`'${name}' is routed but the current resolution accounts for neither skills[] nor unresolvedSkills[] — this is an internal lock-workflow.mjs inconsistency.`);
  }

  for (const name of routedSkillNames) {
    const committedEntry = committedByName.get(name);
    const currentEntry = currentByName.get(name);
    if (!committedEntry && currentEntry) {
      drift.push(`'${name}' is routed and present but missing from the lock file — run lock-workflow.mjs to add it.`);
      continue;
    }
    if (committedEntry && !currentEntry) {
      drift.push(`'${name}' is locked but no longer resolvable under skills/ — remove it from the lock or restore the skill.`);
      continue;
    }
    if (committedEntry && currentEntry && committedEntry.sha256 !== currentEntry.sha256) {
      drift.push(`'${name}' content changed since the lock was generated (locked ${committedEntry.sha256.slice(0, 12)}… vs current ${currentEntry.sha256.slice(0, 12)}…). This is a conscious upgrade only if you re-run lock-workflow.mjs and review the diff.`);
    }
  }

  if (drift.length > 0) {
    console.error("Workflow lock drift detected:\n");
    for (const line of drift) console.error(`- ${line}`);
    process.exit(1);
  }

  console.log(`Lock verified: ${entries.length} skills match ${lockFilePath}.`);
  process.exit(0);
}

fs.writeFileSync(lockFilePath, `${JSON.stringify(lock, null, 2)}\n`);
console.log(`Lock written: ${lockFilePath}`);
console.log(`Skills locked: ${entries.length}`);
if (unresolved.length > 0) {
  console.log(`Unresolved (not found under skills/, likely third-party marketplace skills without a local copy): ${unresolved.join(", ")}`);
}
