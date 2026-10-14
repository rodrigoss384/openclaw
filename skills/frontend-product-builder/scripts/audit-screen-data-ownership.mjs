#!/usr/bin/env node

import {
  IssueCollector,
  asArray,
  parseCliArgs,
  readJsonFile,
  requireInputPath,
  setExitCode
} from "./lib/screen-contract-utils.mjs";

const USAGE = [
  "node audit-screen-data-ownership.mjs <screen-spec.json>",
  "  [--strict-warnings]",
  "  [--json]"
].join(" ");

const OWNER_DEPENDENCY_REQUIREMENTS = {
  "query-owned": "query",
  "form-owned": "form",
  "url-owned": "url",
  "feature-owned": "feature",
  "route-owned": "route"
};

const MUTATION_ACTION_KINDS = new Set([
  "mutation",
  "destructive"
]);

function normalize(value) {
  return typeof value === "string"
    ? value.trim().toLowerCase()
    : "";
}

function isGenericValue(value) {
  return [
    "",
    "none",
    "n/a",
    "na",
    "tbd",
    "todo",
    "unknown",
    "same as above",
    "not defined",
    "to be defined"
  ].includes(normalize(value));
}

function isAllowedNoOwner(value) {
  return [
    "none",
    "props",
    "static",
    "presentation",
    "parent",
    "not applicable"
  ].includes(normalize(value));
}

function valuesMatch(left, right) {
  const leftValue = normalize(left);
  const rightValue = normalize(right);

  if (!leftValue || !rightValue) {
    return false;
  }

  return leftValue === rightValue ||
    leftValue.includes(rightValue) ||
    rightValue.includes(leftValue);
}

function dependencyMatchesOwner(dependency, owner) {
  return valuesMatch(dependency?.id, owner) ||
    valuesMatch(dependency?.owner, owner);
}

function validateArchitectureOwnership(
  specification,
  collector
) {
  const architecture = specification?.architecture ?? {};

  const requiredOwnershipFields = [
    "featureBoundary",
    "routeOwnership",
    "serverStateOwnership",
    "clientStateOwnership",
    "formStateOwnership",
    "urlStateOwnership",
    "dataBoundary",
    "errorStrategy"
  ];

  for (const field of requiredOwnershipFields) {
    if (isGenericValue(architecture[field])) {
      collector.error(
        "SCREEN_DATA_ARCHITECTURE_OWNER_UNDEFINED",
        `Architecture field '${field}' is unresolved or generic.`,
        `$.architecture.${field}`,
        architecture[field]
      );
    }
  }

  if (
    !new RegExp(
      "dto|validation|mapper|mapping|frontend model|view model",
      "i"
    ).test(architecture?.dataBoundary ?? "")
  ) {
    collector.warning(
      "SCREEN_DATA_BOUNDARY_PIPELINE_UNCLEAR",
      "architecture.dataBoundary does not clearly describe DTO " +
      "validation, mapping, frontend-model, or view-model boundaries.",
      "$.architecture.dataBoundary",
      architecture?.dataBoundary
    );
  }

  if (
    !new RegExp(
      "normalize|mapping|classification|field|form|region|screen",
      "i"
    ).test(architecture?.errorStrategy ?? "")
  ) {
    collector.warning(
      "SCREEN_DATA_ERROR_STRATEGY_UNCLEAR",
      "architecture.errorStrategy does not clearly describe error " +
      "normalization and presentation scope.",
      "$.architecture.errorStrategy",
      architecture?.errorStrategy
    );
  }
}

