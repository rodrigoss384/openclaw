#!/usr/bin/env node

import {
  IssueCollector,
  addDuplicateIssues,
  asArray,
  parseCliArgs,
  readJsonFile,
  requireInputPath,
  setExitCode
} from "./lib/screen-contract-utils.mjs";

const USAGE = [
  "node audit-screen-action-state-coverage.mjs <screen-spec.json>",
  "  [--strict-warnings]",
  "  [--json]"
].join(" ");

const MUTATION_ACTION_KINDS = new Set([
  "mutation",
  "destructive"
]);

const RECOVERY_ACTION_KINDS = new Set([
  "recovery",
  "navigation",
  "local",
  "secondary"
]);

const STANDARD_STATE_CATEGORIES = [
  "initial-loading",
  "data",
  "empty",
  "partial",
  "error",
  "forbidden",
  "unavailable",
  "processing",
  "success",
  "stale"
];

const TECHNICAL_STATE_PATTERN = new RegExp(
  [
    "^is[A-Z]",
    "query[-_ ]?error",
    "mutation[-_ ]?success",
    "loading[-_ ]?true",
    "modal[-_ ]?open",
    "request[-_ ]?pending"
  ].join("|"),
  "i"
);

const TECHNICAL_REASON_PATTERN = new RegExp(
  [
    "\\bHTTP\\s*[0-9]{3}\\b",
    "\\bZodError\\b",
    "\\bqueryKey\\b",
    "\\bmutationKey\\b",
    "\\bcapability\\.[a-z0-9._-]+\\b",
    "\\bpermission\\.[a-z0-9._-]+\\b",
    "\\b[A-Z][A-Z0-9_]{4,}\\b"
  ].join("|"),
  "i"
);

function normalizeText(value) {
  return typeof value === "string"
    ? value.trim().toLowerCase()
    : "";
}

function isSubstantivePolicy(value) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return false;
  }

  return ![
    "none",
    "n/a",
    "na",
    "tbd",
    "todo",
    "unknown",
    "not defined"
  ].includes(normalized);
}

function getDisabledActionMap(state) {
  return new Map(
    asArray(state?.disabledActions)
      .map((entry) => [
        entry?.actionId,
        entry
      ])
      .filter(([actionId]) => Boolean(actionId))
  );
}

