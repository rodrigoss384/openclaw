#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import {
  spawnSync
} from "node:child_process";
import {
  fileURLToPath,
  pathToFileURL
} from "node:url";

import {
  asArray,
  pathExists,
  readJsonFile,
  resolveFromCwd
} from "./lib/screen-contract-utils.mjs";

const SCRIPT_DIRECTORY = path.dirname(
  fileURLToPath(import.meta.url)
);

const AUDITS = [
  {
    id: "styling-contract",
    title: "Styling Authority Contract Validation",
    script: "validate-styling-authority.mjs",
    input: "styling-authority"
  },
  {
    id: "styling-global",
    title: "Styling Authority Global CSS Audit",
    script: "audit-styling-authority.mjs",
    input: "styling-authority-audit"
  },
  {
    id: "manifest",
    title: "Small Slice Manifest Validation",
    script: "validate-small-slice-manifest.mjs"
  },
  {
    id: "files",
    title: "Small Slice File Audit",
    script: "audit-small-slice-files.mjs"
  },
  {
    id: "scope",
    title: "Small Slice Scope Audit",
    script: "audit-small-slice-scope.mjs"
  },
  {
    id: "evidence",
    title: "Small Slice Evidence Audit",
    script: "audit-small-slice-evidence.mjs"
  },
  {
    id: "visual-composition-contract",
    title: "Frontend Visual Composition Contract Validation",
    script: "validate-visual-composition-contract.mjs",
    composition: true,
    inputs: ["screenSpecification", "designSystem", "compositionProof"]
  },
  {
    id: "visual-composition-evidence",
    title: "Frontend Visual Composition Evidence Audit",
    script: "audit-visual-composition-evidence.mjs",
    composition: true,
    inputs: [
      "screenSpecification",
      "designSystem",
      "compositionProof",
      "visualCompositionEvidence"
    ]
  },
  {
    id: "visual-quality-scorecard",
    title: "Frontend Visual Quality Scorecard Validation",
    script: "validate-visual-quality-scorecard.mjs",
    composition: true,
    inputs: ["visualQualityScorecard"]
  },
];

// audit-theme-operational-evidence.mjs additionally needs the derived
// craft-contract.json, which only `frontend-control.mjs readiness` produces.
// It therefore stays mandated at the frontend representative gate
// (prompts/spec-driven/07.1) rather than in this preparer, which runs from the
// small-slice manifest alone.

// Canonical composition locations from
// prompts/spec-driven/manifest.json#frontendCompositionPolicy, resolved from
// the screen specification the manifest already declares. A substantial screen
// reaching the representative gate must resolve every one of them: an
// unresolved input is a blocking error, never a skipped audit.
const COMPOSITION_INPUTS = {
  designSystem: (screenDirectory) => path.resolve(
    screenDirectory,
    "..",
    "..",
    "design-system",
    "design-system.json"
  ),
  compositionProof: (screenDirectory) => path.join(
    screenDirectory,
    "composition-proof.json"
  ),
  visualCompositionEvidence: (screenDirectory) => path.join(
    screenDirectory,
    "visual-composition-evidence.json"
  ),
  visualQualityScorecard: (screenDirectory) => path.join(
    screenDirectory,
    "visual-quality-scorecard.json"
  ),
};

async function resolveCompositionContext({ repositoryRoot, manifest }) {
  const screenSpecificationPath = resolveProjectPath(
    repositoryRoot,
    manifest?.screen?.screenSpecification
  );

  if (!screenSpecificationPath || !(await pathExists(screenSpecificationPath))) {
    return {
      required: false,
      reason: "screen-specification-unresolved",
      screenSpecificationPath,
      resolved: {},
      missing: []
    };
  }

  let screenSpecification = null;

  try {
    ({ value: screenSpecification } = await readJsonFile(screenSpecificationPath));
  } catch {
    screenSpecification = null;
  }

  // Same trigger validate-visual-composition-contract.mjs enforces, derived
  // from the contract itself so no CLI flag can disable it.
  if (!screenSpecification?.visualHierarchy) {
    return {
      required: false,
      reason: "no-visual-hierarchy",
      screenSpecificationPath,
      resolved: {},
      missing: []
    };
  }

  const screenDirectory = path.dirname(screenSpecificationPath);
  const resolved = { screenSpecification: screenSpecificationPath };
  const missing = [];

  for (const [key, resolveDefault] of Object.entries(COMPOSITION_INPUTS)) {
    const candidate = resolveDefault(screenDirectory);
    resolved[key] = candidate;

    if (!(await pathExists(candidate))) {
      missing.push({ key, path: candidate });
    }
  }

  return {
    required: true,
    reason: null,
    screenSpecificationPath,
    resolved,
    missing
  };
}

