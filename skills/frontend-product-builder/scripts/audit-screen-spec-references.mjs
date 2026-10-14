#!/usr/bin/env node

import path from "node:path";

import {
  IssueCollector,
  addDuplicateIssues,
  asArray,
  checkReferencedFile,
  getActionIds,
  getComponentUsageIds,
  getScreenRegionIds,
  parseCliArgs,
  readJsonFile,
  requireInputPath,
  setExitCode
} from "./lib/screen-contract-utils.mjs";

const USAGE = [
  "node audit-screen-spec-references.mjs <screen-spec.json>",
  "  [--strict-warnings]",
  "  [--json]",
  "  [--known-routes <routes.json>]"
].join(" ");

function validateRegionReferences(specification, collector) {
  const regionIds = new Set(getScreenRegionIds(specification));

  asArray(specification?.componentMap).forEach((usage, index) => {
    if (!regionIds.has(usage?.regionId)) {
      collector.error(
        "SCREEN_REFERENCE_COMPONENT_REGION",
        `Component usage '${usage?.id ?? index}' references unknown ` +
        `region '${usage?.regionId}'.`,
        `$.componentMap[${index}].regionId`
      );
    }
  });

  asArray(specification?.actions).forEach((action, index) => {
    if (!regionIds.has(action?.regionId)) {
      collector.error(
        "SCREEN_REFERENCE_ACTION_REGION",
        `Action '${action?.id ?? index}' references unknown region ` +
        `'${action?.regionId}'.`,
        `$.actions[${index}].regionId`
      );
    }
  });

  asArray(specification?.states).forEach((state, stateIndex) => {
    const visibleRegions = asArray(state?.visibleRegions);
    const hiddenRegions = asArray(state?.hiddenRegions);

    visibleRegions.forEach((regionId, regionIndex) => {
      if (!regionIds.has(regionId)) {
        collector.error(
          "SCREEN_REFERENCE_VISIBLE_REGION",
          `State '${state?.id ?? stateIndex}' references unknown ` +
          `visible region '${regionId}'.`,
          `$.states[${stateIndex}].visibleRegions[${regionIndex}]`
        );
      }
    });

    hiddenRegions.forEach((regionId, regionIndex) => {
      if (!regionIds.has(regionId)) {
        collector.error(
          "SCREEN_REFERENCE_HIDDEN_REGION",
          `State '${state?.id ?? stateIndex}' references unknown ` +
          `hidden region '${regionId}'.`,
          `$.states[${stateIndex}].hiddenRegions[${regionIndex}]`
        );
      }
    });

    const duplicatedRegionIds = visibleRegions.filter((regionId) => {
      return hiddenRegions.includes(regionId);
    });

    for (const regionId of duplicatedRegionIds) {
      collector.error(
        "SCREEN_REFERENCE_REGION_VISIBLE_AND_HIDDEN",
        `State '${state?.id ?? stateIndex}' lists region ` +
        `'${regionId}' as both visible and hidden.`,
        `$.states[${stateIndex}]`
      );
    }
  });
}

function validateComponentStateReferences(specification, collector) {
  const componentUsageIds = new Set(
    getComponentUsageIds(specification)
  );

  asArray(specification?.states).forEach((state, stateIndex) => {
    asArray(state?.componentStates).forEach(
      (componentState, componentStateIndex) => {
        const usageId = componentState?.componentUsageId;

        if (!componentUsageIds.has(usageId)) {
          collector.error(
            "SCREEN_REFERENCE_COMPONENT_STATE",
            `State '${state?.id ?? stateIndex}' references unknown ` +
            `component usage '${usageId}'.`,
            `$.states[${stateIndex}].componentStates` +
            `[${componentStateIndex}].componentUsageId`
          );
        }
      }
    );

    addDuplicateIssues({
      collector,
      items: state?.componentStates,
      selector: (item) => item?.componentUsageId,
      code: "SCREEN_REFERENCE_DUPLICATE_COMPONENT_STATE",
      label: `Component state reference in '${state?.id ?? stateIndex}'`,
      location: `$.states[${stateIndex}].componentStates`
    });
  });
}

