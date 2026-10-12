#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SOURCE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../../..");
const MANIFEST_RELATIVE_PATH = "prompts/spec-driven/consumer-runtime.manifest.json";
const STATE_SCHEMA_VERSION = "1.0.0";

class CliError extends Error {
  constructor(code, message, exitCode = 1, details = []) {
    super(message);
    this.code = code;
    this.exitCode = exitCode;
    this.details = details;
  }
}

function parseArgs(argv) {
  const parsed = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) {
      parsed._.push(value);
      continue;
    }
    const key = value.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) parsed[key] = true;
    else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function sha256Buffer(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sha256File(filePath) {
  return sha256Buffer(fs.readFileSync(filePath));
}

function readJson(filePath, code) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new CliError(code, `Cannot read valid JSON at ${filePath}: ${error.message}`);
  }
}

function portable(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function safeRelative(value, label) {
  if (typeof value !== "string" || value.trim() === "") throw new CliError("INVALID_RELATIVE_PATH", `${label} must be a non-empty relative path.`);
  const normalized = path.posix.normalize(value.replaceAll("\\", "/"));
  if (normalized === "." || normalized === ".." || normalized.startsWith("../") || path.posix.isAbsolute(normalized)) {
    throw new CliError("INVALID_RELATIVE_PATH", `${label} escapes its root: ${value}`);
  }
  return normalized;
}

function within(root, relativePath, label) {
  const resolved = path.resolve(root, safeRelative(relativePath, label));
  const prefix = `${root}${path.sep}`;
  if (resolved !== root && !resolved.startsWith(prefix)) throw new CliError("PATH_OUTSIDE_ROOT", `${label} resolves outside its root: ${relativePath}`);
  return resolved;
}

function realDirectory(value, label) {
  const resolved = fs.realpathSync(path.resolve(value));
  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) throw new CliError("ROOT_NOT_DIRECTORY", `${label} is not a directory: ${resolved}`);
  return resolved;
}

function assertGitRoot(root, label) {
  if (!fs.existsSync(path.join(root, ".git"))) throw new CliError("GIT_ROOT_REQUIRED", `${label} must be a Git root with a .git marker: ${root}`);
}

function rootsOverlap(left, right) {
  return left === right || left.startsWith(`${right}${path.sep}`) || right.startsWith(`${left}${path.sep}`);
}

function timestamp() {
  return new Date().toISOString().replace(/[-:.]/g, "").replace("T", "-").replace("Z", "Z");
}

function isExcluded(relativePath, excludedSegments) {
  const segments = portable(relativePath).split("/");
  return segments.some((segment) => excludedSegments.has(segment));
}

function validateManifest(manifest) {
  for (const key of ["schemaVersion", "runtimeVersion", "workflowVersion", "stateFile", "lockFile", "fixedEntries", "lockedSkills", "excludedSegments"]) {
    if (!(key in manifest)) throw new CliError("INVALID_DISTRIBUTION_MANIFEST", `consumer runtime manifest is missing '${key}'.`);
  }
  if (manifest.schemaVersion !== "1.0.0") throw new CliError("INVALID_DISTRIBUTION_MANIFEST", `Unsupported manifest schemaVersion '${manifest.schemaVersion}'.`);
  safeRelative(manifest.stateFile, "stateFile");
  safeRelative(manifest.lockFile, "lockFile");
  if (!Array.isArray(manifest.fixedEntries) || manifest.fixedEntries.length === 0) throw new CliError("INVALID_DISTRIBUTION_MANIFEST", "fixedEntries must be a non-empty array.");
  if (!Array.isArray(manifest.excludedSegments)) throw new CliError("INVALID_DISTRIBUTION_MANIFEST", "excludedSegments must be an array.");
  for (const [index, entry] of manifest.fixedEntries.entries()) {
    safeRelative(entry?.path, `fixedEntries[${index}].path`);
    if (!["file", "tree"].includes(entry?.kind)) throw new CliError("INVALID_DISTRIBUTION_MANIFEST", `fixedEntries[${index}].kind must be file or tree.`);
  }
  if (manifest.lockedSkills?.enabled !== true || !Array.isArray(manifest.lockedSkills.exclude)) {
    throw new CliError("INVALID_DISTRIBUTION_MANIFEST", "lockedSkills must enable lock-derived skills and declare exclude[].");
  }
}