function validateDependencyContracts(
  specification,
  collector
) {
  const componentNames = new Set(
    asArray(specification?.componentMap)
      .map((usage) => normalize(usage?.component))
      .filter(Boolean)
  );

  const screenName = normalize(specification?.screen?.name);

  asArray(specification?.dataDependencies).forEach(
    (dependency, index) => {
      const location = `$.dataDependencies[${index}]`;
      const owner = normalize(dependency?.owner);

      if (isGenericValue(dependency?.owner)) {
        collector.error(
          "SCREEN_DATA_DEPENDENCY_OWNER_MISSING",
          `Data dependency '${dependency?.id}' has no substantive ` +
          "owner.",
          `${location}.owner`
        );
      }

      if (
        owner === screenName ||
        componentNames.has(owner)
      ) {
        collector.error(
          "SCREEN_DATA_PRESENTATION_OWNS_DEPENDENCY",
          `Dependency '${dependency?.id}' is owned directly by a ` +
          "screen or presentation component.",
          `${location}.owner`,
          dependency?.owner
        );
      }

      for (const field of [
        "authoritativeSource",
        "contract",
        "mapping",
        "loadingBehavior",
        "emptyBehavior",
        "errorBehavior",
        "staleBehavior",
        "permissionBehavior",
        "cachePolicy",
        "retryPolicy"
      ]) {
        if (isGenericValue(dependency?.[field])) {
          collector.error(
            "SCREEN_DATA_DEPENDENCY_FIELD_MISSING",
            `Dependency '${dependency?.id}' has unresolved field ` +
            `'${field}'.`,
            `${location}.${field}`,
            dependency?.[field]
          );
        }
      }

      if (
        new RegExp(
          "direct|raw response|pass through|no mapping",
          "i"
        ).test(dependency?.mapping ?? "")
      ) {
        collector.warning(
          "SCREEN_DATA_DIRECT_TRANSPORT_MAPPING",
          `Dependency '${dependency?.id}' may pass transport data ` +
          "directly into presentation.",
          `${location}.mapping`,
          dependency?.mapping
        );
      }

      if (dependency?.type === "query") {
        if (isGenericValue(dependency?.cachePolicy)) {
          collector.error(
            "SCREEN_DATA_QUERY_CACHE_POLICY",
            `Query '${dependency?.id}' requires an explicit cache and ` +
            "freshness policy.",
            `${location}.cachePolicy`
          );
        }

        if (
          new RegExp(
            "search|filter|autocomplete|typeahead|rapid input",
            "i"
          ).test(dependency?.purpose ?? "") &&
          isGenericValue(dependency?.cancellationPolicy)
        ) {
          collector.warning(
            "SCREEN_DATA_QUERY_CANCELLATION_POLICY",
            `Interactive query '${dependency?.id}' has no explicit ` +
            "cancellation or obsolete-request policy.",
            `${location}.cancellationPolicy`
          );
        }
      }

      if (dependency?.type === "mutation") {
        if (isGenericValue(dependency?.invalidationPolicy)) {
          collector.error(
            "SCREEN_DATA_MUTATION_INVALIDATION_POLICY",
            `Mutation dependency '${dependency?.id}' requires an ` +
            "explicit invalidation or reconciliation policy.",
            `${location}.invalidationPolicy`
          );
        }

        if (
          !new RegExp(
            "authoritative|backend|server|persisted|workflow",
            "i"
          ).test(dependency?.authoritativeSource ?? "")
        ) {
          collector.warning(
            "SCREEN_DATA_MUTATION_AUTHORITY_UNCLEAR",
            `Mutation dependency '${dependency?.id}' does not clearly ` +
            "identify an authoritative source.",
            `${location}.authoritativeSource`
          );
        }
      }

      if (
        dependency?.type === "static" &&
        ![
          "not applicable",
          "none"
        ].includes(normalize(dependency?.retryPolicy))
      ) {
        collector.warning(
          "SCREEN_DATA_STATIC_RETRY_POLICY",
          `Static dependency '${dependency?.id}' has a retry policy. ` +
          "Confirm that the dependency type is correct.",
          `${location}.retryPolicy`
        );
      }
    }
  );
}

