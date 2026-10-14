#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import {
  fileURLToPath
} from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const SCRIPT_DIRECTORY = path.dirname(
  fileURLToPath(import.meta.url)
);

const DEFAULT_SKILL_ROOT = path.resolve(
  SCRIPT_DIRECTORY,
  ".."
);

const CONTRACTS = [
  {
    id: "styling-authority",
    schema:
      "assets/schemas/styling-authority.schema.json",
    source:
      "assets/templates/styling-authority.template.json"
  },
  {
    id: "design-system",
    schema:
      "assets/schemas/design-system.schema.json",
    source:
      "assets/templates/design-system.template.json"
  },
  {
    id: "screen-specification",
    schema:
      "assets/schemas/screen-specification.schema.json",
    source:
      "assets/templates/screen-specification.template.json"
  },
  {
    id: "small-slice-manifest",
    schema:
      "assets/schemas/small-slice-manifest.schema.json",
    source:
      "assets/templates/small-slice-manifest.template.json"
  },
  {
    id: "composition-proof",
    schema:
      "assets/schemas/composition-proof.schema.json",
    source:
      "assets/templates/composition-proof.template.json"
  },
  {
    id: "visual-composition-evidence",
    schema:
      "assets/schemas/visual-composition-evidence.schema.json",
    source:
      "assets/templates/visual-composition-evidence.template.json"
  },
  {
    id: "visual-quality-scorecard",
    schema:
      "assets/schemas/visual-quality-scorecard.schema.json",
    source:
      "assets/templates/visual-quality-scorecard.template.json"
  },
  {
    id: "layout-recipe",
    schema:
      "assets/schemas/layout-recipe.schema.json",
    source:
      "assets/recipes/dashboard.recipe.json"
  },
  {
    id: "component-catalog",
    schema:
      "assets/schemas/component-catalog.schema.json",
    source:
      "assets/catalog/foundational-components.json"
  }
];

const PLACEHOLDER_VALUES = new Map([
  [
    "YYYY-MM-DD",
    "2026-01-01"
  ],
  [
    "ISO-8601 baseline timestamp",
    "2026-01-01T12:00:00Z"
  ],
  [
    "screen-id",
    "example-screen"
  ],
  [
    "recipe-id",
    "dashboard"
  ],
  [
    "rejected-recipe-id",
    "searchable-list"
  ],
  [
    "recipeRegionId",
    "mainRegion"
  ],
  [
    "screenRegionId",
    "mainRegion"
  ],
  [
    "component-usage-id",
    "primary-component"
  ],
  [
    "dependency-id",
    "primary-dependency"
  ],
  [
    "action-id",
    "primary-action"
  ],
  [
    "step-id",
    "first-step"
  ],
  [
    "slice-id",
    "representative-slice"
  ],
  [
    "primary-fixture-id",
    "primary-fixture"
  ],
  [
    "non-success-fixture-id",
    "non-success-fixture"
  ],
  [
    "non-success-state-id",
    "error-state"
  ],
  [
    "interaction-id",
    "primary-interaction"
  ],
  [
    "64 lowercase hex sha256",
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  ],
  [
    "ISO-8601 timestamp",
    "2026-01-01T12:00:00Z"
  ],
  [
    "project-browser-runner-or-manual-capture",
    "project-browser-runner"
  ],
  [
    "real-content-source",
    "approved-feature-content"
  ]
]);