function addSourceFile(sourceRoot, relativePath, excludedSegments, filesByPath) {
  const normalized = safeRelative(relativePath, "distribution file");
  if (isExcluded(normalized, excludedSegments)) return;
  const sourcePath = within(sourceRoot, normalized, "distribution file");
  const stat = fs.lstatSync(sourcePath, { throwIfNoEntry: false });
  if (!stat) throw new CliError("DISTRIBUTION_SOURCE_MISSING", `Distribution source is missing: ${normalized}`);
  if (stat.isSymbolicLink()) throw new CliError("DISTRIBUTION_SYMLINK_FORBIDDEN", `Distribution source may not be a symlink: ${normalized}`);
  if (!stat.isFile()) throw new CliError("DISTRIBUTION_SOURCE_INVALID", `Distribution leaf is not a regular file: ${normalized}`);
  if (filesByPath.has(normalized)) throw new CliError("DISTRIBUTION_DUPLICATE_PATH", `Distribution path is declared more than once: ${normalized}`);
  filesByPath.set(normalized, {
    path: normalized,
    sourcePath,
    sha256: sha256File(sourcePath),
    bytes: stat.size
  });
}

function addSourceTree(sourceRoot, relativeRoot, excludedSegments, filesByPath) {
  const normalizedRoot = safeRelative(relativeRoot, "distribution tree");
  const treePath = within(sourceRoot, normalizedRoot, "distribution tree");
  const rootStat = fs.lstatSync(treePath, { throwIfNoEntry: false });
  if (!rootStat) throw new CliError("DISTRIBUTION_SOURCE_MISSING", `Distribution tree is missing: ${normalizedRoot}`);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) throw new CliError("DISTRIBUTION_SOURCE_INVALID", `Distribution tree must be a real directory: ${normalizedRoot}`);
  const pending = [treePath];
  while (pending.length > 0) {
    const directory = pending.pop();
    const entries = fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => right.name.localeCompare(left.name));
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      const relative = portable(path.relative(sourceRoot, fullPath));
      if (isExcluded(relative, excludedSegments)) continue;
      if (entry.isSymbolicLink()) throw new CliError("DISTRIBUTION_SYMLINK_FORBIDDEN", `Distribution source may not contain a symlink: ${relative}`);
      if (entry.isDirectory()) pending.push(fullPath);
      else if (entry.isFile()) addSourceFile(sourceRoot, relative, excludedSegments, filesByPath);
      else throw new CliError("DISTRIBUTION_SOURCE_INVALID", `Distribution source contains a special file: ${relative}`);
    }
  }
}

