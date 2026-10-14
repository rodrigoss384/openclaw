#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const installedLayoutCandidate = path.resolve(scriptDirectory, "../../..");
const currentDirectory = process.cwd();
const workflowRoot = fs.existsSync(path.join(currentDirectory, "prompts/spec-driven/manifest.json"))
  ? currentDirectory
  : installedLayoutCandidate;
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "spec-driven-engineering-test-"));
let assertions = 0;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || workflowRoot,
    encoding: "utf8",
    env: process.env
  });
  if (options.expectFailure) {
    assert.notEqual(result.status, 0, `${command} unexpectedly succeeded`);
  } else {
    assert.equal(result.status, 0, `${command} failed:\n${result.stdout}\n${result.stderr}`);
  }
  assertions += 1;
  return result;
}

function runAsync(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: options.cwd || workflowRoot, env: process.env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${content.trim()}\n`);
}

function createFeature(name, profile) {
  const prefix = name.toUpperCase().replace(/[^A-Z0-9]+/g, "-");
  const directory = path.join(tempRoot, "fixtures", name);
  const req = `REQ-${prefix}-001`;
  const ac = `AC-${prefix}-001`;
  const scn = `SCN-${prefix}-001`;
  const at = `AT-${prefix}-001`;
  const task = `T-${prefix}-001`;
  const property = `PROP-${prefix}-001`;
  write(path.join(directory, "00-intent.md"), `# Intent\n\n${req}\n\nComplexity: ${profile.complexity}\nCriticality: ${profile.criticality}`);
  write(path.join(directory, "01-spec.md"), `# Spec\n\n${req}: comportamento observável.`);
  write(path.join(directory, "02-assumptions.md"), "# Assumptions\n\nNenhuma suposição ativa.");
  write(path.join(directory, "03-acceptance-criteria.md"), `# Acceptance\n\n${ac} cobre ${req}.`);
  write(path.join(directory, "04-behavior-scenarios.feature"), `# ${ac}\n@${scn}\nScenario: contrato representativo\n  Given um estado válido\n  When a ação ocorre\n  Then o resultado é observável`);
  write(path.join(directory, "05-executable-acceptance-tests.md"), `# Executable tests\n\n${at} implementa ${scn}.`);
  write(path.join(directory, "06-properties.md"), profile.criticality === "critical" ? `# Properties\n\n${property}: a invariante é preservada.` : "# Properties\n\nN/A — não há invariante combinatória neste recorte.");
  const designContracts = [
    profile.backend ? "Backend contract: docs/backend/backend-change-manifest.json" : "Backend: not-applicable",
    profile.frontend ? "Frontend contract: docs/frontend/README.md" : "Frontend: not-applicable"
  ].join("\n");
  write(path.join(directory, "07-design.md"), `# Design\n\n${designContracts}`);
  write(path.join(directory, "08-test-plan.md"), `# Test plan\n\n${at}: RED esperado; gate: passed.`);
  write(path.join(directory, "09-tasks.md"), `# Tasks\n\n${task} liga ${req}, ${ac}, ${scn} e ${at}.`);
  const backendGateRequired = profile.backend && (
    profile.auth ||
    profile.criticality === "critical" ||
    ["large", "complex"].includes(profile.complexity)
  );
  write(path.join(directory, "applicability.md"), [
    "# Applicability Contract",
    "",
    "```text",
    `complexity: ${profile.complexity}`,
    `criticality: ${profile.criticality}`,
    `frontend: ${profile.frontend ? "substantial" : "not-applicable"}`,
    `backend: ${profile.backend ? "substantial" : "not-applicable"}`,
    "persistence: not-applicable",
    "public-api: unchanged",
    `auth: ${profile.auth ? "affected" : "not-applicable"}`,
    "tenancy: not-applicable",
    "concurrency: not-applicable",
    "migration: not-applicable",
    "new-service-or-subsystem: not-applicable",
    "material-operational-cost: not-applicable",
    `performance: ${profile.criticality === "critical" ? "critical" : "not-applicable"}`,
    `accessibility: ${profile.frontend ? "required" : "not-applicable"}`,
    `frontend-representative-gate: ${profile.frontend ? "required" : "not-required"}`,
    `backend-representative-gate: ${backendGateRequired ? "required" : "not-required"}`,
    `browser-evidence: ${profile.frontend ? "hard-required" : "not-required"}`,
    "contract-drift-check: not-applicable",
    `interface-contract: ${profile.backend ? "applicable" : "not-applicable"}`,
    `interface-contract-kind: ${profile.backend ? "http" : "none"}`,
    `interface-contract-type: ${profile.backend ? "openapi" : "none"}`,
    "behavioral-ux: not-applicable",
    "behavioral-ux-risk: none",
    "outcome-evidence: not-applicable",
    "```"
  ].join("\n"));
  write(path.join(directory, "10-adversarial-review.md"), `# Adversarial\n\nADV-${prefix}-001: encerrado. Gate: passed.`);
  write(path.join(directory, "11-evidence.md"), `# Evidence\n\n${req} → ${ac} → ${scn} → ${at} → ${task}. Decision: approved. Gate: passed.`);
  return directory;
}

