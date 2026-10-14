#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { guidanceSnapshot, commandLine, validateHumanGuidance, renderHumanGuidance } from "./lib/human-guidance.mjs";

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "human guidance "));
const root = path.join(temp, "consumer 'with spaces'");
fs.mkdirSync(root);
const scriptRoot = import.meta.dirname;
let assertions = 0;
const write = (ref, data) => { const file = path.join(root, ref); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data); return file; };
const json = (ref, data) => write(ref, JSON.stringify(data, null, 2) + "\n");
const ref = file => ({ ref: file, sha256: createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex") });
const call = (script, args) => spawnSync(process.execPath, [path.join(scriptRoot, script), ...args], { cwd: root, encoding: "utf8" });
const valid = request => validateHumanGuidance(root, request, { feature: "guidance", sessionId: "test-session" });
function rejects(mutator, pattern) {
  const request = structuredClone(base); mutator(request);
  assert.throws(() => valid(request), pattern); assertions++;
}
function handoff(body, revision = "none", sessionId = "test-session") {
  write(".specs/draft.md", `# Handoff\n**sessionId:** \x60{{SESSION_ID}}\x60\n**revision:** \x60{{REVISION}}\x60\n**agent:** \x60{{AGENT}}\x60\n**Timestamp:** \x60{{TIMESTAMP}}\x60\n**Feature:** \x60guidance\x60\n**Status:** awaiting-review\n${body}\n\n## Próximo passo\nAguardar a decisão escopada.\n`);
  json(".specs/sidecar.json", { sessionId: "{{SESSION_ID}}", baseRevision: "{{BASE_REVISION}}", conflictingRevision: "{{CONFLICTING_REVISION}}" });
  return call("update-handoff.mjs", ["--root", root, "--session-id", sessionId, "--agent", "test", "--base-revision", revision, "--handoff-file", ".specs/draft.md", "--sidecar-file", ".specs/sidecar.json"]);
}
let base;
try {
  assert.equal(spawnSync("git", ["init", "-q"], { cwd: root }).status, 0);
  write("verify sample.mjs", "console.log('fixture validation passed');\n");
  write("mutate.mjs", "import fs from 'node:fs'; fs.writeFileSync('MUTATION-MUST-NOT-EXIST', 'executed');\n");
  const argv = ["node", "verify sample.mjs", "literal $(touch PWNED)", "quote's value"];
  const mutation = ["node", "mutate.mjs"];
  write("commands.md", `# Reviewed local fixture commands\n${commandLine(argv)}\n${commandLine(mutation)}\n`);
  write(".specs/decision.md", "Q-GUIDE-001 GATE-GUIDE-001 T-GUIDE-001\nPermitir apenas a revisão da slice local, sem release.\n");
  write(".specs/probe.log", "Observed: local disposable test directory exists; external write not authorized.\n");
  const snapshot = guidanceSnapshot(root);
  const startedAt = new Date().toISOString();
  const execution = spawnSync(argv[0], argv.slice(1), { cwd: root, encoding: "utf8" });
  assert.equal(execution.status, 0); assertions++;
  write(".specs/result.log", execution.stdout);
  json(".specs/execution.json", { argv, cwd: ".", snapshot, exitCode: execution.status, startedAt, finishedAt: new Date().toISOString(), output: ref(".specs/result.log") });
  base = { schemaVersion: "1.0.0", sessionId: "test-session", feature: "guidance", questionId: "Q-GUIDE-001", gate: "GATE-GUIDE-001", task: "T-GUIDE-001", snapshot,
    decision: "Liberar a revisão da slice local?", whyHuman: "A pessoa deve confirmar o comportamento observado contra sua necessidade.", owner: "Responsável pela feature", recommendation: "Aprovar a slice após conferir os resultados e o erro esperado.",
    alternatives: ["Aprovar: permite continuar somente a slice descrita.", "Rejeitar: retorna a implementação com os desvios encontrados."], scope: "slice demonstrativa local; nenhuma entrega externa",
    prerequisites: [{ description: "Ambiente descartável disponível", status: "passed", evidence: ref(".specs/probe.log") }],
    commands: [{ id: "CMD-001", argv, cwd: ".", purpose: "Reproduzir a verificação local", actor: "user-executes", risk: "local", environment: "fixture local descartável", effects: "Imprime o resultado; não altera o produto", expected: "fixture validation passed e exit 0", cleanup: "Processo termina sozinho", source: { ...ref("commands.md"), line: commandLine(argv) }, verification: { status: "executed", record: ref(".specs/execution.json") } }],
    checklist: ["Conferir resultado e escopo local antes de decidir."], expectedEvidence: "Informar resultado observado e decisão com IDs.", afterApproval: "Agente continua a slice aprovada.", afterRejection: "Agente registra os desvios e corrige somente a slice.", references: [ref(".specs/decision.md")] };
  valid(base); assertions++;
  const rendered = renderHumanGuidance(root, base);
  for (const expected of ["Como validar e aprovar", "Recomendação", "Alternativas", "Pré-requisitos", "Resultado esperado", "Encerrar/limpar", "Resposta para aprovar", "Resposta para rejeitar", "Após aprovação", "Após rejeição"]) { assert.ok(rendered.includes(expected)); assertions++; }
  // Copy/paste exactly what the renderer generated, including spaces, quotes and $().
  const command = rendered.match(/```bash\n([\s\S]*?)```/)[1];
  assert.equal(spawnSync("bash", ["-c", command], { cwd: root, encoding: "utf8" }).status, 0);
  assert.equal(fs.existsSync(path.join(root, "PWNED")), false); assertions += 2;
  for (const field of ["decision", "whyHuman", "owner", "recommendation", "scope", "expectedEvidence", "afterApproval", "afterRejection", "snapshot", "references", "prerequisites", "checklist", "alternatives"]) rejects(g => { delete g[field]; }, /Human guidance/);
  rejects(g => g.decision = "{{DECISION}}", /unresolved/);
  rejects(g => g.commands[0].argv[1] = "<script>", /unresolved/);
  rejects(g => g.commands[0].argv[1] = "does-not-exist.mjs", /ENOENT/);
  rejects(g => g.commands[0].argv.push("--report-only"), /exact quoted command/);
  rejects(g => g.commands[0].argv = ["bash", "-c", "echo no"], /Shell\/eval/);
  rejects(g => g.commands[0].cwd = "..", /escapes/);
  rejects(g => g.commands[0].source.sha256 = "0".repeat(64), /changed command source/);
  rejects(g => g.commands[0].verification.record.sha256 = "0".repeat(64), /changed execution record/);
  rejects(g => g.commands[0].verification.status = "passed", /executed or not-run/);
  rejects(g => g.commands[0].verification.reason = "Not run", /cannot contain not-run/);
  rejects(g => g.commands[0].verification.preflight = [ref(".specs/probe.log")], /cannot contain not-run/);
  rejects(g => Object.assign(g.commands[0].verification, { status: "not-run", reason: "Needs approval", preflight: [ref(".specs/probe.log")] }), /cannot contain an execution record/);
  rejects(g => g.commands[0].risk = "consequential", /Consequential/);
  rejects(g => g.commands[0].terminal = 1, /ready signal/);
  rejects(g => g.commands.push(g.commands[0]), /Duplicate/);
  rejects(g => g.feature = "other-feature", /differs/);
  rejects(g => g.sessionId = "other-session", /differs/);
  rejects(g => g.task = "T-FABRICATED", /not present/);
  rejects(g => g.snapshot = "0".repeat(64), /snapshot changed/);
  const recordBytes = fs.readFileSync(path.join(root, ".specs/execution.json"));
  for (const patch of [{ exitCode: 1 }, { argv: ["node", "other.mjs"] }, { snapshot: "0".repeat(64) }, { output: { ref: ".specs/result.log", sha256: "0".repeat(64) } }]) {
    json(".specs/execution.json", { ...JSON.parse(recordBytes), ...patch });
    rejects(g => g.commands[0].verification.record = ref(".specs/execution.json"), /failed, stale|changed execution output/);
  }
  fs.writeFileSync(path.join(root, ".specs/execution.json"), recordBytes);
  write(".specs/result.log", "");
  rejects(() => {}, /empty or changed execution output/);
  write(".specs/result.log", execution.stdout);
  write("changed.mjs", "// source changed after check\n");
  rejects(() => {}, /snapshot changed/); fs.unlinkSync(path.join(root, "changed.mjs"));
  fs.symlinkSync(temp, path.join(root, ".specs/outside"));
  rejects(g => g.commands[0].cwd = ".specs/outside", /Symlink escapes/);
  fs.unlinkSync(path.join(root, ".specs/outside"));
  const decisionOnly = structuredClone(base); decisionOnly.commands = []; decisionOnly.commandsNotApplicable = "Apenas decidir sobre o contrato já apresentado; nenhum comando necessário.";
  valid(decisionOnly); assertions++;
  rejects(g => g.commands = [], /reason no command/);
  const consequential = structuredClone(base);
  consequential.commands[0] = { ...consequential.commands[0], argv: mutation, actor: "agent-after-approval", risk: "consequential", source: { ...ref("commands.md"), line: commandLine(mutation) }, verification: { status: "not-run", reason: "Escrita requer autorização explícita", preflight: [ref(".specs/probe.log")] }, recovery: "Fixture descartável; restaurar o arquivo a partir do snapshot anterior." };
  valid(consequential); assert.equal(fs.existsSync(path.join(root, "MUTATION-MUST-NOT-EXIST")), false); assertions += 2;
  const persisted = path.join(root, ".specs/HANDOFF.md");
  for (const bad of ["", "## Ação humana pendente\nRode o projeto e aprove se estiver bom.", "## Ação humana pendente\nNenhuma.", "## Ação humana pendente\nnode {{PROJECT_ROOT}}/missing.mjs"]) {
    const result = handoff(bad); assert.notEqual(result.status, 0); assert.equal(fs.existsSync(persisted), false); assertions += 2;
  }
  json(".specs/guidance.json", base);
  const marker = "## Ação humana pendente\n<!-- human-guidance: .specs/guidance.json -->";
  const published = handoff(marker); assert.equal(published.status, 0, published.stderr); assertions++;
  const publishedPath = published.stdout.match(/Validated human guidance for the final response: (.+)/)[1];
  assert.equal(fs.readFileSync(publishedPath, "utf8"), rendered); assertions++;
  assert.ok(fs.readFileSync(persisted, "utf8").includes("Resposta para rejeitar")); assertions++;
  const original = fs.readFileSync(persisted);
  base.decision = "{{FORGED}}"; json(".specs/guidance.json", base);
  assert.notEqual(handoff(marker, "1").status, 0); assert.deepEqual(fs.readFileSync(persisted), original); assertions += 2;
  base.decision = "Liberar a revisão da slice local?"; json(".specs/guidance.json", base);
  const cliArgs = ["--root", root, "--feature", "guidance", "--session-id", "test-session", "--request", ".specs/guidance.json", "--final-file", publishedPath];
  assert.equal(call("validate-human-guidance.mjs", cliArgs).status, 0); assertions++;
  fs.appendFileSync(publishedPath, "Rode também um comando inventado.\n");
  assert.notEqual(call("validate-human-guidance.mjs", cliArgs).status, 0); assertions++;
  assert.equal(fs.existsSync(path.join(root, "MUTATION-MUST-NOT-EXIST")), false); assertions++;
  console.log(`Human guidance validation passed (${assertions} assertions; real command/writer/renderer, consequential command never executed).`);
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
