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

const PORTABLE_SCHEMA_ROOT =
  "../schemas";

const CONTRACTS = [
  {
    id: "styling-authority",
    schema:
      "assets/schemas/styling-authority.schema.json",
    template:
      "assets/templates/styling-authority.template.json",
    expectedSchemaReference:
      `${PORTABLE_SCHEMA_ROOT}/styling-authority.schema.json`
  },
  {
    id: "design-system",
    schema:
      "assets/schemas/design-system.schema.json",
    template:
      "assets/templates/design-system.template.json",
    expectedSchemaReference:
      `${PORTABLE_SCHEMA_ROOT}/design-system.schema.json`
  },
  {
    id: "screen-specification",
    schema:
      "assets/schemas/screen-specification.schema.json",
    template:
      "assets/templates/screen-specification.template.json",
    expectedSchemaReference:
      `${PORTABLE_SCHEMA_ROOT}/screen-specification.schema.json`
  },
  {
    id: "small-slice-manifest",
    schema:
      "assets/schemas/small-slice-manifest.schema.json",
    template:
      "assets/templates/small-slice-manifest.template.json",
    expectedSchemaReference:
      `${PORTABLE_SCHEMA_ROOT}/small-slice-manifest.schema.json`
  },
  {
    id: "composition-proof",
    schema:
      "assets/schemas/composition-proof.schema.json",
    template:
      "assets/templates/composition-proof.template.json",
    expectedSchemaReference:
      `${PORTABLE_SCHEMA_ROOT}/composition-proof.schema.json`
  },
  {
    id: "visual-composition-evidence",
    schema:
      "assets/schemas/visual-composition-evidence.schema.json",
    template:
      "assets/templates/visual-composition-evidence.template.json",
    expectedSchemaReference:
      `${PORTABLE_SCHEMA_ROOT}/visual-composition-evidence.schema.json`
  },
  {
    id: "visual-quality-scorecard",
    schema:
      "assets/schemas/visual-quality-scorecard.schema.json",
    template:
      "assets/templates/visual-quality-scorecard.template.json",
    expectedSchemaReference:
      `${PORTABLE_SCHEMA_ROOT}/visual-quality-scorecard.schema.json`
  }
];

const COMPONENT_REFERENCE_KEYS = new Set([
  "component",
  "componentid",
  "componentname",
  "componentref",
  "catalogcomponent",
  "catalogcomponentid",
  "catalogcomponentref",
  "components",
  "requiredcomponents",
  "supportingcomponents",
  "foundationcomponents",
  "componentrefs",
  "componentreferences",
  "componentmap"
]);

const RECIPE_REFERENCE_KEYS = new Set([
  "recipe",
  "recipeid",
  "reciperef",
  "selectedrecipe",
  "layoutrecipe",
  "layoutrecipeid",
  "layoutreciperef"
]);

const EVIDENCE_KEY_FRAGMENTS = [
  "evidence",
  "screenshot",
  "report",
  "log",
  "journal",
  "artifact",
  "browservalidation",
  "designsystemaudit",
  "defectlog",
  "repositoryinspection",
  "manifest"
];

const EXTERNAL_COMPONENT_IDENTIFIERS = new Set([
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
  "GlobalHeader",
  "SidebarNavigation",
  "RouteOutlet",
  "ToastViewport"
]);

const COMPONENT_IDENTIFIER_PATTERN =
  /^[A-Z][A-Za-z0-9]*$/;

const RECIPE_IDENTIFIER_PATTERN =
  /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

const PLACEHOLDER_PATTERNS = [
  /^<[^>]+>$/,
  /^\{\{[^}]+\}\}$/,
  /^\$\{[^}]+\}$/,
  /^(?:TODO|TBD)$/i,
  /^(?:ComponentName|ExampleComponent|RecipeId|ExampleRecipe)$/
];

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

