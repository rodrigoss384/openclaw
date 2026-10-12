#!/usr/bin/env node

import {
  IssueCollector,
  addDuplicateIssues,
  asArray,
  findPlaceholders,
  isObject,
  parseCliArgs,
  readJsonFile,
  requireInputPath,
  resolveSchemaPath,
  setExitCode
} from "./lib/screen-contract-utils.mjs";

const USAGE = [
  "node validate-screen-specification.mjs <screen-spec.json>",
  "  [--schema <schema.json>]",
  "  [--structural-only]",
  "  [--strict-warnings]",
  "  [--json]"
].join(" ");

const SUPPORTED_SCHEMA_FLAG = "--schema";

const REQUIRED_TOP_LEVEL_BLOCKS = [
  "meta",
  "screen",
  "productContext",
  "visualDirection",
  "architecture",
  "recipe",
  "layout",
  "componentMap",
  "dataDependencies",
  "states",
  "actions",
  "responsive",
  "accessibility",
  "content",
  "implementation",
  "representativeGate",
  "validation"
];

function validateTopLevelStructure(specification, collector) {
  if (!isObject(specification)) {
    collector.error(
      "SCREEN_STRUCTURE_ROOT",
      "The screen specification must be a JSON object.",
      "$"
    );

    return;
  }

  for (const block of REQUIRED_TOP_LEVEL_BLOCKS) {
    if (!(block in specification)) {
      collector.error(
        "SCREEN_STRUCTURE_BLOCK",
        `Required top-level block '${block}' is missing.`,
        `$.${block}`
      );
    }
  }

  const arrayBlocks = [
    "componentMap",
    "dataDependencies",
    "states",
    "actions"
  ];

  for (const block of arrayBlocks) {
    if (
      block in specification &&
      !Array.isArray(specification[block])
    ) {
      collector.error(
        "SCREEN_STRUCTURE_ARRAY",
        `'${block}' must be an array.`,
        `$.${block}`
      );
    }
  }
}

function validatePlaceholders(specification, collector) {
  const placeholders = findPlaceholders(specification);

  for (const placeholder of placeholders) {
    collector.error(
      "SCREEN_PLACEHOLDER",
      "Unresolved template placeholder found.",
      placeholder.path,
      placeholder.value
    );
  }
}

function validateUniqueIdentifiers(specification, collector) {
  addDuplicateIssues({
    collector,
    items: specification?.recipe?.regions,
    selector: (item) => item?.screenRegionId,
    code: "SCREEN_DUPLICATE_REGION_ID",
    label: "Screen region ID",
    location: "$.recipe.regions"
  });

  addDuplicateIssues({
    collector,
    items: specification?.componentMap,
    selector: (item) => item?.id,
    code: "SCREEN_DUPLICATE_COMPONENT_USAGE_ID",
    label: "Component usage ID",
    location: "$.componentMap"
  });

  addDuplicateIssues({
    collector,
    items: specification?.dataDependencies,
    selector: (item) => item?.id,
    code: "SCREEN_DUPLICATE_DATA_DEPENDENCY_ID",
    label: "Data dependency ID",
    location: "$.dataDependencies"
  });

  addDuplicateIssues({
    collector,
    items: specification?.states,
    selector: (item) => item?.id,
    code: "SCREEN_DUPLICATE_STATE_ID",
    label: "Screen state ID",
    location: "$.states"
  });

  addDuplicateIssues({
    collector,
    items: specification?.actions,
    selector: (item) => item?.id,
    code: "SCREEN_DUPLICATE_ACTION_ID",
    label: "Action ID",
    location: "$.actions"
  });

  addDuplicateIssues({
    collector,
    items: specification?.implementation?.sequence,
    selector: (item) => item?.id,
    code: "SCREEN_DUPLICATE_STEP_ID",
    label: "Implementation step ID",
    location: "$.implementation.sequence"
  });

  addDuplicateIssues({
    collector,
    items: specification?.implementation?.sequence,
    selector: (item) => item?.order,
    code: "SCREEN_DUPLICATE_STEP_ORDER",
    label: "Implementation step order",
    location: "$.implementation.sequence"
  });

  addDuplicateIssues({
    collector,
    items: specification?.representativeGate?.requiredChecks,
    selector: (item) => item?.id,
    code: "SCREEN_DUPLICATE_GATE_ID",
    label: "Representative gate check ID",
    location: "$.representativeGate.requiredChecks"
  });
}

