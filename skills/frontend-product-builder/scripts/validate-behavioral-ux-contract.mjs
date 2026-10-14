#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  IssueCollector,
  asArray,
  parseCliArgs,
  readJsonFile,
  requireInputPath,
  setExitCode
} from "./lib/screen-contract-utils.mjs";

const USAGE = [
  "node validate-behavioral-ux-contract.mjs <behavioral-ux-contract.json>",
  "  [--schema <behavioral-ux-contract.schema.json>]",
  "  [--strict-warnings]",
  "  [--json]"
].join(" ");

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultSchemaPath = path.resolve(scriptDirectory, "../assets/schemas/behavioral-ux-contract.schema.json");

async function validateAgainstSchema(contract, schemaPath, collector) {
  const schema = JSON.parse(await fs.readFile(schemaPath, "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (!validate(contract)) {
    for (const error of validate.errors || []) {
      collector.error("BUX_SCHEMA_VIOLATION", error.message || "Schema violation.", error.instancePath || "/", error.params);
    }
    return false;
  }
  return true;
}

const HIGH_RISK_PRINCIPLES = new Set([
  "truthful-consequence-framing",
  "relevant-comparative-context"
]);

const HIGH_RISK_SURFACE_PATTERN = new RegExp(
  "pricing|upgrade|renewal|retention|cancel|consent|privacy|security|permission|payment|delete|deletion",
  "i"
);

const PROHIBITED_TERM_PATTERN = new RegExp(
  [
    "scarcity",
    "countdown",
    "fake\\s+review",
    "fake\\s+social\\s+proof",
    "hidden\\s+fee",
    "confirm[- ]shaming",
    "false\\s+anchor",
    "invented\\s+(reference|price)",
    "fabricat\\w*\\s+progress"
  ].join("|"),
  "i"
);

function normalize(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function validateContract(contract, collector) {
  if (contract.truthful !== true) {
    collector.error(
      "BUX_NOT_TRUTHFUL",
      "truthful must be true. A Behavioral UX Contract for a deceptive intervention is a contradiction — classify it under prohibited patterns instead, not this contract.",
      "$.truthful"
    );
  }

  const searchableText = [contract.hypothesis, contract.userBenefit, contract.notes]
    .filter(Boolean)
    .join(" ");
  if (PROHIBITED_TERM_PATTERN.test(searchableText)) {
    collector.error(
      "BUX_PROHIBITED_PATTERN_LANGUAGE",
      "hypothesis/userBenefit/notes matches language associated with a prohibited deceptive pattern (fake scarcity/countdown/reviews, hidden fees, confirm-shaming, invented reference price, fabricated progress). Review against references/14-behavioral-ux.md's PROHIBITED list before proceeding.",
      "$.hypothesis"
    );
  }

  const isHighRiskPrinciple = HIGH_RISK_PRINCIPLES.has(contract.principle);
  const isHighRiskSurface = HIGH_RISK_SURFACE_PATTERN.test(normalize(contract.surface));
  if ((isHighRiskPrinciple || isHighRiskSurface) && contract.manipulationRisk !== "high" && contract.manipulationRisk !== "medium") {
    collector.warning(
      "BUX_RISK_UNDERCLASSIFIED",
      `principle '${contract.principle}' on surface '${contract.surface}' is typically HIGH-RISK per references/14-behavioral-ux.md; manipulationRisk '${contract.manipulationRisk}' looks under-classified. Confirm this is intentional, or escalate to medium/high and require Behavioral Adversarial Review.`,
      "$.manipulationRisk"
    );
  }

  if (contract.userControl === "reduced" && !(contract.notes && contract.notes.trim())) {
    collector.error(
      "BUX_REDUCED_CONTROL_WITHOUT_JUSTIFICATION",
      "userControl: 'reduced' requires a written justification in notes.",
      "$.notes"
    );
  }

  if (contract.userControl === "reduced" && contract.manipulationRisk === "low") {
    collector.error(
      "BUX_REDUCED_CONTROL_LOW_RISK_INCONSISTENT",
      "userControl: 'reduced' is inconsistent with manipulationRisk: 'low' — reducing user control is itself a risk factor.",
      "$.manipulationRisk"
    );
  }

  if (!normalize(contract.userBenefit) || normalize(contract.userBenefit) === normalize(contract.businessBenefit)) {
    collector.warning(
      "BUX_USER_BENEFIT_NOT_DISTINCT",
      "userBenefit reads the same as businessBenefit (or is empty) — the contract requires the user benefit to be stated honestly and distinctly, not inferred from the business goal alone.",
      "$.userBenefit"
    );
  }

  if (contract.guardrails.length === 0) {
    collector.error(
      "BUX_NO_GUARDRAILS",
      "guardrails must list at least one metric that must not silently degrade while primaryMetric improves.",
      "$.guardrails"
    );
  }
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  const inputPath = requireInputPath(options, USAGE);
  const collector = new IssueCollector();

  let contractFile;
  try {
    contractFile = await readJsonFile(inputPath);
  } catch (error) {
    collector.error("BUX_JSON", error.message, inputPath);
    collector.print("Behavioral UX Contract Validation", { json: options.json });
    setExitCode(collector, options);
    return;
  }

  const contract = contractFile.value;
  const schemaPath = options.schema ? path.resolve(options.schema) : defaultSchemaPath;
  const schemaValid = await validateAgainstSchema(contract, schemaPath, collector);

  if (schemaValid) {
    contract.guardrails = asArray(contract.guardrails);
    validateContract(contract, collector);
  }

  collector.print("Behavioral UX Contract Validation", { json: options.json });
  setExitCode(collector, options);
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});