function isObject(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function normalizeKey(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function relativePath(root, filePath) {
  return path
    .relative(root, filePath)
    .replaceAll("\\", "/");
}

async function pathType(targetPath) {
  try {
    const stats = await fs.stat(
      targetPath
    );

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
      return (
        entry.isFile() &&
        entry.name.endsWith(".json")
      );
    })
    .map((entry) => {
      return path.join(
        directory,
        entry.name
      );
    })
    .sort();
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

function isPlaceholder(value) {
  return PLACEHOLDER_PATTERNS.some(
    (pattern) => pattern.test(value)
  );
}


const PLACEHOLDER_MATERIALIZATION = new Map([
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
  ]
]);

function fallbackPlaceholderValue(
  placeholder
) {
  const normalized = placeholder
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized ||
    "example-value";
}

function materializePlaceholderString(
  value
) {
  return value.replace(
    /<([^<>]+)>/g,
    (
      _match,
      rawPlaceholder
    ) => {
      const placeholder =
        rawPlaceholder.trim();

      if (
        PLACEHOLDER_MATERIALIZATION.has(
          placeholder
        )
      ) {
        return (
          PLACEHOLDER_MATERIALIZATION.get(
            placeholder
          )
        );
      }

      if (placeholder.includes("|")) {
        const firstChoice = placeholder
          .split("|")[0]
          .trim();

        return firstChoice ||
          "example-value";
      }

      return fallbackPlaceholderValue(
        placeholder
      );
    }
  );
}

function materializeTemplateForValidation(
  value
) {
  if (typeof value === "string") {
    return materializePlaceholderString(
      value
    );
  }

  if (Array.isArray(value)) {
    return value.map((item) => {
      return materializeTemplateForValidation(
        item
      );
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
          materializeTemplateForValidation(
            item
          )
        ];
      }
    )
  );
}

function inspectArrayScopedIds({
  value,
  location,
  collector,
  metrics
}) {
  if (Array.isArray(value)) {
    const ids = new Map();

    value.forEach((item, index) => {
      if (
        isObject(item) &&
        typeof item.id === "string" &&
        item.id.trim() !== ""
      ) {
        metrics.arrayScopedIds += 1;

        const existingIndex = ids.get(
          item.id
        );

        if (existingIndex !== undefined) {
          metrics.duplicateArrayIds += 1;

          collector.error(
            "TEMPLATE_ARRAY_ID_DUPLICATE",
            `ID '${item.id}' is duplicated within the same array.`,
            `${location}[${index}].id`,
            {
              first:
                `${location}[${existingIndex}].id`,
              duplicate:
                `${location}[${index}].id`
            }
          );
        } else {
          ids.set(
            item.id,
            index
          );
        }
      }

      inspectArrayScopedIds({
        value: item,
        location:
          `${location}[${index}]`,
        collector,
        metrics
      });
    });

    return;
  }

  if (!isObject(value)) {
    return;
  }

  for (
    const [key, item] of
    Object.entries(value)
  ) {
    inspectArrayScopedIds({
      value: item,
      location:
        `${location}.${key}`,
      collector,
      metrics
    });
  }
}

function collectReferenceStrings(
  value,
  location,
  results
) {
  if (typeof value === "string") {
    results.push({
      value,
      location
    });

    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectReferenceStrings(
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

  const explicitKeys = [
    "id",
    "name",
    "ref",
    "component",
    "componentId",
    "componentName",
    "recipe",
    "recipeId"
  ];

  let explicitValueFound = false;

  for (const key of explicitKeys) {
    const item = value[key];

    if (typeof item === "string") {
      results.push({
        value: item,
        location:
          `${location}.${key}`
      });

      explicitValueFound = true;
    }
  }

  if (explicitValueFound) {
    return;
  }

  for (
    const [key, item] of
    Object.entries(value)
  ) {
    collectReferenceStrings(
      item,
      `${location}.${key}`,
      results
    );
  }
}

function collectReferencesByKeys({
  value,
  location,
  keys,
  results
}) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectReferencesByKeys({
        value: item,
        location:
          `${location}[${index}]`,
        keys,
        results
      });
    });

    return;
  }

  if (!isObject(value)) {
    return;
  }

  for (
    const [key, item] of
    Object.entries(value)
  ) {
    const itemLocation =
      `${location}.${key}`;

    if (
      keys.has(
        normalizeKey(key)
      )
    ) {
      collectReferenceStrings(
        item,
        itemLocation,
        results
      );

      continue;
    }

    collectReferencesByKeys({
      value: item,
      location: itemLocation,
      keys,
      results
    });
  }
}

function normalizeRecipeReference(value) {
  const normalized = value
    .replaceAll("\\", "/");

  const basename = path.posix.basename(
    normalized
  );

  if (
    basename.endsWith(
      ".recipe.json"
    )
  ) {
    return basename.slice(
      0,
      -".recipe.json".length
    );
  }

  return value;
}

