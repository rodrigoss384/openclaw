#!/usr/bin/env node

import fs from "node:fs/promises";
import os from "node:os";
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

const FIXTURE_GENERATOR_RELATIVE_PATH =
  "scripts/test-representative-gate-preparer-cli.mjs";

const FIXTURE_GENERATOR_REPORT_RELATIVE_PATH =
  "evals/files/contracts/representative-gate-preparer-integration-report.json";

const REPORT_RELATIVE_PATH =
  "evals/files/contracts/small-slice-auditor-integration-report.json";

const SCREEN_DIRECTORY =
  "docs/frontend/screens/gate-preparation-screen";

const MANIFEST_RELATIVE_PATH =
  `${SCREEN_DIRECTORY}/small-slice-manifest.json`;

const AUDITORS = [
  {
    id:
      "small-slice-files",
    script:
      "scripts/audit-small-slice-files.mjs",
    invalidScenario:
      "undeclared-working-tree-file",
    description:
      "Add an undeclared file to the Git working tree."
  },
  {
    id:
      "small-slice-scope",
    script:
      "scripts/audit-small-slice-scope.mjs",
    invalidScenario:
      "explicit-scope-blocker",
    description:
      "Use a schema-valid manifest with an explicit scope blocker."
  },
  {
    id:
      "small-slice-evidence",
    script:
      "scripts/audit-small-slice-evidence.mjs",
    invalidScenario:
      "missing-required-browser-evidence",
    description:
      "Remove a required browser-validation evidence file."
  }
];