try {
  run("node", [path.join(scriptDirectory, "validate-workflow.mjs"), "--root", workflowRoot]);
  run("node", [path.join(scriptDirectory, "test-manifest-schema-enforcement.mjs")]);
  run("node", [path.join(scriptDirectory, "test-context-bootstrap-enforcement.mjs")]);
  run("node", [path.join(scriptDirectory, "test-frontend-styling-enforcement.mjs")]);
  run("node", [path.join(scriptDirectory, "test-human-approval-runbook-enforcement.mjs")]);
  run("node", [path.join(scriptDirectory, "test-human-guidance.mjs")]);

  const backend = createFeature("backend-low", { complexity: "small", criticality: "low", frontend: false, backend: true });
  const fullstack = createFeature("fullstack-standard", { complexity: "large", criticality: "standard", frontend: true, backend: true });
  const critical = createFeature("authorization-critical", { complexity: "quick", criticality: "critical", frontend: false, backend: true, auth: true });
  for (const fixture of [backend, fullstack, critical]) {
    run("node", [path.join(scriptDirectory, "validate-feature-package.mjs"), fixture]);
    run("node", [path.join(scriptDirectory, "validate-applicability-contract.mjs"), path.join(fixture, "applicability.md")]);
  }

  const preregistration = [
    "- Hipótese: reduzir passos do onboarding de 5 para 3 aumenta activation em usuários novos",
    "- Behavioral UX Contract relacionado (se houver): Nenhum",
    "- Metric Class do `primaryMetric`: user-outcome",
    "- Dimensão HEART (obrigatória somente quando Metric Class é `user-outcome`): Adoption",
    "- `primaryMetric`: activation-rate-7d",
    "- `guardrails`: setup-error-rate, support-contact-rate",
    "- Tamanho/duração mínima da amostra: 500 novos usuários ou 14 dias",
    "- Limiar de confirmação vs refutação (fixado agora, nunca ajustado depois de ver dados): +5pp de activation-rate-7d, IC95%",
    "- Método de análise (regra fixa; não escolhida depois de observar os dados): teste de proporção bicaudal, alpha 0.05",
    "- Data planejada de início da janela de observação: 2026-08-10",
    "- Data planejada de fechamento da janela de observação: 2026-08-24"
  ].join("\n");
  const frozenSha256 = crypto.createHash("sha256").update(preregistration, "utf8").digest("hex");
  const outcomePlanValid = path.join(tempRoot, "fixtures", "outcome-plan-valid", "outcome-plan.md");
  write(outcomePlanValid, [
    "# Onboarding Simplificado — Outcome Plan (preregistration)",
    "",
    "## Preregistration",
    "",
    preregistration,
    "",
    "## Freeze",
    "",
    "- status: frozen",
    "- frozenAt: 2026-08-08T12:00:00-03:00",
    `- frozenSha256: ${frozenSha256}`
  ].join("\n"));
  run("node", [path.join(scriptDirectory, "validate-outcome-plan.mjs"), outcomePlanValid]);

  const outcomePlanTampered = path.join(tempRoot, "fixtures", "outcome-plan-tampered", "outcome-plan.md");
  write(
    outcomePlanTampered,
    fs.readFileSync(outcomePlanValid, "utf8").replace("+5pp de activation-rate-7d", "+2pp de activation-rate-7d")
  );
  run("node", [path.join(scriptDirectory, "validate-outcome-plan.mjs"), outcomePlanTampered], { expectFailure: true });

  const handoffProjectRoot = path.join(tempRoot, "handoff-concurrency-project");
  const handoffBodyPath = path.join(tempRoot, "fixtures", "handoff-body.md");
  const sidecarBodyPath = path.join(tempRoot, "fixtures", "sidecar-body.json");
  write(handoffBodyPath, [
    "# Handoff",
    "",
    "**sessionId:** `{{SESSION_ID}}`",
    "**revision:** `{{REVISION}}`",
    "**agent:** `{{AGENT}}`",
    "**Timestamp:** `{{TIMESTAMP}}`",
    "**Ponto exato:** teste automatizado de concorrência.",
    "",
    "## Ação humana pendente",
    "",
    "Nenhuma."
  ].join("\n"));
  write(sidecarBodyPath, JSON.stringify({
    sessionId: "{{SESSION_ID}}",
    agent: "{{AGENT}}",
    baseRevision: "{{BASE_REVISION}}",
    conflictingRevision: "{{CONFLICTING_REVISION}}",
    timestamp: "{{TIMESTAMP}}"
  }));
  const updateHandoffScript = path.join(scriptDirectory, "update-handoff.mjs");
  const handoffPath = path.join(handoffProjectRoot, ".specs/HANDOFF.md");

  run("node", [
    updateHandoffScript, "--root", handoffProjectRoot, "--session-id", "seed", "--agent", "claude-code",
    "--base-revision", "none", "--handoff-file", handoffBodyPath, "--sidecar-file", sidecarBodyPath
  ]);
  assert.match(fs.readFileSync(handoffPath, "utf8"), /\*\*revision:\*\* `1`/);
  assertions += 1;

  const [raceA, raceB] = await Promise.all([
    runAsync("node", [
      updateHandoffScript, "--root", handoffProjectRoot, "--session-id", "race-A", "--agent", "claude-code",
      "--base-revision", "1", "--handoff-file", handoffBodyPath, "--sidecar-file", sidecarBodyPath
    ]),
    runAsync("node", [
      updateHandoffScript, "--root", handoffProjectRoot, "--session-id", "race-B", "--agent", "gemini-cli",
      "--base-revision", "1", "--handoff-file", handoffBodyPath, "--sidecar-file", sidecarBodyPath
    ])
  ]);
  const statuses = [raceA.status, raceB.status].sort();
  assert.deepEqual(statuses, [0, 2], `Concurrent update-handoff.mjs race must produce exactly one winner (0) and one detected conflict (2); got ${JSON.stringify(statuses)}`);
  assertions += 1;
  const loser = raceA.status === 2 ? "race-A" : "race-B";
  assert.ok(fs.existsSync(path.join(handoffProjectRoot, ".specs/sessions", `${loser}.json`)), "Losing session must have a conflict sidecar recorded.");
  assertions += 1;
  assert.match(fs.readFileSync(handoffPath, "utf8"), /\*\*revision:\*\* `2`/, "Winning write must land as revision 2 — no lost update, no double-increment.");
  assertions += 1;
  assert.ok(!fs.existsSync(path.join(handoffProjectRoot, ".specs/.handoff.lock")), "Lock file must not survive past both racing processes.");
  assertions += 1;

  const interrupted = path.join(tempRoot, "interrupted-project");
  write(path.join(interrupted, ".specs/HANDOFF.md"), `
# Handoff
Workflow version: 2.1.4
Stage: in-progress
Gate: partial
Task: T-INTERRUPTED-001
Exact stop: src/service.ts:42
Last command: npm test -- service.test.ts
Result: failed
## Perguntas em aberto
Q-INTERRUPTED-001
## Ideias adiadas
DEF-INTERRUPTED-001
## Bloqueios
B-INTERRUPTED-001
## Próximo passo
Rerun the focused test.
`);
  const handoff = fs.readFileSync(path.join(interrupted, ".specs/HANDOFF.md"), "utf8");
  for (const fragment of ["in-progress", "src/service.ts:42", "Q-INTERRUPTED-001", "DEF-INTERRUPTED-001", "B-INTERRUPTED-001", "Próximo passo"]) {
    assert.ok(handoff.includes(fragment), `Interrupted handoff lost: ${fragment}`);
    assertions += 1;
  }

  const legacy = path.join(tempRoot, "migration-project", ".specs", "features", "legacy-feature");
  write(path.join(legacy, "context.md"), "# Context\n\nREQ-LEGACY-001");
  write(path.join(legacy, "spec.md"), "# Spec\n\nAC-LEGACY-001");
  write(path.join(legacy, "tasks.md"), "# Tasks\n\nT-LEGACY-001");
  const migrationScript = path.join(scriptDirectory, "migrate-v1.mjs");
  const dryRun = run("node", [migrationScript, "--feature-dir", legacy]);
  assert.ok(dryRun.stdout.includes("DRY-RUN") && dryRun.stdout.includes("No files changed"));
  assertions += 1;
  run("node", [migrationScript, "--feature-dir", legacy, "--apply"]);
  assert.ok(fs.existsSync(path.join(legacy, "00-intent.md")));
  assert.ok(fs.existsSync(path.join(tempRoot, "migration-project", ".specs", "migrations")));
  assertions += 2;
  run("node", [migrationScript, "--feature-dir", legacy], { expectFailure: true });

  const noGitProject = path.join(tempRoot, "no-git-project");
  fs.mkdirSync(noGitProject, { recursive: true });
  assert.equal(fs.existsSync(path.join(noGitProject, ".git")), false);
  assertions += 1;

  const manifest = JSON.parse(fs.readFileSync(path.join(workflowRoot, "prompts/spec-driven/manifest.json"), "utf8"));
  assert.equal(manifest.workflowVersion, "2.4.0");
  assert.equal(manifest.contextBootstrap.requiredEveryPrompt, true);
  assert.equal(manifest.placeholderPolicy.neverPersistUnresolved, true);
  assert.ok(manifest.skillRoutes.some((route) => route.skill === "tlc-spec-driven" && route.requirementLevel && route.requirementLevel !== "optional"));
  assert.ok(manifest.skillRoutes.some((route) => route.skill === "backend-product-builder" && route.required));
  assert.ok(manifest.skillRoutes.some((route) => route.when === "backend-technology-selection-rust-axum-default" && route.skill === "rust-pro" && route.required && route.requirementLevel === "hard-required"));
  assert.ok(manifest.skillRoutes.some((route) => route.skill === "ui-audit-redesign-engineer" && route.required));
  assert.equal(manifest.frontendStylingPolicy.contract, "docs/frontend/styling-authority.json");
  assert.equal(manifest.sessionClosure.humanApprovalRunbook.finalHeading, "Como validar e aprovar");
  assert.equal(manifest.sessionClosure.humanApprovalRunbook.approvalNeverInferredFromExecution, true);
  assert.deepEqual(
    manifest.gates.filter((gate) => gate.id.includes("representative")).map((gate) => gate.id),
    ["backend-representative", "frontend-representative"]
  );
  assertions += 11;

  for (const prompt of manifest.prompts) {
    const content = fs.readFileSync(path.join(workflowRoot, "prompts/spec-driven", prompt.file), "utf8");
    for (const fragment of ["<bootstrap>", "rules-resolution:", "<placeholder_resolution>", ".specs/project/STATE.md"]) {
      assert.ok(content.includes(fragment), `${prompt.file} lost clean-window contract: ${fragment}`);
      assertions += 1;
    }
  }

  const executePrompt = fs.readFileSync(path.join(workflowRoot, "prompts/spec-driven/07-execute.prompt.md"), "utf8");
  assert.ok(executePrompt.includes("broad backend build antes de `backend-broad-build-approved`"));
  assert.ok(executePrompt.includes("build frontend amplo antes de representative gate"));
  assertions += 2;

  const backendGatePrompt = fs.readFileSync(path.join(workflowRoot, "prompts/spec-driven/07.2-backend-representative-gate.prompt.md"), "utf8");
  for (const fragment of ["OpenAPI", "BOLA/IDOR", "tenant isolation", "timeout", "migration", "backend-broad-build-approved"]) {
    assert.ok(backendGatePrompt.includes(fragment), `Backend gate fixture lost: ${fragment}`);
    assertions += 1;
  }

  const fullstackDesign = fs.readFileSync(path.join(fullstack, "07-design.md"), "utf8");
  assert.ok(fullstackDesign.includes("docs/backend/") && fullstackDesign.includes("docs/frontend/"));
  assertions += 1;

  const backendSkill = fs.readFileSync(path.join(workflowRoot, "skills/backend-product-builder/SKILL.md"), "utf8");
  for (const speculative of ["repository", "cache", "queue", "microservice"]) {
    assert.ok(backendSkill.includes(speculative), `Backend anti-speculation rule missing: ${speculative}`);
    assertions += 1;
  }

  const rustSkillRoot = path.join(workflowRoot, "skills/rust-pro");
  const rustSkill = fs.readFileSync(path.join(rustSkillRoot, "SKILL.md"), "utf8");
  for (const relative of ["agents/openai.yaml", "references/stack-selection.md", "references/axum-service-design.md", "references/data-reliability.md", "references/quality-gates.md"]) {
    assert.ok(fs.existsSync(path.join(rustSkillRoot, relative)), `Rust skill progressive reference missing: ${relative}`);
    assertions += 1;
  }
  assert.ok(rustSkill.includes("technology.selection=rust-axum-default") && rustSkill.includes("Router::with_state"));
  assert.equal(rustSkill.includes("Rust 1.75+"), false);
  assertions += 2;

  const installDestination = path.join(tempRoot, "global-install", "spec-driven-engineering");
  const syncScript = path.join(scriptDirectory, "sync-install.mjs");
  const drySync = run("node", [syncScript, "--source", path.resolve(workflowRoot, "skills/spec-driven-engineering"), "--destination", installDestination]);
  assert.ok(drySync.stdout.includes("Dry-run"));
  assertions += 1;
  run("node", [syncScript, "--source", path.resolve(workflowRoot, "skills/spec-driven-engineering"), "--destination", installDestination, "--install"]);
  run("node", [syncScript, "--source", path.resolve(workflowRoot, "skills/spec-driven-engineering"), "--destination", installDestination, "--check"]);

  console.log(`Spec-Driven Engineering integration suite: passed (${assertions} assertions)`);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