function validateRepresentativeGateConsistency(
  specification,
  collector
) {
  const gate = specification?.representativeGate;

  if (!isObject(gate)) {
    return;
  }

  const checks = asArray(gate.requiredChecks);
  const failedBlockingChecks = checks.filter((check) => {
    return check?.blocking === true &&
      check?.status === "failed";
  });

  const pendingBlockingChecks = checks.filter((check) => {
    return check?.blocking === true &&
      check?.status === "pending";
  });

  if (
    gate.status === "approved" &&
    failedBlockingChecks.length > 0
  ) {
    collector.error(
      "SCREEN_GATE_APPROVED_WITH_FAILURE",
      "The representative gate is approved while a blocking check " +
      "is failed.",
      "$.representativeGate"
    );
  }

  if (
    gate.status === "approved" &&
    pendingBlockingChecks.length > 0
  ) {
    collector.error(
      "SCREEN_GATE_APPROVED_WITH_PENDING",
      "The representative gate is approved while a blocking check " +
      "is pending.",
      "$.representativeGate"
    );
  }

  if (
    gate.status === "approved" &&
    !gate?.approval?.approvedBy
  ) {
    collector.error(
      "SCREEN_GATE_APPROVER_MISSING",
      "An approved representative gate requires approvedBy.",
      "$.representativeGate.approval.approvedBy"
    );
  }

  if (
    gate.status === "approved" &&
    !gate?.approval?.approvedAt
  ) {
    collector.error(
      "SCREEN_GATE_DATE_MISSING",
      "An approved representative gate requires approvedAt.",
      "$.representativeGate.approval.approvedAt"
    );
  }

  if (
    gate.status === "ready" &&
    failedBlockingChecks.length > 0
  ) {
    collector.error(
      "SCREEN_GATE_READY_WITH_FAILURE",
      "The representative gate cannot be ready while a blocking " +
      "check is failed.",
      "$.representativeGate"
    );
  }

  if (
    specification?.meta?.status === "implemented" &&
    gate.status !== "approved" &&
    gate.status !== "not-required"
  ) {
    collector.warning(
      "SCREEN_IMPLEMENTED_WITHOUT_GATE",
      "The specification is marked implemented but the " +
      "representative gate is not approved.",
      "$.meta.status"
    );
  }
}

async function validateAgainstJsonSchema({
  specification,
  specificationPath,
  schemaPath,
  collector
}) {
  if (!schemaPath) {
    collector.error(
      "SCREEN_SCHEMA_PATH",
      "No JSON Schema path could be resolved.",
      "$.validation.schema"
    );

    return;
  }

  let schema;

  try {
    schema = (await readJsonFile(schemaPath)).value;
  } catch (error) {
    collector.error(
      "SCREEN_SCHEMA_READ",
      error.message,
      schemaPath
    );

    return;
  }

  let Ajv2020;
  let addFormats;

  try {
    ({ default: Ajv2020 } = await import("ajv/dist/2020.js"));
    ({ default: addFormats } = await import("ajv-formats"));
  } catch {
    collector.error(
      "SCREEN_SCHEMA_DEPENDENCY",
      "Full JSON Schema validation requires the development " +
      "dependencies 'ajv' and 'ajv-formats'. The validator does not " +
      "install packages automatically.",
      specificationPath,
      "Install them through the repository's approved package manager " +
      "or run with --structural-only."
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

    const validate = ajv.compile(schema);
    const valid = validate(specification);

    if (valid) {
      collector.info(
        "SCREEN_SCHEMA_VALID",
        "The specification validates against the JSON Schema.",
        specificationPath,
        schemaPath
      );

      return;
    }

    for (const error of validate.errors ?? []) {
      const location = error.instancePath
        ? `$${error.instancePath}`
        : "$";

      collector.error(
        "SCREEN_SCHEMA_INVALID",
        error.message ?? "JSON Schema validation failed.",
        location,
        {
          keyword: error.keyword,
          params: error.params,
          schemaPath: error.schemaPath
        }
      );
    }
  } catch (error) {
    collector.error(
      "SCREEN_SCHEMA_EXECUTION",
      `JSON Schema validation could not run: ${error.message}`,
      schemaPath
    );
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
      "SCREEN_JSON_READ",
      error.message,
      inputPath
    );

    collector.print(
      "Screen Specification Validation",
      { json: options.json }
    );

    setExitCode(collector, options);
    return;
  }

  const specification = specificationFile.value;

  validateTopLevelStructure(specification, collector);
  validatePlaceholders(specification, collector);
  validateUniqueIdentifiers(specification, collector);
  validateRepresentativeGateConsistency(
    specification,
    collector
  );

  if (options.structuralOnly) {
    collector.warning(
      "SCREEN_SCHEMA_SKIPPED",
      "JSON Schema validation was skipped because " +
      "--structural-only was supplied.",
      specificationFile.path
    );
  } else {
    const schemaPath = await resolveSchemaPath({
      specification,
      specificationPath: specificationFile.path,
      explicitSchemaPath: options.schema
    });

    await validateAgainstJsonSchema({
      specification,
      specificationPath: specificationFile.path,
      schemaPath,
      collector
    });
  }

  collector.print(
    "Screen Specification Validation",
    { json: options.json }
  );

  setExitCode(collector, options);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
