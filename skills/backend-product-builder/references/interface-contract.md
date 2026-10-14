# Interface Contract

## The abstraction

The integration boundary between a backend and its consumers is never the
backend's implementation language. It is the **Interface Contract**:

```text
Backend in any language
        ↓
Interface Contract
        ↓
Machine-readable description
        ↓
Validation / drift / codegen / tests
        ↓
Consumer (frontend, another service, an agent)
```

Python, Go, Java, C#, Rust, Node.js, PHP, Kotlin, or any other provider
language is a detail of the stack specialist that implements the backend
(`references/authority-routing.md`). It is never relevant to how a consumer
integrates. `manifest.interfaces[].kind`/`contractType` are the fields that
actually govern integration; the provider's language never appears there.

## Canonical adapter matrix

`kind` says what shape of interface it is. `contractType` says which
machine-readable format actually describes it — the concrete adapter.
`allowedContractTypesByKind` in `scripts/lib/backend-package.mjs` enforces
this pairing; do not declare a combination the validator would reject.

| Interface kind | Canonical contractType | Notes |
|---|---|---|
| `http` | `openapi` | HTTP APIs. OpenAPI is the default adapter — not a universal one. |
| `event` | `asyncapi` | Message/event-driven interfaces: Kafka, MQTT, AMQP, WebSockets, and equivalents. |
| `graphql` | `graphql-sdl` | The GraphQL Schema Definition Language is the contract, not a REST description pretending to be GraphQL. |
| `grpc` | `protobuf` | `.proto` is the IDL; gRPC bindings are generated from it. |
| `http` / `event` / `job` | `arazzo` | A **sequence** of OpenAPI/AsyncAPI operations (authenticate → fetch tenant → create resource → wait for event → confirm) described as one machine-readable workflow. Arazzo is not today a universal orchestrator for GraphQL, gRPC, MCP, SOAP, or A2A — use it only for OpenAPI/AsyncAPI-composed workflows, and use `custom` for anything else that needs sequencing description. |
| any | `custom` | A project-specific machine-readable format when none of the above applies. Never silently treat a custom format as if it were OpenAPI/AsyncAPI/GraphQL-SDL/Protobuf. |

Never force a non-HTTP interface to "pretend" to be OpenAPI to reuse
tooling. Use the adapter that actually matches the interface's real shape.

## Authority modes

Every interface entry declares `authorityMode`:

- **`design-first`** — the contract is authored and approved before the
  implementation. The backend must conform to it, not the reverse.
- **`code-first-exported`** — the backend framework generates the contract
  from its own code (e.g. an OpenAPI export from route
  decorators/annotations). The contract is a byproduct, re-exported on
  every change, never hand-edited in isolation from the code it describes.
- **`external-provider`** — the contract belongs to a third party this
  backend calls or is described for; this project does not own it and
  cannot unilaterally change it.

Never leave this implicit. A reviewer (human or agent) must be able to tell,
from the manifest alone, which of the three governs a given interface —
`authorityMode` is a required field precisely so no one has to infer it.

## The pipeline

```text
provider
    ↓
extract/publish contract
    ↓
syntax validation
    ↓
semantic lint
    ↓
breaking-change diff
    ↓
security/authorization review
    ↓
contract hash
    ↓
code generation (consumer side)
    ↓
generated-code freshness check
    ↓
contract/integration tests
    ↓
consumer
```

**A schema that validates is not a good contract.** A syntactically correct
OpenAPI document can still omit authentication semantics, error shapes,
operation IDs, examples, pagination, idempotency, tenant boundaries,
conflict behavior, nullable semantics, field constraints, or retry
behavior — all of which matter for a human or an agent consuming it
reliably. Emerging 2026 research on "agent-ready" OpenAPI documentation
found planning, tool-selection, and payload-construction failures even
against stable APIs, tied to semantic documentation gaps rather than
structural invalidity (preprint evidence, not yet peer-reviewed — treat the
specific numbers as emerging, the architectural conclusion as sound:
structural validity does not guarantee reliable machine consumption).
Semantic lint in the pipeline above exists specifically to catch this class
of gap that schema validation alone cannot.

### How this project enforces it today — four distinct gates, not one

The pipeline above is four separable questions. Do not collapse them into
"the sha256 check" — each has a different failure mode, and only two are
currently mechanical:

| Gate | Question | Mechanism today |
|---|---|---|
| **Contract freshness** | Did the contract file change since it was last validated? | Mechanical. `validateValidatorEvidence` compares the contract file's current sha256 against the hash recorded when the validator last ran; a mismatch is drift, and drift fails validation. |
| **Contract validity** | Is the contract itself well-formed (syntax, semantic lint)? | Partially mechanical, contract-type-dependent (an OpenAPI/AsyncAPI/protobuf/GraphQL-SDL linter run via `validatorCommand`) — not enforced uniformly across every `contractType` by this skill itself. |
| **Contract compatibility** | Is this specific change backward-compatible for existing consumers? | **Not mechanical.** `changeType` (`unchanged\|compatible\|breaking\|new`) and `compatibility` are declared by the author, not computed from a structural diff against the previous contract version. There is no `openapi-diff`/`oasdiff`-equivalent semantic-diff step in this pipeline yet. |
| **Behavior correctness** | Does the implementation actually behave as the contract says? | Mechanical. `validatorCommand`/`validatorEvidencePath`/`validatorResult` require real, executed contract/integration test evidence (`passed\|failed\|partial\|not-run`), never a claimed result without a command. |

What the sha256 freshness check actually buys you: it proves the contract
file you are looking at now is the exact one the validator last ran against
— it says nothing about *what* changed or whether that change is
compatible. Treating it as a breaking-change detector would be wrong; it
cannot tell "added an optional field" apart from "removed a required one".

What currently stands between an undetected breaking change and broad
build is **process, not detection**: `exposure` in `[partner, public]`
combined with a declared `changeType != unchanged` forces
`gate.conditions.publicContract = true`, which forces the representative
gate and (per `gate.humanApprovalRequired`) an explicit human decision
before `backend-broad-build-approved`. That human is the actual
compatibility check today — they read the diff and confirm the declared
`changeType` is honest. A mis-declared `changeType` (e.g. a breaking change
marked `compatible`) is not caught by any mechanism in this pipeline; it
depends entirely on that reviewer noticing. Building a real semantic-diff
gate (contract-type-specific: OpenAPI/AsyncAPI/GraphQL-SDL/protobuf each
need their own diff tool) would close that gap, but does not exist yet —
do not describe the current state as if it does.

### What still requires the discipline in `references/reliability-observability.md` and `references/security.md`

Syntax/hash validation does not read semantics. Idempotency, tenant
isolation, authorization, and retry/error behavior for a given interface
remain the responsibility of those references — the Interface Contract
pipeline proves the *description* is current and valid; it does not prove
the *behavior* is correct.

## Consumer-side ownership

The consumer (typically `frontend-product-builder`'s
`references/07-data-and-forms.md` §4) owns a `generated/`-equivalent
boundary that is:

- generated, reproducible, and replaceable;
- never manually edited;
- never the layer where mappers, `AppError` normalization, feature APIs,
  capability decisions, query-invalidation semantics, or domain
  normalization live — those stay owned by the consumer's own code, behind
  the generated layer, never scattered through it.

This project does not depend conceptually on a specific generator (Orval,
openapi-generator, or any other) — the capability (generate, don't hand-type,
detect staleness) is required; the specific tool is substitutable.
