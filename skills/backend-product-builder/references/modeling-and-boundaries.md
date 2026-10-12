# Modeling, data, and boundaries

## Authority-first modeling

- Validate syntax and shape at ingress.
- Enforce authorization where the resource is accessed.
- Enforce domain invariants inside the domain authority.
- Enforce cross-process uniqueness, referential integrity, and concurrent-state constraints in the durable authority, usually the database.
- Reject invalid state rather than relying on documentation or UI behavior.

## Boundary evidence

A boundary is justified by at least one observed concern: ownership, trust, consistency, failure isolation, deployment independence, regulatory isolation, incompatible scaling profile, or independently evolving capability. Record the concern and the cost introduced.

Use DDD only when domain language, invariants, and competing models are genuinely complex. Use tactical patterns only for the model that benefits. Clean Architecture is an option for controlling costly dependency direction, not a mandatory directory template.

## Persistence and migration

Preserve compatibility across rolling versions. Prefer expand/contract for online migrations. Define backup and rollback where safe; otherwise define forward recovery, reconciliation, and an abort threshold. Test schema and data migrations against representative data and verify application compatibility on both sides of the transition.

Never add repositories, data mappers, unit-of-work wrappers, caches, queues, event buses, sharding, replicas, or microservices without a named requirement or measured pain. Existing abstractions may remain when they are project conventions.
