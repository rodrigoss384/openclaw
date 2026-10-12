---
name: rust-pro
description: Implement and review production Rust backends under the Spec-Driven Engineering workflow, with Axum for selected HTTP runtimes, Tokio for applicable async I/O, boring explicit design, and evidence-based quality gates. Use when backend-change-manifest technology.selection is rust-axum-default or when an existing Rust codebase is explicitly in scope.
---

# Rust + Axum Backend Engineer

Build maintainable Rust services that make invalid states difficult to represent and operational failure easy to diagnose. Prefer clear ownership, concrete types and cohesive feature modules over clever type machinery or framework-shaped ceremony.

## Entry contract

Read the current `docs/backend/backend-change-manifest.json` and the feature's frozen artifacts before choosing crates or architecture.

- If `technology.selection=rust-axum-default`, this skill is hard-required.
- If `technology.selection=preserve-existing`, preserve the observed Rust or non-Rust stack; do not migrate by inference.
- If `technology.selection=task-fit-nonproduction`, use the declared task-fit stack.
- If `technology.selection=approved-exception`, implement the approved alternative and do not route this skill as its authority.

For APIs, versions, feature flags, configuration or migration advice, query Context7 and the current official project documentation. Never rely on a hard-coded generic minimum version or vague freshness labels. The repository's pinned toolchain and lockfile are authoritative.

Read references progressively:

1. Always read [references/stack-selection.md](references/stack-selection.md).
2. For HTTP, read [references/axum-service-design.md](references/axum-service-design.md).
3. For persistence, external I/O, concurrency or recovery, read [references/data-reliability.md](references/data-reliability.md).
4. Before implementation and review, read [references/quality-gates.md](references/quality-gates.md).

## Default production profile

When selected by the manifest:

- Rust language with a pinned `rust-toolchain.toml` (or equivalent repository toolchain contract) and committed `Cargo.lock` for deployed binaries.
- Axum for HTTP, Tokio for applicable async I/O, Tower/tower-http for middleware, Serde at serialization boundaries, `tracing` for structured diagnostics and `thiserror` for typed domain/application errors.
- A cohesive modular monolith organized by feature/capability unless measured constraints justify another topology.
- `unsafe` forbidden by default. Any approved exception must isolate the boundary, state safety invariants, add focused tests and receive adversarial review.
- Production `unwrap`/`expect` governed by Clippy/lints and review, with only narrow justified cases such as provably irrecoverable startup configuration. Tests may use them where the failure improves the test signal.

PostgreSQL/SQLx, OpenTelemetry/Prometheus, `nextest`, `cargo audit`, `cargo deny`, property tests, mutation, fuzzing and load tests are conditional. Require them only when the project uses them or risk/NFR plus an explicit adoption decision makes them applicable.

## Implementation discipline

- Start from the frozen behavior and interface contract, then model domain values and error semantics.
- Keep Axum handlers thin: extract/validate transport input, call a cohesive application/domain operation, map the result into a response.
- Share application state with `Router::with_state`/`State`; prefer immutable, clone-cheap handles to indiscriminate shared mutable state.
- Treat cancellation and shutdown as normal control flow. Do not detach tasks whose lifecycle, errors or ownership are unobserved.
- Move blocking CPU/filesystem/legacy work off async executor threads with the project's bounded `spawn_blocking` strategy.
- Preserve error sources internally while returning stable, non-sensitive public errors. Middleware errors must be converted deliberately at the Tower boundary.
- Keep database transactions at the use-case boundary that owns the invariant. Do not invent a repository trait around one implementation.

## Agent-specific prohibitions

Do not:

- create an abstraction with a single implementation merely to look testable;
- add clones only to silence borrow-checker errors without understanding ownership;
- wrap state in `Arc<Mutex<_>>` by reflex;
- use macros, blanket traits, GATs, lock-free structures, custom allocators or runtime magic without a measured need;
- hide a blocking operation inside async code;
- introduce a service split, event bus, cache or generic framework without acceptance/NFR evidence;
- weaken tests, add skips or replace a contract test with a mock-only assertion to obtain GREEN.

## Required evidence

Use the project's real commands. For a normal Rust selection, the minimum expected gates are formatting check, `cargo check`, Clippy with warnings blocking, and tests. Record exact command, cwd, exit code and result in backend evidence. If the local environment lacks Rust, report `not-run` with the failed probe; never fabricate a pass or create a fictitious service just to exercise the skill.

Finish through `backend-product-builder`: contract drift, representative slice, hardening, adversarial review and evidence release remain owned by the workflow rather than this specialist skill.
