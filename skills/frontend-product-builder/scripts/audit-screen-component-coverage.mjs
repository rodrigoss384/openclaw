#!/usr/bin/env node

import {
  IssueCollector,
  asArray,
  findCatalogComponent,
  parseCliArgs,
  pathExists,
  readJsonFile,
  requireInputPath,
  resolveFromCwd,
  setExitCode
} from "./lib/screen-contract-utils.mjs";

const USAGE = [
  "node audit-screen-component-coverage.mjs <screen-spec.json>",
  "  [--strict-warnings]",
  "  [--json]"
].join(" ");

const ACTIVE_REGION_STATUSES = new Set([
  "required",
  "optional-used",
  "extended",
  "replaced"
]);

function getRegionUsageMap(specification) {
  const usageMap = new Map();

  for (const usage of asArray(specification?.componentMap)) {
    const current = usageMap.get(usage?.regionId) ?? [];
    current.push(usage);
    usageMap.set(usage?.regionId, current);
  }

  return usageMap;
}

function validateRegionCoverage(specification, collector) {
  const usageMap = getRegionUsageMap(specification);

  asArray(specification?.recipe?.regions).forEach(
    (region, index) => {
      const regionId = region?.screenRegionId;
      const usages = usageMap.get(regionId) ?? [];
      const location = `$.recipe.regions[${index}]`;

      if (
        ACTIVE_REGION_STATUSES.has(region?.status) &&
        usages.length === 0
      ) {
        collector.error(
          "SCREEN_COMPONENT_REGION_UNMAPPED",
          `Active region '${regionId}' has no component usage.`,
          location
        );

        return;
      }

      if (
        region?.status === "optional-omitted" &&
        usages.length > 0
      ) {
        collector.warning(
          "SCREEN_COMPONENT_OMITTED_REGION_USED",
          `Region '${regionId}' is marked optional-omitted but has ` +
          `${usages.length} component usage entries.`,
          location
        );

        return;
      }

      collector.info(
        "SCREEN_COMPONENT_REGION_COVERED",
        `Region '${regionId}' has ${usages.length} component usage ` +
        `entry or entries.`,
        location
      );
    }
  );
}

function validateReuseContracts(specification, collector) {
  asArray(specification?.componentMap).forEach((usage, index) => {
    const location = `$.componentMap[${index}]`;

    if (
      usage?.reuseStatus === "extended" &&
      !usage?.extensionContract
    ) {
      collector.error(
        "SCREEN_COMPONENT_EXTENSION_CONTRACT",
        `Extended component usage '${usage?.id}' requires an ` +
        "extensionContract.",
        `${location}.extensionContract`
      );
    }

    if (
      usage?.reuseStatus === "new-proposed" &&
      !usage?.proposedComponentContract
    ) {
      collector.error(
        "SCREEN_COMPONENT_PROPOSAL_CONTRACT",
        `New proposed component usage '${usage?.id}' requires a ` +
        "proposedComponentContract.",
        `${location}.proposedComponentContract`
      );
    }

    if (
      usage?.reuseStatus === "canonical" &&
      usage?.extensionContract
    ) {
      collector.warning(
        "SCREEN_COMPONENT_CANONICAL_EXTENSION",
        `Canonical component usage '${usage?.id}' has an ` +
        "extensionContract.",
        `${location}.extensionContract`
      );
    }

    if (
      usage?.reuseStatus === "canonical" &&
      usage?.proposedComponentContract
    ) {
      collector.warning(
        "SCREEN_COMPONENT_CANONICAL_PROPOSAL",
        `Canonical component usage '${usage?.id}' has a ` +
        "proposedComponentContract.",
        `${location}.proposedComponentContract`
      );
    }

    if (
      usage?.reuseStatus === "feature-specific" &&
      usage?.stateOwner === "stateless" &&
      usage?.interactionOwner === "none"
    ) {
      collector.warning(
        "SCREEN_COMPONENT_FEATURE_SPECIFIC_EMPTY",
        `Feature-specific usage '${usage?.id}' appears to have no ` +
        "feature behavior. Confirm that it does not duplicate a " +
        "shared composition.",
        location
      );
    }
  });
}

async function loadCatalog(catalogPath, cache) {
  const resolvedPath = resolveFromCwd(catalogPath);

  if (cache.has(resolvedPath)) {
    return cache.get(resolvedPath);
  }

  if (!(await pathExists(resolvedPath))) {
    cache.set(resolvedPath, null);
    return null;
  }

  const catalog = await readJsonFile(resolvedPath);
  cache.set(resolvedPath, catalog);
  return catalog;
}

