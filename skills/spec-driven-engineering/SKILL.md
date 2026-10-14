---
name: spec-driven-engineering
description: Orchestrate AI-assisted software delivery through adaptive SDD, ATDD, BDD, executable acceptance contracts, property-based testing, TDD, adversarial validation, evidence review, backend and frontend representative gates, and mandatory session handoffs. Use when initializing or mapping a project, discovering or specifying a feature, planning tests or tasks, implementing or fixing code, validating a feature, migrating the legacy spec-driven workflow, resuming a session, or producing auditable delivery evidence.
metadata:
  version: '2.4.0'
---

# Spec-Driven Engineering

Treat specification, executable contracts, and evidence as the product of the workflow. Treat code as an implementation of those contracts.

## Canonical sequence

Use this feature lifecycle:

```text
00 INTENT
→ 01 SPEC
→ 02 ASSUMPTIONS
→ 03 ACCEPTANCE CRITERIA
→ 04 BEHAVIOR SCENARIOS
→ 05 EXECUTABLE ACCEPTANCE TESTS
→ 06 PROPERTIES
→ 07 DESIGN
→ 08 TEST PLAN
→ 09 TASKS
→ IMPLEMENT
→ 10 ADVERSARIAL REVIEW
→ 11 EVIDENCE
```

Do not implement before `03-acceptance-criteria.md`, `05-executable-acceptance-tests.md`, and `08-test-plan.md` are ready for the selected profile.

## Start every execution

1. Read and apply [context-bootstrap.md](references/context-bootstrap.md).
2. Find the correct project or Git root. Never assume the current directory or a literal unresolved placeholder is the target.
3. Read all applicable repository `AGENTS.md` files and resolve the canonical project rules path recorded in `PROJECT.md`; otherwise resolve `.agents/rules.md`, then root `rules.md`. Missing or conflicting rules block the stage. Path resolution is mandatory on every execution; full-content loading is governed by the canonical bootstrap policy, not by path resolution itself.
4. Read `prompts/spec-driven/manifest.json#contextBootstrap.governancePolicy`. Before any full-content rules read, execute `node integrations/governance/validate-governance-policy.mjs --root <PROJECT_ROOT>`; failure means the current `rules.md` revision is not admitted and blocks the stage. Before frozen `applicability.md` exists, or when the current prompt has no governance stage binding, read the admitted rules revision in full after that validation. When frozen applicability exists for a bound stage, execute `node integrations/governance/governance-control.mjs bootstrap ...` with the current root/stage/feature/applicability; this bootstrap performs the same admission validation before deriving policy. In `shadow`, retain the admitted full rules read for comparison without granting operational authority to rationale-only or unadmitted additions. In `primary`, registered governance comes from the derived effective policy while the resolved rules path remains available only for rationale and governance legacy captured by the admitted baseline; additions after that baseline are non-operative unless explicitly admitted through the registry-first boundary. Bootstrap failure or material mismatch blocks the stage. Existing human gates remain unchanged.
5. Read `.specs/HANDOFF.md`, `.specs/project/STATE.md`, and only the current feature artifacts needed by the stage.
6. Resolve missing placeholders through the evidence matrix in `context-bootstrap.md`. Record provenance; never persist raw `{{NAME}}` values.
7. Classify complexity and criticality using [risk-complexity-matrix.md](references/risk-complexity-matrix.md).
8. Select complementary skills using [skill-routing.md](references/skill-routing.md). Resolve skills by name; do not hardcode installation roots.
9. Declare the current stage, allowed outputs, forbidden outputs, and release gate before writing.

## Executable lifecycle

Use the installed `integrations/governance/workflow-entry.mjs` entrypoint and the commands published in prompts 00, 01 and 02: initialize the project runtime/delivery provider, begin the feature before intent, freeze the recorded base plus applicability/inventories, then prepare per-stage inputs. Do not choose a new HEAD when resuming a feature. New projects need an explicitly authorized initial Git commit before beginning; no implicit Git mutation.

