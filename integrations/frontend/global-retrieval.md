# Phase 10C — Global Retrieval Applicability Contract

## Purpose

Make global retrieval an explicit product decision instead of an assumed UI convention.

The contract answers:

1. whether cross-product retrieval is `required`, `optional`, or `not-applicable`;
2. whether an optional capability is intentionally absent or implemented;
3. which entity types may participate when implemented;
4. how users can invoke implemented retrieval without mandating a specific shortcut;
5. which frontend result states and accessibility guarantees are required when implemented;
6. which backend contract proves authorization, tenant isolation, limits, ranking, timeout and sensitive-data handling when implemented.

## Authority model

This phase does not make search UI or a command palette a new source of product truth.

Authority remains layered:

- `docs/frontend/product-context.md` owns approved jobs, journeys, information architecture, permissions and frequency evidence;
- `docs/frontend/global-retrieval.json` is the executable applicability projection;
- the application-shell screen spec consumes that projection through `architecture.integrationContracts` when a global retrieval runtime is implemented or when the product intentionally records the decision there;
- `docs/backend/global-retrieval-contract.json` is a retrieval-specific backend integration contract only when retrieval is implemented and must point to real API/auth/test/policy evidence;
- Design System / Impeccable own visual craft only and cannot decide that global retrieval exists;
- the Autonomy Controller cannot invent product-wide search, entity coverage, authorization scope, commercial behavior, or a shortcut as a substitute for unresolved product semantics.

## Applicability rule

The validator derives applicability from four explicit, evidence-backed signals:

- `transversalRetrieval`
- `multipleEntityTypes`
- `recurringQuickFind`
- `operationalHighFrequency`

Derivation:

```text
required = transversalRetrieval
        && multipleEntityTypes
        && (recurringQuickFind || operationalHighFrequency)

not-applicable = all signals false

optional = every other combination
```

Each true signal requires an evidence entry with a repository-resolvable `sourceRef`. The validator never infers task frequency or transversal retrieval from prose.

## Required retrieval

`required` always means an implemented global retrieval runtime.

It requires:

- application-shell binding;
- at least one searchable entity type, and at least two when `multipleEntityTypes=true`;
- a concrete invocation mode;
- discoverable global entry;
- accessible trigger;
- focus-management contract;
- full loading/empty/error/results contract;
- backend-authoritative authorization mode;
- backend retrieval contract.

No `required` path may use the optional-absence representation.

## Optional retrieval

`optional` is a product applicability decision, not an instruction to fabricate a global search runtime.

Two states are valid.

### Optional and intentionally absent

```text
applicability = optional
invocation.mode = none
searchableEntityTypes = []
shortcut = null
authorizationMode = not-applicable
resultContract = null
backendContractRef = null
```

All invocation booleans are false. The applicability evidence remains mandatory, but no command palette, trigger, result UI or backend capability is invented.

### Optional and implemented

Once optional retrieval is actually implemented, it is held to the same runtime guarantees as `required`: shell binding, authorized entities, accessible/focus-managed invocation, result states and backend retrieval guarantees.

This split is enforced by the Phase 10F closure matrix.

## Invocation

Implemented retrieval allows:

- `global-header`
- `command-menu`
- `dedicated-route`
- `hybrid`

`shortcut` is nullable and deliberately not restricted to `Cmd+K` / `Mod+K`. A keyboard shortcut is an implementation choice only when approved by the relevant product/accessibility context.

Absent optional retrieval and not-applicable retrieval use `invocation.mode=none` and no shortcut.

## Searchable entity types

Each implemented searchable entity declares:

- stable `id`;
- user-facing `label`;
- authoritative `sourceRef`;
- application-shell `capabilityRef`;
- sensitivity classification.

Implemented entities must map to application-shell permissions that are `allowed` or `read-only`. Backend authorization remains authoritative at query/result time; frontend inclusion never grants access.

## Result contract

Implemented retrieval must cover:

- `loading`
- `empty`
- `error`
- `results`

and expose semantic result fields for:

- entity type;
- primary label;
- destination.

The contract forbids authorization leakage and requires result announcements. It does not mandate a particular component, visual layout, route architecture, or command-palette library.

## Backend contract

When retrieval is implemented, `backendContractRef` is mandatory and must validate against `global-retrieval-backend.schema.json`.

Required guarantees:

- authentication;
- backend-authoritative authorization mode;
- tenant isolation and negative-test evidence;
- bounded query/result/rate limits;
- explicit ranking strategy and deterministic tie-break;
- concrete timeout;
- sensitive-data policy/redaction behavior;
- integration/contract evidence refs.

The backend contract points to existing authoritative API, auth, security, test and policy artifacts rather than replacing them.

## Not applicable

`not-applicable` is a first-class decision, not absence of work.

It requires:

- all four applicability signals false;
- explicit not-applicable evidence;
- no searchable entity types;
- `invocation.mode=none`;
- no shortcut;
- no result contract;
- no backend retrieval contract.

If an application-shell reference is present for provenance, its identity/product-context relationship is still validated; it does not authorize an active retrieval affordance.

## Runtime command

```bash
node integrations/frontend/global-retrieval.mjs check \
  --root <project-root> \
  --contract docs/frontend/global-retrieval.json
```

The same boundary is consumed by design-readiness, implementation, frontend representative validation and evidence-release.

## Non-goals

Phase 10C does not:

- require Cmd+K / Mod+K;
- require a command palette;
- require global retrieval for every application;
- turn `optional` into `required`;
- invent a backend capability for optional absence;
- define visual styling;
- invent new entity types or permissions;
- replace OpenAPI/GraphQL/service contracts;
- weaken backend authorization or tenant isolation;
- add a human gate;
- auto-approve a product-navigation/search decision.
