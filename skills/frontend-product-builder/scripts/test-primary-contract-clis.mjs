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

const TARGETS = [
  {
    id: "styling-authority",
    script:
      "scripts/validate-styling-authority.mjs",
    validFixture:
      "evals/files/contracts/valid/styling-authority.valid.json",
    invalidFixture:
      "evals/files/contracts/invalid/styling-authority.invalid-missing-required.json",
    repositoryValid:
      "assets/templates/styling-authority.valid.json",
    repositoryInvalid:
      "assets/templates/styling-authority.invalid.json",
    schema:
      "assets/schemas/styling-authority.schema.json",
    inputFlags: [
      "--input",
      "--file",
      "--path"
    ]
  },
  {
    id: "screen-specification",
    script:
      "scripts/validate-screen-specification.mjs",
    validFixture:
      "evals/files/contracts/valid/screen-specification.valid.json",
    invalidFixture:
      "evals/files/contracts/invalid/screen-specification.invalid-missing-required.json",
    repositoryValid:
      "assets/templates/screen-specification.valid.json",
    repositoryInvalid:
      "assets/templates/screen-specification.invalid.json",
    schema:
      "assets/schemas/screen-specification.schema.json",
    inputFlags: []
  },
  {
    id: "small-slice-manifest",
    script:
      "scripts/validate-small-slice-manifest.mjs",
    validFixture:
      "evals/files/contracts/valid/small-slice-manifest.valid.json",
    invalidFixture:
      "evals/files/contracts/invalid/small-slice-manifest.invalid-missing-required.json",
    repositoryValid:
      "assets/templates/small-slice-manifest.valid.json",
    repositoryInvalid:
      "assets/templates/small-slice-manifest.invalid.json",
    schema:
      "assets/schemas/small-slice-manifest.schema.json",
    inputFlags: [
      "--manifest",
      "--manifest-path",
      "--small-slice-manifest",
      "--input",
      "--file",
      "--path"
    ]
  }
];

const ROOT_FLAGS = [
  "--root",
  "--skill-root",
  "--project-root",
  "--repo-root",
  "--cwd"
];

const SCHEMA_FLAGS = [
  "--schema",
  "--schema-path"
];

// These CLIs validate standalone template/eval fixtures inside a bare
// temporary repository, so repository-resolved reference checks cannot pass
// here. Reference checking is on by default in real projects; this suite opts
// out explicitly where the script supports it.
const REFERENCE_SKIP_FLAGS = [
  "--skip-references"
];

const CATALOG_FLAGS = [
  "--catalog-root",
  "--catalog-directory"
];

const RECIPE_FLAGS = [
  "--recipe-root",
  "--recipes-root",
  "--recipe-directory"
];