function validateActionReferences(specification, collector) {
  const actionIds = new Set(getActionIds(specification));

  asArray(specification?.states).forEach((state, stateIndex) => {
    asArray(state?.enabledActions).forEach(
      (actionId, actionIndex) => {
        if (!actionIds.has(actionId)) {
          collector.error(
            "SCREEN_REFERENCE_ENABLED_ACTION",
            `State '${state?.id ?? stateIndex}' enables unknown ` +
            `action '${actionId}'.`,
            `$.states[${stateIndex}].enabledActions[${actionIndex}]`
          );
        }
      }
    );

    asArray(specification?.states?.[stateIndex]?.disabledActions)
      .forEach((disabledAction, disabledIndex) => {
        const actionId = disabledAction?.actionId;

        if (!actionIds.has(actionId)) {
          collector.error(
            "SCREEN_REFERENCE_DISABLED_ACTION",
            `State '${state?.id ?? stateIndex}' disables unknown ` +
            `action '${actionId}'.`,
            `$.states[${stateIndex}].disabledActions` +
            `[${disabledIndex}].actionId`
          );
        }
      });

    const enabled = new Set(asArray(state?.enabledActions));

    for (const disabledAction of asArray(state?.disabledActions)) {
      if (enabled.has(disabledAction?.actionId)) {
        collector.error(
          "SCREEN_REFERENCE_ACTION_ENABLED_AND_DISABLED",
          `State '${state?.id ?? stateIndex}' lists action ` +
          `'${disabledAction.actionId}' as both enabled and disabled.`,
          `$.states[${stateIndex}]`
        );
      }
    }
  });
}

const PLACEHOLDER_ROUTE_PATTERN = new RegExp(
  "^#$|^javascript:void\\(0\\)$|^javascript:;?$",
  "i"
);

async function loadKnownRoutes(routesFile) {
  if (!routesFile) {
    return null;
  }

  try {
    const content = await readJsonFile(routesFile);
    const value = content?.value;

    if (Array.isArray(value)) {
      return new Set(value);
    }

    if (value && Array.isArray(value.routes)) {
      return new Set(value.routes);
    }

    return new Set();
  } catch {
    return null;
  }
}

function validateNavigationReferences(
  specification,
  collector,
  knownRoutes
) {
  asArray(specification?.actions).forEach((action, index) => {
    if (action?.kind !== "navigation") {
      return;
    }

    const location = `$.actions[${index}]`;

    if (
      action?.targetRoute &&
      PLACEHOLDER_ROUTE_PATTERN.test(action.targetRoute.trim())
    ) {
      collector.error(
        "SCREEN_REFERENCE_NAVIGATION_PLACEHOLDER_ROUTE",
        `Action '${action?.id}' has kind 'navigation' but targetRoute ` +
        `'${action.targetRoute}' is a placeholder, not a real route.`,
        `${location}.targetRoute`
      );

      return;
    }

    if (
      action?.referenceResolution === "routed" &&
      !action?.targetRoute
    ) {
      collector.error(
        "SCREEN_REFERENCE_NAVIGATION_ROUTE_MISSING",
        `Action '${action?.id}' declares referenceResolution 'routed' ` +
        "but has no targetRoute.",
        `${location}.targetRoute`
      );

      return;
    }

    if (
      !action?.referenceResolution &&
      !action?.targetRoute
    ) {
      collector.warning(
        "SCREEN_REFERENCE_NAVIGATION_UNRESOLVED",
        `Action '${action?.id}' has kind 'navigation' but declares ` +
        "neither targetRoute nor referenceResolution. Declare " +
        "'routed' with a real targetRoute, or 'overlay-resolved' when " +
        "no route exists yet.",
        location
      );

      return;
    }

    if (
      knownRoutes &&
      action?.referenceResolution === "routed" &&
      action?.targetRoute &&
      !knownRoutes.has(action.targetRoute)
    ) {
      collector.error(
        "SCREEN_REFERENCE_NAVIGATION_ROUTE_UNKNOWN",
        `Action '${action?.id}' targetRoute '${action.targetRoute}' ` +
        "does not exist in the provided route inventory.",
        `${location}.targetRoute`
      );
    }
  });
}

