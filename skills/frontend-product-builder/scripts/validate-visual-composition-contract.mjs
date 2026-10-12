#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  IssueCollector,
  asArray,
  isObject,
  parseCliArgs,
  readJsonFile,
  resolveFromCwd,
  setExitCode
} from "./lib/screen-contract-utils.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(SCRIPT_DIRECTORY, "..");
const USAGE = [
  "node validate-visual-composition-contract.mjs <screen-spec.json> <design-system.json> <composition-proof.json>",
  "  [--json]",
  "  [--strict-warnings]"
].join("\n");

async function sha256(filePath) {
  return crypto
    .createHash("sha256")
    .update(await fs.readFile(filePath))
    .digest("hex");
}

async function validateSchema(value, schemaRelativePath, collector, location) {
  const schemaPath = path.join(SKILL_ROOT, schemaRelativePath);
  const schema = JSON.parse(await fs.readFile(schemaPath, "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (!validate(value)) {
    for (const error of validate.errors ?? []) {
      collector.error(
        "COMPOSITION_SCHEMA",
        `${error.instancePath || "/"} ${error.message}`,
        location
      );
    }
  }
}

function validateScreenHierarchy(screenSpec, collector) {
  const hierarchy = screenSpec.visualHierarchy;
  if (!isObject(hierarchy)) {
    collector.error(
      "COMPOSITION_SCREEN_VISUAL_HIERARCHY_MISSING",
      "Substantial frontend work requires visualHierarchy in the screen specification.",
      "$.visualHierarchy"
    );
    return;
  }

  if (hierarchy.emphasisBudget?.colorOnlyHierarchyAllowed !== false) {
    collector.error(
      "COMPOSITION_COLOR_ONLY_HIERARCHY",
      "Color cannot be the only hierarchy signal.",
      "$.visualHierarchy.emphasisBudget.colorOnlyHierarchyAllowed"
    );
  }

  const dominantByState = new Map();
  for (const focalPoint of asArray(hierarchy.focalPointByState)) {
    if (focalPoint?.priority !== "primary" && focalPoint?.priority !== "critical") {
      continue;
    }
    const key = focalPoint.stateId ?? "unknown";
    dominantByState.set(key, (dominantByState.get(key) ?? 0) + 1);
  }

  const maxDominant = hierarchy.emphasisBudget?.maxDominantFocalPointsPerState ?? 1;
  for (const [stateId, count] of dominantByState.entries()) {
    if (count > maxDominant) {
      collector.error(
        "COMPOSITION_TOO_MANY_FOCAL_POINTS",
        `State '${stateId}' declares ${count} dominant focal points; allowed maximum is ${maxDominant}.`,
        "$.visualHierarchy.focalPointByState"
      );
    }
  }

  const textRoleByElement = new Map(
    asArray(hierarchy.textRoleAssignments).map((assignment) => [
      assignment?.elementId,
      assignment?.textRole
    ])
  );
  for (const item of asArray(hierarchy.visualPriorityLadder)) {
    if (!textRoleByElement.has(item?.elementId)) {
      collector.error(
        "COMPOSITION_PRIORITY_WITHOUT_TEXT_ROLE",
        `Visual priority item '${item?.id}' targets an element without a text role assignment.`,
        "$.visualHierarchy.visualPriorityLadder"
      );
    }
  }
}

function validateDesignGrammar(designSystem, collector) {
  const grammar = designSystem.visualGrammar;
  if (!isObject(grammar)) {
    collector.error(
      "COMPOSITION_DESIGN_GRAMMAR_MISSING",
      "The design system must define visualGrammar.",
      "$.visualGrammar"
    );
    return;
  }

  const styles = grammar.semanticTextStyles ?? {};
  const signatures = new Map();
  for (const [role, style] of Object.entries(styles)) {
    const signature = [
      style?.familyToken,
      style?.sizeToken,
      style?.weightToken,
      style?.lineHeightToken,
      style?.trackingToken,
      style?.colorToken
    ].join("|");
    const existing = signatures.get(signature) ?? [];
    existing.push(role);
    signatures.set(signature, existing);
  }

  for (const roles of signatures.values()) {
    if (roles.length > 1) {
      collector.error(
        "COMPOSITION_INDISTINGUISHABLE_TEXT_ROLES",
        `Semantic text roles are indistinguishable: ${roles.join(", ")}.`,
        "$.visualGrammar.semanticTextStyles"
      );
    }
  }
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  if (options.positional.length < 3) {
    throw new Error(`Missing input files.\nUsage: ${USAGE}`);
  }

  const collector = new IssueCollector();
  const [screenPathRaw, designPathRaw, proofPathRaw] = options.positional;
  const screen = await readJsonFile(screenPathRaw);
  const design = await readJsonFile(designPathRaw);
  const proof = await readJsonFile(proofPathRaw);

  await validateSchema(screen.value, "assets/schemas/screen-specification.schema.json", collector, screen.path);
  await validateSchema(design.value, "assets/schemas/design-system.schema.json", collector, design.path);
  await validateSchema(proof.value, "assets/schemas/composition-proof.schema.json", collector, proof.path);

  validateScreenHierarchy(screen.value, collector);
  validateDesignGrammar(design.value, collector);

  const screenHash = await sha256(resolveFromCwd(screenPathRaw));
  const designHash = await sha256(resolveFromCwd(designPathRaw));
  if (proof.value.contractHashes?.screenSpecSha256 !== screenHash) {
    collector.error(
      "COMPOSITION_SCREEN_HASH_DRIFT",
      "composition-proof.json does not match the current screen-spec.json hash.",
      "$.contractHashes.screenSpecSha256"
    );
  }
  if (proof.value.contractHashes?.designSystemSha256 !== designHash) {
    collector.error(
      "COMPOSITION_DESIGN_HASH_DRIFT",
      "composition-proof.json does not match the current design-system.json hash.",
      "$.contractHashes.designSystemSha256"
    );
  }
  if (proof.value.applicability === "full" && ["approved", "approved-with-changes"].includes(proof.value.humanDecision?.status) && !proof.value.humanDecision?.approvedBy) {
    collector.error(
      "COMPOSITION_APPROVAL_MISSING_ACTOR",
      "Approved composition proof must record approvedBy.",
      "$.humanDecision"
    );
  }

  collector.print("Frontend Visual Composition Contract Validation", { json: options.json });
  setExitCode(collector, { strictWarnings: options.strictWarnings });
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
