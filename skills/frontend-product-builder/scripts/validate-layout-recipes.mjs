#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import {
  fileURLToPath,
  pathToFileURL
} from "node:url";
import {
  createRequire
} from "node:module";
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

const EXPECTED_LAYOUT_SCHEMA_REFERENCE =
  "../schemas/layout-recipe.schema.json";

function parseArguments(argv) {
  const options = {
    root: DEFAULT_SKILL_ROOT,
    json: false,
    strictWarnings: false
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

      case "--strict-warnings":
        options.strictWarnings = true;
        break;

      default:
        throw new Error(
          `Unknown option '${argument}'.`
        );
    }
  }

  return options;
}

function createCollector() {
  const issues = [];

  return {
    issues,

    error(
      code,
      message,
      location,
      detail = null
    ) {
      issues.push({
        severity: "error",
        code,
        message,
        location,
        detail
      });
    },

    warning(
      code,
      message,
      location,
      detail = null
    ) {
      issues.push({
        severity: "warning",
        code,
        message,
        location,
        detail
      });
    },

    info(
      code,
      message,
      location,
      detail = null
    ) {
      issues.push({
        severity: "information",
        code,
        message,
        location,
        detail
      });
    }
  };
}

function relativePath(root, filePath) {
  return path
    .relative(root, filePath)
    .replaceAll("\\", "/");
}

async function pathType(targetPath) {
  try {
    const stats = await fs.stat(targetPath);

    if (stats.isDirectory()) {
      return "directory";
    }

    if (stats.isFile()) {
      return "file";
    }

    return "other";
  } catch {
    return "missing";
  }
}

async function listJsonFiles(directory) {
  if (
    await pathType(directory) !==
    "directory"
  ) {
    return [];
  }

  const entries = await fs.readdir(
    directory,
    {
      withFileTypes: true
    }
  );

  return entries
    .filter((entry) => {
      return entry.isFile() &&
        entry.name.endsWith(".json");
    })
    .map((entry) => {
      return path.join(
        directory,
        entry.name
      );
    })
    .sort();
}

async function readJson(filePath) {
  const content = await fs.readFile(
    filePath,
    "utf8"
  );

  return JSON.parse(content);
}

async function importResolvedModule(
  resolvedPath
) {
  return await import(
    pathToFileURL(resolvedPath).href
  );
}

function unwrapDefault(moduleValue) {
  return moduleValue?.default ??
    moduleValue;
}

async function resolveNodePackage({
  packageSpecifier,
  skillRoot
}) {
  const attempts = [];

  try {
    const directModule = await import(
      packageSpecifier
    );

    return {
      module: directModule,
      source: "standard ESM resolution"
    };
  } catch (error) {
    attempts.push({
      source: "standard ESM resolution",
      error: error.message
    });
  }

  const requireBases = [
    path.join(
      process.cwd(),
      "package.json"
    ),
    path.join(
      skillRoot,
      "package.json"
    ),
    path.join(
      path.dirname(skillRoot),
      "package.json"
    )
  ];

  for (const requireBase of requireBases) {
    try {
      const require = createRequire(
        requireBase
      );

      const resolvedPath = require.resolve(
        packageSpecifier
      );

      const moduleValue =
        await importResolvedModule(
          resolvedPath
        );

      return {
        module: moduleValue,
        source: resolvedPath
      };
    } catch (error) {
      attempts.push({
        source: requireBase,
        error: error.message
      });
    }
  }

  const npmRootResult = spawnSync(
    "npm",
    [
      "root",
      "-g"
    ],
    {
      encoding: "utf8",
      windowsHide: true
    }
  );

  if (
    npmRootResult.status === 0 &&
    npmRootResult.stdout.trim()
  ) {
    const globalRoot =
      npmRootResult.stdout.trim();

    const globalCandidate =
      path.join(
        globalRoot,
        packageSpecifier
      );

    try {
      const moduleValue =
        await importResolvedModule(
          globalCandidate
        );

      return {
        module: moduleValue,
        source: globalCandidate
      };
    } catch (error) {
      attempts.push({
        source: globalCandidate,
        error: error.message
      });
    }
  }

  return {
    module: null,
    source: null,
    attempts
  };
}

