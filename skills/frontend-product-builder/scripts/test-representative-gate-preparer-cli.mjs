#!/usr/bin/env node

import crypto from "node:crypto";
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

const PREPARER_RELATIVE_PATH =
  "scripts/prepare-representative-gate.mjs";

const MANIFEST_FIXTURE_RELATIVE_PATH =
  "evals/files/contracts/valid/small-slice-manifest.valid.json";

const SCREEN_FIXTURE_RELATIVE_PATH =
  "evals/files/contracts/valid/screen-specification.valid.json";

const SCHEMA_RELATIVE_PATH =
  "assets/schemas/small-slice-manifest.schema.json";

// The preparer now runs the visual composition audits, so a substantial
// screen fixture must carry the whole composition contract set.
const DESIGN_SYSTEM_FIXTURE_RELATIVE_PATH =
  "evals/files/contracts/valid/design-system.valid.json";

const COMPOSITION_PROOF_FIXTURE_RELATIVE_PATH =
  "evals/files/contracts/valid/composition-proof.valid.json";

const COMPOSITION_EVIDENCE_FIXTURE_RELATIVE_PATH =
  "evals/files/contracts/valid/visual-composition-evidence.valid.json";

const VISUAL_SCORECARD_FIXTURE_RELATIVE_PATH =
  "evals/files/contracts/valid/visual-quality-scorecard.valid.json";

const DESIGN_SYSTEM_PROJECT_PATH =
  "docs/frontend/design-system/design-system.json";

const REPORT_RELATIVE_PATH =
  "evals/files/contracts/representative-gate-preparer-integration-report.json";

const CHILD_AUDITS = [
  {
    id:
      "styling-contract",
    script:
      "scripts/validate-styling-authority.mjs"
  },
  {
    id:
      "styling-global",
    script:
      "scripts/audit-styling-authority.mjs"
  },
  {
    id:
      "manifest",
    script:
      "scripts/validate-small-slice-manifest.mjs"
  },
  {
    id:
      "files",
    script:
      "scripts/audit-small-slice-files.mjs"
  },
  {
    id:
      "scope",
    script:
      "scripts/audit-small-slice-scope.mjs"
  },
  {
    id:
      "evidence",
    script:
      "scripts/audit-small-slice-evidence.mjs"
  }
];

