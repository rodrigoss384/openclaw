#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import {
  spawnSync
} from "node:child_process";

import {
  IssueCollector,
  asArray,
  parseCliArgs,
  readJsonFile,
  requireInputPath,
  resolveFromCwd,
  setExitCode
} from "./lib/screen-contract-utils.mjs";

const USAGE = [
  "node audit-small-slice-scope.mjs",
  "<small-slice-manifest.json>",
  "[--strict-warnings]",
  "[--json]"
].join(" ");

const DEPENDENCY_SECTIONS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies"
];

const LOCKFILE_NAMES = new Set([
  "package-lock.json",
  "npm-shrinkwrap.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lock",
  "bun.lockb"
]);

const PROHIBITED_PATH_SEGMENTS = new Set([
  "temp",
  "tmp",
  "mockup",
  "prototype",
  "prototype-only",
  "experimental-final",
  "new-version",
  "throwaway",
  "v2"
]);

function normalizeRepositoryPath(value) {
  if (
    typeof value !== "string" ||
    value.trim() === ""
  ) {
    return null;
  }

  const candidate = value
    .trim()
    .replaceAll("\\", "/")
    .replace(/^\.\/+/, "");

  if (
    candidate.startsWith("~/") ||
    path.posix.isAbsolute(candidate)
  ) {
    return null;
  }

  const normalized = path.posix.normalize(candidate);

  if (
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../")
  ) {
    return null;
  }

  return normalized;
}

function runGit(
  repositoryRoot,
  argumentsList,
  {
    allowFailure = false
  } = {}
) {
  const execution = spawnSync(
    "git",
    [
      "-C",
      repositoryRoot,
      ...argumentsList
    ],
    {
      encoding: "utf8",
      windowsHide: true
    }
  );

  if (execution.error) {
    throw execution.error;
  }

  if (
    execution.status !== 0 &&
    !allowFailure
  ) {
    throw new Error(
      [
        "Git command failed:",
        "git",
        "-C",
        repositoryRoot,
        ...argumentsList,
        execution.stderr?.trim()
      ]
        .filter(Boolean)
        .join(" ")
    );
  }

  return {
    status: execution.status ?? 1,
    stdout: execution.stdout ?? "",
    stderr: execution.stderr ?? ""
  };
}

function parseNullSeparated(value) {
  return value
    .split("\0")
    .map((item) => item.trim())
    .filter(Boolean);
}

function collectChangedPaths(
  repositoryRoot,
  baselineCommit
) {
  const paths = new Set();

  for (const filter of [
    "A",
    "MTUXB",
    "D"
  ]) {
    const result = runGit(
      repositoryRoot,
      [
        "diff",
        "--name-only",
        "--no-renames",
        `--diff-filter=${filter}`,
        "-z",
        baselineCommit,
        "--"
      ]
    );

    for (const changedPath of parseNullSeparated(result.stdout)) {
      const normalized =
        normalizeRepositoryPath(changedPath);

      if (normalized) {
        paths.add(normalized);
      }
    }
  }

  const untracked = runGit(
    repositoryRoot,
    [
      "ls-files",
      "--others",
      "--exclude-standard",
      "-z"
    ]
  );

  for (const changedPath of parseNullSeparated(untracked.stdout)) {
    const normalized =
      normalizeRepositoryPath(changedPath);

    if (normalized) {
      paths.add(normalized);
    }
  }

  return paths;
}

function resolveRepositoryRoot(
  manifest,
  collector
) {
  const declared =
    manifest?.repository?.root ?? ".";

  const candidate = resolveFromCwd(declared);

  const result = runGit(
    candidate,
    [
      "rev-parse",
      "--show-toplevel"
    ],
    {
      allowFailure: true
    }
  );

  if (result.status !== 0) {
    collector.error(
      "SLICE_SCOPE_GIT_ROOT",
      "The declared repository root is not a Git repository.",
      "$.repository.root",
      {
        declared,
        candidate,
        error: result.stderr.trim()
      }
    );

    return null;
  }

  return path.normalize(result.stdout.trim());
}

async function readCurrentJson(
  repositoryRoot,
  repositoryPath
) {
  const absolutePath = path.resolve(
    repositoryRoot,
    repositoryPath
  );

  try {
    return JSON.parse(
      await fs.readFile(
        absolutePath,
        "utf8"
      )
    );
  } catch {
    return null;
  }
}

