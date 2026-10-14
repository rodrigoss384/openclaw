#!/usr/bin/env node

import path from "node:path";
import {
  spawnSync
} from "node:child_process";

import {
  IssueCollector,
  asArray,
  parseCliArgs,
  pathExists,
  readJsonFile,
  requireInputPath,
  resolveFromCwd,
  setExitCode
} from "./lib/screen-contract-utils.mjs";

const USAGE = [
  "node audit-small-slice-files.mjs",
  "<small-slice-manifest.json>",
  "[--strict-warnings]",
  "[--json]"
].join(" ");

const STRICT_MANIFEST_STATUSES = new Set([
  "in-progress",
  "validated"
]);

const FINAL_MANIFEST_STATUSES = new Set([
  "validated"
]);

const CHANGED_ACTIONS = new Set([
  "create",
  "modify",
  "remove"
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
        `Git command failed: git -C ${repositoryRoot}`,
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

function addChangedPaths(
  changeMap,
  paths,
  status
) {
  for (const changedPath of paths) {
    const normalized =
      normalizeRepositoryPath(changedPath);

    if (!normalized) {
      continue;
    }

    changeMap.set(normalized, status);
  }
}

function collectActualChanges(
  repositoryRoot,
  baselineCommit
) {
  const changes = new Map();

  const added = parseNullSeparated(
    runGit(
      repositoryRoot,
      [
        "diff",
        "--name-only",
        "--no-renames",
        "--diff-filter=A",
        "-z",
        baselineCommit,
        "--"
      ]
    ).stdout
  );

  const modified = parseNullSeparated(
    runGit(
      repositoryRoot,
      [
        "diff",
        "--name-only",
        "--no-renames",
        "--diff-filter=MTUXB",
        "-z",
        baselineCommit,
        "--"
      ]
    ).stdout
  );

  const removed = parseNullSeparated(
    runGit(
      repositoryRoot,
      [
        "diff",
        "--name-only",
        "--no-renames",
        "--diff-filter=D",
        "-z",
        baselineCommit,
        "--"
      ]
    ).stdout
  );

  const untracked = parseNullSeparated(
    runGit(
      repositoryRoot,
      [
        "ls-files",
        "--others",
        "--exclude-standard",
        "-z"
      ]
    ).stdout
  );

  addChangedPaths(changes, added, "added");
  addChangedPaths(changes, modified, "modified");
  addChangedPaths(changes, removed, "removed");
  addChangedPaths(changes, untracked, "untracked");

  return changes;
}

function resolveRepository(
  manifest,
  collector
) {
  const declaredRoot =
    manifest?.repository?.root ?? ".";

  const candidateRoot =
    resolveFromCwd(declaredRoot);

  let repositoryRoot;

  try {
    repositoryRoot = runGit(
      candidateRoot,
      [
        "rev-parse",
        "--show-toplevel"
      ]
    ).stdout.trim();
  } catch (error) {
    collector.error(
      "SLICE_FILE_GIT_ROOT",
      "The declared repository root is not inside a Git repository.",
      "$.repository.root",
      {
        declaredRoot,
        candidateRoot,
        error: error.message
      }
    );

    return null;
  }

  return path.normalize(repositoryRoot);
}

function validateBaseline(
  repositoryRoot,
  manifest,
  collector
) {
  const baselineCommit =
    manifest?.repository?.baselineCommit;

  if (
    typeof baselineCommit !== "string" ||
    baselineCommit.trim() === ""
  ) {
    collector.error(
      "SLICE_FILE_BASELINE_MISSING",
      "repository.baselineCommit is required for file reconciliation.",
      "$.repository.baselineCommit"
    );

    return false;
  }

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
      "SLICE_FILE_BASELINE_INVALID",
      `Baseline commit '${baselineCommit}' cannot be resolved.`,
      "$.repository.baselineCommit",
      commitCheck.stderr.trim()
    );

    return false;
  }

  const ancestryCheck = runGit(
    repositoryRoot,
    [
      "merge-base",
      "--is-ancestor",
      baselineCommit,
      "HEAD"
    ],
    {
      allowFailure: true
    }
  );

  if (ancestryCheck.status !== 0) {
    collector.warning(
      "SLICE_FILE_BASELINE_NOT_ANCESTOR",
      "The declared baseline is not an ancestor of the current HEAD.",
      "$.repository.baselineCommit",
      baselineCommit
    );
  }

  const currentBranch = runGit(
    repositoryRoot,
    [
      "branch",
      "--show-current"
    ]
  ).stdout.trim();

  const baselineBranch =
    manifest?.repository?.baselineBranch;

  if (
    baselineBranch &&
    currentBranch &&
    baselineBranch !== currentBranch
  ) {
    collector.warning(
      "SLICE_FILE_BRANCH_CHANGED",
      "The current branch differs from the declared baseline branch.",
      "$.repository.baselineBranch",
      {
        declared: baselineBranch,
        current: currentBranch
      }
    );
  }

  return true;
}

