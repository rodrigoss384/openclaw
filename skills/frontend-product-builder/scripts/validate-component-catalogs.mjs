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

const EXPECTED_SCHEMA_REFERENCE =
  "../schemas/component-catalog.schema.json";

const VALIDATION_ID_PATTERN =
  /^[A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-[0-9]{3}$/;

const COMPONENT_IDENTIFIER_PATTERN =
  /^[A-Z][A-Za-z0-9]*$/;

const DEPENDENCY_KEYS = new Set([
  "dependencies",
  "componentdependencies",
  "requiredcomponents",
  "supportingcomponents",
  "foundationcomponents",
  "composedof",
  "usescomponents",
  "componentrefs",
  "componentreferences",
  "primitives"
]);

const DEPENDENCY_OBJECT_KEYS = new Set([
  "component",
  "componentid",
  "name",
  "id",
  "ref"
]);

const EXTERNAL_IDENTIFIERS = new Set([
  "React",
  "ReactDOM",
  "DOM",
  "HTML",
  "CSS",
  "JavaScript",
  "TypeScript",
  "Intl",
  "URL",
  "URLSearchParams",
  "AbortController",
  "ResizeObserver",
  "IntersectionObserver",
  "Label",
  "RadioGroup",
  "RadioGroupItem",
  "Popover",
  "Calendar",
  "Text",
  "Progress",
  "Portal",
  "TooltipProvider",
  "GlobalHeader"
]);

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

async function readJson(filePath) {
  const content = await fs.readFile(
    filePath,
    "utf8"
  );

  return JSON.parse(content);
}

async function listCatalogFiles(directory) {
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

function relativePath(root, filePath) {
  return path
    .relative(root, filePath)
    .replaceAll("\\", "/");
}

function normalizeKey(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function isObject(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function getComponentEntries(
  catalog,
  relative,
  collector
) {
  const components = catalog?.components;

  if (isObject(components)) {
    return Object.entries(components).map(
      ([key, component]) => {
        return {
          canonicalName: key,
          component,
          location:
            `${relative}#components.${key}`
        };
      }
    );
  }

  if (Array.isArray(components)) {
    collector.warning(
      "CATALOG_COMPONENT_ARRAY",
      "The catalog uses an array for components. " +
      "The schema is expected to determine whether this is supported.",
      `${relative}#components`
    );

    return components.map(
      (component, index) => {
        const canonicalName =
          component?.id ??
          component?.name ??
          `component-${index}`;

        return {
          canonicalName,
          component,
          location:
            `${relative}#components[${index}]`
        };
      }
    );
  }

  collector.error(
    "CATALOG_COMPONENTS_INVALID",
    "The catalog does not contain a usable components collection.",
    `${relative}#components`
  );

  return [];
}

function collectAliases(
  canonicalName,
  component
) {
  const candidates = [
    canonicalName,
    component?.id,
    component?.name,
    component?.meta?.id,
    component?.meta?.name
  ];

  return [
    ...new Set(
      candidates.filter((candidate) => {
        return (
          typeof candidate === "string" &&
          COMPONENT_IDENTIFIER_PATTERN.test(
            candidate
          )
        );
      })
    )
  ];
}

function collectValidationIds(
  value,
  location,
  results
) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectValidationIds(
        item,
        `${location}[${index}]`,
        results
      );
    });

    return;
  }

  if (!isObject(value)) {
    return;
  }

  for (const [key, item] of Object.entries(value)) {
    const itemLocation =
      `${location}.${key}`;

    if (
      key === "id" &&
      typeof item === "string" &&
      VALIDATION_ID_PATTERN.test(item)
    ) {
      results.push({
        id: item,
        location: itemLocation
      });
    }

    collectValidationIds(
      item,
      itemLocation,
      results
    );
  }
}

