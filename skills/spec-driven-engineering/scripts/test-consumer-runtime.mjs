#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(SCRIPT_DIRECTORY, "consumer-runtime.mjs");
const TEMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "consumer-runtime-test-"));
let assertions = 0;

function verify(value, message) {
  assert.ok(value, message);
  assertions += 1;
}

function equal(actual, expected, message) {
  assert.equal(actual, expected, message);
  assertions += 1;
}

function write(relativeRoot, relativePath, content, mode = 0o644) {
  const target = path.join(relativeRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, { mode });
  return target;
}

function writeJson(root, relativePath, value) {
  return write(root, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function snapshot(root) {
  const result = {};
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const fullPath = path.join(directory, entry.name);
      const relative = path.relative(root, fullPath).split(path.sep).join("/");
      if (entry.isDirectory()) visit(fullPath);
      else if (entry.isFile()) result[relative] = sha256(fullPath);
      else result[relative] = `special:${entry.isSymbolicLink()}`;
    }
  }
  visit(root);
  return result;
}

function run(cli, command, target, source, expectedStatus = 0, extraArgs = []) {
  const args = [cli, command, "--target", target];
  if (source) args.push("--source", source);
  args.push(...extraArgs);
  const result = spawnSync(process.execPath, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  assert.equal(result.status, expectedStatus, `${command} unexpected status.\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  assertions += 1;
  return result;
}

function createGitRoot(name) {
  const root = path.join(TEMP_ROOT, name);
  fs.mkdirSync(path.join(root, ".git"), { recursive: true });
  return root;
}

function createSource(name) {
  const root = createGitRoot(name);
  write(root, "rules.md", "# Consumer workflow rules v1\n");
  write(root, "integrations/governance/control.mjs", "export const governance = true;\n");
  write(root, "integrations/frontend/control.mjs", "export const frontend = true;\n");
  write(root, "integrations/impeccable/control.mjs", "export const impeccable = true;\n");
  write(root, ".github/agents/impeccable.md", "# Impeccable agent\n");
  write(root, ".github/hooks/impeccable.json", "{}\n");
  write(root, ".github/skills/impeccable/SKILL.md", "# Impeccable\n");
  write(root, "skills/spec-driven-engineering/SKILL.md", "---\nname: spec-driven-engineering\n---\n");
  fs.mkdirSync(path.join(root, "skills/spec-driven-engineering/scripts"), { recursive: true });
  fs.copyFileSync(CLI, path.join(root, "skills/spec-driven-engineering/scripts/consumer-runtime.mjs"));
  write(root, "skills/spec-driven-engineering/evals/ignored.json", "{}\n");
  write(root, "skills/spec-driven-engineering/node_modules/ignored/index.js", "throw new Error('ignored');\n");
  writeJson(root, "workflow.lock.json", {
    workflowVersion: "2.4.0",
    unresolvedSkills: ["impeccable"],
    skills: [{ name: "spec-driven-engineering", source: "skills/spec-driven-engineering", sha256: "fixture", files: 2 }]
  });
  writeJson(root, "prompts/spec-driven/consumer-runtime.manifest.json", {
    schemaVersion: "1.0.0",
    runtimeVersion: "1.0.0",
    workflowVersion: "2.4.0",
    stateFile: ".specs/workflow-runtime-install.json",
    lockFile: "workflow.lock.json",
    fixedEntries: [
      { path: "rules.md", kind: "file" },
      { path: "workflow.lock.json", kind: "file" },
      { path: "prompts/spec-driven", kind: "tree" },
      { path: "integrations/governance", kind: "tree" },
      { path: "integrations/frontend", kind: "tree" },
      { path: "integrations/impeccable", kind: "tree" },
      { path: ".github/agents", kind: "tree" },
      { path: ".github/hooks/impeccable.json", kind: "file" },
      { path: ".github/skills/impeccable", kind: "tree" }
    ],
    lockedSkills: { enabled: true, exclude: ["evals", "node_modules"] },
    excludedSegments: [".git", ".gitnexus", "evals", "node_modules"]
  });
  write(root, "prompts/spec-driven/00-project-init.prompt.md", "# Project Init\n");
  for (const args of [["init", "--quiet"], ["config", "user.email", "runtime-test@example.invalid"], ["config", "user.name", "Runtime Test"], ["add", "."], ["commit", "--quiet", "-m", "fixture"]]) {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, `Unable to create source Git history: git ${args.join(" ")}\n${result.stderr}`);
  }
  return root;
}

function seedProductFiles(root) {
  write(root, "AGENTS.md", "# Product agents\n");
  write(root, "CLAUDE.md", "# Product Claude\n");
  write(root, ".github/workflows/product.yml", "name: product\n");
  write(root, ".specs/features/existing/00-intent.md", "# Existing feature\n");
}

try {
  verify(fs.existsSync(CLI), "consumer-runtime.mjs must exist before the suite can execute.");

  const source = createSource("source");
  const target = createGitRoot("target");
  seedProductFiles(target);
  const productBefore = snapshot(target);

  const installed = run(CLI, "install", target, source);
  verify(installed.stdout.includes("installed"), "install must report its outcome.");
  const statePath = path.join(target, ".specs/workflow-runtime-install.json");
  verify(fs.existsSync(statePath), "install state must exist.");
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  equal(state.schemaVersion, "1.0.0");
  equal(state.workflowVersion, "2.4.0");
  verify(state.managedFiles.length >= 10, "distribution inventory must include fixed entries and locked skills.");
  verify(state.managedFiles.every((item) => !path.isAbsolute(item.path) && !item.path.includes("..")), "managed paths must be portable.");
  verify(!fs.readFileSync(statePath, "utf8").includes(source), "state must not persist the absolute source root.");
  verify(!fs.existsSync(path.join(target, "skills/spec-driven-engineering/evals")), "evals must be excluded.");
  verify(!fs.existsSync(path.join(target, "skills/spec-driven-engineering/node_modules")), "node_modules must be excluded.");
  equal(fs.readFileSync(path.join(target, "AGENTS.md"), "utf8"), "# Product agents\n");
  equal(fs.readFileSync(path.join(target, ".github/workflows/product.yml"), "utf8"), "name: product\n");
  equal(fs.readFileSync(path.join(target, ".specs/features/existing/00-intent.md"), "utf8"), "# Existing feature\n");

  const stateBeforeNoop = fs.readFileSync(statePath, "utf8");
  run(CLI, "install", target, source);
  equal(fs.readFileSync(statePath, "utf8"), stateBeforeNoop, "idempotent install must not rewrite state.");
  verify(!fs.existsSync(path.join(target, ".specs/workflow-runtime-backups")), "no-op install must not create backup.");

  run(path.join(target, "skills/spec-driven-engineering/scripts/consumer-runtime.mjs"), "check", target, null);
  run(CLI, "check", target, source);

  const conflictTarget = createGitRoot("conflict-target");
  seedProductFiles(conflictTarget);
  write(conflictTarget, "rules.md", "# Product-owned rules\n");
  const conflictBefore = snapshot(conflictTarget);
  const conflict = run(CLI, "install", conflictTarget, source, 2);
  verify(`${conflict.stdout}${conflict.stderr}`.includes("UNMANAGED_FILE_CONFLICT"), "conflict must have a stable reason code.");
  assert.deepEqual(snapshot(conflictTarget), conflictBefore);
  assertions += 1;

  const legacyTarget = createGitRoot("legacy-target");
  seedProductFiles(legacyTarget);
  write(legacyTarget, "rules.md", "# Legacy workflow rules\n");
  writeJson(legacyTarget, "workflow.lock.json", { workflowVersion: "2.3.0", skills: [], unresolvedSkills: [] });
  write(legacyTarget, "prompts/spec-driven/manifest.json", "{\"workflowVersion\":\"2.3.0\"}\n");
  const legacyBaseline = {
    "rules.md": sha256(path.join(legacyTarget, "rules.md")),
    "workflow.lock.json": sha256(path.join(legacyTarget, "workflow.lock.json")),
    "prompts/spec-driven/manifest.json": sha256(path.join(legacyTarget, "prompts/spec-driven/manifest.json")),
    "AGENTS.md": sha256(path.join(legacyTarget, "AGENTS.md"))
  };
  const legacyBeforeBlockedInstall = snapshot(legacyTarget);
  run(CLI, "install", legacyTarget, source, 2);
  assert.deepEqual(snapshot(legacyTarget), legacyBeforeBlockedInstall);
  assertions += 1;
  run(CLI, "install", legacyTarget, source, 0, ["--adopt-existing"]);
  const adoptedState = JSON.parse(fs.readFileSync(path.join(legacyTarget, ".specs/workflow-runtime-install.json"), "utf8"));
  verify(adoptedState.adoptedBackup, "legacy adoption must record its backup root.");
  const adoptedPaths = adoptedState.adoptedFiles.map((file) => file.path);
  verify(adoptedPaths.includes("rules.md") && adoptedPaths.includes("workflow.lock.json"), "legacy conflicts must be recorded for restoration.");
  run(CLI, "check", legacyTarget, null);
  run(CLI, "uninstall", legacyTarget, null);
  for (const [relative, digest] of Object.entries(legacyBaseline)) {
    equal(sha256(path.join(legacyTarget, relative)), digest, `legacy file was not restored: ${relative}`);
  }
  verify(!fs.existsSync(path.join(legacyTarget, "integrations/governance/control.mjs")), "new managed files must be removed after legacy uninstall.");
  verify(fs.existsSync(path.join(legacyTarget, adoptedState.adoptedBackup)), "adoption backup must remain recoverable.");

  const unprovenLegacyTarget = createGitRoot("unproven-legacy-target");
  write(unprovenLegacyTarget, "rules.md", "# Unproven conflicting rules\n");
  const unproven = run(CLI, "install", unprovenLegacyTarget, source, 2, ["--adopt-existing"]);
  verify(`${unproven.stdout}${unproven.stderr}`.includes("ADOPTION_EVIDENCE_MISSING"), "adoption without a legacy lock must fail closed.");
  verify(`${unproven.stdout}${unproven.stderr}`.includes("ADOPTION_PROVENANCE_MISSING"), "unproven files must identify missing source provenance.");

  const historicalLegacyTarget = createGitRoot("historical-legacy-target");
  write(historicalLegacyTarget, "rules.md", fs.readFileSync(path.join(source, "rules.md")));
  const historicalRulesDigest = sha256(path.join(historicalLegacyTarget, "rules.md"));
  run(CLI, "install", historicalLegacyTarget, source, 0, ["--adopt-existing"]);
  run(CLI, "uninstall", historicalLegacyTarget, null);
  equal(sha256(path.join(historicalLegacyTarget, "rules.md")), historicalRulesDigest, "same-path Git provenance must permit reversible adoption without a lock.");

  const identicalLegacyTarget = createGitRoot("identical-legacy-target");
  write(identicalLegacyTarget, "rules.md", fs.readFileSync(path.join(source, "rules.md")));
  writeJson(identicalLegacyTarget, "workflow.lock.json", { workflowVersion: "2.3.0", skills: [], unresolvedSkills: [] });
  const identicalRulesDigest = sha256(path.join(identicalLegacyTarget, "rules.md"));
  const identicalBlocked = run(CLI, "install", identicalLegacyTarget, source, 2);
  verify(`${identicalBlocked.stdout}${identicalBlocked.stderr}`.includes("UNMANAGED_FILE_CONFLICT rules.md"), "an identical preexisting file must still require explicit adoption.");
  run(CLI, "install", identicalLegacyTarget, source, 0, ["--adopt-existing"]);
  run(CLI, "uninstall", identicalLegacyTarget, null);
  equal(sha256(path.join(identicalLegacyTarget, "rules.md")), identicalRulesDigest, "an identical adopted file must be restored after uninstall.");

  const symlinkTarget = createGitRoot("internal-symlink-target");
  seedProductFiles(symlinkTarget);
  for (const directory of ["prompts", "integrations", "skills"]) {
    fs.mkdirSync(path.join(symlinkTarget, ".claude", directory), { recursive: true });
    fs.symlinkSync(`.claude/${directory}`, path.join(symlinkTarget, directory), "dir");
  }
  writeJson(symlinkTarget, ".claude/workflow.lock.json", { workflowVersion: "2.3.0", skills: [], unresolvedSkills: [] });
  fs.symlinkSync(".claude/workflow.lock.json", path.join(symlinkTarget, "workflow.lock.json"), "file");
  write(symlinkTarget, "prompts/spec-driven/00-project-init.prompt.md", "# Legacy project init\n");
  write(symlinkTarget, "integrations/governance/control.mjs", "export const governance = 'legacy';\n");
  write(symlinkTarget, "skills/spec-driven-engineering/SKILL.md", "---\nname: spec-driven-engineering\nlegacy: true\n---\n");
  const symlinkPaths = ["prompts", "integrations", "skills", "workflow.lock.json"];
  const symlinkBaseline = new Map(symlinkPaths.map((relativePath) => [relativePath, fs.readlinkSync(path.join(symlinkTarget, relativePath))]));
  const symlinkFileBaseline = new Map([
    ["prompts/spec-driven/00-project-init.prompt.md", sha256(path.join(symlinkTarget, "prompts/spec-driven/00-project-init.prompt.md"))],
    ["integrations/governance/control.mjs", sha256(path.join(symlinkTarget, "integrations/governance/control.mjs"))],
    ["skills/spec-driven-engineering/SKILL.md", sha256(path.join(symlinkTarget, "skills/spec-driven-engineering/SKILL.md"))],
    ["workflow.lock.json", sha256(path.join(symlinkTarget, "workflow.lock.json"))]
  ]);
  const symlinkBeforeBlockedInstall = snapshot(symlinkTarget);
  const symlinkBlocked = run(CLI, "install", symlinkTarget, source, 2);
  verify(`${symlinkBlocked.stdout}${symlinkBlocked.stderr}`.includes("TARGET_SYMLINK_FORBIDDEN"), "internal symlinks must require explicit adoption.");
  assert.deepEqual(snapshot(symlinkTarget), symlinkBeforeBlockedInstall);
  assertions += 1;

  run(CLI, "install", symlinkTarget, source, 0, ["--adopt-existing"]);
  const symlinkState = JSON.parse(fs.readFileSync(path.join(symlinkTarget, ".specs/workflow-runtime-install.json"), "utf8"));
  equal(symlinkState.targetSymlinks.length, 4, "install state must record every internal symlink root.");
  for (const [relativePath, linkTarget] of symlinkBaseline) {
    equal(fs.readlinkSync(path.join(symlinkTarget, relativePath)), linkTarget, `install replaced internal symlink: ${relativePath}`);
  }
  const symlinkCli = path.join(symlinkTarget, "skills/spec-driven-engineering/scripts/consumer-runtime.mjs");
  run(symlinkCli, "check", symlinkTarget, null);

  write(source, "integrations/governance/control.mjs", "export const governance = 'symlink-update';\n");
  run(CLI, "update", symlinkTarget, source);
  equal(fs.readFileSync(path.join(symlinkTarget, "integrations/governance/control.mjs"), "utf8"), "export const governance = 'symlink-update';\n");

  fs.mkdirSync(path.join(symlinkTarget, ".claude", "other-prompts"), { recursive: true });
  fs.unlinkSync(path.join(symlinkTarget, "prompts"));
  fs.symlinkSync(".claude/other-prompts", path.join(symlinkTarget, "prompts"), "dir");
  const changedTopology = run(CLI, "check", symlinkTarget, source, 2);
  verify(`${changedTopology.stdout}${changedTopology.stderr}`.includes("TARGET_SYMLINK_CHANGED prompts"), "changed internal symlink topology must fail closed.");
  fs.unlinkSync(path.join(symlinkTarget, "prompts"));
  fs.symlinkSync(symlinkBaseline.get("prompts"), path.join(symlinkTarget, "prompts"), "dir");
  run(CLI, "check", symlinkTarget, source);

  run(symlinkCli, "uninstall", symlinkTarget, null);
  for (const [relativePath, linkTarget] of symlinkBaseline) {
    equal(fs.readlinkSync(path.join(symlinkTarget, relativePath)), linkTarget, `uninstall replaced internal symlink: ${relativePath}`);
  }
  for (const [relativePath, digest] of symlinkFileBaseline) {
    equal(sha256(path.join(symlinkTarget, relativePath)), digest, `uninstall did not restore adopted content behind symlink: ${relativePath}`);
  }
  verify(!fs.existsSync(path.join(symlinkTarget, "prompts/spec-driven/consumer-runtime.manifest.json")), "uninstall must remove newly managed content behind a symlink.");

  const externalSymlinkTarget = createGitRoot("external-symlink-target");
  const externalDirectory = path.join(TEMP_ROOT, "outside-target-root");
  fs.mkdirSync(externalDirectory, { recursive: true });
  fs.symlinkSync(externalDirectory, path.join(externalSymlinkTarget, "skills"), "dir");
  const externalBefore = snapshot(externalSymlinkTarget);
  const externalBlocked = run(CLI, "install", externalSymlinkTarget, source, 2, ["--adopt-existing"]);
  const externalBlockedOutput = `${externalBlocked.stdout}${externalBlocked.stderr}`;
  verify(externalBlockedOutput.includes("TARGET_SYMLINK_ABSOLUTE") && externalBlockedOutput.includes("skills"), "absolute symlink must fail closed.");
  assert.deepEqual(snapshot(externalSymlinkTarget), externalBefore);
  assertions += 1;

  const danglingSymlinkTarget = createGitRoot("dangling-symlink-target");
  fs.mkdirSync(path.join(danglingSymlinkTarget, ".claude"), { recursive: true });
  fs.symlinkSync(".claude/missing-skills", path.join(danglingSymlinkTarget, "skills"), "dir");
  const danglingBefore = snapshot(danglingSymlinkTarget);
  const danglingBlocked = run(CLI, "install", danglingSymlinkTarget, source, 2, ["--adopt-existing"]);
  const danglingBlockedOutput = `${danglingBlocked.stdout}${danglingBlocked.stderr}`;
  verify(danglingBlockedOutput.includes("TARGET_SYMLINK_DANGLING") && danglingBlockedOutput.includes("skills"), "dangling internal symlink must fail closed.");
  assert.deepEqual(snapshot(danglingSymlinkTarget), danglingBefore);
  assertions += 1;

  write(source, "rules.md", "# Consumer workflow rules v2\n");
  const update = run(CLI, "update", target, source);
  verify(update.stdout.includes("updated"), "update must report its outcome.");
  equal(fs.readFileSync(path.join(target, "rules.md"), "utf8"), "# Consumer workflow rules v2\n");
  const backupRoot = path.join(target, ".specs/workflow-runtime-backups");
  const backups = fs.readdirSync(backupRoot);
  equal(backups.length, 1, "one material update must create one backup set.");
  equal(fs.readFileSync(path.join(backupRoot, backups[0], "rules.md"), "utf8"), "# Consumer workflow rules v1\n");
  run(CLI, "update", target, source);
  equal(fs.readdirSync(backupRoot).length, 1, "idempotent update must not create another backup.");

  const driftTarget = createGitRoot("drift-target");
  seedProductFiles(driftTarget);
  run(CLI, "install", driftTarget, source);
  write(driftTarget, "rules.md", "# Local unauthorized edit\n");
  const driftBefore = snapshot(driftTarget);
  const driftCheck = run(CLI, "check", driftTarget, null, 2);
  verify(`${driftCheck.stdout}${driftCheck.stderr}`.includes("MANAGED_FILE_MODIFIED"), "check must name managed drift.");
  run(CLI, "update", driftTarget, source, 2);
  assert.deepEqual(snapshot(driftTarget), driftBefore);
  assertions += 1;
  run(CLI, "uninstall", driftTarget, null, 2);
  assert.deepEqual(snapshot(driftTarget), driftBefore);
  assertions += 1;

  const beforeUninstallProduct = Object.fromEntries(Object.entries(productBefore).filter(([key]) => key !== ".git"));
  run(CLI, "uninstall", target, null);
  verify(!fs.existsSync(path.join(target, "rules.md")), "uninstall must remove managed rules.");
  verify(!fs.existsSync(statePath), "uninstall must remove install state.");
  for (const [relative, digest] of Object.entries(beforeUninstallProduct)) {
    equal(sha256(path.join(target, relative)), digest, `product file changed during uninstall: ${relative}`);
  }
  verify(fs.existsSync(backupRoot), "recoverable update backups must survive uninstall.");

  const invalidTarget = path.join(TEMP_ROOT, "not-a-git-root");
  fs.mkdirSync(invalidTarget);
  run(CLI, "install", invalidTarget, source, 1);

  console.log(`Consumer runtime installer tests passed (${assertions} assertions).`);
} finally {
  fs.rmSync(TEMP_ROOT, { recursive: true, force: true });
}
