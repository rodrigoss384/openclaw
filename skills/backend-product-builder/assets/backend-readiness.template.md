# Backend readiness

Feature: `FEATURE_SLUG`
Mode: `MODE`
Complexity: `COMPLEXITY`
Criticality: `CRITICALITY`
Gate required: `true|false`
Human approval required: `true|false`

## Technology decision

- Runtime context: `new-production-runtime | existing-runtime | disposable-nonproduction`
- Selection: `rust-axum-default | preserve-existing | task-fit-nonproduction | approved-exception`
- Language:
- HTTP framework or `not-applicable`:
- Decision reference:
- Exception class/alternative/justification/evidence or `not-applicable`:

The structured authority is `backend-change-manifest.json#technology`. A historical 1.2 manifest must be migrated explicitly to 1.3.0 before current work continues.

## Facts and applicability

- Existing architecture and conventions:
- Interfaces and consumers:
- Contract validators and commands:
- Data stores, schemas, migrations, and transactions:
- Authentication, authorization, tenancy, ownership, and sensitive data:
- External dependencies and failure modes:
- Observability and SLOs:
- Deploy, rollback, or forward recovery:

## External dependency reliability

| Dependency | Timeout | Retry / transient-only | Idempotency | Failure mode | Evidence |
|---|---|---|---|---|---|

The structured authority is `backend-change-manifest.json#reliability.externalDependencies`; this table summarizes it and must not contradict the manifest.

## Security and tenancy boundaries

| Trust boundary | Resource | Identity source | Tenant binding | Authorization point | Negative test IDs |
|---|---|---|---|---|---|

The structured authority is `backend-change-manifest.json#security.boundaries`. Material security/tenancy work and broad-build approval require concrete values and negative authorization/isolation evidence.

## Test integrity

- Explicit comparison baseline:
- Declared test paths:
- Contractual coverage: `preserved | increased`
- Test integrity evidence:
- New skips/disabled/focused tests: `none`
- Net assertion removal: `none`
- Removed contract-linked test IDs: `none`

Run the deterministic audit against the explicit review baseline rather than inferring one:

```bash
node skills/backend-product-builder/scripts/audit-test-integrity.mjs \
  --root . \
  --manifest docs/backend/backend-change-manifest.json \
  --base <BASELINE_REF> \
  --output docs/backend/evidence/test-integrity.json
```

## Repair trace

For `mode=repair`, record the chain in `backend-change-manifest.json#repairTrace`:

```text
finding -> systemicCause -> canonicalAuthorityRef -> repairEvidencePaths -> regressionTestIds
```

For other modes, record why repair tracing is not applicable.

## Decisions and assumptions

| ID | Type | Statement | Evidence/owner | Status |
|---|---|---|---|---|
| `D-FEATURE-001` | decision |  |  | approved |

## Representative slice

- Exact scope:
- Success case:
- Significant negative:
- Authorization/tenant proof:
- Persistence/migration proof:
- Idempotency/concurrency proof:
- Dependency failure/recovery proof:
- Contract and integration proof:
- Test-integrity proof:
- Logs/metrics/traces/audit proof:
- Performance proof or justified N/A:

Readiness state: `not-started`