function parseArguments(argv) {
  const options = {
    root: DEFAULT_SKILL_ROOT,
    json: false
  };

  for (
    let index = 0;
    index < argv.length;
    index += 1
  ) {
    const argument = argv[index];

    if (argument === "--root") {
      const value = argv[index + 1];

      if (!value) {
        throw new Error(
          "--root requires a directory path."
        );
      }

      options.root = path.resolve(value);
      index += 1;
      continue;
    }

    if (argument === "--json") {
      options.json = true;
      continue;
    }

    throw new Error(
      `Unknown option '${argument}'.`
    );
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

function fallbackPlaceholderValue(
  placeholder
) {
  const normalized = placeholder
    .trim()
    .replace(
      /([a-z0-9])([A-Z])/g,
      "$1-$2"
    )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      ""
    );

  return normalized ||
    "example-value";
}

function materializeString(value) {
  return value.replace(
    /<([^<>]+)>/g,
    (
      _match,
      rawPlaceholder
    ) => {
      const placeholder =
        rawPlaceholder.trim();

      if (
        PLACEHOLDER_VALUES.has(
          placeholder
        )
      ) {
        return PLACEHOLDER_VALUES.get(
          placeholder
        );
      }

      if (placeholder.includes("|")) {
        return (
          placeholder
            .split("|")[0]
            .trim() ||
          "example-value"
        );
      }

      return fallbackPlaceholderValue(
        placeholder
      );
    }
  );
}

function materialize(value) {
  if (typeof value === "string") {
    return materializeString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => {
      return materialize(item);
    });
  }

  if (!isObject(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(
      ([key, item]) => {
        return [
          key,
          materialize(item)
        ];
      }
    )
  );
}

async function readJson(filePath) {
  const content = await fs.readFile(
    filePath,
    "utf8"
  );

  return JSON.parse(content);
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
      value,
      null,
      2
    )}\n`,
    "utf8"
  );
}

function createAjv() {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
    allowUnionTypes: true,
    validateFormats: true,
    verbose: true
  });

  addFormats(ajv);

  return ajv;
}

function chooseRequiredField(
  schema,
  document
) {
  const required =
    Array.isArray(schema?.required)
      ? schema.required
      : [];

  const field = required.find(
    (candidate) => {
      return (
        candidate !== "$schema" &&
        Object.hasOwn(
          document,
          candidate
        )
      );
    }
  );

  if (!field) {
    throw new Error(
      "No deletable root-level required property was found."
    );
  }

  return field;
}

function printReport(report) {
  process.stdout.write(
    "Frontend Product Builder — Contract Fixture Validation\n"
  );

  process.stdout.write(
    "======================================================\n"
  );

  process.stdout.write(
    `Skill root: ${report.meta.skillRoot}\n`
  );

  process.stdout.write(
    `Fixture root: ${report.meta.fixtureRoot}\n`
  );

  process.stdout.write(
    `Schemas compiled: ${report.metrics.schemasCompiled}\n`
  );

  process.stdout.write(
    `Fixtures generated: ${report.metrics.fixturesGenerated}\n`
  );

  process.stdout.write(
    `Expected-valid passed: ${report.metrics.expectedValidPassed}\n`
  );

  process.stdout.write(
    `Expected-invalid rejected: ${report.metrics.expectedInvalidRejected}\n`
  );

  process.stdout.write(
    `Expectation mismatches: ${report.metrics.expectationMismatches}\n\n`
  );

  const failed =
    report.results.filter(
      (result) => !result.passed
    );

  if (failed.length === 0) {
    process.stdout.write(
      "All positive and negative fixtures behaved as expected.\n\n"
    );
  } else {
    for (const result of failed) {
      process.stdout.write(
        "[ERROR] FIXTURE_EXPECTATION_MISMATCH\n"
      );

      process.stdout.write(
        `Fixture: ${result.id}\n`
      );

      process.stdout.write(
        `File: ${result.file}\n`
      );

      process.stdout.write(
        `Expected valid: ${result.expectedValid}\n`
      );

      process.stdout.write(
        `Actual valid: ${result.actualValid}\n`
      );

      process.stdout.write(
        `${JSON.stringify(
          result.errors,
          null,
          2
        )}\n\n`
      );
    }
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

  const fixtureRoot = path.join(
    skillRoot,
    "evals/files/contracts"
  );

  const rootStats = await fs
    .stat(skillRoot)
    .catch(() => null);

  if (!rootStats?.isDirectory()) {
    throw new Error(
      "Skill root does not exist " +
      `or is not a directory: ${skillRoot}`
    );
  }

  await fs.rm(
    fixtureRoot,
    {
      recursive: true,
      force: true
    }
  );

  const manifest = {
    version: 1,
    generatedAt:
      new Date().toISOString(),
    fixtureRoot:
      "evals/files/contracts",
    fixtures: []
  };

  const results = [];

  let schemasCompiled = 0;

  for (const contract of CONTRACTS) {
    const schema = await readJson(
      path.join(
        skillRoot,
        contract.schema
      )
    );

    const source = await readJson(
      path.join(
        skillRoot,
        contract.source
      )
    );

    const validDocument =
      materialize(source);

    const invalidDocument =
      structuredClone(
        validDocument
      );

    const deletedRequiredField =
      chooseRequiredField(
        schema,
        invalidDocument
      );

    delete invalidDocument[
      deletedRequiredField
    ];

    const validFile =
      path.posix.join(
        "evals/files/contracts/valid",
        `${contract.id}.valid.json`
      );

    const invalidFile =
      path.posix.join(
        "evals/files/contracts/invalid",
        `${contract.id}.invalid-missing-required.json`
      );

    await writeJson(
      path.join(
        skillRoot,
        validFile
      ),
      validDocument
    );

    await writeJson(
      path.join(
        skillRoot,
        invalidFile
      ),
      invalidDocument
    );

    const validate =
      createAjv().compile(schema);

    schemasCompiled += 1;

    const cases = [
      {
        id:
          `${contract.id}-valid`,
        file:
          validFile,
        document:
          validDocument,
        expectedValid:
          true,
        mutation:
          null
      },
      {
        id:
          `${contract.id}` +
          "-invalid-missing-required",
        file:
          invalidFile,
        document:
          invalidDocument,
        expectedValid:
          false,
        mutation: {
          type:
            "delete-root-required-property",
          deletedRequiredField
        }
      }
    ];

    for (const fixture of cases) {
      const actualValid =
        Boolean(
          validate(
            fixture.document
          )
        );

      const errors =
        structuredClone(
          validate.errors ?? []
        );

      let passed =
        actualValid ===
        fixture.expectedValid;

      if (
        passed &&
        !fixture.expectedValid
      ) {
        passed = errors.some(
          (error) => {
            return (
              error.keyword ===
                "required" &&
              error.params
                ?.missingProperty ===
                deletedRequiredField
            );
          }
        );
      }

      manifest.fixtures.push({
        id:
          fixture.id,
        contractId:
          contract.id,
        schema:
          contract.schema,
        source:
          contract.source,
        file:
          fixture.file,
        expectedValid:
          fixture.expectedValid,
        mutation:
          fixture.mutation
      });

      results.push({
        id:
          fixture.id,
        contractId:
          contract.id,
        schema:
          contract.schema,
        file:
          fixture.file,
        expectedValid:
          fixture.expectedValid,
        actualValid,
        passed,
        mutation:
          fixture.mutation,
        errors
      });
    }
  }

  await writeJson(
    path.join(
      fixtureRoot,
      "fixture-manifest.json"
    ),
    manifest
  );

  const report = {
    meta: {
      skillRoot,
      fixtureRoot,
      generatedAt:
        new Date().toISOString()
    },

    metrics: {
      schemasCompiled,

      fixturesGenerated:
        results.length,

      expectedValidPassed:
        results.filter(
          (result) => {
            return (
              result.expectedValid &&
              result.passed
            );
          }
        ).length,

      expectedInvalidRejected:
        results.filter(
          (result) => {
            return (
              !result.expectedValid &&
              result.passed
            );
          }
        ).length,

      expectationMismatches:
        results.filter(
          (result) => {
            return !result.passed;
          }
        ).length
    },

    results
  };

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
    report.metrics
      .expectationMismatches > 0
  )
    ? 1
    : 0;
}

main().catch((error) => {
  process.stderr.write(
    `${error.stack ?? error.message}\n`
  );

  process.exitCode = 1;
});