function sourceCommit(sourceRoot) {
  const result = spawnSync("git", ["-C", sourceRoot, "rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  return result.status === 0 && /^[a-f0-9]{40,64}$/i.test(result.stdout.trim()) ? result.stdout.trim() : null;
}

function buildDistribution(sourceRoot) {
  const manifestPath = path.join(sourceRoot, MANIFEST_RELATIVE_PATH);
  if (!fs.existsSync(manifestPath)) throw new CliError("DISTRIBUTION_MANIFEST_MISSING", `Consumer runtime manifest not found: ${manifestPath}`);
  const manifest = readJson(manifestPath, "INVALID_DISTRIBUTION_MANIFEST");
  validateManifest(manifest);
  const excludedSegments = new Set([...manifest.excludedSegments, ...manifest.lockedSkills.exclude]);
  const filesByPath = new Map();
  for (const entry of manifest.fixedEntries) {
    if (entry.kind === "file") addSourceFile(sourceRoot, entry.path, excludedSegments, filesByPath);
    else addSourceTree(sourceRoot, entry.path, excludedSegments, filesByPath);
  }
  const lockPath = within(sourceRoot, manifest.lockFile, "workflow lock");
  const lock = readJson(lockPath, "INVALID_WORKFLOW_LOCK");
  if (lock.workflowVersion !== manifest.workflowVersion) {
    throw new CliError("WORKFLOW_VERSION_MISMATCH", `Manifest workflowVersion ${manifest.workflowVersion} differs from lock ${lock.workflowVersion}.`);
  }
  for (const skill of lock.skills || []) addSourceTree(sourceRoot, safeRelative(skill.source, `locked skill '${skill.name}' source`), excludedSegments, filesByPath);
  const files = [...filesByPath.values()].sort((left, right) => left.path.localeCompare(right.path));
  const distributionValue = {
    schemaVersion: manifest.schemaVersion,
    runtimeVersion: manifest.runtimeVersion,
    workflowVersion: manifest.workflowVersion,
    manifestSha256: sha256File(manifestPath),
    files: files.map(({ path: relativePath, sha256, bytes }) => ({ path: relativePath, sha256, bytes }))
  };
  return {
    manifest,
    files,
    manifestSha256: distributionValue.manifestSha256,
    distributionSha256: sha256Buffer(JSON.stringify(distributionValue)),
    sourceCommit: sourceCommit(sourceRoot)
  };
}

function validateState(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) throw new CliError("INVALID_INSTALL_STATE", "Install state must be an object.");
  for (const key of ["schemaVersion", "runtimeVersion", "workflowVersion", "installedAt", "updatedAt", "manifestSha256", "distributionSha256", "lastBackup", "adoptedBackup", "adoptedFiles", "managedFiles"]) {
    if (!(key in state)) throw new CliError("INVALID_INSTALL_STATE", `Install state is missing '${key}'.`);
  }
  if (state.schemaVersion !== STATE_SCHEMA_VERSION || !Array.isArray(state.managedFiles)) throw new CliError("INVALID_INSTALL_STATE", "Unsupported install state schema.");
  if (!("targetSymlinks" in state)) state.targetSymlinks = [];
  if (!Array.isArray(state.targetSymlinks)) throw new CliError("INVALID_INSTALL_STATE", "targetSymlinks must be an array.");
  const seenSymlinks = new Set();
  for (const [index, symlink] of state.targetSymlinks.entries()) {
    const logicalPath = safeRelative(symlink?.path, `targetSymlinks[${index}].path`);
    const resolvedPath = safeRelative(symlink?.resolvedPath, `targetSymlinks[${index}].resolvedPath`);
    if (logicalPath !== symlink.path || resolvedPath !== symlink.resolvedPath || seenSymlinks.has(logicalPath)) {
      throw new CliError("INVALID_INSTALL_STATE", `Invalid or duplicate target symlink path: ${symlink?.path}`);
    }
    if (typeof symlink.linkTarget !== "string" || symlink.linkTarget.length === 0 || path.isAbsolute(symlink.linkTarget)) {
      throw new CliError("INVALID_INSTALL_STATE", `Invalid target symlink value: ${logicalPath}`);
    }
    if (!['file', 'directory'].includes(symlink.targetType)) throw new CliError("INVALID_INSTALL_STATE", `Invalid target symlink type: ${logicalPath}`);
    seenSymlinks.add(logicalPath);
  }
  const seen = new Set();
  for (const [index, file] of state.managedFiles.entries()) {
    const normalized = safeRelative(file?.path, `managedFiles[${index}].path`);
    if (normalized !== file.path || seen.has(normalized)) throw new CliError("INVALID_INSTALL_STATE", `Invalid or duplicate managed path: ${file?.path}`);
    if (!/^[a-f0-9]{64}$/.test(file.sha256) || !Number.isSafeInteger(file.bytes) || file.bytes < 0) {
      throw new CliError("INVALID_INSTALL_STATE", `Invalid hash/bytes for managed file: ${normalized}`);
    }
    seen.add(normalized);
  }
  if (state.lastBackup !== null && state.lastBackup !== undefined) safeRelative(state.lastBackup, "lastBackup");
  if (state.adoptedBackup !== null && state.adoptedBackup !== undefined) safeRelative(state.adoptedBackup, "adoptedBackup");
  if (!Array.isArray(state.adoptedFiles)) throw new CliError("INVALID_INSTALL_STATE", "adoptedFiles must be an array.");
  for (const [index, file] of state.adoptedFiles.entries()) {
    safeRelative(file?.path, `adoptedFiles[${index}].path`);
    if (!/^[a-f0-9]{64}$/.test(file.sha256) || !Number.isSafeInteger(file.bytes) || file.bytes < 0) {
      throw new CliError("INVALID_INSTALL_STATE", `Invalid hash/bytes for adopted file: ${file?.path}`);
    }
  }
  return state;
}

function loadState(targetRoot, stateFile, required = true) {
  assertNoTargetSymlink(targetRoot, stateFile);
  const statePath = within(targetRoot, stateFile, "install state");
  if (!fs.existsSync(statePath)) {
    if (required) throw new CliError("INSTALL_STATE_MISSING", `Consumer runtime is not installed: ${stateFile}`);
    return null;
  }
  const stat = fs.lstatSync(statePath);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new CliError("INVALID_INSTALL_STATE", `Install state is not a regular file: ${stateFile}`);
  return validateState(readJson(statePath, "INVALID_INSTALL_STATE"));
}

function assertNoTargetSymlink(targetRoot, relativePath) {
  const parts = safeRelative(relativePath, "target path").split("/");
  let current = targetRoot;
  for (const part of parts) {
    current = path.join(current, part);
    const stat = fs.lstatSync(current, { throwIfNoEntry: false });
    if (!stat) return;
    if (stat.isSymbolicLink()) throw new CliError("TARGET_SYMLINK_FORBIDDEN", `Target path contains a symlink: ${portable(path.relative(targetRoot, current))}`, 2);
  }
}

function describeTargetSymlink(targetRoot, relativePath) {
  const logicalPath = safeRelative(relativePath, "target symlink");
  const symlinkPath = within(targetRoot, logicalPath, "target symlink");
  const stat = fs.lstatSync(symlinkPath, { throwIfNoEntry: false });
  if (!stat?.isSymbolicLink()) throw new CliError("TARGET_SYMLINK_CHANGED", `Recorded target symlink is missing or no longer a symlink: ${logicalPath}`, 2);
  const linkTarget = fs.readlinkSync(symlinkPath);
  if (path.isAbsolute(linkTarget)) throw new CliError("TARGET_SYMLINK_ABSOLUTE", `Target symlink must be relative: ${logicalPath}`, 2);
  let resolved;
  try {
    resolved = fs.realpathSync(symlinkPath);
  } catch {
    throw new CliError("TARGET_SYMLINK_DANGLING", `Target symlink is dangling: ${logicalPath}`, 2);
  }
  if (resolved === targetRoot || !resolved.startsWith(`${targetRoot}${path.sep}`)) {
    throw new CliError("TARGET_SYMLINK_OUTSIDE_ROOT", `Target symlink resolves outside the Git root: ${logicalPath}`, 2);
  }
  const resolvedPath = portable(path.relative(targetRoot, resolved));
  for (const forbiddenRoot of [".git", ".specs", ".github/workflows", "node_modules"]) {
    if (resolvedPath === forbiddenRoot || resolvedPath.startsWith(`${forbiddenRoot}/`)) {
      throw new CliError("TARGET_SYMLINK_DESTINATION_FORBIDDEN", `Target symlink resolves into a protected root: ${logicalPath}`, 2);
    }
  }
  const resolvedStat = fs.statSync(resolved);
  const targetType = resolvedStat.isDirectory() ? "directory" : resolvedStat.isFile() ? "file" : null;
  if (!targetType) throw new CliError("TARGET_SYMLINK_DESTINATION_INVALID", `Target symlink must resolve to a regular file or directory: ${logicalPath}`, 2);
  return { path: logicalPath, linkTarget, resolvedPath, targetType };
}

function discoverTargetSymlinks(targetRoot, desiredFiles) {
  const discovered = new Map();
  for (const file of desiredFiles) {
    const parts = safeRelative(file.path, "distribution target path").split("/");
    for (let index = 0; index < parts.length; index += 1) {
      const logicalPath = parts.slice(0, index + 1).join("/");
      const candidate = within(targetRoot, logicalPath, "distribution target path");
      const stat = fs.lstatSync(candidate, { throwIfNoEntry: false });
      if (!stat) break;
      if (!stat.isSymbolicLink()) continue;
      const record = describeTargetSymlink(targetRoot, logicalPath);
      if (record.targetType === "file" && index !== parts.length - 1) {
        throw new CliError("TARGET_SYMLINK_DESTINATION_INVALID", `File symlink cannot contain managed descendants: ${logicalPath}`, 2);
      }
      discovered.set(logicalPath, record);
    }
  }
  return [...discovered.values()].sort((left, right) => left.path.localeCompare(right.path));
}

function validateTargetSymlinks(targetRoot, targetSymlinks) {
  const findings = [];
  for (const expected of targetSymlinks) {
    try {
      const actual = describeTargetSymlink(targetRoot, expected.path);
      if (actual.linkTarget !== expected.linkTarget || actual.resolvedPath !== expected.resolvedPath || actual.targetType !== expected.targetType) {
        findings.push(`TARGET_SYMLINK_CHANGED ${expected.path}`);
      }
    } catch {
      findings.push(`TARGET_SYMLINK_CHANGED ${expected.path}`);
    }
  }
  return findings;
}

function mappedTargetPath(targetRoot, relativePath, targetSymlinks = []) {
  const logicalPath = safeRelative(relativePath, "target path");
  const matches = targetSymlinks
    .filter((symlink) => logicalPath === symlink.path || logicalPath.startsWith(`${symlink.path}/`))
    .sort((left, right) => right.path.length - left.path.length);
  if (matches.length === 0) {
    assertNoTargetSymlink(targetRoot, logicalPath);
    return within(targetRoot, logicalPath, "target path");
  }
  const symlink = matches[0];
  const suffix = logicalPath === symlink.path ? "" : logicalPath.slice(symlink.path.length + 1);
  if (suffix && symlink.targetType !== "directory") throw new CliError("INVALID_INSTALL_STATE", `File symlink has managed descendants: ${symlink.path}`);
  return within(targetRoot, suffix ? `${symlink.resolvedPath}/${suffix}` : symlink.resolvedPath, "mapped target path");
}

function mappedPathFindings(targetRoot, files, targetSymlinks) {
  const byActualPath = new Map();
  const findings = [];
  for (const file of files) {
    try {
      const actualPath = mappedTargetPath(targetRoot, file.path, targetSymlinks);
      const previous = byActualPath.get(actualPath);
      if (previous && previous !== file.path) findings.push(`TARGET_PATH_ALIAS_CONFLICT ${previous} ${file.path}`);
      else byActualPath.set(actualPath, file.path);
    } catch (error) {
      if (error instanceof CliError) findings.push(`${error.code} ${file.path}`);
      else throw error;
    }
  }
  return findings;
}

function diskFile(targetRoot, relativePath, targetSymlinks = []) {
  const targetPath = mappedTargetPath(targetRoot, relativePath, targetSymlinks);
  const stat = fs.lstatSync(targetPath, { throwIfNoEntry: false });
  if (!stat) return { exists: false, path: targetPath };
  if (!stat.isFile()) return { exists: true, path: targetPath, invalid: true };
  return { exists: true, path: targetPath, sha256: sha256File(targetPath), bytes: stat.size };
}

function localDrift(targetRoot, state) {
  const findings = [
    ...validateTargetSymlinks(targetRoot, state.targetSymlinks),
    ...mappedPathFindings(targetRoot, state.managedFiles, state.targetSymlinks)
  ];
  if (findings.length > 0) return findings;
  for (const file of state.managedFiles) {
    try {
      const disk = diskFile(targetRoot, file.path, state.targetSymlinks);
      if (!disk.exists) findings.push(`MANAGED_FILE_MISSING ${file.path}`);
      else if (disk.invalid) findings.push(`MANAGED_PATH_NOT_FILE ${file.path}`);
      else if (disk.sha256 !== file.sha256 || disk.bytes !== file.bytes) findings.push(`MANAGED_FILE_MODIFIED ${file.path}`);
    } catch (error) {
      if (error instanceof CliError) findings.push(`${error.code} ${file.path}`);
      else throw error;
    }
  }
  return findings;
}

function desiredState(distribution, previous = null, lastBackup = null, adoption = null, targetSymlinks = null) {
  const now = new Date().toISOString();
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    runtimeVersion: distribution.manifest.runtimeVersion,
    workflowVersion: distribution.manifest.workflowVersion,
    installedAt: previous?.installedAt || now,
    updatedAt: previous ? now : now,
    sourceCommit: distribution.sourceCommit,
    manifestSha256: distribution.manifestSha256,
    distributionSha256: distribution.distributionSha256,
    lastBackup,
    adoptedBackup: adoption?.backup || previous?.adoptedBackup || null,
    adoptedFiles: adoption?.files || previous?.adoptedFiles || [],
    targetSymlinks: targetSymlinks || previous?.targetSymlinks || [],
    managedFiles: distribution.files.map(({ path: relativePath, sha256, bytes }) => ({ path: relativePath, sha256, bytes }))
  };
}

