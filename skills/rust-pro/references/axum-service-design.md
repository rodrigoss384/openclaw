# Axum service design

Before using an API or feature flag, query Context7 and official Axum/Tower/Tokio documentation for the project's pinned versions.

## Composition

- Compose `Router`s by feature and merge/nest them at the application boundary.
- Apply the concrete state with `Router::with_state`; extract it with `State<T>`.
- Use extractors to make transport requirements explicit. Keep request parsing/validation separate from business invariants.
- Return `IntoResponse` from transport adapters while keeping internal operations typed as domain/application `Result` values.
- Use Tower `ServiceBuilder` when middleware order matters and keep that order reviewable.
- Middleware/services that can fail must map their error deliberately, commonly with `HandleErrorLayer` at the correct layer boundary.

## Error contract

Define a stable public error envelope when the interface contract requires it. Map error categories to status codes centrally enough to prevent drift, but do not make one global error enum absorb unrelated domains. Preserve source errors for diagnostics and redact secrets/PII from both responses and telemetry.

Avoid panics in request paths. A poisoned internal invariant should become a controlled failure or process-level policy, not an accidental `unwrap` response.

## Naming and serialization language

Domain identifiers are pt-BR in ASCII `snake_case` per `rules.md#backend-como-produto`:
`struct Pedido { cliente_id, valor_total, situacao, criado_em }`, route
`/api/v1/pedidos`, error code `PEDIDO_NAO_ENCONTRADO`. Technical and protocol
vocabulary stays English: `page`, `limit`, `cursor`, `offset`, `tenant`, HTTP
semantics, `DATABASE_URL`, `RUST_LOG`, and infrastructure modules
(`app.rs`, `config.rs`, `error.rs`, `state.rs`, `AppError::NotFound`).

ASCII pt-BR names are valid Rust identifiers, so they need no `#[serde(rename)]`.
Keep the Rust field, the serde key and the OpenAPI property as one triple; reach for
`#[serde(rename_all)]` or a per-field `rename` only when the wire key genuinely
cannot equal the Rust identifier, and record that divergence in the interface
contract rather than leaving it implicit.

## State and concurrency

Prefer state containing clone-cheap clients/pools and immutable configuration. `Arc` is appropriate for shared ownership, not proof that shared mutation is correct. Before adding `Mutex`/`RwLock`, ask whether ownership can be moved to one task, a channel, a database transaction or an atomic value with a documented invariant.

Never hold synchronous locks across `.await`. Bound concurrency for external dependencies and expensive work. Treat request cancellation as expected: dropping a future must not leave an unowned partial side effect.

## Lifecycle

- Bind/listen using the project's Axum/Tokio pattern and attach graceful shutdown to the server future.
- Stop accepting work, propagate cancellation, drain bounded in-flight work and close resources in an explicit order.
- Track spawned tasks (`JoinSet`, owned handles or the project's supervisor). Observe task failures; do not fire-and-forget critical work.
- Use `spawn_blocking` only for bounded blocking work and account for cancellation limitations.

## HTTP concerns

Contract first: routes, extractors, status codes, headers and error bodies must match OpenAPI/custom authority. Apply request IDs, tracing spans, body limits, timeouts, CORS and sensitive header handling only as required by the threat/reliability model. Authentication in middleware does not replace resource authorization at the access point.
