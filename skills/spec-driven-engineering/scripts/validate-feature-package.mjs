#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { parseArgs, printReport } from "./lib/workflow-utils.mjs";

const args = parseArgs(process.argv.slice(2));
const featureDirectory = path.resolve(String(args._[0] || args["feature-dir"] || ""));
const errors = [];
const warnings = [];
const information = [];

if (!featureDirectory || !fs.existsSync(featureDirectory)) {
  errors.push(`Feature directory not found: ${featureDirectory || "<empty>"}`);
} else {
  // Align with prompts/spec-driven/manifest.json#artifactSequence:
  // 00–03/08–09 are always required; 10–11 only after implementation.
  const alwaysRequired = [
    "00-intent.md",
    "01-spec.md",
    "02-assumptions.md",
    "applicability.md",
    "03-acceptance-criteria.md",
    "08-test-plan.md",
    "09-tasks.md"
  ];
  const postImplementationArtifacts = [
    "10-adversarial-review.md",
    "11-evidence.md"
  ];
  for (const file of alwaysRequired) {
    if (!fs.existsSync(path.join(featureDirectory, file))) errors.push(`Required artifact missing: ${file}`);
  }
  const requirePostImplementation = Boolean(args["require-post-implementation"]);
  const presentPostImplementation = postImplementationArtifacts.filter((file) =>
    fs.existsSync(path.join(featureDirectory, file))
  );
  if (requirePostImplementation || presentPostImplementation.length > 0) {
    for (const file of postImplementationArtifacts) {
      if (!fs.existsSync(path.join(featureDirectory, file))) {
        errors.push(
          presentPostImplementation.length > 0 && !requirePostImplementation
            ? `Post-implementation package is incomplete: missing ${file} (10 and 11 must appear together after implementation)`
            : `Required artifact missing: ${file}`
        );
      }
    }
  }

  const contents = new Map();
  for (const entry of fs.readdirSync(featureDirectory, { withFileTypes: true })) {
    if (entry.isFile() && (entry.name.endsWith(".md") || entry.name.endsWith(".feature"))) {
      contents.set(entry.name, fs.readFileSync(path.join(featureDirectory, entry.name), "utf8"));
    }
  }

  const idsByType = new Map();
  const allIds = new Set();
  const idPattern = /\b(REQ|D|Q|DEF|AC|SCN|AT|PROP|T|ADV)-[A-Z0-9][A-Z0-9-]*-\d{3}\b/g;
  for (const [file, content] of contents) {
    const unresolvedPlaceholders = [...content.matchAll(/\{\{[A-Z][A-Z0-9_]*\}\}/g)].map((match) => match[0]);
    if (unresolvedPlaceholders.length > 0) {
      errors.push(`${file} contains unresolved placeholders: ${[...new Set(unresolvedPlaceholders)].join(", ")}`);
    }
    for (const match of content.matchAll(idPattern)) {
      const id = match[0];
      allIds.add(id);
      const type = match[1];
      if (!idsByType.has(type)) idsByType.set(type, new Set());
      idsByType.get(type).add(id);
    }
    errors.push(...gateStatusErrors(file, content));
  }

  const acceptance = contents.get("03-acceptance-criteria.md") || "";
  const scenarios = contents.get("04-behavior-scenarios.feature") || "";
  const executable = contents.get("05-executable-acceptance-tests.md") || "";
  const acIds = new Set([...acceptance.matchAll(/\bAC-[A-Z0-9][A-Z0-9-]*-\d{3}\b/g)].map((match) => match[0]));
  if (acIds.size === 0) warnings.push("No canonical AC IDs found in 03-acceptance-criteria.md");
  if (scenarios) {
    for (const acId of acIds) {
      if (!scenarios.includes(acId)) errors.push(`Acceptance criterion has no BDD scenario reference: ${acId}`);
    }
    const scenarioIds = new Set([...scenarios.matchAll(/\bSCN-[A-Z0-9][A-Z0-9-]*-\d{3}\b/g)].map((match) => match[0]));
    if (!executable) errors.push("BDD scenarios exist but 05-executable-acceptance-tests.md is missing");
    for (const scenarioId of scenarioIds) {
      if (executable && !executable.includes(scenarioId)) errors.push(`Scenario has no executable test mapping: ${scenarioId}`);
    }
  }

  for (const requirement of markedP0(contents)) {
    if (!acceptanceCriterionReferences(acceptance, requirement)) {
      errors.push(`P0 requirement has no acceptance criterion reference: ${requirement}`);
    }
    if (!executableTestReferences(executable, requirement) && !nonAutomatableJustification(executable, requirement)) {
      errors.push(`P0 requirement has no executable test or non-automatable justification: ${requirement}`);
    }
  }

  const evidence = contents.get("11-evidence.md") || "";
  for (const requirement of idsByType.get("REQ") || []) {
    if (!acceptance.includes(requirement)) {
      errors.push(`Requirement has no acceptance criterion: ${requirement} (REQ -> AC traceability is mandatory, not advisory)`);
    } else if (evidence && !evidence.includes(requirement)) {
      warnings.push(`Requirement is not referenced by evidence: ${requirement}`);
    }
  }
  if (evidence) {
    for (const acId of acIds) {
      if (!evidence.includes(acId)) warnings.push(`Acceptance criterion is not referenced in evidence: ${acId}`);
    }
  }

  const tasks = contents.get("09-tasks.md") || "";
  const atIds = new Set([...executable.matchAll(/\bAT-[A-Z0-9][A-Z0-9-]*-\d{3}\b/g)].map((match) => match[0]));
  const taskIds = idsByType.get("T") || new Set();
  if (executable && taskIds.size === 0) {
    errors.push("Executable acceptance tests exist but 09-tasks.md declares no T- record — every implementation unit needs a traceable task (see artifact-lifecycle.md).");
  }
  for (const atId of atIds) {
    if (tasks && !tasks.includes(atId)) {
      errors.push(`Executable acceptance test has no task linking it for implementation: ${atId}`);
    }
  }
  for (const taskId of taskIds) {
    if (!/\b(REQ|AC|SCN|AT|PROP)-[A-Z0-9][A-Z0-9-]*-\d{3}\b/.test(
      (tasks.split(taskId)[1] || "").split(/\n\s*\n/)[0] || ""
    )) {
      warnings.push(`Task '${taskId}' does not clearly link a REQ/AC/SCN/AT/PROP in its own paragraph.`);
    }
  }

  const properties = contents.get("06-properties.md") || "";
  const propIds = new Set([...properties.matchAll(/\bPROP-[A-Z0-9][A-Z0-9-]*-\d{3}\b/g)].map((match) => match[0]));
  if (properties && !/\bN\/A\b/i.test(properties) && propIds.size === 0) {
    warnings.push("06-properties.md exists, is not marked N/A, but declares no PROP- id.");
  }

  information.push(`Artifacts discovered: ${contents.size}`);
  information.push(`Stable IDs discovered: ${allIds.size}`);
}

