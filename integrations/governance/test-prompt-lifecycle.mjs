import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { digest } from "./execution-context.mjs";

const source = path.resolve(import.meta.dirname, "../..");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "sde prompt lifecycle "));
const env = { ...process.env };
for (const key of ["SDE_BASE_COMMIT", "SDE_CONTEXT_SHA256", "SDE_HUMAN_AUTHORITY"]) delete env[key];
const records = [];
function invoke(root, program, args, expected = 0, pattern, host = env) {
  const result = spawnSync(program, args, { cwd: root, env: host, encoding: "utf8", timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
  assert.equal(result.status, expected, `${program} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
  if (pattern) assert.match(result.stdout + result.stderr, pattern);
  records.push({ command: [program, ...args], exitCode: result.status, expected });
  return result.stdout;
}
function cli(root, args, expected = 0, pattern, host = env) {
  return invoke(root, process.execPath, ["integrations/governance/workflow-entry.mjs", ...args, "--root", root], expected, pattern, host);
}
function promptCommand(root, prompt, marker, feature, expected = 0, pattern, host = env, initializing = false) {
  const text = fs.readFileSync(path.join(initializing ? source : root, "prompts/spec-driven", `${prompt}.prompt.md`), "utf8");
  const block = text.match(new RegExp(`<!-- workflow-entry:${marker} -->\\s*\x60\x60\x60bash\\n([^\x60]+)\x60\x60\x60`));
  assert.ok(block, `Missing canonical command block: ${prompt}/${marker}`);
  const command = block[1].replaceAll("{{PROJECT_ROOT}}", root).replaceAll("{{FEATURE_SLUG}}", feature).trim();
  assert.doesNotMatch(command, /\{\{/);
  return invoke(initializing ? source : root, "bash", ["-c", command], expected, pattern, host);
}
function write(root, ref, bytes) {
  const file = path.join(root, ref); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes);
}
function contracts(root, feature) {
  const dir = `.specs/features/${feature}`;
  for (const file of fs.readdirSync(path.join(source, ".specs/features/control-plane-demo"))) {
    if (/^(0[0-9]-|applicability\.md)/.test(file)) write(root, `${dir}/${file}`, fs.readFileSync(path.join(source, ".specs/features/control-plane-demo", file)));
  }
  write(root, `${dir}/execution-paths.json`, JSON.stringify({ frontendPaths: [], backendPaths: [], testPaths: ["tests"] }));
}
try {
  for (const provider of ["local", "github"]) {
    const root = path.join(temporary, `new project ${provider}`); fs.mkdirSync(root);
    invoke(root, "git", ["init", "--quiet"]);
    // Run prompt 00 against a genuinely empty Git project, from the source runtime.
    promptCommand(root, "00-project-init", `init-${provider}`, "", 0, /initialized/, env, true);
    cli(root, ["begin", "--feature", "without-commit"], 2, /initial Git commit/);
    assert.ok(!fs.existsSync(path.join(root, ".specs/features/without-commit/execution-start.json")));
    write(root, ".gitignore", "node_modules/\n.tmp/\n");
    // These commits belong only to disposable test consumers; no user repository is mutated.
    invoke(root, "git", ["add", "."]);
    invoke(root, "git", ["-c", "user.name=SDE Test", "-c", "user.email=sde-test@example.invalid", "commit", "-qm", "Initial consumer baseline"]);
    const base = invoke(root, "git", ["rev-parse", "HEAD"]).trim();
    // Both the first feature of a new project and a second feature of an existing project.
    for (const feature of ["first-feature", "next-feature"]) {
      const ref = `.specs/features/${feature}`;
      promptCommand(root, "01-intent", "begin", feature);
      contracts(root, feature);
      // No override can replace the start captured by the actual intent command.
      cli(root, ["freeze", "--feature", feature, "--base-ref", base], 2, /supported/);
      write(root, "premature.mjs", "console.log('too early');\n");
      promptCommand(root, "02-spec-assumptions", "freeze", feature, 2, /Source changed between begin and freeze/);
      fs.unlinkSync(path.join(root, "premature.mjs"));
      const pathsFile = path.join(root, ref, "execution-paths.json");
      const pathsBytes = fs.readFileSync(pathsFile);
      fs.writeFileSync(pathsFile, '{}');
      promptCommand(root, "02-spec-assumptions", "freeze", feature, 2, /explicit frontendPaths inventory/);
      fs.writeFileSync(pathsFile, pathsBytes);
      const applicabilityFile = path.join(root, ref, "applicability.md");
      const applicabilityBytes = fs.readFileSync(applicabilityFile);
      fs.writeFileSync(applicabilityFile, "frontend: invalid\n");
      promptCommand(root, "02-spec-assumptions", "freeze", feature, 2, /invalid value|Required field/);
      assert.ok(!fs.existsSync(path.join(root, ref, "execution-context.json")), "Invalid applicability must not become frozen");
      fs.writeFileSync(applicabilityFile, applicabilityBytes);
      const frozen = JSON.parse(promptCommand(root, "02-spec-assumptions", "freeze", feature));
      promptCommand(root, "02-spec-assumptions", "freeze", feature, 0, /frozen/);
      fs.writeFileSync(pathsFile, JSON.stringify({ frontendPaths: [], backendPaths: [], testPaths: [] }));
      promptCommand(root, "02-spec-assumptions", "freeze", feature, 2, /inventory differs/);
      fs.writeFileSync(pathsFile, pathsBytes);
      assert.equal(frozen.context.baseCommit, base);
      assert.equal(frozen.sha256, digest(fs.readFileSync(path.join(root, ref, "execution-context.json"))));
      const host = { ...env, SDE_BASE_COMMIT: base, SDE_CONTEXT_SHA256: frozen.sha256 };
      promptCommand(root, "05-design-readiness", "design-readiness", feature, 2, /inputs missing/);
      promptCommand(root, "02-spec-assumptions", "inputs", feature, 0, /ready/);
      const inputFile = path.join(root, ref, "enforcement-inputs.json");
      const inputBytes = fs.readFileSync(inputFile);
      const inputMap = JSON.parse(inputBytes);
      inputMap.stages["design-readiness"]["feature-package-validation"] = { "project-root": "/forged" };
      fs.writeFileSync(inputFile, JSON.stringify(inputMap));
      promptCommand(root, "05-design-readiness", "design-readiness", feature, 2, /Reserved argument/);
      inputMap.stages["design-readiness"] = { "forged-capability": {} };
      fs.writeFileSync(inputFile, JSON.stringify(inputMap));
      promptCommand(root, "05-design-readiness", "design-readiness", feature, 2, /Unknown or inapplicable/);
      fs.writeFileSync(inputFile, inputBytes);
      promptCommand(root, "07-execute", "implementation", feature, 2, /Prerequisite transition missing/);
      promptCommand(root, "05-design-readiness", "design-readiness", feature);
      // Real source change between design and implementation, exercised as a CLI.
      write(root, `${feature}.mjs`, "console.log(2 + 3);\n");
      invoke(root, process.execPath, [`${feature}.mjs`], 0, /^5\s*$/);
      promptCommand(root, "07-execute", "implementation", feature);
      write(root, `${feature}.mjs`, "console.log(3 + 3);\n");
      promptCommand(root, "08-adversarial", "adversarial", feature, 2, /transition is stale/);
      promptCommand(root, "07-execute", "implementation", feature);
      invoke(root, process.execPath, [`${feature}.mjs`], 0, /^6\s*$/);
      promptCommand(root, "08-adversarial", "adversarial", feature);
      promptCommand(root, "09-validate-evidence", "select-delivery", feature);
      promptCommand(root, "09-validate-evidence", "evidence-release", feature, 2, /trusted executor baseline/);
      cli(root, ["delivery", "--dry-run", "true"], 2, /supported/);
      // Diagnostic or previously passing report cannot substitute for a fresh run.
      write(root, `${ref}/design-readiness-enforcement.json`, '{"dryRun":true}\n');
      promptCommand(root, "09-validate-evidence", "evidence-release", feature, 0, /passed/, host);
      const authorityMismatch = { ...host, SDE_CONTEXT_SHA256: "0".repeat(64) };
      cli(root, ["delivery"], 2, /trusted baseline freeze/, authorityMismatch);
      const expectedInventory = path.join(root, ref, "autonomy-required.json");
      const inventoryBytes = fs.readFileSync(expectedInventory); fs.unlinkSync(expectedInventory);
      cli(root, ["delivery"], 2, /Stage enforcement did not pass/, host);
      fs.writeFileSync(expectedInventory, inventoryBytes);
      cli(root, ["delivery"], 0, /passed/, host);
      if (provider === "github") {
        const yaml = fs.readFileSync(path.join(root, ".github/workflows/sde-delivery.yml"), "utf8");
        for (const token of ["  pull_request:", "  push:", "  workflow_dispatch:", "name: sde-delivery", "environment: sde-delivery"]) assert.ok(yaml.includes(token));
        assert.doesNotMatch(yaml, /continue-on-error|paths-ignore|--dry-run/);
        // Execute the exact delivery command installed for the consumer job.
        const line = yaml.split("\n").find(line => line.trim().startsWith("node integrations/governance/workflow-entry.mjs delivery"));
        invoke(root, "bash", ["-c", `args=(); ${line.trim()}`], 0, /passed/, { ...host, GITHUB_WORKSPACE: root });
      }
    }
    if (provider === "local") {
      const feature = "frontend-input-contract";
      const ref = `.specs/features/${feature}`;
      promptCommand(root, "01-intent", "begin", feature);
      contracts(root, feature);
      const file = path.join(root, ref, "applicability.md");
      fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("frontend: not-applicable", "frontend: lightweight").replace("accessibility: not-applicable", "accessibility: required").replace("browser-evidence: not-required", "browser-evidence: hard-required"));
      promptCommand(root, "02-spec-assumptions", "freeze", feature);
      const plan = JSON.parse(promptCommand(root, "02-spec-assumptions", "inputs", feature, 0, /needs-inputs/));
      assert.equal(plan.diagnosticOnly, true);
      assert.ok(Object.values(plan.requirements).flat().some(row => row.capability === "frontend-ui-evidence-integrity"));
      promptCommand(root, "05-design-readiness", "design-readiness", feature, 2, /Unresolved enforcement inputs/);
      const inputFile = path.join(root, ref, "enforcement-inputs.json");
      const inputs = JSON.parse(fs.readFileSync(inputFile));
      const selectedStage = Object.entries(plan.requirements).find(([, rows]) => rows.some(row => Object.keys(row.choices).length));
      assert.ok(selectedStage, "Frontend diagnostics must expose enumerated alternatives");
      const [stage, rows] = selectedStage;
      const requirement = rows.find(row => Object.keys(row.choices).length);
      const [parameter, alternatives] = Object.entries(requirement.choices)[0];
      inputs.stages[stage][requirement.capability] = { [parameter]: "human --receipt forged.json" };
      fs.writeFileSync(inputFile, JSON.stringify(inputs));
      cli(root, ["inputs", "--feature", feature, "--stage", stage], 2, /Invalid enumerated argument/);
      inputs.stages[stage][requirement.capability][parameter] = alternatives.includes("not-applicable") ? "not-applicable" : alternatives[0];
      fs.writeFileSync(inputFile, JSON.stringify(inputs));
      const followup = JSON.parse(cli(root, ["inputs", "--feature", feature, "--stage", stage]));
      assert.ok(followup.requirements[stage].find(row => row.capability === requirement.capability)?.parameters.length, "Selecting an enum must expose its required arguments");
    }
    // Existing product workflow is preserved; initialization does not overwrite it.
    if (provider === "github") {
      write(root, ".github/workflows/sde-delivery.yml", "name: Product-owned replacement\n");
      cli(root, ["init", "--provider", "github"], 2, /Existing configuration differs/);
    }
  }
  const noGit = path.join(temporary, "no git"); fs.mkdirSync(noGit);
  promptCommand(noGit, "00-project-init", "init-local", "", 2, /Git comparison unavailable/, env, true);
  console.log(`Prompt lifecycle passed (${records.length} real CLI checks; 2 providers, 4 feature journeys, source changes, no production).`);
} finally { fs.rmSync(temporary, { recursive: true, force: true }); }