async function loadSchemaDependencies({
  skillRoot,
  collector
}) {
  const ajvResult =
    await resolveNodePackage({
      packageSpecifier:
        "ajv/dist/2020.js",
      skillRoot
    });

  const formatsResult =
    await resolveNodePackage({
      packageSpecifier:
        "ajv-formats",
      skillRoot
    });

  if (!ajvResult.module) {
    collector.error(
      "SCHEMA_AJV_MISSING",
      "The 'ajv' package with Draft 2020-12 support could not be resolved.",
      skillRoot,
      ajvResult.attempts
    );
  } else {
    collector.info(
      "SCHEMA_AJV_RESOLVED",
      "AJV Draft 2020-12 support was resolved.",
      ajvResult.source
    );
  }

  if (!formatsResult.module) {
    collector.error(
      "SCHEMA_FORMATS_MISSING",
      "The 'ajv-formats' package could not be resolved.",
      skillRoot,
      formatsResult.attempts
    );
  } else {
    collector.info(
      "SCHEMA_FORMATS_RESOLVED",
      "ajv-formats was resolved.",
      formatsResult.source
    );
  }

  if (
    !ajvResult.module ||
    !formatsResult.module
  ) {
    return null;
  }

  const Ajv2020 =
    unwrapDefault(ajvResult.module);

  const addFormats =
    unwrapDefault(formatsResult.module);

  if (
    typeof Ajv2020 !== "function"
  ) {
    collector.error(
      "SCHEMA_AJV_EXPORT_INVALID",
      "The resolved AJV module does not export a constructor.",
      ajvResult.source
    );

    return null;
  }

  if (
    typeof addFormats !== "function"
  ) {
    collector.error(
      "SCHEMA_FORMATS_EXPORT_INVALID",
      "The resolved ajv-formats module does not export a function.",
      formatsResult.source
    );

    return null;
  }

  return {
    Ajv2020,
    addFormats
  };
}

function createAjv({
  Ajv2020,
  addFormats
}) {
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

async function compileSchemas({
  skillRoot,
  schemaFiles,
  dependencies,
  collector
}) {
  const compiledSchemas = new Map();
  const parsedSchemas = new Map();

  for (const schemaFile of schemaFiles) {
    const relative = relativePath(
      skillRoot,
      schemaFile
    );

    let schema;

    try {
      schema = await readJson(
        schemaFile
      );

      parsedSchemas.set(
        relative,
        schema
      );
    } catch (error) {
      collector.error(
        "SCHEMA_JSON_INVALID",
        `Schema JSON could not be parsed: ${error.message}`,
        relative
      );

      continue;
    }

    try {
      const ajv = createAjv(
        dependencies
      );

      const validate = ajv.compile(
        schema
      );

      compiledSchemas.set(
        relative,
        {
          schema,
          validate
        }
      );

      collector.info(
        "SCHEMA_COMPILED",
        "JSON Schema compiled successfully.",
        relative,
        {
          id: schema.$id ?? null,
          draft: schema.$schema ?? null
        }
      );
    } catch (error) {
      collector.error(
        "SCHEMA_COMPILE_FAILED",
        `JSON Schema compilation failed: ${error.message}`,
        relative,
        {
          id: schema?.$id ?? null,
          draft: schema?.$schema ?? null,
          stack: error.stack ?? null
        }
      );
    }
  }

  return {
    parsedSchemas,
    compiledSchemas
  };
}

function getRecipeIdentifier(
  recipe,
  relative
) {
  return (
    recipe?.meta?.id ??
    recipe?.id ??
    recipe?.name ??
    relative
  );
}

function collectValidationChecks(recipe) {
  if (
    Array.isArray(
      recipe?.validation
    )
  ) {
    return recipe.validation;
  }

  if (
    Array.isArray(
      recipe?.validation?.checks
    )
  ) {
    return recipe.validation.checks;
  }

  return [];
}

function addDuplicateIssues({
  values,
  label,
  code,
  location,
  collector
}) {
  const seen = new Set();

  values.forEach((value, index) => {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return;
    }

    const normalized =
      String(value);

    if (seen.has(normalized)) {
      collector.error(
        code,
        `${label} '${normalized}' is duplicated.`,
        `${location}[${index}]`
      );

      return;
    }

    seen.add(normalized);
  });
}

