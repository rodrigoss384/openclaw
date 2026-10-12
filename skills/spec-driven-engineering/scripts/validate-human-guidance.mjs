#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { validateHumanGuidance, renderHumanGuidance, guidanceSnapshot } from "./lib/human-guidance.mjs";

try {
  const args = {};
  for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i];
    if (!["--root", "--request", "--feature", "--session-id", "--final-file", "--mode"].includes(key) || Object.hasOwn(args, key) || process.argv[i + 1] === undefined) throw new Error("Expected unique supported --option value pairs");
    args[key] = process.argv[i + 1];
  }
  const root = fs.realpathSync(path.resolve(args["--root"] ?? process.cwd()));
  if (args["--mode"] === "snapshot") {
    if (args["--request"] || args["--final-file"]) throw new Error("Snapshot mode cannot validate a request");
    console.log(guidanceSnapshot(root));
  } else {
    if (args["--mode"] && args["--mode"] !== "validate") throw new Error("Use validate or snapshot mode");
    const g = JSON.parse(fs.readFileSync(path.resolve(root, args["--request"]), "utf8"));
    validateHumanGuidance(root, g, { feature: args["--feature"], sessionId: args["--session-id"] });
    const markdown = renderHumanGuidance(root, g);
    if (args["--final-file"] && fs.readFileSync(path.resolve(root, args["--final-file"]), "utf8") !== markdown) throw new Error("Final guidance differs from the validated rendering");
    process.stdout.write(markdown);
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