function writeAtomic(targetPath, content) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const temporaryPath = path.join(path.dirname(targetPath), `.workflow-runtime-${process.pid}-${crypto.randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temporaryPath, content, { mode: 0o644 });
    fs.renameSync(temporaryPath, targetPath);
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
}

function copyAtomic(sourcePath, targetPath) {
  writeAtomic(targetPath, fs.readFileSync(sourcePath));
  const sourceMode = fs.statSync(sourcePath).mode & 0o777;
  fs.chmodSync(targetPath, sourceMode);
}

function removeEmptyParents(targetRoot, filePath, protectedDirectories = new Set()) {
  let current = path.dirname(filePath);
  while (current !== targetRoot && current.startsWith(`${targetRoot}${path.sep}`)) {
    if (protectedDirectories.has(current)) return;
    try {
      fs.rmdirSync(current);
      current = path.dirname(current);
    } catch {
      return;
    }
  }
}

function conflict(findings, message) {
  throw new CliError("RUNTIME_CONFLICT", message, 2, findings);
}

function preflightNewFiles(targetRoot, desiredFiles, previousByPath = new Map(), targetSymlinks = []) {
  const findings = [];
  for (const file of desiredFiles) {
    if (previousByPath.has(file.path)) continue;
    try {
      const disk = diskFile(targetRoot, file.path, targetSymlinks);
      if (disk.exists) findings.push(`UNMANAGED_FILE_CONFLICT ${file.path}`);
    } catch (error) {
      if (error instanceof CliError) findings.push(`${error.code} ${file.path}`);
      else throw error;
    }
  }
  return findings;
}

function historicalSourcePath(sourceRoot, targetRoot, file) {
  const targetPath = within(targetRoot, file.path, "legacy file");
  const blob = spawnSync("git", ["hash-object", "--", targetPath], { cwd: sourceRoot, encoding: "utf8" });
  if (blob.status !== 0 || !/^[a-f0-9]{40,64}$/.test(blob.stdout.trim())) return false;
  const history = spawnSync("git", ["rev-list", "--objects", "--all", "--", file.path], { cwd: sourceRoot, encoding: "utf8" });
  if (history.status !== 0) return false;
  const expected = `${blob.stdout.trim()} ${file.path}`;
  return history.stdout.split(/\r?\n/).some((line) => line === expected);
}

function validateLegacyAdoption(targetRoot, sourceRoot, adoptedFiles) {
  const lockPath = path.join(targetRoot, "workflow.lock.json");
  if (fs.existsSync(lockPath)) {
    try {
      const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
      if (typeof lock.workflowVersion === "string" && Array.isArray(lock.skills)) return "workflow-lock";
    } catch {
      // Git provenance remains an accepted fallback for an invalid or absent legacy lock.
    }
  }
  const unproven = adoptedFiles.filter((file) => !historicalSourcePath(sourceRoot, targetRoot, file));
  if (unproven.length === 0) return "source-git-history";
  conflict(
    [
      fs.existsSync(lockPath) ? "ADOPTION_EVIDENCE_INVALID workflow.lock.json" : "ADOPTION_EVIDENCE_MISSING workflow.lock.json",
      ...unproven.map((file) => `ADOPTION_PROVENANCE_MISSING ${file.path}`)
    ],
    "Legacy adoption requires a valid workflow lock or same-path provenance in source Git history."
  );
}

function createBackup(targetRoot, files, suffix, targetSymlinks = []) {
  if (files.length === 0) return null;
  const backupRelative = `.specs/workflow-runtime-backups/${timestamp()}-${suffix}`;
  for (const file of files) {
    const sourcePath = mappedTargetPath(targetRoot, file.path, targetSymlinks);
    const backupPath = within(targetRoot, `${backupRelative}/${file.path}`, "backup file");
    assertNoTargetSymlink(targetRoot, `${backupRelative}/${file.path}`);
    copyAtomic(sourcePath, backupPath);
  }
  return backupRelative;
}

function commandInstall(sourceRoot, targetRoot, options = {}) {
  const distribution = buildDistribution(sourceRoot);
  const stateFile = distribution.manifest.stateFile;
  const existingState = loadState(targetRoot, stateFile, false);
  if (existingState) {
    const drift = localDrift(targetRoot, existingState);
    if (drift.length > 0) conflict(drift, "Installed runtime contains local drift.");
    if (existingState.distributionSha256 === distribution.distributionSha256) {
      console.log(`Consumer runtime already installed and current (${existingState.managedFiles.length} files).`);
      return;
    }
    conflict(["RUNTIME_ALREADY_INSTALLED_USE_UPDATE"], "A different runtime version is already installed; use update.");
  }
  const statePath = within(targetRoot, stateFile, "install state");
  if (fs.existsSync(statePath)) conflict([`UNMANAGED_INSTALL_STATE ${stateFile}`], "Install state path already exists but is not a valid managed state.");
  const targetSymlinks = options.adoptExisting ? discoverTargetSymlinks(targetRoot, distribution.files) : [];
  const findings = [
    ...mappedPathFindings(targetRoot, distribution.files, targetSymlinks),
    ...preflightNewFiles(targetRoot, distribution.files, new Map(), targetSymlinks)
  ];
  let adoption = null;
  if (findings.length > 0) {
    if (!options.adoptExisting) conflict(findings, "Unmanaged files conflict with the consumer runtime distribution.");
    const adoptable = findings.filter((finding) => finding.startsWith("UNMANAGED_FILE_CONFLICT "));
    if (adoptable.length !== findings.length) conflict(findings, "Legacy adoption cannot accept symlinks or non-file conflicts.");
    const adoptedFiles = adoptable.map((finding) => {
      const relativePath = finding.slice("UNMANAGED_FILE_CONFLICT ".length);
      const disk = diskFile(targetRoot, relativePath, targetSymlinks);
      if (!disk.exists || disk.invalid) conflict([`ADOPTION_FILE_INVALID ${relativePath}`], "Legacy adoption can back up regular files only.");
      return { path: relativePath, sha256: disk.sha256, bytes: disk.bytes };
    });
    validateLegacyAdoption(targetRoot, sourceRoot, adoptedFiles);
    adoption = { backup: createBackup(targetRoot, adoptedFiles, "adopt", targetSymlinks), files: adoptedFiles };
  }
  const adoptedPaths = new Set((adoption?.files || []).map((file) => file.path));
  for (const file of distribution.files) {
    const disk = diskFile(targetRoot, file.path, targetSymlinks);
    if (!disk.exists || adoptedPaths.has(file.path)) copyAtomic(file.sourcePath, disk.path);
  }
  const state = desiredState(distribution, null, adoption?.backup || null, adoption, targetSymlinks);
  writeAtomic(statePath, `${JSON.stringify(state, null, 2)}\n`);
  console.log(`Consumer runtime installed (${state.managedFiles.length} files, workflow ${state.workflowVersion}, runtime ${state.runtimeVersion}${adoption ? `; adopted backup ${adoption.backup}` : ""}).`);
}

function commandCheck(targetRoot, sourceRoot = null) {
  let stateFile = ".specs/workflow-runtime-install.json";
  let distribution = null;
  if (sourceRoot) {
    distribution = buildDistribution(sourceRoot);
    stateFile = distribution.manifest.stateFile;
  }
  const state = loadState(targetRoot, stateFile, true);
  const findings = localDrift(targetRoot, state);
  if (distribution && state.distributionSha256 !== distribution.distributionSha256) findings.push("SOURCE_DISTRIBUTION_MISMATCH");
  if (findings.length > 0) conflict(findings, "Consumer runtime check failed.");
  console.log(`Consumer runtime check passed (${state.managedFiles.length} files, workflow ${state.workflowVersion}, runtime ${state.runtimeVersion}).`);
}

function commandUpdate(sourceRoot, targetRoot) {
  const distribution = buildDistribution(sourceRoot);
  const stateFile = distribution.manifest.stateFile;
  const previous = loadState(targetRoot, stateFile, true);
  const findings = localDrift(targetRoot, previous);
  const previousByPath = new Map(previous.managedFiles.map((file) => [file.path, file]));
  findings.push(...preflightNewFiles(targetRoot, distribution.files, previousByPath, previous.targetSymlinks));
  if (findings.length > 0) conflict(findings, "Consumer runtime update is blocked by local drift or unmanaged conflicts.");
  if (previous.distributionSha256 === distribution.distributionSha256) {
    console.log(`Consumer runtime already updated (${previous.managedFiles.length} files).`);
    return;
  }

  const desiredByPath = new Map(distribution.files.map((file) => [file.path, file]));
  const changedOldFiles = previous.managedFiles.filter((file) => {
    const desired = desiredByPath.get(file.path);
    return !desired || desired.sha256 !== file.sha256 || desired.bytes !== file.bytes;
  });
  let backupRelative = null;
  if (changedOldFiles.length > 0) {
    backupRelative = createBackup(targetRoot, changedOldFiles, "update", previous.targetSymlinks);
  }

  for (const file of distribution.files) {
    const previousFile = previousByPath.get(file.path);
    if (!previousFile || previousFile.sha256 !== file.sha256 || previousFile.bytes !== file.bytes) {
      copyAtomic(file.sourcePath, mappedTargetPath(targetRoot, file.path, previous.targetSymlinks));
    }
  }
  const obsolete = previous.managedFiles.filter((file) => !desiredByPath.has(file.path)).sort((left, right) => right.path.length - left.path.length);
  for (const file of obsolete) {
    const filePath = mappedTargetPath(targetRoot, file.path, previous.targetSymlinks);
    fs.rmSync(filePath);
    const protectedDirectories = new Set(previous.targetSymlinks.filter((symlink) => symlink.targetType === "directory").map((symlink) => within(targetRoot, symlink.resolvedPath, "protected symlink destination")));
    removeEmptyParents(targetRoot, filePath, protectedDirectories);
  }
  const state = desiredState(distribution, previous, backupRelative || previous.lastBackup);
  writeAtomic(within(targetRoot, stateFile, "install state"), `${JSON.stringify(state, null, 2)}\n`);
  console.log(`Consumer runtime updated (${state.managedFiles.length} files${backupRelative ? `; backup ${backupRelative}` : ""}).`);
}

function commandUninstall(targetRoot) {
  const stateFile = ".specs/workflow-runtime-install.json";
  const state = loadState(targetRoot, stateFile, true);
  const findings = localDrift(targetRoot, state);
  if (state.adoptedFiles.length > 0 && !state.adoptedBackup) findings.push("ADOPTED_BACKUP_MISSING");
  for (const file of state.adoptedFiles) {
    if (!state.adoptedBackup) break;
    const backup = diskFile(targetRoot, `${state.adoptedBackup}/${file.path}`);
    if (!backup.exists || backup.invalid || backup.sha256 !== file.sha256 || backup.bytes !== file.bytes) findings.push(`ADOPTED_BACKUP_INVALID ${file.path}`);
  }
  if (findings.length > 0) conflict(findings, "Consumer runtime uninstall is blocked by local drift.");
  const protectedDirectories = new Set(state.targetSymlinks.filter((symlink) => symlink.targetType === "directory").map((symlink) => within(targetRoot, symlink.resolvedPath, "protected symlink destination")));
  const ordered = [...state.managedFiles].sort((left, right) => right.path.length - left.path.length);
  for (const file of ordered) {
    const filePath = mappedTargetPath(targetRoot, file.path, state.targetSymlinks);
    fs.rmSync(filePath);
    removeEmptyParents(targetRoot, filePath, protectedDirectories);
  }
  for (const file of state.adoptedFiles) {
    copyAtomic(
      within(targetRoot, `${state.adoptedBackup}/${file.path}`, "adopted backup file"),
      mappedTargetPath(targetRoot, file.path, state.targetSymlinks)
    );
  }
  fs.rmSync(within(targetRoot, stateFile, "install state"));
  removeEmptyParents(targetRoot, within(targetRoot, stateFile, "install state"));
  console.log(`Consumer runtime uninstalled (${state.managedFiles.length} files removed; backups preserved).`);
}

function usage() {
  return [
    "Usage:",
    "  node consumer-runtime.mjs install --target <project-root> [--source <workflow-root>] [--adopt-existing]",
    "  node consumer-runtime.mjs update --target <project-root> [--source <workflow-root>]",
    "  node consumer-runtime.mjs check --target <project-root> [--source <workflow-root>]",
    "  node consumer-runtime.mjs uninstall --target <project-root>"
  ].join("\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];
  if (!command || !["install", "update", "check", "uninstall"].includes(command) || !args.target) throw new CliError("INVALID_USAGE", usage());
  const targetRoot = realDirectory(String(args.target), "target");
  assertGitRoot(targetRoot, "target");
  let sourceRoot = null;
  if (command !== "uninstall" && (command !== "check" || args.source)) {
    sourceRoot = realDirectory(String(args.source || DEFAULT_SOURCE_ROOT), "source");
    assertGitRoot(sourceRoot, "source");
    if (rootsOverlap(sourceRoot, targetRoot)) throw new CliError("OVERLAPPING_ROOTS", "Source and target roots must be distinct and non-nested.");
  }
  if (command === "install") commandInstall(sourceRoot, targetRoot, { adoptExisting: args["adopt-existing"] === true });
  else if (command === "update") commandUpdate(sourceRoot, targetRoot);
  else if (command === "check") commandCheck(targetRoot, sourceRoot);
  else commandUninstall(targetRoot);
}

try {
  main();
} catch (error) {
  const known = error instanceof CliError ? error : new CliError("UNEXPECTED_FAILURE", error.stack || error.message);
  console.error(`[${known.code}] ${known.message}`);
  for (const detail of known.details) console.error(`- ${detail}`);
  process.exitCode = known.exitCode;
}