function validateRecipeLocalIdentifiers({
  recipe,
  relative,
  collector
}) {
  addDuplicateIssues({
    values: Array.isArray(recipe?.regions)
      ? recipe.regions.map(
        (region) => region?.id
      )
      : [],
    label: "Region ID",
    code: "RECIPE_REGION_ID_DUPLICATE",
    location: `${relative}#regions`,
    collector
  });

  const checks =
    collectValidationChecks(recipe);

  addDuplicateIssues({
    values: checks.map(
      (check) => check?.id
    ),
    label: "Validation check ID",
    code: "RECIPE_VALIDATION_ID_DUPLICATE",
    location: `${relative}#validation`,
    collector
  });
}

async function validateRecipes({
  skillRoot,
  recipeFiles,
  layoutSchema,
  dependencies,
  collector
}) {
  let validate;

  try {
    const ajv = createAjv(
      dependencies
    );

    validate = ajv.compile(
      layoutSchema
    );
  } catch (error) {
    collector.error(
      "RECIPE_SCHEMA_COMPILE_FAILED",
      `The layout recipe schema could not be compiled: ${error.message}`,
      "assets/schemas/layout-recipe.schema.json",
      error.stack ?? null
    );

    return {
      validRecipes: 0,
      invalidRecipes: recipeFiles.length
    };
  }

  const recipeIds = new Map();
  const recipeSummaries = [];

  let validRecipes = 0;
  let invalidRecipes = 0;

  for (const recipeFile of recipeFiles) {
    const relative = relativePath(
      skillRoot,
      recipeFile
    );

    let recipe;

    try {
      recipe = await readJson(
        recipeFile
      );
    } catch (error) {
      collector.error(
        "RECIPE_JSON_INVALID",
        `Recipe JSON could not be parsed: ${error.message}`,
        relative
      );

      invalidRecipes += 1;
      continue;
    }

    const recipeId =
      getRecipeIdentifier(
        recipe,
        relative
      );

    if (recipeIds.has(recipeId)) {
      collector.error(
        "RECIPE_ID_DUPLICATE",
        `Recipe ID '${recipeId}' is duplicated.`,
        relative,
        {
          first:
            recipeIds.get(recipeId),
          duplicate:
            relative
        }
      );
    } else {
      recipeIds.set(
        recipeId,
        relative
      );
    }

    if (
      recipe.$schema !==
      EXPECTED_LAYOUT_SCHEMA_REFERENCE
    ) {
      collector.error(
        "RECIPE_SCHEMA_REFERENCE_INVALID",
        "Recipe $schema must use the portable relative layout-schema path.",
        `${relative}#$schema`,
        {
          expected:
            EXPECTED_LAYOUT_SCHEMA_REFERENCE,
          actual:
            recipe.$schema ?? null
        }
      );
    }

    validateRecipeLocalIdentifiers({
      recipe,
      relative,
      collector
    });

    recipeSummaries.push({
      recipeId,
      relative,
      category: recipe?.meta?.category ?? null,
      derivedFrom: recipe?.meta?.derivedFrom ?? null,
      regionIds: regionIdSet(recipe)
    });

    const valid = validate(
      recipe
    );

    if (!valid) {
      invalidRecipes += 1;

      for (
        const error of
        validate.errors ?? []
      ) {
        collector.error(
          "RECIPE_SCHEMA_VALIDATION_FAILED",
          error.message ??
            "Recipe validation failed.",
          `${relative}${error.instancePath || "#"}`,
          {
            recipeId,
            keyword: error.keyword,
            params: error.params,
            schemaPath: error.schemaPath,
            data:
              error.data === undefined
                ? null
                : error.data
          }
        );
      }

      continue;
    }

    validRecipes += 1;

    collector.info(
      "RECIPE_SCHEMA_VALID",
      "Recipe validates against layout-recipe.schema.json.",
      relative,
      {
        recipeId
      }
    );
  }

  validateRecipeDerivation({
    recipeSummaries,
    collector
  });

  return {
    validRecipes,
    invalidRecipes
  };
}

