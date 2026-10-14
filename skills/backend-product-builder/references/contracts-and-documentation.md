# Contracts and backend documentation

## Sources of truth

Use the protocol-specific machine-readable contract already adopted by the project:

- HTTP/REST: OpenAPI. Greenfield uses the newest version supported by the actual validator and toolchain; never migrate silently merely because a newer specification exists.
- Events: AsyncAPI when already present or when adoption is explicitly approved.
- GraphQL: SDL/schema plus applicable persisted-operation contracts.
- gRPC: `.proto` definitions.
- Jobs/CLI: explicit input, output, exit status, retries, side effects, and operational invocation contract.

Swagger UI and similar tools are renderers. They never replace the underlying contract. Keep contracts in their existing locations and point `docs/backend/` to them.

This matrix is the concrete instance of the language-agnostic **Interface
Contract** abstraction (`references/interface-contract.md`): the backend's
implementation language never appears at this boundary, only `kind` (what
shape of interface) and `contractType` (which adapter describes it —
OpenAPI/AsyncAPI/GraphQL-SDL/Protobuf/Arazzo/custom). Also declare
`authorityMode` (design-first/code-first-exported/external-provider) —
never leave which mode governs an interface implicit.

## Operation or message contract

Every affected operation or message records:

1. stable identifier, purpose, owner, and consumer;
2. authentication, authorization, tenant, ownership, and privilege rules;
3. parameters/payload, constraints, content type, and representative examples;
4. success plus applicable validation, authn, authz, not-found/privacy, conflict, rate-limit, dependency, and internal failures;
5. RFC 9457 problem details when compatible with the existing HTTP error model;
6. idempotency, concurrency, ordering, transaction, side effects, and audit events;
7. rate limit, timeout, retry, and deprecation/compatibility policy when present;
8. trace link `REQ → AC → SCN → AT → operation/message`;
9. identifier language per `rules.md#backend-como-produto`: domain identifiers (route segments, payload keys, table/column names, domain enum values, domain error codes) are pt-BR in ASCII `snake_case` — `/api/v1/pedidos`, `criado_em`, `valor_total`, `aguardando_pagamento`, `PEDIDO_NAO_ENCONTRADO`. Technical and protocol vocabulary stays English — `page`, `limit`, `cursor`, `offset`, `tenant`, HTTP semantics, headers, `DATABASE_URL`. Control-plane governance enums and IDs (`internal|partner|public`, `REQ-`/`AC-`/`SCN-`/`AT-`) never change. `audit-naming-language.mjs` enforces the domain layer.

The backend manifest classifies each interface as `internal|partner|public` and its change as `unchanged|compatible|breaking|new`. A changed partner/public interface automatically activates the public-contract representative and human-approval conditions; narrative wording cannot suppress it. Data and security sections similarly expose `materialChange`, which must agree with their gate conditions.

## Scenario matrix

The IDL describes structure; Gherkin and executable acceptance tests describe behavior. Maintain a scenario matrix linking each changed operation/message to positive, negative, abuse, compatibility, and recovery scenarios. Mark a dimension `N/A` only with a concrete reason.

Contract drift blocks the backend gate. Documentation and code change together.

## Content-origin mode

When an operation exposes generated content — a real model, a deterministic/simulated provider, or synthetic fixture data — its origin mode is a literal value in the data contract (e.g. `mode: "live-model" | "deterministic-fixture" | "synthetic-demo"`), never only a display string in the frontend. Swapping the provider without updating that literal must fail a build/test or emit a verifiable runtime warning, so a demo/simulated provider cannot silently keep serving traffic labeled as if it were the real one.
