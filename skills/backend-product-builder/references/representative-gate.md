# Backend representative gate

## Applicability

The gate is required for new services/subsystems, public or cross-team contracts, material persistence/migrations, material auth/authz/tenancy/sensitive-data changes, `large|complex`, or `critical` work.

Set `humanApprovalRequired` only for public contracts, persistence/migration, security/tenancy, material operational cost, or critical risk. A large internal refactor can require representative proof without requiring human approval.

Record applicability in the manifest's structured `gate.conditions`. `gate.required` and `humanApprovalRequired` must be exact derivations of those booleans; narrative reasons cannot enable or bypass a gate.

## Readiness state

Enter `ready-for-backend-slice` only when acceptance contracts are frozen, the scenario matrix exists, validators and real test commands are named, data/security/reliability applicability is classified, and the vertical scope is narrow enough to review.

## Slice proof

Prove every applicable dimension through the real architecture:

- one success and one meaningful negative;
- ingress validation plus authorization/tenant boundary;
- persistence, transaction, schema, or migration behavior;
- idempotency or concurrency behavior;
- dependency failure and recovery;
- executable protocol contract and integration test;
- logs, metrics, traces, and audit events without sensitive data;
- performance evidence for measurable NFRs.

Use `N/A` with a reason for non-applicable dimensions. A missing tool is `not-run`, not `N/A` and not `passed`.

## Approval

Complete the machine-readable backend scorecard. Every passed dimension requires a non-empty evidence file; `not-applicable` requires a concrete rationale; `failed`, `partial`, and `not-run` block broad build. Contract validator evidence must contain the exact command, exit code, output, timestamps, project root and current contract SHA-256. Critical findings must be fixed or explicitly accepted by the authorized human. When human approval is required, record approver and ISO-8601 timestamp. Only then set `backend-broad-build-approved`.

Before asking for that decision, execute every safe, authorized automated check the agent can run. Supply a reviewer runbook derived from the repository: actual `cwd`, prerequisites, ordered startup/test/audit/request commands, ready signals, contract/operation/migration under review, positive and negative expected outcomes, applicable auth/tenant/data/recovery/observability checks, side effects, cleanup, evidence to return, and scoped approve/reject responses with real IDs and contract hashes. For migration, production, privileged, destructive, external-write or cost-bearing actions, name the target and backup/rollback or forward-recovery path, and distinguish authorization for agent execution from user execution. Command success is evidence, never implicit approval.

Adversarial review and release remain blocked while an applicable backend gate is not approved.