function validateStateOwnerDependencies(
  specification,
  collector
) {
  const dependencies = asArray(
    specification?.dataDependencies
  );

  const dependenciesByType = new Map();

  for (const dependency of dependencies) {
    const current = dependenciesByType.get(
      dependency?.type
    ) ?? [];

    current.push(dependency);
    dependenciesByType.set(dependency?.type, current);
  }

  asArray(specification?.componentMap).forEach(
    (usage, index) => {
      const location = `$.componentMap[${index}]`;
      const requiredDependencyType =
        OWNER_DEPENDENCY_REQUIREMENTS[usage?.stateOwner];

      if (
        requiredDependencyType &&
        asArray(
          dependenciesByType.get(requiredDependencyType)
        ).length === 0
      ) {
        collector.error(
          "SCREEN_DATA_STATE_OWNER_WITHOUT_DEPENDENCY",
          `Component usage '${usage?.id}' is '${usage?.stateOwner}' ` +
          `but no '${requiredDependencyType}' dependency exists.`,
          `${location}.stateOwner`
        );
      }

      if (
        !isAllowedNoOwner(usage?.dataOwner) &&
        !dependencies.some((dependency) => {
          return dependencyMatchesOwner(
            dependency,
            usage?.dataOwner
          );
        })
      ) {
        collector.warning(
          "SCREEN_DATA_COMPONENT_OWNER_UNRESOLVED",
          `Component usage '${usage?.id}' dataOwner ` +
          `'${usage?.dataOwner}' does not match a dependency ID or ` +
          "dependency owner.",
          `${location}.dataOwner`
        );
      }

      if (
        usage?.stateOwner === "query-owned" &&
        !dependencies.some((dependency) => {
          return dependency?.type === "query" &&
            dependencyMatchesOwner(
              dependency,
              usage?.dataOwner
            );
        })
      ) {
        collector.warning(
          "SCREEN_DATA_QUERY_OWNER_MISMATCH",
          `Query-owned component usage '${usage?.id}' does not match ` +
          "a specific query dependency through dataOwner.",
          location
        );
      }

      if (
        usage?.stateOwner === "form-owned" &&
        isGenericValue(
          specification?.architecture?.formStateOwnership
        )
      ) {
        collector.error(
          "SCREEN_DATA_FORM_OWNER_ARCHITECTURE",
          `Form-owned usage '${usage?.id}' exists while architecture ` +
          "form-state ownership remains unresolved.",
          "$.architecture.formStateOwnership"
        );
      }

      if (
        usage?.stateOwner === "url-owned" &&
        isGenericValue(
          specification?.architecture?.urlStateOwnership
        )
      ) {
        collector.error(
          "SCREEN_DATA_URL_OWNER_ARCHITECTURE",
          `URL-owned usage '${usage?.id}' exists while architecture ` +
          "URL-state ownership remains unresolved.",
          "$.architecture.urlStateOwnership"
        );
      }
    }
  );
}

function validateMutationActionOwnership(
  specification,
  collector
) {
  const mutationDependencies = asArray(
    specification?.dataDependencies
  ).filter((dependency) => {
    return dependency?.type === "mutation";
  });

  const referencedMutationDependencies = new Set();

  asArray(specification?.actions).forEach(
    (action, index) => {
      if (!MUTATION_ACTION_KINDS.has(action?.kind)) {
        return;
      }

      const location = `$.actions[${index}]`;

      if (mutationDependencies.length === 0) {
        collector.error(
          "SCREEN_DATA_ACTION_WITHOUT_MUTATION",
          `Mutation-like action '${action?.id}' exists without a ` +
          "mutation data dependency.",
          location
        );

        return;
      }

      const matchingDependencies = mutationDependencies.filter(
        (dependency) => {
          return dependencyMatchesOwner(
            dependency,
            action?.owner
          );
        }
      );

      if (matchingDependencies.length === 0) {
        collector.warning(
          "SCREEN_DATA_ACTION_OWNER_MISMATCH",
          `Action '${action?.id}' owner '${action?.owner}' does not ` +
          "match a mutation dependency ID or owner.",
          `${location}.owner`
        );

        return;
      }

      for (const dependency of matchingDependencies) {
        referencedMutationDependencies.add(dependency.id);
      }
    }
  );

  for (const dependency of mutationDependencies) {
    if (!referencedMutationDependencies.has(dependency?.id)) {
      collector.warning(
        "SCREEN_DATA_UNUSED_MUTATION_DEPENDENCY",
        `Mutation dependency '${dependency?.id}' is not matched to a ` +
        "mutation-like action owner.",
        "$.dataDependencies"
      );
    }
  }
}

