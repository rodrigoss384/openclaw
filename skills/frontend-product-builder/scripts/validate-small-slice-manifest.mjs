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
  resolveSchemaPath,
  setExitCode
} from "./lib/screen-contract-utils.mjs";

const USAGE = [
  "node validate-small-slice-manifest.mjs",
  "<small-slice-manifest.json>",
  "[--schema <schema.json>]",
  "[--structural-only]",
  "[--strict-warnings]",
  "[--json]"
].join(" ");

const REQUIRED_TOP_LEVEL_BLOCKS = [
  "$schema",
  "meta",
  "screen",
  "release",
  "repository",
  "slice",
  "scope",
  "architecture",
  "fixtures",
  "states",
  "interactions",
  "responsive",
  "accessibility",
  "files",
  "sequence",
  "evidence",
  "stopConditions",
  "validation"
];

const REQUIRED_VALIDATION_IDS = Array.from(
  { length: 11 },
  (_, index) => {
    return `SLICE-${String(index + 1).padStart(3, "0")}`;
  }
);

const IMPLEMENTATION_STATUSES = new Set([
  "ready",
  "in-progress",
  "validated"
]);

const COMPLETED_EVIDENCE_STATUSES = new Set([
  "available",
  "passed"
]);

const PLACEHOLDER_PATTERN = /<[^<>\n]+>/g;

function normalize(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function isSubstantive(value) {
  const normalized = normalize(value).toLowerCase();

  if (!normalized) {
    return false;
  }

  return ![
    "none",
    "n/a",
    "na",
    "unknown",
    "tbd",
    "todo",
    "not defined",
    "to be defined"
  ].includes(normalized);
}

function isRemoteReference(value) {
  return typeof value === "string" &&
    (
      value.startsWith("http://") ||
      value.startsWith("https://")
    );
}

function collectPlaceholders(
  value,
  location = "$",
  results = []
) {
  if (typeof value === "string") {
    const matches = value.match(PLACEHOLDER_PATTERN) ?? [];

    for (const match of matches) {
      results.push({
        location,
        placeholder: match
      });
    }

    return results;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectPlaceholders(
        item,
        `${location}[${index}]`,
        results
      );
    });

    return results;
  }

  if (
    value &&
    typeof value === "object"
  ) {
    for (const [key, item] of Object.entries(value)) {
      collectPlaceholders(
        item,
        `${location}.${key}`,
        results
      );
    }
  }

  return results;
}

function addDuplicateValueIssues({
  collector,
  values,
  code,
  label,
  location
}) {
  const seen = new Set();

  values.forEach((value, index) => {
    if (!value) {
      return;
    }

    if (seen.has(value)) {
      collector.error(
        code,
        `${label} '${value}' is duplicated.`,
        `${location}[${index}]`
      );

      return;
    }

    seen.add(value);
  });
}

function getManifestStatus(manifest) {
  return manifest?.meta?.status;
}

function validateTopLevel(manifest, collector) {
  for (const block of REQUIRED_TOP_LEVEL_BLOCKS) {
    if (!(block in manifest)) {
      collector.error(
        "SLICE_STRUCTURE_BLOCK_MISSING",
        `Required top-level block '${block}' is missing.`,
        "$"
      );
    }
  }
}

function validatePlaceholders(manifest, collector) {
  const placeholders = collectPlaceholders(manifest);

  for (const item of placeholders) {
    collector.error(
      "SLICE_PLACEHOLDER_UNRESOLVED",
      `Unresolved placeholder '${item.placeholder}'.`,
      item.location
    );
  }
}