function regionIdSet(recipe) {
  return new Set(
    Array.isArray(recipe?.regions)
      ? recipe.regions
        .map((region) => region?.id)
        .filter((id) => typeof id === "string" && id.length > 0)
      : []
  );
}

function validateRecipeDerivation({
  recipeSummaries,
  collector
}) {
  for (let i = 0; i < recipeSummaries.length; i += 1) {
    for (let j = i + 1; j < recipeSummaries.length; j += 1) {
      const left = recipeSummaries[i];
      const right = recipeSummaries[j];

      if (left.recipeId === right.recipeId) {
        continue;
      }

      const union = new Set([
        ...left.regionIds,
        ...right.regionIds
      ]);

      if (union.size === 0) {
        continue;
      }

      let shared = 0;

      for (const id of left.regionIds) {
        if (right.regionIds.has(id)) {
          shared += 1;
        }
      }

      const overlapRatio = shared / union.size;
      const sameCategory =
        left.category !== null &&
        left.category === right.category;
      const declaredDerivation =
        left.derivedFrom === right.recipeId ||
        right.derivedFrom === left.recipeId;

      if (
        (overlapRatio > 0.8 || sameCategory) &&
        !declaredDerivation
      ) {
        collector.error(
          "RECIPE_UNDECLARED_DUPLICATE_CONTENT",
          `Recipes '${left.recipeId}' and '${right.recipeId}' share ${Math.round(overlapRatio * 100)}% of region IDs${sameCategory ? " and the same meta.category" : ""} but neither declares meta.derivedFrom naming the other. A recipe's content must match its own id/purpose; copying another recipe's regions requires an explicit, justified meta.derivedFrom.`,
          `${left.relative} <-> ${right.relative}`,
          {
            left: left.recipeId,
            right: right.recipeId,
            overlapRatio,
            sharedRegionIds: [...left.regionIds].filter((id) =>
              right.regionIds.has(id)
            )
          }
        );
      }
    }
  }
}

function summarize(issues) {
  const summary = {
    errors: 0,
    warnings: 0,
    information: 0,
    total: issues.length
  };

  for (const issue of issues) {
    switch (issue.severity) {
      case "error":
        summary.errors += 1;
        break;

      case "warning":
        summary.warnings += 1;
        break;

      default:
        summary.information += 1;
        break;
    }
  }

  return summary;
}