function validateComponentReferences({
  template,
  templateLocation,
  componentAliases,
  collector,
  metrics
}) {
  const references = [];

  collectReferencesByKeys({
    value: template,
    location: templateLocation,
    keys: COMPONENT_REFERENCE_KEYS,
    results: references
  });

  const unique = new Set();

  for (const item of references) {
    const reference =
      item.value.trim();

    if (
      !COMPONENT_IDENTIFIER_PATTERN.test(
        reference
      )
    ) {
      continue;
    }

    const uniqueKey =
      `${reference}::${item.location}`;

    if (unique.has(uniqueKey)) {
      continue;
    }

    unique.add(uniqueKey);
    metrics.componentReferences += 1;

    if (isPlaceholder(reference)) {
      metrics.placeholderReferences += 1;

      collector.warning(
        "TEMPLATE_COMPONENT_REFERENCE_PLACEHOLDER",
        `Component reference '${reference}' appears to be a placeholder.`,
        item.location
      );

      continue;
    }

    if (
      componentAliases.has(reference) ||
      EXTERNAL_COMPONENT_IDENTIFIERS.has(
        reference
      )
    ) {
      collector.info(
        "TEMPLATE_COMPONENT_REFERENCE_RESOLVED",
        `Component reference '${reference}' was resolved.`,
        item.location
      );

      continue;
    }

    metrics.unresolvedComponentReferences += 1;

    collector.error(
      "TEMPLATE_COMPONENT_REFERENCE_UNRESOLVED",
      `Component reference '${reference}' is not present in the component catalogs.`,
      item.location
    );
  }
}

function validateRecipeReferences({
  template,
  templateLocation,
  recipeIds,
  collector,
  metrics
}) {
  const references = [];

  collectReferencesByKeys({
    value: template,
    location: templateLocation,
    keys: RECIPE_REFERENCE_KEYS,
    results: references
  });

  const unique = new Set();

  for (const item of references) {
    const reference =
      normalizeRecipeReference(
        item.value.trim()
      );

    if (
      !RECIPE_IDENTIFIER_PATTERN.test(
        reference
      )
    ) {
      continue;
    }

    const uniqueKey =
      `${reference}::${item.location}`;

    if (unique.has(uniqueKey)) {
      continue;
    }

    unique.add(uniqueKey);
    metrics.recipeReferences += 1;

    if (isPlaceholder(reference)) {
      metrics.placeholderReferences += 1;

      collector.warning(
        "TEMPLATE_RECIPE_REFERENCE_PLACEHOLDER",
        `Recipe reference '${reference}' appears to be a placeholder.`,
        item.location
      );

      continue;
    }

    if (recipeIds.has(reference)) {
      collector.info(
        "TEMPLATE_RECIPE_REFERENCE_RESOLVED",
        `Recipe reference '${reference}' was resolved.`,
        item.location
      );

      continue;
    }

    metrics.unresolvedRecipeReferences += 1;

    collector.error(
      "TEMPLATE_RECIPE_REFERENCE_UNRESOLVED",
      `Recipe reference '${reference}' is not present in assets/recipes.`,
      item.location
    );
  }
}

function looksLikePath(value) {
  return (
    value.includes("/") ||
    value.includes("\\") ||
    /\.(?:json|md|log|txt|png|jpe?g|webp|html|xml|ya?ml)$/i.test(
      value
    )
  );
}

