# Data and Forms

## Purpose

Define the mechanical contract for how data actually flows through the
frontend and how forms actually behave.

`references/03-frontend-architecture.md` owns ownership and boundaries:
which layer holds server state, where DTOs are validated, which module owns
error normalization. This document owns the concrete mechanics inside those
boundaries: query-key conventions, mutation lifecycle, the DTO→model
pipeline, generated-client drift policy, form validation timing, upload
state, formatting conventions, and the operational error/auth contract that
connects to `lib/errors/` and `lib/auth/` in 03.

Read both. A screen-spec's `dataDependency` (see
`assets/schemas/screen-specification.schema.json`) must satisfy the
conventions declared here, not invent its own per screen.

---

## 1. Query architecture

### Query-key convention

Query keys are produced by one exported factory per feature, never
hand-typed inline at each call site:

```ts
export const caseKeys = {
  all: ["cases"] as const,
  list: (filters: CaseListFilters) => [...caseKeys.all, "list", filters] as const,
  detail: (caseId: string) => [...caseKeys.all, "detail", caseId] as const,
};
```

A key that encodes a filter/scope parameter must include every parameter
that changes the result set. Two call sites for the "same" query with
different key shapes is drift, not a stylistic difference.

### Default query behavior

Declare per project, not per screen:

- `staleTime` and garbage-collection time, with a documented default and
  named exceptions;
- refetch-on-focus/refetch-on-reconnect behavior;
- retry count and backoff for transient failures (see Error normalization,
  §9);
- network-mode behavior offline/degraded.

### Feature ownership

A query definition (key factory, fetcher, options) belongs to the feature
that owns the underlying entity. A different feature reads it through that
feature's public query hook, never by re-deriving the same key locally (see
`references/03-frontend-architecture.md`'s Public module APIs).

### Cancellation and background refresh

Interactive queries (search, filter, autocomplete) declare an explicit
cancellation/obsolete-request policy — an in-flight request superseded by a
newer one must not resolve into stale UI state.

Background refresh preserves usable content, scroll position, selection,
and in-progress form values. Do not replace an already-rendered screen with
a full skeleton on every background refetch; skeletons are for the initial
load only (see `SKILL.md` §14, Initial loading versus background refresh).

---

## 2. Mutation architecture

Every mutation declares, as part of its `dataDependency`/`action` contract:

| Concern | Requirement |
|---|---|
| Pending feedback | Disable the triggering control; show a pending indicator; never leave the primary action re-triggerable during its own pending state. |
| Success feedback | Derived from the authoritative response, never inferred from local optimistic state alone. |
| Error feedback | Normalized message (see §9); preserves entered values on recoverable failure. |
| Invalidation | Which query keys invalidate/refetch after success; declared explicitly, not left to a blanket invalidate-everything. |
| Optimistic updates | Only when the eventual-consistency window is safe for this action; the rollback path on failure is explicit. |
| Conflict handling | How a stale-base-version conflict surfaces to the user and what the resolution options are. |
| Duplicate submission | Prevented at the trigger (disabled control) and, for non-idempotent operations, at the request layer (idempotency key or equivalent). |
| Idempotency | Declared even when the honest answer is "not idempotent, duplicate risk mitigated by duplicate-submission prevention only." |
| Cancellation | Whether the mutation itself may be cancelled mid-flight, and the resulting state if so. |
| Mutability of target record | `mutable`, `append-only-linked`, or `versioned` — see below. |
| Guard checklist | Itemized, disjoint eligibility checks — see below. |
| Audit trail | Required for decision/approval/conflict-resolution mutations — see below. |

### Mutability of target record

Declare whether the entity a mutation targets may be overwritten in place
(`mutable`), must remain an immutable source-of-truth with every change
captured as a new linked record (`append-only-linked`), or is explicitly
versioned (`versioned`). Treat any evidentiary or audit-sensitive record — a
validated document, a signed artifact, a compliance record — as
`append-only-linked` by default; a "correction" to such a record is a new
linked record, never an in-place overwrite of the original. This mirrors
`dataDependency.mutabilityPolicy` in `screen-specification.schema.json`.

### Guard checklist and audit trail

When an action's eligibility depends on more than one condition (state,
role, assignee, required evidence, exclusivity, idempotency), implement the
guard logic once as a pure, exported function and import it in every
consumer that needs eligibility — a list-row quick action, a confirmation
dialog, a detail-view control — and in the mutation handler itself, which
re-invokes that same function immediately before mutating rather than
trusting a UI-computed flag. This mirrors `componentUsage.guardFunction` and
`action.guardChecks` in `screen-specification.schema.json`.

When an action's effect is a decision, approval, or conflict resolution,
record a durable audit entry — actor, timestamp, justification, result, and
a correlation id linking every touched object — before the action's success
state renders. A conflict resolution preserves the rejected alternative in
that entry; it is never silently discarded. This mirrors `action.auditTrail`
in the same schema, and `SKILL.md` §15 (Action and mutation rules).

