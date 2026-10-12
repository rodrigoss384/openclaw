# Persistence and reliability

## SQLx when applicable

Select PostgreSQL/SQLx only from actual persistence requirements. When used:

- Keep migrations versioned and compatible with the rollout plan; use expand/contract or explicit forward recovery where mixed versions can coexist.
- Bind transactions to the operation that owns the invariant. Pass the transaction/executor explicitly instead of hiding it behind global state.
- Prefer compile-time checked queries when the environment supports them.
- If CI cannot reach a database, use the official SQLx offline metadata workflow and run the project's `cargo sqlx prepare --check` equivalent. Never commit stale metadata or claim offline checking without generating it against the current schema/query set.
- Use `#[sqlx::test]` or the project's isolated database harness for integration behavior; keep fixture ownership and cleanup deterministic.
- Test unique/foreign-key/check constraints, serialization conflicts and rollback/forward recovery at the database boundary when those invariants depend on the database.

Do not create a generic repository trait for a single SQLx implementation. Extract a narrow consumer-owned port only when it represents a real boundary.

## External dependencies

Every dependency call needs a concrete timeout. Retries must be bounded, back off and target only transient, safe/idempotent operations. Avoid layered retries. Decide the failure mode—surface, fail closed, degrade, queue or retry later—from the accepted contract and retain evidence.

Use typed clients around external protocols when they centralize contract, authentication, timeout and error mapping. Do not build a universal HTTP client abstraction.

## Cancellation and partial effects

An async operation can be dropped at any `.await`. Design side effects so cancellation is safe:

- commit atomic state changes inside a transaction;
- use idempotency keys or durable handoff for externally visible operations;
- distinguish request-scoped work from background work whose ownership must survive the request;
- propagate deadlines/cancellation rather than spawning unbounded detached tasks.

## Observability

Instrument stable operation names and domain-relevant outcomes with `tracing`. Correlation/request IDs must propagate across supported boundaries. Metrics and traces are required only when an operational destination and ownership exist; otherwise record a concrete adoption gap, not pretend telemetry.

Never log secrets, access tokens, raw credentials or disallowed personal data. Keep high-cardinality identifiers out of metric labels. Tie SLO/alert claims to actual signals and runbooks.