function inspectPortableStrings({
  value,
  location,
  collector,
  metrics
}) {
  if (typeof value === "string") {
    if (!looksLikePath(value)) {
      return;
    }

    metrics.pathsInspected += 1;

    const normalized =
      value.replaceAll("\\", "/");

    const invalidReasons = [];

    if (
      normalized.includes(
        "skills-src/" + "frontend-product-builder"
      )
    ) {
      invalidReasons.push(
        "staging source path"
      );
    }

    if (
      normalized.includes(
        "node .agents/skills/" + "frontend-product-builder"
      )
    ) {
      invalidReasons.push(
        "workspace-relative execution path"
      );
    }

    if (
      /^\/home\/[^/]+\//.test(normalized)
    ) {
      invalidReasons.push(
        "hardcoded Linux home path"
      );
    }

    if (
      /^[A-Za-z]:\//.test(normalized)
    ) {
      invalidReasons.push(
        "hardcoded Windows absolute path"
      );
    }

    if (
      normalized.startsWith(
        "file://"
      )
    ) {
      invalidReasons.push(
        "file URL"
      );
    }

    if (invalidReasons.length > 0) {
      metrics.invalidPortablePaths += 1;

      collector.error(
        "TEMPLATE_PATH_NOT_PORTABLE",
        "A persisted template path is not portable.",
        location,
        {
          value,
          reasons: invalidReasons
        }
      );
    }

    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      inspectPortableStrings({
        value: item,
        location:
          `${location}[${index}]`,
        collector,
        metrics
      });
    });

    return;
  }

  if (!isObject(value)) {
    return;
  }

  for (
    const [key, item] of
    Object.entries(value)
  ) {
    inspectPortableStrings({
      value: item,
      location:
        `${location}.${key}`,
      collector,
      metrics
    });
  }
}

function collectEvidencePaths({
  value,
  location,
  results
}) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectEvidencePaths({
        value: item,
        location:
          `${location}[${index}]`,
        results
      });
    });

    return;
  }

  if (!isObject(value)) {
    return;
  }

  for (
    const [key, item] of
    Object.entries(value)
  ) {
    const normalizedKey =
      normalizeKey(key);

    const itemLocation =
      `${location}.${key}`;

    const isEvidenceKey =
      EVIDENCE_KEY_FRAGMENTS.some(
        (fragment) => {
          return normalizedKey.includes(
            fragment
          );
        }
      );

    if (isEvidenceKey) {
      const strings = [];

      collectReferenceStrings(
        item,
        itemLocation,
        strings
      );

      for (const stringItem of strings) {
        if (
          looksLikePath(
            stringItem.value
          )
        ) {
          results.push(
            stringItem
          );
        }
      }
    }

    collectEvidencePaths({
      value: item,
      location: itemLocation,
      results
    });
  }
}

function validateEvidenceReferences({
  template,
  templateLocation,
  collector,
  metrics
}) {
  const evidencePaths = [];

  collectEvidencePaths({
    value: template,
    location: templateLocation,
    results: evidencePaths
  });

  const unique = new Set();

  for (const item of evidencePaths) {
    const uniqueKey =
      `${item.value}::${item.location}`;

    if (unique.has(uniqueKey)) {
      continue;
    }

    unique.add(uniqueKey);
    metrics.evidenceReferences += 1;

    if (
      item.value.trim() === ""
    ) {
      collector.error(
        "TEMPLATE_EVIDENCE_REFERENCE_EMPTY",
        "An evidence reference is empty.",
        item.location
      );
    }
  }
}

async function loadComponentAliases({
  skillRoot,
  collector
}) {
  const catalogDirectory = path.join(
    skillRoot,
    "assets",
    "catalog"
  );

  const catalogFiles =
    await listJsonFiles(
      catalogDirectory
    );

  const aliases = new Map();

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
      collector.error(
        "TEMPLATE_COMPONENT_CATALOG_INVALID",
        `Component catalog could not be parsed: ${error.message}`,
        relative
      );

      continue;
    }

    const components =
      catalog?.components;

    if (!isObject(components)) {
      collector.error(
        "TEMPLATE_COMPONENT_COLLECTION_INVALID",
        "The catalog does not contain an object-based components collection.",
        `${relative}#components`
      );

      continue;
    }

    for (
      const [canonicalName, component] of
      Object.entries(components)
    ) {
      const candidates = [
        canonicalName,
        component?.id,
        component?.name,
        component?.meta?.id,
        component?.meta?.name
      ];

      for (const candidate of candidates) {
        if (
          typeof candidate !== "string" ||
          !COMPONENT_IDENTIFIER_PATTERN.test(
            candidate
          )
        ) {
          continue;
        }

        const existing =
          aliases.get(candidate);

        if (
          existing &&
          existing !== canonicalName
        ) {
          collector.error(
            "TEMPLATE_COMPONENT_ALIAS_CONFLICT",
            `Component alias '${candidate}' is shared by '${existing}' and '${canonicalName}'.`,
            relative
          );

          continue;
        }

        aliases.set(
          candidate,
          canonicalName
        );
      }
    }
  }

  collector.info(
    "TEMPLATE_COMPONENT_ALIASES_LOADED",
    "Component aliases were loaded for template reference validation.",
    "assets/catalog",
    {
      catalogs:
        catalogFiles.length,
      aliases:
        aliases.size
    }
  );

  return aliases;
}

