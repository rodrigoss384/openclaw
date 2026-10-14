#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "./lib/workflow-utils.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const SINGLE_PROJECT_CLI = path.join(SCRIPT_DIRECTORY, "consumer-runtime.mjs");
const SKILL_SYNC_CLI = path.join(SCRIPT_DIRECTORY, "sync-install.mjs");
const RULES_SYNC_CLI = path.join(SCRIPT_DIRECTORY, "sync-rules-to-agents.mjs");
const DEFAULT_SOURCE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../../..");
const STATE_FILE = ".specs/workflow-runtime-install.json";
const COMMANDS = new Set(["sync", "install", "update", "check"]);
const PROJECT_MARKERS = ["package.json", "pyproject.toml", "Cargo.toml", "go.mod", "pom.xml", "build.gradle", "composer.json", "Gemfile", "mix.exs", "deno.json"];

function usage() {
  return [
    "Usage:",
    "  node consumer-runtime-all.mjs sync [--projects-root <directory>] [--source <workflow-root>] [--adopt-existing]",
    "  node consumer-runtime-all.mjs install [--projects-root <directory>] [--source <workflow-root>] [--adopt-existing]",
    "  node consumer-runtime-all.mjs update|check [--projects-root <directory>] [--source <workflow-root>]"
  ].join("\n");
}

function fail(code, message) {
  console.error(`[${code}] ${message}`);
  process.exitCode = 1;
}

function realDirectory(value, code, label) {
  const resolved = path.resolve(String(value));
  const stat = fs.statSync(resolved, { throwIfNoEntry: false });
  if (!stat?.isDirectory()) {
    fail(code, `${label} must be an existing directory: ${resolved}`);
    return null;
  }
  return fs.realpathSync(resolved);
}

function isGitRoot(directory) {
  const marker = fs.statSync(path.join(directory, ".git"), { throwIfNoEntry: false });
  return Boolean(marker?.isDirectory() || marker?.isFile());
}

function safeLabel(value) {
  return value.replace(/[^\x20-\x7e]/g, "?");
}

function discoverProjects(projectsRoot) {
  const candidates = [];
  const skipped = [];
  const entries = fs.readdirSync(projectsRoot, { withFileTypes: true }).sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
  for (const entry of entries) {
    const candidate = path.join(projectsRoot, entry.name);
    if (!entry.isDirectory()) continue;
    if (isGitRoot(candidate)) candidates.push({ name: entry.name, root: fs.realpathSync(candidate), installable: true });
    else if (PROJECT_MARKERS.some((marker) => fs.existsSync(path.join(candidate, marker)))) candidates.push({ name: entry.name, root: candidate, installable: false });
    else skipped.push(entry.name);
  }
  return { candidates, skipped };
}