function validateDependencyUsage(specification, collector) {
  const usages = asArray(specification?.componentMap);
  const actions = asArray(specification?.actions);

  for (
    const [index, dependency] of
    asArray(specification?.dataDependencies).entries()
  ) {
    const referencedByComponent = usages.some((usage) => {
      return dependencyMatchesOwner(
        dependency,
        usage?.dataOwner
      );
    });

    const referencedByAction = actions.some((action) => {
      return dependencyMatchesOwner(
        dependency,
        action?.owner
      );
    });

    if (
      !referencedByComponent &&
      !referencedByAction &&
      ![
        "route",
        "context",
        "static"
      ].includes(dependency?.type)
    ) {
      collector.warning(
        "SCREEN_DATA_DEPENDENCY_UNUSED",
        `Dependency '${dependency?.id}' is not matched to a component ` +
        "dataOwner or action owner.",
        `$.dataDependencies[${index}]`
      );
    }
  }
}

const NAMING_AGGREGATE_PATTERN = new RegExp(
  "aggregate|related|byclient|byparent|allfor|consolidat",
  "i"
);

const MUTABILITY_SENSITIVE_PATTERN = new RegExp(
  "valid|approv|certif|evidence|sign|attest",
  "i"
);

function validateScopeResolution(
  specification,
  collector
) {
  const scopeHierarchy = asArray(
    specification?.productContext?.scope?.scopeHierarchy
  );

  asArray(specification?.dataDependencies).forEach(
    (dependency, index) => {
      const location = `$.dataDependencies[${index}]`;
      const scopeResolution = dependency?.scopeResolution;

      if (!scopeResolution) {
        return;
      }

      const resolvedVia = scopeResolution?.resolvedVia;
      const allowedForLevels = asArray(
        scopeResolution?.allowedForLevels
      );

      if (resolvedVia === "ancestor-aggregate") {
        const requestedLevel = scopeResolution?.requestedLevel;

        if (
          !requestedLevel ||
          !allowedForLevels.includes(requestedLevel)
        ) {
          collector.error(
            "SCREEN_DATA_ANCESTOR_AGGREGATE_NOT_ALLOWED",
            `Dependency '${dependency?.id}' resolves via ` +
            "'ancestor-aggregate' but its own requestedLevel " +
            `('${requestedLevel ?? "unset"}') is not listed in ` +
            "scopeResolution.allowedForLevels. A descendant-level " +
            "screen must not consume a broader ancestor aggregate " +
            "unless explicitly whitelisted — this is the structural " +
            "cause of a sibling-scope leak (e.g. a case-detail screen " +
            "showing another case's objects because the dependency " +
            "aggregated by clientId).",
            `${location}.scopeResolution`
          );
        }

        if (isGenericValue(dependency?.originField)) {
          collector.error(
            "SCREEN_DATA_ANCESTOR_AGGREGATE_WITHOUT_ORIGIN",
            `Dependency '${dependency?.id}' resolves via ` +
            "'ancestor-aggregate' but does not declare originField. " +
            "Every item reached through a broader/consolidated " +
            "aggregate must tag its own derived provenance.",
            `${location}.originField`
          );
        }
      }

      if (
        scopeHierarchy.length > 0 &&
        resolvedVia === "exact-parent-chain" &&
        isGenericValue(dependency?.scopeKey)
      ) {
        collector.warning(
          "SCREEN_DATA_EXACT_CHAIN_WITHOUT_SCOPE_KEY",
          `Dependency '${dependency?.id}' declares ` +
          "resolvedVia 'exact-parent-chain' but no scopeKey. Name " +
          "the exact foreign key this dependency filters by.",
          `${location}.scopeKey`
        );
      }
    }
  );

  if (scopeHierarchy.length > 0) {
    asArray(specification?.dataDependencies).forEach(
      (dependency, index) => {
        const location = `$.dataDependencies[${index}]`;
        const nameSample = [
          dependency?.id,
          dependency?.mapping,
          dependency?.purpose
        ]
          .filter(Boolean)
          .join(" ");

        if (
          NAMING_AGGREGATE_PATTERN.test(nameSample) &&
          !dependency?.scopeResolution
        ) {
          collector.warning(
            "SCREEN_DATA_AGGREGATE_NAMING_WITHOUT_SCOPE_RESOLUTION",
            `Dependency '${dependency?.id}' has a broad-aggregate-` +
            "sounding id/purpose in a product with a declared " +
            "scopeHierarchy, but declares no scopeResolution. Make " +
            "the scope-widening decision explicit rather than " +
            "incidental.",
            location
          );
        }
      }
    );
  }
}

