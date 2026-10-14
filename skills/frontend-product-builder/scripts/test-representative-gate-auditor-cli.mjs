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

const AUDITOR_RELATIVE_PATH =
  "scripts/audit-representative-gate.mjs";

const SOURCE_FIXTURE_RELATIVE_PATH =
  "evals/files/contracts/valid/screen-specification.valid.json";

const REPORT_RELATIVE_PATH =
  "evals/files/contracts/representative-gate-auditor-integration-report.json";

const REQUIRED_GATE_IDS = Array.from(
  {
    length: 12
  },
  (
    _value,
    index
  ) => {
    return `GATE-${String(
      index + 1
    ).padStart(3, "0")}`;
  }
);

function parseArguments(argv) {
  const options = {
    root:
      DEFAULT_SKILL_ROOT,
    keepTemporaryRepository:
      false,
    json:
      false
  };

  for (
    let index = 0;
    index < argv.length;
    index += 1
  ) {
    const argument = argv[index];

    switch (argument) {
      case "--root": {
        const value = argv[
          index + 1
        ];

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
        options.keepTemporaryRepository =
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

function isObject(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function clone(value) {
  return structuredClone(value);
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

async function readJson(filePath) {
  const source = await fs.readFile(
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
      recursive: true
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
      recursive: true
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
  timeout = 30000
}) {
  const result = spawnSync(
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
        8 * 1024 * 1024
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
    )
  );
}

async function initializeGitRepository(
  repositoryRoot
) {
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
      "Create representative-gate integration baseline"
    ]
  ];

  for (const args of commands) {
    const result = runProcess({
      command:
        "git",
      args,
      cwd:
        repositoryRoot
    });

    if (result.status !== 0) {
      throw new Error(
        `Git command failed: git ${args.join(" ")}\n` +
        combinedOutput(result)
      );
    }
  }
}

function createApprovedSpecification(
  sourceSpecification
) {
  const specification =
    clone(sourceSpecification);

  if (!isObject(specification.meta)) {
    specification.meta = {};
  }

  if (
    !isObject(
      specification.implementation
    )
  ) {
    specification.implementation = {};
  }

  specification.meta.source =
    "docs/frontend/screens/gate-screen/screen-spec.json";

  specification.meta.status =
    "approved";

  specification.implementation
    .representativeSlice =
    "gate-screen-slice";

  // 9C.2B.2B.1 normalize approved-gate prerequisites.

  if (
    !isObject(
      specification.productContext
    )
  ) {
    specification.productContext = {};
  }

  specification.productContext
    .openQuestions =
    [];

  specification.implementation
    .blockers =
    [];

  specification.representativeGate = {
    enabled:
      true,

    representative:
      true,

    slice:
      "gate-screen-slice",

    status:
      "approved",

    requiredChecks:
      REQUIRED_GATE_IDS.map(
        (id) => {
          const fileName = (
            id === "GATE-010"
              ? "gate-010-screenshot.png"
              : `${id.toLowerCase()}.md`
          );

          return {
            id,
            description:
              `Integration-test evidence for ${id}.`,
            status:
              "passed",
            blocking:
              true,
            evidence: [
              (
                "docs/frontend/screens/gate-screen/" +
                `evidence/${fileName}`
              )
            ],
            notes:
              []
          };
        }
      ),

    openQuestions:
      [],

    blockers:
      [],

    approval: {
      approvedBy:
        "representative-gate-integration-test",
      approvedAt:
        "2026-08-04T12:00:00Z",
      notes: [
        (
          "Approved only inside the temporary " +
          "integration-test repository."
        )
      ]
    }
  };

  return specification;
}

async function createSpecificationFiles({
  repositoryRoot,
  specification
}) {
  const screenDirectory =
    path.join(
      repositoryRoot,
      "docs/frontend/screens/gate-screen"
    );

  const specificationFile =
    path.join(
      screenDirectory,
      "screen-spec.json"
    );

  await writeJson(
    specificationFile,
    specification
  );

  const planningArtifacts = [
    {
      name:
        "state-matrix.md",
      title:
        "State Matrix"
    },
    {
      name:
        "component-map.md",
      title:
        "Component Map"
    },
    {
      name:
        "implementation-plan.md",
      title:
        "Implementation Plan"
    }
  ];

  for (
    const artifact of
    planningArtifacts
  ) {
    await writeText(
      path.join(
        screenDirectory,
        artifact.name
      ),
      [
        `# ${artifact.title}`,
        "",
        (
          "Temporary representative-gate " +
          "integration-test artifact."
        ),
        ""
      ].join("\n")
    );
  }

  for (
    const check of
    specification
      .representativeGate
      .requiredChecks
  ) {
    for (
      const evidence of
      check.evidence
    ) {
      const evidenceFile =
        path.join(
          repositoryRoot,
          evidence
        );

      if (
        evidence.endsWith(
          ".png"
        )
      ) {
        const minimalPng =
          Buffer.from(
            (
              "iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB" +
              "CAQAAAC1HAwCAAAAC0lEQVR42mP8/x8" +
              "AAusB9WlK8V8AAAAASUVORK5CYII="
            ),
            "base64"
          );

        await fs.mkdir(
          path.dirname(
            evidenceFile
          ),
          {
            recursive: true
          }
        );

        await fs.writeFile(
          evidenceFile,
          minimalPng
        );
      } else {
        await writeText(
          evidenceFile,
          [
            `# ${check.id} Evidence`,
            "",
            (
              "Temporary evidence generated for " +
              "representative-gate integration testing."
            ),
            ""
          ].join("\n")
        );
      }
    }
  }

  return specificationFile;
}

async function prepareRepository({
  skillRoot,
  repositoryRoot
}) {
  const fixtureFile =
    path.join(
      skillRoot,
      SOURCE_FIXTURE_RELATIVE_PATH
    );

  if (
    await pathType(
      fixtureFile
    ) !== "file"
  ) {
    throw new Error(
      `Valid screen fixture is missing: ${fixtureFile}`
    );
  }

  const sourceSpecification =
    await readJson(
      fixtureFile
    );

  const approvedSpecification =
    createApprovedSpecification(
      sourceSpecification
    );

  const approvedFile =
    await createSpecificationFiles({
      repositoryRoot,
      specification:
        approvedSpecification
    });

  await writeText(
    path.join(
      repositoryRoot,
      "README.md"
    ),
    [
      "# Representative Gate Integration Test",
      "",
      (
        "This Git repository is temporary and " +
        "generated automatically."
      ),
      ""
    ].join("\n")
  );

  await initializeGitRepository(
    repositoryRoot
  );

  return {
    approvedSpecification,
    approvedFile
  };
}

function runAuditor({
  auditorPath,
  specificationFile,
  repositoryRoot
}) {
  return runProcess({
    command:
      "node",
    args: [
      auditorPath,
      specificationFile
    ],
    cwd:
      repositoryRoot
  });
}

async function runNegativeScenario({
  id,
  description,
  expectedCode,
  mutate,
  baseSpecification,
  auditorPath,
  repositoryRoot
}) {
  const specification =
    clone(baseSpecification);

  mutate(specification);

  const filePath =
    path.join(
      repositoryRoot,
      "contracts",
      `${id}.screen-spec.json`
    );

  await writeJson(
    filePath,
    specification
  );

  const result =
    runAuditor({
      auditorPath,
      specificationFile:
        filePath,
      repositoryRoot
    });

  const output =
    combinedOutput(result);

  const rejected = (
    result.status !== 0 &&
    !looksLikeInfrastructureFailure(
      result
    ) &&
    output.includes(
      expectedCode
    )
  );

  return {
    id,
    description,
    expectedCode,
    file:
      filePath,
    passed:
      rejected,
    status:
      result.status,
    expectedCodeFound:
      output.includes(
        expectedCode
      ),
    infrastructureFailure:
      looksLikeInfrastructureFailure(
        result
      ),
    output:
      output.slice(
        0,
        8000
      )
  };
}

function printReport(report) {
  process.stdout.write(
    "Frontend Product Builder — Representative Gate Auditor Integration Tests\n"
  );

  process.stdout.write(
    "=======================================================================\n"
  );

  process.stdout.write(
    `Skill root: ${report.meta.skillRoot}\n`
  );

  process.stdout.write(
    `Temporary Git repository: ${report.meta.repositoryRoot}\n`
  );

  process.stdout.write(
    `Auditors expected: ${report.metrics.auditorsExpected}\n`
  );

  process.stdout.write(
    `Auditors discovered: ${report.metrics.auditorsDiscovered}\n`
  );

  process.stdout.write(
    `Syntax checks passed: ${report.metrics.syntaxChecksPassed}\n`
  );

  process.stdout.write(
    `Approved gate accepted: ${report.metrics.approvedGateAccepted}\n`
  );

  process.stdout.write(
    `Negative scenarios rejected: ${report.metrics.negativeScenariosRejected}\n`
  );

  process.stdout.write(
    `Expectation mismatches: ${report.metrics.expectationMismatches}\n\n`
  );

  process.stdout.write(
    `[${report.approved.passed ? "PASS" : "FAIL"}] approved-gate\n`
  );

  process.stdout.write(
    `Exit: ${report.approved.status}\n`
  );

  process.stdout.write(
    `Approved specification: ${report.approved.file}\n`
  );

  if (!report.approved.passed) {
    process.stdout.write(
      `${report.approved.output}\n`
    );
  }

  process.stdout.write("\n");

  for (
    const scenario of
    report.negativeScenarios
  ) {
    process.stdout.write(
      `[${scenario.passed ? "PASS" : "FAIL"}] ${scenario.id}\n`
    );

    process.stdout.write(
      `Expected code: ${scenario.expectedCode}\n`
    );

    process.stdout.write(
      `Exit: ${scenario.status}\n`
    );

    process.stdout.write(
      `Expected code found: ${scenario.expectedCodeFound}\n`
    );

    if (!scenario.passed) {
      process.stdout.write(
        `${scenario.output}\n`
      );
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
    `Information: ${
      1 +
      report.negativeScenarios.length
    }\n`
  );

  process.stdout.write(
    `Total: ${
      1 +
      report.negativeScenarios.length +
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

  const auditorPath =
    path.join(
      skillRoot,
      AUDITOR_RELATIVE_PATH
    );

  if (
    await pathType(
      auditorPath
    ) !== "file"
  ) {
    throw new Error(
      `Representative-gate auditor is missing: ${auditorPath}`
    );
  }

  const syntaxResult =
    runProcess({
      command:
        "node",
      args: [
        "--check",
        auditorPath
      ],
      cwd:
        skillRoot
    });

  const syntaxPassed =
    syntaxResult.status === 0;

  if (!syntaxPassed) {
    throw new Error(
      "Representative-gate auditor syntax failed:\n" +
      combinedOutput(
        syntaxResult
      )
    );
  }

  const repositoryRoot =
    await fs.mkdtemp(
      path.join(
        os.tmpdir(),
        "frontend-product-builder-9c2b2b1-"
      )
    );

  let report;

  try {
    const prepared =
      await prepareRepository({
        skillRoot,
        repositoryRoot
      });

    const approvedResult =
      runAuditor({
        auditorPath,
        specificationFile:
          prepared.approvedFile,
        repositoryRoot
      });

    const approvedOutput =
      combinedOutput(
        approvedResult
      );

    const approvedPassed = (
      approvedResult.status === 0 &&
      !looksLikeInfrastructureFailure(
        approvedResult
      )
    );

    const negativeScenarios = [];

    negativeScenarios.push(
      await runNegativeScenario({
        id:
          "approved-without-approver",
        description:
          "Approved gate without approvedBy.",
        expectedCode:
          "SCREEN_GATE_APPROVED_BY_MISSING",
        baseSpecification:
          prepared.approvedSpecification,
        auditorPath,
        repositoryRoot,
        mutate:
          (specification) => {
            delete specification
              .representativeGate
              .approval
              .approvedBy;
          }
      })
    );

    negativeScenarios.push(
      await runNegativeScenario({
        id:
          "rejected-without-failed-check",
        description:
          "Rejected gate whose checks all remain passed.",
        expectedCode:
          "SCREEN_GATE_REJECTED_WITHOUT_FAILURE",
        baseSpecification:
          prepared.approvedSpecification,
        auditorPath,
        repositoryRoot,
        mutate:
          (specification) => {
            specification
              .representativeGate
              .status =
              "rejected";

            specification.meta.status =
              "rejected";
          }
      })
    );

    negativeScenarios.push(
      await runNegativeScenario({
        id:
          "approved-with-missing-evidence",
        description:
          "Approved gate references an evidence file that does not exist.",
        expectedCode:
          "SCREEN_GATE_EVIDENCE_FILE_MISSING",
        baseSpecification:
          prepared.approvedSpecification,
        auditorPath,
        repositoryRoot,
        mutate:
          (specification) => {
            specification
              .representativeGate
              .requiredChecks[0]
              .evidence = [
                (
                  "docs/frontend/screens/gate-screen/" +
                  "evidence/missing-gate-001.md"
                )
              ];
          }
      })
    );

    negativeScenarios.push(
      await runNegativeScenario({
        id:
          "representative-slice-mismatch",
        description:
          "Gate slice differs from implementation.representativeSlice.",
        expectedCode:
          "SCREEN_GATE_SLICE_MISMATCH",
        baseSpecification:
          prepared.approvedSpecification,
        auditorPath,
        repositoryRoot,
        mutate:
          (specification) => {
            specification
              .representativeGate
              .slice =
              "different-slice";
          }
      })
    );

    const negativeScenariosRejected =
      negativeScenarios.filter(
        (scenario) => {
          return scenario.passed;
        }
      ).length;

    const expectationMismatches = (
      (
        approvedPassed
          ? 0
          : 1
      ) +
      (
        negativeScenarios.length -
        negativeScenariosRejected
      )
    );

    report = {
      meta: {
        skillRoot,
        repositoryRoot,
        generatedAt:
          new Date().toISOString(),
        temporaryRepositoryKept: (
          options.keepTemporaryRepository ||
          expectationMismatches > 0
        )
      },

      metrics: {
        auditorsExpected:
          1,
        auditorsDiscovered:
          1,
        syntaxChecksPassed:
          syntaxPassed
            ? 1
            : 0,
        approvedGateAccepted:
          approvedPassed
            ? 1
            : 0,
        negativeScenariosExpected:
          negativeScenarios.length,
        negativeScenariosRejected,
        expectationMismatches
      },

      approved: {
        passed:
          approvedPassed,
        file:
          prepared.approvedFile,
        status:
          approvedResult.status,
        output:
          approvedOutput.slice(
            0,
            10000
          )
      },

      negativeScenarios
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