Prompts 05/07/07.1/07.2/08 close through `advance`; 09 uses `select-delivery` and `delivery`. Only the executor writes transition state. Delivery reruns every applicable stage and requires trusted host baseline/context and any applicable human authority. Read `integrations/governance/DELIVERY.md` for inputs, runtime preparation and consumer check installation. Diagnostic bootstrap/resolve/inputs/dry-run never authorizes a transition. A locally installed workflow does not prove remote branch protection.

## Runtime autonomy

Use `prompts/spec-driven/autonomy-policy.json` only when a bounded choice actually requires selection or authority resolution. Do not route every implementation detail through autonomy machinery, and never use autonomy to weaken a canonical contract, an effective-policy escalation, or an existing human gate.

1. Classify the choice into one canonical autonomy decision class. If the choice may be consequential and its authority cannot be established safely, use `unknown-consequential`; never force an uncertain consequential choice into an autonomous class.
2. Build an `autonomy-decision-request` against the current derived effective policy, carrying the real `humanGateRequired` state, bounded candidates, contract/evidence references, reversibility and objective comparison inputs. The request, result and consumption directive are runtime control artifacts; they do not replace requirements, design, tests, product contracts or human approvals.
3. Run `node integrations/governance/governance-control.mjs decide --root <PROJECT_ROOT> --request <request.json>` to obtain the deterministic disposition and, only when autonomous, a selected option.
4. Run `node integrations/governance/governance-control.mjs consume --root <PROJECT_ROOT> --decision <result.json>` before acting on that result. Treat provenance mismatch, stale policy, invalid selected option or governance mismatch as blocking rather than reconstructing intent from prose. When evidence must be retained, write the directive to a repository-relative runtime artifact so its exact SHA-256 can be recorded.
5. If the consumption directive has `recordDecision=true`, run `node integrations/governance/autonomy-evidence.mjs record --root <PROJECT_ROOT> --directive <directive.json>` before continuing. This appends one immutable/idempotent `durability=durable` entry to `.specs/features/<feature-slug>/autonomous-decisions.json`, the derived machine-readable ledger subordinate to `11-evidence.md`. Repeating the same `decisionId` must not duplicate it; conflicting content for the same ID blocks as decision-history drift.
6. If `recordDecision=false`, keep the evidence ephemeral. `SAFE_AUTONOMOUS` microdecisions must not be persisted in `autonomous-decisions.json` and must not receive an ADR merely to make them visible.
7. For `SAFE_AUTONOMOUS`, execute the selected bounded option without asking for a preference (`não peça preferência`). For `AUTONOMOUS_WITH_AUDIT`, require the durable record from step 5 and then execute the selected option.
8. For `HUMAN_REQUIRED`, record the controller outcome when required, do not select or execute an option, ask only for the specific decision or authorization represented by the directive, and stop until the human response resolves it. The ledger records the escalation; it does not imply human approval.
9. For `BLOCKED`, record the controller outcome when required, report the precise blocker reason codes and do not execute. Ask a human only when the consumption directive sets `askHuman=true` because the blocker is explicitly human-resolvable; otherwise gather missing evidence, repair the invalid candidate set, or resolve the technical conflict without turning it into a preference question.
10. `SAFE_AUTONOMOUS` and `AUTONOMOUS_WITH_AUDIT` must never create a generic approval gate. `HUMAN_REQUIRED` and human-resolvable `BLOCKED` reuse the authority already represented by the governing contracts; they do not create a new workflow stage. At evidence review, validate any durable ledger with `node integrations/governance/autonomy-evidence.mjs check --root <PROJECT_ROOT> --ledger .specs/features/<feature-slug>/autonomous-decisions.json`; `11-evidence.md` references its decision IDs and release-relevant implications without duplicating the machine-readable records.