function validateStateActionCoverage(
  specification,
  collector
) {
  const actions = asArray(specification?.actions);
  const actionMap = new Map(
    actions.map((action) => [
      action?.id,
      action
    ])
  );

  const actionCoverage = new Map(
    actions.map((action) => [
      action?.id,
      {
        enabled: 0,
        disabled: 0,
        hidden: 0,
        unclassified: 0
      }
    ])
  );

  asArray(specification?.states).forEach(
    (state, stateIndex) => {
      const stateLocation = `$.states[${stateIndex}]`;
      const visibleRegions = new Set(
        asArray(state?.visibleRegions)
      );
      const hiddenRegions = new Set(
        asArray(state?.hiddenRegions)
      );
      const enabledActionIds = asArray(
        state?.enabledActions
      );
      const enabledActions = new Set(enabledActionIds);
      const disabledActionEntries = asArray(
        state?.disabledActions
      );
      const disabledActions = getDisabledActionMap(state);

      addDuplicateIssues({
        collector,
        items: enabledActionIds,
        selector: (item) => item,
        code: "SCREEN_ACTION_DUPLICATE_ENABLED",
        label: `Enabled action in state '${state?.id ?? stateIndex}'`,
        location: `${stateLocation}.enabledActions`
      });

      addDuplicateIssues({
        collector,
        items: disabledActionEntries,
        selector: (item) => item?.actionId,
        code: "SCREEN_ACTION_DUPLICATE_DISABLED",
        label: `Disabled action in state '${state?.id ?? stateIndex}'`,
        location: `${stateLocation}.disabledActions`
      });

      for (
        const [disabledIndex, disabledAction] of
        disabledActionEntries.entries()
      ) {
        if (
          TECHNICAL_REASON_PATTERN.test(
            disabledAction?.reason ?? ""
          )
        ) {
          collector.warning(
            "SCREEN_ACTION_TECHNICAL_DISABLED_REASON",
            `Disabled action '${disabledAction?.actionId}' in state ` +
            `'${state?.id ?? stateIndex}' may expose technical ` +
            "implementation content.",
            `${stateLocation}.disabledActions[${disabledIndex}].reason`,
            disabledAction?.reason
          );
        }
      }

      for (const action of actions) {
        const actionId = action?.id;
        const regionId = action?.regionId;
        const regionVisible = visibleRegions.has(regionId);
        const regionHidden = hiddenRegions.has(regionId);
        const actionEnabled = enabledActions.has(actionId);
        const actionDisabled = disabledActions.has(actionId);
        const coverage = actionCoverage.get(actionId);

        if (regionVisible) {
          if (!actionEnabled && !actionDisabled) {
            collector.error(
              "SCREEN_ACTION_VISIBLE_UNCLASSIFIED",
              `Action '${actionId}' belongs to visible region ` +
              `'${regionId}' but is neither enabled nor disabled in ` +
              `state '${state?.id ?? stateIndex}'.`,
              stateLocation
            );

            coverage.unclassified += 1;
          }

          if (actionEnabled) {
            coverage.enabled += 1;
          }

          if (actionDisabled) {
            coverage.disabled += 1;
          }
        } else if (regionHidden) {
          coverage.hidden += 1;

          if (actionEnabled) {
            collector.error(
              "SCREEN_ACTION_ENABLED_IN_HIDDEN_REGION",
              `Action '${actionId}' is enabled while its region ` +
              `'${regionId}' is hidden in state ` +
              `'${state?.id ?? stateIndex}'.`,
              stateLocation
            );
          }

          if (actionDisabled) {
            collector.warning(
              "SCREEN_ACTION_DISABLED_IN_HIDDEN_REGION",
              `Action '${actionId}' is declared disabled while its ` +
              `region '${regionId}' is hidden. Omit the action from ` +
              "state action lists unless the region remains visible.",
              stateLocation
            );
          }
        } else {
          coverage.unclassified += 1;

          collector.error(
            "SCREEN_ACTION_REGION_STATE_UNCLASSIFIED",
            `State '${state?.id ?? stateIndex}' does not classify ` +
            `action region '${regionId}' as visible or hidden.`,
            stateLocation
          );
        }

        if (
          state?.category === "processing" &&
          actionEnabled &&
          MUTATION_ACTION_KINDS.has(action?.kind)
        ) {
          collector.error(
            "SCREEN_ACTION_MUTATION_ENABLED_DURING_PROCESSING",
            `Mutation-like action '${actionId}' remains enabled in ` +
            `processing state '${state?.id ?? stateIndex}'.`,
            stateLocation,
            "Use an explicit cancellation or recovery action when needed."
          );
        }

        if (
          state?.category === "forbidden" &&
          actionEnabled &&
          MUTATION_ACTION_KINDS.has(action?.kind)
        ) {
          collector.error(
            "SCREEN_ACTION_MUTATION_ENABLED_WHILE_FORBIDDEN",
            `Mutation-like action '${actionId}' is enabled in ` +
            `forbidden state '${state?.id ?? stateIndex}'.`,
            stateLocation
          );
        }

        if (
          state?.category === "stale" &&
          actionEnabled &&
          MUTATION_ACTION_KINDS.has(action?.kind)
        ) {
          collector.warning(
            "SCREEN_ACTION_MUTATION_ENABLED_WHILE_STALE",
            `Mutation-like action '${actionId}' remains enabled in ` +
            `stale state '${state?.id ?? stateIndex}'. Confirm that ` +
            "the action cannot overwrite or contradict newer data.",
            stateLocation
          );
        }
      }

      const enabledPrimaryActions = enabledActionIds
        .map((actionId) => actionMap.get(actionId))
        .filter((action) => action?.kind === "primary");

      if (enabledPrimaryActions.length > 1) {
        collector.error(
          "SCREEN_ACTION_MULTIPLE_PRIMARY",
          `State '${state?.id ?? stateIndex}' enables more than one ` +
          "primary action.",
          `${stateLocation}.enabledActions`,
          enabledPrimaryActions.map((action) => action.id)
        );
      }

      if (
        [
          "empty",
          "partial",
          "error",
          "unavailable"
        ].includes(state?.category)
      ) {
        const enabledRecoveryAction = enabledActionIds
          .map((actionId) => actionMap.get(actionId))
          .some((action) => {
            return RECOVERY_ACTION_KINDS.has(action?.kind);
          });

        if (
          asArray(state?.recovery).length === 0 &&
          !enabledRecoveryAction
        ) {
          collector.warning(
            "SCREEN_ACTION_RECOVERY_UNDEFINED",
            `State '${state?.id ?? stateIndex}' has no documented ` +
            "recovery and no enabled recovery-like action.",
            `${stateLocation}.recovery`
          );
        }
      }

      if (
        [
          "initial-loading",
          "data"
        ].includes(state?.category) &&
        state?.screenshotRequired !== true
      ) {
        collector.warning(
          "SCREEN_ACTION_PRIMARY_STATE_SCREENSHOT",
          `Primary state '${state?.id ?? stateIndex}' does not require ` +
          "a screenshot.",
          `${stateLocation}.screenshotRequired`
        );
      }
    }
  );

  for (const [actionId, coverage] of actionCoverage.entries()) {
    if (
      coverage.enabled === 0 &&
      coverage.disabled === 0 &&
      coverage.hidden === 0
    ) {
      collector.error(
        "SCREEN_ACTION_NO_STATE_COVERAGE",
        `Action '${actionId}' has no state coverage.`,
        "$.actions"
      );

      continue;
    }

    if (coverage.enabled === 0) {
      collector.warning(
        "SCREEN_ACTION_NEVER_ENABLED",
        `Action '${actionId}' is never enabled in any declared state.`,
        "$.actions"
      );
    }

    if (coverage.unclassified > 0) {
      collector.error(
        "SCREEN_ACTION_INCOMPLETE_COVERAGE",
        `Action '${actionId}' has ${coverage.unclassified} state ` +
        "coverage gap or gaps.",
        "$.states"
      );
    }
  }
}

