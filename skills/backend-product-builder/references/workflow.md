# Backend product workflow

## DISCOVER

Inventory only what is real: application entry points, protocols, operations/messages, schemas, migrations, data stores, transactions, authn/authz, tenant context, external calls, jobs, queues, telemetry, SLOs, deployment, rollback, test commands, contract validators, and ownership.

For brownfield work, distinguish:

- fact: directly observed in code, config, docs, commands, or runtime evidence;
- inference: conclusion supported by named facts;
- assumption: unverified statement with an owner or verification action;
- blocker: missing decision or capability that prevents safe progress;
- decision: accepted choice with rationale and authority.

## CLASSIFY

Select a mode, complexity, and criticality. Record affected protocols and whether the representative gate is required. Do not infer gate exemption merely because the code diff is small: a one-line authorization or migration change can be critical.

## CONTRACT

Freeze structural contracts and behavioral acceptance before implementation. Record compatibility, deprecation, errors, side effects, and the scenario matrix. Existing IDLs remain authoritative and stay in place.

## MODEL

Name entities only where identity and lifecycle matter. Name value objects only where rules and semantics recur. Put invariants at the narrowest authority that can guarantee them, including database constraints when only the database can prevent invalid concurrent states.

## BOUNDARIES

Draw boundaries around ownership, trust, consistency, failure, deployment, or independently changing capabilities—not folders. Document dependencies and transaction boundaries. Do not add a boundary solely to satisfy Clean Architecture terminology.

## THREATS

Model actors, assets, entry points, tenant/ownership rules, privilege transitions, abuse cases, and sensitive data. Select verifiable controls from the project's security baseline and the currently approved ASVS/API Security versions.

## RELIABILITY

Define failure semantics for every remote dependency. Require timeouts. Retry only safe or idempotent work with limits, backoff, and a retry budget. Define deduplication, ordering, concurrency, partial failure, rollback, or forward recovery when relevant.

## OBSERVABILITY

Attach evidence to operational questions: can an operator identify the request, user/tenant where policy allows, dependency, failure class, latency, and recovery action without exposing secrets or sensitive payloads?

## PLAN

Create a vertical path through the real architecture. Name the acceptance test, contract validation, integration boundary, security negative, data proof, and telemetry evidence. Eliminate speculative infrastructure.

## VERTICAL SLICE

Implement the smallest representative end-to-end behavior. When applicable, include one success, one meaningful negative, authorization/tenant boundary, persistence or migration, idempotency/concurrency, dependency failure/recovery, executable contract, integration test, and diagnostic telemetry.

## VERIFY → REVIEW → REPORT

Run commands, complete the scorecard, conduct an adversarial review independent from implementation context, resolve critical findings or obtain explicit risk acceptance, and report the broad-build decision.