function collectDependencyStrings(
  value,
  location,
  results
) {
  if (typeof value === "string") {
    if (
      COMPONENT_IDENTIFIER_PATTERN.test(value)
    ) {
      results.push({
        reference: value,
        location
      });
    }

    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectDependencyStrings(
        item,
        `${location}[${index}]`,
        results
      );
    });

    return;
  }

  if (!isObject(value)) {
    return;
  }

  let explicitReferenceFound = false;

  for (const [key, item] of Object.entries(value)) {
    const normalizedKey =
      normalizeKey(key);

    if (
      DEPENDENCY_OBJECT_KEYS.has(
        normalizedKey
      ) &&
      typeof item === "string" &&
      COMPONENT_IDENTIFIER_PATTERN.test(item)
    ) {
      results.push({
        reference: item,
        location:
          `${location}.${key}`
      });

      explicitReferenceFound = true;
    }
  }

  if (explicitReferenceFound) {
    return;
  }

  for (const [key, item] of Object.entries(value)) {
    collectDependencyStrings(
      item,
      `${location}.${key}`,
      results
    );
  }
}

function collectComponentDependencies(
  component,
  location
) {
  const results = [];

  function visit(value, currentLocation) {
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        visit(
          item,
          `${currentLocation}[${index}]`
        );
      });

      return;
    }

    if (!isObject(value)) {
      return;
    }

    for (const [key, item] of Object.entries(value)) {
      const itemLocation =
        `${currentLocation}.${key}`;

      if (
        DEPENDENCY_KEYS.has(
          normalizeKey(key)
        )
      ) {
        collectDependencyStrings(
          item,
          itemLocation,
          results
        );

        continue;
      }

      visit(
        item,
        itemLocation
      );
    }
  }

  visit(component, location);

  const unique = new Map();

  for (const result of results) {
    const uniqueKey =
      `${result.reference}::${result.location}`;

    unique.set(uniqueKey, result);
  }

  return [
    ...unique.values()
  ];
}

function collectStrings(
  value,
  location = "$",
  results = []
) {
  if (typeof value === "string") {
    results.push({
      value,
      location
    });

    return results;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectStrings(
        item,
        `${location}[${index}]`,
        results
      );
    });

    return results;
  }

  if (isObject(value)) {
    for (const [key, item] of Object.entries(value)) {
      collectStrings(
        item,
        `${location}.${key}`,
        results
      );
    }
  }

  return results;
}

function validateCatalogTemplateCoverage({
  skillRoot,
  catalogFiles,
  template,
  collector
}) {
  const templateStrings =
    collectStrings(template);

  const references = templateStrings
    .filter((item) => {
      const normalized =
        item.value.replaceAll("\\", "/");

      return (
        normalized.endsWith(".json") &&
        (
          normalized.includes(
            "/catalog/"
          ) ||
          normalized.startsWith(
            "assets/catalog/"
          ) ||
          normalized.startsWith(
            "../catalog/"
          )
        )
      );
    })
    .map((item) => {
      return {
        basename:
          path.posix.basename(
            item.value.replaceAll("\\", "/")
          ),
        value: item.value,
        location: item.location
      };
    });

  if (references.length === 0) {
    collector.error(
      "CATALOG_TEMPLATE_NO_SOURCES",
      "component-catalog.template.json does not reference any catalog files.",
      "assets/templates/component-catalog.template.json"
    );

    return;
  }

  const discoveredBasenames = new Set(
    catalogFiles.map((filePath) => {
      return path.basename(filePath);
    })
  );

  const referenceCounts = new Map();

  for (const reference of references) {
    referenceCounts.set(
      reference.basename,
      (
        referenceCounts.get(
          reference.basename
        ) ?? 0
      ) + 1
    );

    if (
      !discoveredBasenames.has(
        reference.basename
      )
    ) {
      collector.error(
        "CATALOG_TEMPLATE_SOURCE_UNKNOWN",
        `The template references unknown catalog ` +
        `'${reference.basename}'.`,
        reference.location,
        reference.value
      );
    }
  }

  for (const basename of discoveredBasenames) {
    const count =
      referenceCounts.get(basename) ?? 0;

    if (count === 0) {
      collector.error(
        "CATALOG_TEMPLATE_SOURCE_MISSING",
        `Catalog '${basename}' is not referenced by ` +
        "component-catalog.template.json.",
        "assets/templates/component-catalog.template.json"
      );

      continue;
    }

    if (count > 1) {
      collector.error(
        "CATALOG_TEMPLATE_SOURCE_DUPLICATE",
        `Catalog '${basename}' is referenced ${count} times by ` +
        "component-catalog.template.json.",
        "assets/templates/component-catalog.template.json"
      );
    }
  }

  collector.info(
    "CATALOG_TEMPLATE_COVERAGE",
    "Component catalog template source coverage was checked.",
    relativePath(
      skillRoot,
      path.join(
        skillRoot,
        "assets/templates/component-catalog.template.json"
      )
    ),
    {
      catalogs:
        discoveredBasenames.size,
      references:
        references.length
    }
  );
}