function unresolvedCompositionAudit(audit, missing) {
  return {
    id: audit.id,
    title: audit.title,
    script: audit.script,
    command: null,
    exitCode: 1,
    summary: {
      errors: missing.length,
      warnings: 0,
      information: 0,
      total: missing.length
    },
    issues: missing.map((entry) => ({
      severity: "error",
      code: "REPRESENTATIVE_GATE_COMPOSITION_INPUT_UNRESOLVED",
      message:
        `Substantial screen requires ${entry.key} at the representative ` +
        `gate; '${entry.path}' does not exist.`,
      location: entry.path,
      detail: { auditId: audit.id, input: entry.key }
    }))
  };
}

const GATE_DESCRIPTIONS = {
  "GATE-001":
    "The primary task and dominant screen category are explicit.",

  "GATE-002":
    "The selected recipe and all required recipe regions are mapped.",

  "GATE-003":
    "The state matrix covers applicable success and non-success states.",

  "GATE-004":
    "The component map contains no unresolved canonical responsibility.",

  "GATE-005":
    "Data, state, permission, form, URL, route, and side-effect ownership are explicit.",

  "GATE-006":
    "Representative fixtures are realistic, safe, deterministic, and state-complete.",

  "GATE-007":
    "The representative slice uses production route, architecture, styling authority, tokens, components, and state boundaries.",

  "GATE-008":
    "Compact, constrained, and wide responsive behavior is browser validated.",

  "GATE-009":
    "Keyboard, focus, announcements, reduced motion, zoom, and reflow are validated.",

  "GATE-010":
    "Required screenshots and design-system, styling, visual-reference, component, responsive, and accessibility audits are complete.",

  "GATE-011":
    "Blocking defects are patched and affected scenarios are revalidated.",

  "GATE-012":
    "No unresolved product, architecture, permission, safety, data, integration, or implementation blocker remains."
};

function printUsageAndExit() {
  process.stderr.write(
    [
      "Usage:",
      "node prepare-representative-gate.mjs",
      "<small-slice-manifest.json>",
      "[output.json]",
      "[--schema <schema.json>]",
      "[--structural-only]",
      "[--strict-warnings]",
      "[--json]"
    ].join(" ") + "\n"
  );

  process.exitCode = 1;
}

function parseArguments(argv) {
  const options = {
    positional: [],
    schema: null,
    structuralOnly: false,
    strictWarnings: false,
    json: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    switch (argument) {
      case "--schema": {
        const value = argv[index + 1];

        if (!value) {
          throw new Error(
            "--schema requires a file path."
          );
        }

        options.schema = value;
        index += 1;
        break;
      }

      case "--structural-only":
        options.structuralOnly = true;
        break;

      case "--strict-warnings":
        options.strictWarnings = true;
        break;

      case "--json":
        options.json = true;
        break;

      default:
        if (argument.startsWith("--")) {
          throw new Error(
            `Unknown option '${argument}'.`
          );
        }

        options.positional.push(argument);
        break;
    }
  }

  return options;
}