function collectAuxiliaryPaths(manifest) {
  const values = [
    manifest?.meta?.source,
    manifest?.screen?.screenSpecification,
    manifest?.screen?.stateMatrix,
    manifest?.screen?.componentMap,
    manifest?.screen?.implementationPlan,
    manifest?.screen?.readinessReport,
    manifest?.release?.reportPath,
    manifest?.repository?.inspectionFile,
    manifest?.fixtures?.strategyFile,
    ...asArray(manifest?.evidence)
      .map((item) => item?.path)
  ];

  return new Set(
    values
      .map(normalizeRepositoryPath)
      .filter(Boolean)
  );
}

function collectPreExistingPaths(manifest) {
  return new Set(
    asArray(
      manifest?.repository?.preExistingChanges
    )
      .map((change) => {
        return normalizeRepositoryPath(change?.path);
      })
      .filter(Boolean)
  );
}

function collectDeclaredFilePlan(
  manifest,
  collector
) {
  const result = new Map();

  asArray(manifest?.files).forEach(
    (filePlan, index) => {
      const normalized =
        normalizeRepositoryPath(filePlan?.path);

      if (!normalized) {
        collector.error(
          "SLICE_FILE_PATH_INVALID",
          `File-plan path '${filePlan?.path}' must be repository-relative.`,
          `$.files[${index}].path`
        );

        return;
      }

      result.set(normalized, {
        ...filePlan,
        index
      });
    }
  );

  return result;
}

function expectedActualStatuses(action) {
  switch (action) {
    case "create":
      return new Set([
        "added",
        "untracked"
      ]);

    case "modify":
      return new Set([
        "modified"
      ]);

    case "remove":
      return new Set([
        "removed"
      ]);

    default:
      return new Set();
  }
}

function issueForMissingPlannedChange(
  collector,
  manifestStatus,
  filePlan,
  location
) {
  const message =
    `Planned '${filePlan.action}' file '${filePlan.path}' ` +
    "does not differ from the baseline.";

  if (FINAL_MANIFEST_STATUSES.has(manifestStatus)) {
    collector.error(
      "SLICE_FILE_PLANNED_CHANGE_MISSING",
      message,
      location
    );

    return;
  }

  if (STRICT_MANIFEST_STATUSES.has(manifestStatus)) {
    collector.warning(
      "SLICE_FILE_PLANNED_CHANGE_PENDING",
      message,
      location
    );

    return;
  }

  collector.info(
    "SLICE_FILE_PLANNED_CHANGE_NOT_STARTED",
    message,
    location
  );
}

async function validateDeclaredFiles({
  repositoryRoot,
  manifest,
  declaredFilePlan,
  actualChanges,
  collector
}) {
  const manifestStatus =
    manifest?.meta?.status;

  for (
    const [
      repositoryPath,
      filePlan
    ] of declaredFilePlan.entries()
  ) {
    const location =
      `$.files[${filePlan.index}]`;

    const absolutePath = path.resolve(
      repositoryRoot,
      repositoryPath
    );

    const exists = await pathExists(absolutePath);
    const actualStatus =
      actualChanges.get(repositoryPath);

    if (
      filePlan.action === "inspect" ||
      filePlan.action === "reuse"
    ) {
      if (!exists) {
        collector.error(
          "SLICE_FILE_REUSED_NOT_FOUND",
          `File '${repositoryPath}' is declared '${filePlan.action}' ` +
          "but does not exist.",
          location
        );
      }

      if (actualStatus) {
        collector.error(
          "SLICE_FILE_READ_ONLY_CHANGED",
          `File '${repositoryPath}' is declared '${filePlan.action}' ` +
          `but changed as '${actualStatus}'.`,
          location
        );
      }

      continue;
    }

    if (filePlan.action === "remove") {
      if (exists) {
        collector.error(
          "SLICE_FILE_REMOVE_STILL_EXISTS",
          `File '${repositoryPath}' is planned for removal but still exists.`,
          location
        );
      }
    } else if (!exists) {
      const severity =
        FINAL_MANIFEST_STATUSES.has(manifestStatus)
          ? "error"
          : "warning";

      collector[severity](
        "SLICE_FILE_PLANNED_PATH_NOT_FOUND",
        `Planned file '${repositoryPath}' does not exist.`,
        location
      );
    }

    if (
      !CHANGED_ACTIONS.has(filePlan.action)
    ) {
      continue;
    }

    if (!actualStatus) {
      issueForMissingPlannedChange(
        collector,
        manifestStatus,
        filePlan,
        location
      );

      continue;
    }

    const acceptedStatuses =
      expectedActualStatuses(filePlan.action);

    if (!acceptedStatuses.has(actualStatus)) {
      collector.error(
        "SLICE_FILE_ACTION_MISMATCH",
        `File '${repositoryPath}' is declared '${filePlan.action}' ` +
        `but Git reports '${actualStatus}'.`,
        location
      );
    }
  }
}

