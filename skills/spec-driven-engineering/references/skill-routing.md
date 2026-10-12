# Skill Routing

Discover skills from the environment. Do not rely on a static registry or hardcoded install root.

Every route in `manifest.json`'s `skillRoutes` declares a `requirementLevel`:
`hard-required` (block without it — no fallback exists), `required-with-
degraded-fallback` (proceed via the declared `fallback` and record degraded
routing in `11-evidence.md`), or `optional` (use only when its trigger
condition matches). `required` is a derived boolean (`true` only for
`hard-required`) kept for simpler boolean checks — the requirement level,
not the boolean alone, is the source of truth for what "required" actually
means for that route.

## Mandatory routes

| Condition | Skill or capability | Fallback |
|---|---|---|
| Any workflow stage | `spec-driven-engineering` | Block: core contract unavailable |
| Project initialization or codebase governance | `tlc-spec-driven` | Use its project/codebase templates inline and record degraded routing |
| Writing, changing or reviewing code | `coding-guidelines` | Apply the same surgical rules inline |
| Testable feature or bug | `tdd-workflow` plus repository test patterns | Inline RED/GREEN/REFACTOR |
| After code change | `lint-and-validate` using real project commands | Run discovered lint/type/test gates directly |
| Library, framework, SDK, API, CLI or cloud decision | `context7-mcp` | Official documentation, then web, then flag uncertainty |
| Validation/review | `code-review-checklist` | Equivalent evidence-based checklist inline |

Never invent commands from a generic skill. Repository scripts, CI and `TESTING.md` remain authoritative.

Use `tlc-spec-driven` only as the specialist for project initialization, roadmap, state and brownfield mapping templates. It does not replace the 00–11 lifecycle, gates or session closure owned by `spec-driven-engineering`.

## Code intelligence

In a Git repository, follow the local `AGENTS.md` GitNexus policy. Use the task-matched GitNexus skill when indexed and available. Use `codenavi` for unfamiliar brownfield exploration when GitNexus is unavailable or not applicable. Fall back to `rg`, direct reads and language tools, and state the limitation.

## Frontend

- Use Impeccable as the governed Visual Craft Authority for every user-visible web-interface creation or change according to `prompts/spec-driven/frontend-craft-policy.json`. For substantial readiness, `frontend-control.mjs readiness` classifies craft relationships first; `shape` receives only provider-eligible `unresolved` dimensions, while resolved/canonical-owner relationships remain outside provider scope. The detector owns mechanical craft detection during BUILD/PATCH, and `critique` owns representative-slice craft review. Impeccable remains subordinate to canonical product/design contracts and may never approve a gate.
- Resolve Impeccable through the installed agent skill when available. When `workflow.lock.json` reports `impeccable` in `unresolvedSkills`, the skill is not installed: record degraded routing, keep the pinned detector through `integrations/impeccable/frontend-craft.mjs`, and `frontend-design` becomes the visual-craft authority for that session automatically — it is not an opt-in the agent has to remember. Never run both as competing visual authorities for the same decision.
- Use `frontend-product-builder` for new or materially reconstructed product screens and workflows. Missing required assets is a blocker.
- Use `frontend-product-builder` visual composition validation for substantial frontend work; do not create a separate `frontend-dev-guidelines` authority.
- Use `ui-audit-redesign-engineer` as a required specialist for controlled visual modernization without product reconstruction.
- Use `web-design-guidelines` only for an independent post-build standards review when explicitly applicable; it is not a second primary craft authority.
- `playwright-skill` is the required tool for browser evidence (frontend BROWSER/SCREENSHOTS stages and final UI audit), regardless of which agent executes the session — never "when appropriate." See `frontend-product-builder/SKILL.md` Stage 10/11 for the exact command sequence.
- Use `react-best-practices` and `react-composition-patterns` as required reading/practice during BUILD/PATCH whenever the detected stack is React; use `tailwind-patterns` as required reading during TOKENS whenever the detected stack is Tailwind. Other framework, accessibility, or i18n skills remain conditional on detected stack and scope.
- Do not route `frontend-blueprint` by default: its reference-discovery contribution is already captured by the styling/visual-reference contract, while its separate phased workflow would duplicate the orchestrator. Use it only when explicitly requested or locally adopted.

## Backend

- Use `backend-product-builder` for every material backend change; its light path is sufficient for localized low-risk work.
- Use `api-patterns` plus `context7-mcp`/official docs for affected HTTP, GraphQL, gRPC, event, job, or CLI technologies.
- Use `architecture` only for a material boundary or architectural decision; use `system-design` only for quantified scale or distributed-system behavior.
- Use `database-design` for persistence, schemas, transactions, or migrations.
- Use `domain-driven-design` for genuinely complex domains and `tactical-ddd` only for the model that benefits.
- Use `evolutionary-modular-architecture` only for a complex modular platform.
- Use `vulnerability-scanner` plus versioned official controls for auth, authorization, tenancy, sensitive data, or public APIs.
- Use `testing-patterns` with `tdd-workflow` for contract, integration, persistence, and migration tests.
- Use `deployment-procedures` for migration, deployment, rollback, or forward recovery.
- Use Docker, Elastic, framework, database, cloud, or other stack skills only when that stack exists.

Do not use `backend-dev-guidelines` as universal authority because it prescribes a particular Node/Express/Prisma/Sentry shape. Browser/Core Web Vitals profiling is not backend performance authority. Elastic guidance is conditional on Elastic. Narrative documentation does not replace an executable protocol contract.

## Risk and domain routes

- Use `systematic-debugging` when a failure is reproducible but the cause is not obvious.
- Use `vulnerability-scanner` for authentication, authorization, sensitive data, public endpoints or critical security paths.
- Use `performance-profiling` only for a measured browser performance requirement or regression; use project-native backend load/profiling tools for backend NFRs.
- Use `i18n-localization` when locale, long content, formatting or RTL is in scope.
- Use architecture, API, database, DDD and stack-specific skills only when their trigger condition is present.
- Use `spec-driven-eval` only when explicitly enabled for quantitative grading.

## Precedence

Apply in this order:

```text
repository AGENTS.md
→ project rules and artifacts
→ spec-driven-engineering
→ matched specialist skill
→ generic guidance
```

Record unavailable mandatory specialists as blockers. Record optional fallbacks and degraded validation in `11-evidence.md`.