function validateUniqueIdentifiers(
  manifest,
  collector
) {
  addDuplicateValueIssues({
    collector,
    values: asArray(manifest?.fixtures?.items)
      .map((fixture) => fixture?.id),
    code: "SLICE_FIXTURE_ID_DUPLICATE",
    label: "Fixture ID",
    location: "$.fixtures.items"
  });

  addDuplicateValueIssues({
    collector,
    values: asArray(manifest?.states)
      .map((state) => state?.id),
    code: "SLICE_STATE_ID_DUPLICATE",
    label: "State ID",
    location: "$.states"
  });

  addDuplicateValueIssues({
    collector,
    values: asArray(manifest?.interactions)
      .map((interaction) => interaction?.id),
    code: "SLICE_INTERACTION_ID_DUPLICATE",
    label: "Interaction ID",
    location: "$.interactions"
  });

  addDuplicateValueIssues({
    collector,
    values: asArray(manifest?.files)
      .map((file) => file?.path),
    code: "SLICE_FILE_PATH_DUPLICATE",
    label: "File path",
    location: "$.files"
  });

  addDuplicateValueIssues({
    collector,
    values: asArray(manifest?.sequence)
      .map((step) => step?.id),
    code: "SLICE_SEQUENCE_ID_DUPLICATE",
    label: "Sequence step ID",
    location: "$.sequence"
  });

  addDuplicateValueIssues({
    collector,
    values: asArray(manifest?.sequence)
      .map((step) => step?.order),
    code: "SLICE_SEQUENCE_ORDER_DUPLICATE",
    label: "Sequence order",
    location: "$.sequence"
  });

  addDuplicateValueIssues({
    collector,
    values: asArray(manifest?.evidence)
      .map((evidence) => evidence?.id),
    code: "SLICE_EVIDENCE_ID_DUPLICATE",
    label: "Evidence ID",
    location: "$.evidence"
  });

  addDuplicateValueIssues({
    collector,
    values: asArray(manifest?.evidence)
      .map((evidence) => evidence?.path),
    code: "SLICE_EVIDENCE_PATH_DUPLICATE",
    label: "Evidence path",
    location: "$.evidence"
  });

  addDuplicateValueIssues({
    collector,
    values: asArray(manifest?.stopConditions)
      .map((condition) => condition?.id),
    code: "SLICE_STOP_CONDITION_ID_DUPLICATE",
    label: "Stop-condition ID",
    location: "$.stopConditions"
  });

  addDuplicateValueIssues({
    collector,
    values: asArray(
      manifest?.repository?.preExistingChanges
    ).map((change) => change?.path),
    code: "SLICE_BASELINE_PATH_DUPLICATE",
    label: "Pre-existing change path",
    location: "$.repository.preExistingChanges"
  });

  addDuplicateValueIssues({
    collector,
    values: asArray(
      manifest?.scope?.approvedDependencyChanges
    ).map((change) => {
      return [
        change?.packageFile,
        change?.name,
        change?.change
      ].join("::");
    }),
    code: "SLICE_DEPENDENCY_CHANGE_DUPLICATE",
    label: "Approved dependency change",
    location: "$.scope.approvedDependencyChanges"
  });

  addDuplicateValueIssues({
    collector,
    values: asArray(manifest?.validation?.checks)
      .map((check) => check?.id),
    code: "SLICE_VALIDATION_ID_DUPLICATE",
    label: "Validation check ID",
    location: "$.validation.checks"
  });
}

function validateStateAndFixtureReferences(
  manifest,
  collector
) {
  const states = asArray(manifest?.states);
  const fixtures = asArray(manifest?.fixtures?.items);

  const stateIds = new Set(
    states.map((state) => state?.id)
  );

  const fixtureIds = new Set(
    fixtures.map((fixture) => fixture?.id)
  );

  fixtures.forEach((fixture, index) => {
    if (!stateIds.has(fixture?.stateId)) {
      collector.error(
        "SLICE_FIXTURE_STATE_UNKNOWN",
        `Fixture '${fixture?.id}' references unknown state ` +
        `'${fixture?.stateId}'.`,
        `$.fixtures.items[${index}].stateId`
      );
    }
  });

  states.forEach((state, index) => {
    if (
      state?.fixtureId !== null &&
      state?.fixtureId !== undefined &&
      !fixtureIds.has(state.fixtureId)
    ) {
      collector.error(
        "SLICE_STATE_FIXTURE_UNKNOWN",
        `State '${state?.id}' references unknown fixture ` +
        `'${state?.fixtureId}'.`,
        `$.states[${index}].fixtureId`
      );
    }
  });

  const primaryStates = states.filter((state) => {
    return state?.role === "primary";
  });

  const nonSuccessStates = states.filter((state) => {
    return state?.role === "non-success";
  });

  if (primaryStates.length !== 1) {
    collector.error(
      "SLICE_PRIMARY_STATE_COUNT",
      "The manifest must declare exactly one primary state.",
      "$.states",
      {
        count: primaryStates.length
      }
    );
  }

  if (nonSuccessStates.length < 1) {
    collector.error(
      "SLICE_NON_SUCCESS_STATE_MISSING",
      "The manifest must declare at least one non-success state.",
      "$.states"
    );
  }
}