function validateActualChanges({
  manifest,
  actualChanges,
  declaredFilePlan,
  auxiliaryPaths,
  preExistingPaths,
  collector
}) {
  for (
    const [
      repositoryPath,
      actualStatus
    ] of actualChanges.entries()
  ) {
    if (preExistingPaths.has(repositoryPath)) {
      collector.info(
        "SLICE_FILE_PRE_EXISTING_EXCLUDED",
        `Pre-existing change '${repositoryPath}' is excluded from ` +
        "slice ownership.",
        "$.repository.preExistingChanges",
        actualStatus
      );

      continue;
    }

    if (declaredFilePlan.has(repositoryPath)) {
      continue;
    }

    if (auxiliaryPaths.has(repositoryPath)) {
      collector.info(
        "SLICE_FILE_AUXILIARY_DECLARED",
        `Execution artifact '${repositoryPath}' is declared through ` +
        "a manifest reference or evidence entry.",
        repositoryPath,
        actualStatus
      );

      continue;
    }

    collector.error(
      "SLICE_FILE_UNDECLARED_CHANGE",
      `Changed file '${repositoryPath}' is not declared by the slice.`,
      "$.files",
      actualStatus
    );
  }

  for (const preExistingPath of preExistingPaths) {
    if (!actualChanges.has(preExistingPath)) {
      collector.warning(
        "SLICE_FILE_PRE_EXISTING_NO_LONGER_CHANGED",
        `Pre-existing path '${preExistingPath}' no longer differs ` +
        "from the baseline.",
        "$.repository.preExistingChanges"
      );
    }
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
      "SLICE_FILE_MANIFEST_JSON",
      error.message,
      inputPath
    );

    collector.print(
      "Small Slice File Audit",
      {
        json: options.json
      }
    );

    setExitCode(collector, options);
    return;
  }

  const manifest = manifestFile.value;

  const repositoryRoot =
    resolveRepository(manifest, collector);

  if (!repositoryRoot) {
    collector.print(
      "Small Slice File Audit",
      {
        json: options.json
      }
    );

    setExitCode(collector, options);
    return;
  }

  if (
    !validateBaseline(
      repositoryRoot,
      manifest,
      collector
    )
  ) {
    collector.print(
      "Small Slice File Audit",
      {
        json: options.json
      }
    );

    setExitCode(collector, options);
    return;
  }

  let actualChanges;

  try {
    actualChanges = collectActualChanges(
      repositoryRoot,
      manifest.repository.baselineCommit
    );
  } catch (error) {
    collector.error(
      "SLICE_FILE_GIT_DIFF",
      error.message,
      "$.repository.baselineCommit"
    );

    collector.print(
      "Small Slice File Audit",
      {
        json: options.json
      }
    );

    setExitCode(collector, options);
    return;
  }

  const declaredFilePlan =
    collectDeclaredFilePlan(
      manifest,
      collector
    );

  const auxiliaryPaths =
    collectAuxiliaryPaths(manifest);

  const preExistingPaths =
    collectPreExistingPaths(manifest);

  validateActualChanges({
    manifest,
    actualChanges,
    declaredFilePlan,
    auxiliaryPaths,
    preExistingPaths,
    collector
  });

  await validateDeclaredFiles({
    repositoryRoot,
    manifest,
    declaredFilePlan,
    actualChanges,
    collector
  });

  collector.info(
    "SLICE_FILE_CHANGE_COUNT",
    `${actualChanges.size} path or paths differ from the baseline.`,
    repositoryRoot,
    {
      declaredFiles: declaredFilePlan.size,
      auxiliaryPaths: auxiliaryPaths.size,
      preExistingPaths: preExistingPaths.size
    }
  );

  collector.print(
    "Small Slice File Audit",
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