function parseArguments(argv) {
  const options = {
    root:
      DEFAULT_SKILL_ROOT,
    keepTemporaryRepositories:
      false,
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

      case "--keep-temp":
        options.keepTemporaryRepositories =
          true;
        break;

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

async function readJson(filePath) {
  const source =
    await fs.readFile(
      filePath,
      "utf8"
    );

  return JSON.parse(source);
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

async function writeText(
  filePath,
  content
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
    content,
    "utf8"
  );
}

function runProcess({
  command,
  args,
  cwd,
  timeout = 120000
}) {
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
          64 * 1024 * 1024
      }
    );

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
        : null
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

function looksLikeInfrastructureFailure(
  result
) {
  const output =
    combinedOutput(result);

  return (
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
    result.signal !== null
  );
}

function extractErrorCodes(output) {
  const codes = new Set();

  const patterns = [
    /\[ERROR\]\s+([A-Z][A-Z0-9_]+)/g,
    /"severity"\s*:\s*"error"[\s\S]{0,200}?"code"\s*:\s*"([A-Z][A-Z0-9_]+)"/g,
    /"code"\s*:\s*"([A-Z][A-Z0-9_]+)"[\s\S]{0,200}?"severity"\s*:\s*"error"/g
  ];

  for (const pattern of patterns) {
    for (
      const match of
      output.matchAll(pattern)
    ) {
      codes.add(
        match[1]
      );
    }
  }

  return [
    ...codes
  ].sort();
}

async function generateFixtureRepositories({
  skillRoot,
  generatorPath,
  generatorReportPath
}) {
  const result =
    runProcess({
      command:
        "node",
      args: [
        generatorPath,
        "--root",
        skillRoot,
        "--keep-temp",
        "--json"
      ],
      cwd:
        skillRoot,
      timeout:
        180000
    });

  if (
    result.status !== 0 ||
    looksLikeInfrastructureFailure(
      result
    )
  ) {
    throw new Error(
      "Unable to generate small-slice integration fixtures:\n" +
      combinedOutput(result).slice(
        0,
        24000
      )
    );
  }

  if (
    await pathType(
      generatorReportPath
    ) !== "file"
  ) {
    throw new Error(
      "Fixture-generator report was not created: " +
      generatorReportPath
    );
  }

  const report =
    await readJson(
      generatorReportPath
    );

  if (
    report?.metrics
      ?.expectationMismatches !== 0
  ) {
    throw new Error(
      "Fixture generator completed with expectation mismatches."
    );
  }

  const temporaryRoot =
    report?.meta
      ?.temporaryRoot;

  if (
    typeof temporaryRoot !==
      "string" ||
    await pathType(
      temporaryRoot
    ) !== "directory"
  ) {
    throw new Error(
      "Fixture generator did not expose a valid temporary root."
    );
  }

  return {
    temporaryRoot:
      path.resolve(
        temporaryRoot
      ),
    generatorResult:
      result
  };
}

async function copyRepository({
  source,
  destination
}) {
  await fs.rm(
    destination,
    {
      recursive:
        true,
      force:
        true
    }
  );

  await fs.cp(
    source,
    destination,
    {
      recursive:
        true,
      force:
        true,
      preserveTimestamps:
        true
    }
  );
}

function runAuditor({
  scriptPath,
  manifestPath,
  repositoryRoot
}) {
  return runProcess({
    command:
      "node",
    args: [
      scriptPath,
      manifestPath
    ],
    cwd:
      repositoryRoot,
    timeout:
      60000
  });
}

async function createScenarioRepositories({
  generatedRoot,
  scenarioRoot
}) {
  const approvedSource =
    path.join(
      generatedRoot,
      "approved"
    );

  const scopeBlockedSource =
    path.join(
      generatedRoot,
      "scope-blocker"
    );

  for (const requiredDirectory of [
    approvedSource,
    scopeBlockedSource
  ]) {
    if (
      await pathType(
        requiredDirectory
      ) !== "directory"
    ) {
      throw new Error(
        `Generated repository is missing: ${requiredDirectory}`
      );
    }
  }

  const approvedRepository =
    path.join(
      scenarioRoot,
      "approved"
    );

  const fileViolationRepository =
    path.join(
      scenarioRoot,
      "file-violation"
    );

  const scopeViolationRepository =
    path.join(
      scenarioRoot,
      "scope-violation"
    );

  const evidenceViolationRepository =
    path.join(
      scenarioRoot,
      "evidence-violation"
    );

  await copyRepository({
    source:
      approvedSource,
    destination:
      approvedRepository
  });

  await copyRepository({
    source:
      approvedSource,
    destination:
      fileViolationRepository
  });

  await copyRepository({
    source:
      scopeBlockedSource,
    destination:
      scopeViolationRepository
  });

  await copyRepository({
    source:
      approvedSource,
    destination:
      evidenceViolationRepository
  });

  // 9C.2C.1 remove preparer outputs inherited from fixture generation.

  for (
    const repositoryRoot of [
      approvedRepository,
      fileViolationRepository,
      scopeViolationRepository,
      evidenceViolationRepository
    ]
  ) {
    const screenDirectory =
      path.join(
        repositoryRoot,
        SCREEN_DIRECTORY
      );

    const entries =
      await fs.readdir(
        screenDirectory,
        {
          withFileTypes:
            true
        }
      );

    for (const entry of entries) {
      if (
        entry.isFile() &&
        entry.name.startsWith(
          "representative-gate-preparation"
        ) &&
        entry.name.endsWith(
          ".json"
        )
      ) {
        await fs.rm(
          path.join(
            screenDirectory,
            entry.name
          ),
          {
            force:
              true
          }
        );
      }
    }
  }

  await writeText(
    path.join(
      fileViolationRepository,
      "src/features/gate-preparation/undeclared-change.ts"
    ),
    [
      (
        "export const undeclaredIntegrationTestChange = " +
        "true;"
      ),
      ""
    ].join("\n")
  );

  await fs.rm(
    path.join(
      evidenceViolationRepository,
      SCREEN_DIRECTORY,
      "browser-validation.md"
    ),
    {
      force:
        true
    }
  );

  return {
    approved:
      approvedRepository,
    fileViolation:
      fileViolationRepository,
    scopeViolation:
      scopeViolationRepository,
    evidenceViolation:
      evidenceViolationRepository
  };
}

function printProcessFailure({
  title,
  result
}) {
  process.stdout.write(
    `${title}\n`
  );

  process.stdout.write(
    `${combinedOutput(
      result
    ).slice(
      0,
      16000
    )}\n`
  );
}

function printReport(report) {
  process.stdout.write(
    "Frontend Product Builder — Small Slice Auditor Integration Tests\n"
  );

  process.stdout.write(
    "================================================================\n"
  );

  process.stdout.write(
    `Skill root: ${report.meta.skillRoot}\n`
  );

  process.stdout.write(
    `Temporary fixture root: ${report.meta.generatedFixtureRoot}\n`
  );

  process.stdout.write(
    `Temporary scenario root: ${report.meta.scenarioRoot}\n`
  );

  process.stdout.write(
    `Scripts expected: ${report.metrics.scriptsExpected}\n`
  );

  process.stdout.write(
    `Scripts discovered: ${report.metrics.scriptsDiscovered}\n`
  );

  process.stdout.write(
    `Syntax checks passed: ${report.metrics.syntaxChecksPassed}\n`
  );

  process.stdout.write(
    `Valid cases passed: ${report.metrics.validCasesPassed}\n`
  );

  process.stdout.write(
    `Invalid cases rejected: ${report.metrics.invalidCasesRejected}\n`
  );

  process.stdout.write(
    `Expectation mismatches: ${report.metrics.expectationMismatches}\n\n`
  );

  for (
    const auditor of
    report.auditors
  ) {
    process.stdout.write(
      `[${auditor.passed ? "PASS" : "FAIL"}] ${auditor.id}\n`
    );

    process.stdout.write(
      `Script: ${auditor.script}\n`
    );

    process.stdout.write(
      `Syntax: ${auditor.syntaxPassed ? "passed" : "failed"}\n`
    );

    process.stdout.write(
      `Valid manifest: ${auditor.validAccepted ? "accepted" : "rejected"}\n`
    );

    process.stdout.write(
      `Invalid mutation: ${auditor.invalidRejected ? "rejected" : "accepted"}\n`
    );

    process.stdout.write(
      `Mutation: ${auditor.invalidScenario}\n`
    );

    process.stdout.write(
      `Description: ${auditor.description}\n`
    );

    process.stdout.write(
      `Valid exit: ${auditor.validStatus}\n`
    );

    process.stdout.write(
      `Invalid exit: ${auditor.invalidStatus}\n`
    );

    process.stdout.write(
      `Detected invalid error codes: ${
        auditor.invalidErrorCodes.length > 0
          ? auditor.invalidErrorCodes.join(", ")
          : "none"
      }\n`
    );

    if (!auditor.passed) {
      printProcessFailure({
        title:
          "Valid process output:",
        result:
          auditor.validResult
      });

      printProcessFailure({
        title:
          "Invalid process output:",
        result:
          auditor.invalidResult
      });
    }

    process.stdout.write("\n");
  }

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
    `Information: ${report.auditors.length}\n`
  );

  process.stdout.write(
    `Total: ${
      report.auditors.length +
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

  const generatorPath =
    path.join(
      skillRoot,
      FIXTURE_GENERATOR_RELATIVE_PATH
    );

  const generatorReportPath =
    path.join(
      skillRoot,
      FIXTURE_GENERATOR_REPORT_RELATIVE_PATH
    );

  if (
    await pathType(
      generatorPath
    ) !== "file"
  ) {
    throw new Error(
      `Fixture generator is missing: ${generatorPath}`
    );
  }

  const discoveredAuditors = [];

  for (const auditor of AUDITORS) {
    const scriptPath =
      path.join(
        skillRoot,
        auditor.script
      );

    if (
      await pathType(
        scriptPath
      ) === "file"
    ) {
      discoveredAuditors.push({
        ...auditor,
        scriptPath
      });
    }
  }

  const syntaxResults = [];

  for (
    const auditor of
    discoveredAuditors
  ) {
    const result =
      runProcess({
        command:
          "node",
        args: [
          "--check",
          auditor.scriptPath
        ],
        cwd:
          skillRoot
      });

    syntaxResults.push({
      id:
        auditor.id,
      passed:
        result.status === 0,
      result
    });
  }

  const syntaxFailures =
    syntaxResults.filter(
      (result) => {
        return !result.passed;
      }
    );

  if (syntaxFailures.length > 0) {
    throw new Error(
      "One or more small-slice auditors failed syntax validation:\n" +
      syntaxFailures
        .map(
          (failure) => {
            return (
              `${failure.id}\n` +
              combinedOutput(
                failure.result
              )
            );
          }
        )
        .join("\n")
    );
  }

  const generatedFixtures =
    await generateFixtureRepositories({
      skillRoot,
      generatorPath,
      generatorReportPath
    });

  const scenarioRoot =
    await fs.mkdtemp(
      path.join(
        os.tmpdir(),
        "frontend-product-builder-9c2c1-"
      )
    );

  let report;

  try {
    const repositories =
      await createScenarioRepositories({
        generatedRoot:
          generatedFixtures
            .temporaryRoot,
        scenarioRoot
      });

    const repositoryByAuditor = {
      "small-slice-files": {
        valid:
          repositories.approved,
        invalid:
          repositories.fileViolation
      },

      "small-slice-scope": {
        valid:
          repositories.approved,
        invalid:
          repositories.scopeViolation
      },

      "small-slice-evidence": {
        valid:
          repositories.approved,
        invalid:
          repositories.evidenceViolation
      }
    };

    const results = [];

    for (
      const auditor of
      discoveredAuditors
    ) {
      const repositoriesForAuditor =
        repositoryByAuditor[
          auditor.id
        ];

      const validManifest =
        path.join(
          repositoriesForAuditor
            .valid,
          MANIFEST_RELATIVE_PATH
        );

      const invalidManifest =
        path.join(
          repositoriesForAuditor
            .invalid,
          MANIFEST_RELATIVE_PATH
        );

      const validResult =
        runAuditor({
          scriptPath:
            auditor.scriptPath,
          manifestPath:
            validManifest,
          repositoryRoot:
            repositoriesForAuditor
              .valid
        });

      const invalidResult =
        runAuditor({
          scriptPath:
            auditor.scriptPath,
          manifestPath:
            invalidManifest,
          repositoryRoot:
            repositoriesForAuditor
              .invalid
        });

      const validAccepted = (
        validResult.status === 0 &&
        !looksLikeInfrastructureFailure(
          validResult
        )
      );

      const invalidOutput =
        combinedOutput(
          invalidResult
        );

      const invalidErrorCodes =
        extractErrorCodes(
          invalidOutput
        );

      const invalidRejected = (
        invalidResult.status !== 0 &&
        !looksLikeInfrastructureFailure(
          invalidResult
        ) &&
        (
          invalidErrorCodes.length > 0 ||
          /\bErrors:\s*[1-9][0-9]*/i.test(
            invalidOutput
          )
        )
      );

      results.push({
        id:
          auditor.id,
        script:
          auditor.script,
        syntaxPassed:
          true,
        validAccepted,
        invalidRejected,
        invalidScenario:
          auditor.invalidScenario,
        description:
          auditor.description,
        validStatus:
          validResult.status,
        invalidStatus:
          invalidResult.status,
        invalidErrorCodes,
        validResult,
        invalidResult,
        passed: (
          validAccepted &&
          invalidRejected
        )
      });
    }

    const validCasesPassed =
      results.filter(
        (result) => {
          return result.validAccepted;
        }
      ).length;

    const invalidCasesRejected =
      results.filter(
        (result) => {
          return result.invalidRejected;
        }
      ).length;

    const expectationMismatches = (
      (
        AUDITORS.length -
        discoveredAuditors.length
      ) +
      (
        discoveredAuditors.length -
        syntaxResults.filter(
          (result) => result.passed
        ).length
      ) +
      results.filter(
        (result) => {
          return !result.passed;
        }
      ).length
    );

    report = {
      meta: {
        skillRoot,
        generatedFixtureRoot:
          generatedFixtures
            .temporaryRoot,
        scenarioRoot,
        generatedAt:
          new Date().toISOString(),
        temporaryRepositoriesKept: (
          options
            .keepTemporaryRepositories ||
          expectationMismatches > 0
        )
      },

      metrics: {
        scriptsExpected:
          AUDITORS.length,
        scriptsDiscovered:
          discoveredAuditors.length,
        syntaxChecksPassed:
          syntaxResults.filter(
            (result) => result.passed
          ).length,
        validCasesPassed,
        invalidCasesRejected,
        expectationMismatches
      },

      auditors:
        results
    };

    const reportPath =
      path.join(
        skillRoot,
        REPORT_RELATIVE_PATH
      );

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
      printReport(report);
    }

    process.exitCode = (
      expectationMismatches > 0
        ? 1
        : 0
    );
  } finally {
    const shouldKeep = (
      options
        .keepTemporaryRepositories ||
      (
        report &&
        report.metrics
          .expectationMismatches > 0
      )
    );

    if (!shouldKeep) {
      await fs.rm(
        scenarioRoot,
        {
          recursive:
            true,
          force:
            true
        }
      );

      await fs.rm(
        generatedFixtures
          .temporaryRoot,
        {
          recursive:
            true,
          force:
            true
        }
      );
    }
  }
}

main().catch((error) => {
  process.stderr.write(
    `${error.stack ?? error.message}\n`
  );

  process.exitCode = 1;
});
