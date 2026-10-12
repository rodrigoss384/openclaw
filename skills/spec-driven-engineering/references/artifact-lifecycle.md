# Artifact Lifecycle

## Source-of-truth map

| Artifact | Owns | Must not own |
|---|---|---|
| `00-intent.md` | Problem, users, goals, non-goals, risk and scope | Detailed behavior or design |
| `01-spec.md` | Business rules, states, transitions, contracts and NFRs | Test implementation |
| `02-assumptions.md` | Assumptions, ambiguity, questions, decisions and blockers | Hidden product defaults |
| `03-acceptance-criteria.md` | Observable ATDD outcomes | Technical test structure |
| `04-behavior-scenarios.feature` | Given/When/Then examples | Framework coupling |
| `05-executable-acceptance-tests.md` | Frozen mapping to real automated tests | Production code |
| `06-properties.md` | General invariants and data-generation strategy | Example-only assertions |
| `07-design.md` | Architecture, data flow, boundaries, rollout and rollback | Duplicate requirements |
| `08-test-plan.md` | Test levels, RED expectations and real gates | Unverified commands |
| `09-tasks.md` | Atomic delivery units and dependencies | Deferred tests |
| `10-adversarial-review.md` | Attempts to falsify current confidence | Implementation fixes |
| `11-evidence.md` | Delivery Evidence only: executed evidence, residual risk, release decision, and pointers to subordinate machine-readable evidence | Claims without proof; any claim about post-release user/product outcome; duplicate machine-readable decision logs |
| `autonomous-decisions.json` | Derived machine-readable evidence/provenance for autonomy-controller outcomes whose canonical policy requires durable recording | Product/design authority, human approval, new workflow stages, or narrative duplication of `11-evidence.md` |

## Required and conditional artifacts

Always create `00`, `01`, `02`, `03`, `08`, `09`, `10`, and `11`.

Create `04` and `05` for observable behavior. When the work has no observable behavior, record `not-applicable` with rationale in `11-evidence.md` rather than creating fake scenarios.

Create `06` for invariants, idempotency, calculations, state combinations, generated-input value, or `critical` work.

Create `07` for `large` or `complex` work, material integration or architecture decisions, substantial frontend product work, substantial backend work, material boundaries, public contracts, relevant persistence, or an applicable representative gate. It references backend/frontend control artifacts without duplicating them.

`09-tasks.md` always exists so `TASK_ID` resolves deterministically in `07-execute`, even for a `quick` change: one `T-` record with status, linked `REQ/AC/SCN/AT/PROP`, and files touched is sufficient. Complexity controls decomposition depth — a single `T-` for an obvious one-step change, multiple `T-` with explicit dependencies when execution exceeds three steps, touches shared files, or requires parallel coordination — never the existence of the artifact itself.

Create `.specs/features/<feature-slug>/autonomous-decisions.json` only when the Autonomy Controller returns a consumption directive with `recordDecision=true`. It is a derived, non-canonical ledger subordinate to `11-evidence.md`, and each entry records the decision class/disposition, selected option or absence thereof, alternatives, authority, reason codes, evidence refs, applied rules, policy hashes, provenance, reversibility, timestamp and `durability=durable`. `SAFE_AUTONOMOUS` decisions use `durability=ephemeral` and must not be persisted in this ledger. Do not create an ADR or duplicate narrative for every reversible microdecision. At evidence review, `11-evidence.md` references the ledger and summarizes only release-relevant implications rather than copying its records.

`autonomous-decisions.json` is the only shared cross-stage control-plane evidence output defined by this lifecycle. A stage may append it even when the stage-local `allowed_outputs` list does not repeat the path, but only through `integrations/governance/autonomy-evidence.mjs record` and only when the validated consumption directive has `recordDecision=true`. This exception does not permit any other file, does not change the stage's product/design outputs, and does not allow evidence review to reconstruct or repair missing runtime records. The evidence-release stage is read/check-only for this ledger.

Create `outcome-plan.md` and, later, `outcome-evidence.md` whenever `applicability.md`'s `outcome-evidence` field is `applicable` (see [applicability-contract.md](applicability-contract.md) and [outcome-evidence.md](outcome-evidence.md)). Like `applicability.md`, both are control artifacts outside the fixed `00`–`11` numbering. `outcome-plan.md` is produced and frozen by `02-spec-assumptions`, before implementation — it holds the falsifiable hypothesis, metric, and threshold. `outcome-evidence.md` is produced only after a real post-release observation window closes, never at release time, and never edits `outcome-plan.md` or `11-evidence.md`.

## Stable IDs

Use `<TYPE>-<FEATURE_PREFIX>-<NNN>`:

```text
REQ | D | Q | DEF | AC | SCN | AT | PROP | T | ADV
```

Never recycle an ID. When migrating, retain existing IDs and add `legacy_id` to any new mapping. Preserve superseded entries with status and replacement reference instead of deleting history.

## Update rules

- Update the artifact that owns the decision before changing downstream artifacts.
- Propagate changed IDs and links downstream in order.
- Keep facts, inferences, assumptions, blockers, and decisions visibly distinct.
- Do not promote a question to a decision without a named authority or verifiable project rule.
- Do not create empty optional artifacts to make a checklist appear complete.