## Authoritative artifacts

Read [artifact-lifecycle.md](references/artifact-lifecycle.md) before creating or changing feature artifacts. Preserve stable IDs and traceability. Do not copy the same decision into multiple authoritative files.

Use `.specs/features/<feature-slug>/` for the numbered feature package. Use:

- `.specs/project/STATE.md` for durable project memory;
- `.specs/HANDOFF.md` for the latest operational checkpoint;
- `docs/backend/` for backend readiness, scenario matrices, representative scorecards, and pointers to machine-readable contracts;
- `docs/frontend/` for frontend product, design-system, screen, and browser-evidence contracts.

Update `STATE.md` only for durable decisions, blockers, lessons or deferred ideas and only when the current stage permits that conditional output. Never bypass a prompt's explicit output contract to repair missing project documentation opportunistically.

## Gates

Read [gates-traceability.md](references/gates-traceability.md) before acceptance planning, implementation, adversarial review, or evidence review.

Stop when a blocking product decision, public contract, persistence rule, security boundary, destructive consequence, an applicable backend/frontend representative gate, or final risk acceptance is missing. Do not downgrade a blocker into an assumption to continue.

Use these result values exactly:

```text
passed | failed | partial | not-run
```

`not-run` requires the attempted command or prerequisite probe and the observed failure.

## Implementation

For every testable behavior:

1. Map the task to requirement, acceptance criterion, scenario, and planned test IDs.
2. Write the narrowest meaningful test first.
3. Run it and retain evidence that it fails for the expected reason (`RED`).
4. Implement the minimum coherent behavior (`GREEN`).
5. Refactor only within scope while tests stay green.
6. Run the real project gate and record command, outcome, counts, and skipped tests.
7. Update the task and traceability artifacts without rewriting unrelated content.

Do not weaken tests, fabricate commands, infer persistence from local state, or expand scope through opportunistic refactoring.

## Frontend overlay

For a new or materially changed product screen or workflow, read and follow [frontend-overlay.md](references/frontend-overlay.md). Invoke `frontend-product-builder` and preserve its canonical order:

```text
DISCOVER → PRIORITIZE → VISUAL DIRECTION → COMPOSITION PROOF → CLASSIFY → RECIPE → TOKENS
→ COMPONENT MAP → PLAN → SMALL SLICE → BUILD → BROWSER
→ SCREENSHOTS → COMPOSITION AUDIT → DS AUDIT → PATCH → REPORT
```

Broad frontend build remains blocked until the representative gate is explicitly approved. For bounded visual modernization without product reconstruction, route to `ui-audit-redesign-engineer` instead.

For every user-visible web-interface creation or change, use Impeccable as the governed Visual Craft Authority according to `prompts/spec-driven/frontend-craft-policy.json`. For substantial frontend readiness, run `frontend-control.mjs readiness` after the deterministic screen/recipe/design-system contract pass: `shape` may receive only `shape.dimensions`, the provider-eligible subset still marked `unresolved`; resolved and canonical-owner relationships are out of scope. Accepted provider decisions must be adopted into existing canonical artifacts and re-derived before readiness can close. The detector provides mechanical craft enforcement during BUILD/PATCH, and `critique` owns aesthetic/craft review of the representative slice. Impeccable remains subordinate to product requirements, Behavioral UX, approved design direction, Design System, styling authority, screen contracts and composition proof, and it never approves a release gate. Use `frontend-design` only as the explicit legacy fallback when the Impeccable agent skill is unavailable; never run both as competing visual authorities.

## Backend overlay

For every material backend change, read and follow [backend-overlay.md](references/backend-overlay.md) and invoke `backend-product-builder`. Preserve its canonical order:

```text
DISCOVER → CLASSIFY → CONTRACT → MODEL → BOUNDARIES
→ THREATS → RELIABILITY → OBSERVABILITY → PLAN
→ VERTICAL SLICE → VERIFY → REVIEW → REPORT
```

