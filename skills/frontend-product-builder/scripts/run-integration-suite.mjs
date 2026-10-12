#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  fileURLToPath
} from "node:url";
import {
  spawnSync
} from "node:child_process";

const SCRIPT_DIRECTORY = path.dirname(
  fileURLToPath(import.meta.url)
);

const DEFAULT_SKILL_ROOT = path.resolve(
  SCRIPT_DIRECTORY,
  ".."
);

const REPORT_RELATIVE_PATH =
  "evals/files/contracts/integration-suite-report.json";

const ARTIFACT_ROOT_RELATIVE_PATH =
  "evals/files/contracts";

const SUITES = [
  {
    id:
      "styling-authority-cli",
    title:
      "Styling Authority CLI Tests",
    script:
      "scripts/test-styling-authority-cli.mjs",
    allowNoArgumentFallback:
      true
  },
  {
    id:
      "contract-fixtures",
    title:
      "Contract Fixture Tests",
    script:
      "scripts/test-contract-fixtures.mjs",
    allowNoArgumentFallback:
      true
  },
  {
    id:
      "primary-contract-clis",
    title:
      "Primary Contract CLI Tests",
    script:
      "scripts/test-primary-contract-clis.mjs",
    allowNoArgumentFallback:
      true
  },
  {
    id:
      "visual-composition-contract",
    title:
      "Visual Composition Contract Tests",
    script:
      "scripts/test-visual-composition-clis.mjs",
    allowNoArgumentFallback:
      true
  },
  {
    id:
      "screen-auditor-clis",
    title:
      "Screen Auditor Integration Tests",
    script:
      "scripts/test-screen-auditor-clis.mjs",
    allowNoArgumentFallback:
      false
  },
  {
    id:
      "representative-gate-auditor",
    title:
      "Representative Gate Auditor Integration Tests",
    script:
      "scripts/test-representative-gate-auditor-cli.mjs",
    allowNoArgumentFallback:
      false
  },
  {
    id:
      "representative-gate-preparer",
    title:
      "Representative Gate Preparer Integration Tests",
    script:
      "scripts/test-representative-gate-preparer-cli.mjs",
    allowNoArgumentFallback:
      false
  },
  {
    id:
      "small-slice-auditors",
    title:
      "Small Slice Auditor Integration Tests",
    script:
      "scripts/test-small-slice-auditor-clis.mjs",
    allowNoArgumentFallback:
      false
  },
  {
    id:
      "behavioral-ux-contract",
    title:
      "Behavioral UX Contract CLI Tests",
    script:
      "scripts/test-behavioral-ux-contract-cli.mjs",
    allowNoArgumentFallback:
      true
  }
];

function parseArguments(argv) {
  const options = {
    root:
      DEFAULT_SKILL_ROOT,
    json:
      false
  };

  for (
    let index = 0;
    index < argv.length;
    index += 1
  ) {
    const argument =
      argv[index];

    switch (argument) {
      case "--root": {
        const value =
          argv[index + 1];

        if (!value) {
          throw new Error(
            "--root requires a directory path."
          );
        }

        options.root =
          path.resolve(value);

        index += 1;
        break;
      }

      case "--json":
        options.json =
          true;
        break;

      default:
        throw new Error(
          `Unknown option '${argument}'.`
        );
    }
  }

  return options;
}

async function pathType(targetPath) {
  try {
    const stats =
      await fs.stat(targetPath);

    if (stats.isFile()) {
      return "file";
    }

    if (stats.isDirectory()) {
      return "directory";
    }

    return "other";
  } catch {
    return "missing";
  }
}

const PORTABLE_REPORT_SKILL_ROOT =
  "~/.agents/skills/frontend-product-builder";

