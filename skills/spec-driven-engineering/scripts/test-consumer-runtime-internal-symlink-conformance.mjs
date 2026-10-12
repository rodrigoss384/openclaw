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
const DEFAULT_PROJECT = "/home/rodrigo/Documentos/projetos/inventario-amc";
const args = process.argv.slice(2);
const projectFlag = args.indexOf("--project");
const PROJECT_ROOT = path.resolve(projectFlag >= 0 ? args[projectFlag + 1] : DEFAULT_PROJECT);
const ALLOW_MISSING = args.includes("--allow-missing-project");
const SYMLINK_PATHS = ["prompts", "integrations", "skills", "workflow.lock.json"];
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
    console.log(`Consumer runtime internal-symlink conformance skipped: project not available at ${PROJECT_ROOT}`);
    process.exit(0);
  }
  throw new Error(`Inventário AMC project not found: ${PROJECT_ROOT}`);
}

const originalStatusBefore = run("git", ["status", "--porcelain=v1", "-z"], PROJECT_ROOT, 0, null).stdout;
const head = run("git", ["rev-parse", "HEAD"], PROJECT_ROOT).stdout.trim();
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "consumer-runtime-inventario-"));
const cloneRoot = path.join(tempRoot, "inventario-conformance");

try {
  run("git", ["clone", "--quiet", "--shared", "--no-checkout", PROJECT_ROOT, cloneRoot], SOURCE_ROOT);
  run("git", ["checkout", "--quiet", "--detach", head], cloneRoot);
  const symlinkBaseline = new Map();
  for (const relativePath of SYMLINK_PATHS) {
    const originalPath = path.join(PROJECT_ROOT, relativePath);
    assert.ok(fs.lstatSync(originalPath).isSymbolicLink(), `Expected project symlink: ${relativePath}`);
    assertions += 1;
    const linkTarget = fs.readlinkSync(originalPath);
    assert.ok(!path.isAbsolute(linkTarget), `Expected an internal relative symlink: ${relativePath}`);
    assertions += 1;
    const originalResolved = fs.realpathSync(originalPath);
    const resolvedRelative = path.relative(PROJECT_ROOT, originalResolved);
    assert.ok(resolvedRelative && !resolvedRelative.startsWith(`..${path.sep}`) && !path.isAbsolute(resolvedRelative), `Symlink escaped project root: ${relativePath}`);
    assertions += 1;
    const cloneResolved = path.join(cloneRoot, resolvedRelative);
    const resolvedStat = fs.statSync(originalResolved);
    fs.mkdirSync(path.dirname(cloneResolved), { recursive: true });
    if (resolvedStat.isDirectory()) fs.cpSync(originalResolved, cloneResolved, { recursive: true });
    else fs.copyFileSync(originalResolved, cloneResolved);
    fs.symlinkSync(linkTarget, path.join(cloneRoot, relativePath), resolvedStat.isDirectory() ? "dir" : "file");
    symlinkBaseline.set(relativePath, linkTarget);
  }
  const lockDigestBefore = digest(path.join(cloneRoot, "workflow.lock.json"));

  const blocked = run(process.execPath, [CLI, "install", "--target", cloneRoot, "--source", SOURCE_ROOT], SOURCE_ROOT, 2);
  assert.ok(`${blocked.stdout}${blocked.stderr}`.includes("TARGET_SYMLINK_FORBIDDEN"), "Inventário AMC must require explicit adoption of internal symlinks.");
  assertions += 1;

  run(process.execPath, [CLI, "install", "--target", cloneRoot, "--source", SOURCE_ROOT, "--adopt-existing"], SOURCE_ROOT);
  const state = JSON.parse(fs.readFileSync(path.join(cloneRoot, ".specs/workflow-runtime-install.json"), "utf8"));
  assert.equal(state.targetSymlinks.length, 4, "Install state must record the four Inventário AMC symlink roots.");
  assertions += 1;
  for (const [relativePath, linkTarget] of symlinkBaseline) {
    assert.equal(fs.readlinkSync(path.join(cloneRoot, relativePath)), linkTarget, `Install replaced symlink: ${relativePath}`);
    assertions += 1;
  }

  const installedCli = path.join(cloneRoot, "skills/spec-driven-engineering/scripts/consumer-runtime.mjs");
  run(process.execPath, [installedCli, "check", "--target", cloneRoot], cloneRoot);
  run(process.execPath, [installedCli, "check", "--target", cloneRoot, "--source", SOURCE_ROOT], cloneRoot);
  run(process.execPath, [installedCli, "uninstall", "--target", cloneRoot], cloneRoot);

  for (const [relativePath, linkTarget] of symlinkBaseline) {
    assert.equal(fs.readlinkSync(path.join(cloneRoot, relativePath)), linkTarget, `Uninstall replaced symlink: ${relativePath}`);
    assertions += 1;
  }
  assert.equal(digest(path.join(cloneRoot, "workflow.lock.json")), lockDigestBefore, "Uninstall must restore the legacy workflow lock behind its symlink.");
  assertions += 1;
  run("git", ["diff", "--quiet", head, "--"], cloneRoot);

  const originalStatusAfter = run("git", ["status", "--porcelain=v1", "-z"], PROJECT_ROOT, 0, null).stdout;
  assert.deepEqual(originalStatusAfter, originalStatusBefore, "The original Inventário AMC working tree status changed during conformance.");
  assertions += 1;
  console.log(`Consumer runtime Inventário AMC symlink conformance passed at ${head} (${assertions} assertions; original untouched).`);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
