# Backend overlay

Invoke `backend-product-builder` for every material backend change. Keep numbered feature truth in 00–11 and each current feature's backend-specific readiness/evidence in `docs/backend/<feature-slug>/`. Reference existing contracts rather than moving or duplicating them. Global packages directly under `docs/backend/` remain valid historical authorities for the feature that created them, but new work never overwrites them.

## Adaptive application

Every backend change performs a light pass over conventions, affected contract, trust-boundary validation, error semantics, security, tests, and documentation.

Require the full representative flow for:

- a new service or subsystem;
- a new or materially changed public/cross-team contract;
- material persistence, schema, migration, or transaction change;
- material authentication, authorization, tenancy, sensitive-data, or audit change;
- `large|complex` work or `critical` risk.

Design in `07-design.md` is also required for a substantial backend, material boundary decision, public contract, relevant persistence, or applicable backend gate.

## Contract surface

Use the project's machine-readable authority: OpenAPI for HTTP, AsyncAPI where adopted for events, GraphQL SDL, `.proto`, or explicit jobs/CLI contracts. Swagger UI is only a renderer. Maintain a scenario matrix linking `REQ → AC → SCN → AT → operation/message` across success, negative, abuse, compatibility, and recovery behavior.

`docs/backend/<feature-slug>/backend-change-manifest.json` is the canonical backend control-plane manifest for current feature work. A feature may keep using a legacy global manifest only when its frozen artifacts already identify that path. Do not create parallel reliability/security policies for Phase 9E. Its structured hardening fields own:

- `technology`: runtime context, Rust/Axum default or selected alternative, decision reference and evidence-backed exception;
- `reliability.externalDependencies[]`: dependency, timeout, bounded retry/backoff, transient-only eligibility, idempotency, failure mode, evidence;
- `security.boundaries[]`: trust boundary, resource, identity source, tenant binding, authorization point, negative test IDs;
- `testIntegrity`: declared test paths, preserved/increased contractual coverage and deterministic no-weakening policies;
- `repairTrace`: finding → systemic cause → canonical authority repair → repair evidence → regression test IDs when `mode=repair`.

## Representative gate

Readiness is `ready-for-backend-slice` only after contract/test commands, applicability, boundaries, security, data, reliability, observability, and slice scope are explicit. While pending, `execute` may implement only that vertical slice.

Human approval is required for public contracts, persistence/migration, security/tenancy, material operational cost, or critical risk. Applicability uses structured booleans in `gate.conditions`, not narrative matching. Other applicable slices can be released after automated and independent evidence passes. Broad work requires a machine-valid scorecard, contract evidence bound to the current contract SHA-256 and `backend-broad-build-approved`.

For a material security/tenancy change or before `backend-broad-build-approved`, security boundaries must be concrete and linked to negative authorization/isolation tests. For external integrations, each dependency must have structured timeout/retry/idempotency/failure-mode evidence; retries beyond the first attempt require transient failures and cannot be used with unsafe idempotency.

Before backend completion, run the deterministic test-integrity audit against an explicit review baseline:

```bash
node skills/backend-product-builder/scripts/audit-test-integrity.mjs \
  --root <PROJECT_ROOT> \
  --manifest docs/backend/<feature-slug>/backend-change-manifest.json \
  --base <EXPLICIT_BASELINE_REF> \
  --output docs/backend/<feature-slug>/evidence/test-integrity.json
```

Never infer the baseline. Deleting a declared test file, newly disabling/skipping/focusing tests, net removal of assertion-like lines, or disappearance of stable contract-linked test IDs is blocking until the canonical contract is deliberately rebaselined through its proper authority rather than weakened during implementation.

## Non-negotiable review

Review contract drift, BOLA/IDOR, tenant isolation, invariants, transactions, migrations, compatibility, idempotency, concurrency, timeout/retry safety, dependency failure, telemetry, sensitive data, SLO evidence, test-integrity evidence, repair trace when applicable, rollout/recovery, and speculative architecture. Contract drift, test weakening, or an unreleased applicable backend gate blocks adversarial/release progression.

SOLID, pattern choice, abstraction style, and code elegance remain contextual review criteria unless an objective canonical contract, measurable NFR, or registered rule makes the concern blocking.

When `technology.selection=rust-axum-default`, route `rust-pro` as hard-required. Require actual repository commands for formatting check, `cargo check`, Clippy with warnings blocking and tests; optional Rust tooling remains conditional on configuration and applicable risk/NFR. Other selections route only the specialist for the technology actually chosen.