// 9D.1C portable persisted report values.
function portableReportValue(
  value,
  runtimeSkillRoot = null
) {
  const resolvedSkillRoot = (
    runtimeSkillRoot ??
    (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof value.meta?.skillRoot === "string"
        ? value.meta.skillRoot
        : null
    )
  );

  if (typeof value === "string") {
    if (
      typeof resolvedSkillRoot !== "string" ||
      resolvedSkillRoot.length === 0
    ) {
      return value;
    }

    return value
      .split(
        resolvedSkillRoot
      )
      .join(
        PORTABLE_REPORT_SKILL_ROOT
      );
  }

  if (Array.isArray(value)) {
    return value.map(
      (item) => {
        return portableReportValue(
          item,
          resolvedSkillRoot
        );
      }
    );
  }

  if (
    value !== null &&
    typeof value === "object"
  ) {
    return Object.fromEntries(
      Object.entries(value).map(
        (
          [
            key,
            childValue
          ]
        ) => {
          return [
            key,
            portableReportValue(
              childValue,
              resolvedSkillRoot
            )
          ];
        }
      )
    );
  }

  return value;
}

async function writeJson(
  filePath,
  value
) {
  await fs.mkdir(
    path.dirname(filePath),
    {
      recursive:
        true
    }
  );

  await fs.writeFile(
    filePath,
    `${JSON.stringify(
      portableReportValue(value),
      null,
      2
    )}\n`,
    "utf8"
  );
}

function runProcess({
  command,
  args,
  cwd,
  timeout = 300000
}) {
  const startedAt =
    Date.now();

  const result =
    spawnSync(
      command,
      args,
      {
        cwd,
        encoding:
          "utf8",
        windowsHide:
          true,
        timeout,
        maxBuffer:
          128 * 1024 * 1024
      }
    );

  const completedAt =
    Date.now();

  return {
    command,
    args,
    cwd,
    status:
      typeof result.status ===
      "number"
        ? result.status
        : 1,
    signal:
      result.signal ?? null,
    stdout:
      result.stdout ?? "",
    stderr:
      result.stderr ?? "",
    error:
      result.error
        ? result.error.message
        : null,
    startedAt:
      new Date(
        startedAt
      ).toISOString(),
    completedAt:
      new Date(
        completedAt
      ).toISOString(),
    durationMs:
      completedAt - startedAt
  };
}

function combinedOutput(result) {
  return [
    result.stdout,
    result.stderr,
    result.error ?? ""
  ]
    .filter(Boolean)
    .join("\n");
}

function sha256(content) {
  return crypto
    .createHash("sha256")
    .update(content)
    .digest("hex");
}

function looksLikeInfrastructureFailure(
  result
) {
  const output =
    combinedOutput(result);

  return (
    result.signal !== null ||
    /ERR_MODULE_NOT_FOUND/.test(
      output
    ) ||
    /Cannot find module/i.test(
      output
    ) ||
    /SyntaxError:/i.test(
      output
    ) ||
    /ReferenceError:/i.test(
      output
    ) ||
    /spawnSync .* ENOENT/i.test(
      output
    ) ||
    /command not found/i.test(
      output
    ) ||
    /timed out/i.test(
      result.error ?? ""
    )
  );
}

function shouldRetryWithoutRoot(
  result
) {
  if (result.status === 0) {
    return false;
  }

  const output =
    combinedOutput(result);

  return (
    /Unknown option ['"]?--root/i.test(
      output
    ) ||
    /Unsupported option:?\s*--root/i.test(
      output
    ) ||
    /Unable to read .*--root/i.test(
      output
    ) ||
    /ENOENT.*--root/i.test(
      output
    ) ||
    /Missing input file.*--root/i.test(
      output
    )
  );
}

