#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ensureDirectory, hashTree, parseArgs, readJson, timestamp } from "./lib/workflow-utils.mjs";

// Same exclusions as workflow.lock.json: what is hashed is exactly what is installed.
const EXCLUDED = ["evals", "node_modules"];
// A home only becomes a target when it already has a skills/ directory; this
// script never imposes the skills convention on an agent that does not use it.
const CANDIDATE_HOMES = [".agents", ".claude", ".gemini", ".codex", ".opencode", ".cursor"];

const args = parseArgs(process.argv.slice(2));
if (args.check && args.install) {
  console.error("--check and --install are mutually exclusive.");
  process.exit(1);
}
const mode = args.check ? "check" : args.install ? "install" : "dry-run";

// Returns "up-to-date", "updated", "would-update" or "differs"; throws on unsafe state.
function syncSkill(source, destination) {
  const name = path.basename(destination);
  const sourceHash = hashTree(source, EXCLUDED);
  const destinationStat = fs.lstatSync(destination, { throwIfNoEntry: false });
  if (destinationStat?.isSymbolicLink()) throw new Error(`Destination is a symlink; refusing to replace it: ${destination}`);
  const destinationHash = destinationStat ? hashTree(destination, EXCLUDED) : null;
  if (destinationHash?.digest === sourceHash.digest) return "up-to-date";
  if (mode === "check") return "differs";
  if (mode === "dry-run") return "would-update";
  if (destinationStat) {
    const backupRoot = path.join(os.homedir(), ".agents/skill-release-backups");
    ensureDirectory(backupRoot);
    const agent = path.basename(path.dirname(path.dirname(destination))).replace(/^\./, "");
    const backup = path.join(backupRoot, `${agent}-${name}-${timestamp()}`);
    fs.cpSync(destination, backup, { recursive: true, errorOnExist: true });
    console.log(`  backup: ${backup}`);
    fs.rmSync(destination, { recursive: true });
  }
  ensureDirectory(path.dirname(destination));
  fs.cpSync(source, destination, {
    recursive: true,
    errorOnExist: true,
    filter: (file) => !EXCLUDED.includes(path.relative(source, file).split(path.sep)[0])
  });
  if (hashTree(destination, EXCLUDED).digest !== sourceHash.digest) throw new Error(`Installed hash does not match source after copy: ${destination}`);
  return "updated";
}

function syncOne() {
  const source = path.resolve(String(args.source || ""));
  if (!args.source || !fs.existsSync(path.join(source, "SKILL.md"))) {
    console.error(`Valid skill source required: ${args.source ? source : "<empty>"}`);
    return 1;
  }
  const destination = path.resolve(String(args.destination || path.join(os.homedir(), ".agents/skills", path.basename(source))));
  if (source === destination) {
    console.error("Source and destination must differ.");
    return 1;
  }
  console.log(`Source: ${source}`);
  console.log(`Destination: ${destination}`);
  const status = syncSkill(source, destination);
  if (status === "differs") {
    console.error("Installed skill differs from source.");
    return 1;
  }
  console.log({ "up-to-date": mode === "check" ? "Installed skill matches source." : "No installation change required.", "would-update": "Dry-run: installation would be updated.", updated: "Skill installed and verified." }[status]);
  return 0;
}

// Every skill routed by workflow.lock.json, into every agent home that has skills/.
function syncAll() {
  const root = path.resolve(String(args.root || "."));
  const lock = readJson(path.join(root, "workflow.lock.json"));
  const homes = CANDIDATE_HOMES.filter((home) => fs.statSync(path.join(os.homedir(), home, "skills"), { throwIfNoEntry: false })?.isDirectory());
  if (homes.length === 0) {
    console.log("No agent skill directories found under known agent home directories.");
    return 0;
  }
  let failures = 0;
  const counts = {};
  for (const skill of lock.skills) {
    const source = path.join(root, skill.source);
    const sourceDigest = fs.existsSync(path.join(source, "SKILL.md")) ? hashTree(source, EXCLUDED).digest : null;
    if (sourceDigest !== skill.sha256) {
      // Syncing an unlocked change would make agents diverge from the lock; relock consciously first.
      failures += 1;
      console.log(`[SKILL] ${skill.name} status=failed reason=${sourceDigest ? "source-differs-from-lock" : "source-missing"}`);
      continue;
    }
    for (const home of homes) {
      const label = `${home}/skills/${skill.name}`;
      try {
        const status = syncSkill(source, path.join(os.homedir(), home, "skills", skill.name));
        counts[status] = (counts[status] ?? 0) + 1;
        if (status === "differs") failures += 1;
        if (status !== "up-to-date") console.log(`[SKILL] ${label} status=${status}`);
      } catch (error) {
        failures += 1;
        console.log(`[SKILL] ${label} status=failed reason=${error.message}`);
      }
    }
  }
  const summary = Object.entries(counts).map(([status, count]) => `${status}=${count}`).join(" ");
  console.log(`[SKILLS] mode=${mode} homes=${homes.join(",")} skills=${lock.skills.length} ${summary} failed=${failures}`.replace(/ +/g, " "));
  return failures === 0 ? 0 : 1;
}

try {
  process.exitCode = args.all ? syncAll() : syncOne();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