function parseArguments(argv) {
  const options = {
    root: DEFAULT_SKILL_ROOT,
    json: false,
    keepTemporaryRepository: false
  };

  for (
    let index = 0;
    index < argv.length;
    index += 1
  ) {
    const argument = argv[index];

    switch (argument) {
      case "--root": {
        const value = argv[index + 1];

        if (!value) {
          throw new Error(
            "--root requires a directory path."
          );
        }

        options.root = path.resolve(value);
        index += 1;
        break;
      }

      case "--json":
        options.json = true;
        break;

      case "--keep-temp":
        options.keepTemporaryRepository = true;
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
    const stats = await fs.stat(
      targetPath
    );

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

function runProcess({
  command,
  args,
  cwd,
  timeout = 20000
}) {
  const result = spawnSync(
    command,
    args,
    {
      cwd,
      encoding: "utf8",
      windowsHide: true,
      timeout,
      maxBuffer:
        4 * 1024 * 1024
    }
  );

  return {
    command,
    args,
    cwd,
    status:
      typeof result.status === "number"
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

function looksLikeUsageFailure(result) {
  const output =
    combinedOutput(result);

  return (
    /unknown option/i.test(output) ||
    /unknown argument/i.test(output) ||
    /unexpected argument/i.test(output) ||
    /requires (?:a |an )?(?:file|path|value|argument)/i.test(
      output
    ) ||
    /missing required (?:option|argument)/i.test(
      output
    ) ||
    /usage:\s/i.test(output)
  );
}

function looksLikeInfrastructureFailure(
  result
) {
  const output =
    combinedOutput(result);

  return (
    /ERR_MODULE_NOT_FOUND/.test(output) ||
    /Cannot find module/i.test(output) ||
    /SyntaxError:/i.test(output) ||
    /ReferenceError:/i.test(output) ||
    /command not found/i.test(output) ||
    /spawnSync .* ENOENT/i.test(output)
  );
}

function extractCliOptions(source) {
  const options = new Set();

  const patterns = [
    /["'`](--[a-z0-9][a-z0-9-]*)["'`]/gi,
    /case\s+["'`](--[a-z0-9][a-z0-9-]*)["'`]/gi
  ];

  for (const pattern of patterns) {
    let match;

    while (
      (
        match = pattern.exec(source)
      ) !== null
    ) {
      options.add(
        match[1]
      );
    }
  }

  return options;
}

function deduplicateArrays(values) {
  const seen = new Set();
  const results = [];

  for (const value of values) {
    const key =
      JSON.stringify(value);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    results.push(value);
  }

  return results;
}

function chooseDetectedFlags(
  detectedOptions,
  candidates
) {
  return candidates.filter(
    (candidate) => {
      return detectedOptions.has(
        candidate
      );
    }
  );
}

function buildInvocationCandidates({
  target,
  detectedOptions,
  skillRoot,
  repositoryRoot,
  validFile,
  schemaFile
}) {
  const detectedInputFlags =
    chooseDetectedFlags(
      detectedOptions,
      target.inputFlags
    );

  const inputModes =
    detectedInputFlags.length > 0
      ? [
          ...detectedInputFlags.map(
            (flag) => ({
              type: "flag",
              flag
            })
          ),
          {
            type: "positional",
            flag: null
          }
        ]
      : [
          {
            type: "positional",
            flag: null
          },
          ...target.inputFlags.map(
            (flag) => ({
              type: "flag",
              flag
            })
          )
        ];

  const detectedRootFlags =
    chooseDetectedFlags(
      detectedOptions,
      ROOT_FLAGS
    );

  const rootModes = [
    {
      flag: null,
      value: null
    }
  ];

  for (const rootFlag of detectedRootFlags) {
    rootModes.push(
      {
        flag: rootFlag,
        value: repositoryRoot
      },
      {
        flag: rootFlag,
        value: skillRoot
      }
    );
  }

  const detectedSchemaFlag =
    chooseDetectedFlags(
      detectedOptions,
      SCHEMA_FLAGS
    )[0] ?? null;

  const detectedCatalogFlag =
    chooseDetectedFlags(
      detectedOptions,
      CATALOG_FLAGS
    )[0] ?? null;

  const detectedRecipeFlag =
    chooseDetectedFlags(
      detectedOptions,
      RECIPE_FLAGS
    )[0] ?? null;

  const detectedReferenceSkipFlag =
    chooseDetectedFlags(
      detectedOptions,
      REFERENCE_SKIP_FLAGS
    )[0] ?? null;

  const candidates = [];

  for (const inputMode of inputModes) {
    for (const rootMode of rootModes) {
      const args = [];

      if (rootMode.flag) {
        args.push(
          rootMode.flag,
          rootMode.value
        );
      }

      if (detectedSchemaFlag) {
        args.push(
          detectedSchemaFlag,
          schemaFile
        );
      }

      if (detectedCatalogFlag) {
        args.push(
          detectedCatalogFlag,
          path.join(
            repositoryRoot,
            "assets/catalog"
          )
        );
      }

      if (detectedRecipeFlag) {
        args.push(
          detectedRecipeFlag,
          path.join(
            repositoryRoot,
            "assets/recipes"
          )
        );
      }

      if (detectedReferenceSkipFlag) {
        args.push(detectedReferenceSkipFlag);
      }

      if (inputMode.type === "flag") {
        args.push(
          inputMode.flag,
          validFile
        );
      } else {
        args.push(validFile);
      }

      candidates.push({
        args,
        inputMode:
          inputMode.type,
        inputFlag:
          inputMode.flag,
        rootFlag:
          rootMode.flag,
        rootValue:
          rootMode.value
      });
    }
  }

  return deduplicateArrays(
    candidates.map(
      (candidate) => candidate
    )
  ).slice(0, 40);
}

function replaceArgumentPath({
  args,
  from,
  to
}) {
  return args.map((argument) => {
    return argument === from
      ? to
      : argument;
  });
}

async function copyRequiredAssets({
  skillRoot,
  repositoryRoot
}) {
  const sourceAssets = path.join(
    skillRoot,
    "assets"
  );

  const destinationAssets = path.join(
    repositoryRoot,
    "assets"
  );

  await fs.mkdir(
    destinationAssets,
    {
      recursive: true
    }
  );

  for (const directory of [
    "schemas",
    "catalog",
    "recipes"
  ]) {
    const source = path.join(
      sourceAssets,
      directory
    );

    const destination = path.join(
      destinationAssets,
      directory
    );

    if (
      await pathType(source) !==
      "directory"
    ) {
      throw new Error(
        `Required asset directory is missing: ${source}`
      );
    }

    await fs.cp(
      source,
      destination,
      {
        recursive: true
      }
    );
  }

  await fs.mkdir(
    path.join(
      destinationAssets,
      "templates"
    ),
    {
      recursive: true
    }
  );
}

async function initializeGitRepository(
  repositoryRoot
) {
  const gitVersion = runProcess({
    command: "git",
    args: [
      "--version"
    ],
    cwd: repositoryRoot
  });

  if (gitVersion.status !== 0) {
    throw new Error(
      "Git is unavailable: " +
      combinedOutput(gitVersion)
    );
  }

  const commands = [
    [
      "init",
      "--quiet"
    ],
    [
      "config",
      "user.name",
      "Frontend Product Builder Tests"
    ],
    [
      "config",
      "user.email",
      "frontend-product-builder@example.invalid"
    ],
    [
      "add",
      "."
    ],
    [
      "commit",
      "--quiet",
      "-m",
      "Create integration-test baseline"
    ]
  ];

  for (const args of commands) {
    const result = runProcess({
      command: "git",
      args,
      cwd: repositoryRoot
    });

    if (result.status !== 0) {
      throw new Error(
        `Git command failed: git ${args.join(" ")}\n` +
        combinedOutput(result)
      );
    }
  }
}

async function prepareRepository({
  skillRoot,
  repositoryRoot
}) {
  await copyRequiredAssets({
    skillRoot,
    repositoryRoot
  });

  const preparedTargets = [];

  for (const target of TARGETS) {
    const validSource = path.join(
      skillRoot,
      target.validFixture
    );

    const invalidSource = path.join(
      skillRoot,
      target.invalidFixture
    );

    if (
      await pathType(validSource) !==
      "file"
    ) {
      throw new Error(
        `Valid fixture is missing: ${validSource}`
      );
    }

    if (
      await pathType(invalidSource) !==
      "file"
    ) {
      throw new Error(
        `Invalid fixture is missing: ${invalidSource}`
      );
    }

    const validDestination = path.join(
      repositoryRoot,
      target.repositoryValid
    );

    const invalidDestination = path.join(
      repositoryRoot,
      target.repositoryInvalid
    );

    await fs.copyFile(
      validSource,
      validDestination
    );

    await fs.copyFile(
      invalidSource,
      invalidDestination
    );

    preparedTargets.push({
      ...target,
      validFile:
        validDestination,
      invalidFile:
        invalidDestination,
      schemaFile:
        path.join(
          repositoryRoot,
          target.schema
        )
    });
  }

  await fs.writeFile(
    path.join(
      repositoryRoot,
      "README.md"
    ),
    [
      "# Frontend Product Builder Integration Test",
      "",
      "This repository is temporary and generated automatically.",
      ""
    ].join("\n"),
    "utf8"
  );

  await initializeGitRepository(
    repositoryRoot
  );

  return preparedTargets;
}

async function testTarget({
  skillRoot,
  repositoryRoot,
  target
}) {
  const scriptPath = path.join(
    skillRoot,
    target.script
  );

  if (
    await pathType(scriptPath) !==
    "file"
  ) {
    return {
      id: target.id,
      script:
        target.script,
      passed: false,
      syntaxPassed: false,
      validPassed: false,
      invalidRejected: false,
      failure:
        "Script is missing.",
      attempts: []
    };
  }

  const syntaxResult = runProcess({
    command: "node",
    args: [
      "--check",
      scriptPath
    ],
    cwd: repositoryRoot
  });

  if (syntaxResult.status !== 0) {
    return {
      id: target.id,
      script:
        target.script,
      passed: false,
      syntaxPassed: false,
      validPassed: false,
      invalidRejected: false,
      failure:
        "Script syntax validation failed.",
      syntaxResult,
      attempts: []
    };
  }

  const source = await fs.readFile(
    scriptPath,
    "utf8"
  );

  const detectedOptions =
    extractCliOptions(source);

  const candidates =
    buildInvocationCandidates({
      target,
      detectedOptions,
      skillRoot,
      repositoryRoot,
      validFile:
        target.validFile,
      schemaFile:
        target.schemaFile
    });

  const attempts = [];
  let selected = null;

  for (const candidate of candidates) {
    const result = runProcess({
      command: "node",
      args: [
        scriptPath,
        ...candidate.args
      ],
      cwd: repositoryRoot
    });

    attempts.push({
      args:
        candidate.args,
      status:
        result.status,
      usageFailure:
        looksLikeUsageFailure(
          result
        ),
      infrastructureFailure:
        looksLikeInfrastructureFailure(
          result
        ),
      output:
        combinedOutput(result)
          .slice(0, 4000)
    });

    if (
      result.status === 0 &&
      !looksLikeUsageFailure(result) &&
      !looksLikeInfrastructureFailure(
        result
      )
    ) {
      selected = {
        candidate,
        result
      };

      break;
    }
  }

  if (!selected) {
    return {
      id: target.id,
      script:
        target.script,
      passed: false,
      syntaxPassed: true,
      validPassed: false,
      invalidRejected: false,
      detectedOptions:
        [...detectedOptions].sort(),
      failure:
        "No CLI invocation accepted the valid fixture.",
      attempts
    };
  }

  const invalidArgs =
    replaceArgumentPath({
      args:
        selected.candidate.args,
      from:
        target.validFile,
      to:
        target.invalidFile
    });

  const invalidResult = runProcess({
    command: "node",
    args: [
      scriptPath,
      ...invalidArgs
    ],
    cwd: repositoryRoot
  });

  const invalidRejected = (
    invalidResult.status !== 0 &&
    !looksLikeUsageFailure(
      invalidResult
    ) &&
    !looksLikeInfrastructureFailure(
      invalidResult
    )
  );

  return {
    id: target.id,
    script:
      target.script,
    passed:
      invalidRejected,
    syntaxPassed: true,
    validPassed: true,
    invalidRejected,
    detectedOptions:
      [...detectedOptions].sort(),
    selectedInvocation: {
      validArgs:
        selected.candidate.args,
      invalidArgs,
      validStatus:
        selected.result.status,
      invalidStatus:
        invalidResult.status
    },
    validOutput:
      combinedOutput(
        selected.result
      ).slice(0, 6000),
    invalidOutput:
      combinedOutput(
        invalidResult
      ).slice(0, 6000),
    attempts
  };
}

function summarize(results) {
  return {
    scriptsDiscovered:
      results.filter(
        (result) => {
          return result.failure !==
            "Script is missing.";
        }
      ).length,

    syntaxChecksPassed:
      results.filter(
        (result) => {
          return result.syntaxPassed;
        }
      ).length,

    validCasesPassed:
      results.filter(
        (result) => {
          return result.validPassed;
        }
      ).length,

    invalidCasesRejected:
      results.filter(
        (result) => {
          return result.invalidRejected;
        }
      ).length,

    expectationMismatches:
      results.filter(
        (result) => {
          return !result.passed;
        }
      ).length
  };
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

    const installedSkillRoot = path.join(
      os.homedir(),
      ".agents/skills/frontend-product-builder"
    );

    return value
      .split(
        resolvedSkillRoot
      )
      .join(
        PORTABLE_REPORT_SKILL_ROOT
      )
      .split(
        installedSkillRoot
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

function printReport(report) {
  process.stdout.write(
    "Frontend Product Builder — Primary CLI Integration Tests\n"
  );

  process.stdout.write(
    "========================================================\n"
  );

  process.stdout.write(
    `Skill root: ${report.meta.skillRoot}\n`
  );

  process.stdout.write(
    `Temporary Git repository: ${report.meta.repositoryRoot}\n`
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

  for (const result of report.results) {
    const status =
      result.passed
        ? "PASS"
        : "FAIL";

    process.stdout.write(
      `[${status}] ${result.id}\n`
    );

    process.stdout.write(
      `Script: ${result.script}\n`
    );

    process.stdout.write(
      `Syntax: ${result.syntaxPassed ? "passed" : "failed"}\n`
    );

    process.stdout.write(
      `Valid fixture: ${result.validPassed ? "accepted" : "not accepted"}\n`
    );

    process.stdout.write(
      `Invalid fixture: ${result.invalidRejected ? "rejected" : "not rejected"}\n`
    );

    if (result.selectedInvocation) {
      process.stdout.write(
        `Valid arguments: ${JSON.stringify(
          result.selectedInvocation.validArgs
        )}\n`
      );

      process.stdout.write(
        `Invalid arguments: ${JSON.stringify(
          result.selectedInvocation.invalidArgs
        )}\n`
      );
    }

    if (result.failure) {
      process.stdout.write(
        `Failure: ${result.failure}\n`
      );

      const lastAttempts =
        result.attempts?.slice(-5) ?? [];

      for (const attempt of lastAttempts) {
        process.stdout.write(
          `Attempt: node ${result.script} ${attempt.args.join(" ")}\n`
        );

        process.stdout.write(
          `Exit: ${attempt.status}\n`
        );

        if (attempt.output) {
          process.stdout.write(
            `${attempt.output.slice(0, 1500)}\n`
          );
        }
      }
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
    `Information: ${report.results.length}\n`
  );

  process.stdout.write(
    `Total: ${
      report.results.length +
      report.metrics.expectationMismatches
    }\n`
  );
}

async function main() {
  const options = parseArguments(
    process.argv.slice(2)
  );

  const skillRoot =
    options.root;

  if (
    await pathType(skillRoot) !==
    "directory"
  ) {
    throw new Error(
      `Skill root is invalid: ${skillRoot}`
    );
  }

  const repositoryRoot =
    await fs.mkdtemp(
      path.join(
        os.tmpdir(),
        "frontend-product-builder-9c2a-"
      )
    );

  let report;

  try {
    const preparedTargets =
      await prepareRepository({
        skillRoot,
        repositoryRoot
      });

    const results = [];

    for (
      const target of
      preparedTargets
    ) {
      results.push(
        await testTarget({
          skillRoot,
          repositoryRoot,
          target
        })
      );
    }

    const summary =
      summarize(results);

    report = {
      meta: {
        skillRoot,
        repositoryRoot,
        generatedAt:
          new Date().toISOString(),
        temporaryRepositoryKept:
          options.keepTemporaryRepository ||
          summary.expectationMismatches > 0
      },

      metrics: {
        scriptsExpected:
          TARGETS.length,
        ...summary
      },

      results
    };

    const reportPath = path.join(
      skillRoot,
      "evals/files/contracts/primary-cli-integration-report.json"
    );

    await fs.writeFile(
      reportPath,
      `${JSON.stringify(
        portableReportValue(report),
        null,
        2
      )}\n`,
      "utf8"
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
      summary.expectationMismatches > 0
    )
      ? 1
      : 0;
  } finally {
    const shouldKeep = (
      options.keepTemporaryRepository ||
      (
        report &&
        report.metrics
          .expectationMismatches > 0
      )
    );

    if (!shouldKeep) {
      await fs.rm(
        repositoryRoot,
        {
          recursive: true,
          force: true
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
