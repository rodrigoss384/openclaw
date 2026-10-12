# Stack selection and architecture

## Decide from context

The backend manifest is authoritative:

| Runtime context | Valid selection | Meaning |
|---|---|---|
| `new-production-runtime` | `rust-axum-default` | Rust; Axum only when HTTP exists |
| `new-production-runtime` | `approved-exception` | Evidence-backed alternative |
| `existing-runtime` | `preserve-existing` | Keep observed stack |
| `existing-runtime` + explicit migration | `rust-axum-default` | Migration is designed, never inferred |
| `disposable-nonproduction` | `task-fit-nonproduction` | Optimize for bounded task and disposal |

Rust is a default for new production runtime ownership, not a reason to rewrite a working backend. Exceptions should be rare but ordinary governance: specialized ecosystem, mandatory vendor SDK, platform constraint, operational interoperability or measured NFR may outweigh the default when evidence supports it.

## Boring Rust architecture

Start with one deployable and cohesive modules by feature. A typical feature may contain transport, application behavior, domain values and infrastructure adapters, but these are responsibilities rather than mandatory layers.

- Use concrete structs/functions until a real substitution boundary exists.
- Introduce a trait at the consumer-owned boundary only when there are multiple implementations, a stable external seam or a test double that cannot be expressed more directly.
- Keep domain values independent of Axum/SQLx types where that protects invariants; do not mirror every table or request into ceremonial DTO layers.
- Prefer newtypes/enums for identifiers, lifecycle states and constrained values.
- Choose ownership to match lifecycle. Clone handles intentionally; do not clone payload graphs to bypass a design problem.

## Dependency baseline

Use only applicable crates and current official docs:

- Tokio for asynchronous I/O and task runtime.
- Axum for HTTP; Tower/tower-http for service middleware.
- Serde for boundary serialization.
- `tracing` plus the project's subscriber/export layer.
- `thiserror` for typed library/domain/application errors; `anyhow` may be suitable at binary composition/startup boundaries, not as an untyped public contract.
- SQLx only when relational persistence is selected and its compile-time/offline workflow fits the project.

Pin the toolchain explicitly and commit `Cargo.lock` for deployed applications. Centralize workspace lint policy where a workspace exists. Features should be minimal and intentional to control build surface and attack surface.