async function loadRecipeIds({
  skillRoot,
  collector
}) {
  const recipeDirectory = path.join(
    skillRoot,
    "assets",
    "recipes"
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

  const recipeIds = new Map();

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
        "TEMPLATE_RECIPE_INVALID",
        `Recipe could not be parsed: ${error.message}`,
        relative
      );

      continue;
    }

    const recipeId =
      recipe?.meta?.id ??
      recipe?.id ??
      recipe?.name ??
      path.basename(
        recipeFile,
        ".recipe.json"
      );

    if (
      typeof recipeId !== "string" ||
      recipeId.trim() === ""
    ) {
      collector.error(
        "TEMPLATE_RECIPE_ID_INVALID",
        "Recipe has no usable identifier.",
        relative
      );

      continue;
    }

    const existing =
      recipeIds.get(recipeId);

    if (existing) {
      collector.error(
        "TEMPLATE_RECIPE_ID_DUPLICATE",
        `Recipe ID '${recipeId}' is duplicated.`,
        relative,
        {
          first: existing,
          duplicate: relative
        }
      );

      continue;
    }

    recipeIds.set(
      recipeId,
      relative
    );
  }

  collector.info(
    "TEMPLATE_RECIPE_IDS_LOADED",
    "Recipe identifiers were loaded for template reference validation.",
    "assets/recipes",
    {
      recipes:
        recipeIds.size
    }
  );

  return recipeIds;
}