function validateSequenceReferences(
  manifest,
  collector
) {
  const steps = asArray(manifest?.sequence);
  const stepIds = new Set(
    steps.map((step) => step?.id)
  );

  steps.forEach((step, index) => {
    for (
      const [dependencyIndex, dependency] of
      asArray(step?.dependencies).entries()
    ) {
      if (!stepIds.has(dependency)) {
        collector.error(
          "SLICE_SEQUENCE_DEPENDENCY_UNKNOWN",
          `Sequence step '${step?.id}' references unknown ` +
          `dependency '${dependency}'.`,
          `$.sequence[${index}].dependencies` +
          `[${dependencyIndex}]`
        );
      }

      if (dependency === step?.id) {
        collector.error(
          "SLICE_SEQUENCE_SELF_DEPENDENCY",
          `Sequence step '${step?.id}' depends on itself.`,
          `$.sequence[${index}].dependencies` +
          `[${dependencyIndex}]`
        );
      }
    }
  });

  const orderById = new Map(
    steps.map((step) => [
      step?.id,
      step?.order
    ])
  );

  steps.forEach((step, index) => {
    for (const dependency of asArray(step?.dependencies)) {
      const dependencyOrder = orderById.get(dependency);

      if (
        Number.isInteger(dependencyOrder) &&
        Number.isInteger(step?.order) &&
        dependencyOrder >= step.order
      ) {
        collector.error(
          "SLICE_SEQUENCE_ORDER_INVALID",
          `Dependency '${dependency}' must execute before ` +
          `'${step?.id}'.`,
          `$.sequence[${index}]`
        );
      }
    }
  });
}

function validateValidationChecks(
  manifest,
  collector
) {
  const checks = asArray(
    manifest?.validation?.checks
  );

  const checkIds = new Set(
    checks.map((check) => check?.id)
  );

  for (const requiredId of REQUIRED_VALIDATION_IDS) {
    if (!checkIds.has(requiredId)) {
      collector.error(
        "SLICE_VALIDATION_CHECK_MISSING",
        `Required validation check '${requiredId}' is missing.`,
        "$.validation.checks"
      );
    }
  }

  checks.forEach((check, index) => {
    const command = check?.command;

    if (typeof command !== "string") {
      return;
    }

    if (
      command.includes(
        "skills-src/frontend-product-builder"
      )
    ) {
      collector.error(
        "SLICE_VALIDATION_STAGING_PATH",
        `Validation check '${check?.id}' contains a staging path.`,
        `$.validation.checks[${index}].command`,
        command
      );
    }

    if (
      command.includes(
        "node .agents/skills/frontend-product-builder"
      )
    ) {
      collector.error(
        "SLICE_VALIDATION_WORKSPACE_PATH",
        `Validation check '${check?.id}' contains a workspace-relative ` +
        "skill path.",
        `$.validation.checks[${index}].command`,
        command
      );
    }
  });
}

function validateReleaseConsistency(
  manifest,
  collector
) {
  const release = manifest?.release ?? {};

  if (
    release.readinessStatus === "broad-build-approved" &&
    release.nextAllowedStage !== "BUILD"
  ) {
    collector.error(
      "SLICE_RELEASE_STAGE_MISMATCH",
      "broad-build-approved must use nextAllowedStage 'BUILD'.",
      "$.release.nextAllowedStage"
    );
  }

  if (
    [
      "ready-for-small-slice",
      "representative-ready-for-review"
    ].includes(release.readinessStatus) &&
    release.nextAllowedStage !== "SMALL SLICE"
  ) {
    collector.error(
      "SLICE_RELEASE_SMALL_SLICE_MISMATCH",
      `Readiness status '${release.readinessStatus}' must use ` +
      "nextAllowedStage 'SMALL SLICE'.",
      "$.release.nextAllowedStage"
    );
  }

  if (release.validatedBeforeSlice !== true) {
    collector.error(
      "SLICE_RELEASE_NOT_VALIDATED",
      "release.validatedBeforeSlice must remain true.",
      "$.release.validatedBeforeSlice"
    );
  }
}

