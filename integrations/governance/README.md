# Governance Kernel

This directory contains the executable governance control plane introduced after Visual Craft Closure V3.

## Phase 8A — Rule Registry Foundation

Phase 8A established a typed registry for governable engineering rules without replacing `rules.md`, adding a workflow stage, or changing human approval governance.

Canonical rule kinds:

```text
hard-invariant
  -> production enforcement required

deterministic-default
  -> resolver required

contextual-heuristic
  -> advisory only; cannot block by itself

consequential-decision
  -> explicit human escalation required
```

`rules.md` remains the human-readable constitution and rationale. `prompts/spec-driven/governance-policy.json` stores executable classification, applicability, authority, failure routing and traceability.

## Phase 8B — Enforcement Capability Registry

Phase 8B removes repository-path coupling from rule enforcement.

A rule now references a stable capability ID:

```json
{
  "enforcement": {
    "capability": "frontend-styling-authority-validation"
  }
}
```

The physical implementation lives in `enforcement-capabilities.json`:

```text
capability id
  -> owner
  -> kind
  -> repository entrypoint
  -> invocation contract
  -> input contracts
  -> failure semantics
  -> supported stages
```

Capability invariants include:

- stable unique IDs;
- registered owner authority;
- repository-relative production entrypoint;
- regression test files cannot masquerade as enforcement;
- schema capabilities use schema invocation and `schema-rejection` failure semantics;
- validators/controllers use CLI invocation and nonzero-exit semantics;
- CLI command must invoke the registered entrypoint;
- input contract IDs are unique;
- rule authority must match capability owner;
- rule stage scopes must be supported by the capability;
- hard rules require capabilities with blocking failure semantics.

The current eight migrated hard rules use seven capabilities. Both backend rules deliberately reuse `backend-change-manifest-contract`, proving that enforcement is reusable infrastructure rather than a one-rule/one-script mapping.

## Phase 8C — Effective Policy Resolver

Phase 8C derives the smallest governance policy needed for one concrete workflow execution. It does not interpret `rules.md` prose and does not create a new canonical artifact.

Controller:

```bash
node integrations/governance/governance-control.mjs resolve \
  --root . \
  --stage design-readiness \
  --feature example-feature \
  --applicability .specs/features/example-feature/applicability.md \
  --output /tmp/effective-policy.json
```

The resolver validates all upstream machine-readable inputs before deriving output:

```text
governance-policy.json
  -> validate-governance-policy.mjs

enforcement-capabilities.json
  -> validate-enforcement-capabilities.mjs

applicability.md
  -> validate-applicability-contract.mjs

validated inputs
  -> stage filter
  -> applicability filter
  -> kind classification
  -> required capability projection
  -> effective-policy.schema.json validation
```

`effective-policy.json` is:

- derived and non-canonical;
- deterministic for the same inputs;
- scoped to one workflow stage;
- filtered by frozen structured applicability rather than prose inference;
- split into `hardRules`, `defaults`, `advisories` and `escalations`;
- explicit about `requiredEnforcements`;
- traceable through SHA-256 hashes of the governance policy, capability registry and applicability source;
- regenerable at any time.

The resolver currently consumes only selectors already modeled by the governance registry (`frontend`, `backend`, `behavioralUx`). Additional structured manifests can be incorporated later only when a registered rule actually requires them; Phase 8C does not invent unused input contracts.

Regression coverage in `test-effective-policy.mjs` proves:

- substantial frontend rules are selected at design-readiness;
- lightweight frontend excludes substantial-only rules;
- backend implementation selects only stage/applicability-compatible backend rules;
- `every-stage` and session-closure rules compose correctly;
- identical inputs produce identical policy data;
- source hashes change when applicability changes;
- invalid applicability is rejected before resolution;
- unknown stages, missing feature identity and root-escaping applicability inputs are rejected.

## Phase 8D — Rule Coverage Gate

Phase 8D adds a dedicated CI rejection surface that proves every registered rule has the mechanism required by its canonical class.

Command:

```bash
node integrations/governance/audit-rule-coverage.mjs --root .
```

The audit composes the Phase 8A/8B validators first, then emits a coverage census:

```text
hard-invariant
  -> registered blocking capability

deterministic-default
  -> production resolver

consequential-decision
  -> explicit human escalation

contextual-heuristic
  -> advisory-only; no blocking route
```

This intentionally does not create a second implementation of capability/path validation. `validate-governance-policy.mjs` and `validate-enforcement-capabilities.mjs` remain the canonical semantic validators; `audit-rule-coverage.mjs` is the dedicated coverage gate that makes their class-to-mechanism contract visible and permanent in CI.

