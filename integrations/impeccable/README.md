# Impeccable Integration

Impeccable is integrated as the governed **Visual Craft Authority** for user-visible frontend work.

The canonical provider policy is:

```text
prompts/spec-driven/frontend-craft-policy.json
```

## Authority model

```text
spec-driven-engineering
→ workflow, applicability, gates, approvals, traceability and release

frontend-product-builder
→ frontend architecture, screen/state contracts, design-system ownership,
  responsive/accessibility behavior and composition proof

Impeccable
→ visual direction exploration, visual craft, hierarchy/layout critique,
  anti-pattern detection and bounded refinement

playwright-skill
→ browser execution and browser evidence

Behavioral UX contract
→ behavioral influence, persuasion risk, autonomy and guardrails
```

Impeccable is always below approved contracts in authority.

> Impeccable may critique, propose, detect and refine. It may not silently redefine approved product behavior, visual authority, design-system ownership, Behavioral UX policy, screen contracts, authentication/data contracts or release gates.

`frontend-design` is retained only as an explicit legacy qualitative fallback when the Impeccable agent skill is unavailable. It must never run as a competing visual authority for the same decision.

## No second source of truth

Impeccable-native `PRODUCT.md` and `DESIGN.md` are compatibility projections only. Durable product/design truth remains in the numbered feature package and `docs/frontend/` contracts.

Generate provider context with:

```bash
node integrations/impeccable/frontend-craft.mjs prepare \
  --root . \
  --feature-dir .specs/features/<feature>
```

The adapter writes temporary `PRODUCT.md`, `DESIGN.md` and `frontend-craft-provenance.json`, including SHA-256 values of canonical sources. Set the printed `IMPECCABLE_CONTEXT_DIR` before invoking the Impeccable agent skill.

## Primary rollout

The current rollout phase is `primary`.

- Impeccable is the operational Visual Craft Authority.
- `shape` owns governed visual exploration during `VISUAL DIRECTION`.
- The Impeccable detector is required as the mechanical craft capability during BUILD/PATCH; automatic hooks are preferred when supported, with the pinned CLI as fallback.
- `critique` is the primary craft/aesthetic review after browser and composition evidence exist.
- `frontend-design` is legacy fallback only when the Impeccable agent skill is unavailable.
- Impeccable cannot approve or reject the representative gate by itself.
- Product, Behavioral UX, Design System, styling, screen and composition contracts remain higher authority than provider output.

## Stage integration

Phase 3 makes visual exploration **controller-scoped**, not prompt-scoped. For substantial frontend readiness:

```text
CANONICAL CONTRACT PASS
→ screen specification + recipe + Design System available
→ frontend-control.mjs readiness
→ derive + verify craft-contract.json
→ resolved / unresolved / blocked relationships
→ canonical owners resolve their unresolved relationships
→ Impeccable shape only for unresolved provider-eligible dimensions
→ explicit selection when alternatives exist
→ adopt accepted decision into an existing canonical artifact
→ readiness --after-adoption <prior-report>
→ derive again
→ objective readiness validators
```

The controller never calls `shape` itself. It emits a bounded `shape.dimensions` scope. A resolved dimension is closed to provider reinterpretation; a canonical-owner dimension stays with that owner; a blocked relationship must be repaired before provider work that depends on it. If an adopted provider decision changes canonical source hashes but the same dimension remains underived, the controller blocks a repeat shape loop and routes the defect to the contract model.

This is a controlled back-edge to the existing `VISUAL DIRECTION` stage, not a new frontend stage. The canonical `frontend-product-builder` sequence remains unchanged.

During SMALL SLICE / BUILD, Impeccable detector capability remains required. After Playwright/browser evidence, screenshots and composition evidence exist, run Impeccable `critique`, map findings, and then request the human representative gate. During PATCH, use only the narrow governed command justified by a finding and revalidate. Critical UI still adds Impeccable `audit` beside, never instead of, objective validators.

## Phase 4 — Finding Router + Semantic Presentation Registry