async function listFilesRecursively(
  rootDirectory
) {
  const result = [];

  if (
    await pathType(
      rootDirectory
    ) !== "directory"
  ) {
    return result;
  }

  async function visit(
    currentDirectory
  ) {
    const entries =
      await fs.readdir(
        currentDirectory,
        {
          withFileTypes:
            true
        }
      );

    entries.sort(
      (
        left,
        right
      ) => {
        return left.name.localeCompare(
          right.name
        );
      }
    );

    for (const entry of entries) {
      const absolutePath =
        path.join(
          currentDirectory,
          entry.name
        );

      if (entry.isDirectory()) {
        await visit(
          absolutePath
        );
        continue;
      }

      if (entry.isFile()) {
        result.push(
          absolutePath
        );
      }
    }
  }

  await visit(
    rootDirectory
  );

  return result;
}

async function snapshotJsonArtifacts({
  artifactRoot,
  skillRoot
}) {
  const snapshot = new Map();

  const files =
    await listFilesRecursively(
      artifactRoot
    );

  for (const filePath of files) {
    if (
      path.extname(
        filePath
      ).toLowerCase() !== ".json"
    ) {
      continue;
    }

    const content =
      await fs.readFile(
        filePath
      );

    const stats =
      await fs.stat(
        filePath
      );

    const relativePath =
      path.relative(
        skillRoot,
        filePath
      ).split(
        path.sep
      ).join("/");

    snapshot.set(
      relativePath,
      {
        path:
          relativePath,
        size:
          stats.size,
        sha256:
          sha256(content),
        modifiedAt:
          stats.mtime.toISOString()
      }
    );
  }

  return snapshot;
}

function compareSnapshots(
  before,
  after
) {
  const created = [];
  const modified = [];
  const removed = [];

  for (
    const [
      artifactPath,
      afterEntry
    ] of after
  ) {
    const beforeEntry =
      before.get(
        artifactPath
      );

    if (!beforeEntry) {
      created.push(
        afterEntry
      );
      continue;
    }

    if (
      beforeEntry.sha256 !==
        afterEntry.sha256
    ) {
      modified.push({
        ...afterEntry,
        previousSha256:
          beforeEntry.sha256
      });
    }
  }

  for (
    const [
      artifactPath,
      beforeEntry
    ] of before
  ) {
    if (
      !after.has(
        artifactPath
      )
    ) {
      removed.push(
        beforeEntry
      );
    }
  }

  return {
    created,
    modified,
    removed,
    totalChanged:
      created.length +
      modified.length +
      removed.length
  };
}

function normalizeMetricKey(
  label
) {
  const words =
    label
      .trim()
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        " "
      )
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (words.length === 0) {
    return "metric";
  }

  return (
    words[0] +
    words
      .slice(1)
      .map(
        (word) => {
          return (
            word.charAt(0).toUpperCase() +
            word.slice(1)
          );
        }
      )
      .join("")
  );
}

function extractReportedMetrics(
  output
) {
  const metrics = {};

  const ignoredLabels = new Set([
    "exit",
    "valid exit",
    "invalid exit",
    "código de saída",
    "código de saída externo",
    "código de saída da validação"
  ]);

  for (
    const line of
    output.splitlines?.() ?? output.split(/\r?\n/)
  ) {
    const match =
      line.match(
        /^([A-Za-z][A-Za-z0-9 /_-]{1,80}):\s*(-?[0-9]+|true|false)\s*$/
      );

    if (!match) {
      continue;
    }

    const label =
      match[1].trim();

    if (
      ignoredLabels.has(
        label.toLowerCase()
      )
    ) {
      continue;
    }

    const rawValue =
      match[2];

    const value = (
      rawValue === "true"
        ? true
        : rawValue === "false"
          ? false
          : Number(rawValue)
    );

    metrics[
      normalizeMetricKey(label)
    ] = value;
  }

  return metrics;
}

function extractCases(output) {
  const cases = [];

  const pattern =
    /^\[(PASS|FAIL)\]\s+(.+?)\s*$/gm;

  for (
    const match of
    output.matchAll(pattern)
  ) {
    cases.push({
      status:
        match[1].toLowerCase(),
      id:
        match[2].trim()
    });
  }

  return cases;
}

