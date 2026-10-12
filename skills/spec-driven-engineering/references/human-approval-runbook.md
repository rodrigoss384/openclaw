# Human Approval Runbook

Use this contract whenever progress is `blocked` or `awaiting-review` because a person must run or authorize a command, inspect behavior, approve a representative gate, accept risk, or decide on a consequential backend change.

## First principle

Complete every safe, authorized, automatable check before asking the user to act. Do not offload tests to the user merely because a human approval will be needed afterward. Human execution is reserved for unavailable environments, manual inspection, privileged or consequential commands, and the decision itself.

Execution and approval are separate facts. A successful command never implies approval. Record the command result as evidence and wait for an explicit scoped decision.

## Evidence-based commands

Derive commands from the actual repository package manager, scripts, manifests, task runner, CI, approved docs, container configuration, or previously successful evidence. Never invent `npm`, Storybook, Docker, migration, seed, test, URL, port, endpoint, credentials, or environment-variable names.

If no executable command can be proven, record the probes attempted and `not-run`. Ask for the missing fact instead of emitting a guessed command. Never persist unresolved placeholders in a command.

## Required output

Add `## Como validar e aprovar` to the final response and `## Ação humana pendente` to `.specs/HANDOFF.md`. Include:

1. approval/question ID, gate and task;
2. what decision is required and why only a person can make it;
3. who must act: agent, user, or named authority;
4. exact working directory;
5. prerequisites already probed, including services and safe environment requirements, without secrets;
6. copy/paste commands in execution order, each tied to repository evidence;
7. side effects and safety classification for each consequential command;
8. for a long-running process, separate `Terminal 1` and `Terminal 2`, state the expected ready signal, URL/route/story/operation, and how to stop or clean up;
9. a short observable checklist, including relevant positive, negative, responsive, accessibility, security, data, recovery, contract, or migration outcomes;
10. the expected result and evidence the user should return;
11. one scoped approval response and one scoped rejection response containing the real gate/task ID.

Do not use vague instructions such as “run the project”, “validate visually”, “test the endpoint”, “approve if fine”, or examples containing `<placeholder>`/`{{PLACEHOLDER}}` in the final runbook.

## Frontend review

Use the repository's real application or Storybook command. State the exact URL and route/story, fixture or account assumptions, viewports, states, keyboard path, expected responsive transformation, and visual-reference aspects to compare. Storybook can supplement review but cannot replace the real route when the representative gate requires it.

The approval response must scope the decision to the representative screen/slice and gate. It must not imply approval of unimplemented screens or broad build output.

## Backend review

Run automated contract, integration, persistence, security and reliability checks before handoff when safe and authorized. For manual reproduction, provide the actual startup/test/audit/request commands and expected status/body/event/log outcome. Do not expose secrets; reference approved environment setup instead.

For migration, destructive, production, external-write, cost-bearing or privileged commands, state effects, target environment, backup/rollback or forward-recovery evidence, and whether the user is authorizing the agent or executing the command personally. Never present a production mutation as a routine validation command.

The approval response must identify the contract, migration, security boundary, operational risk or representative slice being approved, including accepted risk when applicable.

## Handoff integrity

Keep the runbook synchronized with the current code and task. If commands, ports, routes, hashes, evidence paths or blockers change, overwrite the stale instructions. The first resume action after approval or rejection must be explicit.

## Executable validation and publication

The agent prepares a JSON request under `.specs/features/<feature>/human-guidance.json`. The user still fills only `PROJECT_ROOT` and `FEATURE_SLUG` in prompts. This is internal preparation, not an extra questionnaire. The contract is implemented in `scripts/lib/human-guidance.mjs` and exercised by `scripts/test-human-guidance.mjs`.

Every request requires:

- `schemaVersion: "1.0.0"`, `sessionId`, `feature`, `questionId`, `gate`, `task`, and `snapshot` of the current source;
- `decision`, `whyHuman`, `owner`, `recommendation`, `scope`, `expectedEvidence`, `afterApproval`, `afterRejection`: concrete single-line text, no placeholders or code fences;
- `alternatives`: at least two descriptions stating consequences; `checklist`: observable items;
- `references`: nonempty array of `{ref, sha256}` identifying current decision/contract/task files that contain the exact question/gate/task IDs;
- `prerequisites`: nonempty array of `{description, status: "passed"|"not-run", evidence: {ref, sha256}}`. Retain the real probe, including an honest failure or limitation when relevant;
- `commands`: an ordered array, possibly empty. If empty, `commandsNotApplicable` must explain why no command is needed or can currently be proven. A product decision must not invent commands just to fill a form.

