#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { hashTree } from "./lib/workflow-utils.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(SCRIPT_DIRECTORY, "consumer-runtime.mjs");
const BATCH = path.join(SCRIPT_DIRECTORY, "consumer-runtime-all.mjs");
const TEMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "consumer-runtime-all-test-"));
// Agent homes resolve through HOME; the suite must never touch the real ~/.agents, ~/.claude, ...
const HOME_ROOT = path.join(TEMP_ROOT, "home");
fs.mkdirSync(HOME_ROOT);
let assertions = 0;

function verify(value, message) {
  assert.ok(value, message);
  assertions += 1;
}

function equal(actual, expected, message) {
  assert.equal(actual, expected, message);
  assertions += 1;
}

function write(root, relativePath, content) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  return filePath;
}

function writeJson(root, relativePath, value) {
  return write(root, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function createGitRoot(root) {
  fs.mkdirSync(path.join(root, ".git"), { recursive: true });
  return root;
}

function createSource() {
  const root = createGitRoot(path.join(TEMP_ROOT, "agents"));
  write(root, "rules.md", "# Batch runtime rules v1\n");
  write(root, "integrations/governance/control.mjs", "export const governance = true;\n");
  write(root, "integrations/frontend/control.mjs", "export const frontend = true;\n");
  write(root, "integrations/impeccable/control.mjs", "export const impeccable = true;\n");
  write(root, ".github/agents/impeccable.md", "# Impeccable agent\n");
  write(root, ".github/hooks/impeccable.json", "{}\n");
  write(root, ".github/skills/impeccable/SKILL.md", "# Impeccable\n");
  write(root, "skills/spec-driven-engineering/SKILL.md", "---\nname: spec-driven-engineering\n---\n");
  fs.mkdirSync(path.join(root, "skills/spec-driven-engineering/scripts"), { recursive: true });
  fs.copyFileSync(CLI, path.join(root, "skills/spec-driven-engineering/scripts/consumer-runtime.mjs"));
  fs.copyFileSync(BATCH, path.join(root, "skills/spec-driven-engineering/scripts/consumer-runtime-all.mjs"));
  write(root, "skills/spec-driven-engineering/node_modules/dependency/index.js", "export default 1;\n");
  const locked = hashTree(path.join(root, "skills/spec-driven-engineering"), ["evals", "node_modules"]);
  writeJson(root, "workflow.lock.json", {
    workflowVersion: "2.4.0",
    unresolvedSkills: ["impeccable"],
    skills: [{ name: "spec-driven-engineering", source: "skills/spec-driven-engineering", sha256: locked.digest, files: locked.files }]
  });
  writeJson(root, "prompts/spec-driven/consumer-runtime.manifest.json", {
    schemaVersion: "1.0.0",
    runtimeVersion: "1.2.0",
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
  for (const gitArgs of [["init", "--quiet"], ["config", "user.email", "batch-test@example.invalid"], ["config", "user.name", "Batch Test"], ["add", "."], ["commit", "--quiet", "-m", "fixture"]]) {
    const result = spawnSync("git", gitArgs, { cwd: root, encoding: "utf8" });
    equal(result.status, 0, `Unable to prepare source history: git ${gitArgs.join(" ")}\n${result.stderr}`);
  }
  return root;
}

function run(command, args, expectedStatus) {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, HOME: HOME_ROOT } });
  equal(result.status, expectedStatus, `Unexpected status: ${command} ${args.join(" ")}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  return result;
}

function runBatch(source, command, projectsRoot, expectedStatus, extraArgs = []) {
  const args = [BATCH, command, "--source", source];
  if (projectsRoot) args.push("--projects-root", projectsRoot);
  args.push(...extraArgs);
  return run(process.execPath, args, expectedStatus);
}

try {
  verify(fs.existsSync(BATCH), "consumer-runtime-all.mjs must exist before the batch suite can execute.");
  const source = createSource();
  const projectsRoot = path.join(TEMP_ROOT, "projetos");
  const alpha = createGitRoot(path.join(projectsRoot, "alpha"));
  const beta = createGitRoot(path.join(projectsRoot, "beta"));
  const ignored = path.join(projectsRoot, "documentation");
  write(ignored, "README.md", "not a project\n");
  createGitRoot(path.join(ignored, "nested-repository"));

  run(process.execPath, [CLI, "install", "--target", beta, "--source", source], 0);
  write(source, "rules.md", "# Batch runtime rules v2\n");

  const sync = runBatch(source, "sync", null, 0);
  verify(sync.stdout.includes("[SKIPPED] documentation reason=not-a-direct-git-root"), "Batch must report non-Git direct children.");
  verify(sync.stdout.includes("[PROJECT] alpha action=install status=passed"), "Batch sync must install a project without state.");
  verify(sync.stdout.includes("[PROJECT] beta action=update status=passed"), "Batch sync must update a project with state.");
  verify(sync.stdout.indexOf("[PROJECT] alpha") < sync.stdout.indexOf("[PROJECT] beta"), "Projects must be processed in lexical order.");
  verify(sync.stdout.includes("[SUMMARY] command=sync discovered=2 passed=2 failed=0 skipped=1 agentHomes=passed"), "Batch must print a complete success summary.");
  verify(sync.stdout.includes("[AGENTS] skills action=sync status=passed") && sync.stdout.includes("[AGENTS] rules action=sync status=passed"), "Batch sync must cover agent homes even when none is configured.");
  equal(fs.readFileSync(path.join(alpha, "rules.md"), "utf8"), "# Batch runtime rules v2\n");
  equal(fs.readFileSync(path.join(beta, "rules.md"), "utf8"), "# Batch runtime rules v2\n");
  verify(!fs.existsSync(path.join(ignored, ".specs")), "Batch must not mutate an ignored directory.");
  verify(!fs.existsSync(path.join(ignored, "nested-repository", ".specs")), "Batch must not recurse into nested Git roots.");

  const check = runBatch(source, "check", projectsRoot, 0);
  verify(check.stdout.includes("[SUMMARY] command=check discovered=2 passed=2 failed=0 skipped=1"), "Explicit batch check must verify every project.");

  const gamma = createGitRoot(path.join(projectsRoot, "gamma"));
  const incompleteUpdate = runBatch(source, "update", projectsRoot, 2);
  verify(incompleteUpdate.stdout.includes("[PROJECT] gamma action=update status=failed exit=1"), "Batch update must identify a project without state.");
  verify(incompleteUpdate.stdout.includes("[SUMMARY] command=update discovered=3 passed=2 failed=1 skipped=1"), "Batch failure summary must remain complete.");
  runBatch(source, "sync", projectsRoot, 0);
  verify(fs.existsSync(path.join(gamma, ".specs/workflow-runtime-install.json")), "A later sync must install the missing project.");

  write(beta, "rules.md", "# Local drift\n");
  const delta = createGitRoot(path.join(projectsRoot, "delta"));
  const partial = runBatch(source, "sync", projectsRoot, 2);
  verify(partial.stdout.includes("[PROJECT] beta action=update status=failed exit=2"), "Batch sync must identify local drift.");
  verify(partial.stdout.includes("[PROJECT] delta action=install status=passed"), "Batch must continue after a failed project.");
  verify(partial.stdout.includes("[SUMMARY] command=sync discovered=4 passed=3 failed=1 skipped=1"), "Partial rollout must return a complete summary.");
  verify(fs.existsSync(path.join(delta, ".specs/workflow-runtime-install.json")), "A later project must still be installed after an earlier failure.");
  write(beta, "rules.md", "# Batch runtime rules v2\n");
  runBatch(source, "check", projectsRoot, 0);

  const emptyRoot = path.join(TEMP_ROOT, "empty-projects");
  fs.mkdirSync(path.join(emptyRoot, "notes"), { recursive: true });
  const empty = runBatch(source, "sync", emptyRoot, 1);
  verify(`${empty.stdout}${empty.stderr}`.includes("NO_PROJECTS_FOUND"), "An empty projects root must fail explicitly.");
  const missing = runBatch(source, "sync", path.join(TEMP_ROOT, "missing-projects"), 1);
  verify(`${missing.stdout}${missing.stderr}`.includes("PROJECTS_ROOT_INVALID"), "A missing projects root must fail explicitly.");

  const projectLikeRoot = path.join(TEMP_ROOT, "project-like-root");
  const readyProject = createGitRoot(path.join(projectLikeRoot, "ready-project"));
  const missingGitProject = path.join(projectLikeRoot, "missing-git-project");
  writeJson(missingGitProject, "package.json", { name: "missing-git-project", private: true });
  const missingGit = runBatch(source, "sync", projectLikeRoot, 2);
  verify(missingGit.stdout.includes("[PROJECT] missing-git-project action=discover status=failed exit=1 reason=git-root-required"), "A recognizable project without Git must block completion.");
  verify(missingGit.stdout.includes("[PROJECT] ready-project action=install status=passed"), "A non-Git blocker must not hide installable project results.");
  verify(missingGit.stdout.includes("[SUMMARY] command=sync discovered=2 passed=1 failed=1 skipped=0"), "Non-Git projects must be counted in the incomplete rollout summary.");
  verify(fs.existsSync(path.join(readyProject, ".specs/workflow-runtime-install.json")), "Installable projects must still complete beside a non-Git blocker.");
  verify(!fs.existsSync(path.join(missingGitProject, ".specs")), "A project without Git must not be mutated.");

  const legacyRoot = path.join(TEMP_ROOT, "legacy-projects");
  const legacy = createGitRoot(path.join(legacyRoot, "legacy"));
  write(legacy, "rules.md", "# Legacy rules\n");
  writeJson(legacy, "workflow.lock.json", { workflowVersion: "2.3.0", skills: [], unresolvedSkills: [] });
  const legacyBlocked = runBatch(source, "sync", legacyRoot, 2);
  verify(legacyBlocked.stdout.includes("[PROJECT] legacy action=install status=failed exit=2"), "Legacy adoption must remain explicit in batch mode.");
  const legacyAdopted = runBatch(source, "sync", legacyRoot, 0, ["--adopt-existing"]);
  verify(legacyAdopted.stdout.includes("[PROJECT] legacy action=install status=passed"), "Explicit batch adoption must delegate to install.");

  // Agent homes: locked skills and rules.md are verified by check and repaired by sync.
  const sourceSkill = path.join(source, "skills/spec-driven-engineering");
  const claudeSkill = path.join(HOME_ROOT, ".claude/skills/spec-driven-engineering");
  write(claudeSkill, "SKILL.md", "---\nname: spec-driven-engineering\n---\nstale\n");
  write(HOME_ROOT, ".claude/rules.md", "# Stale global rules\n");
  fs.mkdirSync(path.join(HOME_ROOT, ".gemini"));
  const driftCheck = runBatch(source, "check", projectsRoot, 2);
  verify(driftCheck.stdout.includes("[AGENTS] skills action=check status=failed") && driftCheck.stdout.includes("[AGENTS] rules action=check status=failed"), "Batch check must detect stale agent homes.");
  verify(driftCheck.stdout.includes("agentHomes=failed"), "Agent-home drift must be part of the summary.");
  equal(fs.readFileSync(path.join(claudeSkill, "SKILL.md"), "utf8"), "---\nname: spec-driven-engineering\n---\nstale\n", "Check must not repair agent homes.");
  const homeSync = runBatch(source, "sync", projectsRoot, 0);
  verify(homeSync.stdout.includes("agentHomes=passed"), "Batch sync must repair and verify agent homes.");
  equal(hashTree(claudeSkill, ["evals", "node_modules"]).digest, hashTree(sourceSkill, ["evals", "node_modules"]).digest, "Installed skill must match the locked source.");
  verify(!fs.existsSync(path.join(claudeSkill, "node_modules")), "Sync must not copy node_modules into agent homes.");
  equal(fs.readFileSync(path.join(HOME_ROOT, ".claude/rules.md"), "utf8"), "# Batch runtime rules v2\n");
  verify(fs.readdirSync(path.join(HOME_ROOT, ".agents/skill-release-backups")).some((name) => name.startsWith("claude-spec-driven-engineering-")), "Replaced agent skill must be backed up.");
  verify(!fs.existsSync(path.join(HOME_ROOT, ".gemini/skills")) && !fs.existsSync(path.join(HOME_ROOT, ".gemini/rules.md")), "Sync must not impose skills or rules on an agent home that does not use them.");
  runBatch(source, "check", projectsRoot, 0);

  write(sourceSkill, "SKILL.md", "---\nname: spec-driven-engineering\n---\nunlocked change\n");
  const unlocked = runBatch(source, "sync", projectsRoot, 2);
  verify(unlocked.stdout.includes("[SKILL] spec-driven-engineering status=failed reason=source-differs-from-lock"), "A skill that drifted from the lock must not be synced.");
  verify(!fs.readFileSync(path.join(claudeSkill, "SKILL.md"), "utf8").includes("unlocked change"), "An unlocked change must not reach agent homes.");
  write(sourceSkill, "SKILL.md", "---\nname: spec-driven-engineering\n---\n");

  fs.mkdirSync(path.join(HOME_ROOT, ".cursor/skills"), { recursive: true });
  fs.symlinkSync(sourceSkill, path.join(HOME_ROOT, ".cursor/skills/spec-driven-engineering"));
  const linked = runBatch(source, "sync", projectsRoot, 2);
  verify(linked.stdout.includes(".cursor/skills/spec-driven-engineering status=failed reason=Destination is a symlink"), "A symlinked agent skill must never be replaced.");
  verify(fs.lstatSync(path.join(HOME_ROOT, ".cursor/skills/spec-driven-engineering")).isSymbolicLink(), "The symlink must be preserved.");

  console.log(`Consumer runtime batch tests passed (${assertions} assertions).`);
} finally {
  fs.rmSync(TEMP_ROOT, { recursive: true, force: true });
}