function validateNamingConsistency(specification, collector) {
  const screenId = specification?.screen?.id;
  const metaId = specification?.meta?.id;
  const metaSource = specification?.meta?.source;

  if (screenId && metaId !== `${screenId}-specification`) {
    collector.warning(
      "SCREEN_REFERENCE_META_ID",
      `meta.id should normally be '${screenId}-specification'.`,
      "$.meta.id",
      metaId
    );
  }

  if (
    screenId &&
    typeof metaSource === "string" &&
    !metaSource
      .replaceAll("\\", "/")
      .endsWith(`/screens/${screenId}/screen-spec.json`)
  ) {
    collector.warning(
      "SCREEN_REFERENCE_META_SOURCE",
      "meta.source does not match the conventional screen path.",
      "$.meta.source",
      metaSource
    );
  }

  const expectedFileName = "screen-spec.json";

  if (
    metaSource &&
    path.basename(metaSource) !== expectedFileName
  ) {
    collector.warning(
      "SCREEN_REFERENCE_FILE_NAME",
      `The conventional specification file name is ` +
      `'${expectedFileName}'.`,
      "$.meta.source",
      metaSource
    );
  }
}

async function validateArtifactReferences(
  specification,
  collector
) {
  await checkReferencedFile({
    collector,
    reference: specification?.productContext?.source,
    code: "SCREEN_REFERENCE_PRODUCT_CONTEXT",
    label: "Product-context source",
    location: "$.productContext.source"
  });

  await checkReferencedFile({
    collector,
    reference: specification?.visualDirection?.source,
    code: "SCREEN_REFERENCE_VISUAL_DIRECTION",
    label: "Visual-direction source",
    location: "$.visualDirection.source"
  });

  await checkReferencedFile({
    collector,
    reference: specification?.architecture?.source,
    code: "SCREEN_REFERENCE_ARCHITECTURE",
    label: "Frontend-architecture source",
    location: "$.architecture.source"
  });

  await checkReferencedFile({
    collector,
    reference: specification?.recipe?.source,
    code: "SCREEN_REFERENCE_RECIPE",
    label: "Selected recipe source",
    location: "$.recipe.source"
  });

  for (
    const [index, contract] of asArray(
      specification?.architecture?.integrationContracts
    ).entries()
  ) {
    await checkReferencedFile({
      collector,
      reference: contract,
      code: "SCREEN_REFERENCE_INTEGRATION",
      label: "Integration contract",
      location: `$.architecture.integrationContracts[${index}]`,
      severity: "warning"
    });
  }

  for (
    const [index, dependency] of asArray(
      specification?.dataDependencies
    ).entries()
  ) {
    if (!dependency?.fixtureSource) {
      continue;
    }

    await checkReferencedFile({
      collector,
      reference: dependency.fixtureSource,
      code: "SCREEN_REFERENCE_FIXTURE",
      label: `Fixture source for '${dependency.id}'`,
      location: `$.dataDependencies[${index}].fixtureSource`,
      severity: "warning"
    });
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
      "SCREEN_REFERENCE_JSON",
      error.message,
      inputPath
    );

    collector.print(
      "Screen Specification Reference Audit",
      { json: options.json }
    );

    setExitCode(collector, options);
    return;
  }

  const specification = specificationFile.value;

  validateRegionReferences(specification, collector);
  validateComponentStateReferences(specification, collector);
  validateActionReferences(specification, collector);
  validateNamingConsistency(specification, collector);

  const knownRoutes = await loadKnownRoutes(options.knownRoutes);

  validateNavigationReferences(
    specification,
    collector,
    knownRoutes
  );

  await validateArtifactReferences(specification, collector);

  collector.print(
    "Screen Specification Reference Audit",
    { json: options.json }
  );

  setExitCode(collector, options);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
