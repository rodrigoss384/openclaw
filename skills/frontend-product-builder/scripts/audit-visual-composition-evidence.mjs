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
  parseCliArgs,
  readJsonFile,
  resolveFromCwd,
  setExitCode
} from "./lib/screen-contract-utils.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(SCRIPT_DIRECTORY, "..");
const USAGE = [
  "node audit-visual-composition-evidence.mjs <screen-spec.json> <design-system.json> <composition-proof.json> <visual-composition-evidence.json>",
  "  [--json]",
  "  [--strict-warnings]"
].join("\n");

async function sha256(filePath) {
  return crypto.createHash("sha256").update(await fs.readFile(filePath)).digest("hex");
}

async function validateEvidenceSchema(evidence, collector, location) {
  const schema = JSON.parse(
    await fs.readFile(path.join(SKILL_ROOT, "assets/schemas/visual-composition-evidence.schema.json"), "utf8")
  );
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (!validate(evidence)) {
    for (const error of validate.errors ?? []) {
      collector.error("COMPOSITION_EVIDENCE_SCHEMA", `${error.instancePath || "/"} ${error.message}`, location);
    }
  }
}

function auditRelations(evidence, collector) {
  for (const relation of ["readingOrder", "alignment", "proximity", "contrast"]) {
    if (asArray(evidence.relations?.[relation]).length === 0) {
      collector.error(
        "COMPOSITION_RENDERED_RELATION_EMPTY",
        `Rendered composition relation '${relation}' must contain observed evidence.`,
        `$.relations.${relation}`
      );
    }
  }
  const checks = [
    ...asArray(evidence.relations?.alignment),
    ...asArray(evidence.relations?.proximity),
    ...asArray(evidence.relations?.contrast)
  ];
  for (const check of checks) {
    if (check.status === "failed" || check.status === "partial") {
      collector.error(
        "COMPOSITION_RENDERED_RELATION_FAILED",
        `Rendered composition relation '${check.id}' is ${check.status}.`,
        "$.relations",
        check.evidence
      );
    }
    if (check.status === "not-run") {
      collector.warning(
        "COMPOSITION_RENDERED_RELATION_NOT_RUN",
        `Rendered composition relation '${check.id}' was not run.`,
        "$.relations",
        check.evidence
      );
    }
  }
}

function auditElementEvidence(screenSpec, designSystem, evidence, collector) {
  const assignedRoles = new Map(
    asArray(screenSpec.visualHierarchy?.textRoleAssignments).map((item) => [
      item.elementId,
      item.textRole
    ])
  );
  const knownStyles = new Set(Object.keys(designSystem.visualGrammar?.semanticTextStyles ?? {}));

  for (const element of asArray(evidence.elements)) {
    const expectedRole = assignedRoles.get(element.id);
    if (expectedRole && element.textRole !== expectedRole) {
      collector.error(
        "COMPOSITION_RENDERED_TEXT_ROLE_DRIFT",
        `Element '${element.id}' rendered as '${element.textRole}' but contract expects '${expectedRole}'.`,
        "$.elements"
      );
    }
    if (!knownStyles.has(element.textRole)) {
      collector.error(
        "COMPOSITION_RENDERED_UNKNOWN_TEXT_ROLE",
        `Element '${element.id}' uses unknown text role '${element.textRole}'.`,
        "$.elements"
      );
    }
    if (String(element.computedStyle?.letterSpacing ?? "") !== "0px") {
      collector.error(
        "COMPOSITION_RENDERED_LETTER_SPACING",
        `Element '${element.id}' uses non-zero letter spacing.`,
        "$.elements"
      );
    }
  }
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  if (options.positional.length < 4) {
    throw new Error(`Missing input files.\nUsage: ${USAGE}`);
  }
  const collector = new IssueCollector();
  const [screenPathRaw, designPathRaw, proofPathRaw, evidencePathRaw] = options.positional;
  const screen = await readJsonFile(screenPathRaw);
  const design = await readJsonFile(designPathRaw);
  const proof = await readJsonFile(proofPathRaw);
  const evidence = await readJsonFile(evidencePathRaw);

  await validateEvidenceSchema(evidence.value, collector, evidence.path);

  const expected = {
    screenSpecSha256: await sha256(resolveFromCwd(screenPathRaw)),
    designSystemSha256: await sha256(resolveFromCwd(designPathRaw)),
    compositionProofSha256: await sha256(resolveFromCwd(proofPathRaw))
  };
  for (const [key, value] of Object.entries(expected)) {
    if (evidence.value.contractHashes?.[key] !== value) {
      collector.error(
        "COMPOSITION_EVIDENCE_HASH_DRIFT",
        `visual-composition-evidence.json has stale ${key}.`,
        `$.contractHashes.${key}`
      );
    }
  }

  auditElementEvidence(screen.value, design.value, evidence.value, collector);
  auditRelations(evidence.value, collector);

  collector.print("Frontend Visual Composition Evidence Audit", { json: options.json });
  setExitCode(collector, { strictWarnings: options.strictWarnings });
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
