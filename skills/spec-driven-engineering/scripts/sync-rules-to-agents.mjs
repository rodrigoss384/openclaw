#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ensureDirectory, hashFile, parseArgs, timestamp } from "./lib/workflow-utils.mjs";

const args = parseArgs(process.argv.slice(2));
const source = path.resolve(String(args.source || "rules.md"));

if (args.check && args.install) {
  console.error("--check and --install are mutually exclusive.");
  process.exit(1);
}

if (!fs.existsSync(source)) {
  console.error(`Source rules file not found: ${source}`);
  process.exit(1);
}

const home = os.homedir();

// Candidate agent home-config directories. A directory only becomes a sync
// target when it already contains rules.md — this script never imposes the
// rules.md convention on a tool that has never used it (e.g. Codex, which
// uses its own composite AGENTS.md instead).
const CANDIDATE_HOMES = [".agents", ".claude", ".gemini", ".codex", ".opencode", ".cursor"];

const targets = CANDIDATE_HOMES
  .map((dir) => path.join(home, dir, "rules.md"))
  .filter((destination) => destination !== source && fs.existsSync(destination));

if (args.target) {
  const explicit = path.resolve(String(args.target));
  if (!targets.includes(explicit)) targets.push(explicit);
}

if (targets.length === 0) {
  console.log("No existing rules.md targets found under known agent home directories.");
  process.exit(0);
}

const sourceHash = hashFile(source);
console.log(`Source: ${source}`);
console.log(`Source hash: ${sourceHash}`);
console.log("");

let anyDiff = false;
let anyFailure = false;

for (const destination of targets) {
  const destinationHash = fs.existsSync(destination) ? hashFile(destination) : null;
  const equal = destinationHash === sourceHash;

  console.log(`${destination}`);
  console.log(`  status: ${equal ? "up to date" : "differs"}`);

  if (equal) {
    console.log("");
    continue;
  }

  anyDiff = true;

  if (args.check) {
    console.log("  action: check failed (re-run with --install to apply)");
    console.log("");
    continue;
  }

  if (!args.install) {
    console.log("  action: dry-run (re-run with --install to apply)");
    console.log("");
    continue;
  }

  if (destinationHash) {
    const backupRoot = path.join(home, ".agents", "rules-backups");
    ensureDirectory(backupRoot);
    const agentName = path.basename(path.dirname(destination));
    const backup = path.join(backupRoot, `rules-${agentName}-${timestamp()}.md`);
    fs.copyFileSync(destination, backup);
    console.log(`  backup: ${backup}`);
  }

  ensureDirectory(path.dirname(destination));
  fs.copyFileSync(source, destination);

  const verifiedHash = hashFile(destination);
  const verified = verifiedHash === sourceHash;

  console.log(`  installed: ${verified ? "verified" : "HASH MISMATCH AFTER COPY"}`);

  if (!verified) anyFailure = true;

  console.log("");
}

if (args.install) {
  console.log(anyFailure ? "Sync completed with failures." : "Sync completed and verified.");
  process.exitCode = anyFailure ? 1 : 0;
} else if (args.check) {
  console.log(anyDiff ? "Check failed: targets differ from source." : "All targets already match source.");
  process.exitCode = anyDiff ? 1 : 0;
} else {
  console.log(anyDiff ? "Dry-run: differences found. Re-run with --install to apply." : "All targets already match source.");
  process.exitCode = 0;
}