---

## 3. DTO, validation, and mapping pipeline

The pipeline is fixed:

```text
transport response
        ↓
runtime validation (schema-checked)
        ↓
DTO (matches the wire contract exactly)
        ↓
mapper (pure function, one per DTO shape)
        ↓
frontend model (domain-shaped, camelCase, typed dates/enums)
        ↓
view model (presentation-shaped: formatted strings, derived labels)
        ↓
screen and components
```

The wire contract is pt-BR `snake_case` for domain fields
(`rules.md#backend-como-produto`); the frontend model keeps the JS/TS camelCase
convention **in pt-BR**, so the mapper renames case without translating meaning:
`criado_em → criadoEm`, `valor_total → valorTotal`, `cliente_id → clienteId`. Do not
reintroduce English domain names at this boundary, and leave technical/protocol
fields as they arrive (`page`, `limit`, `cursor`, `tenant`).

Rules:

- A component never parses `response.data.attributes[...]` or an
  equivalent raw transport shape directly; it receives a view model.
- The DTO type matches the wire contract, including nullability. Do not
  widen a nullable wire field to non-null in the DTO "to make the mapper
  simpler" — that hides a real absent-value case the mapper must handle.
- The mapper is a pure function with no side effects, no fetching, and no
  formatting; formatting is the view model's job.
- A frontend model uses real `Date`/enum/domain types; a view model uses
  display-ready strings and derived flags (`isOverdue`, `statusLabel`).
- Runtime validation failure on a response is a normalized error (§9), not
  a silent pass-through of unvalidated data.

---

## 4. Generated-client and contract-drift policy

This section is the consumer side of the language-agnostic **Interface
Contract** abstraction (`skills/backend-product-builder/references/interface-contract.md`):
the backend's implementation language is never relevant here, only which
contract adapter it publishes (OpenAPI, AsyncAPI, GraphQL SDL, Protobuf,
Arazzo for OpenAPI/AsyncAPI-composed workflows, or a project-specific
custom format).

When the backend publishes a machine-readable contract (OpenAPI, a GraphQL
schema, a `.proto`), the frontend consumes it through a generated
client/types layer, not hand-written DTOs re-typed from documentation:

```text
backend machine-readable contract
        ↓
generated TypeScript client/types
        ↓
transport adapter (auth, base URL, error normalization)
        ↓
runtime validation / DTO (§3)
```

Declare, per project:

- which generator produces the client/types, and where the output lives;
- that the generated output is not hand-edited (edits belong in the
  transport adapter or mapper, layers the generator does not own);
- a drift check: the contract changed and the generated output is stale is
  a failing check, not a warning, wherever the project has CI (see
  `rules.md`, "Institucionalização de Quality Gates em CI").

When no machine-readable contract exists yet, hand-written DTOs typed from
real response samples are the fallback — but promoting the backend to
publish one is a legitimate architecture recommendation, not scope creep,
once hand-typed DTO drift has actually caused a defect.

---

## 5. Forms architecture

For the default stack, React Hook Form owns form state and Zod owns runtime
validation schemas; a different approved stack substitutes equivalent
libraries under the same ownership rules.

- Shared form field components render label, control, help, and error; they
  do not own submission and do not call a mutation directly.
- Validation timing is declared per form (on blur, on change after first
  blur, on submit) and is consistent across a feature's forms — do not mix
  timing strategies within one screen without a documented reason.
- A server-side validation error is mapped to the specific field it
  concerns whenever the server response identifies one; a field-less server
  error surfaces as a form-level (not silently dropped) message.
- A recoverable submission failure preserves every entered value; the form
  is never reset because a mutation failed.
- A multi-step/wizard form owns its cross-step state as one form-state
  tree (or explicit per-step state with a declared merge point), never as
  independent, unsynchronized state per step.
- A file input inside a form follows the upload contract (§6) for the
  file's own lifecycle; the form field holds a reference/identifier once
  upload completes, not the raw file bytes in form state after submission.

---

## 6. Uploads

Generic upload components do not own transport, storage SDKs, signed-URL
generation, malware scanning, authorization, persisted deletion, or download
requests (see `SKILL.md` §20). This section owns the client-side state
machine around that boundary:

- upload state is one of `selected → queued → uploading → uploaded →
  processing → accepted | rejected | failed | unavailable`, never
  represented as a single boolean `isUploading`;
- upload progress is tracked per file, not as one aggregate percentage that
  hides which file is stalled;
- retry re-attempts the same file from its last known state, not a silent
  restart that discards progress feedback already shown to the user;
- a completed-but-not-yet-processed upload (e.g. awaiting virus scan) is a
  distinct state from `uploaded`, with its own user-facing explanation.

---

## 7. Dates, currency, and enum formatting

- All dates are stored and transported as ISO 8601 strings (or the
  project's declared equivalent — Temporal, epoch — but exactly one
  choice, never mixed); formatting to a locale-specific display string
  happens only in the view model (§3), through one shared formatter module,
  never via ad hoc `Date` string manipulation at the component.