function expectationMismatchCount(
  metrics
) {
  const value =
    metrics.expectationMismatches;

  return (
    typeof value === "number"
      ? value
      : 0
  );
}

async function executeSuite({
  suite,
  skillRoot,
  artifactRoot
}) {
  const scriptPath =
    path.join(
      skillRoot,
      suite.script
    );

  const discovered = (
    await pathType(
      scriptPath
    ) === "file"
  );

  if (!discovered) {
    return {
      id:
        suite.id,
      title:
        suite.title,
      script:
        suite.script,
      scriptPath,
      discovered:
        false,
      syntaxPassed:
        false,
      executed:
        false,
      passed:
        false,
      infrastructureFailure:
        false,
      invocation:
        null,
      fallbackUsed:
        false,
      status:
        null,
      durationMs:
        0,
      reportedMetrics:
        {},
      cases:
        [],
      artifacts: {
        created:
          [],
        modified:
          [],
        removed:
          [],
        totalChanged:
          0
      },
      outputExcerpt:
        "",
      failure:
        "Runner was not found."
    };
  }

  const syntaxResult =
    runProcess({
      command:
        "node",
      args: [
        "--check",
        scriptPath
      ],
      cwd:
        skillRoot,
      timeout:
        30000
    });

  const syntaxPassed =
    syntaxResult.status === 0;

  if (!syntaxPassed) {
    return {
      id:
        suite.id,
      title:
        suite.title,
      script:
        suite.script,
      scriptPath,
      discovered:
        true,
      syntaxPassed:
        false,
      executed:
        false,
      passed:
        false,
      infrastructureFailure:
        true,
      invocation: {
        command:
          syntaxResult.command,
        args:
          syntaxResult.args,
        cwd:
          syntaxResult.cwd
      },
      fallbackUsed:
        false,
      status:
        syntaxResult.status,
      durationMs:
        syntaxResult.durationMs,
      reportedMetrics:
        {},
      cases:
        [],
      artifacts: {
        created:
          [],
        modified:
          [],
        removed:
          [],
        totalChanged:
          0
      },
      outputExcerpt:
        combinedOutput(
          syntaxResult
        ).slice(
          0,
          24000
        ),
      failure:
        "Runner failed syntax validation."
    };
  }

  const beforeSnapshot =
    await snapshotJsonArtifacts({
      artifactRoot,
      skillRoot
    });

  let execution =
    runProcess({
      command:
        "node",
      args: [
        scriptPath,
        "--root",
        skillRoot
      ],
      cwd:
        skillRoot
    });

  let fallbackUsed =
    false;

  if (
    suite.allowNoArgumentFallback &&
    shouldRetryWithoutRoot(
      execution
    )
  ) {
    fallbackUsed =
      true;

    execution =
      runProcess({
        command:
          "node",
        args: [
          scriptPath
        ],
        cwd:
          skillRoot
      });
  }

  const afterSnapshot =
    await snapshotJsonArtifacts({
      artifactRoot,
      skillRoot
    });

  const artifacts =
    compareSnapshots(
      beforeSnapshot,
      afterSnapshot
    );

  const output =
    combinedOutput(
      execution
    );

  const reportedMetrics =
    extractReportedMetrics(
      output
    );

  const cases =
    extractCases(
      output
    );

  const failedCases =
    cases.filter(
      (testCase) => {
        return testCase.status ===
          "fail";
      }
    );

  const infrastructureFailure =
    looksLikeInfrastructureFailure(
      execution
    );

  const mismatches =
    expectationMismatchCount(
      reportedMetrics
    );

  const passed = (
    execution.status === 0 &&
    !infrastructureFailure &&
    mismatches === 0 &&
    failedCases.length === 0
  );

  return {
    id:
      suite.id,
    title:
      suite.title,
    script:
      suite.script,
    scriptPath,
    discovered:
      true,
    syntaxPassed:
      true,
    executed:
      true,
    passed,
    infrastructureFailure,
    invocation: {
      command:
        execution.command,
      args:
        execution.args,
      cwd:
        execution.cwd
    },
    fallbackUsed,
    status:
      execution.status,
    signal:
      execution.signal,
    startedAt:
      execution.startedAt,
    completedAt:
      execution.completedAt,
    durationMs:
      execution.durationMs,
    outputSha256:
      sha256(output),
    reportedMetrics,
    cases,
    artifacts,
    outputExcerpt:
      output.slice(
        0,
        passed
          ? 6000
          : 30000
      ),
    failure: (
      passed
        ? null
        : (
          infrastructureFailure
            ? "Infrastructure failure."
            : execution.status !== 0
              ? "Runner returned a nonzero exit status."
              : mismatches > 0
                ? "Runner reported expectation mismatches."
                : failedCases.length > 0
                  ? "Runner reported one or more failed cases."
                  : "Unknown suite failure."
        )
    )
  };
}

