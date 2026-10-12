#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { digest, gitOutput, projectFile, loadExecutionContext, sourceSnapshot, validateStageReport } from "./execution-context.mjs";

export function freezeExecutionContext({ root, feature, baseRef, frontendPaths = [], backendPaths = [], testPaths = [] }) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(feature)) throw new Error("Invalid feature slug");
  if (!/^[a-f0-9]{40}$/.test(baseRef ?? "")) throw new Error("Freeze requires an explicit immutable base commit SHA");
  gitOutput(root, ["merge-base", "--is-ancestor", baseRef, "HEAD"]);
  for (const ref of [...frontendPaths, ...backendPaths, ...testPaths]) projectFile(root, ref);
  const context = { schemaVersion: "1.0.0", feature, baseCommit: baseRef, frontendPaths, backendPaths, testPaths };
  const directory = projectFile(root, `.specs/features/${feature}`);
  if (!fs.existsSync(path.join(directory, "applicability.md"))) throw new Error("Feature applicability must exist before freezing");
  context.applicabilitySha256 = digest(fs.readFileSync(path.join(directory, "applicability.md")));
  const file = path.join(directory, "execution-context.json");
  const bytes = `${JSON.stringify(context, null, 2)}\n`;
  fs.writeFileSync(file, bytes, { flag: "wx" });
  const expected = path.join(directory, "autonomy-required.json");
  if (!fs.existsSync(expected)) fs.writeFileSync(expected, `${JSON.stringify({ feature, directives: [] }, null, 2)}\n`, { flag: "wx" });
  return { context, sha256: digest(bytes) };
}

export function advanceStage({ root, feature, stage, inputs = {}, delivery = false }) {
  if (!["design-readiness", "implementation", "frontend-representative", "backend-representative", "adversarial", "evidence-release"].includes(stage)) throw new Error("Unsupported transition stage");
  const context = loadExecutionContext(root, feature);
  if (delivery && (!process.env.SDE_CONTEXT_SHA256 || !process.env.SDE_BASE_COMMIT)) throw new Error("Delivery requires trusted executor baseline SHA and context digest");
  const directory = projectFile(root, `.specs/features/${feature}`);
  const lock = path.join(directory, ".stage-transition.lock");
  fs.mkdirSync(lock);
  try {
    const statePath = path.join(directory, "stage-state.json");
    const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, "utf8")) : { feature, stages: {} };
    const prerequisite = { implementation: "design-readiness", "frontend-representative": "implementation", "backend-representative": "implementation", adversarial: "implementation", "evidence-release": "adversarial" }[stage];
    const before = sourceSnapshot(root);
    const requireTransition = name => {
      const entry = state.stages[name];
      if (!entry || entry.status !== "complete") throw new Error(`Prerequisite transition missing: ${name}`);
      // Design authorizes implementation to change source. Later validation
      // stages must refer to the implementation snapshot they actually tested.
      const implementationAfterDesign = stage === "implementation" && name === "design-readiness";
      if (entry.contextSha256 !== context.sha256 || (!implementationAfterDesign && entry.snapshot !== before)) throw new Error(`Prerequisite transition is stale: ${name}`);
      const bytes = fs.readFileSync(path.join(directory, `${name}-enforcement.json`));
      if (digest(bytes) !== entry.reportSha256) throw new Error(`Prerequisite report changed: ${name}`);
      validateStageReport(JSON.parse(bytes), implementationAfterDesign ? entry.snapshot : before);
    };
    if (prerequisite) requireTransition(prerequisite);
    if (["adversarial", "evidence-release"].includes(stage)) {
      const applicability = fs.readFileSync(path.join(directory, "applicability.md"), "utf8");
      for (const kind of ["frontend", "backend"]) {
        if (new RegExp(`^${kind}-representative-gate: required$`, "m").test(applicability)) requireTransition(`${kind}-representative`);
      }
    }
    const argv = [path.join(root, "integrations/governance/governance-control.mjs"), "enforce", "--root", root, "--stage", stage, "--feature", feature];
    for (const [capability, values] of Object.entries(inputs)) for (const [name, value] of Object.entries(values)) {
      if (typeof value !== "string") throw new Error("Enforcement inputs must be scalar strings");
      argv.push("--set", `${capability}=${name}=${value}`);
    }
    const execution = spawnSync(process.execPath, argv, { cwd: root, encoding: "utf8", timeout: 600000, maxBuffer: 16 * 1024 * 1024 });
    if (execution.status !== 0) throw new Error(`Stage enforcement did not pass: ${execution.stderr || execution.error?.message || execution.stdout}`);
    const report = JSON.parse(execution.stdout);
    if (report.stage !== stage || report.feature !== feature) throw new Error("Enforcement context mismatch");
    if (sourceSnapshot(root) !== before) throw new Error("Source changed during stage execution");
    validateStageReport(report, before);
    if (loadExecutionContext(root, feature).sha256 !== context.sha256) throw new Error("Frozen context changed during execution");
    const reportPath = path.join(directory, `${stage}-enforcement.json`);
    const bytes = `${JSON.stringify(report, null, 2)}\n`;
    fs.writeFileSync(reportPath, bytes);
    state.stages[stage] = { status: "complete", snapshot: before, contextSha256: context.sha256, reportSha256: digest(bytes) };
    const temporary = `${statePath}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`);
    fs.renameSync(temporary, statePath);
    return state.stages[stage];
  } finally { fs.rmdirSync(lock); }
}