function printTextReport(report) {
  process.stdout.write(
    "Frontend Product Builder — Schema and Recipe Validation\n"
  );

  process.stdout.write(
    "=======================================================\n"
  );

  process.stdout.write(
    `Skill root: ${report.meta.skillRoot}\n`
  );

  process.stdout.write(
    `Schemas discovered: ${report.metrics.schemasDiscovered}\n`
  );

  process.stdout.write(
    `Schemas compiled: ${report.metrics.schemasCompiled}\n`
  );

  process.stdout.write(
    `Recipes discovered: ${report.metrics.recipesDiscovered}\n`
  );

  process.stdout.write(
    `Recipes valid: ${report.metrics.recipesValid}\n`
  );

  process.stdout.write(
    `Recipes invalid: ${report.metrics.recipesInvalid}\n\n`
  );

  const visibleIssues =
    report.issues.filter((issue) => {
      return issue.severity !==
        "information";
    });

  if (visibleIssues.length === 0) {
    process.stdout.write(
      "No errors or warnings were found.\n\n"
    );
  } else {
    for (const issue of visibleIssues) {
      process.stdout.write(
        `[${issue.severity.toUpperCase()}] ` +
        `${issue.code}\n`
      );

      process.stdout.write(
        `Location: ${issue.location}\n`
      );

      process.stdout.write(
        `${issue.message}\n`
      );

      if (issue.detail !== null) {
        process.stdout.write(
          `${JSON.stringify(issue.detail, null, 2)}\n`
        );
      }

      process.stdout.write("\n");
    }
  }

  process.stdout.write(
    "Summary\n"
  );

  process.stdout.write(
    "-------\n"
  );

  process.stdout.write(
    `Errors: ${report.summary.errors}\n`
  );

  process.stdout.write(
    `Warnings: ${report.summary.warnings}\n`
  );

  process.stdout.write(
    `Information: ${report.summary.information}\n`
  );

  process.stdout.write(
    `Total: ${report.summary.total}\n`
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

    process.exitCode = 1;
    return;
  }

  const collector = createCollector();
  const skillRoot = options.root;

  const schemaDirectory = path.join(
    skillRoot,
    "assets",
    "schemas"
  );

  const recipeDirectory = path.join(
    skillRoot,
    "assets",
    "recipes"
  );

  if (
    await pathType(skillRoot) !==
    "directory"
  ) {
    collector.error(
      "VALIDATION_SKILL_ROOT_INVALID",
      "The skill root does not exist or is not a directory.",
      skillRoot
    );
  }

  if (
    await pathType(schemaDirectory) !==
    "directory"
  ) {
    collector.error(
      "VALIDATION_SCHEMA_DIRECTORY_MISSING",
      "The schema directory is missing.",
      schemaDirectory
    );
  }

  if (
    await pathType(recipeDirectory) !==
    "directory"
  ) {
    collector.error(
      "VALIDATION_RECIPE_DIRECTORY_MISSING",
      "The recipe directory is missing.",
      recipeDirectory
    );
  }

  const schemaFiles =
    await listJsonFiles(
      schemaDirectory
    );

  const recipeFiles = (
    await listJsonFiles(
      recipeDirectory
    )
  ).filter((filePath) => {
    return filePath.endsWith(
      ".recipe.json"
    );
  });

  const dependencies =
    await loadSchemaDependencies({
      skillRoot,
      collector
    });

  let schemasCompiled = 0;
  let recipesValid = 0;
  let recipesInvalid =
    recipeFiles.length;

  if (dependencies) {
    const {
      parsedSchemas,
      compiledSchemas
    } = await compileSchemas({
      skillRoot,
      schemaFiles,
      dependencies,
      collector
    });

    schemasCompiled =
      compiledSchemas.size;

    const layoutSchemaRelative =
      "assets/schemas/layout-recipe.schema.json";

    const layoutSchema =
      parsedSchemas.get(
        layoutSchemaRelative
      );

    if (!layoutSchema) {
      collector.error(
        "RECIPE_LAYOUT_SCHEMA_MISSING",
        "layout-recipe.schema.json could not be loaded.",
        layoutSchemaRelative
      );
    } else {
      const recipeResult =
        await validateRecipes({
          skillRoot,
          recipeFiles,
          layoutSchema,
          dependencies,
          collector
        });

      recipesValid =
        recipeResult.validRecipes;

      recipesInvalid =
        recipeResult.invalidRecipes;
    }
  }

  const summary = summarize(
    collector.issues
  );

  const report = {
    meta: {
      skillRoot,
      generatedAt:
        new Date().toISOString(),
      strictWarnings:
        options.strictWarnings
    },
    metrics: {
      schemasDiscovered:
        schemaFiles.length,
      schemasCompiled,
      recipesDiscovered:
        recipeFiles.length,
      recipesValid,
      recipesInvalid
    },
    summary,
    issues: collector.issues
  };

  if (options.json) {
    process.stdout.write(
      `${JSON.stringify(report, null, 2)}\n`
    );
  } else {
    printTextReport(report);
  }

  process.exitCode = (
    summary.errors > 0 ||
    (
      options.strictWarnings &&
      summary.warnings > 0
    )
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