function validateUsageAgainstComponentContract({
  usage,
  usageIndex,
  component,
  collector
}) {
  const location = `$.componentMap[${usageIndex}]`;

  if (
    usage?.variant &&
    component?.variants &&
    !(usage.variant in component.variants)
  ) {
    const severity = usage.reuseStatus === "extended"
      ? "warning"
      : "error";

    collector[severity](
      "SCREEN_COMPONENT_VARIANT_UNKNOWN",
      `Variant '${usage.variant}' is not registered for component ` +
      `'${usage.component}'.`,
      `${location}.variant`
    );
  }

  if (
    usage?.size &&
    component?.sizes &&
    !(usage.size in component.sizes)
  ) {
    const severity = usage.reuseStatus === "extended"
      ? "warning"
      : "error";

    collector[severity](
      "SCREEN_COMPONENT_SIZE_UNKNOWN",
      `Size '${usage.size}' is not registered for component ` +
      `'${usage.component}'.`,
      `${location}.size`
    );
  }

  const supportedStates = new Set(asArray(component?.states));

  asArray(usage?.states).forEach((state, stateIndex) => {
    if (supportedStates.has(state)) {
      return;
    }

    const severity = usage.reuseStatus === "extended"
      ? "warning"
      : "error";

    collector[severity](
      "SCREEN_COMPONENT_STATE_UNKNOWN",
      `State '${state}' is not registered for component ` +
      `'${usage.component}'.`,
      `${location}.states[${stateIndex}]`
    );
  });
}

async function validateCatalogContracts(
  specification,
  collector
) {
  const catalogCache = new Map();

  for (
    const [index, usage] of asArray(
      specification?.componentMap
    ).entries()
  ) {
    const location = `$.componentMap[${index}]`;

    if (
      usage?.reuseStatus === "new-proposed" ||
      usage?.reuseStatus === "feature-specific"
    ) {
      collector.info(
        "SCREEN_COMPONENT_NONCATALOG_USAGE",
        `Usage '${usage?.id}' is classified as ` +
        `'${usage?.reuseStatus}' and requires its own approved ` +
        "contract evidence.",
        location
      );

      continue;
    }

    if (!usage?.catalogSource) {
      collector.error(
        "SCREEN_COMPONENT_CATALOG_SOURCE",
        `Usage '${usage?.id}' has no catalogSource.`,
        `${location}.catalogSource`
      );

      continue;
    }

    let catalogFile;

    try {
      catalogFile = await loadCatalog(
        usage.catalogSource,
        catalogCache
      );
    } catch (error) {
      collector.error(
        "SCREEN_COMPONENT_CATALOG_READ",
        error.message,
        `${location}.catalogSource`
      );

      continue;
    }

    if (!catalogFile) {
      collector.error(
        "SCREEN_COMPONENT_CATALOG_MISSING",
        `Catalog source for usage '${usage?.id}' does not exist.`,
        `${location}.catalogSource`,
        resolveFromCwd(usage.catalogSource)
      );

      continue;
    }

    const component = findCatalogComponent(
      catalogFile.value,
      usage.component
    );

    if (!component) {
      collector.error(
        "SCREEN_COMPONENT_NOT_IN_CATALOG",
        `Component '${usage.component}' was not found in catalog ` +
        `'${usage.catalogSource}'.`,
        `${location}.component`
      );

      continue;
    }

    collector.info(
      "SCREEN_COMPONENT_CATALOG_MATCH",
      `Component '${usage.component}' was found in its declared ` +
      "catalog.",
      location,
      catalogFile.path
    );

    validateUsageAgainstComponentContract({
      usage,
      usageIndex: index,
      component,
      collector
    });
  }
}

function validateResponsibilityContent(
  specification,
  collector
) {
  asArray(specification?.componentMap).forEach((usage, index) => {
    const location = `$.componentMap[${index}]`;
    const genericResponsibilityPattern = new RegExp(
      [
        "\\bcontainer\\b",
        "\\bbox\\b",
        "\\bmodern\\b",
        "\\bcustom div\\b",
        "\\bgeneric section\\b",
        "\\bwrapper\\b"
      ].join("|"),
      "i"
    );

    if (
      typeof usage?.responsibility === "string" &&
      genericResponsibilityPattern.test(usage.responsibility)
    ) {
      collector.warning(
        "SCREEN_COMPONENT_GENERIC_RESPONSIBILITY",
        `Component usage '${usage?.id}' has a potentially visual or ` +
        "generic responsibility rather than a product responsibility.",
        `${location}.responsibility`,
        usage.responsibility
      );
    }

    if (!usage?.fallback?.trim()) {
      collector.error(
        "SCREEN_COMPONENT_FALLBACK_MISSING",
        `Component usage '${usage?.id}' has no fallback contract.`,
        `${location}.fallback`
      );
    }

    if (
      usage?.dataOwner === usage?.interactionOwner &&
      usage?.dataOwner === usage?.component
    ) {
      collector.warning(
        "SCREEN_COMPONENT_OVEROWNERSHIP",
        `Component usage '${usage?.id}' appears to own both data and ` +
        "interaction under its own component name. Confirm that the " +
        "screen is not collapsing feature ownership into presentation.",
        location
      );
    }
  });
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
      "SCREEN_COMPONENT_JSON",
      error.message,
      inputPath
    );

    collector.print(
      "Screen Component Coverage Audit",
      { json: options.json }
    );

    setExitCode(collector, options);
    return;
  }

  const specification = specificationFile.value;

  validateRegionCoverage(specification, collector);
  validateReuseContracts(specification, collector);
  validateResponsibilityContent(specification, collector);

  await validateCatalogContracts(specification, collector);

  collector.print(
    "Screen Component Coverage Audit",
    { json: options.json }
  );

  setExitCode(collector, options);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
