---
name: backend-product-builder
description: Design, extend, migrate, repair, and review production backend products with adaptive contract-first rigor. Use for material changes to APIs, services, jobs, event consumers, domain logic, persistence, authorization, tenancy, integrations, reliability, observability, migrations, or backend documentation. Enforces a representative vertical slice when public contracts, persistence, security, new subsystems, or large/complex/critical risk requires proof before broad implementation.
---

# Backend Product Builder

Build backend behavior as a product: explicit contracts, correct boundaries, trustworthy data, secure access, diagnosable failure, and evidence proportional to risk. Preserve the project's stack and architecture. Do not manufacture layers or infrastructure to imitate a reference architecture.

## Operating contract

Use this canonical flow:

```text
DISCOVER → CLASSIFY → CONTRACT → MODEL → BOUNDARIES
→ THREATS → RELIABILITY → OBSERVABILITY → PLAN
→ VERTICAL SLICE → VERIFY → REVIEW → REPORT
```

Choose exactly one public mode:

- `quick-fix`: localized defect with no new boundary or contract shape.
- `extension`: behavior added inside an established service or module.
- `new-build`: new service, subsystem, interface, or bounded capability.
- `migration`: schema, data, protocol, platform, or compatibility transition.
- `integration`: external system, event, webhook, SDK, or service interaction.
- `repair`: recovery from design, security, reliability, or data-integrity debt.

Apply the lightweight path to every material backend change: discover local conventions; identify the affected contract; validate trust boundaries; define error semantics; check security; test behavior; update machine-readable and human-facing documentation.

Apply the full flow when the backend representative gate is required. Read [references/workflow.md](references/workflow.md) and [references/representative-gate.md](references/representative-gate.md) before planning that work.

## Representative gate decision

Require a representative vertical slice when any condition is true:

- a new service or subsystem is introduced;
- a public or cross-team contract is created or materially changed;
- persistence, schema, migration, or transaction boundaries change materially;
- authentication, authorization, tenancy, sensitive data, or audit behavior changes materially;
- complexity is `large` or `complex`, or criticality is `critical`.

Human approval is required only for a public contract decision, persistence/migration, security/tenancy, material operational cost, or critical risk. Other applicable slices may advance automatically after their scorecard and evidence pass.

When human approval or command authorization is required, complete safe authorized automated checks first and provide an actionable runbook rather than only reporting a blocker. The runbook must use real project evidence for `cwd`, prerequisites, startup/test/audit/request commands, expected outcomes, side effects, cleanup or recovery, evidence to return, and scoped approve/reject responses with real gate/task/contract IDs. Separate command execution from approval; a passing command never implies consent. For privileged, destructive, production, external-write, migration or cost-bearing operations, identify target and consequences and distinguish authorizing the agent from executing personally.

While the gate is pending, reach `ready-for-backend-slice` and implement only the smallest vertical slice that crosses the real architecture. Do not begin broad backend build until the state is `backend-broad-build-approved`.

## Execute the flow

### 1. Discover and classify

Inspect the real codebase, commands, interfaces, schemas, migrations, deployment, rollback, auth, tenancy, telemetry, SLOs, and conventions. Record facts separately from inference and assumptions. Classify mode, complexity, criticality, affected protocols, data risk, security risk, operational risk, and gate applicability.

Classify technology in `backend-change-manifest.json#technology` before design. New production runtimes default to `rust-axum-default`; HTTP then requires Axum and non-HTTP workers/jobs use `httpFramework=not-applicable`. Existing runtimes use `preserve-existing`; migration to Rust requires explicit migration mode/design. Disposable nonproduction work uses `task-fit-nonproduction`. An `approved-exception` requires a technical reason class, alternative, justification, decision reference, and evidence references. A 1.2 manifest reopened for current work must be migrated explicitly to 1.3.0; never silently add defaults.

### 2. Contract and model

Identify the protocol's machine-readable source of truth. Never treat Swagger UI as the contract. Read [references/contracts-and-documentation.md](references/contracts-and-documentation.md).

Every interface is an instance of the language-agnostic **Interface Contract** abstraction — the backend's implementation language is never relevant to the consumer. Declare `kind`, `contractType` (the canonical adapter: OpenAPI/AsyncAPI/GraphQL-SDL/Protobuf/Arazzo/custom), and `authorityMode` (design-first/code-first-exported/external-provider) for every `manifest.interfaces[]` entry. Read [references/interface-contract.md](references/interface-contract.md) before declaring any interface.

Model business invariants and data ownership before choosing layers. Put validation and constraints at the authority that can guarantee them. Read [references/modeling-and-boundaries.md](references/modeling-and-boundaries.md) for boundary and YAGNI rules.

### 3. Threats, reliability, and observability

Validate every trust boundary. Enforce authorization at resource access, deny by default, and prove tenant isolation where applicable. Read [references/security.md](references/security.md).