- Time zone handling is explicit: declare whether the project displays in
  the viewer's local time zone, a fixed business time zone, or both
  side-by-side for time-sensitive domains (legal deadlines, scheduling).
  Silent, undeclared time zone conversion is a defect class, not a detail.
- Currency and number formatting goes through `Intl.NumberFormat` (or the
  project's equivalent), configured once per locale/currency pair, never
  string-concatenated symbols.
- Enum labels are mapped through one canonical, exported label map per
  enum, owned by the feature/entity that defines the enum — never
  re-derived per screen with a local `switch` that can drift from the
  canonical mapping (this is the same "single canonical selector" rule as
  `dataDependency.sharedSelectorId` in `screen-specification.schema.json`,
  applied to static label maps instead of computed values).
- Missing, not-applicable, not-calculated, and restricted-by-permission
  values each render a distinct, explicit label — never the same blank
  dash for all four, and never an empty string that reads as a rendering
  bug.

---

## 8. Error normalization and auth behavior

### AppError normalization

Every transport/runtime error normalizes into one shared `AppError` shape
(category, safe user message, technical detail retained only for logging)
before it reaches a component. Categories and their default handling:

| Category | Detection | Default user-facing behavior | Retry |
|---|---|---|---|
| Validation | Runtime schema/DTO check failed | Field-level or form-level message (§5) | No |
| Unauthorized (401) | Session/token invalid or expired | See "Authentication failure" below | No (after refresh attempt) |
| Forbidden (403) | Authenticated but not authorized | Authorization-path message; never a generic login redirect | No |
| Conflict | Version/state mismatch on write | Conflict-resolution UI (§2) | Manual |
| Rate limit | 429 or equivalent | Delayed-retry message with wait hint | Delayed |
| Network | Request failed before a response | Retry affordance; distinguishable from a server error | Conditional |
| Unknown | Unclassified failure | Generic safe message; full detail to logging/telemetry only | Conditional |

A query error renders a local, region-scoped error state with retry (see
`SKILL.md` §14, Partial failure) — it does not collapse the whole route. A
mutation failure surfaces inline or via a transient notification depending
on the action's visual weight, but never silently disappears.

### Authentication failure (401)

- Only a request that itself fails with 401 enters this path — a request
  merely in flight while a *different* request's 401 triggers a refresh is
  not, by that fact alone, eligible for replay. Never "refresh started →
  retry every in-flight authenticated request"; that replays whatever those
  requests were doing, including a mutation the backend may already have
  received and be executing.
- A 401 triggers at most one concurrent refresh attempt (single-flight);
  concurrent requests that hit 401 while a refresh is already in flight
  wait for that refresh's result instead of each starting their own.
- Once the refresh succeeds, decide replay per failed request by
  replay-safety, never blanket-retry:
  - `GET` or another idempotent method → replay automatically.
  - a mutation carrying an idempotency key the backend enforces → replay
    automatically; the key makes a duplicate delivery safe.
  - any other mutation (e.g. `POST /invoice/pay` with no idempotency key) →
    do not auto-replay. Surface the 401 as a recoverable error (§8's
    `AppError` shape) with an explicit user-triggered retry affordance, so a
    write that may have already reached the backend is never silently
    resubmitted.
- If the refresh itself fails, the session is invalidated exactly once:
  cancel remaining authenticated requests, clear user/tenant cache, and
  redirect to the login surface with a persistent "session expired"
  message and a safe `returnTo` back to the original route.
- A 403 never triggers this path — see Permission architecture in
  `references/03-frontend-architecture.md`.

---

## 9. Architecture acceptance checklist

- [ ] Query-key convention is defined and feature-owned.
- [ ] Default query behavior (staleTime, retry, refetch) is declared.
- [ ] Every mutation declares pending/success/error feedback, invalidation,
      optimistic-update policy, conflict handling, duplicate prevention, and
      idempotency.
- [ ] Mutability policy is declared for any mutation targeting an
      evidentiary/audit-sensitive record.
- [ ] Guard checklist and audit trail are declared for decision/approval/
      conflict-resolution actions.
- [ ] The DTO → mapper → frontend model → view model pipeline is followed;
      no component parses transport data directly.
- [ ] Generated-client/contract-drift policy is declared when a
      machine-readable backend contract exists.
- [ ] Form validation timing, server-error-to-field mapping, and
      failure-recovery (preserved values) are declared.
- [ ] Upload state machine is declared and distinct from a single boolean.
- [ ] Date storage format, time-zone handling, currency/number formatting,
      and enum label ownership are centralized, not per-screen.
- [ ] AppError categories and their default behavior are declared.
- [ ] 401 single-flight refresh and session-invalidation behavior are
      declared, including replay-safety per request (idempotent/keyed →
      auto-replay, unsafe mutation → user-triggered retry, never a blanket
      retry of every in-flight request); 403 is handled through the
      authorization path, never a generic login redirect.
