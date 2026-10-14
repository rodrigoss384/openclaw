#!/usr/bin/env node

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
  setExitCode
} from "./lib/screen-contract-utils.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(SCRIPT_DIRECTORY, "..");
const USAGE = [
  "node validate-visual-quality-scorecard.mjs <visual-quality-scorecard.json>",
  "  [--json]",
  "  [--strict-warnings]"
].join("\n");

const REQUIRED_CRITERIA = [
  "semantic-outline",
  "visual-priority",
  "reading-path",
  "typographic-distinction",
  "proximity",
  "alignment",
  "whitespace",
  "emphasis-budget",
  "responsive-priority",
  "non-success-state",
  "aesthetic-critique"
];

async function validateSchema(scorecard, collector, location) {
  const schema = JSON.parse(
    await fs.readFile(path.join(SKILL_ROOT, "assets/schemas/visual-quality-scorecard.schema.json"), "utf8")
  );
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (!validate(scorecard)) {
    for (const error of validate.errors ?? []) {
      collector.error("COMPOSITION_SCORECARD_SCHEMA", `${error.instancePath || "/"} ${error.message}`, location);
    }
  }
}

function validateCriteria(scorecard, collector) {
  const byId = new Map(asArray(scorecard.criteria).map((item) => [item.id, item]));
  for (const id of REQUIRED_CRITERIA) {
    if (!byId.has(id)) {
      collector.error("COMPOSITION_SCORECARD_CRITERION_MISSING", `Missing criterion '${id}'.`, "$.criteria");
    }
  }

  for (const criterion of asArray(scorecard.criteria)) {
    if (criterion.blocking && criterion.result !== "passed") {
      collector.error(
        "COMPOSITION_SCORECARD_BLOCKING_NOT_PASSED",
        `Blocking criterion '${criterion.id}' is ${criterion.result}.`,
        "$.criteria",
        criterion.evidence
      );
    }
  }

  if (["approved", "approved-with-accepted-risk"].includes(scorecard.decision?.status) && !scorecard.decision?.approvedBy) {
    collector.error(
      "COMPOSITION_SCORECARD_AUTO_APPROVAL",
      "Approved scorecard must record a human approver.",
      "$.decision"
    );
  }

  if (scorecard.decision?.status === "approved-with-accepted-risk") {
    const missing = ["id", "owner", "scope", "expiry", "mitigation"].filter(
      (field) => !String(scorecard.decision?.risk?.[field] ?? "").trim()
    );
    if (missing.length > 0) {
      collector.error(
        "COMPOSITION_SCORECARD_ACCEPTED_RISK_INCOMPLETE",
        `Approved-with-accepted-risk scorecard is missing: ${missing.join(", ")}.`,
        "$.decision.risk"
      );
    }
  }

  if (scorecard.decision?.humanApprovalRequired !== true) {
    collector.error(
      "COMPOSITION_SCORECARD_HUMAN_APPROVAL_REQUIRED",
      "Visual quality scorecard must require human approval.",
      "$.decision.humanApprovalRequired"
    );
  }
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  if (options.positional.length < 1) {
    throw new Error(`Missing input file.\nUsage: ${USAGE}`);
  }
  const collector = new IssueCollector();
  const scorecard = await readJsonFile(options.positional[0]);
  await validateSchema(scorecard.value, collector, scorecard.path);
  validateCriteria(scorecard.value, collector);
  collector.print("Frontend Visual Quality Scorecard Validation", { json: options.json });
  setExitCode(collector, { strictWarnings: options.strictWarnings });
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