For each applicable protected resource boundary, populate `backend-change-manifest.json#security.boundaries` with `trustBoundary`, `resource`, `identitySource`, `tenantBinding`, `authorizationPoint`, and executable `negativeTestIds`. Preparatory placeholders are allowed only before the material security/broad-build boundary; a material security/tenancy change or `backend-broad-build-approved` state requires concrete values.

Define timeouts, retry eligibility, idempotency, concurrency, recovery, SLI/SLO evidence, logs, metrics, traces, audit events, and sensitive-data policy only to the depth justified by risk. Read [references/reliability-observability.md](references/reliability-observability.md).

Every external dependency is represented in `reliability.externalDependencies[]` with `dependency`, concrete `timeout`, bounded `retry`, `transientOnly`, `idempotency`, `failureMode`, and evidence. Retries beyond the first attempt are allowed only for plausibly transient failures; `idempotency=unsafe` forbids retry. `integration` mode must declare at least one external dependency.

### 4. Plan and build

Use TDD against frozen acceptance contracts. Confirm RED before GREEN. Preserve the existing framework, database, router, query layer, messaging layer, deployment model, and test runner unless migration is explicitly approved.

When `technology.selection=rust-axum-default`, invoke `rust-pro` as a hard-required specialist and use Context7/current official docs for APIs and versions. Require the real project commands for formatting check, `cargo check`, Clippy with warnings blocking, and tests. Treat nextest, SQLx prepare, audit/deny, property, mutation, fuzz and load as conditional on configured tooling and applicable risk/NFR.

Do not introduce a repository, adapter, use-case layer, cache, queue, sharding, microservice, or generic abstraction without a named pain, boundary, NFR, or acceptance requirement. Prefer the smallest cohesive change that satisfies the contract.

Do not weaken tests to obtain GREEN. `testIntegrity.contractualCoverage` may only remain `preserved` or become `increased`. Before closing a backend change, compare the declared test paths against an **explicit** review baseline with `audit-test-integrity.mjs`; never guess the baseline. The deterministic hard block is deliberately narrow: declared test-file deletion, newly added skip/disable/focus markers, net removal of assertion-like lines, or disappearance of stable contract-linked test IDs. Treat broader judgments about test quality as review findings, not regex-enforced truth.

For `mode=repair`, repair the authority rather than only the symptom. `repairTrace` must record:

```text
finding → systemicCause → canonicalAuthorityRef → repairEvidencePaths → regressionTestIds
```

Do not classify SOLID preferences, pattern selection, abstraction style, or aesthetic notions of elegance as standalone hard failures. They remain contextual review criteria unless a canonical contract, measurable NFR, or registered rule makes the issue objective.

### 5. Verify, review, and report

Run real project commands. Record `passed`, `failed`, `partial`, or `not-run`; `not-run` requires the attempted command or probe and the concrete limitation.

Review contract drift, authorization and BOLA/IDOR, tenant isolation, invariants, migration safety, concurrency, retries, timeouts, dependency failure, telemetry, sensitive data, SLO evidence, test-integrity evidence, repair trace when applicable, and speculative complexity.

Report the decision and unresolved risks. Never claim broad-build approval without the required evidence and, when applicable, named human approval.

## Artifacts and scripts

Keep each current feature's backend control surface in `docs/backend/<feature-slug>/`, referencing existing sources in `openapi/`, `proto/`, `docs/api/`, or equivalent rather than moving or duplicating them. A legacy global package directly under `docs/backend/` remains readable for historical work, but a new feature must not overwrite it or another feature's package.

Start from:

- [assets/backend-change-manifest.template.json](assets/backend-change-manifest.template.json)
- [assets/backend-interface-scenario-matrix.template.md](assets/backend-interface-scenario-matrix.template.md)
- [assets/backend-readiness.template.md](assets/backend-readiness.template.md)
- [assets/backend-representative-scorecard.template.json](assets/backend-representative-scorecard.template.json)

Validate and audit with:

```bash
node scripts/prepare-backend-representative-gate.mjs --root . --feature FEATURE_SLUG
node scripts/validate-backend-package.mjs docs/backend/FEATURE_SLUG/backend-change-manifest.json --root .
node scripts/audit-backend-representative-gate.mjs docs/backend/FEATURE_SLUG/backend-change-manifest.json --root . --run-contract-validators
node scripts/audit-test-integrity.mjs \
  --root . \
  --manifest docs/backend/FEATURE_SLUG/backend-change-manifest.json \
  --base <EXPLICIT_BASELINE_REF> \
  --output docs/backend/FEATURE_SLUG/evidence/test-integrity.json
```

`prepare` refuses to overwrite existing artifacts. The validators have no external runtime dependencies. The audit executes contract validators only with the explicit `--run-contract-validators` flag, retains command output, and binds evidence to the contract SHA-256. Later audits reject missing or stale evidence. Gate and human-approval applicability come from structured boolean conditions, never free-text matching. The test-integrity audit requires an explicit Git baseline because silently choosing one could hide contractual test regressions.

## Skill routing

This skill owns orchestration, not every specialist decision. Use [references/authority-routing.md](references/authority-routing.md) to invoke only relevant authorities. Local architecture and actual toolchain evidence outrank generic examples.