async function createReportInventory({
  artifactRoot,
  skillRoot,
  aggregateReportPath
}) {
  const files =
    await listFilesRecursively(
      artifactRoot
    );

  const inventory = [];

  for (const filePath of files) {
    if (
      path.extname(
        filePath
      ).toLowerCase() !== ".json"
    ) {
      continue;
    }

    if (
      path.resolve(
        filePath
      ) === path.resolve(
        aggregateReportPath
      )
    ) {
      continue;
    }

    const fileName =
      path.basename(
        filePath
      ).toLowerCase();

    if (
      !fileName.includes(
        "report"
      ) &&
      !fileName.includes(
        "manifest"
      )
    ) {
      continue;
    }

    const content =
      await fs.readFile(
        filePath
      );

    const stats =
      await fs.stat(
        filePath
      );

    let jsonValid =
      true;

    let topLevelKeys =
      [];

    try {
      const parsed =
        JSON.parse(
          content.toString(
            "utf8"
          )
        );

      if (
        parsed &&
        typeof parsed ===
          "object" &&
        !Array.isArray(parsed)
      ) {
        topLevelKeys =
          Object.keys(
            parsed
          );
      }
    } catch {
      jsonValid =
        false;
    }

    inventory.push({
      path:
        path.relative(
          skillRoot,
          filePath
        ).split(
          path.sep
        ).join("/"),
      size:
        stats.size,
      sha256:
        sha256(content),
      modifiedAt:
        stats.mtime.toISOString(),
      jsonValid,
      topLevelKeys
    });
  }

  inventory.sort(
    (
      left,
      right
    ) => {
      return left.path.localeCompare(
        right.path
      );
    }
  );

  return inventory;
}

function formatDuration(
  durationMs
) {
  if (
    typeof durationMs !==
      "number"
  ) {
    return "not executed";
  }

  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }

  return `${(
    durationMs / 1000
  ).toFixed(2)} s`;
}

function printSuiteFailure(
  suite
) {
  process.stdout.write(
    `Failure: ${suite.failure ?? "unknown"}\n`
  );

  process.stdout.write(
    `Infrastructure failure: ${suite.infrastructureFailure}\n`
  );

  if (
    suite.outputExcerpt
  ) {
    process.stdout.write(
      "Process output:\n"
    );

    process.stdout.write(
      `${suite.outputExcerpt}\n`
    );
  }
}

