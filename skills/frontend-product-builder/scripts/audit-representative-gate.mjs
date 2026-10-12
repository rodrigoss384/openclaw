#!/usr/bin/env node

import path from "node:path";

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
  "node audit-representative-gate.mjs <screen-spec.json>",
  "  [--strict-warnings]",
  "  [--json]"
].join(" ");

const REQUIRED_GATE_IDS = [
  "GATE-001",
  "GATE-002",
  "GATE-003",
  "GATE-004",
  "GATE-005",
  "GATE-006",
  "GATE-007",
  "GATE-008",
  "GATE-009",
  "GATE-010",
  "GATE-011",
  "GATE-012"
];

const IMAGE_EXTENSION_PATTERN =
  /\.(png|jpe?g|webp)$/i;

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

function isPotentialFileReference(value) {
  if (typeof value !== "string") {
    return false;
  }

  return /[\\/]/.test(value) ||
    /\.(json|md|png|jpe?g|webp|txt|log|html|xml|trx)$/i
      .test(value);
}

async function resolveEvidenceFile(
  evidence,
  specificationPath
) {
  if (path.isAbsolute(evidence)) {
    return await pathExists(evidence)
      ? evidence
      : null;
  }

  const cwdCandidate = resolveFromCwd(evidence);

  if (await pathExists(cwdCandidate)) {
    return cwdCandidate;
  }

  const screenCandidate = path.resolve(
    path.dirname(specificationPath),
    evidence
  );

  if (await pathExists(screenCandidate)) {
    return screenCandidate;
  }

  return null;
}

function validateGateIdentity(specification, collector) {
  const gate = specification?.representativeGate;

  if (!gate) {
    collector.error(
      "SCREEN_GATE_MISSING",
      "representativeGate is missing.",
      "$.representativeGate"
    );

    return;
  }

  if (
    gate.enabled === true &&
    gate.representative !== true
  ) {
    collector.warning(
      "SCREEN_GATE_ENABLED_NOT_REPRESENTATIVE",
      "The representative gate is enabled but representative is false.",
      "$.representativeGate"
    );
  }

  if (
    gate.enabled === false &&
    gate.status !== "not-required"
  ) {
    collector.error(
      "SCREEN_GATE_DISABLED_STATUS",
      "A disabled representative gate must use status " +
      "'not-required'.",
      "$.representativeGate.status"
    );
  }

  if (
    gate.status === "not-required" &&
    gate.enabled === true
  ) {
    collector.warning(
      "SCREEN_GATE_NOT_REQUIRED_ENABLED",
      "The gate is marked not-required while enabled remains true.",
      "$.representativeGate"
    );
  }

  const implementationSlice = normalize(
    specification?.implementation?.representativeSlice
  );

  const gateSlice = normalize(gate?.slice);

  if (
    implementationSlice &&
    gateSlice &&
    implementationSlice !== gateSlice
  ) {
    collector.error(
      "SCREEN_GATE_SLICE_MISMATCH",
      "representativeGate.slice does not match " +
      "implementation.representativeSlice.",
      "$.representativeGate.slice",
      {
        implementationSlice:
          specification?.implementation?.representativeSlice,
        gateSlice: gate?.slice
      }
    );
  }
}

function validateRequiredChecks(specification, collector) {
  const gate = specification?.representativeGate;
  const checks = asArray(gate?.requiredChecks);
  const checkMap = new Map(
    checks.map((check) => [
      check?.id,
      check
    ])
  );

  if (
    gate?.enabled === true &&
    gate?.representative === true
  ) {
    for (const requiredId of REQUIRED_GATE_IDS) {
      if (!checkMap.has(requiredId)) {
        collector.error(
          "SCREEN_GATE_REQUIRED_CHECK_MISSING",
          `Required representative gate check '${requiredId}' is ` +
          "missing.",
          "$.representativeGate.requiredChecks"
        );
      }
    }
  }

  checks.forEach((check, index) => {
    const location =
      `$.representativeGate.requiredChecks[${index}]`;

    if (
      [
        "passed",
        "failed",
        "not-applicable"
      ].includes(check?.status) &&
      asArray(check?.evidence).length === 0
    ) {
      collector.error(
        "SCREEN_GATE_CHECK_EVIDENCE_MISSING",
        `Gate check '${check?.id}' with status '${check?.status}' ` +
        "requires evidence.",
        `${location}.evidence`
      );
    }

    if (
      check?.status === "pending" &&
      asArray(check?.evidence).length > 0
    ) {
      collector.warning(
        "SCREEN_GATE_PENDING_WITH_EVIDENCE",
        `Pending gate check '${check?.id}' already contains evidence. ` +
        "Confirm whether its status should be updated.",
        location
      );
    }

    if (
      check?.id === "GATE-010" &&
      check?.status === "passed" &&
      !asArray(check?.evidence).some((item) => {
        return IMAGE_EXTENSION_PATTERN.test(item);
      })
    ) {
      collector.warning(
        "SCREEN_GATE_SCREENSHOT_EVIDENCE",
        "GATE-010 passed without an image reference in its evidence.",
        `${location}.evidence`
      );
    }
  });
}

