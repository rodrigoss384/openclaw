# Specialist authority routing

Invoke only authorities justified by the change:

| Condition | Authority |
|---|---|
| Every material backend change | `backend-product-builder` |
| `technology.selection=rust-axum-default` | `rust-pro` hard-required; `context7-mcp` for current Rust/Axum/Tokio/SQLx APIs |
| Other explicit technology selections | Only the specialist for the technology actually selected; never route `rust-pro` as authority by default |
| HTTP, GraphQL, gRPC, events, jobs, or CLI contract | `api-patterns`; `context7-mcp` and official docs for the actual technology |
| Material boundary or architectural decision | `architecture` |
| Quantified scale or distributed-system behavior | `system-design` |
| Persistence, schema, transaction, or migration | `database-design` |
| Genuinely complex domain | `domain-driven-design`; `tactical-ddd` only for the model |
| Complex modular platform | `evolutionary-modular-architecture` |
| Auth, authorization, tenancy, sensitive data, or public API | `vulnerability-scanner` plus versioned official controls |
| Contract, integration, persistence, or migration testing | `testing-patterns` plus `tdd-workflow` |
| Migration, deployment, or recovery | `deployment-procedures` |
| Existing Docker, Elastic, framework, database, or cloud stack | matching stack skill only when discovered |

Do not use `backend-dev-guidelines` as universal authority: it is opinionated around a particular Node/Express/Prisma/Sentry shape. Do not route backend performance to browser/Core Web Vitals guidance. Do not require Elastic observability outside Elastic projects. Narrative documentation skills do not replace executable contracts.
