#!/usr/bin/env node
// Entry points shared by the prompt pack and the consumer delivery job.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { gitOutput, projectFile, sourceSnapshot, loadExecutionContext, materializeInvocation } from "./execution-context.mjs";
import { freezeExecutionContext, advanceStage, verifyDelivery } from "./stage-control.mjs";

const runtimeRoot = path.resolve(import.meta.dirname, "../..");
const reserved = ["project-root", "feature-directory", "feature-slug", "baseline-git-ref"];
const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
const encode = value => `${JSON.stringify(value, null, 2)}\n`;
function run(root, script, args) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: "utf8", timeout: 600000, maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr || result.error?.message || result.stdout);
  return result.stdout;
}
function featureDirectory(root, feature) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(feature ?? "")) throw new Error("Invalid feature slug");
  return projectFile(root, `.specs/features/${feature}`);
}
const markdownSection = (text, heading) => text.match(new RegExp(`^## ${heading}[ \\t]*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "m"))?.[1];
function featureReleased(root, feature) {
  const file = path.join(featureDirectory(root, feature), "stage-state.json");
  return fs.existsSync(file) && read(file).stages?.["evidence-release"]?.status === "complete";
}
// An initiative's rollout plan binds its features: a feature cannot begin while
// the initiative is not ready or a declared dependency has not completed evidence-release.
function initiativeBlockers(root, feature) {
  const directory = projectFile(root, ".specs/initiatives");
  if (!fs.existsSync(directory)) return [];
  const blockers = [];
  for (const slug of fs.readdirSync(directory).sort()) {
    const file = path.join(directory, slug, "initiative.md");
    if (!fs.existsSync(file)) continue;
    const ref = `.specs/initiatives/${slug}/initiative.md`;
    const text = fs.readFileSync(file, "utf8");
    const rollout = markdownSection(text, "Rollout plan");
    if (!rollout?.includes(`\`${feature}\``)) continue;
    const rows = rollout.split("\n").filter(line => line.trim().startsWith("|")).map(line => line.trim().replace(/^\||\|$/g, "").split("|").map(cell => cell.trim()));
    const header = (rows[0] ?? []).map(cell => cell.toLowerCase());
    const slugColumn = header.indexOf("feature slug");
    const dependsColumn = header.indexOf("depende de");
    if (slugColumn < 0 || dependsColumn < 0) throw new Error(`${ref}: Rollout plan requires "Feature slug" and "Depende de" columns`);
    const plan = new Map(rows.slice(2).map(cells => [cells[slugColumn]?.match(/^`([a-z0-9][a-z0-9-]*)`$/)?.[1], cells[dependsColumn] ?? ""]).filter(([name]) => name));
    if (!plan.has(feature)) continue;
    const status = markdownSection(text, "Status")?.match(/`([^`]+)`/)?.[1];
    if (status !== "ready") blockers.push({ initiative: ref, reason: `initiative status is ${status ?? "undeclared"}, not ready` });
    const dependencies = new Set([...plan.get(feature).matchAll(/`([a-z0-9][a-z0-9-]*)`/g)].map(match => match[1]).filter(name => name !== feature && plan.has(name)));
    for (const dependency of dependencies) {
      if (!featureReleased(root, dependency)) blockers.push({ initiative: ref, dependency, reason: `${dependency} has not completed evidence-release` });
    }
  }
  return blockers;
}
function writeExclusiveOrEqual(file, bytes) {
  if (fs.existsSync(file)) {
    if (fs.readFileSync(file, "utf8") !== bytes) throw new Error(`Existing configuration differs; reconcile explicitly: ${file}`);
    return;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes, { flag: "wx" });
}

export function initializeProject({ root, provider }) {
  if (!["local", "github"].includes(provider)) throw new Error("init requires --provider local or github");
  if (path.resolve(gitOutput(root, ["rev-parse", "--show-toplevel"]).trim()) !== fs.realpathSync(root)) throw new Error("Project must be a Git root; initialize Git explicitly before installing the workflow");
  if (fs.realpathSync(root) !== fs.realpathSync(runtimeRoot)) {
    const state = path.join(root, ".specs/workflow-runtime-install.json");
    run(root, path.join(runtimeRoot, "skills/spec-driven-engineering/scripts/consumer-runtime.mjs"), [fs.existsSync(state) ? "check" : "install", "--target", root, ...(fs.existsSync(state) ? [] : ["--source", runtimeRoot])]);
  }
  if (provider === "github") {
    writeExclusiveOrEqual(projectFile(root, ".github/workflows/sde-delivery.yml"), fs.readFileSync(path.join(root, "prompts/spec-driven/sde-delivery.workflow.yml"), "utf8"));
  }
  writeExclusiveOrEqual(projectFile(root, ".specs/project/workflow-entry.json"), encode({ schemaVersion: "1.0.0", provider, entrypoint: "integrations/governance/workflow-entry.mjs", deliveryCheck: provider === "github" ? ".github/workflows/sde-delivery.yml" : "local-cli" }));
  return { status: "initialized", provider, remoteProtection: "not-verified", next: "begin", prerequisites: ["An initial Git commit must exist before begin", "Trusted host baseline and context are required for delivery"] };
}

export function beginFeature({ root, feature }) {
  const directory = featureDirectory(root, feature);
  if (!fs.existsSync(projectFile(root, ".specs/project/workflow-entry.json"))) throw new Error("Run workflow-entry init before beginning a feature");
  const file = path.join(directory, "execution-start.json");
  if (fs.existsSync(file)) {
    const start = read(file);
    if (start.feature !== feature || !/^[a-f0-9]{40}$/.test(start.baseCommit ?? "")) throw new Error("Invalid feature start record");
    gitOutput(root, ["merge-base", "--is-ancestor", start.baseCommit, "HEAD"]);
    return start;
  }
  if (["01-spec.md", "execution-context.json", "09-tasks.md"].some(ref => fs.existsSync(path.join(directory, ref)))) throw new Error("Feature already started without a baseline; recover its original baseline explicitly, never manufacture a retrospective start");
  const blockers = initiativeBlockers(root, feature);
  if (blockers.length) throw new Error(`Initiative rollout blocks begin of ${feature}: ${blockers.map(row => `${row.initiative}: ${row.reason}`).join("; ")}`);
  let baseCommit;
  try { baseCommit = gitOutput(root, ["rev-parse", "--verify", "HEAD^{commit}"]).trim(); }
  catch { throw new Error("An initial Git commit is required before begin; do not create a commit or choose a later base silently"); }
  const start = { schemaVersion: "1.0.0", feature, baseCommit, snapshot: sourceSnapshot(root) };
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(file, encode(start), { flag: "wx" });
  return start;
}

export function freezeFeature({ root, feature }) {
  const directory = featureDirectory(root, feature);
  const start = read(path.join(directory, "execution-start.json"));
  if (start.feature !== feature) throw new Error("Feature start mismatch");
  const paths = read(path.join(directory, "execution-paths.json"));
  for (const key of ["frontendPaths", "backendPaths", "testPaths"]) {
    if (!Array.isArray(paths[key])) throw new Error(`execution-paths.json requires an explicit ${key} inventory (empty only when there are none)`);
    for (const ref of paths[key]) projectFile(root, ref);
  }
  const existing = loadExecutionContext(root, feature, { required: false });
  if (existing) {
    if (existing.baseCommit !== start.baseCommit || ["frontendPaths", "backendPaths", "testPaths"].some(key => JSON.stringify(existing[key]) !== JSON.stringify(paths[key]))) throw new Error("Frozen baseline/inventory differs; explicit reconciliation required");
    return { status: "frozen", context: existing, sha256: existing.sha256 };
  }
  if (sourceSnapshot(root) !== start.snapshot) throw new Error("Source changed between begin and freeze; finish specification before implementation, do not reset the start record");
  // Validate a disposable candidate before creating the immutable context.
  const candidate = path.join(directory, `.freeze-candidate-${process.pid}.json`);
  const applicability = fs.readFileSync(path.join(directory, "applicability.md"));
  fs.writeFileSync(candidate, encode({ baseCommit: start.baseCommit, frontendPaths: paths.frontendPaths, backendPaths: paths.backendPaths, testPaths: paths.testPaths }), { flag: "wx" });
  try {
    run(root, path.join(root, "skills/spec-driven-engineering/scripts/validate-applicability-contract.mjs"), [path.join(directory, "applicability.md"), "--root", root, "--base-ref", start.baseCommit, "--context", path.relative(root, candidate)]);
    if (sourceSnapshot(root) !== start.snapshot || !fs.readFileSync(path.join(directory, "applicability.md")).equals(applicability)) throw new Error("Source or applicability changed during freeze validation");
  } finally { fs.unlinkSync(candidate); }
  const result = freezeExecutionContext({ root, feature, baseRef: start.baseCommit, frontendPaths: paths.frontendPaths, backendPaths: paths.backendPaths, testPaths: paths.testPaths });
  return { status: "frozen", ...result };
}

export function nextStep({ root, feature }) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(feature ?? "")) throw new Error("next requires a feature slug");
  const idle = { executes: false, feature };
  if (!fs.existsSync(projectFile(root, ".specs/project/workflow-entry.json"))) {
    return { ...idle, status: "needs-init", command: "init", provider: "unselected" };
  }
  const directory = featureDirectory(root, feature);
  if (!fs.existsSync(path.join(directory, "execution-start.json"))) {
    const blockers = initiativeBlockers(root, feature);
    if (blockers.length) return { ...idle, status: "blocked-by-initiative", command: null, blockers };
    return { ...idle, status: "needs-begin", command: "begin" };
  }
  const missing = ["applicability.md", "execution-paths.json"].filter(name => !fs.existsSync(path.join(directory, name)));
  if (missing.length) return { ...idle, status: "needs-specification", command: null, missing };
  if (!fs.existsSync(path.join(directory, "execution-context.json"))) {
    return { ...idle, status: "needs-freeze", command: "freeze" };
  }
  const requirementsPath = path.join(directory, "enforcement-input-requirements.json");
  if (!fs.existsSync(requirementsPath) || read(requirementsPath).status === "needs-inputs") {
    return { ...idle, status: "needs-inputs", command: "inputs" };
  }
  const statePath = path.join(directory, "stage-state.json");
  const state = fs.existsSync(statePath) ? read(statePath) : { stages: {} };
  const pending = applicableStages(root, feature).find(name => state.stages?.[name]?.status !== "complete");
  if (pending) return { ...idle, status: "needs-advance", command: "advance", stage: pending };
  const deliveryPath = projectFile(root, ".specs/delivery.json");
  if (!fs.existsSync(deliveryPath) || read(deliveryPath).feature !== feature) {
    return { ...idle, status: "needs-select-delivery", command: "select-delivery" };
  }
  return { ...idle, status: "needs-delivery", command: "delivery" };
}

function applicableStages(root, feature) {
  const text = fs.readFileSync(path.join(featureDirectory(root, feature), "applicability.md"), "utf8");
  return ["design-readiness", "implementation", ...["frontend", "backend"].filter(kind => new RegExp(`^${kind}-representative-gate: required$`, "m").test(text)).map(kind => `${kind}-representative`), "adversarial", "evidence-release"];
}
function policyFor(root, feature, stage) {
  return JSON.parse(run(root, path.join(root, "integrations/governance/governance-control.mjs"), ["resolve", "--root", root, "--feature", feature, "--stage", stage]));
}
function checkStageInputs(root, feature, stage, values, context, policy, registry) {
  if (!values || typeof values !== "object" || Array.isArray(values)) throw new Error(`Expected input map for ${stage}`);
  for (const id of Object.keys(values)) if (!policy.requiredEnforcements.includes(id)) throw new Error(`Unknown or inapplicable capability input: ${stage}/${id}`);
  const missing = [];
  for (const id of policy.requiredEnforcements) {
    const capability = registry.capabilities.find(row => row.id === id);
    if (capability?.invocation?.mode !== "cli") continue;
    const supplied = values[id] ?? {};
    if (typeof supplied !== "object" || Array.isArray(supplied)) throw new Error(`Expected scalar argument map for ${id}`);
    for (const key of reserved) if (Object.hasOwn(supplied, key)) throw new Error(`Reserved argument cannot be overridden: ${key}`);
    try {
      materializeInvocation(capability, { ...supplied, "project-root": root, "feature-directory": `.specs/features/${feature}`, "feature-slug": feature, "baseline-git-ref": context.baseCommit });
    } catch (error) {
      if (!error.placeholders) throw error;
      missing.push({ capability: id, parameters: error.placeholders, choices: Object.fromEntries(Object.entries(capability.invocation.choices ?? {}).map(([key, options]) => [key.slice(1, -1), Object.keys(options)])) });
    }
  }
  return missing;
}

export function prepareInputs({ root, feature, inputsRef, stage }) {
  const context = loadExecutionContext(root, feature);
  const directory = featureDirectory(root, feature);
  const ref = inputsRef ?? `.specs/features/${feature}/enforcement-inputs.json`;
  const file = projectFile(root, ref);
  const allStages = applicableStages(root, feature);
  if (stage && !allStages.includes(stage)) throw new Error(`Stage not applicable: ${stage}`);
  const inputs = fs.existsSync(file) ? read(file) : { stages: Object.fromEntries(allStages.map(name => [name, {}])) };
  if (!inputs.stages || typeof inputs.stages !== "object" || Array.isArray(inputs.stages)) throw new Error("Inputs require a stages map");
  for (const name of Object.keys(inputs.stages)) if (!allStages.includes(name)) throw new Error(`Unknown or inapplicable input stage: ${name}`);
  const registry = read(path.join(root, "integrations/governance/enforcement-capabilities.json"));
  const requirements = {};
  for (const name of stage ? [stage] : allStages) {
    if (!Object.hasOwn(inputs.stages, name)) throw new Error(`Missing input stage: ${name}`);
    requirements[name] = checkStageInputs(root, feature, name, inputs.stages[name], context, policyFor(root, feature, name), registry);
  }
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, encode(inputs), { flag: "wx" });
  }
  const report = { status: Object.values(requirements).some(rows => rows.length) ? "needs-inputs" : "ready", diagnosticOnly: true, inputsRef: ref, requirements };
  fs.writeFileSync(path.join(directory, "enforcement-input-requirements.json"), encode(report));
  return { report, inputs };
}

export function selectDelivery({ root, feature, inputsRef }) {
  loadExecutionContext(root, feature);
  const inputs = inputsRef ?? `.specs/features/${feature}/enforcement-inputs.json`;
  if (!fs.existsSync(projectFile(root, inputs))) throw new Error("Prepare enforcement inputs before selecting delivery");
  const selection = { feature, inputs };
  const file = projectFile(root, ".specs/delivery.json");
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, encode(selection));
  fs.renameSync(temporary, file);
  return { status: "selected", ...selection, authorization: "required-from-trusted-host" };
}

export function executeWorkflow({ root, feature, stage, inputsRef, delivery = false }) {
  if (delivery && !feature) {
    const selection = read(projectFile(root, ".specs/delivery.json"));
    feature = selection.feature;
    inputsRef = selection.inputs;
  }
  // Execution must never silently create a replacement for omitted inputs.
  const ref = inputsRef ?? `.specs/features/${feature}/enforcement-inputs.json`;
  if (!fs.existsSync(projectFile(root, ref))) throw new Error("Enforcement inputs missing; run inputs and supply the actual artifact references");
  const { report, inputs } = prepareInputs({ root, feature, inputsRef: ref, stage: delivery ? undefined : stage });
  if (report.status !== "ready") throw new Error(`Unresolved enforcement inputs: ${JSON.stringify(report.requirements)}`);
  return delivery ? verifyDelivery({ root, feature, inputs }) : advanceStage({ root, feature, stage, inputs: inputs.stages[stage] });
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
    const allowed = { init: ["root", "provider"], begin: ["root", "feature"], freeze: ["root", "feature"], inputs: ["root", "feature", "inputs", "stage"], advance: ["root", "feature", "stage", "inputs"], "select-delivery": ["root", "feature", "inputs"], delivery: ["root", "feature", "inputs"], next: ["root", "feature"] };
    if (!Object.hasOwn(allowed, command)) throw new Error("Use init, begin, freeze, inputs, advance, select-delivery, delivery or next");
    const args = {};
    for (let i = 0; i < tokens.length; i += 2) {
      const key = tokens[i].replace(/^--/, "");
      if (!tokens[i].startsWith("--") || !allowed[command].includes(key) || Object.hasOwn(args, key) || tokens[i + 1] === undefined) throw new Error("Expected unique supported --option value pairs");
      args[key] = tokens[i + 1];
    }
    const options = { root: path.resolve(args.root ?? process.cwd()), feature: args.feature, provider: args.provider, stage: args.stage, inputsRef: args.inputs };
    let result;
    if (command === "init") result = initializeProject(options);
    else if (command === "next") result = nextStep(options);
    else if (command === "begin") result = beginFeature(options);
    else if (command === "freeze") result = freezeFeature(options);
    else if (command === "inputs") result = prepareInputs(options).report;
    else if (command === "select-delivery") result = selectDelivery(options);
    else result = executeWorkflow({ ...options, delivery: command === "delivery" });
    process.stdout.write(encode(result));
  } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 2; }
}
