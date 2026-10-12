# Session Closure Gate

Run this gate before every final response, including read-only, blocked and fully completed sessions.

## Update order

1. Update the authoritative feature artifact when reality changed.
2. Update `STATE.md` only for durable project decisions, blockers, lessons or deferred ideas.
3. Run the concurrency check below before touching `.specs/HANDOFF.md`.
4. Overwrite `.specs/HANDOFF.md` with the current operational snapshot (or write the conflict sidecar instead — see below).
5. Mirror active questions, deferred ideas, blockers and next action in the final response.
6. When a human action or decision is pending, apply [human-approval-runbook.md](human-approval-runbook.md) and mirror the exact runbook in the handoff and final response.

## Concurrency check (multi-agent safety)

`.specs/HANDOFF.md` is unsafe to overwrite with a manual "re-read, compare,
write" protocol — that is three separate steps, and a second session can
interleave between any of them. Two sessions can both re-read revision 5,
both see "still 5", and both write revision 6; the conflict sidecar never
triggers because nothing actually serializes the check against the write.
This is why the write goes through **`scripts/update-handoff.mjs`**, not
through the agent directly editing `.specs/HANDOFF.md`: the script makes
re-read + compare + write one exclusive-locked critical section (an atomic
`open(path, "wx")` lock file, checked/renamed inside the lock, released in a
`finally`), so a second session can no longer pass its own stale check after
the first session has already committed.

At the **start** of a session, when reading `.specs/HANDOFF.md`, record its
current `revision` field (or `none` if absent) as this session's
`baseRevision`.

At **closure**:

1. Render the full handoff body from
   `skills/spec-driven-engineering/assets/HANDOFF.template.md`, resolving
   every narrative placeholder — except `{{SESSION_ID}}`, `{{REVISION}}`,
   `{{AGENT}}`, `{{TIMESTAMP}}`, which must stay literal; the script fills them.
   Before invoking the writer, the body must contain exactly one `## Ação humana pendente` section. Use precisely `Nenhuma.` for no pending human action, or a single `<!-- human-guidance: relative/path.json -->` pointer. The latter must point to the current structured request described in `human-approval-runbook.md`; the writer validates and renders it while holding the lock. Missing sections, unresolved placeholders, unchecked prose and invalid requests fail before replacing the handoff. This applies on the conflict path too.

2. Also render the sidecar body from
   `skills/spec-driven-engineering/assets/session-sidecar.template.json`
   (same rule: leave its `{{...}}` tokens literal), in case a conflict is found.
3. Run:
   ```bash
   node skills/spec-driven-engineering/scripts/update-handoff.mjs \
     --root <PROJECT_ROOT> --session-id <SESSION_ID> --agent <AGENT> \
     --base-revision <BASE_REVISION> \
     --handoff-file <path to the rendered handoff body> \
     --sidecar-file <path to the rendered sidecar body>
   ```
4. Exit `0` means the script wrote `.specs/HANDOFF.md` atomically with the
   real next revision. If guidance is pending, stdout also names `.specs/sessions/<sessionId>-guidance-<sha256>.md`: read it and use that exact content for the human-guidance portion of the response. Do not rewrite commands or substitute a remembered runbook. Other factual response sections may accompany it. The checker can compare the guidance block file with `--final-file`; it cannot intercept arbitrary text sent directly through an editor/chat interface.
5. Exit `2` means a concurrent writer committed a newer revision inside the
   lock; the script left `.specs/HANDOFF.md` untouched and wrote
   `.specs/sessions/<sessionId>.json` instead. State the conflict explicitly
   in the final response's `Bloqueios` section, naming both `sessionId`s and
   both `revision`s. Do not merge automatically — merging two independent
   closures' "ponto exato" narratively is exactly the kind of silent,
   undetectable data loss this check exists to prevent. A human (or the next
   session that deliberately reconciles both) resolves the conflict by
   reading both the handoff and the sidecar, then writing one merged
   `.specs/HANDOFF.md` through the same script with a fresh `baseRevision`.
6. Any other exit code (lock timeout, missing argument) is an operational
   failure, not a conflict — report it as a blocker; never fall back to
   editing `.specs/HANDOFF.md` directly to route around the script.

`sessionId` is any value stable for the lifetime of one agent session
(a UUID, a timestamp+agent-name composite). `revision` is a monotonically
increasing integer, assigned by the script from the real on-disk value at
write time — never guessed or incremented by the agent itself.

## Required handoff fields

```text
workflow version
sessionId
revision (monotonically increasing integer; incremented on every overwrite)
agent (which CLI/tool executed this session, e.g. claude-code, codex-cli, gemini-cli, opencode)
timestamp
project and project root
feature, stage, gate and task
status and exact stopping point
completed and in-progress work
files changed and uncommitted state
last verification command and result
pending steps
blockers
open questions by ID and whether they block
deferred ideas by ID
minimum files to load next
first resume action
human-action runbook when blocked or awaiting review on a person
```

Use file, symbol and line pointers when they materially reduce rediscovery. Never paste large code blocks into the handoff.

## STATE versus HANDOFF

`STATE.md` is durable historical memory. `HANDOFF.md` is replaceable operational state. Numbered feature artifacts own feature truth. The handoff points to those sources and never becomes a competing specification.

## Final response contract

Always include:

```markdown
## Perguntas em aberto

- Nenhuma.

## Ideias adiadas

- Nenhuma.

## Bloqueios

- Nenhum.

## Próximo passo

[One concrete action or "Nenhum; etapa concluída."]
```

Never omit an empty section. Never hide a nonblocking question only because work can continue.

When human action is pending, also include:

```markdown
## Como validar e aprovar

[Real cwd, prerequisites, copy/paste commands, observable checklist, expected evidence, cleanup, and scoped approve/reject responses.]
```

Omit this additional section only when no human command, inspection or decision is pending. Never infer approval from command execution.