function validateGateStatus(specification, collector) {
  const gate = specification?.representativeGate;
  const checks = asArray(gate?.requiredChecks);
  const blockingChecks = checks.filter((check) => {
    return check?.blocking === true;
  });

  const pendingBlocking = blockingChecks.filter((check) => {
    return check?.status === "pending";
  });

  const failedBlocking = blockingChecks.filter((check) => {
    return check?.status === "failed";
  });

  const unresolvedBlocking = blockingChecks.filter((check) => {
    return ![
      "passed",
      "not-applicable"
    ].includes(check?.status);
  });

  const openQuestions = meaningfulEntries(
    specification?.productContext?.openQuestions
  );

  const blockers = meaningfulEntries(
    specification?.implementation?.blockers
  );

  if (
    [
      "ready",
      "approved"
    ].includes(gate?.status) &&
    unresolvedBlocking.length > 0
  ) {
    collector.error(
      "SCREEN_GATE_READY_WITH_UNRESOLVED_CHECK",
      `Gate status '${gate?.status}' is incompatible with ` +
      `${unresolvedBlocking.length} unresolved blocking check or checks.`,
      "$.representativeGate.status"
    );
  }

  if (
    [
      "ready",
      "approved"
    ].includes(gate?.status) &&
    openQuestions.length > 0
  ) {
    collector.error(
      "SCREEN_GATE_WITH_OPEN_QUESTIONS",
      `Gate status '${gate?.status}' is incompatible with unresolved ` +
      "product questions.",
      "$.productContext.openQuestions",
      openQuestions
    );
  }

  if (
    [
      "ready",
      "approved"
    ].includes(gate?.status) &&
    blockers.length > 0
  ) {
    collector.error(
      "SCREEN_GATE_WITH_BLOCKERS",
      `Gate status '${gate?.status}' is incompatible with unresolved ` +
      "implementation blockers.",
      "$.implementation.blockers",
      blockers
    );
  }

  if (
    gate?.status === "blocked" &&
    pendingBlocking.length === 0 &&
    failedBlocking.length === 0 &&
    openQuestions.length === 0 &&
    blockers.length === 0
  ) {
    collector.warning(
      "SCREEN_GATE_BLOCKED_WITHOUT_CAUSE",
      "The representative gate remains blocked but no pending check, " +
      "failed check, open question, or blocker is recorded.",
      "$.representativeGate.status"
    );
  }

  if (
    gate?.status === "rejected" &&
    failedBlocking.length === 0
  ) {
    collector.error(
      "SCREEN_GATE_REJECTED_WITHOUT_FAILURE",
      "A rejected representative gate requires at least one failed " +
      "blocking check.",
      "$.representativeGate.status"
    );
  }

  if (gate?.status === "approved") {
    if (!gate?.approval?.approvedBy) {
      collector.error(
        "SCREEN_GATE_APPROVED_BY_MISSING",
        "Approved representative gate requires approvedBy.",
        "$.representativeGate.approval.approvedBy"
      );
    }

    if (!gate?.approval?.approvedAt) {
      collector.error(
        "SCREEN_GATE_APPROVED_AT_MISSING",
        "Approved representative gate requires approvedAt.",
        "$.representativeGate.approval.approvedAt"
      );
    }
  }

  if (gate?.status === "not-required") {
    if (!gate?.approval?.approvedBy) {
      collector.error(
        "SCREEN_GATE_EXCEPTION_APPROVER",
        "A not-required gate exception requires explicit approval.",
        "$.representativeGate.approval.approvedBy"
      );
    }

    if (!gate?.approval?.approvedAt) {
      collector.error(
        "SCREEN_GATE_EXCEPTION_DATE",
        "A not-required gate exception requires an approval date.",
        "$.representativeGate.approval.approvedAt"
      );
    }

    if (
      asArray(gate?.approval?.notes).length === 0
    ) {
      collector.error(
        "SCREEN_GATE_EXCEPTION_RATIONALE",
        "A not-required gate exception requires approval notes.",
        "$.representativeGate.approval.notes"
      );
    }
  }
}