function resolveDependencyGraph({
  components,
  aliases,
  dependencyReferences,
  collector
}) {
  const graph = new Map();

  for (const componentName of components.keys()) {
    graph.set(
      componentName,
      new Set()
    );
  }

  let unresolvedCount = 0;
  let resolvedCount = 0;

  for (const item of dependencyReferences) {
    const {
      owner,
      reference,
      location
    } = item;

    if (
      EXTERNAL_IDENTIFIERS.has(
        reference
      )
    ) {
      collector.info(
        "CATALOG_DEPENDENCY_EXTERNAL",
        `External dependency '${reference}' was ignored.`,
        location,
        {
          owner
        }
      );

      continue;
    }

    const target =
      aliases.get(reference);

    if (!target) {
      unresolvedCount += 1;

      collector.error(
        "CATALOG_DEPENDENCY_UNRESOLVED",
        `Component '${owner}' references unresolved component ` +
        `'${reference}'.`,
        location
      );

      continue;
    }

    if (target === owner) {
      collector.error(
        "CATALOG_COMPONENT_SELF_DEPENDENCY",
        `Component '${owner}' depends on itself.`,
        location
      );

      continue;
    }

    graph.get(owner)?.add(target);
    resolvedCount += 1;
  }

  return {
    graph,
    unresolvedCount,
    resolvedCount
  };
}