function runAudit({
  audit,
  manifestPath,
  repositoryRoot,
  options,
  compositionInputs
}) {
  const scriptPath = path.join(
    SCRIPT_DIRECTORY,
    audit.script
  );

  const stylingAuthorityPath = path.join(repositoryRoot, "docs/frontend/styling-authority.json");
  const positionals = asArray(audit.inputs).length > 0
    ? audit.inputs.map((input) => compositionInputs?.[input])
    : [audit.input?.startsWith("styling-authority") ? stylingAuthorityPath : manifestPath];
  const argumentsList = [scriptPath, ...positionals];
  if (audit.id === "styling-contract") argumentsList.push("--check-references");
  if (audit.input === "styling-authority-audit") argumentsList.push(repositoryRoot);
  argumentsList.push("--json");

  if (
    audit.id === "manifest" &&
    options.schema
  ) {
    argumentsList.push(
      "--schema",
      options.schema
    );
  }

  if (
    audit.id === "manifest" &&
    options.structuralOnly
  ) {
    argumentsList.push(
      "--structural-only"
    );
  }

  if (options.strictWarnings) {
    argumentsList.push(
      "--strict-warnings"
    );
  }

  const execution = spawnSync(
    process.execPath,
    argumentsList,
    {
      cwd: process.cwd(),
      encoding: "utf8",
      windowsHide: true
    }
  );

  let parsed = null;

  try {
    parsed = JSON.parse(
      execution.stdout || "{}"
    );
  } catch {
    parsed = null;
  }

  if (
    !parsed?.summary ||
    !Array.isArray(parsed?.issues)
  ) {
    return {
      id: audit.id,
      title: audit.title,
      script: audit.script,
      exitCode: execution.status ?? 1,
      summary: {
        errors: 1,
        warnings: 0,
        information: 0,
        total: 1
      },
      issues: [
        {
          severity: "error",
          code: "SLICE_GATE_AUDIT_EXECUTION",
          message:
            `Audit '${audit.id}' did not produce valid JSON.`,
          location: scriptPath,
          detail: {
            stdout: execution.stdout,
            stderr: execution.stderr,
            signal: execution.signal
          }
        }
      ]
    };
  }

  return {
    id: audit.id,
    title: parsed.title ?? audit.title,
    script: audit.script,
    exitCode: execution.status ?? 0,
    summary: parsed.summary,
    issues: parsed.issues
  };
}

function aggregateAudits(audits) {
  const summary = {
    errors: 0,
    warnings: 0,
    information: 0,
    total: 0
  };

  for (const audit of audits) {
    summary.errors +=
      audit.summary.errors ?? 0;

    summary.warnings +=
      audit.summary.warnings ?? 0;

    summary.information +=
      audit.summary.information ?? 0;

    summary.total +=
      audit.summary.total ?? 0;
  }

  return summary;
}

function auditPassed(
  auditMap,
  auditId,
  strictWarnings
) {
  const audit = auditMap.get(auditId);

  if (!audit) {
    return false;
  }

  if ((audit.summary.errors ?? 0) > 0) {
    return false;
  }

  if (
    strictWarnings &&
    (audit.summary.warnings ?? 0) > 0
  ) {
    return false;
  }

  return true;
}

function resolveProjectPath(
  repositoryRoot,
  reference
) {
  if (
    typeof reference !== "string" ||
    reference.trim() === ""
  ) {
    return null;
  }

  if (
    reference === "~" ||
    reference.startsWith("~/") ||
    path.isAbsolute(reference)
  ) {
    return resolveFromCwd(reference);
  }

  return path.resolve(
    repositoryRoot,
    reference
  );
}

// RULE-FE (small-slice evidence): whether an evidence narrative (implementation
// journal, browser validation, design-system audit, defect log) is complete used
// to be decided by grepping its markdown body for a bolded "**Gate status:**
// `validated`" marker — typing that exact string into an otherwise-empty file
// satisfied the check. Each evidence entry already carries a schema-validated,
// enum-constrained `status` field (small-slice-manifest.schema.json); that
// structured field is the single source of truth now, and the markdown body is
// read only for placeholder scanning (see audit-small-slice-evidence.mjs).
function evidenceEntryStatusPassed(
  manifest,
  type
) {
  return asArray(
    manifest?.evidence
  ).some((entry) => {
    return entry?.type === type &&
      entry?.status === "passed";
  });
}

async function loadEvidenceContext(
  manifest,
  repositoryRoot
) {
  const result = {
    screenshotRegistry: null
  };

  for (const evidence of asArray(manifest?.evidence)) {
    const filePath = resolveProjectPath(
      repositoryRoot,
      evidence?.path
    );

    if (evidence?.type === "screenshot-registry") {
      if (
        filePath &&
        await pathExists(filePath)
      ) {
        try {
          result.screenshotRegistry =
            (
              await readJsonFile(filePath)
            ).value;
        } catch {
          result.screenshotRegistry = null;
        }
      }
    }
  }

  return result;
}

