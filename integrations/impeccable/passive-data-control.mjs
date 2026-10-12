#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PASSIVE_STATE_OWNERS = new Set(["stateless", "query-owned"]);
const CONTROL_ELEMENTS = new Set(["input", "select", "textarea"]);
const CONTROL_ROLES = new Set([
  "textbox",
  "searchbox",
  "combobox",
  "listbox",
  "checkbox",
  "radio",
  "switch",
  "spinbutton",
  "slider"
]);
const READ_ONLY_STATES = new Set(["read-only", "readonly"]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalized(value) {
  return String(value || "").trim().toLowerCase();
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8"));
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      args._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) args[key] = true;
    else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

function controlObservationUsageIds(evidence) {
  const usageIds = new Set();
  for (const interaction of asArray(evidence?.interactions)) {
    if (interaction?.rendered !== true || !interaction?.componentUsageId) continue;
    const purposeControl = interaction.purpose === "control";
    const semanticControl = CONTROL_ELEMENTS.has(normalized(interaction.semanticElement));
    const roleControl = CONTROL_ROLES.has(normalized(interaction.accessibleRole));
    if (purposeControl || semanticControl || roleControl) usageIds.add(interaction.componentUsageId);
  }
  for (const element of asArray(evidence?.elements)) {
    if (element?.rendered !== true || !element?.componentUsageId) continue;
    if (CONTROL_ELEMENTS.has(normalized(element.semanticElement))) usageIds.add(element.componentUsageId);
  }
  return usageIds;
}

function renderedControlInteractions(evidence, usageId) {
  return asArray(evidence?.interactions).filter((interaction) => {
    if (interaction?.rendered !== true || interaction?.componentUsageId !== usageId) return false;
    return interaction.purpose === "control"
      || CONTROL_ELEMENTS.has(normalized(interaction.semanticElement))
      || CONTROL_ROLES.has(normalized(interaction.accessibleRole));
  });
}

function currentScreenState(screen, evidence) {
  const stateId = evidence?.meta?.stateId;
  return asArray(screen?.states).find((state) => state?.id === stateId) || null;
}

function currentComponentState(screenState, usageId) {
  return asArray(screenState?.componentStates).find((entry) => entry?.componentUsageId === usageId) || null;
}

export function validatePassiveDataAsControl(screen, evidence) {
  const errors = [];
  const usageById = new Map(asArray(screen?.componentMap).map((usage) => [usage?.id, usage]));
  const knownActions = new Set(asArray(screen?.actions).map((action) => action?.id).filter(Boolean));
  const screenState = currentScreenState(screen, evidence);
  const controlUsageIds = controlObservationUsageIds(evidence);

  for (const usageId of controlUsageIds) {
    const usage = usageById.get(usageId);
    if (!usage) {
      errors.push({
        code: "PASSIVE_DATA_CONTROL_UNKNOWN_USAGE",
        message: `Rendered control evidence references unknown component usage '${usageId}'.`
      });
      continue;
    }

    const componentState = currentComponentState(screenState, usageId);
    const stateName = normalized(componentState?.state);
    const readOnly = READ_ONLY_STATES.has(stateName);
    const readOnlyRationale = String(componentState?.notes || "").trim();
    const interactions = renderedControlInteractions(evidence, usageId);
    const hasDeclaredAction = interactions.some((interaction) => interaction.actionId && knownActions.has(interaction.actionId));
    const passiveOwner = PASSIVE_STATE_OWNERS.has(usage.stateOwner);

    if (readOnly && !readOnlyRationale) {
      errors.push({
        code: "READ_ONLY_CONTROL_RATIONALE_MISSING",
        message: `Component usage '${usageId}' is rendered as a read-only control but componentStates.notes does not explain why control semantics are intentionally retained.`
      });
      continue;
    }

    if (passiveOwner && !hasDeclaredAction && !readOnly) {
      errors.push({
        code: "PASSIVE_DATA_AS_CONTROL",
        message: `Component usage '${usageId}' is owned by '${usage.stateOwner}' and is rendered with input/selection control semantics without an action/form-owned state or an explicitly justified read-only state.`
      });
    }
  }

  return errors;
}

function runCli(argv) {
  const args = parseArgs(argv);
  const screenPath = args["screen-spec"] || args._[0];
  const evidencePath = args.evidence || args._[1];
  if (!screenPath || !evidencePath) {
    process.stderr.write("Usage: node passive-data-control.mjs --screen-spec <screen-spec.json> --evidence <visual-composition-evidence.json> [--json]\n");
    return 1;
  }
  const errors = validatePassiveDataAsControl(readJson(screenPath), readJson(evidencePath));
  if (args.json) {
    process.stdout.write(`${JSON.stringify({ valid: errors.length === 0, errors }, null, 2)}\n`);
  } else if (errors.length) {
    for (const error of errors) process.stderr.write(`[${error.code}] ${error.message}\n`);
  } else {
    process.stdout.write("Passive data-as-control audit passed.\n");
  }
  return errors.length ? 1 : 0;
}

function isMainModule(realPath) {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync(path.resolve(process.argv[1])) === realPath;
  } catch {
    return false;
  }
}

const invoked = isMainModule(fileURLToPath(import.meta.url));
if (invoked) process.exitCode = runCli(process.argv.slice(2));
