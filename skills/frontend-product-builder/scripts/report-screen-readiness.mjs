#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import {
  existsSync
} from "node:fs";
import {
  spawnSync
} from "node:child_process";
import {
  fileURLToPath
} from "node:url";

import {
  asArray,
  parseCliArgs,
  readJsonFile,
  requireInputPath,
  resolveFromCwd
} from "./lib/screen-contract-utils.mjs";

const USAGE = [
  "node report-screen-readiness.mjs <screen-spec.json>",
  "  [output-report.json]",
  "  [--design-system <design-system.json>]",
  "  [--composition-proof <composition-proof.json>]",
  "  [--visual-composition-evidence <visual-composition-evidence.json>]",
  "  [--visual-quality-scorecard <visual-quality-scorecard.json>]",
  "  [--structural-only]",
  "  [--strict-warnings]",
  "  [--json]"
].join(" ");

const SCRIPT_DIRECTORY = path.dirname(
  fileURLToPath(import.meta.url)
);

const AUDITS = [
  {
    id: "schema",
    script: "validate-screen-specification.mjs",
    title: "Screen Specification Validation"
  },
  {
    id: "references",
    script: "audit-screen-spec-references.mjs",
    title: "Screen Specification Reference Audit"
  },
  {
    id: "components",
    script: "audit-screen-component-coverage.mjs",
    title: "Screen Component Coverage Audit"
  },
  {
    id: "actions-and-states",
    script: "audit-screen-action-state-coverage.mjs",
    title: "Screen Action and State Coverage Audit"
  },
  {
    id: "data-ownership",
    script: "audit-screen-data-ownership.mjs",
    title: "Screen Data Ownership Audit"
  },
  {
    id: "representative-gate",
    script: "audit-representative-gate.mjs",
    title: "Representative Screen Gate Audit"
  },
  {
    id: "visual-composition-contract",
    script: "validate-visual-composition-contract.mjs",
    title: "Frontend Visual Composition Contract Validation",
    composition: true,
    inputs: ["specification", "designSystem", "compositionProof"]
  },
  {
    id: "visual-composition-evidence",
    script: "audit-visual-composition-evidence.mjs",
    title: "Frontend Visual Composition Evidence Audit",
    composition: true,
    inputs: [
      "specification",
      "designSystem",
      "compositionProof",
      "visualCompositionEvidence"
    ]
  },
  {
    id: "visual-quality-scorecard",
    script: "validate-visual-quality-scorecard.mjs",
    title: "Frontend Visual Quality Scorecard Validation",
    composition: true,
    inputs: ["visualQualityScorecard"]
  }
];

// Canonical locations declared by
// prompts/spec-driven/manifest.json#frontendCompositionPolicy. A substantial
// screen must resolve every one of them: an unresolved composition input is a
// blocking error, never a silent skip.
const COMPOSITION_INPUTS = {
  designSystem: {
    flag: "design-system",
    resolveDefault: (screenDirectory) => path.resolve(
      screenDirectory,
      "..",
      "..",
      "design-system",
      "design-system.json"
    )
  },
  compositionProof: {
    flag: "composition-proof",
    resolveDefault: (screenDirectory) => path.join(
      screenDirectory,
      "composition-proof.json"
    )
  },
  visualCompositionEvidence: {
    flag: "visual-composition-evidence",
    resolveDefault: (screenDirectory) => path.join(
      screenDirectory,
      "visual-composition-evidence.json"
    )
  },
  visualQualityScorecard: {
    flag: "visual-quality-scorecard",
    resolveDefault: (screenDirectory) => path.join(
      screenDirectory,
      "visual-quality-scorecard.json"
    )
  }
};

// The composition contract is required for any screen carrying a visual
// hierarchy - the same trigger validate-visual-composition-contract.mjs
// enforces. Derived from the contract itself so it cannot be turned off by
// omitting a CLI flag.
function compositionApplies(specification) {
  return Boolean(specification?.visualHierarchy);
}

function extractCompositionFlags(argv) {
  const flags = new Set(
    Object.values(COMPOSITION_INPUTS).map((descriptor) => descriptor.flag)
  );
  const values = {};
  const remaining = [];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const inlineMatch = /^--([a-z-]+)=(.*)$/.exec(argument);

    if (inlineMatch && flags.has(inlineMatch[1])) {
      values[inlineMatch[1]] = inlineMatch[2];
      continue;
    }

    if (argument.startsWith("--") && flags.has(argument.slice(2))) {
      const value = argv[index + 1];

      if (!value || value.startsWith("--")) {
        throw new Error(`${argument} requires a file path.`);
      }

      values[argument.slice(2)] = value;
      index += 1;
      continue;
    }

    remaining.push(argument);
  }

  return { values, remaining };
}