function detectCycles(
  graph,
  collector
) {
  const visited = new Set();
  const active = new Set();
  const stack = [];
  const cycleKeys = new Set();

  function visit(componentName) {
    if (active.has(componentName)) {
      const startIndex =
        stack.indexOf(componentName);

      const cycle = [
        ...stack.slice(startIndex),
        componentName
      ];

      const cycleKey =
        cycle.join(" -> ");

      if (!cycleKeys.has(cycleKey)) {
        cycleKeys.add(cycleKey);

        collector.warning(
          "CATALOG_DEPENDENCY_CYCLE",
          "A component dependency cycle was detected.",
          componentName,
          cycle
        );
      }

      return;
    }

    if (visited.has(componentName)) {
      return;
    }

    visited.add(componentName);
    active.add(componentName);
    stack.push(componentName);

    for (
      const dependency of
      graph.get(componentName) ?? []
    ) {
      visit(dependency);
    }

    stack.pop();
    active.delete(componentName);
  }

  for (const componentName of graph.keys()) {
    visit(componentName);
  }

  return cycleKeys.size;
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
    "Frontend Product Builder — Component Catalog Validation\n"
  );

  process.stdout.write(
    "=======================================================\n"
  );

  process.stdout.write(
    `Skill root: ${report.meta.skillRoot}\n`
  );

  process.stdout.write(
    `Catalogs discovered: ${report.metrics.catalogsDiscovered}\n`
  );

  process.stdout.write(
    `Catalogs valid: ${report.metrics.catalogsValid}\n`
  );

  process.stdout.write(
    `Catalogs invalid: ${report.metrics.catalogsInvalid}\n`
  );

  process.stdout.write(
    `Components discovered: ${report.metrics.componentsDiscovered}\n`
  );

  process.stdout.write(
    `Validation IDs: ${report.metrics.validationIds}\n`
  );

  process.stdout.write(
    `Dependencies resolved: ${report.metrics.dependenciesResolved}\n`
  );

  process.stdout.write(
    `Dependencies unresolved: ${report.metrics.dependenciesUnresolved}\n`
  );

  process.stdout.write(
    `Dependency cycles: ${report.metrics.dependencyCycles}\n\n`
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

  const schemaPath = path.join(
    skillRoot,
    "assets/schemas/component-catalog.schema.json"
  );

  const catalogDirectory = path.join(
    skillRoot,
    "assets/catalog"
  );

  const templatePath = path.join(
    skillRoot,
    "assets/templates/component-catalog.template.json"
  );

  for (const requiredPath of [
    schemaPath,
    catalogDirectory,
    templatePath
  ]) {
    if (
      await pathType(requiredPath) ===
      "missing"
    ) {
      collector.error(
        "CATALOG_REQUIRED_PATH_MISSING",
        "A required catalog validation path is missing.",
        requiredPath
      );
    }
  }

  let catalogSchema;
  let validate;

  try {
    catalogSchema = await readJson(
      schemaPath
    );

    const ajv = new Ajv2020({
      allErrors: true,
      strict: false,
      allowUnionTypes: true,
      validateFormats: true,
      verbose: true
    });

    addFormats(ajv);

    validate = ajv.compile(
      catalogSchema
    );

    collector.info(
      "CATALOG_SCHEMA_COMPILED",
      "component-catalog.schema.json compiled successfully.",
      relativePath(
        skillRoot,
        schemaPath
      )
    );
  } catch (error) {
    collector.error(
      "CATALOG_SCHEMA_COMPILE_FAILED",
      `The component catalog schema could not be compiled: ` +
      `${error.message}`,
      relativePath(
        skillRoot,
        schemaPath
      ),
      error.stack ?? null
    );
  }

  const catalogFiles =
    await listCatalogFiles(
      catalogDirectory
    );

  const components = new Map();
  const aliases = new Map();
  const aliasOwners = new Map();
  const validationIds = new Map();
  const dependencyReferences = [];

  let catalogsValid = 0;
  let catalogsInvalid = 0;

  for (const catalogFile of catalogFiles) {
    const relative = relativePath(
      skillRoot,
      catalogFile
    );

    let catalog;

    try {
      catalog = await readJson(
        catalogFile
      );
    } catch (error) {
      catalogsInvalid += 1;

      collector.error(
        "CATALOG_JSON_INVALID",
        `Catalog JSON could not be parsed: ${error.message}`,
        relative
      );

      continue;
    }

    let catalogValid = true;

    if (
      catalog.$schema !==
      EXPECTED_SCHEMA_REFERENCE
    ) {
      catalogValid = false;

      collector.error(
        "CATALOG_SCHEMA_REFERENCE_INVALID",
        "Catalog $schema must use the portable relative schema path.",
        `${relative}#$schema`,
        {
          expected:
            EXPECTED_SCHEMA_REFERENCE,
          actual:
            catalog.$schema ?? null
        }
      );
    }

    if (validate) {
      const valid = validate(
        catalog
      );

      if (!valid) {
        catalogValid = false;

        for (
          const error of
          validate.errors ?? []
        ) {
          collector.error(
            "CATALOG_SCHEMA_VALIDATION_FAILED",
            error.message ??
              "Catalog schema validation failed.",
            `${relative}${error.instancePath || "#"}`,
            {
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
      }
    } else {
      catalogValid = false;
    }

    if (catalogValid) {
      catalogsValid += 1;

      collector.info(
        "CATALOG_SCHEMA_VALID",
        "Catalog validates against component-catalog.schema.json.",
        relative
      );
    } else {
      catalogsInvalid += 1;
    }

    const catalogValidationIds = [];

    collectValidationIds(
      catalog?.validation,
      `${relative}#validation`,
      catalogValidationIds
    );

    for (
      const validationItem of
      catalogValidationIds
    ) {
      const existing =
        validationIds.get(
          validationItem.id
        );

      if (existing) {
        collector.error(
          "CATALOG_VALIDATION_ID_DUPLICATE",
          `Validation ID '${validationItem.id}' is duplicated.`,
          validationItem.location,
          {
            first:
              existing.location,
            duplicate:
              validationItem.location
          }
        );
      } else {
        validationIds.set(
          validationItem.id,
          validationItem
        );
      }
    }

    const entries =
      getComponentEntries(
        catalog,
        relative,
        collector
      );

    for (const entry of entries) {
      const canonicalName =
        entry.canonicalName;

      if (
        typeof canonicalName !== "string" ||
        canonicalName.trim() === ""
      ) {
        collector.error(
          "CATALOG_COMPONENT_NAME_INVALID",
          "A component has no usable canonical name.",
          entry.location
        );

        continue;
      }

      if (components.has(canonicalName)) {
        collector.error(
          "CATALOG_COMPONENT_DUPLICATE",
          `Component '${canonicalName}' is declared more than once.`,
          entry.location,
          {
            first:
              components.get(canonicalName)
                .location,
            duplicate:
              entry.location
          }
        );
      } else {
        components.set(
          canonicalName,
          entry
        );
      }

      for (
        const alias of
        collectAliases(
          canonicalName,
          entry.component
        )
      ) {
        const existingOwner =
          aliasOwners.get(alias);

        if (
          existingOwner &&
          existingOwner !== canonicalName
        ) {
          collector.error(
            "CATALOG_COMPONENT_ALIAS_CONFLICT",
            `Alias '${alias}' is shared by components ` +
            `'${existingOwner}' and '${canonicalName}'.`,
            entry.location
          );

          continue;
        }

        aliasOwners.set(
          alias,
          canonicalName
        );

        aliases.set(
          alias,
          canonicalName
        );
      }

      const componentValidationIds = [];

      collectValidationIds(
        entry.component,
        entry.location,
        componentValidationIds
      );

      for (
        const validationItem of
        componentValidationIds
      ) {
        const existing =
          validationIds.get(
            validationItem.id
          );

        if (existing) {
          collector.error(
            "CATALOG_VALIDATION_ID_DUPLICATE",
            `Validation ID '${validationItem.id}' is duplicated.`,
            validationItem.location,
            {
              first:
                existing.location,
              duplicate:
                validationItem.location
            }
          );
        } else {
          validationIds.set(
            validationItem.id,
            validationItem
          );
        }
      }

      const dependencies =
        collectComponentDependencies(
          entry.component,
          entry.location
        );

      for (const dependency of dependencies) {
        dependencyReferences.push({
          owner: canonicalName,
          reference:
            dependency.reference,
          location:
            dependency.location
        });
      }
    }
  }

  let template = null;

  try {
    template = await readJson(
      templatePath
    );
  } catch (error) {
    collector.error(
      "CATALOG_TEMPLATE_JSON_INVALID",
      `component-catalog.template.json could not be parsed: ` +
      `${error.message}`,
      relativePath(
        skillRoot,
        templatePath
      )
    );
  }

  if (template) {
    validateCatalogTemplateCoverage({
      skillRoot,
      catalogFiles,
      template,
      collector
    });
  }

  const dependencyResult =
    resolveDependencyGraph({
      components,
      aliases,
      dependencyReferences,
      collector
    });

  const dependencyCycles =
    detectCycles(
      dependencyResult.graph,
      collector
    );

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
      catalogsDiscovered:
        catalogFiles.length,
      catalogsValid,
      catalogsInvalid,
      componentsDiscovered:
        components.size,
      validationIds:
        validationIds.size,
      dependenciesResolved:
        dependencyResult.resolvedCount,
      dependenciesUnresolved:
        dependencyResult.unresolvedCount,
      dependencyCycles
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