function validateRepositoryBaseline(
  manifest,
  collector
) {
  const repository = manifest?.repository ?? {};
  const status = getManifestStatus(manifest);

  const requiredFields = [
    "baselineCommit",
    "baselineBranch",
    "baselineCapturedAt"
  ];

  for (const field of requiredFields) {
    if (
      IMPLEMENTATION_STATUSES.has(status) &&
      !isSubstantive(repository[field])
    ) {
      collector.error(
        "SLICE_BASELINE_FIELD_MISSING",
        `repository.${field} must be resolved before implementation.`,
        `$.repository.${field}`
      );
    }
  }

  if (
    repository.migrationRequired === true &&
    repository.migrationApproved !== true
  ) {
    collector.error(
      "SLICE_MIGRATION_NOT_APPROVED",
      "A required migration must be explicitly approved.",
      "$.repository.migrationApproved"
    );
  }

  asArray(repository.preExistingChanges).forEach(
    (change, index) => {
      if (!isSubstantive(change?.handling)) {
        collector.error(
          "SLICE_BASELINE_HANDLING_MISSING",
          `Pre-existing change '${change?.path}' requires an explicit ` +
          "handling policy.",
          `$.repository.preExistingChanges[${index}].handling`
        );
      }
    }
  );
}

function validateDependencyApprovals(
  manifest,
  collector
) {
  asArray(
    manifest?.scope?.approvedDependencyChanges
  ).forEach((change, index) => {
    if (change?.approved !== true) {
      collector.error(
        "SLICE_DEPENDENCY_NOT_APPROVED",
        `Dependency change '${change?.name}' is not approved.`,
        `$.scope.approvedDependencyChanges[${index}].approved`
      );
    }

    if (!isSubstantive(change?.reason)) {
      collector.error(
        "SLICE_DEPENDENCY_REASON_MISSING",
        `Dependency change '${change?.name}' requires a reason.`,
        `$.scope.approvedDependencyChanges[${index}].reason`
      );
    }
  });
}

function validateStatusTransitions(
  manifest,
  collector
) {
  const status = getManifestStatus(manifest);

  if (!IMPLEMENTATION_STATUSES.has(status)) {
    return;
  }

  const blockers = asArray(manifest?.scope?.blockers)
    .filter(isSubstantive);

  if (blockers.length > 0) {
    collector.error(
      "SLICE_STATUS_WITH_BLOCKERS",
      `Manifest status '${status}' is incompatible with unresolved ` +
      "scope blockers.",
      "$.scope.blockers",
      blockers
    );
  }

  const triggeredConditions = asArray(
    manifest?.stopConditions
  ).filter((condition) => {
    return condition?.status === "triggered";
  });

  if (triggeredConditions.length > 0) {
    collector.error(
      "SLICE_STATUS_WITH_TRIGGERED_STOP",
      `Manifest status '${status}' is incompatible with triggered ` +
      "stop conditions.",
      "$.stopConditions",
      triggeredConditions.map((condition) => condition.id)
    );
  }

  if (status === "validated") {
    const incompleteRequiredEvidence = asArray(
      manifest?.evidence
    ).filter((evidence) => {
      return evidence?.required === true &&
        !COMPLETED_EVIDENCE_STATUSES.has(
          evidence?.status
        );
    });

    if (incompleteRequiredEvidence.length > 0) {
      collector.error(
        "SLICE_VALIDATED_WITH_INCOMPLETE_EVIDENCE",
        "A validated manifest contains incomplete required evidence.",
        "$.evidence",
        incompleteRequiredEvidence.map((evidence) => {
          return {
            id: evidence.id,
            status: evidence.status
          };
        })
      );
    }
  }
}