function resolveCompositionInputs({ compositionFlags, specificationPath }) {
  const screenDirectory = path.dirname(specificationPath);
  const resolved = {};
  const missing = [];

  for (const [key, descriptor] of Object.entries(COMPOSITION_INPUTS)) {
    const supplied = compositionFlags[descriptor.flag];
    const candidate = typeof supplied === "string" && supplied.trim()
      ? resolveFromCwd(supplied)
      : descriptor.resolveDefault(screenDirectory);

    resolved[key] = candidate;

    if (!existsSync(candidate)) {
      missing.push({
        key,
        flag: descriptor.flag,
        path: candidate,
        supplied: typeof supplied === "string" && Boolean(supplied.trim())
      });
    }
  }

  return { resolved, missing, screenDirectory };
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
      code: "SCREEN_READINESS_COMPOSITION_INPUT_UNRESOLVED",
      message:
        `Substantial screen requires ${entry.key}; ` +
        `'${entry.path}' does not exist. ` +
        `Produce the contract or pass --${entry.flag} <path>.`,
      location: entry.path,
      detail: {
        auditId: audit.id,
        input: entry.key,
        flag: entry.flag,
        supplied: entry.supplied
      }
    }))
  };
}

function normalize(value) {
  return typeof value === "string"
    ? value.trim().toLowerCase()
    : "";
}

function meaningfulEntries(values) {
  return asArray(values).filter((value) => {
    const normalized = normalize(value);

    return normalized &&
      ![
        "none",
        "no blockers",
        "no blocker",
        "not applicable",
        "n/a",
        "resolved"
      ].includes(normalized);
  });
}