function runSingleProject(action, projectRoot, sourceRoot, adoptExisting) {
  const args = [SINGLE_PROJECT_CLI, action, "--target", projectRoot, "--source", sourceRoot];
  if (action === "install" && adoptExisting) args.push("--adopt-existing");
  return spawnSync(process.execPath, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function printFailureDetails(projectName, result) {
  const details = `${result.stdout || ""}${result.stderr || ""}`.trim();
  for (const line of details.split(/\r?\n/).filter(Boolean)) console.log(`[DETAIL] ${safeLabel(projectName)} ${line}`);
}

// Global agent homes (~/.agents, ~/.claude, ...) carry the locked skills and rules.md that
// every CLI discovers by name; sync installs then verifies them, check only verifies.
function syncAgentHomes(command, sourceRoot) {
  const steps = [
    ["skills", SKILL_SYNC_CLI, ["--all", "--root", sourceRoot]],
    ["rules", RULES_SYNC_CLI, ["--source", path.join(sourceRoot, "rules.md")]]
  ];
  let passed = true;
  for (const [label, script, args] of steps) {
    let result;
    for (const flag of command === "sync" ? ["--install", "--check"] : ["--check"]) {
      result = spawnSync(process.execPath, [script, ...args, flag], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      if (result.status !== 0) break;
    }
    console.log(`[AGENTS] ${label} action=${command} status=${result.status === 0 ? "passed" : "failed"}`);
    if (result.status !== 0) {
      passed = false;
      printFailureDetails(`agents-${label}`, result);
    }
  }
  return passed;
}

function executeProject(command, project, sourceRoot, adoptExisting) {
  const hasState = fs.existsSync(path.join(project.root, STATE_FILE));
  const action = command === "sync" ? (hasState ? "update" : "install") : command;
  const actionResult = runSingleProject(action, project.root, sourceRoot, adoptExisting);
  if (actionResult.status !== 0) return { action, status: actionResult.status ?? 1, result: actionResult };
  if (action === "check") return { action, status: 0, result: actionResult };
  const checkResult = runSingleProject("check", project.root, sourceRoot, false);
  return { action, status: checkResult.status ?? 1, result: checkResult };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];
  const allowedKeys = new Set(["_", "source", "projects-root", "adopt-existing"]);
  const unknownKeys = Object.keys(args).filter((key) => !allowedKeys.has(key));
  if (!COMMANDS.has(command) || args._.length !== 1 || unknownKeys.length > 0) {
    fail("INVALID_USAGE", usage());
    return;
  }
  if (args["adopt-existing"] !== undefined && args["adopt-existing"] !== true) {
    fail("INVALID_USAGE", "--adopt-existing does not accept a value.");
    return;
  }
  if (args["adopt-existing"] && !["sync", "install"].includes(command)) {
    fail("INVALID_USAGE", "--adopt-existing is valid only for sync or install.");
    return;
  }
  const sourceRoot = realDirectory(args.source || DEFAULT_SOURCE_ROOT, "SOURCE_ROOT_INVALID", "Source root");
  if (!sourceRoot) return;
  if (!isGitRoot(sourceRoot)) {
    fail("SOURCE_ROOT_INVALID", "Source root must be a Git root.");
    return;
  }
  if (![SINGLE_PROJECT_CLI, SKILL_SYNC_CLI, RULES_SYNC_CLI].every((cli) => fs.statSync(cli, { throwIfNoEntry: false })?.isFile())) {
    fail("INSTALLER_MISSING", "Consumer runtime or agent-home sync CLI is unavailable.");
    return;
  }
  const projectsRoot = realDirectory(args["projects-root"] || path.resolve(sourceRoot, "../projetos"), "PROJECTS_ROOT_INVALID", "Projects root");
  if (!projectsRoot) return;
  const { candidates, skipped } = discoverProjects(projectsRoot);
  for (const name of skipped) console.log(`[SKIPPED] ${safeLabel(name)} reason=not-a-direct-git-root`);
  if (candidates.length === 0) {
    fail("NO_PROJECTS_FOUND", "Projects root contains no direct child Git roots.");
    return;
  }

  const agentHomes = ["sync", "check"].includes(command) ? (syncAgentHomes(command, sourceRoot) ? "passed" : "failed") : "not-run";
  let passed = 0;
  let failed = 0;
  for (const project of candidates) {
    if (!project.installable) {
      failed += 1;
      console.log(`[PROJECT] ${safeLabel(project.name)} action=discover status=failed exit=1 reason=git-root-required`);
      continue;
    }
    const outcome = executeProject(command, project, sourceRoot, args["adopt-existing"] === true);
    if (outcome.status === 0) {
      passed += 1;
      console.log(`[PROJECT] ${safeLabel(project.name)} action=${outcome.action} status=passed`);
    } else {
      failed += 1;
      console.log(`[PROJECT] ${safeLabel(project.name)} action=${outcome.action} status=failed exit=${outcome.status}`);
      printFailureDetails(project.name, outcome.result);
    }
  }
  console.log(`[SUMMARY] command=${command} discovered=${candidates.length} passed=${passed} failed=${failed} skipped=${skipped.length} agentHomes=${agentHomes}`);
  process.exitCode = failed === 0 && agentHomes !== "failed" ? 0 : 2;
}

main();
