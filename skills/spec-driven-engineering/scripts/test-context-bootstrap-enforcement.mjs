#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scripts = path.dirname(fileURLToPath(import.meta.url));
const installedLayoutCandidate = path.resolve(scripts, "../../..");
const workflowRoot = fs.existsSync(path.join(process.cwd(), "prompts/spec-driven/manifest.json"))
  ? process.cwd()
  : installedLayoutCandidate;
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "workflow-context-enforcement-"));
let assertions = 0;

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${content.trim()}\n`);
}

function validateWorkflow(root) {
  return spawnSync("node", [path.join(scripts, "validate-workflow.mjs"), "--root", root], {
    cwd: workflowRoot,
    encoding: "utf8"
  });
}

function expectRejected(label, mutate) {
  const root = path.join(tempRoot, label);
  const destination = path.join(root, "prompts/spec-driven");
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(path.join(workflowRoot, "prompts/spec-driven"), destination, { recursive: true });
  fs.copyFileSync(path.join(workflowRoot, "rules.md"), path.join(root, "rules.md"));
  mutate(root);
  const result = validateWorkflow(root);
  assert.notEqual(
    result.status,
    0,
    `${label}: invalid workflow was accepted:\n${result.stdout}\n${result.stderr}`
  );
  assertions += 1;
}

function replaceRequired(file, from, to) {
  const content = fs.readFileSync(file, "utf8");
  fs.writeFileSync(file, content.replace(from, to));
}

function createFeatureWithUnresolvedPlaceholder() {
  const directory = path.join(tempRoot, "unresolved-feature");
  write(path.join(directory, "00-intent.md"), "# Intent\n\nREQ-PLACEHOLDER-001\n\nScope: {{BACKEND_SCOPE}}");
  write(path.join(directory, "01-spec.md"), "# Spec\n\nREQ-PLACEHOLDER-001: comportamento observável.");
  write(path.join(directory, "02-assumptions.md"), "# Assumptions\n\nNenhuma.");
  write(path.join(directory, "03-acceptance-criteria.md"), "# Acceptance\n\nAC-PLACEHOLDER-001 cobre REQ-PLACEHOLDER-001.");
  write(path.join(directory, "08-test-plan.md"), "# Test plan\n\nGate: passed.");
  write(path.join(directory, "10-adversarial-review.md"), "# Review\n\nADV-PLACEHOLDER-001: encerrado. Gate: passed.");
  write(path.join(directory, "11-evidence.md"), "# Evidence\n\nREQ-PLACEHOLDER-001 → AC-PLACEHOLDER-001. Gate: passed.");
  return directory;
}

try {
  const canonicalManifest = JSON.parse(fs.readFileSync(path.join(workflowRoot, "prompts/spec-driven/manifest.json"), "utf8"));
  const sharedRules = canonicalManifest.sharedRules.find((entry) => entry.id === "engineering-rules");
  assert.equal(sharedRules.pathResolution, "required-every-prompt");
  assert.equal(sharedRules.contentLoading, "governed-by-context-bootstrap");
  assert.equal(Object.prototype.hasOwnProperty.call(sharedRules, "load"), false);
  const governancePolicy = canonicalManifest.contextBootstrap.governancePolicy;
  assert.equal(governancePolicy.bootstrap, "integrations/governance/governance-control.mjs bootstrap");
  assert.equal(governancePolicy.preApplicabilityRules, "full-read-required");
  assert.ok(["shadow", "primary"].includes(governancePolicy.mode));
  assert.equal(
    governancePolicy.rulesResolution,
    governancePolicy.mode === "shadow"
      ? "preserved-full-read"
      : "policy-primary-registered-rules-rationale-fallback"
  );
  assert.equal(governancePolicy.humanGates, "unchanged");
  assertions += 8;

  const governanceRegistry = JSON.parse(fs.readFileSync(path.join(workflowRoot, "prompts/spec-driven/governance-policy.json"), "utf8"));
  assert.equal(governanceRegistry.admissionBoundary.mode, "registry-first");
  assert.equal(governanceRegistry.admissionBoundary.legacyBaseline.operational, true);
  assert.equal(governanceRegistry.admissionBoundary.unregisteredAdditions, "non-operative");
  assert.equal(governanceRegistry.admissionBoundary.rationaleOnlyOperational, false);
  assert.ok(governanceRegistry.rules.some((rule) => rule.id === "RULE-SDE-ADMISSION-001" && rule.kind === "hard-invariant"));
  assertions += 5;

  const canonicalSkill = fs.readFileSync(path.join(workflowRoot, "skills/spec-driven-engineering/SKILL.md"), "utf8");
  const canonicalReference = fs.readFileSync(path.join(workflowRoot, "skills/spec-driven-engineering/references/context-bootstrap.md"), "utf8");
  const canonicalRules = fs.readFileSync(path.join(workflowRoot, "rules.md"), "utf8");
  assert.match(canonicalSkill, /governance-control\.mjs bootstrap/);
  assert.match(canonicalSkill, /validate-governance-policy\.mjs --root <PROJECT_ROOT>/);
  assert.match(canonicalSkill, /governance legacy captured by the admitted baseline/);
  assert.match(canonicalSkill, /additions after that baseline are non-operative/);
  assert.doesNotMatch(canonicalSkill, /legacy\/unregistered governance/);
  assert.doesNotMatch(canonicalSkill, /canonical project rules\. Missing or conflicting rules block the stage\./);
  assert.match(canonicalReference, /Path resolution is required on every execution and is distinct from reading the full rules content\./);
  assert.match(canonicalReference, /validate-governance-policy\.mjs --root <project-root>/);
  assert.match(canonicalReference, /bootstrap\.rulesAdmission\.unregisteredAdditions=non-operative/);
  assert.match(canonicalReference, /governance legacy captured by the admitted baseline/);
  assert.doesNotMatch(canonicalReference, /legacy\/unregistered governance/);
  assert.doesNotMatch(canonicalReference, /Read the resolved rules on every execution\./);
  assert.match(canonicalRules, /Resolver o path das regras é obrigatório em toda execução e não implica ler seu conteúdo integralmente\./);
  assert.doesNotMatch(canonicalRules, /Leia as regras de engenharia em toda execução\./);
  assertions += 14;

  expectRejected("missing-bootstrap", (root) => {
    const file = path.join(root, "prompts/spec-driven/03-acceptance.prompt.md");
    replaceRequired(file, "<bootstrap>", "<bootstrap-removed>");
  });

  expectRejected("missing-rules-resolution", (root) => {
    const file = path.join(root, "prompts/spec-driven/04-behavior-tests.prompt.md");
    replaceRequired(file, "rules-resolution:", "rules-resolution-removed:");
  });

  expectRejected("missing-placeholder-resolution", (root) => {
    const file = path.join(root, "prompts/spec-driven/07-execute.prompt.md");
    replaceRequired(file, "<placeholder_resolution>", "<placeholder-resolution-removed>");
  });

  expectRejected("missing-instruction-trust", (root) => {
    const file = path.join(root, "prompts/spec-driven/02-spec-assumptions.prompt.md");
    replaceRequired(file, "instruction-trust:", "instruction-trust-removed:");
  });

  expectRejected("missing-state-output", (root) => {
    const file = path.join(root, "prompts/spec-driven/03-acceptance.prompt.md");
    replaceRequired(
      file,
      "- `.specs/project/STATE.md` somente para decisão, blocker, lição ou ideia adiada durável\n",
      ""
    );
  });

  expectRejected("missing-context-policy", (root) => {
    const file = path.join(root, "prompts/spec-driven/manifest.json");
    const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
    delete manifest.contextBootstrap;
    fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
  });

  expectRejected("missing-tlc-route", (root) => {
    const file = path.join(root, "prompts/spec-driven/manifest.json");
    const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
    manifest.skillRoutes = manifest.skillRoutes.filter((route) => route.skill !== "tlc-spec-driven");
    fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
  });

  expectRejected("missing-placeholder-registry-entry", (root) => {
    const file = path.join(root, "prompts/spec-driven/manifest.json");
    const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
    manifest.placeholderPolicy.resolutions = manifest.placeholderPolicy.resolutions.filter(
      (item) => item.name !== "BACKEND_SCOPE"
    );
    fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
  });

  expectRejected("evaluation-scope-allows-code", (root) => {
    const file = path.join(root, "prompts/spec-driven/manifest.json");
    const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
    manifest.placeholderPolicy.resolutions.find((item) => item.name === "EVALUATION_SCOPE").codeAllowed = true;
    fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
  });

  expectRejected("undeclared-placeholder", (root) => {
    const file = path.join(root, "prompts/spec-driven/03-acceptance.prompt.md");
    const content = fs.readFileSync(file, "utf8");
    fs.writeFileSync(file, `${content}\nEscopo inesperado: {{SURPRISE_SCOPE}}\n`);
  });

  expectRejected("missing-rules-contract", (root) => {
    const file = path.join(root, "rules.md");
    replaceRequired(file, "## Resolução de Placeholders", "## Resolução removida");
  });

  expectRejected("design-scope-fallback", (root) => {
    const file = path.join(root, "prompts/spec-driven/05-design-readiness.prompt.md");
    replaceRequired(file, "scope-inference: backend-frontend", "scope-inference-removed: backend-frontend");
  });

  expectRejected("evaluation-scope-fallback", (root) => {
    const file = path.join(root, "prompts/spec-driven/06.5-freeze-evaluation-baseline.prompt.md");
    replaceRequired(file, "evaluation-scope-source: approved-contracts-only", "evaluation-scope-source-removed: approved-contracts-only");
  });

  const unresolvedFeature = createFeatureWithUnresolvedPlaceholder();
  const featureResult = spawnSync(
    "node",
    [path.join(scripts, "validate-feature-package.mjs"), unresolvedFeature],
    { cwd: workflowRoot, encoding: "utf8" }
  );
  assert.notEqual(
    featureResult.status,
    0,
    `Feature package with unresolved placeholder was accepted:\n${featureResult.stdout}\n${featureResult.stderr}`
  );
  assertions += 1;

  console.log(`Context/bootstrap enforcement: passed (${assertions} assertions, rollout=${governancePolicy.mode})`);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