function printReport(report) {
  process.stdout.write(
    "Frontend Product Builder — Consolidated 9C.2 Integration Suite\n"
  );

  process.stdout.write(
    "================================================================\n"
  );

  process.stdout.write(
    `Skill root: ${report.meta.skillRoot}\n`
  );

  process.stdout.write(
    `Report: ${report.meta.reportPath}\n`
  );

  process.stdout.write(
    `Runners expected: ${report.metrics.runnersExpected}\n`
  );

  process.stdout.write(
    `Runners discovered: ${report.metrics.runnersDiscovered}\n`
  );

  process.stdout.write(
    `Syntax checks passed: ${report.metrics.syntaxChecksPassed}\n`
  );

  process.stdout.write(
    `Suites executed: ${report.metrics.suitesExecuted}\n`
  );

  process.stdout.write(
    `Suites passed: ${report.metrics.suitesPassed}\n`
  );

  process.stdout.write(
    `Suites failed: ${report.metrics.suitesFailed}\n`
  );

  process.stdout.write(
    `Reported expectation mismatches: ${report.metrics.reportedExpectationMismatches}\n`
  );

  process.stdout.write(
    `Passed cases detected: ${report.metrics.passedCasesDetected}\n`
  );

  process.stdout.write(
    `Failed cases detected: ${report.metrics.failedCasesDetected}\n`
  );

  process.stdout.write(
    `Persistent artifacts changed: ${report.metrics.persistentArtifactsChanged}\n`
  );

  process.stdout.write(
    `Persistent report artifacts: ${report.metrics.persistentReportArtifacts}\n`
  );

  process.stdout.write(
    `Expectation mismatches: ${report.metrics.expectationMismatches}\n\n`
  );

  for (const suite of report.suites) {
    process.stdout.write(
      `[${suite.passed ? "PASS" : "FAIL"}] ${suite.id}\n`
    );

    process.stdout.write(
      `Title: ${suite.title}\n`
    );

    process.stdout.write(
      `Script: ${suite.script}\n`
    );

    process.stdout.write(
      `Discovered: ${suite.discovered}\n`
    );

    process.stdout.write(
      `Syntax: ${suite.syntaxPassed ? "passed" : "failed"}\n`
    );

    process.stdout.write(
      `Exit: ${
        suite.status === null
          ? "not executed"
          : suite.status
      }\n`
    );

    process.stdout.write(
      `Fallback invocation used: ${suite.fallbackUsed}\n`
    );

    process.stdout.write(
      `Duration: ${formatDuration(
        suite.durationMs
      )}\n`
    );

    process.stdout.write(
      `Cases: ${
        suite.cases.length
      }\n`
    );

    process.stdout.write(
      `Artifacts changed: ${suite.artifacts.totalChanged}\n`
    );

    if (!suite.passed) {
      printSuiteFailure(
        suite
      );
    }

    process.stdout.write("\n");
  }

  process.stdout.write(
    "Persistent report inventory\n"
  );

  process.stdout.write(
    "---------------------------\n"
  );

  for (
    const artifact of
    report.persistentReportInventory
  ) {
    process.stdout.write(
      `- ${artifact.path} | JSON: ${
        artifact.jsonValid
          ? "valid"
          : "invalid"
      } | ${artifact.size} bytes\n`
    );
  }

  if (
    report.persistentReportInventory
      .length === 0
  ) {
    process.stdout.write(
      "- none\n"
    );
  }

  process.stdout.write("\n");

  process.stdout.write(
    "Summary\n"
  );

  process.stdout.write(
    "-------\n"
  );

  process.stdout.write(
    `Errors: ${report.metrics.expectationMismatches}\n`
  );

  process.stdout.write(
    "Warnings: 0\n"
  );

  process.stdout.write(
    `Information: ${report.suites.length}\n`
  );

  process.stdout.write(
    `Total: ${
      report.suites.length +
      report.metrics.expectationMismatches
    }\n`
  );
}