function runAudit({
  audit,
  specificationPath,
  structuralOnly,
  compositionInputs
}) {
  const scriptPath = path.join(
    SCRIPT_DIRECTORY,
    audit.script
  );

  const positionals = asArray(audit.inputs).length > 0
    ? audit.inputs.map((input) => (
      input === "specification"
        ? specificationPath
        : compositionInputs?.[input]
    ))
    : [specificationPath];

  const argumentsList = [
    scriptPath,
    ...positionals,
    "--json"
  ];

  if (
    audit.id === "schema" &&
    structuralOnly
  ) {
    argumentsList.push("--structural-only");
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

  let parsedOutput = null;
  let parseError = null;

  try {
    parsedOutput = JSON.parse(
      execution.stdout || "{}"
    );
  } catch (error) {
    parseError = error.message;
  }

  if (!parsedOutput?.summary || !Array.isArray(parsedOutput?.issues)) {
    return {
      id: audit.id,
      title: audit.title,
      script: audit.script,
      command: [
        process.execPath,
        ...argumentsList
      ].join(" "),
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
          code: "SCREEN_READINESS_AUDIT_EXECUTION",
          message:
            `Audit '${audit.id}' did not produce valid JSON output.`,
          location: scriptPath,
          detail: {
            parseError,
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
    title: parsedOutput.title ?? audit.title,
    script: audit.script,
    command: [
      process.execPath,
      ...argumentsList
    ].join(" "),
    exitCode: execution.status ?? 0,
    summary: parsedOutput.summary,
    issues: parsedOutput.issues
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
    summary.errors += audit.summary.errors ?? 0;
    summary.warnings += audit.summary.warnings ?? 0;
    summary.information +=
      audit.summary.information ?? 0;
    summary.total += audit.summary.total ?? 0;
  }

  return summary;
}

function determineReadiness({
  specification,
  summary,
  strictWarnings
}) {
  const metaStatus = specification?.meta?.status;
  const gateStatus =
    specification?.representativeGate?.status;

  const openQuestions = meaningfulEntries(
    specification?.productContext?.openQuestions
  );

  const blockers = meaningfulEntries(
    specification?.implementation?.blockers
  );

  const auditBlocked =
    summary.errors > 0 ||
    (
      strictWarnings &&
      summary.warnings > 0
    );

  const planningStatusAllowsSlice = [
    "ready",
    "approved",
    "implemented"
  ].includes(metaStatus);

  const canEnterSmallSlice =
    !auditBlocked &&
    planningStatusAllowsSlice &&
    openQuestions.length === 0 &&
    blockers.length === 0;

  const canEnterBroadBuild =
    canEnterSmallSlice &&
    [
      "approved",
      "not-required"
    ].includes(gateStatus);

  let status = "blocked";
  let nextAllowedStage = "PLAN";

  if (canEnterBroadBuild) {
    status = "broad-build-approved";
    nextAllowedStage = "BUILD";
  } else if (
    canEnterSmallSlice &&
    gateStatus === "ready"
  ) {
    status = "representative-ready-for-review";
    nextAllowedStage = "SMALL SLICE";
  } else if (canEnterSmallSlice) {
    status = "ready-for-small-slice";
    nextAllowedStage = "SMALL SLICE";
  } else if (!auditBlocked) {
    status = "planning-incomplete";
    nextAllowedStage = "PLAN";
  }

  const reasons = [];

  if (summary.errors > 0) {
    reasons.push(
      `${summary.errors} audit error or errors remain.`
    );
  }

  if (
    strictWarnings &&
    summary.warnings > 0
  ) {
    reasons.push(
      `${summary.warnings} warning or warnings are blocking because ` +
      "--strict-warnings is enabled."
    );
  }

  if (!planningStatusAllowsSlice) {
    reasons.push(
      `Specification meta status '${metaStatus}' does not release ` +
      "the SMALL SLICE."
    );
  }

  if (openQuestions.length > 0) {
    reasons.push(
      `${openQuestions.length} unresolved product question or ` +
      "questions remain."
    );
  }

  if (blockers.length > 0) {
    reasons.push(
      `${blockers.length} implementation blocker or blockers remain.`
    );
  }

  if (
    canEnterSmallSlice &&
    !canEnterBroadBuild
  ) {
    reasons.push(
      `Representative gate status '${gateStatus}' does not yet ` +
      "release broader BUILD."
    );
  }

  return {
    status,
    nextAllowedStage,
    auditBlocked,
    canEnterSmallSlice,
    canEnterBroadBuild,
    specificationStatus: metaStatus,
    representativeGateStatus: gateStatus,
    unresolvedOpenQuestions: openQuestions,
    unresolvedBlockers: blockers,
    reasons
  };
}

async function main() {
  const { values: compositionFlags, remaining } =
    extractCompositionFlags(process.argv.slice(2));
  const options = parseCliArgs(remaining);
  const inputPath = requireInputPath(options, USAGE);
  const specificationFile = await readJsonFile(inputPath);
  const specificationPath = specificationFile.path;
  const specification = specificationFile.value;

  const outputPath = options.positional[1]
    ? resolveFromCwd(options.positional[1])
    : path.join(
      path.dirname(specificationPath),
      "readiness-report.json"
    );

  if (
    path.normalize(outputPath) ===
    path.normalize(specificationPath)
  ) {
    throw new Error(
      "The readiness report path must not overwrite the screen " +
      "specification."
    );
  }

  const compositionRequired = compositionApplies(specification);
  const composition = resolveCompositionInputs({
    compositionFlags,
    specificationPath
  });

  const auditResults = AUDITS.map((audit) => {
    if (audit.composition) {
      if (!compositionRequired) {
        return null;
      }

      const required = asArray(audit.inputs).filter(
        (input) => input !== "specification"
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
      specificationPath,
      structuralOnly: options.structuralOnly,
      compositionInputs: composition.resolved
    });
  }).filter(Boolean);

  const summary = aggregateAudits(auditResults);

  const readiness = determineReadiness({
    specification,
    summary,
    strictWarnings: options.strictWarnings
  });

  const report = {
    meta: {
      id:
        `${specification?.screen?.id ?? "screen"}-readiness-report`,
      generatedAt: new Date().toISOString(),
      specificationPath,
      outputPath,
      structuralOnly: options.structuralOnly,
      strictWarnings: options.strictWarnings,
      compositionRequired,
      compositionInputs: compositionRequired ? composition.resolved : null
    },
    screen: {
      id: specification?.screen?.id ?? null,
      name: specification?.screen?.name ?? null,
      route: specification?.screen?.route ?? null,
      category: specification?.screen?.category ?? null,
      specificationStatus:
        specification?.meta?.status ?? null,
      representativeGateStatus:
        specification?.representativeGate?.status ?? null
    },
    summary,
    readiness,
    audits: auditResults
  };

  await fs.mkdir(
    path.dirname(outputPath),
    {
      recursive: true
    }
  );

  await fs.writeFile(
    outputPath,
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8"
  );

  if (options.json) {
    process.stdout.write(
      `${JSON.stringify(report, null, 2)}\n`
    );
  } else {
    process.stdout.write(
      "Screen Readiness Report\n"
    );

    process.stdout.write(
      "=======================\n"
    );

    process.stdout.write(
      `Screen: ${report.screen.name ?? report.screen.id ?? "unknown"}\n`
    );

    process.stdout.write(
      `Status: ${readiness.status}\n`
    );

    process.stdout.write(
      `Next allowed stage: ${readiness.nextAllowedStage}\n`
    );

    process.stdout.write(
      `Errors: ${summary.errors} | ` +
      `Warnings: ${summary.warnings} | ` +
      `Information: ${summary.information}\n`
    );

    process.stdout.write(
      `Report: ${outputPath}\n`
    );

    if (readiness.reasons.length > 0) {
      process.stdout.write("\nReasons:\n");

      for (const reason of readiness.reasons) {
        process.stdout.write(`- ${reason}\n`);
      }
    }
  }

  process.exitCode = readiness.canEnterSmallSlice
    ? 0
    : 1;
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