function validateActionContracts(specification, collector) {
  asArray(specification?.actions).forEach(
    (action, index) => {
      const location = `$.actions[${index}]`;

      if (!MUTATION_ACTION_KINDS.has(action?.kind)) {
        return;
      }

      if (!isSubstantivePolicy(action?.idempotency)) {
        collector.error(
          "SCREEN_ACTION_IDEMPOTENCY_MISSING",
          `Mutation-like action '${action?.id}' requires an explicit ` +
          "idempotency policy.",
          `${location}.idempotency`,
          "The policy may state that the operation is not idempotent, " +
          "but duplicate behavior must still be documented."
        );
      }

      if (!isSubstantivePolicy(action?.duplicatePrevention)) {
        collector.error(
          "SCREEN_ACTION_DUPLICATE_POLICY_MISSING",
          `Mutation-like action '${action?.id}' requires a substantive ` +
          "duplicate-prevention policy.",
          `${location}.duplicatePrevention`
        );
      }

      if (
        action?.kind === "destructive" &&
        !isSubstantivePolicy(action?.confirmation)
      ) {
        collector.error(
          "SCREEN_ACTION_DESTRUCTIVE_CONFIRMATION",
          `Destructive action '${action?.id}' requires an explicit ` +
          "confirmation or deliberate-verification policy.",
          `${location}.confirmation`
        );
      }

      if (
        action?.kind === "destructive" &&
        [
          "none",
          "not required",
          "no confirmation"
        ].includes(normalizeText(action?.confirmation))
      ) {
        collector.error(
          "SCREEN_ACTION_DESTRUCTIVE_WITHOUT_CONFIRMATION",
          `Destructive action '${action?.id}' explicitly disables ` +
          "confirmation without an approved safety exception.",
          `${location}.confirmation`
        );
      }

      if (
        !new RegExp(
          "authoritative|backend|server|persisted|confirmed|workflow",
          "i"
        ).test(action?.successBehavior ?? "")
      ) {
        collector.warning(
          "SCREEN_ACTION_SUCCESS_AUTHORITY_UNCLEAR",
          `Action '${action?.id}' success behavior does not clearly ` +
          "identify an authoritative completion source.",
          `${location}.successBehavior`
        );
      }

      if (
        !new RegExp(
          "preserv|retain|remain|recover|retry|normalize|reconcil",
          "i"
        ).test(action?.errorBehavior ?? "")
      ) {
        collector.warning(
          "SCREEN_ACTION_FAILURE_RECOVERY_UNCLEAR",
          `Action '${action?.id}' error behavior does not clearly ` +
          "describe recovery, normalization, or preservation.",
          `${location}.errorBehavior`
        );
      }

      const decisionLike = new RegExp(
        "decision|approv|reject|conflict|resolve",
        "i"
      ).test(
        [action?.label, action?.successBehavior]
          .filter(Boolean)
          .join(" ")
      );

      if (decisionLike) {
        const auditTrail = action?.auditTrail;

        if (
          !auditTrail ||
          auditTrail.required !== true ||
          auditTrail.correlationIdRequired !== true ||
          !asArray(auditTrail.capturedFields).includes("actor") ||
          !asArray(auditTrail.capturedFields).includes("timestamp") ||
          !asArray(auditTrail.capturedFields).includes("justification") ||
          !asArray(auditTrail.capturedFields).includes("result")
        ) {
          collector.error(
            "SCREEN_ACTION_AUDIT_TRAIL_MISSING",
            `Decision/approval-like action '${action?.id}' requires ` +
            "auditTrail with required: true, correlationIdRequired: " +
            "true, and capturedFields including at least actor, " +
            "timestamp, justification, and result.",
            `${location}.auditTrail`
          );
        }

        if (
          /conflict|resolve/i.test(action?.label ?? "") &&
          !asArray(auditTrail?.capturedFields).includes(
            "rejectedAlternative"
          )
        ) {
          collector.error(
            "SCREEN_ACTION_CONFLICT_ALTERNATIVE_NOT_PRESERVED",
            `Conflict-resolution action '${action?.id}' must capture ` +
            "'rejectedAlternative' in auditTrail.capturedFields so the " +
            "rejected option is preserved, never silently discarded.",
            `${location}.auditTrail.capturedFields`
          );
        }
      }
    }
  );
}