Use its lightweight path for localized backend changes. Require its full representative flow for new services/subsystems, public contracts, material persistence or security changes, `large|complex`, or `critical` work. Broad backend build remains blocked until `backend-broad-build-approved`; human approval is conditional on public contracts, persistence/migration, security/tenancy, material operational cost, or critical risk.

The backend manifest 1.3.0 must record `technology`. Rust/Axum is the default only for new production runtimes; preserve existing stacks and require evidence-backed exceptions. Route `rust-pro` as hard-required only when `technology.selection=rust-axum-default`.

## Independent review

Use a clean context for adversarial and evidence review. The adversarial stage may create or update only `10-adversarial-review.md` and remediation proposals. It must not repair the implementation it judges. Run implementation again in a separate context for accepted remediations, then repeat adversarial validation.

## Session closure

Before every final response, read and apply [session-closure.md](references/session-closure.md). Always overwrite `.specs/HANDOFF.md`, including when a stage completes or no issue exists. When progress awaits a human command, inspection or decision, include the evidence-based validation and approval runbook defined in [human-approval-runbook.md](references/human-approval-runbook.md); do not leave the user to reconstruct how to validate the gate. The atomic writer now rejects unchecked human-action prose: submit `Nenhuma.` or the `human-guidance` JSON pointer in that section. It validates the actual request and publishes a deterministic Markdown block for the final response. Read and reproduce that block unchanged; the internal request is prepared by the agent, not another user-filled form.

Always expose these headings in the final response:

```text
Perguntas em aberto
Ideias adiadas
Bloqueios
Próximo passo
```

Use `Nenhum` explicitly for empty sections.

## Migration and maintenance

Read [migration-v1.md](references/migration-v1.md) before converting legacy `context.md`, `requirements.md`, `spec.md`, `design.md`, or `tasks.md` packages. Dry-run first, preserve IDs, back up sources, and never overwrite an existing numbered package.

Use bundled scripts for deterministic checks:

```bash
node scripts/validate-workflow.mjs --root <workflow-root>
node scripts/validate-feature-package.mjs <feature-directory>
node scripts/inventory-skills.mjs --root <skills-root>
node scripts/migrate-v1.mjs --feature-dir <feature-directory>
node scripts/sync-install.mjs --source <skill-directory> --check
node scripts/sync-install.mjs --all --root <workflow-root> --check
node scripts/consumer-runtime.mjs install --target <consumer-project-root>
node scripts/consumer-runtime.mjs update --target <consumer-project-root>
node scripts/consumer-runtime.mjs check --target <consumer-project-root>
node scripts/consumer-runtime.mjs uninstall --target <consumer-project-root>
node scripts/consumer-runtime-all.mjs sync --projects-root <projects-directory>
node scripts/consumer-runtime-all.mjs check --projects-root <projects-directory>
```

When a product project is opened as an isolated VS Code workspace, install the managed consumer runtime from the central workflow repository. The physical project copy is intentionally self-contained; preserve product-owned `AGENTS.md`, `CLAUDE.md`, `.github/workflows/`, source code, and feature artifacts. Use `--adopt-existing` only for an explicitly reviewed legacy runtime supported by a valid `workflow.lock.json` or same-path Git provenance. It may preserve preexisting relative, non-dangling symlinks only when they resolve inside the same Git root; their topology is recorded and must remain unchanged. See `prompts/spec-driven/CONSUMER-RUNTIME.md` in the workflow root for the full migration and dependency runbook.

## Completion

Claim completion only when applicable artifacts exist, traceability has no orphans, required gates have evidence, critical adversarial findings are resolved or explicitly accepted, backend and frontend evidence is retained when applicable, any required autonomy decision ledger is validated and referenced from `11-evidence.md`, `11-evidence.md` states a truthful decision, and the handoff points to the next real action.
