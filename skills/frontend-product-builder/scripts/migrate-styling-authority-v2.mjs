#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const [contractPath, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    const value = rest[index + 1];
    if (!key?.startsWith("--") || value === undefined) throw new Error(`Invalid argument near '${key ?? "end"}'.`);
    options[key.slice(2)] = value;
  }
  return { contractPath, options };
}

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8"));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

function repositoryRef(filePath) {
  const relative = path.relative(process.cwd(), path.resolve(filePath)).split(path.sep).join("/");
  if (!relative || relative === ".." || relative.startsWith("../") || path.isAbsolute(relative)) {
    throw new Error("Visual research and output must remain inside the current repository root.");
  }
  return relative;
}

try {
  const { contractPath, options } = parseArgs(process.argv.slice(2));
  if (!contractPath || !options["visual-research"] || !options.applications || !options.output) {
    throw new Error("Usage: migrate-styling-authority-v2.mjs <v1-contract> --visual-research <visual-research.json> --applications <mapping.json> --output <v2-contract.json>");
  }
  const legacy = readJson(contractPath, "Styling Authority v1");
  const research = readJson(options["visual-research"], "Visual Research");
  const applications = readJson(options.applications, "Reference applications");
  if (legacy.version !== "1.0.0") throw new Error("Migration input must declare version=1.0.0.");
  if (research.artifactKind !== "visual-research" || !/^[a-f0-9]{64}$/.test(String(research.semanticDigest ?? ""))) {
    throw new Error("Visual Research must be a frozen artifact with semanticDigest.");
  }
  const researchIds = new Set((research.references || []).map((item) => item.id));
  const adopted = (legacy.visualReferences || []).filter((item) => item.status === "approved").map((item) => {
    const mapping = applications[item.id];
    if (!mapping || !String(mapping.referenceId ?? "").trim() || !Array.isArray(mapping.appliedTo) || mapping.appliedTo.length === 0) {
      throw new Error(`Approved legacy reference '${item.id}' requires explicit referenceId and appliedTo mapping.`);
    }
    if (!researchIds.has(mapping.referenceId)) throw new Error(`Mapped reference '${mapping.referenceId}' is absent from Visual Research.`);
    return {
      referenceId: mapping.referenceId,
      status: "adopted",
      appliedTo: [...new Set(mapping.appliedTo.map(String))],
      visualResearchDigest: research.semanticDigest
    };
  });
  if (adopted.length === 0) throw new Error("Migration requires at least one approved legacy reference.");
  const migrated = {
    ...legacy,
    version: "2.0.0",
    visualResearch: {
      ref: repositoryRef(options["visual-research"]),
      semanticDigest: research.semanticDigest
    },
    visualReferences: adopted
  };
  const outputPath = path.resolve(options.output);
  repositoryRef(outputPath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const temporary = `${outputPath}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(migrated, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, outputPath);
  console.log(`Styling Authority v2 written: ${repositoryRef(outputPath)}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