async function validateReferencedFile({
  collector,
  reference,
  label,
  location,
  manifestStatus,
  parseJson = false
}) {
  if (!isSubstantive(reference)) {
    collector.error(
      "SLICE_REFERENCE_MISSING",
      `${label} reference is missing.`,
      location
    );

    return null;
  }

  if (isRemoteReference(reference)) {
    collector.warning(
      "SLICE_REFERENCE_REMOTE",
      `${label} uses a remote reference and was not checked locally.`,
      location,
      reference
    );

    return null;
  }

  const resolvedPath = resolveFromCwd(reference);
  const exists = await pathExists(resolvedPath);

  if (!exists) {
    const severity = IMPLEMENTATION_STATUSES.has(
      manifestStatus
    )
      ? "error"
      : "warning";

    collector[severity](
      "SLICE_REFERENCE_NOT_FOUND",
      `${label} could not be resolved.`,
      location,
      resolvedPath
    );

    return null;
  }

  collector.info(
    "SLICE_REFERENCE_FOUND",
    `${label} exists.`,
    resolvedPath
  );

  if (!parseJson) {
    return {
      path: resolvedPath,
      value: null
    };
  }

  try {
    return await readJsonFile(resolvedPath);
  } catch (error) {
    collector.error(
      "SLICE_REFERENCE_JSON_INVALID",
      `${label} is not valid JSON: ${error.message}`,
      resolvedPath
    );

    return null;
  }
}

async function validateProjectReferences(
  manifest,
  collector
) {
  const status = getManifestStatus(manifest);

  const references = [
    {
      reference:
        manifest?.screen?.screenSpecification,
      label: "Screen specification",
      location: "$.screen.screenSpecification",
      parseJson: true
    },
    {
      reference:
        manifest?.screen?.stateMatrix,
      label: "State matrix",
      location: "$.screen.stateMatrix"
    },
    {
      reference:
        manifest?.screen?.componentMap,
      label: "Component map",
      location: "$.screen.componentMap"
    },
    {
      reference:
        manifest?.screen?.implementationPlan,
      label: "Implementation plan",
      location: "$.screen.implementationPlan"
    },
    {
      reference:
        manifest?.screen?.readinessReport,
      label: "Readiness report",
      location: "$.screen.readinessReport",
      parseJson: true
    },
    {
      reference:
        manifest?.repository?.inspectionFile,
      label: "Repository inspection",
      location: "$.repository.inspectionFile"
    },
    {
      reference:
        manifest?.fixtures?.strategyFile,
      label: "Fixture strategy",
      location: "$.fixtures.strategyFile"
    }
  ];

  const results = new Map();

  for (const reference of references) {
    const result = await validateReferencedFile({
      collector,
      manifestStatus: status,
      ...reference
    });

    results.set(reference.label, result);
  }

  const readinessResult =
    results.get("Readiness report");

  if (readinessResult?.value) {
    validateReadinessReport(
      manifest,
      readinessResult.value,
      collector
    );
  }
}

function validateReadinessReport(
  manifest,
  report,
  collector
) {
  const expectedStatus =
    manifest?.release?.readinessStatus;

  const actualStatus =
    report?.readiness?.status;

  if (actualStatus !== expectedStatus) {
    collector.error(
      "SLICE_READINESS_STATUS_MISMATCH",
      "Manifest release status does not match readiness report.",
      "$.release.readinessStatus",
      {
        manifest: expectedStatus,
        report: actualStatus
      }
    );
  }

  const expectedStage =
    manifest?.release?.nextAllowedStage;

  const actualStage =
    report?.readiness?.nextAllowedStage;

  if (actualStage !== expectedStage) {
    collector.error(
      "SLICE_READINESS_STAGE_MISMATCH",
      "Manifest nextAllowedStage does not match readiness report.",
      "$.release.nextAllowedStage",
      {
        manifest: expectedStage,
        report: actualStage
      }
    );
  }

  if (
    report?.meta?.structuralOnly !==
    manifest?.release?.structuralOnly
  ) {
    collector.error(
      "SLICE_READINESS_STRUCTURAL_MODE_MISMATCH",
      "Manifest structuralOnly does not match readiness report.",
      "$.release.structuralOnly"
    );
  }

  if (
    report?.meta?.strictWarnings !==
    manifest?.release?.strictWarnings
  ) {
    collector.error(
      "SLICE_READINESS_WARNING_MODE_MISMATCH",
      "Manifest strictWarnings does not match readiness report.",
      "$.release.strictWarnings"
    );
  }

  if (
    report?.meta?.generatedAt &&
    manifest?.release?.reportGeneratedAt &&
    report.meta.generatedAt !==
      manifest.release.reportGeneratedAt
  ) {
    collector.warning(
      "SLICE_READINESS_TIMESTAMP_MISMATCH",
      "Manifest reportGeneratedAt differs from the readiness report.",
      "$.release.reportGeneratedAt",
      {
        manifest:
          manifest.release.reportGeneratedAt,
        report:
          report.meta.generatedAt
      }
    );
  }

  if (
    report?.summary?.errors > 0
  ) {
    collector.error(
      "SLICE_READINESS_REPORT_ERRORS",
      "The readiness report contains blocking errors.",
      "$.screen.readinessReport",
      report.summary.errors
    );
  }
}

