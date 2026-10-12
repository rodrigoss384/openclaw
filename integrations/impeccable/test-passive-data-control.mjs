#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validatePassiveDataAsControl } from "./passive-data-control.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../..");
let assertions = 0;
function check(value, message) {
  assertions += 1;
  assert.ok(value, message);
}
function equal(actual, expected, message) {
  assertions += 1;
  assert.equal(actual, expected, message);
}

function screen({ stateOwner = "query-owned", componentState = "default", notes = null, actions = [] } = {}) {
  return {
    screen: { id: "case-detail", category: "entity-detail" },
    componentMap: [
      {
        id: "case-status",
        component: "SelectField",
        stateOwner,
        interactionOwner: "case-detail",
        states: ["default", "read-only"]
      }
    ],
    states: [
      {
        id: "data",
        componentStates: [{ componentUsageId: "case-status", state: componentState, notes }]
      }
    ],
    actions
  };
}

function evidence({ asControl = true, includeInteraction = true, actionId = null } = {}) {
  return {
    meta: { screenId: "case-detail", stateId: "data" },
    elements: [
      {
        id: "case-status-value",
        componentUsageId: "case-status",
        semanticElement: asControl ? "select" : "span",
        rendered: true
      }
    ],
    interactions: includeInteraction && asControl
      ? [
          {
            id: "case-status-control",
            componentUsageId: "case-status",
            purpose: "control",
            semanticElement: "select",
            accessibleRole: "combobox",
            actionId,
            rendered: true
          }
        ]
      : []
  };
}

const bad = validatePassiveDataAsControl(screen(), evidence());
check(bad.some((error) => error.code === "PASSIVE_DATA_AS_CONTROL"), "display-only query data rendered as a Select must fail");

const badUntracked = validatePassiveDataAsControl(screen(), evidence({ includeInteraction: false }));
check(badUntracked.some((error) => error.code === "PASSIVE_DATA_AS_CONTROL"), "semantic <select> evidence must fail even when interaction evidence was omitted");

const displayOnly = validatePassiveDataAsControl(screen(), evidence({ asControl: false }));
equal(displayOnly.length, 0, "display-only data rendered as ordinary text must pass");

const readOnlyWithoutRationale = validatePassiveDataAsControl(
  screen({ componentState: "read-only" }),
  evidence()
);
check(readOnlyWithoutRationale.some((error) => error.code === "READ_ONLY_CONTROL_RATIONALE_MISSING"), "read-only control without explicit rationale must fail");

const justifiedReadOnly = validatePassiveDataAsControl(
  screen({ componentState: "read-only", notes: "The product intentionally preserves familiar selection-control semantics while this permission makes the value immutable." }),
  evidence()
);
equal(justifiedReadOnly.length, 0, "explicitly justified read-only control must pass");

const editable = validatePassiveDataAsControl(
  screen({ stateOwner: "form-owned" }),
  evidence()
);
equal(editable.length, 0, "form-owned editable control must pass");

const actionBound = validatePassiveDataAsControl(
  screen({ actions: [{ id: "change-status" }] }),
  evidence({ actionId: "change-status" })
);
equal(actionBound.length, 0, "passive owner with an explicit declared action target is not passive data masquerading as a control");

const phase5Wrapper = fs.readFileSync(path.join(ROOT, "skills/frontend-product-builder/scripts/audit-theme-operational-evidence.mjs"), "utf8");
check(phase5Wrapper.includes("validatePassiveDataAsControl"), "Phase 5 operational evidence wrapper must invoke passive-data-as-control enforcement");
check(phase5Wrapper.includes("passiveControlErrors"), "Phase 5 wrapper must block on passive-control findings");

console.log(`Passive data-as-control regression suite passed (${assertions} assertions).`);
