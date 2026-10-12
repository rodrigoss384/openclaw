# Risk and Complexity Matrix

Classify two independent axes before planning.

## Complexity

| Value | Indicators | Planning depth |
|---|---|---|
| `quick` | One small outcome, at most three files, no contract change | Compact artifacts; steps may stay in test plan |
| `small` | Bounded change with obvious implementation | Short design rationale; tasks optional |
| `medium` | Clear feature spanning several components | Complete acceptance package and test plan |
| `large` | Multiple modules, integrations or deployment concerns | Formal design and tasks required |
| `complex` | New domain, material ambiguity or multiple systems | Formal design, tasks, staged rollout and explicit blockers |

## Criticality

| Value | Indicators | Required rigor |
|---|---|---|
| `low` | Easy rollback; no sensitive contract, data or money | Main positive, negative and regression tests; light adversarial pass |
| `standard` | Normal product behavior or persisted state | ATDD, BDD, executable acceptance tests, integration coverage and adversarial review |
| `critical` | Money, authorization, tenant isolation, privacy, legal, irreversible data or operational safety | Properties, contract/security/resilience coverage, full adversarial review, human risk approval and mutation testing when real tooling exists |

## Escalation rules

Choose the higher criticality when uncertain. Complexity controls ceremony; criticality controls assurance. A `small/critical` change stays small in implementation but receives critical assurance. A `complex/low` change receives formal planning without inventing security gates.

Escalate to `critical` when failure can cause unauthorized access, financial loss, cross-tenant exposure, unrecoverable corruption, legal impact, or unsafe irreversible behavior.

Mutation testing is required for `critical` only when the repository already has an approved runner or an explicit migration has been approved. Otherwise record `not-run` with the probe evidence.

## Representative gate overlays

Backend representative proof is required for new services/subsystems, public/cross-team contracts, material persistence/migrations, material security/tenancy, `large|complex`, or `critical`. Human approval is narrower: public contract, persistence/migration, security/tenancy, material operational cost, or critical risk.

Frontend representative proof and human approval are required for new or substantially changed product interfaces. Backend and frontend gates are evaluated independently.
