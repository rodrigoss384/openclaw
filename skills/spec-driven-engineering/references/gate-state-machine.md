# Gate State Machine

`manifest.json`'s `gates` array declares nine gate ids in order, but order
alone under-specifies the real workflow: `adversarial` is not simply "after
implementation" — it is reachable only once every applicable representative
gate has resolved. Each gate now declares `dependsOn` (the real predecessor
edges) and, where relevant, `guard` (the condition, referencing
`applicability.md`, that determines whether the gate applies and when it is
satisfied). `validate-workflow.mjs` checks the `dependsOn` graph structurally
(every dependency exists and precedes the gate in order; `adversarial` must
depend on both representative gates).

## Full transition diagram

```text
DISCOVERY
    ↓
SPECIFICATION
    ↓
ACCEPTANCE
    ↓
DESIGN-READINESS
    ↓
IMPLEMENTATION (small slice when a representative gate applies)
    ↓
    ├── backend-representative-gate == required ──→ BACKEND-REPRESENTATIVE
    │   (the deriveBackendRepresentativeGate rule       ├── rejected/blocked → back to IMPLEMENTATION (patch)
    │    in applicability-contract.md — never "any      └── passed/approved  → continue
    │    substantial backend"; see that file for
    │    the full compound condition, and never
    │    restated independently by this diagram or
    │    by backend-product-builder's gate.required)
    │
    ├── applicability.frontend == substantial ───→ FRONTEND-REPRESENTATIVE
    │                                                   ├── rejected/blocked → back to IMPLEMENTATION (patch)
    │                                                   └── passed/approved  → continue
    │
    └── neither applies ─────────────────────────→ continue directly
    ↓
BROAD BUILD (only after every applicable representative gate above is
             passed/approved/not-applicable — never while one is
             pending/rejected)
    ↓
ADVERSARIAL (independent context)
    ├── critical finding uncorrected/unaccepted → back to IMPLEMENTATION (patch)
    └── clear or explicitly accepted risk        → continue
    ↓
EVIDENCE-RELEASE
    ├── evidence incomplete or human approval absent → blocked, stays here
    └── evidence complete and human approval recorded → release
```

## Guards, in plain terms

- The frontend representative gate is **entered** when `applicability.md`'s
  `frontend` field is `substantial`. The backend representative gate is
  **entered** when `applicability.md`'s `backend-representative-gate` field
  resolves `required` — the compound `deriveBackendRepresentativeGate` rule
  in `applicability-contract.md`, not "any substantial backend". When a
  gate's field is `not-applicable`/`not-required`, the gate itself does not
  block anything, and downstream gates treat it as satisfied.
- A representative gate is **passed** when its own audit script returns a
  passing result *and*, where `humanApproval` is `true` or resolves
  `conditional` → true for this feature, a human has recorded an explicit,
  scoped approval — running the audit clean is evidence, not approval.
- `adversarial` cannot start while any applicable representative gate is
  still `blocked`, `ready` (awaiting approval), or `rejected`. This is now
  a structural graph edge (`dependsOn`), not a narrative aside.
- A **rejection** at any gate returns control to `IMPLEMENTATION` for a
  patch cycle, re-entering the same gate afterward — it never skips forward.
- `EVIDENCE-RELEASE` is the only gate that ends the workflow; a human
  decision here is `approved`, `approved-with-accepted-risk`, `rejected`,
  or `awaiting-review` (see `rules.md`, "Contrato do Spec-Driven
  Engineering").

## Why this matters

Before this file existed, the only place the *real* dependency between
`adversarial` and the representative gates was written down was prose in
`rules.md`/`gates-traceability.md` — an agent that only read the manifest's
gate list could believe `adversarial` was reachable right after
`implementation`. The `dependsOn` graph is now checked by
`validate-workflow.mjs`, so that specific drift can no longer pass
validation silently.