async function runJsonSchemaValidation({
  manifest,
  manifestPath,
  options,
  collector
}) {
  if (options.structuralOnly) {
    collector.warning(
      "SLICE_SCHEMA_SKIPPED",
      "Complete JSON Schema validation was skipped because " +
      "--structural-only was requested.",
      manifestPath
    );

    return;
  }

  let schemaPath;

  try {
    schemaPath = await resolveSchemaPath({
      specification: manifest,
      specificationPath: manifestPath,
      explicitSchemaPath: options.schema
    });
  } catch (error) {
    collector.error(
      "SLICE_SCHEMA_PATH",
      error.message,
      manifestPath
    );

    return;
  }

  if (!schemaPath) {
    collector.error(
      "SLICE_SCHEMA_NOT_FOUND",
      "Could not resolve the small-slice manifest schema.",
      manifestPath
    );

    return;
  }

  let schemaFile;

  try {
    schemaFile = await readJsonFile(schemaPath);
  } catch (error) {
    collector.error(
      "SLICE_SCHEMA_JSON",
      error.message,
      schemaPath
    );

    return;
  }

  let Ajv2020;
  let addFormats;

  try {
    const ajvModule = await import(
      "ajv/dist/2020.js"
    );

    const formatsModule = await import(
      "ajv-formats"
    );

    Ajv2020 = ajvModule.default;
    addFormats = formatsModule.default;
  } catch (error) {
    collector.error(
      "SLICE_SCHEMA_DEPENDENCY",
      "Full schema validation requires 'ajv' and 'ajv-formats'.",
      manifestPath,
      error.message
    );

    return;
  }

  try {
    const ajv = new Ajv2020({
      allErrors: true,
      strict: false,
      allowUnionTypes: true
    });

    addFormats(ajv);

    const validate = ajv.compile(
      schemaFile.value
    );

    const valid = validate(manifest);

    if (!valid) {
      for (const error of validate.errors ?? []) {
        collector.error(
          "SLICE_SCHEMA_VALIDATION",
          error.message ?? "Schema validation failed.",
          error.instancePath || "$",
          {
            keyword: error.keyword,
            params: error.params,
            schemaPath: error.schemaPath
          }
        );
      }

      return;
    }

    collector.info(
      "SLICE_SCHEMA_VALID",
      "The manifest validates against the JSON Schema.",
      schemaFile.path
    );
  } catch (error) {
    collector.error(
      "SLICE_SCHEMA_EXECUTION",
      `JSON Schema validation failed to execute: ${error.message}`,
      schemaFile.path
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
      "SLICE_MANIFEST_JSON",
      error.message,
      inputPath
    );

    collector.print(
      "Small Slice Manifest Validation",
      {
        json: options.json
      }
    );

    setExitCode(collector, options);
    return;
  }

  const manifest = manifestFile.value;

  validateTopLevel(manifest, collector);
  validatePlaceholders(manifest, collector);
  validateUniqueIdentifiers(manifest, collector);

  validateStateAndFixtureReferences(
    manifest,
    collector
  );

  validateSequenceReferences(
    manifest,
    collector
  );

  validateValidationChecks(
    manifest,
    collector
  );

  validateReleaseConsistency(
    manifest,
    collector
  );

  validateRepositoryBaseline(
    manifest,
    collector
  );

  validateDependencyApprovals(
    manifest,
    collector
  );

  validateStatusTransitions(
    manifest,
    collector
  );

  await validateProjectReferences(
    manifest,
    collector
  );

  await runJsonSchemaValidation({
    manifest,
    manifestPath: manifestFile.path,
    options,
    collector
  });

  collector.print(
    "Small Slice Manifest Validation",
    {
      json: options.json
    }
  );

  setExitCode(collector, options);
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});
