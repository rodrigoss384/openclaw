# Applicability Contract

## Purpose

Today, decisions like "is this backend/frontend/persistence/migration
substantial?" live scattered across narrative prose in `00-intent.md`,
`02-assumptions.md`, and `05-design-readiness.md`, re-derived by whichever
stage needs them. That produces two failure modes: a later stage infers a
different answer than an earlier stage already gave, and every stage pays
the cost of loading everything "just in case" instead of only what
applicability says it needs.

`applicability.md` is the single, machine-readable answer, frozen once
`02-spec-assumptions` closes and re-opened only through an explicit,
recorded change — never silently re-derived by a later stage.

## When it is produced

`02-spec-assumptions.prompt.md` produces
`.specs/features/{{FEATURE_SLUG}}/applicability.md` immediately after
`01-spec.md`/`02-assumptions.md`, using only 00–02 as input. It is a control
artifact alongside `.specs/HANDOFF.md`, not part of the fixed 00–11
sequence — its absence does not shift artifact numbering, but its absence
for a feature that has already produced `02-assumptions.md` blocks every
later stage's context-load step.

## Fields

Every field is one line, `field: value`, using only the declared enum.
`not-applicable` is a valid, final answer — it is not the same as "not yet
decided."

```text
complexity: quick | small | medium | large | complex
criticality: low | standard | critical
frontend: not-applicable | lightweight | substantial
backend: not-applicable | lightweight | substantial
persistence: not-applicable | affected
public-api: unchanged | compatible | breaking | new
auth: not-applicable | affected
tenancy: not-applicable | affected
concurrency: not-applicable | affected
migration: not-applicable | required
new-service-or-subsystem: not-applicable | applicable
material-operational-cost: not-applicable | applicable
performance: not-applicable | standard | critical
accessibility: not-applicable | required
frontend-representative-gate: not-required | required
backend-representative-gate: not-required | required
browser-evidence: not-required | hard-required
contract-drift-check: not-applicable | required
interface-contract: not-applicable | applicable
interface-contract-kind: none | http | event | graphql | grpc | job | cli
interface-contract-type: none | openapi | asyncapi | graphql-sdl | protobuf | arazzo | custom
behavioral-ux: not-applicable | applicable
behavioral-ux-risk: none | standard | high-risk
outcome-evidence: not-applicable | applicable
```

Derivation rules:

- `frontend-representative-gate: required` whenever `frontend: substantial`.
- `backend-representative-gate: required` — this is the single
  `deriveBackendRepresentativeGate(applicability)` rule; `gate-state-machine.md`
  and `backend-product-builder`'s own `gate.conditions`/`gate.required`
  (`scripts/lib/backend-package.mjs`) must agree with it, never restate or
  narrow it independently — whenever `backend: substantial` and at least one
  of:
  - `public-api != unchanged` (mirrors `gate.conditions.publicContract`);
  - `persistence: affected` (mirrors `persistenceOrMigration`);
  - `auth: affected` or `tenancy: affected` (mirrors `securityOrTenancy`);
  - `criticality: critical` (mirrors `criticalRisk`);
  - `complexity: large` or `complexity: complex` (mirrors `largeOrComplex`);
  - `new-service-or-subsystem: applicable` (mirrors `newServiceOrSubsystem`);
  - `material-operational-cost: applicable` (mirrors `materialOperationalCost`).
- `browser-evidence: hard-required` whenever `frontend != not-applicable`.
  There is no "when appropriate" value — see `rules.md`.
- `contract-drift-check: required` whenever `backend: substantial` and
  `public-api != unchanged`, or whenever the frontend consumes a
  machine-readable backend contract (see
  `frontend-product-builder/references/07-data-and-forms.md` §4).
- `interface-contract: applicable` whenever this feature introduces or
  changes a machine-readable interface between systems (see
  `skills/backend-product-builder/references/interface-contract.md`); when
  applicable, `interface-contract-kind` and `interface-contract-type` are
  required and must use the canonical pairing from that reference's adapter
  matrix (e.g. `kind: http` pairs with `contractType: openapi`, never with
  `graphql-sdl`).
- `behavioral-ux: applicable` whenever this feature includes a product
  surface meant to influence a user's decision or behavior (onboarding,
  activation, pricing, upgrade, renewal, retention, cancellation — see
  `skills/frontend-product-builder/references/14-behavioral-ux.md`).
  `behavioral-ux-risk: high-risk` for pricing/upgrade/renewal/retention/
  cancellation surfaces or any surface touching consent, privacy, security,
  permissions, financial commitment, or data deletion; `standard` otherwise.
  High-risk surfaces require the Behavioral Adversarial Review before
  release, never only the standard adversarial review.
- `outcome-evidence: applicable` whenever `behavioral-ux: applicable`, or
  whenever `00-intent.md` states a measurable user/product outcome
  (activation, conversion, retention, engagement, task success — see the
  HEART/Metric Class vocabulary in
  `skills/spec-driven-engineering/references/outcome-evidence.md`) as a
  success criterion, independent of any behavioral intervention. When
  applicable, `02-spec-assumptions` also produces `outcome-plan.md`, frozen
  immediately (preregistration before any observation exists). This is
  distinct from `11-evidence.md` in two ways: Delivery Evidence (did we build
  it correctly, verified at release) never substitutes for Outcome Evidence
  (did it help the user, verified after a real observation window closes);
  and within Outcome Evidence itself, the preregistered plan (`outcome-plan.md`)
  is a separate, frozen artifact from the observed result (`outcome-evidence.md`)
  — neither the Delivery/Outcome split nor the plan/evidence split may be
  skipped by re-labeling one as the other.

A stage that would set a field inconsistently with these derivation rules
must stop and record the conflict as a blocker in `02-assumptions.md`
instead of silently picking one side.

## How later stages consume it

Every stage's `context-load` step reads `applicability.md` before deciding
what else to load:

- `frontend: not-applicable` → skip every frontend-only reference, skill
  route, and gate; do not read `frontend-product-builder` material at all.
- `backend: not-applicable` → skip `backend-product-builder` material,
  scenario-matrix backend dimensions, and the backend representative gate.
- `migration: not-applicable` → skip migration plan sections and rollback
  requirements.
- `accessibility: not-applicable` is not a legitimate value for any
  substantial frontend; it exists for `frontend: not-applicable` only.

This is what makes "a small frontend task doesn't have to load backend
migration/BOLA/chaos-testing rules" true by construction instead of by hope.

## Changing an applicability field after it is frozen

A later stage that discovers `applicability.md` is wrong (e.g. `backend`
was `not-applicable` but the feature turns out to touch persistence) does
not silently correct the field and continue. It:

1. stops the current stage;
2. records the discovery as a blocker in the current handoff, citing the
   specific field and the evidence that contradicts it;
3. returns to `02-spec-assumptions` to re-issue `applicability.md` with the
   corrected field and a dated changelog line at the bottom of the file;
4. only then resumes downstream work, which must re-check whether anything
   already produced now violates the corrected applicability.

## Validation

`scripts/validate-applicability-contract.mjs <applicability.md>` checks:

- the file exists once `02-assumptions.md` exists for the same feature;
- every required field is present with a value from its declared enum;
- no unresolved `{{PLACEHOLDER}}` remains;
- the derivation rules above are not contradicted (e.g.
  `frontend: substantial` with `frontend-representative-gate: not-required`
  is a hard error, not a warning).