function validateMutabilityPolicy(
  specification,
  collector
) {
  asArray(specification?.dataDependencies).forEach(
    (dependency, index) => {
      if (dependency?.type !== "mutation") {
        return;
      }

      const nameSample = [
        dependency?.purpose,
        dependency?.mapping
      ]
        .filter(Boolean)
        .join(" ");

      if (
        MUTATION_ACTION_KINDS.has("mutation") &&
        MUTABILITY_SENSITIVE_PATTERN.test(nameSample) &&
        isGenericValue(dependency?.mutabilityPolicy)
      ) {
        collector.warning(
          "SCREEN_DATA_MUTABILITY_POLICY_MISSING",
          `Mutation dependency '${dependency?.id}' appears to ` +
          "validate, approve, or certify a record, but declares no " +
          "mutabilityPolicy. Declare whether the target record may " +
          "be overwritten in place or must remain an immutable " +
          "source-of-truth with changes captured as new linked " +
          "records.",
          `$.dataDependencies[${index}].mutabilityPolicy`
        );
      }
    }
  );
}

function validatePermissionAuthority(
  specification,
  collector
) {
  asArray(specification?.productContext?.permissions)
    .forEach((permission, index) => {
      if (permission?.backendAuthoritative !== true) {
        collector.error(
          "SCREEN_DATA_PERMISSION_NOT_AUTHORITATIVE",
          `Permission '${permission?.capability}' must keep backend ` +
          "authority.",
          `$.productContext.permissions[${index}].backendAuthoritative`
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
      "SCREEN_DATA_JSON",
      error.message,
      inputPath
    );

    collector.print(
      "Screen Data Ownership Audit",
      { json: options.json }
    );

    setExitCode(collector, options);
    return;
  }

  const specification = specificationFile.value;

  validateArchitectureOwnership(
    specification,
    collector
  );

  validateDependencyContracts(
    specification,
    collector
  );

  validateStateOwnerDependencies(
    specification,
    collector
  );

  validateMutationActionOwnership(
    specification,
    collector
  );

  validateDependencyUsage(
    specification,
    collector
  );

  validateScopeResolution(
    specification,
    collector
  );

  validateMutabilityPolicy(
    specification,
    collector
  );

  validatePermissionAuthority(
    specification,
    collector
  );

  collector.print(
    "Screen Data Ownership Audit",
    { json: options.json }
  );

  setExitCode(collector, options);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