async function validateContracts({
  skillRoot,
  componentAliases,
  recipeIds,
  collector,
  metrics
}) {
  const schemaIds = new Map();

  for (const contract of CONTRACTS) {
    const schemaPath = path.join(
      skillRoot,
      contract.schema
    );

    const templatePath = path.join(
      skillRoot,
      contract.template
    );

    if (
      await pathType(schemaPath) !==
      "file"
    ) {
      collector.error(
        "TEMPLATE_SCHEMA_MISSING",
        "A required schema file is missing.",
        contract.schema
      );

      continue;
    }

    if (
      await pathType(templatePath) !==
      "file"
    ) {
      collector.error(
        "TEMPLATE_FILE_MISSING",
        "A required template file is missing.",
        contract.template
      );

      continue;
    }

    let schema;
    let template;

    try {
      schema = await readJson(
        schemaPath
      );
    } catch (error) {
      collector.error(
        "TEMPLATE_SCHEMA_JSON_INVALID",
        `Schema JSON could not be parsed: ${error.message}`,
        contract.schema
      );

      continue;
    }

    try {
      template = await readJson(
        templatePath
      );
    } catch (error) {
      collector.error(
        "TEMPLATE_JSON_INVALID",
        `Template JSON could not be parsed: ${error.message}`,
        contract.template
      );

      continue;
    }

    metrics.schemasDiscovered += 1;
    metrics.templatesDiscovered += 1;

    if (
      typeof schema.$id === "string"
    ) {
      const existing =
        schemaIds.get(schema.$id);

      if (existing) {
        collector.error(
          "TEMPLATE_SCHEMA_ID_DUPLICATE",
          `Schema $id '${schema.$id}' is duplicated.`,
          contract.schema,
          {
            first: existing,
            duplicate: contract.schema
          }
        );
      } else {
        schemaIds.set(
          schema.$id,
          contract.schema
        );
      }
    }

    let validate;

    try {
      const ajv = createAjv();

      validate = ajv.compile(
        schema
      );

      metrics.schemasCompiled += 1;

      collector.info(
        "TEMPLATE_SCHEMA_COMPILED",
        "JSON Schema compiled successfully.",
        contract.schema,
        {
          id:
            schema.$id ?? null,
          draft:
            schema.$schema ?? null
        }
      );
    } catch (error) {
      collector.error(
        "TEMPLATE_SCHEMA_COMPILE_FAILED",
        `JSON Schema compilation failed: ${error.message}`,
        contract.schema,
        error.stack ?? null
      );

      continue;
    }

    if (
      template.$schema !==
      contract.expectedSchemaReference
    ) {
      collector.error(
        "TEMPLATE_SCHEMA_REFERENCE_INVALID",
        "Template $schema does not use the expected portable relative path.",
        `${contract.template}#$schema`,
        {
          expected:
            contract.expectedSchemaReference,
          actual:
            template.$schema ?? null
        }
      );
    }

    const validationCandidate =


      materializeTemplateForValidation(


        template


      );



    const valid = validate(


      validationCandidate


    );

    if (!valid) {
      metrics.templatesInvalid += 1;

      for (
        const error of
        validate.errors ?? []
      ) {
        collector.error(
          "TEMPLATE_SCHEMA_VALIDATION_FAILED",
          error.message ??
            "Template schema validation failed.",
          `${contract.template}${error.instancePath || "#"}`,
          {
            contract:
              contract.id,
            keyword:
              error.keyword,
            params:
              error.params,
            schemaPath:
              error.schemaPath,
            data:
              error.data === undefined
                ? null
                : error.data
          }
        );
      }
    } else {
      metrics.templatesValid += 1;

      collector.info(
        "TEMPLATE_SCHEMA_VALID",
        "Template validates against its JSON Schema.",
        contract.template,
        {
          contract:
            contract.id
        }
      );
    }

    inspectArrayScopedIds({
      value: template,
      location:
        contract.template,
      collector,
      metrics
    });

    inspectPortableStrings({
      value: template,
      location:
        contract.template,
      collector,
      metrics
    });

    validateEvidenceReferences({
      template,
      templateLocation:
        contract.template,
      collector,
      metrics
    });

    if (
      contract.id ===
      "screen-specification"
    ) {
      validateComponentReferences({
        template,
        templateLocation:
          contract.template,
        componentAliases,
        collector,
        metrics
      });

      validateRecipeReferences({
        template,
        templateLocation:
          contract.template,
        recipeIds,
        collector,
        metrics
      });
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
    "Frontend Product Builder — Contract Template Validation\n"
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
    `Templates discovered: ${report.metrics.templatesDiscovered}\n`
  );

  process.stdout.write(
    `Templates valid: ${report.metrics.templatesValid}\n`
  );

  process.stdout.write(
    `Templates invalid: ${report.metrics.templatesInvalid}\n`
  );

  process.stdout.write(
    `Array-scoped IDs: ${report.metrics.arrayScopedIds}\n`
  );

  process.stdout.write(
    `Duplicate array IDs: ${report.metrics.duplicateArrayIds}\n`
  );

  process.stdout.write(
    `Component references: ${report.metrics.componentReferences}\n`
  );

  process.stdout.write(
    `Unresolved component references: ${report.metrics.unresolvedComponentReferences}\n`
  );

  process.stdout.write(
    `Recipe references: ${report.metrics.recipeReferences}\n`
  );

  process.stdout.write(
    `Unresolved recipe references: ${report.metrics.unresolvedRecipeReferences}\n`
  );

  process.stdout.write(
    `Evidence references: ${report.metrics.evidenceReferences}\n`
  );

  process.stdout.write(
    `Paths inspected: ${report.metrics.pathsInspected}\n`
  );

  process.stdout.write(
    `Invalid portable paths: ${report.metrics.invalidPortablePaths}\n\n`
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

  if (
    await pathType(skillRoot) !==
    "directory"
  ) {
    collector.error(
      "TEMPLATE_SKILL_ROOT_INVALID",
      "The skill root does not exist or is not a directory.",
      skillRoot
    );
  }

  const metrics = {
    schemasDiscovered: 0,
    schemasCompiled: 0,
    templatesDiscovered: 0,
    templatesValid: 0,
    templatesInvalid: 0,
    arrayScopedIds: 0,
    duplicateArrayIds: 0,
    componentReferences: 0,
    unresolvedComponentReferences: 0,
    recipeReferences: 0,
    unresolvedRecipeReferences: 0,
    placeholderReferences: 0,
    evidenceReferences: 0,
    pathsInspected: 0,
    invalidPortablePaths: 0
  };

  const componentAliases =
    await loadComponentAliases({
      skillRoot,
      collector
    });

  const recipeIds =
    await loadRecipeIds({
      skillRoot,
      collector
    });

  await validateContracts({
    skillRoot,
    componentAliases,
    recipeIds,
    collector,
    metrics
  });

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
    metrics,
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