const REQUIRED_GATE_IDS = Array.from(
  {
    length:
      12
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

const SCREEN_ID =
  "gate-preparation-screen";

const SLICE_ID =
  "gate-preparation-slice";

const SCREEN_DIRECTORY =
  `docs/frontend/screens/${SCREEN_ID}`;

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

async function sha256OfFile(filePath) {
  return crypto
    .createHash("sha256")
    .update(await fs.readFile(filePath))
    .digest("hex");
}

// Writes the composition contract set the preparer's visual audits require and
// binds composition-proof/visual-composition-evidence to the digests of the
// screen specification and design system actually written to this repository.
async function writeCompositionContractSet({
  repositoryRoot,
  screenDirectory,
  screenSpecificationPath,
  sourceDesignSystem,
  sourceCompositionProof,
  sourceCompositionEvidence,
  sourceVisualScorecard
}) {
  const designSystemPath = path.join(
    repositoryRoot,
    DESIGN_SYSTEM_PROJECT_PATH
  );

  await writeJson(designSystemPath, clone(sourceDesignSystem));

  const screenSpecSha256 = await sha256OfFile(screenSpecificationPath);
  const designSystemSha256 = await sha256OfFile(designSystemPath);

  const compositionProof = clone(sourceCompositionProof);
  compositionProof.contractHashes = {
    ...compositionProof.contractHashes,
    screenSpecSha256,
    designSystemSha256
  };

  const compositionProofPath = path.join(
    screenDirectory,
    "composition-proof.json"
  );

  await writeJson(compositionProofPath, compositionProof);

  const compositionEvidence = clone(sourceCompositionEvidence);
  compositionEvidence.contractHashes = {
    ...compositionEvidence.contractHashes,
    screenSpecSha256,
    designSystemSha256,
    compositionProofSha256: await sha256OfFile(compositionProofPath)
  };

  await writeJson(
    path.join(screenDirectory, "visual-composition-evidence.json"),
    compositionEvidence
  );

  // The eval fixture is the pre-review baseline (every blocking criterion
  // "not-run"). A repository that reaches the representative gate must show the
  // criteria actually evaluated, so record them as passed here. The human
  // decision itself stays "awaiting-review": the preparer never approves.
  const visualScorecard = clone(sourceVisualScorecard);
  visualScorecard.criteria = (
    Array.isArray(visualScorecard.criteria) ? visualScorecard.criteria : []
  ).map(
    (criterion) => ({
      ...criterion,
      result: "passed",
      evidence: criterion.evidence
        || "Representative slice screenshots and rendered composition evidence."
    })
  );

  await writeJson(
    path.join(screenDirectory, "visual-quality-scorecard.json"),
    visualScorecard
  );
}

async function writeMinimalPng(
  filePath
) {
  const content =
    Buffer.from(
      (
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB" +
        "CAQAAAC1HAwCAAAAC0lEQVR42mP8/x8" +
        "AAusB9WlK8V8AAAAASUVORK5CYII="
      ),
      "base64"
    );

  await fs.mkdir(
    path.dirname(filePath),
    {
      recursive:
        true
    }
  );

  await fs.writeFile(
    filePath,
    content
  );
}

function runProcess({
  command,
  args,
  cwd,
  timeout = 45000
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
          16 * 1024 * 1024
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
    )
  );
}

async function initializeGitRepository(
  repositoryRoot
) {
  let initResult =
    runProcess({
      command:
        "git",
      args: [
        "init",
        "--quiet",
        "-b",
        "main"
      ],
      cwd:
        repositoryRoot
    });

  if (initResult.status !== 0) {
    initResult =
      runProcess({
        command:
          "git",
        args: [
          "init",
          "--quiet"
        ],
        cwd:
          repositoryRoot
      });

    if (initResult.status !== 0) {
      throw new Error(
        "Unable to initialize temporary Git repository:\n" +
        combinedOutput(initResult)
      );
    }

    const branchResult =
      runProcess({
        command:
          "git",
        args: [
          "checkout",
          "-b",
          "main"
        ],
        cwd:
          repositoryRoot
      });

    if (branchResult.status !== 0) {
      throw new Error(
        "Unable to create temporary main branch:\n" +
        combinedOutput(branchResult)
      );
    }
  }

  const commands = [
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
      "Create representative-gate preparation baseline"
    ]
  ];

  for (const args of commands) {
    const result =
      runProcess({
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

function validatedDocument({
  title,
  body
}) {
  return [
    `# ${title}`,
    "",
    "**Gate status:** `validated`",
    "",
    body,
    "",
    "## Validation summary",
    "",
    "- Errors: 0",
    "- Warnings: 0",
    "- Blocking defects: 0",
    "- Required scenarios completed: yes",
    ""
  ].join("\n");
}

function createReadinessReport() {
  // 9C.2B.2B.2 readiness contract aligned with small-slice release.

  return {
    schemaVersion:
      "1.0.0",

    meta: {
      id:
        `${SCREEN_ID}-readiness-report`,
      screenId:
        SCREEN_ID,
      status:
        "validated",
      generatedAt:
        "2026-08-04T18:00:00Z",
      structuralOnly:
        false,
      strictWarnings:
        false
    },

    status:
      "ready-for-small-slice",

    readinessStatus:
      "ready-for-small-slice",

    nextAllowedStage:
      "SMALL SLICE",

    structuralOnly:
      false,

    strictWarnings:
      false,

    readiness: {
      status:
        "ready-for-small-slice",
      readinessStatus:
        "ready-for-small-slice",
      nextAllowedStage:
        "SMALL SLICE",
      structuralOnly:
        false,
      strictWarnings:
        false
    },

    release: {
      status:
        "ready-for-small-slice",
      readinessStatus:
        "ready-for-small-slice",
      nextAllowedStage:
        "SMALL SLICE",
      allowedStages: [
        "SMALL SLICE"
      ],
      structuralOnly:
        false,
      strictWarnings:
        false
    },

    summary: {
      errors:
        0,
      warnings:
        0,
      information:
        1,
      total:
        1
    },

    blockers:
      [],

    openQuestions:
      []
  };
}

function createScreenshotRegistry() {
  const captures = [
    {
      id:
        "capture-data-wide",
      stateId:
        "data",
      fixtureId:
        "primary-fixture",
      path:
        `${SCREEN_DIRECTORY}/screenshots/${SCREEN_ID}-data-1440x900.png`,
      viewport: {
        id:
          "wide",
        width:
          1440,
        height:
          900,
        deviceScaleFactor:
          1
      }
    },
    {
      id:
        "capture-data-compact",
      stateId:
        "data",
      fixtureId:
        "primary-fixture",
      path:
        `${SCREEN_DIRECTORY}/screenshots/${SCREEN_ID}-data-390x844.png`,
      viewport: {
        id:
          "compact",
        width:
          390,
        height:
          844,
        deviceScaleFactor:
          1
      }
    },
    {
      id:
        "capture-non-success",
      stateId:
        "error-state",
      fixtureId:
        "non-success-fixture",
      path:
        `${SCREEN_DIRECTORY}/screenshots/${SCREEN_ID}-error-state-1024x768.png`,
      viewport: {
        id:
          "constrained",
        width:
          1024,
        height:
          768,
        deviceScaleFactor:
          1
      }
    }
  ].map(
    (capture) => {
      return {
        ...capture,

        purpose:
          "Approved integration-test screenshot evidence.",

        route:
          "/gate-preparation",

        browserZoomPercent:
          100,

        textScalePercent:
          100,

        reducedMotion:
          false,

        capturedAt:
          "2026-08-04T18:00:00Z",

        status:
          "approved",

        expected: [
          "The declared state is visible.",
          "No page-level horizontal overflow."
        ],

        observed: [
          "The declared state was observed.",
          "No page-level horizontal overflow was observed."
        ],

        checks: {
          stateAccuracy:
            "passed",
          responsive:
            "passed",
          designSystem:
            "passed",
          componentUsage:
            "passed",
          accessibility:
            "passed",
          contentStress:
            "passed",
          horizontalOverflow:
            "passed"
        },

        defectIds:
          [],

        approvedBy:
          "representative-gate-preparer-integration-test",

        approvedAt:
          "2026-08-04T18:05:00Z"
      };
    }
  );

  return {
    schemaVersion:
      "1.0.0",

    meta: {
      id:
        `${SCREEN_ID}-screenshot-evidence`,
      screenId:
        SCREEN_ID,
      sliceId:
        SLICE_ID,
      status:
        "validated",
      owner:
        "frontend-product-builder-integration-test",
      source:
        `${SCREEN_DIRECTORY}/screenshot-evidence.json`,
      createdAt:
        "2026-08-04T18:00:00Z",
      updatedAt:
        "2026-08-04T18:05:00Z"
    },

    screen: {
      name:
        "Gate Preparation Screen",
      route:
        "/gate-preparation",
      manifest:
        `${SCREEN_DIRECTORY}/small-slice-manifest.json`,
      browserValidation:
        `${SCREEN_DIRECTORY}/browser-validation.md`,
      defectLog:
        `${SCREEN_DIRECTORY}/defect-log.md`
    },

    captureEnvironment: {
      operatingSystem:
        "Temporary Linux integration environment",
      browser:
        "Chromium",
      browserVersion:
        "integration-test",
      renderingEngine:
        "Blink",
      locale:
        "en-US",
      timezone:
        "UTC",
      colorScheme:
        "light",
      reducedMotion:
        "default",
      applicationSource:
        "browser-test-server",
      applicationUrl:
        "http://127.0.0.1:4173",
      commit:
        "HEAD"
    },

    policy: {
      containsProductionData:
        false,
      containsSecrets:
        false,
      syntheticFixturesOnly:
        true,
      redactionRequired:
        false,
      redactionNotes:
        [],
      externalImageDependencies:
        false,
      deterministicClock:
        true,
      fixedClock:
        "2026-08-04T18:00:00Z"
    },

    fixtures: [
      {
        id:
          "primary-fixture",
        stateId:
          "data",
        source:
          "src/features/gate-preparation/fixtures/representative.ts",
        safe:
          true,
        deterministic:
          true
      },
      {
        id:
          "non-success-fixture",
        stateId:
          "error-state",
        source:
          "src/features/gate-preparation/fixtures/representative.ts",
        safe:
          true,
        deterministic:
          true
      }
    ],

    captures,

    requiredCaptureIds:
      captures.map(
        (capture) => capture.id
      ),

    validation: {
      allowedStatuses: [
        "planned",
        "captured",
        "rejected",
        "approved"
      ],

      allowedCheckStatuses: [
        "pending",
        "passed",
        "failed",
        "not-applicable"
      ],

      approvalRequires: [
        "Image exists.",
        "All applicable checks passed.",
        "No unresolved blocking defect exists."
      ]
    }
  };
}

function normalizeManifest(
  sourceManifest
) {
  const manifest =
    clone(sourceManifest);

  manifest.$schema =
    "~/.agents/skills/frontend-product-builder/assets/schemas/small-slice-manifest.schema.json";

  manifest.meta.id =
    `${SCREEN_ID}-small-slice`;

  manifest.meta.name =
    "Gate Preparation Screen Small Slice";

  manifest.meta.status =
    "validated";

  manifest.meta.owner =
    "frontend-product-builder-integration-test";

  manifest.meta.source =
    `${SCREEN_DIRECTORY}/small-slice-manifest.json`;

  manifest.meta.generated =
    false;

  manifest.meta.description =
    "Executable representative-slice contract used by the preparer integration test.";

  manifest.meta.createdAt =
    "2026-08-04";

  manifest.meta.updatedAt =
    "2026-08-04";

  manifest.screen.id =
    SCREEN_ID;

  manifest.screen.name =
    "Gate Preparation Screen";

  manifest.screen.screenSpecification =
    `${SCREEN_DIRECTORY}/screen-spec.json`;

  manifest.screen.stateMatrix =
    `${SCREEN_DIRECTORY}/state-matrix.md`;

  manifest.screen.componentMap =
    `${SCREEN_DIRECTORY}/component-map.md`;

  manifest.screen.implementationPlan =
    `${SCREEN_DIRECTORY}/implementation-plan.md`;

  manifest.screen.readinessReport =
    `${SCREEN_DIRECTORY}/readiness-report.json`;

  manifest.release.readinessStatus =
    "ready-for-small-slice";

  manifest.release.nextAllowedStage =
    "SMALL SLICE";

  manifest.release.reportPath =
    manifest.screen.readinessReport;

  manifest.release.reportGeneratedAt =
    "2026-08-04T18:00:00Z";

  manifest.release.structuralOnly =
    false;

  manifest.release.strictWarnings =
    false;

  manifest.release.validatedBeforeSlice =
    true;

  manifest.repository.inspectionFile =
    `${SCREEN_DIRECTORY}/repository-inspection.md`;

  manifest.repository.root =
    ".";

  manifest.repository.workspaceType =
    "single-package";

  manifest.repository.applicationPackage =
    ".";

  manifest.repository.packageManager = {
    name:
      "npm",
    version:
      null,
    lockfile:
      "package-lock.json",
    authority:
      "package-lock.json is committed at the repository root."
  };

  manifest.repository.commands = {
    install:
      "npm ci",
    dev:
      "npm run dev",
    build:
      "npm run build",
    typecheck:
      "npm run typecheck",
    lint:
      "npm run lint",
    test:
      "npm test",
    storybook:
      null,
    browserTest:
      "npm run test:browser"
  };

  manifest.repository.migrationRequired =
    false;

  manifest.repository.migrationApproved =
    false;

  /*
   * HEAD is resolved by Git when the audits run. This keeps the
   * temporary repository clean without requiring a self-referential
   * commit hash inside the committed manifest.
   */
  manifest.repository.baselineCommit =
    "HEAD";

  manifest.repository.baselineBranch =
    "main";

  manifest.repository.baselineCapturedAt =
    "2026-08-04T18:00:00Z";

  manifest.repository.preExistingChanges =
    [];

  manifest.slice.id =
    SLICE_ID;

  manifest.slice.name =
    "Gate Preparation Representative Slice";

  manifest.slice.purpose =
    "Prove the representative-gate preparation workflow.";

  manifest.slice.routeOrSurface =
    "/gate-preparation";

  manifest.slice.entryPoint =
    "src/features/gate-preparation/GatePreparationScreen.tsx";

  manifest.slice.extensionPath =
    "The representative route and feature boundary extend directly into the final screen.";

  manifest.slice.architectureProof =
    "Route, feature, fixture, component, token, state, and side-effect ownership.";

  manifest.slice.stateProof =
    "Primary data and recoverable error states.";

  manifest.slice.interactionProof =
    "Refresh interaction with keyboard, focus, success, and failure behavior.";

  manifest.slice.responsiveProof =
    "Compact, constrained, and wide transformations.";

  manifest.slice.accessibilityProof =
    "Semantic structure, keyboard operation, focus, announcements, zoom, and reflow.";

  manifest.slice.completionDefinition = [
    "All required preparer audits pass.",
    "All twelve representative-gate checks are passed.",
    "The preparation artifact permits approval."
  ];

  manifest.scope.inScope = [
    "Representative route, state, interaction, responsive, accessibility, and evidence proof."
  ];

  manifest.scope.outOfScope = [
    "Production deployment and unrelated product surfaces."
  ];

  manifest.scope.assumptions = [
    "The temporary repository is disposable."
  ];

  manifest.scope.blockers =
    [];

  manifest.scope.approvedDependencyChanges =
    [];

  manifest.architecture.routeOwner =
    "src/features/gate-preparation/GatePreparationScreen.tsx";

  manifest.architecture.featureBoundary =
    "src/features/gate-preparation";

  manifest.architecture.dataAdapter =
    "src/features/gate-preparation/fixtures/representative.ts";

  manifest.architecture.fixtureAdapter =
    "src/features/gate-preparation/fixtures/representative.ts";

  manifest.architecture.componentSources = [
    "src/features/gate-preparation/GatePreparationScreen.tsx"
  ];

  manifest.architecture.tokenSources = [
    "src/styles/tokens.css"
  ];

  manifest.architecture.stateOwners = [
    {
      concern:
        "representative screen state",
      owner:
        "GatePreparationScreen",
      boundary:
        "Owns presentation state without bypassing the fixture adapter."
    }
  ];

  manifest.architecture.sideEffectOwners = [
    {
      concern:
        "refresh interaction",
      owner:
        "gate-preparation feature",
      boundary:
        "Executes the controlled refresh inside the feature boundary."
    }
  ];

  manifest.fixtures.strategyFile =
    `${SCREEN_DIRECTORY}/fixture-strategy.md`;

  manifest.fixtures.modelBoundary =
    "GatePreparationViewModel";

  manifest.fixtures.deterministic =
    true;

  manifest.fixtures.containsProductionData =
    false;

  manifest.fixtures.items = [
    {
      id:
        "primary-fixture",
      stateId:
        "data",
      purpose:
        "Primary representative data state.",
      source:
        "src/features/gate-preparation/fixtures/representative.ts",
      model:
        "GatePreparationViewModel",
      representative:
        true,
      safe:
        true,
      edgeCases: [
        "Long labels and bounded values."
      ]
    },
    {
      id:
        "non-success-fixture",
      stateId:
        "error-state",
      purpose:
        "Recoverable normalized failure state.",
      source:
        "src/features/gate-preparation/fixtures/representative.ts",
      model:
        "GatePreparationFailureViewModel",
      representative:
        true,
      safe:
        true,
      edgeCases: [
        "Recovery remains available."
      ]
    }
  ];

  manifest.states = [
    {
      id:
        "data",
      category:
        "data",
      role:
        "primary",
      fixtureId:
        "primary-fixture",
      dataAuthority:
        "The deterministic fixture adapter is authoritative.",
      preservedContext: [
        "Route and screen shell."
      ],
      visibleRegions: [
        "main"
      ],
      enabledActions: [
        "refresh"
      ],
      recovery:
        [],
      expectedEvidence: [
        `${SCREEN_DIRECTORY}/screenshots/${SCREEN_ID}-data-1440x900.png`
      ]
    },
    {
      id:
        "error-state",
      category:
        "error",
      role:
        "non-success",
      fixtureId:
        "non-success-fixture",
      dataAuthority:
        "The normalized failure model is authoritative.",
      preservedContext: [
        "Route, screen shell, and safe prior context."
      ],
      visibleRegions: [
        "main",
        "error-feedback"
      ],
      enabledActions: [
        "retry"
      ],
      recovery: [
        "Retry the controlled fixture request."
      ],
      expectedEvidence: [
        `${SCREEN_DIRECTORY}/screenshots/${SCREEN_ID}-error-state-1024x768.png`
      ]
    }
  ];

  manifest.interactions = [
    {
      id:
        "refresh",
      userGoal:
        "Refresh the representative screen.",
      trigger:
        "Activate the Refresh button.",
      owner:
        "gate-preparation feature",
      sideEffectBoundary:
        "Controlled feature data adapter.",
      eligibility:
        "Available when no equivalent refresh is pending.",
      success:
        "Replace the view model with the authoritative result.",
      failure:
        "Show normalized feedback while preserving safe context.",
      keyboard:
        "The button is reachable and activatable from the keyboard.",
      focus:
        "Focus remains on the invoking control after completion."
    }
  ];

  manifest.responsive.proof =
    "The same task hierarchy remains usable at compact, constrained, and wide sizes.";

  manifest.responsive.ranges = [
    {
      id:
        "compact",
      condition:
        "Viewport width up to 480px.",
      layout:
        "Single-column layout.",
      regionTransformation: [
        "Stack content regions vertically."
      ],
      actionTransformation: [
        "Preserve the primary action before secondary content."
      ],
      scrollBehavior: [
        "The page owns vertical scrolling."
      ],
      evidence: [
        `${SCREEN_DIRECTORY}/screenshots/${SCREEN_ID}-data-390x844.png`
      ]
    },
    {
      id:
        "wide",
      condition:
        "Viewport width of 1024px or greater.",
      layout:
        "Bounded multi-region layout.",
      regionTransformation: [
        "Use the available inline space without changing semantic order."
      ],
      actionTransformation: [
        "Keep the primary action visible."
      ],
      scrollBehavior: [
        "The page owns vertical scrolling."
      ],
      evidence: [
        `${SCREEN_DIRECTORY}/screenshots/${SCREEN_ID}-data-1440x900.png`
      ]
    }
  ];

  manifest.responsive.primaryScrollOwner =
    "page";

  manifest.responsive.localScrollOwners =
    [];

  manifest.responsive.pageHorizontalOverflowAllowed =
    false;

  manifest.accessibility.proof =
    "Keyboard, focus, semantics, announcement, zoom, and reflow behavior are validated.";

  manifest.accessibility.semantics = [
    "Main landmark and hierarchical heading."
  ];

  manifest.accessibility.accessibleNames = [
    "Visible labels provide accessible names."
  ];

  manifest.accessibility.keyboard = [
    "All controls are keyboard reachable and operable."
  ];

  manifest.accessibility.focus = [
    "Focus order follows the semantic task order."
  ];

  manifest.accessibility.announcements = [
    "Failure feedback uses controlled status semantics."
  ];

  manifest.accessibility.reducedMotion = [
    "No essential behavior depends on motion."
  ];

  manifest.accessibility.zoomAndReflow = [
    "Validated at 125% browser zoom.",
    "Validated at 200% text scaling."
  ];

  manifest.accessibility.evidence = [
    `${SCREEN_DIRECTORY}/accessibility-report.md`
  ];

  manifest.files = [
    {
      path:
        "src/features/gate-preparation/GatePreparationScreen.tsx",
      action:
        "modify",
      disposition:
        "production",
      purpose:
        "Representative production-intended screen.",
      owner:
        "gate-preparation feature",
      planned:
        true,
      dependencies: [
        "GatePreparationViewModel"
      ]
    },
    {
      path:
        "src/features/gate-preparation/fixtures/representative.ts",
      action:
        "modify",
      disposition:
        "fixture",
      purpose:
        "Safe deterministic representative fixtures.",
      owner:
        "gate-preparation feature",
      planned:
        true,
      dependencies: [
        "GatePreparationViewModel"
      ]
    },
    {
      path:
        "src/features/gate-preparation/GatePreparationScreen.test.tsx",
      action:
        "modify",
      disposition:
        "test",
      purpose:
        "State, interaction, and accessibility proof.",
      owner:
        "gate-preparation feature",
      planned:
        true,
      dependencies: [
        "GatePreparationScreen"
      ]
    }
  ];

  const evidencePaths = {
    readiness:
      `${SCREEN_DIRECTORY}/readiness-report.json`,
    wideScreenshot:
      `${SCREEN_DIRECTORY}/screenshots/${SCREEN_ID}-data-1440x900.png`,
    compactScreenshot:
      `${SCREEN_DIRECTORY}/screenshots/${SCREEN_ID}-data-390x844.png`,
    nonSuccess:
      `${SCREEN_DIRECTORY}/browser-test-report.md`,
    accessibility:
      `${SCREEN_DIRECTORY}/accessibility-report.md`,
    journal:
      `${SCREEN_DIRECTORY}/small-slice-implementation-journal.md`,
    browser:
      `${SCREEN_DIRECTORY}/browser-validation.md`,
    screenshots:
      `${SCREEN_DIRECTORY}/screenshot-evidence.json`,
    designAudit:
      `${SCREEN_DIRECTORY}/design-system-audit.md`,
    defectLog:
      `${SCREEN_DIRECTORY}/defect-log.md`
  };

  manifest.evidence = [
    {
      id:
        "readiness-evidence",
      type:
        "readiness-report",
      required:
        true,
      path:
        evidencePaths.readiness,
      description:
        "Readiness release for representative review.",
      status:
        "available"
    },
    {
      id:
        "primary-state-screenshot",
      type:
        "screenshot",
      required:
        true,
      path:
        evidencePaths.wideScreenshot,
      description:
        "Wide primary-state screenshot.",
      status:
        "available"
    },
    {
      id:
        "compact-state-screenshot",
      type:
        "screenshot",
      required:
        true,
      path:
        evidencePaths.compactScreenshot,
      description:
        "Compact primary-state screenshot.",
      status:
        "available"
    },
    {
      id:
        "non-success-evidence",
      type:
        "browser-test",
      required:
        true,
      path:
        evidencePaths.nonSuccess,
      description:
        "Browser evidence for the non-success state.",
      status:
        "available"
    },
    {
      id:
        "accessibility-evidence",
      type:
        "accessibility-report",
      required:
        true,
      path:
        evidencePaths.accessibility,
      description:
        "Accessibility validation report.",
      status:
        "available"
    },
    {
      id:
        "implementation-journal-evidence",
      type:
        "implementation-journal",
      required:
        true,
      path:
        evidencePaths.journal,
      description:
        "Traceable representative-slice implementation journal.",
      status:
        "passed"
    },
    {
      id:
        "browser-validation-evidence",
      type:
        "browser-validation",
      required:
        true,
      path:
        evidencePaths.browser,
      description:
        "Executed browser validation.",
      status:
        "passed"
    },
    {
      id:
        "screenshot-registry-evidence",
      type:
        "screenshot-registry",
      required:
        true,
      path:
        evidencePaths.screenshots,
      description:
        "Approved screenshot registry.",
      status:
        "available"
    },
    {
      id:
        "design-system-audit-evidence",
      type:
        "design-system-audit",
      required:
        true,
      path:
        evidencePaths.designAudit,
      description:
        "Validated design-system audit.",
      status:
        "passed"
    },
    {
      id:
        "defect-log-evidence",
      type:
        "defect-log",
      required:
        true,
      path:
        evidencePaths.defectLog,
      description:
        "Validated defect inventory.",
      status:
        "passed"
    }
  ];

  manifest.sequence = [
    {
      order:
        1,
      id:
        "confirm-release",
      description:
        "Confirm the readiness release.",
      dependencies:
        [],
      completionEvidence: [
        evidencePaths.readiness
      ],
      stopOnFailure:
        true
    },
    {
      order:
        2,
      id:
        "confirm-repository",
      description:
        "Confirm repository authority.",
      dependencies: [
        "confirm-release"
      ],
      completionEvidence: [
        manifest.repository.inspectionFile
      ],
      stopOnFailure:
        true
    },
    {
      order:
        3,
      id:
        "confirm-fixtures",
      description:
        "Confirm safe deterministic fixtures.",
      dependencies: [
        "confirm-repository"
      ],
      completionEvidence: [
        manifest.fixtures.strategyFile
      ],
      stopOnFailure:
        true
    },
    {
      order:
        4,
      id:
        "implement-structure",
      description:
        "Implement the production-intended structure.",
      dependencies: [
        "confirm-fixtures"
      ],
      completionEvidence: [
        manifest.files[0].path
      ],
      stopOnFailure:
        true
    },
    {
      order:
        5,
      id:
        "implement-state-proof",
      description:
        "Implement primary and non-success states.",
      dependencies: [
        "implement-structure"
      ],
      completionEvidence: [
        manifest.files[2].path
      ],
      stopOnFailure:
        true
    },
    {
      order:
        6,
      id:
        "implement-interaction-proof",
      description:
        "Implement and validate the representative interaction.",
      dependencies: [
        "implement-state-proof"
      ],
      completionEvidence: [
        manifest.files[2].path
      ],
      stopOnFailure:
        true
    },
    {
      order:
        7,
      id:
        "validate-slice",
      description:
        "Run browser, screenshot, design-system, and defect validation.",
      dependencies: [
        "implement-interaction-proof"
      ],
      completionEvidence: [
        evidencePaths.browser,
        evidencePaths.screenshots,
        evidencePaths.designAudit,
        evidencePaths.defectLog
      ],
      stopOnFailure:
        true
    }
  ];

  manifest.stopConditions =
    manifest.stopConditions.map(
      (condition) => {
        return {
          ...condition,
          status:
            "inactive"
        };
      }
    );

  manifest.validation.schema =
    "~/.agents/skills/frontend-product-builder/assets/schemas/small-slice-manifest.schema.json";

  return manifest;
}

async function createRepository({
  rootDirectory,
  name,
  sourceManifest,
  sourceScreen,
  sourceDesignSystem,
  sourceCompositionProof,
  sourceCompositionEvidence,
  sourceVisualScorecard,
  mutateManifest = null,
  unauthorizedGlobalSelector = false
}) {
  const repositoryRoot =
    path.join(
      rootDirectory,
      name
    );

  await fs.mkdir(
    repositoryRoot,
    {
      recursive:
        true
    }
  );

  const manifest =
    normalizeManifest(
      sourceManifest
    );

  if (mutateManifest) {
    mutateManifest(manifest);
  }

  const stylingAuthority = {
    "$schema": "../schemas/styling-authority.schema.json",
    version: "1.0.0",
    status: "approved",
    repositoryEvidence: {
      inspectedFiles: ["package.json", "src/globals.css", "src/styles/tokens.css", "src/features/gate-preparation/GatePreparationScreen.tsx"],
      detectedMechanisms: ["tailwind-utilities"],
      classOwnershipTraces: []
    },
    authority: {
      primaryMechanism: "tailwind-utilities",
      tokenSources: ["src/styles/tokens.css"],
      componentSources: ["src/features/gate-preparation"],
      globalStylesheets: [
        {
          path: "src/globals.css",
          allowedRoles: ["root-semantic-tokens", "theme-selectors", "base-elements"],
          allowedSelectors: [":root", "html", "body", ".dark"],
          componentSelectors: "forbidden",
          rationale: "Global tokens, theme selector, and document base only."
        },
        {
          path: "src/styles/tokens.css",
          allowedRoles: ["root-semantic-tokens"],
          allowedSelectors: [":root"],
          componentSelectors: "forbidden",
          rationale: "Canonical semantic token declarations only."
        }
      ]
    },
    policies: {
      preserveExistingArchitecture: true,
      parallelStylingArchitectureAllowed: false,
      classOwnershipTraceRequired: true,
      unresolvedClassMayBeOverridden: false,
      componentSelectorsInGlobalStyles: "forbidden-unless-legacy-authority-or-approved-exception",
      rawValuesInFeatureCode: "forbidden-unless-approved-exception",
      arbitraryUtilityValues: "forbidden-unless-approved-exception",
      inlineStyles: "runtime-only-with-rationale",
      rawValuesInTokenAuthority: "allowed"
    },
    visualReferences: [
      {
        id: "VREF-GATE-PREPARATION-001",
        kind: "design-direction",
        source: "docs/frontend/design-direction.md",
        status: "approved",
        approvedAspects: ["Representative hierarchy and spacing rhythm."],
        excludedAspects: [],
        evidence: ["docs/frontend/visual-direction-decision.md"]
      }
    ],
    exceptions: []
  };

  await writeJson(path.join(repositoryRoot, "docs/frontend/styling-authority.json"), stylingAuthority);
  await writeText(path.join(repositoryRoot, "docs/frontend/design-direction.md"), "# Retained design direction\n");
  await writeText(path.join(repositoryRoot, "docs/frontend/visual-direction-decision.md"), "# Approved visual direction\n");
  await writeText(
    path.join(repositoryRoot, "src/globals.css"),
    ":root { --surface: white; }\n.dark { color-scheme: dark; }\nbody { margin: 0; }\n" +
      (unauthorizedGlobalSelector ? ".a2i-cliente-section__title { margin: 13px; }\n" : "")
  );

  const manifestPath =
    path.join(
      repositoryRoot,
      manifest.meta.source
    );

  const screenSpecification =
    clone(sourceScreen);

  if (!isObject(screenSpecification.meta)) {
    screenSpecification.meta = {};
  }

  screenSpecification.meta.source =
    manifest.screen.screenSpecification;

  screenSpecification.meta.status =
    "implemented";

  if (
    isObject(
      screenSpecification.productContext
    )
  ) {
    screenSpecification
      .productContext
      .openQuestions =
      [];
  }

  if (
    isObject(
      screenSpecification.implementation
    )
  ) {
    screenSpecification
      .implementation
      .blockers =
      [];

    screenSpecification
      .implementation
      .representativeSlice =
      SLICE_ID;
  }

  await writeJson(
    path.join(
      repositoryRoot,
      manifest.screen.screenSpecification
    ),
    screenSpecification
  );

  await writeJson(
    path.join(
      repositoryRoot,
      manifest.screen.readinessReport
    ),
    createReadinessReport()
  );

  await writeCompositionContractSet({
    repositoryRoot,
    screenDirectory: path.dirname(
      path.join(
        repositoryRoot,
        manifest.screen.screenSpecification
      )
    ),
    screenSpecificationPath: path.join(
      repositoryRoot,
      manifest.screen.screenSpecification
    ),
    sourceDesignSystem,
    sourceCompositionProof,
    sourceCompositionEvidence,
    sourceVisualScorecard
  });

  const documents = [
    {
      relativePath:
        manifest.screen.stateMatrix,
      title:
        "Gate Preparation Screen — State Matrix",
      body:
        "Primary and recoverable error states are implemented and validated."
    },
    {
      relativePath:
        manifest.screen.componentMap,
      title:
        "Gate Preparation Screen — Component Map",
      body:
        "The representative screen uses the approved production-intended component boundary."
    },
    {
      relativePath:
        manifest.screen.implementationPlan,
      title:
        "Gate Preparation Screen — Implementation Plan",
      body:
        "The bounded representative implementation plan has been completed."
    },
    {
      relativePath:
        manifest.repository.inspectionFile,
      title:
        "Gate Preparation Screen — Repository Inspection",
      body:
        "npm, package-lock.json, the root application package, and the feature boundary are authoritative."
    },
    {
      relativePath:
        manifest.fixtures.strategyFile,
      title:
        "Gate Preparation Screen — Fixture Strategy",
      body:
        "Fixtures are synthetic, deterministic, safe, state-complete, and mapped through the view-model boundary."
    },
    {
      relativePath:
        `${SCREEN_DIRECTORY}/small-slice-implementation-journal.md`,
      title:
        "Gate Preparation Screen — Implementation Journal",
      body:
        "The representative route, states, interaction, responsive behavior, and accessibility behavior were implemented and revalidated."
    },
    {
      relativePath:
        `${SCREEN_DIRECTORY}/browser-validation.md`,
      title:
        "Gate Preparation Screen — Browser Validation",
      body:
        "Compact, constrained, and wide scenarios passed. Keyboard, focus, zoom, reflow, console, network, and overflow checks passed."
    },
    {
      relativePath:
        `${SCREEN_DIRECTORY}/design-system-audit.md`,
      title:
        "Gate Preparation Screen — Design-System Audit",
      body:
        "Token, component, layout, responsive, accessibility, and content checks passed."
    },
    {
      relativePath:
        `${SCREEN_DIRECTORY}/defect-log.md`,
      title:
        "Gate Preparation Screen — Defect Log",
      body:
        "No unresolved blocking defects remain. All affected scenarios were revalidated."
    },
    {
      relativePath:
        `${SCREEN_DIRECTORY}/browser-test-report.md`,
      title:
        "Gate Preparation Screen — Browser Test Report",
      body:
        "The primary and non-success scenarios passed in the controlled browser environment."
    },
    {
      relativePath:
        `${SCREEN_DIRECTORY}/accessibility-report.md`,
      title:
        "Gate Preparation Screen — Accessibility Report",
      body:
        "Semantic, keyboard, focus, announcement, zoom, reflow, and reduced-motion checks passed."
    }
  ];

  for (const document of documents) {
    await writeText(
      path.join(
        repositoryRoot,
        document.relativePath
      ),
      validatedDocument({
        title:
          document.title,
        body:
          document.body
      })
    );
  }

  // 9C.2B.2B.2 explicit journal and screenshot references.

  await writeText(
    path.join(
      repositoryRoot,
      `${SCREEN_DIRECTORY}/small-slice-implementation-journal.md`
    ),
    [
      "# Gate Preparation Screen — Implementation Journal",
      "",
      "**Gate status:** `validated`",
      "",
      "**Execution status:** `validated`",
      "",
      "**Final status:** `validated`",
      "",
      "## Execution status",
      "",
      "`validated`",
      "",
      "## Final status",
      "",
      "`validated`",
      "",
      "## Validation summary",
      "",
      "- Manifest validation: passed",
      "- File audit: passed",
      "- Scope audit: passed",
      "- Evidence audit: passed",
      "- Blocking defects: 0",
      "- Revalidation completed: yes",
      ""
    ].join("\n")
  );

  await writeText(
    path.join(
      repositoryRoot,
      `${SCREEN_DIRECTORY}/browser-validation.md`
    ),
    [
      "# Gate Preparation Screen — Browser Validation",
      "",
      "**Gate status:** `validated`",
      "",
      "**Execution status:** `validated`",
      "",
      "**Final status:** `validated`",
      "",
      "Compact, constrained, and wide scenarios passed.",
      "",
      "Keyboard, focus, zoom, reflow, console, network,",
      "reduced-motion, and horizontal-overflow checks passed.",
      "",
      "## Approved screenshot captures",
      "",
      `- \`capture-data-wide\`: \`${SCREEN_DIRECTORY}/screenshots/${SCREEN_ID}-data-1440x900.png\``,
      `- \`capture-data-compact\`: \`${SCREEN_DIRECTORY}/screenshots/${SCREEN_ID}-data-390x844.png\``,
      `- \`capture-non-success\`: \`${SCREEN_DIRECTORY}/screenshots/${SCREEN_ID}-error-state-1024x768.png\``,
      "",
      "All three captures were inspected and approved.",
      ""
    ].join("\n")
  );

  const screenshotRegistry =
    createScreenshotRegistry();

  await writeJson(
    path.join(
      repositoryRoot,
      `${SCREEN_DIRECTORY}/screenshot-evidence.json`
    ),
    screenshotRegistry
  );

  for (
    const capture of
    screenshotRegistry.captures
  ) {
    await writeMinimalPng(
      path.join(
        repositoryRoot,
        capture.path
      )
    );
  }

  await writeText(
    path.join(
      repositoryRoot,
      "src/features/gate-preparation/GatePreparationScreen.tsx"
    ),
    [
      "export function GatePreparationScreen() {",
      "  return <main><h1>Gate Preparation</h1></main>;",
      "}",
      ""
    ].join("\n")
  );

  await writeText(
    path.join(
      repositoryRoot,
      "src/features/gate-preparation/fixtures/representative.ts"
    ),
    [
      "export const primaryFixture = { status: \"ready\" };",
      "export const nonSuccessFixture = { status: \"error\" };",
      ""
    ].join("\n")
  );

  await writeText(
    path.join(
      repositoryRoot,
      "src/features/gate-preparation/GatePreparationScreen.test.tsx"
    ),
    [
      "export const representativeTestEvidence = true;",
      ""
    ].join("\n")
  );

  await writeText(
    path.join(
      repositoryRoot,
      "src/styles/tokens.css"
    ),
    [
      ":root {",
      "  --space-page: 1rem;",
      "}",
      ""
    ].join("\n")
  );

  await writeJson(
    path.join(
      repositoryRoot,
      "package.json"
    ),
    {
      name:
        "representative-gate-preparer-integration-test",
      version:
        "1.0.0",
      private:
        true,
      scripts: {
        dev:
          "node -e \"process.exit(0)\"",
        build:
          "node -e \"process.exit(0)\"",
        typecheck:
          "node -e \"process.exit(0)\"",
        lint:
          "node -e \"process.exit(0)\"",
        test:
          "node -e \"process.exit(0)\"",
        "test:browser":
          "node -e \"process.exit(0)\""
      }
    }
  );

  await writeJson(
    path.join(
      repositoryRoot,
      "package-lock.json"
    ),
    {
      name:
        "representative-gate-preparer-integration-test",
      version:
        "1.0.0",
      lockfileVersion:
        3,
      requires:
        true,
      packages: {
        "": {
          name:
            "representative-gate-preparer-integration-test",
          version:
            "1.0.0"
        }
      }
    }
  );

  await writeText(
    path.join(
      repositoryRoot,
      "README.md"
    ),
    [
      "# Representative Gate Preparer Integration Test",
      "",
      "Temporary repository generated automatically.",
      ""
    ].join("\n")
  );

  await writeJson(
    manifestPath,
    manifest
  );

  await initializeGitRepository(
    repositoryRoot
  );

  // 9C.2B.2B.2 create declared repository differences after baseline.

  const declaredImplementationUpdates = [
    {
      relativePath:
        "src/features/gate-preparation/GatePreparationScreen.tsx",
      content: [
        "",
        "// Representative screen implementation validated after baseline.",
        ""
      ].join("\n")
    },
    {
      relativePath:
        "src/features/gate-preparation/fixtures/representative.ts",
      content: [
        "",
        "// Representative fixture boundary validated after baseline.",
        ""
      ].join("\n")
    },
    {
      relativePath:
        "src/features/gate-preparation/GatePreparationScreen.test.tsx",
      content: [
        "",
        "// Representative state and interaction tests validated after baseline.",
        ""
      ].join("\n")
    }
  ];

  for (
    const update of
    declaredImplementationUpdates
  ) {
    await fs.appendFile(
      path.join(
        repositoryRoot,
        update.relativePath
      ),
      update.content,
      "utf8"
    );
  }

  return {
    repositoryRoot,
    manifest,
    manifestPath
  };
}

function collectObjects(
  value,
  result = []
) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectObjects(
        item,
        result
      );
    }

    return result;
  }

  if (!isObject(value)) {
    return result;
  }

  result.push(value);

  for (const child of Object.values(value)) {
    collectObjects(
      child,
      result
    );
  }

  return result;
}

function findBooleanByKey(
  value,
  key
) {
  for (
    const object of
    collectObjects(value)
  ) {
    if (
      Object.hasOwn(
        object,
        key
      ) &&
      typeof object[key] ===
        "boolean"
    ) {
      return object[key];
    }
  }

  return null;
}

function findObjectById(
  value,
  id
) {
  return collectObjects(value).find(
    (object) => {
      return object.id === id;
    }
  ) ?? null;
}

function resultLooksPassed(object) {
  if (!isObject(object)) {
    return false;
  }

  if (object.passed === true) {
    return true;
  }

  if (
    object.success === true ||
    object.valid === true
  ) {
    return true;
  }

  if (
    typeof object.status ===
    "string" &&
    [
      "passed",
      "success",
      "successful",
      "validated",
      "available",
      "approved"
    ].includes(
      object.status.toLowerCase()
    )
  ) {
    return true;
  }

  for (const key of [
    "exitCode",
    "statusCode",
    "code"
  ]) {
    if (
      typeof object[key] ===
        "number" &&
      object[key] === 0
    ) {
      return true;
    }
  }

  if (
    isObject(object.summary) &&
    object.summary.errors === 0
  ) {
    return true;
  }

  return false;
}

function inspectPreparation(
  preparation
) {
  const canRequestApproval =
    findBooleanByKey(
      preparation,
      "canRequestApproval"
    );

  const auditResults =
    CHILD_AUDITS.map(
      (audit) => {
        const object =
          findObjectById(
            preparation,
            audit.id
          );

        return {
          id:
            audit.id,
          found:
            Boolean(object),
          passed:
            resultLooksPassed(
              object
            ),
          object
        };
      }
    );

  const gateChecks =
    REQUIRED_GATE_IDS.map(
      (id) => {
        const object =
          findObjectById(
            preparation,
            id
          );

        return {
          id,
          found:
            Boolean(object),
          passed:
            resultLooksPassed(
              object
            ),
          object
        };
      }
    );

  return {
    canRequestApproval,
    auditResults,
    gateChecks
  };
}

async function runPreparation({
  preparerPath,
  schemaPath,
  repository,
  outputName,
  structuralOnly = false
}) {
  const outputPath =
    path.join(
      repository.repositoryRoot,
      SCREEN_DIRECTORY,
      outputName
    );

  const args = [
    repository.manifestPath,
    outputPath,
    "--schema",
    schemaPath
  ];

  if (structuralOnly) {
    args.push(
      "--structural-only"
    );
  }

  const processResult =
    runProcess({
      command:
        "node",
      args: [
        preparerPath,
        ...args
      ],
      cwd:
        repository.repositoryRoot,
      timeout:
        90000
    });

  let preparation =
    null;

  let readError =
    null;

  if (
    await pathType(
      outputPath
    ) === "file"
  ) {
    try {
      preparation =
        await readJson(
          outputPath
        );
    } catch (error) {
      readError =
        error.message;
    }
  }

  const inspection =
    preparation
      ? inspectPreparation(
          preparation
        )
      : {
          canRequestApproval:
            null,
          auditResults:
            [],
          gateChecks:
            []
        };

  return {
    outputPath,
    processResult,
    preparation,
    readError,
    inspection
  };
}

function summarizeScenario(
  scenario,
  expectation
) {
  const outputExists =
    Boolean(
      scenario.preparation
    );

  const infrastructureFailure =
    looksLikeInfrastructureFailure(
      scenario.processResult
    );

  const auditPassCount =
    scenario.inspection
      .auditResults
      .filter(
        (audit) => audit.passed
      )
      .length;

  const gatePassCount =
    scenario.inspection
      .gateChecks
      .filter(
        (check) => check.passed
      )
      .length;

  let passed;

  if (
    expectation ===
    "approval"
  ) {
    passed = (
      scenario.processResult.status === 0 &&
      !infrastructureFailure &&
      outputExists &&
      scenario.inspection
        .canRequestApproval === true &&
      auditPassCount ===
        CHILD_AUDITS.length &&
      gatePassCount ===
        REQUIRED_GATE_IDS.length
    );
  } else {
    passed = (
      !infrastructureFailure &&
      (
        scenario.inspection
          .canRequestApproval === false ||
        (
          !outputExists &&
          scenario.processResult.status !== 0
        )
      )
    );
  }

  return {
    passed,
    outputExists,
    infrastructureFailure,
    auditPassCount,
    gatePassCount,
    processStatus:
      scenario.processResult.status,
    canRequestApproval:
      scenario.inspection
        .canRequestApproval
  };
}

function printScenarioFailure(
  name,
  scenario
) {
  process.stdout.write(
    `Process output for ${name}:\n`
  );

  process.stdout.write(
    `${combinedOutput(
      scenario.processResult
    ).slice(0, 16000)}\n`
  );

  if (scenario.readError) {
    process.stdout.write(
      `Preparation read error: ${scenario.readError}\n`
    );
  }

  if (scenario.preparation) {
    process.stdout.write(
      "Preparation artifact excerpt:\n"
    );

    process.stdout.write(
      `${JSON.stringify(
        scenario.preparation,
        null,
        2
      ).slice(0, 20000)}\n`
    );
  }
}

function printReport(report) {
  process.stdout.write(
    "Frontend Product Builder — Representative Gate Preparer Integration Tests\n"
  );

  process.stdout.write(
    "========================================================================\n"
  );

  process.stdout.write(
    `Skill root: ${report.meta.skillRoot}\n`
  );

  process.stdout.write(
    `Temporary repository root: ${report.meta.temporaryRoot}\n`
  );

  process.stdout.write(
    `Preparers expected: ${report.metrics.preparersExpected}\n`
  );

  process.stdout.write(
    `Preparers discovered: ${report.metrics.preparersDiscovered}\n`
  );

  process.stdout.write(
    `Syntax checks passed: ${report.metrics.syntaxChecksPassed}\n`
  );

  process.stdout.write(
    `Approved preparation accepted: ${report.metrics.approvedPreparationAccepted}\n`
  );

  process.stdout.write(
    `Child audits passed: ${report.metrics.childAuditsPassed}\n`
  );

  process.stdout.write(
    `Gate checks passed: ${report.metrics.gateChecksPassed}\n`
  );

  process.stdout.write(
    `Structural-only scenario blocked: ${report.metrics.structuralOnlyBlocked}\n`
  );

  process.stdout.write(
    `Scope-blocker scenario blocked: ${report.metrics.scopeBlockerBlocked}\n`
  );

  process.stdout.write(
    `Expectation mismatches: ${report.metrics.expectationMismatches}\n\n`
  );

  for (
    const scenario of
    report.scenarios
  ) {
    process.stdout.write(
      `[${scenario.summary.passed ? "PASS" : "FAIL"}] ${scenario.id}\n`
    );

    process.stdout.write(
      `Exit: ${scenario.summary.processStatus}\n`
    );

    process.stdout.write(
      `Preparation artifact: ${scenario.outputPath}\n`
    );

    process.stdout.write(
      `Artifact generated: ${scenario.summary.outputExists}\n`
    );

    process.stdout.write(
      `canRequestApproval: ${scenario.summary.canRequestApproval}\n`
    );

    process.stdout.write(
      `Child audits passed: ${scenario.summary.auditPassCount}/${CHILD_AUDITS.length}\n`
    );

    process.stdout.write(
      `Gate checks passed: ${scenario.summary.gatePassCount}/${REQUIRED_GATE_IDS.length}\n`
    );

    if (!scenario.summary.passed) {
      printScenarioFailure(
        scenario.id,
        scenario.execution
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
    `Information: ${report.scenarios.length}\n`
  );

  process.stdout.write(
    `Total: ${
      report.scenarios.length +
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

  const preparerPath =
    path.join(
      skillRoot,
      PREPARER_RELATIVE_PATH
    );

  const manifestFixturePath =
    path.join(
      skillRoot,
      MANIFEST_FIXTURE_RELATIVE_PATH
    );

  const screenFixturePath =
    path.join(
      skillRoot,
      SCREEN_FIXTURE_RELATIVE_PATH
    );

  const schemaPath =
    path.join(
      skillRoot,
      SCHEMA_RELATIVE_PATH
    );

  for (const requiredPath of [
    preparerPath,
    manifestFixturePath,
    screenFixturePath,
    schemaPath
  ]) {
    if (
      await pathType(
        requiredPath
      ) !== "file"
    ) {
      throw new Error(
        `Required file is missing: ${requiredPath}`
      );
    }
  }

  for (const audit of CHILD_AUDITS) {
    const auditPath =
      path.join(
        skillRoot,
        audit.script
      );

    if (
      await pathType(
        auditPath
      ) !== "file"
    ) {
      throw new Error(
        `Required child audit is missing: ${auditPath}`
      );
    }
  }

  const syntaxResult =
    runProcess({
      command:
        "node",
      args: [
        "--check",
        preparerPath
      ],
      cwd:
        skillRoot
    });

  if (syntaxResult.status !== 0) {
    throw new Error(
      "Representative-gate preparer syntax failed:\n" +
      combinedOutput(syntaxResult)
    );
  }

  const sourceManifest =
    await readJson(
      manifestFixturePath
    );

  const sourceScreen =
    await readJson(
      screenFixturePath
    );

  const sourceDesignSystem =
    await readJson(
      path.join(skillRoot, DESIGN_SYSTEM_FIXTURE_RELATIVE_PATH)
    );

  const sourceCompositionProof =
    await readJson(
      path.join(skillRoot, COMPOSITION_PROOF_FIXTURE_RELATIVE_PATH)
    );

  const sourceCompositionEvidence =
    await readJson(
      path.join(skillRoot, COMPOSITION_EVIDENCE_FIXTURE_RELATIVE_PATH)
    );

  const sourceVisualScorecard =
    await readJson(
      path.join(skillRoot, VISUAL_SCORECARD_FIXTURE_RELATIVE_PATH)
    );

  const temporaryRoot =
    await fs.mkdtemp(
      path.join(
        os.tmpdir(),
        "frontend-product-builder-9c2b2b2-"
      )
    );

  let report;

  try {
    const approvedRepository =
      await createRepository({
        rootDirectory:
          temporaryRoot,
        name:
          "approved",
        sourceManifest,
        sourceScreen,
        sourceDesignSystem,
        sourceCompositionProof,
        sourceCompositionEvidence,
        sourceVisualScorecard
      });

    const structuralRepository =
      await createRepository({
        rootDirectory:
          temporaryRoot,
        name:
          "structural-only",
        sourceManifest,
        sourceScreen,
        sourceDesignSystem,
        sourceCompositionProof,
        sourceCompositionEvidence,
        sourceVisualScorecard
      });

    const blockedRepository =
      await createRepository({
        rootDirectory:
          temporaryRoot,
        name:
          "scope-blocker",
        sourceManifest,
        sourceScreen,
        sourceDesignSystem,
        sourceCompositionProof,
        sourceCompositionEvidence,
        sourceVisualScorecard,
        mutateManifest:
          (manifest) => {
            manifest.scope.blockers = [
              "Intentional integration-test scope blocker."
            ];
          }
      });

    const stylingViolationRepository =
      await createRepository({
        rootDirectory:
          temporaryRoot,
        name:
          "styling-violation",
        sourceManifest,
        sourceScreen,
        sourceDesignSystem,
        sourceCompositionProof,
        sourceCompositionEvidence,
        sourceVisualScorecard,
        unauthorizedGlobalSelector:
          true
      });

    const approvedExecution =
      await runPreparation({
        preparerPath,
        schemaPath,
        repository:
          approvedRepository,
        outputName:
          "representative-gate-preparation.json"
      });

    const stylingViolationExecution =
      await runPreparation({
        preparerPath,
        schemaPath,
        repository:
          stylingViolationRepository,
        outputName:
          "representative-gate-preparation.styling-violation.json"
      });

    const structuralExecution =
      await runPreparation({
        preparerPath,
        schemaPath,
        repository:
          structuralRepository,
        outputName:
          "representative-gate-preparation.structural.json",
        structuralOnly:
          true
      });

    const blockedExecution =
      await runPreparation({
        preparerPath,
        schemaPath,
        repository:
          blockedRepository,
        outputName:
          "representative-gate-preparation.blocked.json"
      });

    const approvedSummary =
      summarizeScenario(
        approvedExecution,
        "approval"
      );

    const structuralSummary =
      summarizeScenario(
        structuralExecution,
        "blocked"
      );

    const blockedSummary =
      summarizeScenario(
        blockedExecution,
        "blocked"
      );

    const stylingViolationSummary =
      summarizeScenario(
        stylingViolationExecution,
        "blocked"
      );

    const scenarios = [
      {
        id:
          "approved-preparation",
        expectation:
          "approval",
        outputPath:
          approvedExecution.outputPath,
        summary:
          approvedSummary,
        execution:
          approvedExecution
      },
      {
        id:
          "structural-only",
        expectation:
          "blocked",
        outputPath:
          structuralExecution.outputPath,
        summary:
          structuralSummary,
        execution:
          structuralExecution
      },
      {
        id:
          "scope-blocker",
        expectation:
          "blocked",
        outputPath:
          blockedExecution.outputPath,
        summary:
          blockedSummary,
        execution:
          blockedExecution
      },
      {
        id:
          "unauthorized-global-selector",
        expectation:
          "blocked",
        outputPath:
          stylingViolationExecution.outputPath,
        summary:
          stylingViolationSummary,
        execution:
          stylingViolationExecution
      }
    ];

    const expectationMismatches =
      scenarios.filter(
        (scenario) => {
          return !scenario.summary.passed;
        }
      ).length;

    report = {
      meta: {
        skillRoot,
        temporaryRoot,
        generatedAt:
          new Date().toISOString(),
        temporaryRepositoriesKept: (
          options
            .keepTemporaryRepositories ||
          expectationMismatches > 0
        )
      },

      metrics: {
        preparersExpected:
          1,
        preparersDiscovered:
          1,
        syntaxChecksPassed:
          1,
        approvedPreparationAccepted:
          approvedSummary.passed
            ? 1
            : 0,
        childAuditsPassed:
          approvedSummary.auditPassCount,
        gateChecksPassed:
          approvedSummary.gatePassCount,
        structuralOnlyBlocked:
          structuralSummary.passed
            ? 1
            : 0,
        scopeBlockerBlocked:
          blockedSummary.passed
            ? 1
            : 0,
        stylingViolationBlocked:
          stylingViolationSummary.passed
            ? 1
            : 0,
        expectationMismatches
      },

      scenarios
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
        temporaryRoot,
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
