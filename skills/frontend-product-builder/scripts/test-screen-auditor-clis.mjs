#!/usr/bin/env node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  fileURLToPath
} from "node:url";
import {
  spawnSync
} from "node:child_process";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const SCRIPT_DIRECTORY = path.dirname(
  fileURLToPath(import.meta.url)
);

const DEFAULT_SKILL_ROOT = path.resolve(
  SCRIPT_DIRECTORY,
  ".."
);

const SCREEN_SCHEMA =
  "assets/schemas/screen-specification.schema.json";

const VALID_SCREEN_FIXTURE =
  "evals/files/contracts/valid/screen-specification.valid.json";

const TARGETS = [
  {
    id: "screen-spec-references",
    script:
      "scripts/audit-screen-spec-references.mjs",
    mutationGroups: [
      "references"
    ]
  },
  {
    id: "screen-component-coverage",
    script:
      "scripts/audit-screen-component-coverage.mjs",
    mutationGroups: [
      "component-coverage",
      "references"
    ]
  },
  {
    id: "screen-action-state-coverage",
    script:
      "scripts/audit-screen-action-state-coverage.mjs",
    mutationGroups: [
      "action-state"
    ]
  },
  {
    id: "screen-data-ownership",
    script:
      "scripts/audit-screen-data-ownership.mjs",
    mutationGroups: [
      "data-ownership"
    ]
  }
];

const INPUT_FLAGS = [
  "--specification",
  "--screen-specification",
  "--screen-spec",
  "--spec",
  "--input",
  "--file",
  "--path"
];

const ROOT_FLAGS = [
  "--root",
  "--skill-root",
  "--project-root",
  "--repository-root",
  "--repo-root",
  "--cwd"
];

const SCHEMA_FLAGS = [
  "--schema",
  "--schema-path"
];

const CATALOG_FLAGS = [
  "--catalog-root",
  "--catalog-directory",
  "--catalog",
  "--component-catalog-root"
];

const RECIPE_FLAGS = [
  "--recipe-root",
  "--recipes-root",
  "--recipe-directory",
  "--recipes"
];