Each command requires `id`, `argv` (individual strings, no shell/eval fragments), `cwd` (project-relative existing directory, `.` allowed), `purpose`, `actor` (`user-executes` or `agent-after-approval`), `risk` (`local` or `consequential`), `environment`, `effects`, `expected`, `cleanup`, `source`, `verification`. Consequential commands also require concrete `recovery`. For a persistent process, add `terminal` (1 or 2), `readySignal` and `url` (exact URL/operation). Describe manual stopping actions in `cleanup`; if cleanup needs another executable command, model it as a separate command with its own evidence, not unverified prose.

`source` contains `{ref, sha256, line}`. `line` must be the complete POSIX-quoted command present as a whole line in the referenced project source/runbook. Generate it with the exported `commandLine(argv)` helper: every argument is single-quoted, embedded apostrophes escaped. The executable must be discoverable and Node/Python commands must name an existing project script. Reviewed project wrappers are required for compound shell logic. Unsupported or unavailable commands should become a setup question with no copy/paste command, not a guessed invocation. Write the source line only after deriving the command from the actual scripts/configuration/docs and record that provenance in the source. A line copied into a document is not independent proof of correctness.

`verification` has exactly one of these meanings:

- `status: "executed"`, `record: {ref, sha256}` for a local command actually run safely and with authorization. The JSON record contains the exact `argv`, `cwd`, `snapshot`, `exitCode: 0`, ISO `startedAt`/`finishedAt`, and `output: {ref, sha256}` pointing to the nonempty retained output. Preserve the real execution output; do not manufacture a success record. A quiet command should have its executor retain a real structured process result, including exit status, instead of inventing stdout.
- `status: "not-run"`, `reason`, `preflight: [{ref, sha256}]` for a command that must still be performed by the authorized actor. The rendered instructions visibly state that it was not run. This is required for consequential commands and is appropriate for inaccessible environments. Preflight is evidence of prerequisites, not approval or successful execution of the command itself.

The source fingerprint is computed with:

```bash
node skills/spec-driven-engineering/scripts/validate-human-guidance.mjs --root <project-root> --mode snapshot
```

This hashes tracked/untracked nonignored source, excluding `.specs/`. Evidence and scripts are additionally bound by their individual file hashes. Prepare metadata under `.specs/`; finish any source changes before computing the fingerprint. A changed source/evidence/command requires refreshing the actual checks and request, not just changing a digest to preserve a stale success claim.

Validate/render before publication:

```bash
node skills/spec-driven-engineering/scripts/validate-human-guidance.mjs --root <project-root> --feature <feature> --session-id <session> --request .specs/features/<feature>/human-guidance.json
```

These are documentation metavariables for the agent; resolve them before execution. stdout is the deterministic Markdown block. Optionally pass `--final-file <prepared-guidance-block.md>` to require an exact byte-for-byte match with the block intended for the user. The validator executes only the Git inventory read; it never runs recommended commands, startup, migrations, external writes or cleanup.

In the proposed handoff, include exactly one `## Ação humana pendente` section, containing only:

```text
<!-- human-guidance: .specs/features/my-feature/human-guidance.json -->
```

Use the actual relative path. `update-handoff.mjs` validates the request inside its lock, confirms feature/session, replaces the pointer with the generated section and publishes `.specs/sessions/<sessionId>-guidance-<sha256>.md`. It prints the real path. Read that file and reproduce the block in the final response; do not rewrite its commands. Failed validation preserves the existing handoff. Conflicts still produce the concurrency sidecar and never overwrite the current handoff; no guidance is published as a successful closure for the losing session.

When no human action is pending, that section must contain exactly `Nenhuma.`. Missing or free-text sections are rejected. `Status: awaiting-review` cannot coexist with `Nenhuma.`. Migrate old handoff callers to this explicit declaration; do not retrofit fabricated human approvals or evidence.

## Guarantee boundary

Validation checks completeness, identities, exact command/source bindings, available paths/executables, retained evidence integrity, current source fingerprint, shell quoting and equality of the published text. It does not prove semantic clarity, truthful risk classification, command behavior in a different environment or authenticity of files under the same user's control. Hashes are integrity checks, not execution provenance. The executor must protect its evidence and make honest execution/preflight declarations. The generated block explicitly preserves this distinction.

The writer cannot intercept an arbitrary chat reply or an agent that bypasses the canonical workflow. The response must use its published block; `--final-file` detects divergent prepared blocks. Do not describe this as a guarantee of error-free advice in every editor. It is a concrete check on the artifact used by the supported closure path, with honest `not-run` cases and human authorization preserved.
