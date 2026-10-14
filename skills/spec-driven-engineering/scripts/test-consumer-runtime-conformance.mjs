#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../../..");
const CLI = path.join(SCRIPT_DIRECTORY, "consumer-runtime.mjs");
const DEFAULT_PROJECT = "/home/rodrigo/Documentos/projetos/a2i";
const args = process.argv.slice(2);
const projectFlag = args.indexOf("--project");
const PROJECT_ROOT = path.resolve(projectFlag >= 0 ? args[projectFlag + 1] : DEFAULT_PROJECT);
const ALLOW_MISSING = args.includes("--allow-missing-project");
let assertions = 0;

function run(command, commandArgs, cwd, expectedStatus = 0, encoding = "utf8") {
  const result = spawnSync(command, commandArgs, { cwd, encoding, stdio: ["ignore", "pipe", "pipe"] });
  assert.equal(result.status, expectedStatus, `Command failed: ${command} ${commandArgs.join(" ")}\nstdout:\n${String(result.stdout)}\nstderr:\n${String(result.stderr)}`);
  assertions += 1;
  return result;
}

function digest(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

if (!fs.existsSync(PROJECT_ROOT)) {
  if (ALLOW_MISSING) {
    console.log(`Consumer runtime A²I conformance skipped: project not available at ${PROJECT_ROOT}`);
    process.exit(0);
  }
  throw new Error(`A²I project not found: ${PROJECT_ROOT}`);
}

const originalStatusBefore = run("git", ["status", "--porcelain=v1", "-z"], PROJECT_ROOT, 0, null).stdout;
const head = run("git", ["rev-parse", "HEAD"], PROJECT_ROOT).stdout.trim();
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "consumer-runtime-a2i-"));
const cloneRoot = path.join(tempRoot, "a2i-conformance");

try {
  run("git", ["clone", "--quiet", "--shared", "--no-checkout", PROJECT_ROOT, cloneRoot], SOURCE_ROOT);
  run("git", ["checkout", "--quiet", "--detach", head], cloneRoot);
  const cloneLock = path.join(cloneRoot, "workflow.lock.json");
  if (!fs.existsSync(cloneLock)) {
    const projectLock = path.join(PROJECT_ROOT, "workflow.lock.json");
    assert.ok(fs.existsSync(projectLock), "A²I working tree must provide the legacy workflow lock used for adoption evidence.");
    assertions += 1;
    fs.copyFileSync(projectLock, cloneLock);
  }
  const protectedPaths = ["AGENTS.md", "CLAUDE.md", ".github/workflows"];
  const protectedBefore = new Map();
  for (const relativePath of protectedPaths) {
    const absolutePath = path.join(cloneRoot, relativePath);
    if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) protectedBefore.set(relativePath, digest(absolutePath));
  }
  const lockBefore = digest(cloneLock);

  const blocked = run(process.execPath, [CLI, "install", "--target", cloneRoot, "--source", SOURCE_ROOT], SOURCE_ROOT, 2);
  assert.ok(`${blocked.stdout}${blocked.stderr}`.includes("UNMANAGED_FILE_CONFLICT"), "A²I legacy conflict must fail closed without adoption.");
  assertions += 1;

  run(process.execPath, [CLI, "install", "--target", cloneRoot, "--source", SOURCE_ROOT, "--adopt-existing"], SOURCE_ROOT);
  const installedCli = path.join(cloneRoot, "skills/spec-driven-engineering/scripts/consumer-runtime.mjs");
  run(process.execPath, [installedCli, "check", "--target", cloneRoot], cloneRoot);
  run(process.execPath, [installedCli, "uninstall", "--target", cloneRoot], cloneRoot);

  assert.equal(digest(path.join(cloneRoot, "workflow.lock.json")), lockBefore, "A²I legacy workflow lock must be restored after uninstall.");
  assertions += 1;
  for (const [relativePath, expectedDigest] of protectedBefore) {
    assert.equal(digest(path.join(cloneRoot, relativePath)), expectedDigest, `Product-owned file changed in A²I clone: ${relativePath}`);
    assertions += 1;
  }
  run("git", ["diff", "--quiet", head, "--"], cloneRoot);

  const originalStatusAfter = run("git", ["status", "--porcelain=v1", "-z"], PROJECT_ROOT, 0, null).stdout;
  assert.deepEqual(originalStatusAfter, originalStatusBefore, "The original A²I working tree status changed during conformance.");
  assertions += 1;
  console.log(`Consumer runtime A²I conformance passed at ${head} (${assertions} assertions; original untouched).`);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