function parseArguments(argv) {
  const options = {
    root: DEFAULT_SKILL_ROOT,
    json: false,
    keepTemporaryRepository: false
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

      case "--keep-temp":
        options.keepTemporaryRepository = true;
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
    const stats = await fs.stat(
      targetPath
    );

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
  const content = await fs.readFile(
    filePath,
    "utf8"
  );

  return JSON.parse(content);
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

    const installedSkillRoot = path.join(
      os.homedir(),
      ".agents/skills/frontend-product-builder"
    );

    return value
      .split(
        resolvedSkillRoot
      )
      .join(
        PORTABLE_REPORT_SKILL_ROOT
      )
      .split(
        installedSkillRoot
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
      recursive: true
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

function runProcess({
  command,
  args,
  cwd,
  timeout = 30000
}) {
  const result = spawnSync(
    command,
    args,
    {
      cwd,
      encoding: "utf8",
      windowsHide: true,
      timeout,
      maxBuffer:
        8 * 1024 * 1024
    }
  );

  return {
    command,
    args,
    cwd,
    status:
      typeof result.status === "number"
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

function looksLikeUsageFailure(result) {
  const output =
    combinedOutput(result);

  return (
    /unknown option/i.test(output) ||
    /unknown argument/i.test(output) ||
    /unexpected argument/i.test(output) ||
    /invalid option/i.test(output) ||
    /requires (?:a |an )?(?:file|path|value|argument)/i.test(
      output
    ) ||
    /missing required (?:option|argument)/i.test(
      output
    ) ||
    /usage:\s/i.test(output)
  );
}

function looksLikeInfrastructureFailure(
  result
) {
  const output =
    combinedOutput(result);

  return (
    /ERR_MODULE_NOT_FOUND/.test(output) ||
    /Cannot find module/i.test(output) ||
    /SyntaxError:/i.test(output) ||
    /ReferenceError:/i.test(output) ||
    /command not found/i.test(output) ||
    /spawnSync .* ENOENT/i.test(output) ||
    /ENOENT: no such file or directory/i.test(
      output
    )
  );
}

function extractCliOptions(source) {
  const options = new Set();

  const patterns = [
    /["'`](--[a-z0-9][a-z0-9-]*)["'`]/gi,
    /case\s+["'`](--[a-z0-9][a-z0-9-]*)["'`]/gi
  ];

  for (const pattern of patterns) {
    let match;

    while (
      (
        match = pattern.exec(source)
      ) !== null
    ) {
      options.add(
        match[1]
      );
    }
  }

  return options;
}

function chooseDetectedFlag(
  detectedOptions,
  candidates
) {
  return candidates.find(
    (candidate) => {
      return detectedOptions.has(
        candidate
      );
    }
  ) ?? null;
}

function deduplicateCandidates(
  candidates
) {
  const seen = new Set();
  const result = [];

  for (const candidate of candidates) {
    const key =
      JSON.stringify(candidate.args);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(candidate);
  }

  return result;
}

function buildInvocationCandidates({
  detectedOptions,
  skillRoot,
  repositoryRoot,
  specificationFile,
  schemaFile
}) {
  const detectedInputFlags =
    INPUT_FLAGS.filter(
      (flag) => {
        return detectedOptions.has(flag);
      }
    );

  const inputModes = [
    ...detectedInputFlags.map(
      (flag) => ({
        type: "flag",
        flag
      })
    ),
    {
      type: "positional",
      flag: null
    }
  ];

  if (detectedInputFlags.length === 0) {
    for (const flag of INPUT_FLAGS) {
      inputModes.push({
        type: "flag",
        flag
      });
    }
  }

  const rootModes = [
    {
      flag: null,
      value: null
    }
  ];

  for (const flag of ROOT_FLAGS) {
    if (!detectedOptions.has(flag)) {
      continue;
    }

    rootModes.push(
      {
        flag,
        value: repositoryRoot
      },
      {
        flag,
        value: skillRoot
      }
    );
  }

  const schemaFlag =
    chooseDetectedFlag(
      detectedOptions,
      SCHEMA_FLAGS
    );

  const catalogFlag =
    chooseDetectedFlag(
      detectedOptions,
      CATALOG_FLAGS
    );

  const recipeFlag =
    chooseDetectedFlag(
      detectedOptions,
      RECIPE_FLAGS
    );

  const catalogRoot = path.join(
    repositoryRoot,
    "assets/catalog"
  );

  const recipeRoot = path.join(
    repositoryRoot,
    "assets/recipes"
  );

  const candidates = [];

  for (const inputMode of inputModes) {
    for (const rootMode of rootModes) {
      const supplemental = [];

      if (rootMode.flag) {
        supplemental.push(
          rootMode.flag,
          rootMode.value
        );
      }

      if (schemaFlag) {
        supplemental.push(
          schemaFlag,
          schemaFile
        );
      }

      if (catalogFlag) {
        supplemental.push(
          catalogFlag,
          catalogRoot
        );
      }

      if (recipeFlag) {
        supplemental.push(
          recipeFlag,
          recipeRoot
        );
      }

      if (inputMode.type === "flag") {
        candidates.push({
          args: [
            ...supplemental,
            inputMode.flag,
            specificationFile
          ]
        });
      } else {
        candidates.push(
          {
            args: [
              ...supplemental,
              specificationFile
            ]
          },
          {
            args: [
              specificationFile,
              ...supplemental
            ]
          },
          {
            args: [
              specificationFile,
              catalogRoot,
              recipeRoot
            ]
          }
        );
      }
    }
  }

  candidates.push({
    args: []
  });

  return deduplicateCandidates(
    candidates
  ).slice(0, 60);
}

function replaceInputPath({
  args,
  from,
  to
}) {
  return args.map((argument) => {
    return argument === from
      ? to
      : argument;
  });
}

function uniqueKebabId(
  base,
  existingIds
) {
  let candidate = base;
  let counter = 2;

  while (existingIds.has(candidate)) {
    candidate =
      `${base}-${counter}`;
    counter += 1;
  }

  return candidate;
}

function collectIds(items) {
  return new Set(
    Array.isArray(items)
      ? items
          .map((item) => item?.id)
          .filter(
            (value) => {
              return (
                typeof value ===
                  "string" &&
                value !== ""
              );
            }
          )
      : []
  );
}

function replaceFirstComponentReference(
  item,
  value
) {
  const keys = [
    "component",
    "componentId",
    "componentName",
    "catalogComponent",
    "catalogComponentId",
    "catalogComponentRef"
  ];

  for (const key of keys) {
    if (
      typeof item?.[key] ===
      "string"
    ) {
      item[key] = value;
      return true;
    }
  }

  return false;
}

function deleteOwnershipFields(
  value
) {
  if (Array.isArray(value)) {
    for (const item of value) {
      deleteOwnershipFields(item);
    }

    return;
  }

  if (!isObject(value)) {
    return;
  }

  for (const key of Object.keys(value)) {
    const normalized = key
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

    if (
      normalized === "owner" ||
      normalized === "ownership" ||
      normalized === "stateowner" ||
      normalized === "sourceoftruth" ||
      normalized === "dataowner" ||
      normalized === "mutationowner"
    ) {
      delete value[key];
      continue;
    }

    deleteOwnershipFields(
      value[key]
    );
  }
}

function createMutationCandidates(
  document,
  groups
) {
  const candidates = [];

  function add(
    id,
    description,
    mutate
  ) {
    const candidate = clone(document);
    const changed = mutate(candidate);

    if (!changed) {
      return;
    }

    candidates.push({
      id,
      description,
      document: candidate
    });
  }

  if (groups.includes("references")) {
    add(
      "missing-product-context-source",
      "Point productContext.source to a schema-valid path that does not exist.",
      (candidate) => {
        if (
          !isObject(candidate.productContext) ||
          typeof candidate.productContext.source !==
            "string"
        ) {
          return false;
        }

        candidate.productContext.source =
          "docs/frontend/missing-product-context.md";

        return true;
      }
    );

    add(
      "missing-recipe-reference",
      "Replace the selected recipe ID with an unknown recipe.",
      (candidate) => {
        if (
          !isObject(candidate.recipe) ||
          typeof candidate.recipe.id !==
            "string"
        ) {
          return false;
        }

        candidate.recipe.id =
          "missing-recipe";

        return true;
      }
    );

    add(
      "missing-component-reference",
      "Replace one component reference with an unknown component.",
      (candidate) => {
        const componentMap =
          candidate.componentMap;

        if (
          !Array.isArray(componentMap) ||
          componentMap.length === 0 ||
          !isObject(componentMap[0])
        ) {
          return false;
        }

        return replaceFirstComponentReference(
          componentMap[0],
          "MissingComponent"
        );
      }
    );
  }

  if (
    groups.includes(
      "component-coverage"
    )
  ) {
    add(
      "remove-first-component-usage",
      "Remove one component-map entry.",
      (candidate) => {
        if (
          !Array.isArray(
            candidate.componentMap
          ) ||
          candidate.componentMap.length <
            2
        ) {
          return false;
        }

        candidate.componentMap.splice(
          0,
          1
        );

        return true;
      }
    );

    add(
      "remove-region-component-coverage",
      "Remove all component usages assigned to one screen region.",
      (candidate) => {
        const componentMap =
          candidate.componentMap;

        if (
          !Array.isArray(componentMap) ||
          componentMap.length < 2
        ) {
          return false;
        }

        const firstRegion =
          componentMap.find(
            (item) => {
              return (
                typeof item?.regionId ===
                "string"
              );
            }
          )?.regionId;

        if (!firstRegion) {
          return false;
        }

        const filtered =
          componentMap.filter(
            (item) => {
              return (
                item?.regionId !==
                firstRegion
              );
            }
          );

        if (
          filtered.length ===
            componentMap.length ||
          filtered.length === 0
        ) {
          return false;
        }

        candidate.componentMap =
          filtered;

        return true;
      }
    );

    add(
      "orphan-recipe-region",
      "Change one region mapping so a recipe region has no screen coverage.",
      (candidate) => {
        const regions =
          candidate.recipe?.regions;

        if (
          !Array.isArray(regions) ||
          regions.length < 2 ||
          !isObject(regions[0])
        ) {
          return false;
        }

        const replacement =
          regions[1]?.screenRegionId;

        if (
          typeof replacement !==
          "string"
        ) {
          return false;
        }

        regions[0].screenRegionId =
          replacement;

        return true;
      }
    );
  }

  if (
    groups.includes(
      "action-state"
    )
  ) {
    add(
      "add-uncovered-action",
      "Add a schema-valid action that is not represented by any state.",
      (candidate) => {
        const actions =
          candidate.actions;

        if (
          !Array.isArray(actions) ||
          actions.length === 0 ||
          !isObject(actions[0])
        ) {
          return false;
        }

        const ids =
          collectIds(actions);

        const clonedAction =
          clone(actions[0]);

        clonedAction.id =
          uniqueKebabId(
            "uncovered-action",
            ids
          );

        if (
          typeof clonedAction.label ===
          "string"
        ) {
          clonedAction.label =
            "Uncovered action";
        }

        actions.push(
          clonedAction
        );

        return true;
      }
    );

    add(
      "remove-disabled-action-coverage",
      "Remove disabled-action declarations from all states.",
      (candidate) => {
        const states =
          candidate.states;

        if (!Array.isArray(states)) {
          return false;
        }

        let changed = false;

        for (const state of states) {
          if (
            Array.isArray(
              state?.disabledActions
            ) &&
            state.disabledActions.length >
              0
          ) {
            state.disabledActions = [];
            changed = true;
          }
        }

        return changed;
      }
    );

    add(
      "unknown-action-in-state",
      "Reference an unknown action from a state.",
      (candidate) => {
        const states =
          candidate.states;

        if (
          !Array.isArray(states) ||
          states.length === 0 ||
          !isObject(states[0])
        ) {
          return false;
        }

        if (
          !Array.isArray(
            states[0].disabledActions
          )
        ) {
          return false;
        }

        const source =
          states[0].disabledActions[0];

        if (isObject(source)) {
          const item = clone(source);
          item.actionId =
            "missing-action";

          states[0].disabledActions.push(
            item
          );

          return true;
        }

        return false;
      }
    );
  }

  if (
    groups.includes(
      "data-ownership"
    )
  ) {
    add(
      "mutation-action-without-mutation-dependency",
      "Mark the action as a mutation without declaring a mutation data dependency.",
      (candidate) => {
        const actions =
          candidate.actions;

        if (
          !Array.isArray(actions) ||
          actions.length === 0 ||
          !isObject(actions[0])
        ) {
          return false;
        }

        actions[0].kind =
          "mutation";

        return true;
      }
    );

    add(
      "presentation-component-owns-query",
      "Assign authoritative query ownership directly to a presentation component.",
      (candidate) => {
        const dependencies =
          candidate.dataDependencies;

        if (
          !Array.isArray(dependencies) ||
          dependencies.length === 0 ||
          !isObject(dependencies[0])
        ) {
          return false;
        }

        dependencies[0].owner =
          "PageHeader";

        return true;
      }
    );

    add(
      "query-with-unclear-cache-policy",
      "Replace the explicit query cache policy with an unclear value.",
      (candidate) => {
        const dependencies =
          candidate.dataDependencies;

        if (
          !Array.isArray(dependencies) ||
          dependencies.length === 0 ||
          !isObject(dependencies[0]) ||
          dependencies[0].type !==
            "query"
        ) {
          return false;
        }

        dependencies[0].cachePolicy =
          "unspecified";

        return true;
      }
    );

    add(
      "query-state-owner-without-data-owner",
      "Assign query-owned component state to an unknown data owner.",
      (candidate) => {
        const componentMap =
          candidate.componentMap;

        if (
          !Array.isArray(componentMap) ||
          componentMap.length === 0 ||
          !isObject(componentMap[0])
        ) {
          return false;
        }

        componentMap[0].stateOwner =
          "query-owned";

        componentMap[0].dataOwner =
          "missing-query-owner";

        return true;
      }
    );

    add(
      "remove-data-ownership-fields",
      "Remove optional ownership fields from one data dependency.",
      (candidate) => {
        const dependencies =
          candidate.dataDependencies;

        if (
          !Array.isArray(dependencies) ||
          dependencies.length === 0 ||
          !isObject(dependencies[0])
        ) {
          return false;
        }

        const before =
          JSON.stringify(
            dependencies[0]
          );

        deleteOwnershipFields(
          dependencies[0]
        );

        return (
          JSON.stringify(
            dependencies[0]
          ) !== before
        );
      }
    );

    add(
      "add-unowned-data-dependency",
      "Add a new data dependency without adding component ownership coverage.",
      (candidate) => {
        const dependencies =
          candidate.dataDependencies;

        if (
          !Array.isArray(dependencies) ||
          dependencies.length === 0 ||
          !isObject(dependencies[0])
        ) {
          return false;
        }

        const ids =
          collectIds(dependencies);

        const clonedDependency =
          clone(dependencies[0]);

        clonedDependency.id =
          uniqueKebabId(
            "unowned-dependency",
            ids
          );

        deleteOwnershipFields(
          clonedDependency
        );

        dependencies.push(
          clonedDependency
        );

        return true;
      }
    );

    add(
      "stateless-component-with-data",
      "Mark one mapped component as stateless while retaining its data relationships.",
      (candidate) => {
        const componentMap =
          candidate.componentMap;

        if (
          !Array.isArray(componentMap)
        ) {
          return false;
        }

        const item =
          componentMap.find(
            (entry) => {
              return (
                isObject(entry) &&
                typeof entry.stateOwner ===
                  "string" &&
                entry.stateOwner !==
                  "stateless"
              );
            }
          );

        if (!item) {
          return false;
        }

        item.stateOwner =
          "stateless";

        return true;
      }
    );
  }

  return candidates;
}


function toCamelId(value) {
  const normalized = String(value)
    .trim()
    .replace(
      /[^A-Za-z0-9]+(.)/g,
      (
        _match,
        character
      ) => {
        return character
          ? character.toUpperCase()
          : "";
      }
    )
    .replace(
      /^[^A-Za-z]+/,
      ""
    );

  if (!normalized) {
    return "mainRegion";
  }

  return (
    normalized[0].toLowerCase() +
    normalized.slice(1)
  );
}

function normalizeAuditorReadyScreen({
  document,
  recipe
}) {
  const normalized =
    clone(document);

  if (!isObject(normalized.screen)) {
    throw new Error(
      "The screen specification has no screen object."
    );
  }

  if (!isObject(normalized.recipe)) {
    throw new Error(
      "The screen specification has no recipe object."
    );
  }

  const recipeId = (
    recipe?.meta?.id ??
    recipe?.id ??
    normalized.recipe.id
  );

  if (
    typeof recipeId !== "string" ||
    recipeId.trim() === ""
  ) {
    throw new Error(
      "The selected layout recipe has no usable ID."
    );
  }

  const recipeRegions = Array.isArray(
    recipe?.regions
  )
    ? recipe.regions.filter(
        (region) => {
          return (
            isObject(region) &&
            typeof region.id === "string" &&
            region.id.trim() !== ""
          );
        }
      )
    : [];

  if (recipeRegions.length === 0) {
    throw new Error(
      `Recipe '${recipeId}' has no usable regions.`
    );
  }

  normalized.screen.id =
    "dashboard-overview";

  normalized.meta.id =
    "dashboard-overview-specification";

  if (
    typeof recipe?.meta?.category ===
    "string"
  ) {
    normalized.screen.category =
      recipe.meta.category;
  } else {
    normalized.screen.category =
      "dashboard";
  }

  normalized.recipe.id =
    recipeId;

  const originalMapping =
    Array.isArray(
      normalized.recipe.regions
    ) &&
    isObject(
      normalized.recipe.regions[0]
    )
      ? normalized.recipe.regions[0]
      : {};

  const regionMappings =
    recipeRegions.map(
      (region, index) => {
        const screenRegionId =
          toCamelId(
            `screen-${region.id}`
          );

        return {
          ...clone(originalMapping),
          recipeRegionId:
            region.id,
          screenRegionId,
        };
      }
    );

  normalized.recipe.regions =
    regionMappings;

  const screenRegionIds =
    regionMappings.map(
      (mapping) => {
        return mapping.screenRegionId;
      }
    );

  const primaryRegionId =
    screenRegionIds[0];

  const dependencyId =
    "primary-dependency";

  const actionId =
    "primary-action";

  const componentPlan = [
    {
      component:
        "PageHeader",
      catalogSource:
        "assets/catalog/layout-components.json"
    },
    {
      component:
        "MetricGroup",
      catalogSource:
        "assets/catalog/data-display-analytical-components.json"
    },
    {
      component:
        "DataTable",
      catalogSource:
        "assets/catalog/data-display-collection-components.json"
    },
    {
      component:
        "Section",
      catalogSource:
        "assets/catalog/layout-components.json"
    },
    {
      component:
        "Stack",
      catalogSource:
        "assets/catalog/layout-components.json"
    },
    {
      component:
        "InlineAlert",
      catalogSource:
        "assets/catalog/feedback-components.json"
    }
  ];

  const originalComponentUsage =
    Array.isArray(
      normalized.componentMap
    ) &&
    isObject(
      normalized.componentMap[0]
    )
      ? normalized.componentMap[0]
      : {};

  normalized.componentMap =
    regionMappings.map(
      (
        mapping,
        index
      ) => {
        const plan =
          componentPlan[
            index %
            componentPlan.length
          ];

        return {
          ...clone(
            originalComponentUsage
          ),
          id:
            `region-${index + 1}-component`,
          regionId:
            mapping.screenRegionId,
          component:
            plan.component,
          catalogSource:
            plan.catalogSource,
          responsibility:
            (
              `Render the content and interactions ` +
              `owned by ${mapping.screenRegionId}.`
            ),
          reuseStatus:
            "canonical",
          stateOwner:
            "query-owned",
          dataOwner:
            dependencyId,
          interactionOwner:
            actionId,
          states: [
            "loading",
            "default",
            "empty",
            "error"
          ]
        };
      }
    );

  if (
    !Array.isArray(
      normalized.dataDependencies
    ) ||
    normalized.dataDependencies.length ===
      0 ||
    !isObject(
      normalized.dataDependencies[0]
    )
  ) {
    throw new Error(
      "The screen specification has no usable data dependency."
    );
  }

  const dataDependency =
    normalized.dataDependencies[0];

  dataDependency.id =
    dependencyId;

  dataDependency.type =
    "query";

  dataDependency.purpose =
    "Load the authoritative dashboard view model.";

  dataDependency.owner =
    "dashboard-query";

  dataDependency.authoritativeSource =
    "Server API represented through the feature data boundary.";

  dataDependency.contract =
    "Typed dashboard query contract.";

  dataDependency.mapping =
    (
      "Map transport DTOs to frontend models and " +
      "view models before presentation components render them."
    );

  dataDependency.loadingBehavior =
    (
      "Use initial-loading state for the first request " +
      "and preserve visible data during background refresh."
    );

  dataDependency.emptyBehavior =
    "Render the explicit empty state.";

  dataDependency.errorBehavior =
    (
      "Normalize transport failures at the feature data boundary " +
      "and expose safe screen-level error state."
    );

  dataDependency.staleBehavior =
    (
      "Retain visible data and display freshness information " +
      "during background refresh."
    );

  dataDependency.permissionBehavior =
    (
      "Treat server authorization as authoritative and " +
      "map denied access to the forbidden state."
    );

  dataDependency.cachePolicy =
    (
      "Cache by dashboard query key with an explicit " +
      "freshness window and background revalidation."
    );

  dataDependency.retryPolicy =
    (
      "Retry only transient failures with bounded backoff " +
      "and expose manual recovery after exhaustion."
    );

  dataDependency.cancellationPolicy =
    (
      "Abort obsolete requests when route scope or query " +
      "parameters change."
    );

  dataDependency.invalidationPolicy =
    (
      "Invalidate the dashboard query after successful " +
      "authoritative mutations."
    );

  normalized.dataDependencies = [
    dataDependency
  ];

  if (
    !Array.isArray(
      normalized.actions
    ) ||
    normalized.actions.length ===
      0 ||
    !isObject(
      normalized.actions[0]
    )
  ) {
    throw new Error(
      "The screen specification has no usable action."
    );
  }

  const primaryAction =
    normalized.actions[0];

  primaryAction.id =
    actionId;

  primaryAction.label =
    "Refresh dashboard";

  primaryAction.kind =
    "primary";

  primaryAction.regionId =
    primaryRegionId;

  primaryAction.owner =
    "dashboard-workflow";

  primaryAction.permission =
    "view-dashboard";

  primaryAction.eligibility =
    (
      "Enabled when the user may view the dashboard " +
      "and no equivalent request is already pending."
    );

  primaryAction.confirmation =
    "none";

  primaryAction.pendingBehavior =
    (
      "Disable duplicate activation and show " +
      "background progress."
    );

  primaryAction.successBehavior =
    (
      "Replace the dashboard view model with the " +
      "authoritative refreshed result."
    );

  primaryAction.errorBehavior =
    (
      "Normalize the error and retain the last safe " +
      "dashboard state when available."
    );

  primaryAction.duplicatePrevention =
    (
      "Disable while pending and deduplicate requests " +
      "by dashboard query key."
    );

  normalized.actions = [
    primaryAction
  ];

  if (isObject(normalized.architecture)) {
    normalized.architecture.errorStrategy =
      (
        "Normalize transport and domain errors in the feature " +
        "data boundary, map them to screen states, and present " +
        "safe recovery guidance through feedback components."
      );
  }

  if (!Array.isArray(normalized.states)) {
    throw new Error(
      "The screen specification has no states collection."
    );
  }

  normalized.states =
    normalized.states.map(
      (state) => {
        if (!isObject(state)) {
          return state;
        }

        const updatedState =
          clone(state);

        updatedState.visibleRegions =
          [...screenRegionIds];

        updatedState.hiddenRegions =
          [];

        updatedState.componentStates =
          normalized.componentMap.map(
            (usage) => {
              return {
                componentUsageId:
                  usage.id,
                state:
                  updatedState.category ===
                  "initial-loading"
                    ? "loading"
                    : "default",
                notes:
                  null
              };
            }
          );

        if (
          updatedState.category ===
          "initial-loading" ||
          updatedState.category ===
          "processing"
        ) {
          updatedState.enabledActions =
            [];

          updatedState.disabledActions =
            [
              {
                actionId,
                reason:
                  "Unavailable while authoritative data is loading."
              }
            ];
        } else {
          updatedState.enabledActions =
            [
              actionId
            ];

          updatedState.disabledActions =
            [];
        }

        return updatedState;
      }
    );


  // 9C.2B.1 auditor-ready reference and component overrides.

  if (!isObject(normalized.meta)) {
    throw new Error(
      "The screen specification has no meta object."
    );
  }

  normalized.meta.source =
    "docs/frontend/screens/dashboard-overview/screen-spec.json";

  if (!isObject(normalized.productContext)) {
    throw new Error(
      "The screen specification has no productContext object."
    );
  }

  normalized.productContext.source =
    "docs/frontend/product-context.md";

  if (!isObject(normalized.visualDirection)) {
    throw new Error(
      "The screen specification has no visualDirection object."
    );
  }

  normalized.visualDirection.source =
    "docs/frontend/design-direction.md";

  if (!isObject(normalized.architecture)) {
    throw new Error(
      "The screen specification has no architecture object."
    );
  }

  normalized.architecture.source =
    "docs/frontend/frontend-architecture.md";

  normalized.architecture.integrationContracts =
    [
      "docs/frontend/integrations/dashboard-overview.md"
    ];

  if (
    !Array.isArray(normalized.componentMap) ||
    normalized.componentMap.length === 0
  ) {
    throw new Error(
      "The normalized screen has no component-map entries."
    );
  }

  for (const usage of normalized.componentMap) {
    if (!isObject(usage)) {
      throw new Error(
        "The normalized component map contains a non-object entry."
      );
    }

    /*
     * Null means that the screen does not select an optional
     * registered variant or size. "default" is registered by
     * every component used by this temporary test specification.
     */
    usage.variant =
      null;

    usage.size =
      null;

    usage.states =
      [
        "default"
      ];
  }

  if (!Array.isArray(normalized.states)) {
    throw new Error(
      "The normalized screen has no states collection."
    );
  }

  for (const state of normalized.states) {
    if (!isObject(state)) {
      throw new Error(
        "The normalized states collection contains a non-object entry."
      );
    }

    state.componentStates =
      normalized.componentMap.map(
        (usage) => {
          return {
            componentUsageId:
              usage.id,
            state:
              "default",
            notes:
              null
          };
        }
      );
  }

  if (
    !Array.isArray(normalized.dataDependencies) ||
    normalized.dataDependencies.length === 0 ||
    !isObject(normalized.dataDependencies[0])
  ) {
    throw new Error(
      "The normalized screen has no usable data dependency."
    );
  }

  normalized.dataDependencies[0].fixtureSource =
    "fixtures/dashboard-overview.json";

  return normalized;
}


async function copyRequiredAssets({
  skillRoot,
  repositoryRoot
}) {
  const sourceAssets = path.join(
    skillRoot,
    "assets"
  );

  const destinationAssets = path.join(
    repositoryRoot,
    "assets"
  );

  await fs.mkdir(
    destinationAssets,
    {
      recursive: true
    }
  );

  for (const directory of [
    "schemas",
    "catalog",
    "recipes",
    "templates"
  ]) {
    const source = path.join(
      sourceAssets,
      directory
    );

    const destination = path.join(
      destinationAssets,
      directory
    );

    if (
      await pathType(source) !==
      "directory"
    ) {
      throw new Error(
        `Required asset directory is missing: ${source}`
      );
    }

    await fs.cp(
      source,
      destination,
      {
        recursive: true
      }
    );
  }
}

async function initializeGitRepository(
  repositoryRoot
) {
  const commands = [
    [
      "init",
      "--quiet"
    ],
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
      "Create screen-auditor integration baseline"
    ]
  ];

  for (const args of commands) {
    const result = runProcess({
      command: "git",
      args,
      cwd: repositoryRoot
    });

    if (result.status !== 0) {
      throw new Error(
        `Git command failed: git ${args.join(" ")}\n` +
        combinedOutput(result)
      );
    }
  }
}

async function prepareRepository({
  skillRoot,
  repositoryRoot
}) {
  await copyRequiredAssets({
    skillRoot,
    repositoryRoot
  });

  const sourceFixture = path.join(
    skillRoot,
    VALID_SCREEN_FIXTURE
  );

  if (
    await pathType(sourceFixture) !==
    "file"
  ) {
    throw new Error(
      `Valid screen fixture is missing: ${sourceFixture}`
    );
  }

  const specificationFile = path.join(
    repositoryRoot,
    "contracts",
    "screen-specification.valid.json"
  );

  await fs.mkdir(
    path.dirname(specificationFile),
    {
      recursive: true
    }
  );

  await fs.copyFile(
    sourceFixture,
    specificationFile
  );

  const sourceSpecification =
    await readJson(
      specificationFile
    );

  const selectedRecipeId = (
    sourceSpecification?.recipe?.id ??
    "dashboard"
  );

  const selectedRecipeFile =
    path.join(
      repositoryRoot,
      "assets/recipes",
      `${selectedRecipeId}.recipe.json`
    );

  if (
    await pathType(
      selectedRecipeFile
    ) !== "file"
  ) {
    throw new Error(
      `Selected recipe is missing: ${selectedRecipeFile}`
    );
  }

  const selectedRecipe =
    await readJson(
      selectedRecipeFile
    );

  const auditorReadySpecification =
    normalizeAuditorReadyScreen({
      document:
        sourceSpecification,
      recipe:
        selectedRecipe
    });

  await writeJson(
    specificationFile,
    auditorReadySpecification
  );

  // 9C.2B.1 temporary reference files.

  const conventionalSpecificationFile =
    path.join(
      repositoryRoot,
      auditorReadySpecification.meta.source
    );

  await writeJson(
    conventionalSpecificationFile,
    auditorReadySpecification
  );

  const temporaryReferenceDocuments = [
    {
      relativePath:
        auditorReadySpecification.productContext.source,
      title:
        "Product Context",
      body:
        "Temporary product context for screen-auditor integration tests."
    },
    {
      relativePath:
        auditorReadySpecification.visualDirection.source,
      title:
        "Design Direction",
      body:
        "Temporary visual direction for screen-auditor integration tests."
    },
    {
      relativePath:
        auditorReadySpecification.architecture.source,
      title:
        "Frontend Architecture",
      body:
        "Temporary frontend architecture for screen-auditor integration tests."
    }
  ];

  for (
    const referenceDocument of
    temporaryReferenceDocuments
  ) {
    const referenceFile = path.join(
      repositoryRoot,
      referenceDocument.relativePath
    );

    await fs.mkdir(
      path.dirname(referenceFile),
      {
        recursive: true
      }
    );

    await fs.writeFile(
      referenceFile,
      [
        `# ${referenceDocument.title}`,
        "",
        referenceDocument.body,
        ""
      ].join("\n"),
      "utf8"
    );
  }

  for (
    const integrationContract of
    auditorReadySpecification
      .architecture
      .integrationContracts
  ) {
    const integrationFile = path.join(
      repositoryRoot,
      integrationContract
    );

    await fs.mkdir(
      path.dirname(integrationFile),
      {
        recursive: true
      }
    );

    await fs.writeFile(
      integrationFile,
      [
        "# Dashboard Integration Contract",
        "",
        "Temporary integration contract for screen-auditor tests.",
        ""
      ].join("\n"),
      "utf8"
    );
  }

  const fixtureFile = path.join(
    repositoryRoot,
    auditorReadySpecification
      .dataDependencies[0]
      .fixtureSource
  );

  await writeJson(
    fixtureFile,
    {
      generatedFor:
        "screen-auditor-integration-test",
      items:
        []
    }
  );


  await fs.writeFile(
    path.join(
      repositoryRoot,
      "README.md"
    ),
    [
      "# Screen Auditor Integration Test",
      "",
      "Temporary repository generated by the skill test runner.",
      ""
    ].join("\n"),
    "utf8"
  );

  await initializeGitRepository(
    repositoryRoot
  );

  return {
    specificationFile,
    schemaFile: path.join(
      repositoryRoot,
      SCREEN_SCHEMA
    )
  };
}

async function selectValidInvocation({
  scriptPath,
  target,
  skillRoot,
  repositoryRoot,
  specificationFile,
  schemaFile
}) {
  const source = await fs.readFile(
    scriptPath,
    "utf8"
  );

  const detectedOptions =
    extractCliOptions(source);

  const candidates =
    buildInvocationCandidates({
      detectedOptions,
      skillRoot,
      repositoryRoot,
      specificationFile,
      schemaFile
    });

  const attempts = [];

  for (const candidate of candidates) {
    const result = runProcess({
      command: "node",
      args: [
        scriptPath,
        ...candidate.args
      ],
      cwd: repositoryRoot
    });

    attempts.push({
      args: candidate.args,
      status: result.status,
      usageFailure:
        looksLikeUsageFailure(result),
      infrastructureFailure:
        looksLikeInfrastructureFailure(
          result
        ),
      output:
        combinedOutput(result)
          .slice(0, 5000)
    });

    if (
      result.status === 0 &&
      !looksLikeUsageFailure(result) &&
      !looksLikeInfrastructureFailure(
        result
      )
    ) {
      return {
        selected: {
          args: candidate.args,
          result
        },
        attempts,
        detectedOptions:
          [...detectedOptions].sort()
      };
    }
  }

  return {
    selected: null,
    attempts,
    detectedOptions:
      [...detectedOptions].sort()
  };
}

async function selectRejectedMutation({
  scriptPath,
  selectedValidArgs,
  validFile,
  mutationCandidates,
  validateSchema,
  repositoryRoot,
  targetId
}) {
  const attempts = [];
  let schemaValidMutations = 0;

  for (
    let index = 0;
    index < mutationCandidates.length;
    index += 1
  ) {
    const mutation =
      mutationCandidates[index];

    const schemaValid =
      Boolean(
        validateSchema(
          mutation.document
        )
      );

    if (!schemaValid) {
      attempts.push({
        mutationId:
          mutation.id,
        description:
          mutation.description,
        skipped:
          "Mutation is not schema-valid.",
        schemaErrors:
          structuredClone(
            validateSchema.errors ?? []
          )
      });

      continue;
    }

    schemaValidMutations += 1;

    const invalidFile = path.join(
      repositoryRoot,
      "contracts",
      `${targetId}.invalid-${index + 1}-${mutation.id}.json`
    );

    await writeJson(
      invalidFile,
      mutation.document
    );

    const invalidArgs =
      replaceInputPath({
        args:
          selectedValidArgs,
        from:
          validFile,
        to:
          invalidFile
      });

    const result = runProcess({
      command: "node",
      args: [
        scriptPath,
        ...invalidArgs
      ],
      cwd: repositoryRoot
    });

    const usageFailure =
      looksLikeUsageFailure(result);

    const infrastructureFailure =
      looksLikeInfrastructureFailure(
        result
      );

    attempts.push({
      mutationId:
        mutation.id,
      description:
        mutation.description,
      file:
        invalidFile,
      args:
        invalidArgs,
      status:
        result.status,
      usageFailure,
      infrastructureFailure,
      output:
        combinedOutput(result)
          .slice(0, 6000)
    });

    if (
      result.status !== 0 &&
      !usageFailure &&
      !infrastructureFailure
    ) {
      return {
        selected: {
          mutationId:
            mutation.id,
          description:
            mutation.description,
          file:
            invalidFile,
          args:
            invalidArgs,
          result
        },
        attempts,
        schemaValidMutations
      };
    }
  }

  return {
    selected: null,
    attempts,
    schemaValidMutations
  };
}

async function testTarget({
  skillRoot,
  repositoryRoot,
  specificationFile,
  schemaFile,
  sourceDocument,
  validateSchema,
  target
}) {
  const scriptPath = path.join(
    skillRoot,
    target.script
  );

  if (
    await pathType(scriptPath) !==
    "file"
  ) {
    return {
      id: target.id,
      script:
        target.script,
      passed: false,
      syntaxPassed: false,
      validPassed: false,
      invalidRejected: false,
      failure:
        "Script is missing.",
      attempts: []
    };
  }

  const syntaxResult = runProcess({
    command: "node",
    args: [
      "--check",
      scriptPath
    ],
    cwd: repositoryRoot
  });

  if (syntaxResult.status !== 0) {
    return {
      id: target.id,
      script:
        target.script,
      passed: false,
      syntaxPassed: false,
      validPassed: false,
      invalidRejected: false,
      failure:
        "Script syntax validation failed.",
      syntaxResult,
      attempts: []
    };
  }

  const validSelection =
    await selectValidInvocation({
      scriptPath,
      target,
      skillRoot,
      repositoryRoot,
      specificationFile,
      schemaFile
    });

  if (!validSelection.selected) {
    return {
      id: target.id,
      script:
        target.script,
      passed: false,
      syntaxPassed: true,
      validPassed: false,
      invalidRejected: false,
      detectedOptions:
        validSelection.detectedOptions,
      failure:
        "No CLI invocation accepted the valid screen specification.",
      attempts:
        validSelection.attempts
    };
  }

  const mutationCandidates =
    createMutationCandidates(
      sourceDocument,
      target.mutationGroups
    );

  const invalidSelection =
    await selectRejectedMutation({
      scriptPath,
      selectedValidArgs:
        validSelection.selected.args,
      validFile:
        specificationFile,
      mutationCandidates,
      validateSchema,
      repositoryRoot,
      targetId:
        target.id
    });

  const invalidRejected =
    Boolean(
      invalidSelection.selected
    );

  return {
    id: target.id,
    script:
      target.script,
    passed:
      invalidRejected,
    syntaxPassed: true,
    validPassed: true,
    invalidRejected,
    detectedOptions:
      validSelection.detectedOptions,
    selectedInvocation: {
      validArgs:
        validSelection.selected.args,
      validStatus:
        validSelection.selected
          .result.status,
      invalidArgs:
        invalidSelection.selected
          ?.args ?? null,
      invalidStatus:
        invalidSelection.selected
          ?.result.status ?? null
    },
    selectedMutation:
      invalidSelection.selected
        ? {
            id:
              invalidSelection.selected
                .mutationId,
            description:
              invalidSelection.selected
                .description,
            file:
              invalidSelection.selected
                .file
          }
        : null,
    validOutput:
      combinedOutput(
        validSelection.selected.result
      ).slice(0, 6000),
    invalidOutput:
      invalidSelection.selected
        ? combinedOutput(
            invalidSelection.selected
              .result
          ).slice(0, 6000)
        : "",
    schemaValidMutations:
      invalidSelection
        .schemaValidMutations,
    validAttempts:
      validSelection.attempts,
    invalidAttempts:
      invalidSelection.attempts,
    failure:
      invalidRejected
        ? null
        : (
            "No schema-valid mutation was rejected by the auditor."
          )
  };
}

function summarize(results) {
  return {
    scriptsExpected:
      TARGETS.length,

    scriptsDiscovered:
      results.filter(
        (result) => {
          return result.failure !==
            "Script is missing.";
        }
      ).length,

    syntaxChecksPassed:
      results.filter(
        (result) => {
          return result.syntaxPassed;
        }
      ).length,

    validCasesPassed:
      results.filter(
        (result) => {
          return result.validPassed;
        }
      ).length,

    invalidCasesRejected:
      results.filter(
        (result) => {
          return result.invalidRejected;
        }
      ).length,

    expectationMismatches:
      results.filter(
        (result) => {
          return !result.passed;
        }
      ).length
  };
}

function printReport(report) {
  process.stdout.write(
    "Frontend Product Builder — Screen Auditor Integration Tests\n"
  );

  process.stdout.write(
    "===========================================================\n"
  );

  process.stdout.write(
    `Skill root: ${report.meta.skillRoot}\n`
  );

  process.stdout.write(
    `Temporary Git repository: ${report.meta.repositoryRoot}\n`
  );

  process.stdout.write(
    `Scripts expected: ${report.metrics.scriptsExpected}\n`
  );

  process.stdout.write(
    `Scripts discovered: ${report.metrics.scriptsDiscovered}\n`
  );

  process.stdout.write(
    `Syntax checks passed: ${report.metrics.syntaxChecksPassed}\n`
  );

  process.stdout.write(
    `Valid cases passed: ${report.metrics.validCasesPassed}\n`
  );

  process.stdout.write(
    `Invalid cases rejected: ${report.metrics.invalidCasesRejected}\n`
  );

  process.stdout.write(
    `Expectation mismatches: ${report.metrics.expectationMismatches}\n\n`
  );

  for (const result of report.results) {
    const status =
      result.passed
        ? "PASS"
        : "FAIL";

    process.stdout.write(
      `[${status}] ${result.id}\n`
    );

    process.stdout.write(
      `Script: ${result.script}\n`
    );

    process.stdout.write(
      `Syntax: ${result.syntaxPassed ? "passed" : "failed"}\n`
    );

    process.stdout.write(
      `Valid specification: ${result.validPassed ? "accepted" : "not accepted"}\n`
    );

    process.stdout.write(
      `Invalid mutation: ${result.invalidRejected ? "rejected" : "not rejected"}\n`
    );

    if (result.selectedMutation) {
      process.stdout.write(
        `Selected mutation: ${result.selectedMutation.id}\n`
      );

      process.stdout.write(
        `Mutation description: ${result.selectedMutation.description}\n`
      );
    }

    if (result.selectedInvocation) {
      process.stdout.write(
        `Valid arguments: ${JSON.stringify(
          result.selectedInvocation.validArgs
        )}\n`
      );

      process.stdout.write(
        `Invalid arguments: ${JSON.stringify(
          result.selectedInvocation.invalidArgs
        )}\n`
      );
    }

    if (result.failure) {
      process.stdout.write(
        `Failure: ${result.failure}\n`
      );

      const validAttempts =
        result.validAttempts ??
        result.attempts ??
        [];

      const invalidAttempts =
        result.invalidAttempts ??
        [];

      for (
        const attempt of
        validAttempts.slice(-3)
      ) {
        process.stdout.write(
          `Valid attempt: ${JSON.stringify(
            attempt.args
          )}\n`
        );

        process.stdout.write(
          `Exit: ${attempt.status}\n`
        );

        if (attempt.output) {
          process.stdout.write(
            `${attempt.output.slice(0, 1800)}\n`
          );
        }
      }

      for (
        const attempt of
        invalidAttempts.slice(-5)
      ) {
        process.stdout.write(
          `Mutation attempt: ${attempt.mutationId}\n`
        );

        if (attempt.skipped) {
          process.stdout.write(
            `${attempt.skipped}\n`
          );

          continue;
        }

        process.stdout.write(
          `Exit: ${attempt.status}\n`
        );

        if (attempt.output) {
          process.stdout.write(
            `${attempt.output.slice(0, 1800)}\n`
          );
        }
      }
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

  if (
    await pathType(skillRoot) !==
    "directory"
  ) {
    throw new Error(
      `Skill root is invalid: ${skillRoot}`
    );
  }

  const repositoryRoot =
    await fs.mkdtemp(
      path.join(
        os.tmpdir(),
        "frontend-product-builder-9c2b1-"
      )
    );

  let report;

  try {
    const prepared =
      await prepareRepository({
        skillRoot,
        repositoryRoot
      });

    const schema =
      await readJson(
        prepared.schemaFile
      );

    const validateSchema =
      createAjv().compile(
        schema
      );

    const sourceDocument =
      await readJson(
        prepared.specificationFile
      );

    if (
      !validateSchema(
        sourceDocument
      )
    ) {
      throw new Error(
        "The valid screen fixture no longer validates against its schema:\n" +
        JSON.stringify(
          validateSchema.errors,
          null,
          2
        )
      );
    }

    const results = [];

    for (const target of TARGETS) {
      results.push(
        await testTarget({
          skillRoot,
          repositoryRoot,
          specificationFile:
            prepared.specificationFile,
          schemaFile:
            prepared.schemaFile,
          sourceDocument,
          validateSchema,
          target
        })
      );
    }

    const metrics =
      summarize(results);

    report = {
      meta: {
        skillRoot,
        repositoryRoot,
        generatedAt:
          new Date().toISOString(),
        temporaryRepositoryKept:
          options.keepTemporaryRepository ||
          metrics.expectationMismatches >
            0
      },

      metrics,
      results
    };

    const reportPath = path.join(
      skillRoot,
      "evals/files/contracts/screen-auditor-integration-report.json"
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
      metrics.expectationMismatches >
      0
    )
      ? 1
      : 0;
  } finally {
    const shouldKeep = (
      options.keepTemporaryRepository ||
      (
        report &&
        report.metrics
          .expectationMismatches > 0
      )
    );

    if (!shouldKeep) {
      await fs.rm(
        repositoryRoot,
        {
          recursive: true,
          force: true
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