function validateMetaStatus(specification, collector) {
  const metaStatus = specification?.meta?.status;
  const gateStatus =
    specification?.representativeGate?.status;

  if (
    metaStatus === "approved" &&
    ![
      "ready",
      "approved",
      "not-required"
    ].includes(gateStatus)
  ) {
    collector.error(
      "SCREEN_GATE_META_APPROVED_TOO_EARLY",
      "The specification is marked approved while the representative " +
      "gate remains unresolved.",
      "$.meta.status"
    );
  }

  if (
    metaStatus === "implemented" &&
    ![
      "approved",
      "not-required"
    ].includes(gateStatus)
  ) {
    collector.error(
      "SCREEN_GATE_IMPLEMENTED_WITHOUT_APPROVAL",
      "The specification is marked implemented without representative " +
      "gate approval.",
      "$.meta.status"
    );
  }

  if (
    gateStatus === "approved" &&
    metaStatus === "draft"
  ) {
    collector.error(
      "SCREEN_GATE_APPROVED_DRAFT_SPEC",
      "The representative gate is approved while the specification " +
      "remains draft.",
      "$.meta.status"
    );
  }

  if (
    gateStatus === "ready" &&
    metaStatus === "draft"
  ) {
    collector.warning(
      "SCREEN_GATE_READY_DRAFT_SPEC",
      "The representative gate is ready while the specification " +
      "remains draft.",
      "$.meta.status"
    );
  }
}

async function validatePlanningArtifacts(
  specification,
  specificationPath,
  collector
) {
  const gateStatus =
    specification?.representativeGate?.status;

  const screenDirectory = path.dirname(
    specificationPath
  );

  const requiredArtifacts = [
    "state-matrix.md",
    "component-map.md",
    "implementation-plan.md"
  ];

  for (const artifact of requiredArtifacts) {
    const artifactPath = path.join(
      screenDirectory,
      artifact
    );

    const exists = await pathExists(artifactPath);

    if (
      [
        "ready",
        "approved"
      ].includes(gateStatus) &&
      !exists
    ) {
      collector.error(
        "SCREEN_GATE_PLANNING_ARTIFACT_MISSING",
        `Gate status '${gateStatus}' requires '${artifact}'.`,
        "$.representativeGate.status",
        artifactPath
      );
    } else if (!exists) {
      collector.warning(
        "SCREEN_GATE_PLANNING_ARTIFACT_PENDING",
        `Planning artifact '${artifact}' does not exist yet.`,
        specificationPath,
        artifactPath
      );
    } else {
      collector.info(
        "SCREEN_GATE_PLANNING_ARTIFACT_FOUND",
        `Planning artifact '${artifact}' exists.`,
        artifactPath
      );
    }
  }
}

async function validateEvidenceFiles(
  specification,
  specificationPath,
  collector
) {
  const gateStatus =
    specification?.representativeGate?.status;

  for (
    const [checkIndex, check] of
    asArray(
      specification?.representativeGate?.requiredChecks
    ).entries()
  ) {
    for (
      const [evidenceIndex, evidence] of
      asArray(check?.evidence).entries()
    ) {
      if (!isPotentialFileReference(evidence)) {
        continue;
      }

      const resolvedEvidence = await resolveEvidenceFile(
        evidence,
        specificationPath
      );

      if (resolvedEvidence) {
        collector.info(
          "SCREEN_GATE_EVIDENCE_FILE_FOUND",
          `Evidence file for '${check?.id}' exists.`,
          `$.representativeGate.requiredChecks` +
          `[${checkIndex}].evidence[${evidenceIndex}]`,
          resolvedEvidence
        );

        continue;
      }

      const severity = gateStatus === "approved"
        ? "error"
        : "warning";

      collector[severity](
        "SCREEN_GATE_EVIDENCE_FILE_MISSING",
        `Evidence reference for '${check?.id}' could not be resolved.`,
        `$.representativeGate.requiredChecks` +
        `[${checkIndex}].evidence[${evidenceIndex}]`,
        evidence
      );
    }
  }
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  const inputPath = requireInputPath(options, USAGE);
  const collector = new IssueCollector();

  let specificationFile;

  try {
    specificationFile = await readJsonFile(inputPath);
  } catch (error) {
    collector.error(
      "SCREEN_GATE_JSON",
      error.message,
      inputPath
    );

    collector.print(
      "Representative Screen Gate Audit",
      { json: options.json }
    );

    setExitCode(collector, options);
    return;
  }

  const specification = specificationFile.value;

  validateGateIdentity(specification, collector);
  validateRequiredChecks(specification, collector);
  validateGateStatus(specification, collector);
  validateMetaStatus(specification, collector);

  await validatePlanningArtifacts(
    specification,
    specificationFile.path,
    collector
  );

  await validateEvidenceFiles(
    specification,
    specificationFile.path,
    collector
  );

  collector.print(
    "Representative Screen Gate Audit",
    { json: options.json }
  );

  setExitCode(collector, options);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
