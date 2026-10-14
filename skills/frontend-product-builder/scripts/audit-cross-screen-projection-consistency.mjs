#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

import {
  IssueCollector,
  asArray,
  readJsonFile,
  setExitCode
} from "./lib/screen-contract-utils.mjs";

const USAGE = [
  "node audit-cross-screen-projection-consistency.mjs",
  "  <entity-projections.json>",
  "  --screens-dir <docs/frontend/screens>",
  "  [--strict-warnings]",
  "  [--json]"
].join(" ");

function parseArgs(argv) {
  const options = {
    positional: [],
    screensDir: null,
    json: false,
    strictWarnings: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--json") {
      options.json = true;
      continue;
    }

    if (argument === "--strict-warnings") {
      options.strictWarnings = true;
      continue;
    }

    if (argument === "--screens-dir") {
      const value = argv[index + 1];

      if (!value) {
        throw new Error("--screens-dir requires a directory path.");
      }

      options.screensDir = value;
      index += 1;
      continue;
    }

    if (argument.startsWith("--")) {
      throw new Error(`Unsupported option: ${argument}`);
    }

    options.positional.push(argument);
  }

  return options;
}

async function findScreenSpec(screensDir, screenId) {
  const candidate = path.join(
    screensDir,
    screenId,
    "screen-spec.json"
  );

  try {
    await fs.access(candidate);
    return candidate;
  } catch {
    return null;
  }
}

function collectDerivedEntries(specification) {
  const entries = [];

  for (const dependency of asArray(
    specification?.dataDependencies
  )) {
    entries.push({
      kind: "dataDependency",
      id: dependency?.id,
      sharedSelectorId: dependency?.sharedSelectorId ?? null,
      searchText: [
        dependency?.id,
        dependency?.purpose,
        dependency?.mapping
      ]
        .filter(Boolean)
        .join(" ")
    });
  }

  for (const usage of asArray(specification?.componentMap)) {
    entries.push({
      kind: "componentUsage",
      id: usage?.id,
      sharedSelectorId: usage?.sharedSelectorId ?? null,
      searchText: [
        usage?.id,
        usage?.component,
        usage?.responsibility
      ]
        .filter(Boolean)
        .join(" ")
    });
  }

  return entries;
}

function matchesProjectionValue(entry, projection) {
  const haystack = entry.searchText.toLowerCase();

  return (
    haystack.includes(projection.value.toLowerCase()) ||
    haystack.includes(projection.entityType.toLowerCase())
  );
}

async function validateProjections(
  registry,
  screensDir,
  collector
) {
  const seenIds = new Set();

  for (const [index, projection] of asArray(
    registry?.projections
  ).entries()) {
    const location = `$.projections[${index}]`;

    if (seenIds.has(projection?.id)) {
      collector.error(
        "PROJECTION_ID_DUPLICATE",
        `Projection id '${projection?.id}' is duplicated.`,
        location
      );

      continue;
    }

    seenIds.add(projection?.id);

    const specsByScreen = new Map();

    for (const screenId of asArray(projection?.screens)) {
      const specPath = await findScreenSpec(screensDir, screenId);

      if (!specPath) {
        collector.error(
          "PROJECTION_SCREEN_NOT_FOUND",
          `Projection '${projection?.id}' lists screen '${screenId}' ` +
          `but no screen-spec.json was found under '${screensDir}'.`,
          `${location}.screens`
        );

        continue;
      }

      try {
        const specFile = await readJsonFile(specPath);
        specsByScreen.set(screenId, specFile.value);
      } catch (error) {
        collector.error(
          "PROJECTION_SCREEN_SPEC_INVALID",
          `Screen '${screenId}' spec could not be parsed: ` +
          error.message,
          `${location}.screens`
        );
      }
    }

    for (const [screenId, specification] of specsByScreen) {
      const entries = collectDerivedEntries(specification).filter(
        (entry) => matchesProjectionValue(entry, projection)
      );

      const wired = entries.filter(
        (entry) => entry.sharedSelectorId
      );

      if (wired.length === 0) {
        collector.warning(
          "PROJECTION_NOT_WIRED",
          `Screen '${screenId}' has no dataDependency/componentUsage ` +
          `matching projection '${projection?.id}' ` +
          `('${projection?.entityType}'/'${projection?.value}') that ` +
          "declares sharedSelectorId.",
          `${location} -> ${screenId}`
        );

        continue;
      }

      for (const entry of wired) {
        if (entry.sharedSelectorId !== projection.sharedSelectorId) {
          collector.error(
            "PROJECTION_SELECTOR_MISMATCH",
            `Screen '${screenId}' ${entry.kind} '${entry.id}' declares ` +
            `sharedSelectorId '${entry.sharedSelectorId}' but ` +
            `projection '${projection?.id}' requires ` +
            `'${projection.sharedSelectorId}'. The same derived value ` +
            "must come from exactly one canonical selector across " +
            "every screen that renders it.",
            `${location} -> ${screenId}.${entry.kind}[${entry.id}]`
          );
        }
      }
    }
  }
}

async function main() {
  let options;

  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\nUsage: ${USAGE}\n`);
    process.exitCode = 1;
    return;
  }

  const inputPath = options.positional[0];
  const collector = new IssueCollector();

  if (!inputPath || !options.screensDir) {
    process.stderr.write(`Usage: ${USAGE}\n`);
    process.exitCode = 1;
    return;
  }

  let registryFile;

  try {
    registryFile = await readJsonFile(inputPath);
  } catch (error) {
    collector.error(
      "PROJECTION_REGISTRY_JSON",
      error.message,
      inputPath
    );

    collector.print(
      "Cross-Screen Projection Consistency Audit",
      { json: options.json }
    );

    setExitCode(collector, options);
    return;
  }

  await validateProjections(
    registryFile.value,
    options.screensDir,
    collector
  );

  collector.print(
    "Cross-Screen Projection Consistency Audit",
    { json: options.json }
  );

  setExitCode(collector, options);
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});