function readBaselineJson(
  repositoryRoot,
  baselineCommit,
  repositoryPath
) {
  const result = runGit(
    repositoryRoot,
    [
      "show",
      `${baselineCommit}:${repositoryPath}`
    ],
    {
      allowFailure: true
    }
  );

  if (result.status !== 0) {
    return null;
  }

  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

function flattenDependencies(packageJson) {
  const result = new Map();

  if (
    !packageJson ||
    typeof packageJson !== "object"
  ) {
    return result;
  }

  for (const section of DEPENDENCY_SECTIONS) {
    const dependencies =
      packageJson[section];

    if (
      !dependencies ||
      typeof dependencies !== "object"
    ) {
      continue;
    }

    for (
      const [
        dependencyName,
        dependencyVersion
      ] of Object.entries(dependencies)
    ) {
      result.set(
        dependencyName,
        {
          section,
          version: String(dependencyVersion)
        }
      );
    }
  }

  return result;
}

function compareDependencies(
  baselinePackage,
  currentPackage,
  packageFile
) {
  const baseline =
    flattenDependencies(baselinePackage);

  const current =
    flattenDependencies(currentPackage);

  const names = new Set([
    ...baseline.keys(),
    ...current.keys()
  ]);

  const changes = [];

  for (const name of names) {
    const before = baseline.get(name);
    const after = current.get(name);

    if (!before && after) {
      changes.push({
        name,
        packageFile,
        change: "add",
        before: null,
        after
      });

      continue;
    }

    if (before && !after) {
      changes.push({
        name,
        packageFile,
        change: "remove",
        before,
        after: null
      });

      continue;
    }

    if (
      before.version !== after.version ||
      before.section !== after.section
    ) {
      changes.push({
        name,
        packageFile,
        change: "update",
        before,
        after
      });
    }
  }

  return changes;
}

function approvedDependencyKey(change) {
  return [
    normalizeRepositoryPath(change?.packageFile),
    change?.name,
    change?.change
  ].join("::");
}

async function auditDependencies({
  repositoryRoot,
  baselineCommit,
  changedPaths,
  manifest,
  collector
}) {
  const approvedChanges = asArray(
    manifest?.scope?.approvedDependencyChanges
  );

  const approvedMap = new Map(
    approvedChanges.map((change) => [
      approvedDependencyKey(change),
      change
    ])
  );

  const packageFiles = new Set(
    [
      ...changedPaths
    ].filter((repositoryPath) => {
      return path.posix.basename(repositoryPath) ===
        "package.json";
    })
  );

  for (const approved of approvedChanges) {
    const normalized =
      normalizeRepositoryPath(approved?.packageFile);

    if (normalized) {
      packageFiles.add(normalized);
    }
  }

  const actualDependencyChanges = [];

  for (const packageFile of packageFiles) {
    const baselinePackage = readBaselineJson(
      repositoryRoot,
      baselineCommit,
      packageFile
    );

    const currentPackage = await readCurrentJson(
      repositoryRoot,
      packageFile
    );

    actualDependencyChanges.push(
      ...compareDependencies(
        baselinePackage,
        currentPackage,
        packageFile
      )
    );
  }

  const actualKeys = new Set();

  for (const change of actualDependencyChanges) {
    const key = approvedDependencyKey(change);

    actualKeys.add(key);

    if (!approvedMap.has(key)) {
      collector.error(
        "SLICE_SCOPE_DEPENDENCY_UNAPPROVED",
        `Dependency '${change.name}' has an unapproved ` +
        `'${change.change}' change in '${change.packageFile}'.`,
        "$.scope.approvedDependencyChanges",
        change
      );
    } else {
      collector.info(
        "SLICE_SCOPE_DEPENDENCY_APPROVED",
        `Approved dependency change matched: '${change.name}'.`,
        change.packageFile,
        change
      );
    }
  }

  for (const approved of approvedChanges) {
    const key = approvedDependencyKey(approved);

    if (!actualKeys.has(key)) {
      collector.warning(
        "SLICE_SCOPE_APPROVED_DEPENDENCY_NOT_CHANGED",
        `Approved dependency change '${approved?.name}' was not ` +
        "detected in the repository.",
        "$.scope.approvedDependencyChanges",
        approved
      );
    }
  }

  return actualDependencyChanges;
}

function auditLockfiles({
  changedPaths,
  manifest,
  actualDependencyChanges,
  collector
}) {
  const authoritativeLockfile =
    normalizeRepositoryPath(
      manifest?.repository
        ?.packageManager
        ?.lockfile
    );

  const changedLockfiles = [
    ...changedPaths
  ].filter((repositoryPath) => {
    return LOCKFILE_NAMES.has(
      path.posix.basename(repositoryPath)
    );
  });

  for (const changedLockfile of changedLockfiles) {
    if (
      !authoritativeLockfile ||
      changedLockfile !== authoritativeLockfile
    ) {
      collector.error(
        "SLICE_SCOPE_NON_AUTHORITATIVE_LOCKFILE",
        `Changed lockfile '${changedLockfile}' is not the declared ` +
        "authoritative lockfile.",
        "$.repository.packageManager.lockfile",
        {
          authoritativeLockfile
        }
      );
    }
  }

  if (
    authoritativeLockfile &&
    changedPaths.has(authoritativeLockfile) &&
    actualDependencyChanges.length === 0
  ) {
    collector.warning(
      "SLICE_SCOPE_LOCKFILE_WITHOUT_DEPENDENCY_CHANGE",
      `Authoritative lockfile '${authoritativeLockfile}' changed, ` +
      "but no dependency change was detected.",
      "$.repository.packageManager.lockfile"
    );
  }
}

async function auditPackageManagerMigration({
  repositoryRoot,
  baselineCommit,
  manifest,
  collector
}) {
  const rootPackagePath = "package.json";

  const baselinePackage = readBaselineJson(
    repositoryRoot,
    baselineCommit,
    rootPackagePath
  );

  const currentPackage = await readCurrentJson(
    repositoryRoot,
    rootPackagePath
  );

  const baselineManager =
    baselinePackage?.packageManager ?? null;

  const currentManager =
    currentPackage?.packageManager ?? null;

  if (
    baselineManager !== currentManager &&
    manifest?.repository?.migrationApproved !== true
  ) {
    collector.error(
      "SLICE_SCOPE_PACKAGE_MANAGER_MIGRATION",
      "The root packageManager field changed without an approved migration.",
      "$.repository.migrationApproved",
      {
        baseline: baselineManager,
        current: currentManager
      }
    );
  }
}

function auditManifestPaths(
  manifest,
  collector
) {
  asArray(manifest?.files).forEach(
    (filePlan, index) => {
      const normalized =
        normalizeRepositoryPath(filePlan?.path);

      if (!normalized) {
        return;
      }

      const segments =
        normalized.split("/");

      for (const segment of segments) {
        if (
          PROHIBITED_PATH_SEGMENTS.has(
            segment.toLowerCase()
          )
        ) {
          collector.error(
            "SLICE_SCOPE_PROHIBITED_PATH",
            `File '${normalized}' uses prohibited temporary or ` +
            `parallel path segment '${segment}'.`,
            `$.files[${index}].path`
          );
        }
      }

      if (
        filePlan?.action === "remove" &&
        filePlan?.disposition === "production"
      ) {
        collector.warning(
          "SLICE_SCOPE_PRODUCTION_REMOVAL",
          `Production file '${normalized}' is planned for removal. ` +
          "Confirm that this remains inside the approved slice.",
          `$.files[${index}]`
        );
      }
    }
  );
}

function auditApplicationBoundary(
  manifest,
  collector
) {
  const applicationPackage =
    normalizeRepositoryPath(
      manifest?.repository?.applicationPackage
    );

  if (
    !applicationPackage ||
    applicationPackage === "."
  ) {
    return;
  }

  const allowedPrefixes = [
    applicationPackage,
    "docs/frontend",
    ...asArray(
      manifest?.architecture?.componentSources
    ),
    ...asArray(
      manifest?.architecture?.tokenSources
    )
  ]
    .map(normalizeRepositoryPath)
    .filter(Boolean);

  for (
    const [
      index,
      filePlan
    ] of asArray(manifest?.files).entries()
  ) {
    const repositoryPath =
      normalizeRepositoryPath(filePlan?.path);

    if (!repositoryPath) {
      continue;
    }

    const isAllowed = allowedPrefixes.some(
      (prefix) => {
        return repositoryPath === prefix ||
          repositoryPath.startsWith(
            `${prefix}/`
          );
      }
    );

    if (!isAllowed) {
      collector.warning(
        "SLICE_SCOPE_OUTSIDE_APPLICATION",
        `File '${repositoryPath}' is outside the declared application ` +
        "package and known component or token sources.",
        `$.files[${index}].path`,
        {
          applicationPackage,
          allowedPrefixes
        }
      );
    }
  }
}

function auditRouteExpansion(
  manifest,
  collector
) {
  const routeLikeFiles = asArray(manifest?.files)
    .filter((filePlan) => {
      const normalized =
        normalizeRepositoryPath(filePlan?.path);

      if (!normalized) {
        return false;
      }

      return (
        normalized.includes("/routes/") ||
        normalized.includes("/route/") ||
        /(^|[-_.])route[-_.]/i.test(
          path.posix.basename(normalized)
        )
      ) && [
        "create",
        "modify"
      ].includes(filePlan?.action);
    });

  if (routeLikeFiles.length > 1) {
    collector.warning(
      "SLICE_SCOPE_MULTIPLE_ROUTE_FILES",
      "The slice changes more than one route-like file. Confirm that " +
      "no additional route or parallel surface is being introduced.",
      "$.files",
      routeLikeFiles.map((file) => file.path)
    );
  }
}

function auditBlockers(
  manifest,
  collector
) {
  const blockers = asArray(
    manifest?.scope?.blockers
  ).filter((blocker) => {
    return typeof blocker === "string" &&
      blocker.trim() !== "";
  });

  if (blockers.length > 0) {
    collector.error(
      "SLICE_SCOPE_BLOCKERS",
      "The manifest contains unresolved scope blockers.",
      "$.scope.blockers",
      blockers
    );
  }

  const triggered = asArray(
    manifest?.stopConditions
  ).filter((condition) => {
    return condition?.status === "triggered";
  });

  if (triggered.length > 0) {
    collector.error(
      "SLICE_SCOPE_STOP_CONDITION",
      "One or more stop conditions remain triggered.",
      "$.stopConditions",
      triggered.map((condition) => condition.id)
    );
  }

  if (
    manifest?.repository?.migrationRequired === true &&
    manifest?.repository?.migrationApproved !== true
  ) {
    collector.error(
      "SLICE_SCOPE_MIGRATION_UNAPPROVED",
      "A required migration is not approved.",
      "$.repository.migrationApproved"
    );
  }
}

function auditInstalledPaths(
  manifest,
  collector
) {
  const serialized = JSON.stringify(manifest);

  if (
    serialized.includes(
      "skills-src/frontend-product-builder"
    )
  ) {
    collector.error(
      "SLICE_SCOPE_STAGING_REFERENCE",
      "The manifest contains a staging skill path.",
      "$"
    );
  }

  if (
    serialized.includes(
      "node .agents/skills/frontend-product-builder"
    )
  ) {
    collector.error(
      "SLICE_SCOPE_WORKSPACE_SKILL_REFERENCE",
      "The manifest contains a workspace-relative skill command.",
      "$"
    );
  }
}

async function main() {
  const options = parseCliArgs(
    process.argv.slice(2)
  );

  const inputPath = requireInputPath(
    options,
    USAGE
  );

  const collector = new IssueCollector();

  let manifestFile;

  try {
    manifestFile = await readJsonFile(inputPath);
  } catch (error) {
    collector.error(
      "SLICE_SCOPE_MANIFEST_JSON",
      error.message,
      inputPath
    );

    collector.print(
      "Small Slice Scope Audit",
      {
        json: options.json
      }
    );

    setExitCode(collector, options);
    return;
  }

  const manifest = manifestFile.value;

  const repositoryRoot =
    resolveRepositoryRoot(
      manifest,
      collector
    );

  if (!repositoryRoot) {
    collector.print(
      "Small Slice Scope Audit",
      {
        json: options.json
      }
    );

    setExitCode(collector, options);
    return;
  }

  const baselineCommit =
    manifest?.repository?.baselineCommit;

  const commitCheck = runGit(
    repositoryRoot,
    [
      "cat-file",
      "-e",
      `${baselineCommit}^{commit}`
    ],
    {
      allowFailure: true
    }
  );

  if (commitCheck.status !== 0) {
    collector.error(
      "SLICE_SCOPE_BASELINE_INVALID",
      `Baseline commit '${baselineCommit}' cannot be resolved.`,
      "$.repository.baselineCommit"
    );

    collector.print(
      "Small Slice Scope Audit",
      {
        json: options.json
      }
    );

    setExitCode(collector, options);
    return;
  }

  let changedPaths;

  try {
    changedPaths = collectChangedPaths(
      repositoryRoot,
      baselineCommit
    );
  } catch (error) {
    collector.error(
      "SLICE_SCOPE_GIT_DIFF",
      error.message,
      "$.repository.baselineCommit"
    );

    collector.print(
      "Small Slice Scope Audit",
      {
        json: options.json
      }
    );

    setExitCode(collector, options);
    return;
  }

  const actualDependencyChanges =
    await auditDependencies({
      repositoryRoot,
      baselineCommit,
      changedPaths,
      manifest,
      collector
    });

  auditLockfiles({
    changedPaths,
    manifest,
    actualDependencyChanges,
    collector
  });

  await auditPackageManagerMigration({
    repositoryRoot,
    baselineCommit,
    manifest,
    collector
  });

  auditManifestPaths(
    manifest,
    collector
  );

  auditApplicationBoundary(
    manifest,
    collector
  );

  auditRouteExpansion(
    manifest,
    collector
  );

  auditBlockers(
    manifest,
    collector
  );

  auditInstalledPaths(
    manifest,
    collector
  );

  collector.info(
    "SLICE_SCOPE_CHANGE_COUNT",
    `${changedPaths.size} repository path or paths differ from baseline.`,
    repositoryRoot,
    {
      dependencyChanges:
        actualDependencyChanges.length
    }
  );

  collector.print(
    "Small Slice Scope Audit",
    {
      json: options.json
    }
  );

  setExitCode(collector, options);
}

main().catch((error) => {
  process.stderr.write(
    `${error.stack ?? error.message}\n`
  );

  process.exitCode = 1;
});
