# Reliability, scale, and observability

## Reliability

Every external call has an explicit timeout appropriate to the caller's budget. Retry only when the operation is safe or idempotent and the failure is plausibly transient. Bound attempts, use backoff and jitter when supported, and prevent retry multiplication across layers.

Define applicable behavior for cancellation, partial failure, circuit breaking, backpressure, deduplication, ordering, dead-letter/reconciliation, concurrent updates, and graceful degradation. Do not introduce these mechanisms without a failure mode or NFR that needs them.

### Structured external dependency contract

`docs/backend/backend-change-manifest.json#reliability.externalDependencies` is the machine-readable owner for runtime calls to external systems. For each dependency declare:

```text
dependency
timeout
retry.maxAttempts
retry.backoff
transientOnly
idempotency
failureMode
evidence
```

Use these invariants:

- `timeout` is concrete and scoped to the caller budget rather than an unbounded/default timeout;
- attempts beyond the initial call require `transientOnly=true`;
- retries are forbidden when `idempotency=unsafe`;
- `retry.maxAttempts` is bounded and the backoff strategy is explicit;
- degradation, deferred processing, or retry-later behavior requires evidence proving the selected failure mode;
- prose summaries in `reliability.timeouts|retries|idempotency` remain useful context, but they do not replace structured dependency entries;
- `integration` mode requires at least one external dependency entry.

The contract describes behavior, not a mandate to introduce a circuit breaker, queue, cache, or other mechanism. Add mechanisms only when a concrete failure mode or NFR requires them.

## Scale

Translate scale claims into workload and SLO numbers: throughput, concurrency, payload/data size, growth, availability target, latency percentile, recovery objective, and cost constraint. Optimize after measurement. Cache, queue, shard, replicate, or split services only when evidence shows the need and invalidation/consistency/failure costs are accepted.

## Observability

Choose signals that answer operational questions:

- structured logs with correlation and stable event names;
- metrics for request/work rate, errors, saturation, dependencies, and domain-critical outcomes;
- traces across material distributed boundaries when tracing exists;
- immutable audit events for security or business accountability where required;
- documented redaction, retention, cardinality, and sensitive-data policy.

Tie SLI/SLO claims to actual telemetry or mark them as planned. OpenTelemetry is a signal model and interoperability route, not a mandate to replace an existing working telemetry stack.
