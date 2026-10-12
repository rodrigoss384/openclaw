import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const hash = value => createHash("sha256").update(value).digest("hex");
const fail = message => { throw new Error(`Human guidance: ${message}`); };
const unresolved = value => /\{\{[^}]+\}\}|<\/?[A-Za-z_][^>\n]*>|\b(?:TODO|TBD)\b/.test(value);
function object(value, label, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  for (const key of Object.keys(value)) if (!keys.includes(key)) fail(`Unknown ${label} field: ${key}`);
}
function text(value, label) {
  if (typeof value !== "string" || !value.trim() || unresolved(value) || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) fail(`Missing or unresolved ${label}`);
  if (/[\r\n]/.test(value) || /```/.test(value)) fail(`${label} must be a single line without code fences`);
  return value;
}
function list(value, label, minimum = 1) {
  if (!Array.isArray(value) || value.length < minimum) fail(`${label} requires at least ${minimum} item(s)`);
  return value;
}
function localPath(root, ref, directory = false) {
  text(ref, "path");
  if (path.isAbsolute(ref)) fail("Paths in the request must be project-relative");
  const resolved = path.resolve(root, ref);
  const realRoot = fs.realpathSync(root);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) fail(`Path escapes project: ${ref}`);
  const real = fs.realpathSync(resolved);
  if (real !== realRoot && !real.startsWith(`${realRoot}${path.sep}`)) fail(`Symlink escapes project: ${ref}`);
  if (!(directory ? fs.statSync(real).isDirectory() : fs.statSync(real).isFile())) fail(`Wrong file type: ${ref}`);
  return real;
}
function evidence(root, entry, label) {
  object(entry, label, ["ref", "sha256"]);
  const file = localPath(root, entry.ref);
  const bytes = fs.readFileSync(file);
  if (!bytes.length || !/^[a-f0-9]{64}$/.test(entry.sha256 ?? "") || hash(bytes) !== entry.sha256) fail(`Missing, empty or changed ${label}: ${entry.ref}`);
  return bytes;
}
export function guidanceSnapshot(root) {
  const result = spawnSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) fail("Git snapshot unavailable");
  const refs = [...new Set(result.stdout.split("\0").filter(Boolean))].filter(ref => !ref.startsWith(".specs/")).sort();
  return hash(JSON.stringify(refs.map(ref => {
    const file = path.resolve(root, ref);
    // Git inventories directory symlinks as an entry, not as the referenced
    // tree. Internal runtime aliases must bind their target without reading a
    // directory as a file. Target files remain covered by their own Git paths.
    if (fs.existsSync(file) && fs.lstatSync(file).isSymbolicLink() && fs.statSync(file).isDirectory()) {
      localPath(root, ref, true); // Still rejects aliases outside this project.
      return [ref, hash(`directory-alias:${fs.readlinkSync(file)}`)];
    }
    return [ref, fs.existsSync(file) ? hash(fs.readFileSync(localPath(root, ref))) : "deleted"];
  })));
}
export const quoteArgument = arg => `'${arg.replaceAll("'", "'\\''")}'`;
export const commandLine = argv => argv.map(quoteArgument).join(" ");
function argumentsList(argv) {
  list(argv, "argv");
  for (const arg of argv) text(arg, "argument");
  if (/^(?:bash|sh|zsh|fish|cmd|powershell|pwsh)$/.test(path.basename(argv[0])) || argv.slice(1).some(arg => ["-c", "-e", "--eval", "--command", "-Command"].includes(arg))) fail("Shell/eval command fragments are unsupported; use a reviewed project script");
}
function executable(root, command) {
  const cwd = localPath(root, command.cwd, true);
  const program = command.argv[0];
  if (program.includes(path.sep)) {
    const ref = path.relative(root, path.resolve(cwd, program));
    fs.accessSync(localPath(root, ref), fs.constants.X_OK);
  } else {
    const found = (process.env.PATH ?? "").split(path.delimiter).some(dir => {
      try { const file = path.join(dir, program); fs.accessSync(file, fs.constants.X_OK); return fs.statSync(file).isFile(); } catch { return false; }
    });
    if (!found) fail(`Executable unavailable: ${program}; provide setup prerequisites, not an unverified copy/paste command`);
  }
  // A real interpreter does not make a nonexistent script a real command.
  if (/^(?:node|python(?:3(?:\.\d+)?)?)$/.test(path.basename(program))) {
    const target = command.argv[1];
    if (!target || target.startsWith("-")) fail("Interpreter commands must name an existing project script");
    localPath(root, path.relative(root, path.resolve(cwd, target)));
  }
  return cwd;
}
function commandEvidence(root, command, snapshot) {
  object(command, "command", ["id", "argv", "cwd", "purpose", "actor", "risk", "environment", "effects", "expected", "cleanup", "source", "verification", "recovery", "terminal", "readySignal", "url"]);
  for (const key of ["id", "cwd", "purpose", "actor", "risk", "environment", "effects", "expected", "cleanup"]) text(command[key], `command.${key}`);
  if (!["local", "consequential"].includes(command.risk)) fail("Unknown command risk");
  if (!["user-executes", "agent-after-approval"].includes(command.actor)) fail("Unknown command actor");
  argumentsList(command.argv);
  executable(root, command);
  object(command.source, "command source", ["ref", "sha256", "line"]);
  const source = evidence(root, { ref: command.source.ref, sha256: command.source.sha256 }, "command source").toString("utf8");
  text(command.source.line, "command source line");
  // Exact full argv must be retained in the reviewed source, not a bag of matching words.
  if (command.source.line !== commandLine(command.argv) || !source.split(/\r?\n/).includes(command.source.line)) fail("Source does not contain the exact quoted command line");
  object(command.verification, "verification", ["status", "record", "reason", "preflight"]);
  if (command.verification.status === "executed") {
    if (Object.hasOwn(command.verification, "reason") || Object.hasOwn(command.verification, "preflight")) fail("Executed verification cannot contain not-run fields");
    if (command.risk !== "local") fail("Consequential actions require preflight and explicit authorization, not an executed claim");
    const record = JSON.parse(evidence(root, command.verification.record, "execution record"));
    object(record, "execution record", ["argv", "cwd", "snapshot", "exitCode", "startedAt", "finishedAt", "output"]);
    if (JSON.stringify(record.argv) !== JSON.stringify(command.argv) || record.cwd !== command.cwd || record.snapshot !== snapshot || record.exitCode !== 0) fail("Execution record is failed, stale or belongs to another command");
    const start = Date.parse(record.startedAt), end = Date.parse(record.finishedAt);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || end > Date.now() + 60000) fail("Invalid execution timestamps");
    evidence(root, record.output, "execution output");
  } else if (command.verification.status === "not-run") {
    if (Object.hasOwn(command.verification, "record")) fail("Not-run verification cannot contain an execution record");
    text(command.verification.reason, "not-run reason");
    for (const probe of list(command.verification.preflight, "preflight evidence")) evidence(root, probe, "preflight");
  } else fail("Command must declare executed or not-run verification");
  if (command.risk === "consequential") text(command.recovery, "backup/rollback/forward-recovery");
  if (command.terminal !== undefined) {
    if (![1, 2].includes(command.terminal)) fail("Terminal must be 1 or 2");
    text(command.readySignal, "ready signal");
    text(command.url, "runtime URL or operation");
  }
}

export function validateHumanGuidance(root, guidance, { feature, sessionId } = {}) {
  root = fs.realpathSync(root);
  object(guidance, "request", ["schemaVersion", "sessionId", "feature", "questionId", "gate", "task", "snapshot", "decision", "whyHuman", "owner", "recommendation", "alternatives", "scope", "prerequisites", "commands", "commandsNotApplicable", "checklist", "expectedEvidence", "afterApproval", "afterRejection", "references"]);
  if (guidance.schemaVersion !== "1.0.0") fail("Unsupported schemaVersion");
  for (const key of ["sessionId", "feature", "questionId", "gate", "task", "decision", "whyHuman", "owner", "recommendation", "scope", "expectedEvidence", "afterApproval", "afterRejection"]) text(guidance[key], key);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(guidance.feature)) fail("Invalid feature slug");
  if (guidance.feature !== feature || guidance.sessionId !== sessionId) fail("Feature/session differs from handoff");
  const snapshot = guidanceSnapshot(root);
  if (guidance.snapshot !== snapshot) fail("Source snapshot changed; refresh the guidance");
  const refs = list(guidance.references, "decision references").map(ref => evidence(root, ref, "decision reference").toString("utf8"));
  for (const key of ["questionId", "gate", "task"]) {
    const id = guidance[key];
    if (!/^[A-Za-z][A-Za-z0-9-]*$/.test(id) || !refs.some(source => source.split(/[^A-Za-z0-9-]+/).includes(id))) fail(`${key} is not present in decision references`);
  }
  for (const value of list(guidance.alternatives, "alternatives", 2)) text(value, "alternative and consequence");
  for (const value of list(guidance.checklist, "observable checklist")) text(value, "checklist item");
  for (const item of list(guidance.prerequisites, "prerequisites")) {
    object(item, "prerequisite", ["description", "status", "evidence"]);
    text(item.description, "prerequisite description");
    if (!["passed", "not-run"].includes(item.status)) fail("Invalid prerequisite status");
    evidence(root, item.evidence, "prerequisite probe");
  }
  list(guidance.commands, "commands", 0);
  if (!guidance.commands.length) text(guidance.commandsNotApplicable, "reason no command is needed/proven");
  const ids = new Set();
  for (const command of guidance.commands) {
    commandEvidence(root, command, snapshot);
    if (ids.has(command.id)) fail("Duplicate command ID");
    ids.add(command.id);
  }
  return guidance;
}

export function renderHumanGuidance(root, g) {
  const lines = ["## Como validar e aprovar", "", `**Decisão:** ${g.decision}`, `**Por que você precisa decidir:** ${g.whyHuman}`, `**Responsável:** ${g.owner}`, `**Referência:** ${g.questionId} / ${g.gate} / ${g.task}`, `**Escopo da autorização:** ${g.scope}`, "", `**Recomendação:** ${g.recommendation}`, "", "**Alternativas e consequências:**", "", ...g.alternatives.map(s => `- ${s}`), "", "**Pré-requisitos verificados:**", "", ...g.prerequisites.map(p => `- ${p.description} — ${p.status}; evidência: ${p.evidence.ref}`), ""];
  if (!g.commands.length) lines.push(`**Comandos:** ${g.commandsNotApplicable}`, "");
  g.commands.forEach((c, i) => {
    lines.push(`**Passo ${i + 1}${c.terminal ? ` — Terminal ${c.terminal}` : ""}: ${c.purpose}**`, `Executor: ${c.actor === "user-executes" ? "você" : "agente, somente após autorização"}. Ambiente: ${c.environment}. Efeitos: ${c.effects}`, `Verificação: ${c.verification.status === "executed" ? "execução registrada com exit 0" : `não executado — ${c.verification.reason}`}.`, "", "```bash", `cd -- ${quoteArgument(fs.realpathSync(path.resolve(root, c.cwd)))}`, commandLine(c.argv), "```", "", `Resultado esperado: ${c.expected}`, `Encerrar/limpar: ${c.cleanup}`);
    if (c.recovery) lines.push(`Recuperação: ${c.recovery}`);
    if (c.terminal) lines.push(`Prontidão: ${c.readySignal}. URL/operação: ${c.url}`);
    lines.push(`Fonte: ${c.source.ref}`, "");
  });
  lines.push("**O que conferir:**", "", ...g.checklist.map(s => `- ${s}`), "", `**Evidência a devolver:** ${g.expectedEvidence}`, "", "**Resposta para aprovar:**", "", `Aprovo ${g.questionId} / ${g.gate} / ${g.task}, somente no escopo: ${g.scope}`, "", "**Resposta para rejeitar:**", "", `Rejeito ${g.questionId} / ${g.gate} / ${g.task}. Informe o motivo na resposta.`, "", `**Após aprovação:** ${g.afterApproval}`, `**Após rejeição:** ${g.afterRejection}`, "", "Executar um comando não significa aprovar. As verificações confirmam estrutura e vínculos locais; a declaração de risco e a custódia da evidência pertencem ao executor.", "");
  return lines.join("\n");
}

export function prepareHandoffGuidance({ root, content, sessionId, load = ref => fs.readFileSync(localPath(root, ref), "utf8") }) {
  const matches = [...content.matchAll(/^## Ação humana pendente\s*\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)];
  if (matches.length !== 1) fail("Handoff requires exactly one Ação humana pendente section");
  const body = matches[0][1].trim();
  const clean = content.replaceAll("{{REVISION}}", "0").replaceAll("{{SESSION_ID}}", sessionId).replaceAll("{{AGENT}}", "agent").replaceAll("{{TIMESTAMP}}", new Date().toISOString());
  if (/\{\{[^}]+\}\}/.test(clean)) fail("Unresolved handoff placeholder");
  if (body === "Nenhuma.") {
    if (/^\*\*Status:\*\*.*awaiting-review/im.test(content)) fail("awaiting-review requires human guidance");
    return { content, markdown: null };
  }
  const pointer = body.match(/^<!-- human-guidance: ([^\n]+\.json) -->$/);
  if (!pointer) fail("Use Nenhuma. or a single human-guidance JSON pointer, never unchecked prose");
  const feature = content.match(/^\*\*Feature:\*\*\s*`?([a-z0-9][a-z0-9-]*)`?\s*$/m)?.[1];
  const g = validateHumanGuidance(root, JSON.parse(load(pointer[1])), { feature, sessionId });
  const markdown = renderHumanGuidance(root, g);
  const section = markdown.replace("## Como validar e aprovar", "## Ação humana pendente");
  return { content: content.replace(matches[0][0], `${section}\n`), markdown };
}