async function main() {
  const options =
    parseArguments(
      process.argv.slice(2)
    );

  const skillRoot =
    options.root;

  if (
    await pathType(
      skillRoot
    ) !== "directory"
  ) {
    throw new Error(
      `Skill root is not a directory: ${skillRoot}`
    );
  }

  const artifactRoot =
    path.join(
      skillRoot,
      ARTIFACT_ROOT_RELATIVE_PATH
    );

  const reportPath =
    path.join(
      skillRoot,
      REPORT_RELATIVE_PATH
    );

  const suiteResults = [];

  const suiteStartedAt =
    Date.now();

  for (const suite of SUITES) {
    process.stderr.write(
      `Running ${suite.id}...\n`
    );

    const result =
      await executeSuite({
        suite,
        skillRoot,
        artifactRoot
      });

    suiteResults.push(
      result
    );
  }

  const suiteCompletedAt =
    Date.now();

  const persistentReportInventory =
    await createReportInventory({
      artifactRoot,
      skillRoot,
      aggregateReportPath:
        reportPath
    });

  const runnersDiscovered =
    suiteResults.filter(
      (suite) => suite.discovered
    ).length;

  const syntaxChecksPassed =
    suiteResults.filter(
      (suite) => suite.syntaxPassed
    ).length;

  const suitesExecuted =
    suiteResults.filter(
      (suite) => suite.executed
    ).length;

  const suitesPassed =
    suiteResults.filter(
      (suite) => suite.passed
    ).length;

  const suitesFailed =
    suiteResults.length -
    suitesPassed;

  const reportedExpectationMismatches =
    suiteResults.reduce(
      (
        total,
        suite
      ) => {
        return (
          total +
          expectationMismatchCount(
            suite.reportedMetrics
          )
        );
      },
      0
    );

  const passedCasesDetected =
    suiteResults.reduce(
      (
        total,
        suite
      ) => {
        return (
          total +
          suite.cases.filter(
            (testCase) => {
              return testCase.status ===
                "pass";
            }
          ).length
        );
      },
      0
    );

  const failedCasesDetected =
    suiteResults.reduce(
      (
        total,
        suite
      ) => {
        return (
          total +
          suite.cases.filter(
            (testCase) => {
              return testCase.status ===
                "fail";
            }
          ).length
        );
      },
      0
    );

  const persistentArtifactsChanged =
    suiteResults.reduce(
      (
        total,
        suite
      ) => {
        return (
          total +
          suite.artifacts
            .totalChanged
        );
      },
      0
    );

  const expectationMismatches = (
    (
      SUITES.length -
      runnersDiscovered
    ) +
    (
      SUITES.length -
      syntaxChecksPassed
    ) +
    suitesFailed +
    reportedExpectationMismatches +
    failedCasesDetected
  );

  const report = {
    meta: {
      id:
        "frontend-product-builder-9c2-integration-suite",
      generatedAt:
        new Date().toISOString(),
      startedAt:
        new Date(
          suiteStartedAt
        ).toISOString(),
      completedAt:
        new Date(
          suiteCompletedAt
        ).toISOString(),
      durationMs:
        suiteCompletedAt -
        suiteStartedAt,
      skillRoot,
      reportPath:
        path.relative(
          skillRoot,
          reportPath
        ).split(
          path.sep
        ).join("/")
    },

    metrics: {
      runnersExpected:
        SUITES.length,
      runnersDiscovered,
      syntaxChecksPassed,
      suitesExecuted,
      suitesPassed,
      suitesFailed,
      reportedExpectationMismatches,
      passedCasesDetected,
      failedCasesDetected,
      persistentArtifactsChanged,
      persistentReportArtifacts:
        persistentReportInventory.length,
      expectationMismatches
    },

    suites:
      suiteResults,

    persistentReportInventory
  };

  await writeJson(
    reportPath,
    report
  );

  if (options.json) {
    process.stdout.write(
      `${JSON.stringify(
        report,
        null,
        2
      )}\n`
    );
  } else {
    printReport(
      report
    );
  }

  process.exitCode = (
    expectationMismatches > 0
      ? 1
      : 0
  );
}

main().catch((error) => {
  process.stderr.write(
    `${error.stack ?? error.message}\n`
  );

  process.exitCode = 1;
});