function validateDisabledReasonTaxonomy(
  specification,
  collector
) {
  asArray(specification?.states).forEach(
    (state, stateIndex) => {
      asArray(state?.disabledActions).forEach(
        (disabledAction, index) => {
          const location =
            `$.states[${stateIndex}].disabledActions[${index}]`;

          if (!disabledAction?.reasonKind) {
            collector.warning(
              "SCREEN_ACTION_REASON_KIND_MISSING",
              `disabledAction for '${disabledAction?.actionId}' has no ` +
              "reasonKind. Classify it as exactly one of: permission, " +
              "dependency, pending-human-decision, business-block, " +
              "status-ineligible, technical-error.",
              `${location}.reasonKind`
            );

            return;
          }

          if (
            disabledAction.reasonKind === "business-block" &&
            new RegExp(
              "aguardando revis|awaiting review|pending review",
              "i"
            ).test(disabledAction?.reason ?? "")
          ) {
            collector.warning(
              "SCREEN_ACTION_DEPENDENCY_AS_BLOCKER",
              `disabledAction for '${disabledAction?.actionId}' reads ` +
              "like a normal review dependency but is classified " +
              "'business-block'. Confirm this dependency is not the " +
              "one the action itself is meant to resolve.",
              `${location}.reasonKind`
            );
          }
        }
      );
    }
  );
}

function validateStateVocabulary(specification, collector) {
  const declaredCategories = new Set(
    asArray(specification?.states)
      .map((state) => state?.category)
  );

  for (const requiredCategory of [
    "initial-loading",
    "data"
  ]) {
    if (!declaredCategories.has(requiredCategory)) {
      collector.error(
        "SCREEN_STATE_REQUIRED_CATEGORY_MISSING",
        `Required screen-state category '${requiredCategory}' is ` +
        "missing.",
        "$.states"
      );
    }
  }

  for (const category of STANDARD_STATE_CATEGORIES) {
    if (!declaredCategories.has(category)) {
      collector.warning(
        "SCREEN_STATE_CATEGORY_NOT_DECLARED",
        `Standard state category '${category}' is not present in the ` +
        "machine-readable specification. Confirm that its " +
        "not-applicable rationale exists in state-matrix.md.",
        "$.states"
      );
    }
  }

  asArray(specification?.states).forEach((state, index) => {
    if (TECHNICAL_STATE_PATTERN.test(state?.id ?? "")) {
      collector.warning(
        "SCREEN_STATE_TECHNICAL_ID",
        `State ID '${state?.id}' appears to describe implementation ` +
        "state rather than product meaning.",
        `$.states[${index}].id`
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
      "SCREEN_ACTION_JSON",
      error.message,
      inputPath
    );

    collector.print(
      "Screen Action and State Coverage Audit",
      { json: options.json }
    );

    setExitCode(collector, options);
    return;
  }

  const specification = specificationFile.value;

  validateStateActionCoverage(specification, collector);
  validateActionContracts(specification, collector);
  validateStateVocabulary(specification, collector);
  validateDisabledReasonTaxonomy(specification, collector);

  collector.print(
    "Screen Action and State Coverage Audit",
    { json: options.json }
  );

  setExitCode(collector, options);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