function screenshotsApproved(registry) {
  if (!registry) {
    return false;
  }

  const captureMap = new Map(
    asArray(registry?.captures)
      .map((capture) => [
        capture?.id,
        capture
      ])
  );

  return asArray(
    registry?.requiredCaptureIds
  ).every((captureId) => {
    const capture =
      captureMap.get(captureId);

    if (
      !capture ||
      capture.status !== "approved"
    ) {
      return false;
    }

    if (
      !capture.approvedBy ||
      !capture.approvedAt
    ) {
      return false;
    }

    return Object.values(
      capture.checks ?? {}
    ).every((checkStatus) => {
      return [
        "passed",
        "not-applicable"
      ].includes(checkStatus);
    });
  });
}

function createGateCheck({
  id,
  passed,
  failed,
  evidence
}) {
  return {
    id,
    description:
      GATE_DESCRIPTIONS[id],
    status: passed
      ? "passed"
      : failed
        ? "failed"
        : "pending",
    evidence: [
      ...new Set(
        evidence.filter(Boolean)
      )
    ],
    blocking: true
  };
}

async function writeJsonAtomic(
  outputPath,
  value
) {
  await fs.mkdir(
    path.dirname(outputPath),
    {
      recursive: true
    }
  );

  const temporaryPath =
    `${outputPath}.tmp-${process.pid}-${Date.now()}`;

  await fs.writeFile(
    temporaryPath,
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8"
  );

  await fs.rename(
    temporaryPath,
    outputPath
  );
}