export function verifyDelivery({ root, feature, inputs }) {
  if (!process.env.SDE_CONTEXT_SHA256 || !process.env.SDE_BASE_COMMIT) throw new Error("Delivery requires trusted executor baseline SHA and context digest");
  loadExecutionContext(root, feature);
  const snapshot = sourceSnapshot(root);
  const applicability = fs.readFileSync(projectFile(root, `.specs/features/${feature}/applicability.md`), "utf8");
  const stages = ["design-readiness", "implementation"];
  for (const kind of ["frontend", "backend"]) if (new RegExp(`^${kind}-representative-gate: required$`, "m").test(applicability)) stages.push(`${kind}-representative`);
  stages.push("adversarial", "evidence-release");
  const results = {};
  for (const stage of stages) results[stage] = advanceStage({ root, feature, stage, inputs: inputs.stages?.[stage] ?? inputs, delivery: true });
  if (sourceSnapshot(root) !== snapshot) throw new Error("Source changed across delivery verification");
  return { status: "passed", snapshot, stages: results };
}

function isMainModule(realPath) {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync(path.resolve(process.argv[1])) === realPath;
  } catch {
    return false;
  }
}

if (isMainModule(fileURLToPath(import.meta.url))) {
  try {
    const [command, ...tokens] = process.argv.slice(2);
    const args = {};
    for (let i = 0; i < tokens.length; i += 2) {
      if (!tokens[i].startsWith("--") || tokens[i + 1] === undefined || Object.hasOwn(args, tokens[i])) throw new Error("Expected unique --option value pairs");
      args[tokens[i]] = tokens[i + 1];
    }
    const root = path.resolve(args["--root"] ?? process.cwd());
    const feature = args["--feature"];
    let result;
    if (command === "freeze") result = freezeExecutionContext({ root, feature, baseRef: args["--base-ref"], frontendPaths: JSON.parse(args["--frontend-paths"] ?? "[]"), backendPaths: JSON.parse(args["--backend-paths"] ?? "[]"), testPaths: JSON.parse(args["--test-paths"] ?? "[]") });
    else if (["advance", "delivery"].includes(command)) result = (command === "delivery" ? verifyDelivery : advanceStage)({ root, feature, stage: args["--stage"], inputs: JSON.parse(fs.readFileSync(projectFile(root, args["--inputs"]), "utf8")) });
    else throw new Error("Use freeze, advance or delivery");
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 2; }
}
