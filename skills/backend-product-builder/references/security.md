# Backend security contract

Use the versioned security baseline approved by the project. For new work, consult current official OWASP ASVS and OWASP API Security guidance; do not copy an unversioned checklist into the repository.

## Required reasoning

- Identify actors, credentials, assets, trust boundaries, resource identifiers, tenant context, ownership, and privilege changes.
- Authenticate before privileged work and fail closed.
- Authorize at resource access, not only at routing or presentation boundaries.
- Deny by default and use allowlists for permitted operations/fields when practical.
- Bind queries and mutations to the authenticated tenant/owner context; do not trust tenant IDs supplied by callers.
- Test BOLA/IDOR, function-level authorization, property-level authorization, mass assignment, rate/resource exhaustion, injection, SSRF, unsafe consumption, and sensitive-data exposure when applicable.
- Validate inputs from users, files, messages, webhooks, databases, caches, and third-party APIs at their trust boundary.
- Never log secrets, credentials, tokens, raw sensitive payloads, or disallowed PII.

Security controls must have executable or tool evidence when the project supports it. SAST, DAST, dependency scans, mutation tests, or fuzzing become mandatory only when a real tool exists or adoption is explicitly approved for justified criticality. Otherwise record the attempted probe as `not-run`.

## Structured security and tenancy boundary

`docs/backend/backend-change-manifest.json#security.boundaries` is the machine-readable owner for material backend trust/resource boundaries. Keep the prose fields (`authentication`, `authorization`, `tenancy`, `sensitiveData`) as human-readable explanation, but do not use them as a substitute for the structured contract.

Each applicable boundary declares:

```text
trustBoundary
resource
identitySource
tenantBinding
authorizationPoint
negativeTestIds
```

The contract means:

- `trustBoundary` identifies where untrusted or differently trusted input crosses into protected work;
- `resource` names the object/capability whose access is being decided;
- `identitySource` identifies the authenticated identity authority used by the decision;
- `tenantBinding` states how owner/tenant scope is derived from trusted identity/context rather than caller-supplied identifiers;
- `authorizationPoint` identifies the actual enforcement point at resource access;
- `negativeTestIds` prove denial/isolation behavior and must include at least one negative regression for the boundary.

Preparatory manifests may carry unresolved template values while the representative slice is still being designed. A material security/tenancy change or `backend-broad-build-approved` state requires concrete values; placeholder boundary text is not release evidence.

## Autonomous agent/machine consumers

Treat "an autonomous agent or MCP client" as a distinct consumer class in the trust boundary, alongside users, files, messages, webhooks, databases, caches, and third-party APIs — not folded into "API consumer" generically.

- Every operation exposed to this consumer class declares a structured, machine-readable annotation (at minimum: read-only vs. mutating, idempotent vs. not, open-world vs. closed-world) that the consumer can inspect before calling — not only prose in a scenario matrix.
- Do not expose a mutating operation to an autonomous-agent consumer without explicit human approval recorded for that exposure; default to read-only.
- When the served data is a snapshot distinct from live session/request state (common for an agent-facing read surface), mark the staleness/lag explicitly rather than letting the consumer assume freshness.
- The same tenant/owner-binding and authorization rules above apply unchanged to this consumer class; an agent-facing lookup by object id still must bind to the authenticated identity's tenant/ownership context, never trust an id supplied by the caller as sufficient scope.