async function main() {
  let options;

  try {
    options = parseArguments(
      process.argv.slice(2)
    );
  } catch (error) {
    process.stderr.write(
      `${error.message}\n`
    );

    printUsageAndExit();
    return;
  }

  if (options.positional.length < 1) {
    printUsageAndExit();
    return;
  }

  const manifestPath =
    resolveFromCwd(
      options.positional[0]
    );

  let manifestFile;

  try {
    manifestFile =
      await readJsonFile(manifestPath);
  } catch (error) {
    process.stderr.write(
      `${error.message}\n`
    );

    process.exitCode = 1;
    return;
  }

  const manifest =
    manifestFile.value;

  const repositoryRoot =
    resolveFromCwd(
      manifest?.repository?.root ?? "."
    );

  const outputPath =
    options.positional[1]
      ? resolveFromCwd(
        options.positional[1]
      )
      : path.join(
        path.dirname(manifestFile.path),
        "representative-gate-preparation.json"
      );

  if (
    path.normalize(outputPath) ===
    path.normalize(manifestFile.path)
  ) {
    throw new Error(
      "The output path must not overwrite the manifest."
    );
  }

  const composition = await resolveCompositionContext({
    repositoryRoot,
    manifest
  });

  const audits = AUDITS.map((audit) => {
    if (audit.composition) {
      if (!composition.required) {
        return null;
      }

      const required = asArray(audit.inputs).filter(
        (input) => input !== "screenSpecification"
      );
      const unresolved = composition.missing.filter(
        (entry) => required.includes(entry.key)
      );

      if (unresolved.length > 0) {
        return unresolvedCompositionAudit(audit, unresolved);
      }
    }

    return runAudit({
      audit,
      manifestPath: manifestFile.path,
      repositoryRoot,
      options,
      compositionInputs: composition.resolved
    });
  }).filter(Boolean);

  const auditMap = new Map(
    audits.map((audit) => [
      audit.id,
      audit
    ])
  );

  const summary =
    aggregateAudits(audits);

  const readinessPath =
    resolveProjectPath(
      repositoryRoot,
      manifest?.screen?.readinessReport
    );

  let readinessReport = null;

  if (
    readinessPath &&
    await pathExists(readinessPath)
  ) {
    try {
      readinessReport =
        (
          await readJsonFile(readinessPath)
        ).value;
    } catch {
      readinessReport = null;
    }
  }

  const evidenceContext =
    await loadEvidenceContext(
      manifest,
      repositoryRoot
    );

  const screenSpecificationPath =
    resolveProjectPath(
      repositoryRoot,
      manifest?.screen?.screenSpecification
    );

  const stateMatrixPath =
    resolveProjectPath(
      repositoryRoot,
      manifest?.screen?.stateMatrix
    );

  const componentMapPath =
    resolveProjectPath(
      repositoryRoot,
      manifest?.screen?.componentMap
    );

  const implementationPlanPath =
    resolveProjectPath(
      repositoryRoot,
      manifest?.screen?.implementationPlan
    );

  const repositoryInspectionPath =
    resolveProjectPath(
      repositoryRoot,
      manifest?.repository?.inspectionFile
    );

  const fixtureStrategyPath =
    resolveProjectPath(
      repositoryRoot,
      manifest?.fixtures?.strategyFile
    );

  const planningFilesExist = (
    await Promise.all(
      [
        screenSpecificationPath,
        stateMatrixPath,
        componentMapPath,
        implementationPlanPath,
        repositoryInspectionPath,
        fixtureStrategyPath
      ].map(async (filePath) => {
        return Boolean(
          filePath &&
          await pathExists(filePath)
        );
      })
    )
  ).every(Boolean);

  const readinessHealthy = Boolean(
    readinessReport &&
    (readinessReport?.summary?.errors ?? 1) === 0 &&
    [
      "ready-for-small-slice",
      "representative-ready-for-review",
      "broad-build-approved"
    ].includes(
      readinessReport?.readiness?.status
    )
  );

  const manifestAuditPassed =
    auditPassed(
      auditMap,
      "manifest",
      options.strictWarnings
    );

  const fileAuditPassed =
    auditPassed(
      auditMap,
      "files",
      options.strictWarnings
    );

  const scopeAuditPassed =
    auditPassed(
      auditMap,
      "scope",
      options.strictWarnings
    );

  const evidenceAuditPassed =
    auditPassed(
      auditMap,
      "evidence",
      options.strictWarnings
    );

  const stylingContractPassed = auditPassed(auditMap, "styling-contract", options.strictWarnings);
  const stylingGlobalPassed = auditPassed(auditMap, "styling-global", options.strictWarnings);
  const stylingReady = stylingContractPassed && stylingGlobalPassed;

  const journalValidated =
    evidenceEntryStatusPassed(
      manifest,
      "implementation-journal"
    );

  const browserValidated =
    evidenceEntryStatusPassed(
      manifest,
      "browser-validation"
    );

  const designAuditValidated =
    evidenceEntryStatusPassed(
      manifest,
      "design-system-audit"
    );

  const defectLogValidated =
    evidenceEntryStatusPassed(
      manifest,
      "defect-log"
    );

  const screenshotRegistryValidated =
    evidenceContext
      .screenshotRegistry
      ?.meta
      ?.status === "validated";

  const requiredScreenshotsApproved =
    screenshotsApproved(
      evidenceContext.screenshotRegistry
    );

  const fixturesSafe = Boolean(
    manifest?.fixtures?.deterministic === true &&
    manifest?.fixtures
      ?.containsProductionData === false &&
    asArray(manifest?.fixtures?.items)
      .every((fixture) => {
        return fixture?.safe === true;
      })
  );

  const blockers =
    asArray(manifest?.scope?.blockers)
      .filter((blocker) => {
        return typeof blocker === "string" &&
          blocker.trim() !== "";
      });

  const triggeredStopConditions =
    asArray(manifest?.stopConditions)
      .filter((condition) => {
        return condition?.status === "triggered";
      });

  const planningReady =
    readinessHealthy &&
    planningFilesExist;

  const implementationReady =
    manifest?.meta?.status === "validated" &&
    manifestAuditPassed &&
    fileAuditPassed &&
    scopeAuditPassed &&
    journalValidated &&
    stylingReady;

  const responsiveReady =
    browserValidated &&
    requiredScreenshotsApproved;

  const accessibilityReady =
    browserValidated &&
    designAuditValidated;

  const auditEvidenceReady =
    screenshotRegistryValidated &&
    requiredScreenshotsApproved &&
    designAuditValidated &&
    evidenceAuditPassed &&
    stylingReady;

  const defectReady =
    defectLogValidated &&
    evidenceAuditPassed;

  const noBlockers =
    blockers.length === 0 &&
    triggeredStopConditions.length === 0 &&
    summary.errors === 0;

  const auditFailure =
    summary.errors > 0 ||
    (
      options.strictWarnings &&
      summary.warnings > 0
    );

  const checks = [
    createGateCheck({
      id: "GATE-001",
      passed: planningReady,
      failed: !readinessHealthy,
      evidence: [
        manifest?.screen?.screenSpecification,
        manifest?.screen?.readinessReport
      ]
    }),

    createGateCheck({
      id: "GATE-002",
      passed: planningReady,
      failed: !readinessHealthy,
      evidence: [
        manifest?.screen?.screenSpecification,
        manifest?.screen?.implementationPlan
      ]
    }),

    createGateCheck({
      id: "GATE-003",
      passed:
        planningReady &&
        Boolean(stateMatrixPath),
      failed: !readinessHealthy,
      evidence: [
        manifest?.screen?.stateMatrix
      ]
    }),

    createGateCheck({
      id: "GATE-004",
      passed:
        planningReady &&
        Boolean(componentMapPath),
      failed:
        !readinessHealthy ||
        !manifestAuditPassed,
      evidence: [
        manifest?.screen?.componentMap,
        manifest?.screen?.readinessReport
      ]
    }),

    createGateCheck({
      id: "GATE-005",
      passed:
        planningReady &&
        manifestAuditPassed &&
        scopeAuditPassed,
      failed:
        !manifestAuditPassed ||
        !scopeAuditPassed,
      evidence: [
        manifest?.screen?.screenSpecification,
        manifest?.screen?.readinessReport,
        manifest?.meta?.source
      ]
    }),

    createGateCheck({
      id: "GATE-006",
      passed:
        fixturesSafe &&
        Boolean(fixtureStrategyPath),
      failed: !fixturesSafe,
      evidence: [
        manifest?.fixtures?.strategyFile,
        ...asArray(
          manifest?.fixtures?.items
        ).map((fixture) => fixture?.source)
      ]
    }),

    createGateCheck({
      id: "GATE-007",
      passed: implementationReady,
      failed:
        !manifestAuditPassed ||
        !fileAuditPassed ||
        !scopeAuditPassed,
      evidence: [
        manifest?.meta?.source,
        asArray(
          manifest?.evidence
        ).find((item) => {
          return item?.type ===
            "implementation-journal";
        })?.path
      ]
    }),

    createGateCheck({
      id: "GATE-008",
      passed: responsiveReady,
      failed:
        !evidenceAuditPassed &&
        manifest?.meta?.status === "validated",
      evidence: [
        asArray(
          manifest?.evidence
        ).find((item) => {
          return item?.type ===
            "browser-validation";
        })?.path,
        asArray(
          manifest?.evidence
        ).find((item) => {
          return item?.type ===
            "screenshot-registry";
        })?.path
      ]
    }),

    createGateCheck({
      id: "GATE-009",
      passed: accessibilityReady,
      failed:
        !evidenceAuditPassed &&
        manifest?.meta?.status === "validated",
      evidence: [
        asArray(
          manifest?.evidence
        ).find((item) => {
          return item?.type ===
            "browser-validation";
        })?.path,
        asArray(
          manifest?.evidence
        ).find((item) => {
          return item?.type ===
            "design-system-audit";
        })?.path
      ]
    }),

    createGateCheck({
      id: "GATE-010",
      passed: auditEvidenceReady,
      failed:
        !evidenceAuditPassed &&
        manifest?.meta?.status === "validated",
      evidence: [
        asArray(
          manifest?.evidence
        ).find((item) => {
          return item?.type ===
            "screenshot-registry";
        })?.path,
        asArray(
          manifest?.evidence
        ).find((item) => {
          return item?.type ===
            "design-system-audit";
        })?.path
      ]
    }),

    createGateCheck({
      id: "GATE-011",
      passed: defectReady,
      failed:
        !evidenceAuditPassed &&
        manifest?.meta?.status === "validated",
      evidence: [
        asArray(
          manifest?.evidence
        ).find((item) => {
          return item?.type ===
            "defect-log";
        })?.path
      ]
    }),

    createGateCheck({
      id: "GATE-012",
      passed: noBlockers,
      failed:
        blockers.length > 0 ||
        triggeredStopConditions.length > 0 ||
        auditFailure,
      evidence: [
        manifest?.meta?.source,
        manifest?.screen?.readinessReport
      ]
    })
  ];

  const allChecksPassed =
    checks.every((check) => {
      return check.status === "passed";
    });

  const reasons = [];

  if (options.structuralOnly) {
    reasons.push(
      "Structural-only validation cannot release representative review."
    );
  }

  if (
    readinessReport?.meta?.structuralOnly === true
  ) {
    reasons.push(
      "The readiness report was generated in structural-only mode."
    );
  }

  if (
    manifest?.meta?.status !== "validated"
  ) {
    reasons.push(
      `Manifest status '${manifest?.meta?.status}' is not validated.`
    );
  }

  if (summary.errors > 0) {
    reasons.push(
      `${summary.errors} audit error or errors remain.`
    );
  }

  if (
    options.strictWarnings &&
    summary.warnings > 0
  ) {
    reasons.push(
      `${summary.warnings} warning or warnings are blocking.`
    );
  }

  if (blockers.length > 0) {
    reasons.push(
      `${blockers.length} scope blocker or blockers remain.`
    );
  }

  if (triggeredStopConditions.length > 0) {
    reasons.push(
      `${triggeredStopConditions.length} stop condition or conditions remain triggered.`
    );
  }

  const canRequestApproval = Boolean(
    !options.structuralOnly &&
    readinessReport?.meta?.structuralOnly !== true &&
    manifest?.meta?.status === "validated" &&
    !auditFailure &&
    allChecksPassed
  );

  const report = {
    meta: {
      id:
        `${manifest?.screen?.id ?? "screen"}-representative-gate-preparation`,
      generatedAt:
        new Date().toISOString(),
      manifestPath:
        manifestFile.path,
      outputPath,
      structuralOnly:
        options.structuralOnly,
      strictWarnings:
        options.strictWarnings
    },
    screen: {
      id:
        manifest?.screen?.id ?? null,
      name:
        manifest?.screen?.name ?? null,
      sliceId:
        manifest?.slice?.id ?? null,
      manifestStatus:
        manifest?.meta?.status ?? null,
      readinessStatus:
        readinessReport
          ?.readiness
          ?.status ?? null
    },
    auditSummary: summary,
    preparation: {
      status: canRequestApproval
        ? "ready-for-review"
        : "blocked",
      recommendedGateStatus:
        canRequestApproval
          ? "ready"
          : "blocked",
      canRequestApproval,
      approvalPerformed: false,
      screenSpecificationModified: false,
      reasons
    },
    requiredChecks: checks,
    blockers: {
      scope: blockers,
      triggeredStopConditions:
        triggeredStopConditions.map(
          (condition) => condition.id
        )
    },
    audits,
    manualActionRequired: {
      description:
        "Review this artifact and update screen-spec.json manually. " +
        "Do not set representativeGate.status to approved without " +
        "explicit human approval.",
      target:
        manifest?.screen?.screenSpecification ?? null,
      permittedPreparedStatus:
        canRequestApproval
          ? "ready"
          : "blocked",
      prohibitedAutomaticStatus:
        "approved"
    }
  };

  await writeJsonAtomic(
    outputPath,
    report
  );

  if (options.json) {
    process.stdout.write(
      `${JSON.stringify(report, null, 2)}\n`
    );
  } else {
    process.stdout.write(
      "Representative Gate Preparation\n"
    );

    process.stdout.write(
      "===============================\n"
    );

    process.stdout.write(
      `Screen: ${report.screen.name ?? report.screen.id ?? "unknown"}\n`
    );

    process.stdout.write(
      `Status: ${report.preparation.status}\n`
    );

    process.stdout.write(
      `Recommended gate status: ` +
      `${report.preparation.recommendedGateStatus}\n`
    );

    process.stdout.write(
      `Errors: ${summary.errors} | ` +
      `Warnings: ${summary.warnings} | ` +
      `Information: ${summary.information}\n`
    );

    process.stdout.write(
      `Output: ${outputPath}\n`
    );

    if (reasons.length > 0) {
      process.stdout.write(
        "\nBlocking reasons:\n"
      );

      for (const reason of reasons) {
        process.stdout.write(
          `- ${reason}\n`
        );
      }
    }

    process.stdout.write(
      "\nNo approval or screen-specification modification was performed.\n"
    );
  }

  process.exitCode =
    canRequestApproval
      ? 0
      : 1;
}

main().catch((error) => {
  process.stderr.write(
    `${error.stack ?? error.message}\n`
  );

  process.exitCode = 1;
});