`test-rule-coverage.mjs` proves:

- the repository policy has complete coverage;
- all four rule classes can be represented with valid coverage;
- a hard rule without enforcement fails;
- a hard rule referencing an unknown capability fails;
- a deterministic default without resolver fails;
- a consequential decision without escalation fails;
- a contextual heuristic with blocking semantics fails.

## Phase 8E — Bootstrap Integration

Phase 8E integrates effective policy into the existing prompt bootstrap without creating a new workflow stage or removing `rules-resolution`.

The canonical owner is `prompts/spec-driven/manifest.json#contextBootstrap.governancePolicy`. Effective policy starts only after `02-spec-assumptions` has frozen `applicability.md`; setup, discovery, specification and auxiliary noncanonical evaluation/outcome prompts are not forced into invented governance stages.

Canonical post-applicability bindings are:

```text
acceptance                    -> acceptance
behavior-tests                -> acceptance
design-readiness              -> design-readiness
test-plan-tasks               -> design-readiness
execute                       -> implementation
frontend-representative-gate  -> frontend-representative
backend-representative-gate   -> backend-representative
adversarial                   -> adversarial
validate-evidence             -> evidence-release
```

Each bound prompt now preserves `rules-resolution` and adds:

- `policy-resolution` — executes `governance-control.mjs resolve` for the mapped stage;
- `policy-rollout` — applies the manifest-selected `shadow|primary` authority model;
- `context-load` — includes derived `effective-policy.json` and scopes additional rules/rationale loading by rollout mode.

The rollout was performed in two independently validated commits:

```text
shadow
  -> rules.md remains fully operational
  -> effective policy generated and compared
  -> mismatch/failure blocks

primary
  -> primaryScope=registered-rules-only
  -> hard rules already migrated use effective policy as operational authority
  -> rules not yet registered still resolve from the existing rules path
  -> rules.md remains rationale/constitution
```

`validate-bootstrap-policy.mjs` rejects invalid mode/rules-resolution pairings, incorrect prompt-stage bindings, missing resolver wiring, unmapped prompts trying to invent policy resolution, bootstrap mismatch semantics and any attempt to change existing human gates.

`test-bootstrap-policy.mjs` covers both rollout modes before promotion, negative bootstrap regressions and runtime resolution for every mapped governance stage. For each selected hard rule it proves the chain:

```text
registered rule
  -> registered capability
  -> effective policy
  -> required enforcement
  -> capability supports current stage
```

Shadow validation completed successfully before the primary promotion. The primary promotion then changed only the manifest rollout mode and also completed the full repository pipeline successfully.

Existing representative and release approvals remain unchanged. Effective policy cannot approve a human gate, broaden a reviewed scope, or grant Phase 9 autonomy.

## Permanent CI order

```text
governance rule registry foundation
effective governance policy resolver
governance rule coverage
governance bootstrap integration
```

## Current files

- `governance-policy.schema.json` — rule registry contract;
- `validate-governance-policy.mjs` — validates rule semantics and rule→capability bindings;
- `enforcement-capabilities.schema.json` — capability registry contract;
- `enforcement-capabilities.json` — registered production enforcement primitives;
- `validate-enforcement-capabilities.mjs` — validates capability implementation semantics;
- `test-enforcement-capabilities.mjs` — negative regression suite for capabilities;
- `test-governance-policy.mjs` — composed Phase 8A/8B regression gate;
- `effective-policy.schema.json` — derived effective-policy contract;
- `governance-control.mjs` — governance controller, currently exposing `resolve`;
- `test-effective-policy.mjs` — Phase 8C regression suite;
- `audit-rule-coverage.mjs` — dedicated rule class→mechanism coverage audit;
- `test-rule-coverage.mjs` — Phase 8D regression suite;
- `validate-bootstrap-policy.mjs` — Phase 8E bootstrap/cutover validator;
- `test-bootstrap-policy.mjs` — Phase 8E shadow/primary and runtime regression suite.

## Phase 8 closure

The Governance Kernel now proves the complete operational chain:

```text
hard rule
  -> governance registry
  -> enforcement capability
  -> effective policy
  -> validator/controller/schema
  -> bootstrap consumption
  -> CI
```

`rules.md` remains the human-readable constitution and rationale, while registered hard governance is no longer dependent on agents retaining the complete prose during post-applicability execution.

## Boundaries

Still deferred:

- Phase 9: autonomous decision routing.

Phase 8 does not grant new decision authority to agents and does not change human approval governance.