Semantic presentation is now executable rather than prompt-inferred. The canonical registry remains inside `design-system.json#visualGrammar.perceptualPolicy.presentationRoles`. A screen may declare `semanticPresentation.mode=registry` and map component usage IDs to semantic roles; derivation enforces the local invariant `same semantic role -> same component family` against the Design System registry and the referenced component catalog. `mode=not-applicable` requires explicit rationale. An absent mapping remains unresolved.

The finding router is deterministic and consumes a **normalized finding with an explicit taxonomy class and defect kind**. It never infers classes from critique prose. The governed taxonomy contains 16 classes from `spatial-density` through `content-clarity`. The route report is temporary/non-canonical and returns class, owner, affected contracts, repair strategy, optional governed provider command, return stage and revalidation set.

Routing invariant:

```text
implementation defect -> PATCH -> targeted implementation repair
contract defect       -> DESIGN_READINESS -> canonical contract repair
```

For contract defects the router always suppresses provider repair commands. Impeccable cannot silently rewrite canonical contracts. Provider commands returned for implementation defects remain subject to the existing command-governance groups, including explicit approval for commands such as `quieter`.

Phase 4 does not add the theme-aware operational audits from Phase 5 and does not wire the full critique -> route -> repair convergence loop planned for Phase 6.

## Degraded fallback

The agent skill itself is a third-party dependency and is not vendored into `skills/`. The workflow therefore keeps a deliberate degraded path:

1. resolve the installed Impeccable agent skill when available;
2. always retain the exact pinned detector path through `integrations/impeccable/frontend-craft.mjs`;
3. when the agent skill is unavailable, record degraded routing and use `frontend-design` only for the qualitative craft step that cannot be provided by the CLI detector;
4. never represent degraded execution as a full Impeccable agent-skill pass.

`workflow.lock.json` may therefore list `impeccable` under `unresolvedSkills` in a source checkout. CI independently verifies the pinned package version and detector behavior.

## Command governance

Managed when their stage/finding applies:

- `shape`
- `critique`
- `layout`
- `typeset`
- `adapt`
- `clarify`
- `polish`

Finding-driven:

- `harden`
- `optimize`
- `distill`
- `colorize`

Explicit human approval:

- `bolder`
- `quieter`
- `animate`
- `delight`
- `live`

Strong explicit human approval:

- `overdrive`

Not canonical in the managed workflow:

- `init`
- `document`

Design-system maintenance only:

- `extract`

Default bounds:

```text
maxVisualInspectionRounds = 2
maxPolishRounds = 1
```

## Visitor modes

Default SaaS product recipes to `operate`:

- application shell
- dashboard
- searchable list
- entity detail
- form workflow
- administration
- authentication
- review/approval

Use `persuade` for approved landing/marketing surfaces, `read` for documentation/guides, and `experience` for portfolio/gallery-like surfaces.

## Behavioral UX boundary

Behavioral UX decides **what influence is allowed**. Impeccable decides **how an approved behavior is expressed well**.

Do not allow generic Impeccable guidance for onboarding, pricing, upgrade or retention to bypass the Behavioral UX contract.

`harden` remains advisory to existing data/forms, screen-state, API integration and authentication contracts.

## Findings and ignores

For a finding:

1. real implementation/contract violation → patch and revalidate;
2. approved intentional design → narrow ignore with `decisionId` or Design System rule ID;
3. bad canonical contract → return to design readiness, update/approve the contract, then patch.

Project-wide detector-rule ignores require explicit human approval.

Provider scores are diagnostic evidence only. They are never release or representative-gate thresholds.

## Provider version

Current pin:

```text
impeccable@3.5.0
```

Do not use an unbounded `latest` dependency in managed execution. Provider upgrades require changelog review, tests, representative battle-test and lock/policy update.

## Validation

The repository CI validates:

- primary authority and command-governance invariants;
- Phase 3 readiness-controller scoping, canonical-owner routing and no-repeat-shape guard;
- Phase 4 semantic-presentation registry derivation and deterministic 16-class finding routing;
- Phase 5 theme-aware operational evidence;
- Phase 6 representative closed repair loop;
- Phase 7 cross-screen/cross-theme visual-family consistency;
- context projection and provenance;
- rejection of provider gate authority;
- exact `3.5.0` provider resolution;
- known-bad and known-clean detector fixtures;
- portable frontend-product-builder reference resolution;
- workflow lock consistency;
- existing spec-driven, backend, frontend and Behavioral UX suites.

## Phase 5 — theme-aware operational evidence

`visual-composition-evidence.json` carries objective browser evidence for theme, surface hierarchy, spatial fit, typed presence, interaction targets/states, semantic presentation, wayfinding, reusable-reference utility and decision signals. Run `skills/frontend-product-builder/scripts/audit-theme-operational-evidence.mjs` after the basic composition evidence audit and before Impeccable `critique`. It is an objective validator and does not replace Playwright, provider critique or the human representative gate.

## Phase 6 — closed representative repair loop

`frontend-control.mjs representative` is the executable orchestration boundary for representative visual convergence. It verifies fresh contract-bound evidence, runs the Phase 5 objective audit, requires explicit structured critique classification, normalizes findings without free-text taxonomy inference, routes material findings through the Finding Router, and emits machine-readable next actions. Contract defects return to `DESIGN_READINESS`; implementation defects may consume at most two craft repair rounds. No material finding transitions to the human gate. One optional `polish` round is available only when explicitly requested and is followed by rerender, re-audit and re-critique.

The controller never edits canonical contracts, never approves the representative gate, and never auto-executes provider commands that require explicit approval.

## Phase 7 — cross-screen / cross-theme family consistency

Phase 7 answers a different question from the representative gate: after broad build, do the implemented screens and themes still behave as members of the same approved visual family?

The executable boundary is:

```bash
node integrations/impeccable/frontend-family-consistency.mjs \
  --root . \
  --manifest <frontend-family-consistency-manifest.json> \
  --output <frontend-family-consistency-report.json> \
  --check
```

The manifest groups fresh samples by `craft-contract.visualFamilyId`. Each sample binds one `screenSpec + craftContract + visual-composition-evidence` tuple for a concrete `screen/state/theme`. Before family comparison, the auditor requires every sample to pass `frontend-craft.mjs verify-craft` and the Phase 5 theme-aware operational audit. Stale or individually invalid evidence therefore blocks family inference instead of being compared as if it were trustworthy.

Theme coverage is derived from `design-system.json#themes.supported`. Every exercised `screen/state` must have evidence for every supported theme when Phase 7 is applicable. Missing theme evidence is not misclassified as a product defect; it produces `CAPTURE_EVIDENCE`.

Cross-theme comparison intentionally does **not** require pixel equality. It checks stable semantic structure, presentation family, hierarchy roles, interaction/wayfinding/decision semantics, typography metrics and bounded geometry/occupancy tolerances while allowing theme-specific color values and separation calibration already validated by Phase 5.

Cross-screen comparison operates inside one `visualFamilyId`. It verifies family-level invariants such as density mode, maximum visual nesting depth, strict semantic-role presentation families, typography family-role contracts and observed typography consistency by theme. Legitimate screen content may differ; the audit compares governed roles/contracts, not literal page contents.

Phase 7 reuses the Phase 4 Finding Router and its 16-class taxonomy. It does not create a parallel finding system:

```text
missing supported-theme evidence -> CAPTURE_EVIDENCE
implementation family drift      -> PATCH
canonical family-contract drift  -> DESIGN_READINESS
invalid/stale individual sample  -> BLOCKED
no objective family drift        -> CONSISTENT
```

Contract findings suppress provider repair commands exactly as in Phase 4. Implementation findings may return a governed provider command only through the existing command policy. `CONSISTENT` means that the Phase 7 objective contract passed; it is not a human approval, release approval or new gate state.

Phase 7 does not create a new canonical workflow stage. It runs after broad build where multiple screens/themes actually exist: `08-adversarial` uses it as an independent rejection surface and `09-validate-evidence` persists the per-family manifest/report as release evidence. The representative small-slice gate in `07.1` remains unchanged.