function gateStatusErrors(file, content) {
  const found = [];
  const uncertain = /probably[\s\S]{0,80}\b(?:passed|failed|partial|not-run)\b|\b(?:passed|failed|partial|not-run)\b[\s\S]{0,80}probably/i;
  if (uncertain.test(content)) found.push(`${file} contains uncertain language near gate statuses`);
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!/\bnot-run\b/.test(line)) return;
    const windowText = lines.slice(index, index + 4).join("\n");
    if (!hasProbe(windowText)) found.push(`${file} records not-run without a command or probe`);
  });
  return found;
}

function hasProbe(windowText) {
  if (/\b(sonda|probe|preflight)\b/i.test(windowText)) return true;
  if (/\b(comando|command)\s*:/i.test(windowText)) return true;
  return [...windowText.matchAll(/`([^`]+)`/g)].some((match) => {
    const code = match[1];
    return /\b(node|npm|npx|cargo|pytest|pnpm|yarn)\b/.test(code) || /[/\\]/.test(code);
  });
}

function markedP0(contents) {
  const ids = new Set();
  for (const content of contents.values()) {
    for (const line of content.split(/\r?\n/)) {
      if (!line.includes("|")) continue;
      const cells = line.split("|").map((cell) => cell.trim().replace(/`/g, ""));
      if (!cells.includes("P0")) continue;
      for (const cell of cells) {
        if (/^REQ-[A-Z0-9][A-Z0-9-]*-\d{3}$/.test(cell)) ids.add(cell);
      }
    }
  }
  return ids;
}

function acceptanceCriterionReferences(acceptance, requirement) {
  return acceptance.split(/(?=AC-[A-Z0-9][A-Z0-9-]*-\d{3})/).some((block) => {
    return /^AC-[A-Z0-9][A-Z0-9-]*-\d{3}/.test(block) && block.includes(requirement);
  });
}

function executableTestReferences(executable, requirement) {
  return executable.split(/\r?\n/).some((line) => {
    return line.includes(requirement) && /\bAT-[A-Z0-9][A-Z0-9-]*-\d{3}\b/.test(line);
  });
}

function nonAutomatableJustification(executable, requirement) {
  return executable.split(/\n\s*\n/).some((block) => {
    return block.includes(requirement) && /teste não automatizável|teste nao automatizavel|non-automatable/i.test(block);
  });
}

const ok = printReport("Spec-Driven Engineering — Feature Package Validation", errors, warnings, information);
process.exitCode = ok ? 0 : 1;
