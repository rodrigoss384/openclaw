# Handoff

Leave `{{SESSION_ID}}`, `{{REVISION}}`, `{{AGENT}}` and `{{TIMESTAMP}}` below
exactly as written — do not resolve them narratively. They are filled
atomically by `scripts/update-handoff.mjs` under its file lock, not by the
agent, so the real on-disk revision is always computed from the actual
current file, never guessed. See `references/session-closure.md`.

**Workflow:** `spec-driven-engineering@<VERSION>`  
**sessionId:** `{{SESSION_ID}}`  
**revision:** `{{REVISION}}` (assigned atomically by `update-handoff.mjs`; see `references/session-closure.md` Concurrency check)  
**agent:** `{{AGENT}}`  
**Timestamp:** `{{TIMESTAMP}}`  
**Projeto/root:**  
**Feature:**  
**Estágio/gate/task:**  
**Status:**
**Backend representative:** `not-applicable | ready-for-backend-slice | backend-broad-build-approved | blocked`  
**Frontend representative:** `not-applicable | ready-for-small-slice | broad-build-approved | blocked`

## Ponto exato

## Concluído

## Em andamento

## Arquivos alterados / estado não commitado

## Última verificação

- Comando:
- Resultado: `passed | failed | partial | not-run`
- Evidência:

## Pendências imediatas

## Perguntas em aberto

## Ideias adiadas

## Bloqueios

## Ação humana pendente

Use exactly `Nenhuma.` when no human action is pending. Otherwise replace this instruction with a single `<!-- human-guidance: relative/path.json -->` pointer to the validated request; the writer renders the complete section. Do not submit unchecked prose here. See `references/human-approval-runbook.md` for the request format and published final-response artifact.

## Contexto mínimo para retomar

## Primeira ação de retomada
