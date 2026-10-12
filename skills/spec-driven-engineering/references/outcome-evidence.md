# Delivery Evidence vs Outcome Evidence

## The distinction

`11-evidence.md` answers one question: **did we build it correctly** — contract
honored, tests real and green, gates passed, risk residual known. That is
**Delivery Evidence**. It is produced before or at release and never depends
on production usage existing yet.

`outcome-plan.md` + `outcome-evidence.md` together answer a different
question: **did it actually help the user, measured after real usage
exists**. That is **Outcome Evidence**. It cannot be produced at release
time — it requires an observation window in production. A feature can pass
every delivery gate and still fail its outcome: the contract was honored,
the UI matched the design, and users still didn't complete the flow or
didn't come back.

Never let one substitute for the other:

- Do not mark a feature "successful" in `11-evidence.md` based on a metric
  hypothesis that hasn't been observed yet — that is Outcome Evidence smuggled
  into a Delivery artifact.
- Do not defer contract/test/gate evidence "until we see the metrics" — that
  is Delivery Evidence withheld behind an Outcome question it doesn't answer.

Both are optional and conditional (see `applicability.md`'s `outcome-evidence`
field in [applicability-contract.md](applicability-contract.md)) — they exist
only when the feature makes a claim about user behavior or a product metric,
most commonly alongside `behavioral-ux: applicable` (see
`skills/frontend-product-builder/references/14-behavioral-ux.md`). A feature
with no behavioral or product-metric claim has nothing for these artifacts to
measure and should record `outcome-evidence: not-applicable` instead of
creating them.

## Two artifacts, not one: plan before, evidence after

An outcome claim is only falsifiable if the hypothesis, metric, and success
threshold are recorded **before** the observation window starts, never
derived after looking at the data. A single artifact that claims to hold
both the preregistration and the observed result cannot prove this — nothing
stops it from being edited retroactively. So the two are separate files with
separate authors in time:

- **`outcome-plan.md`** — produced by `02-spec-assumptions`, immediately
  frozen (`status: frozen`, `frozenSha256` over the exact Preregistration
  text). Holds the hypothesis, `primaryMetric`, `guardrails`, minimum
  sample/duration, the analysis method, and the confirm/refute threshold —
  fixed before implementation starts.
- **`outcome-evidence.md`** — produced by `11-outcome-evidence.prompt.md`,
  only after the preregistered observation window has closed. Holds
  `outcomePlanSha` (copied from `outcome-plan.md`'s `frozenSha256`), the
  observed data, the result, and the Product Learning decision. It never
  edits `outcome-plan.md` or `11-evidence.md`.

`scripts/validate-outcome-plan.mjs` recomputes the Preregistration block's
sha256 and compares it to `frozenSha256` on every run — an edit to the
hypothesis, metric, or threshold after freeze breaks that match and fails
validation mechanically. This is what makes HARKing (Hypothesizing After the
Results are Known) a detectable defect instead of a matter of trust.

### Changing an outcome plan after it is frozen

A later stage that discovers the frozen hypothesis, metric, or threshold was
wrong does not silently edit `outcome-plan.md` and continue. It:

1. stops the current stage;
2. records the discovery as a blocker, citing the specific field and why it
   no longer holds;
3. returns to `02-spec-assumptions` to reissue `outcome-plan.md` with the
   corrected field, a dated changelog line, a new `frozenAt`, and a
   recomputed `frozenSha256`;
4. treats any observation already collected against the old plan as
   evidence for the *old* hypothesis, not silently carried over to the new one.

## HEART vocabulary and Metric Class

Not every legitimate metric is a user-centered outcome. `error rate`,
`latency`, `refund rate`, `support volume`, `security incident`, `privacy
complaint`, `cost per transaction`, and `chargeback` are all valid
`primaryMetric`/`guardrails` candidates that do not naturally map to HEART.
Forcing every metric into HEART or rejecting it as a "vanity metric" would
reject metrics that are exactly the guardrails a behavioral intervention
most needs. Classify every metric with a **Metric Class** first:

| Metric Class | What it measures | HEART required? |
|---|---|---|
| `user-outcome` | Did this help the user, in their own terms | Yes — map to one HEART dimension below |
| `business-outcome` | Did this help the product/business goal | No |
| `safety-ethics-guardrail` | Manipulation risk, complaint, consent violation | No |
| `technical-reliability-guardrail` | Error rate, latency, availability | No |

Only `user-outcome` metrics require a HEART dimension (Google's HEART
framework — use it as the shared vocabulary for `primaryMetric` naming so a
metric name means the same thing across the Behavioral UX Contract and
`outcome-plan.md`):

| Dimension | Question it answers | Example metric |
|---|---|---|
| **H**appiness | Is the user satisfied? | CSAT, NPS, qualitative sentiment |
| **E**ngagement | How deeply do users interact? | actions per session, feature adoption depth |
| **A**doption | Do new users start using it? | activation rate, first-use conversion |
| **R**etention | Do users come back? | D7/D30 retention, churn rate |
| **T**ask success | Can users complete the goal? | completion rate, time-to-complete, error rate |

## Experiment pre-registration discipline

- Record the hypothesis, `primaryMetric` (with its Metric Class), `guardrails`
  (each with its own Metric Class), minimum sample size/duration, analysis
  method, and the threshold that counts as confirming vs refuting — all
  before release, in `outcome-plan.md`, frozen immediately.
- Never change the success threshold after seeing partial results. If the
  threshold needs to change, that is the reopening procedure above, not a
  silent edit.
- A guardrail regressing while `primaryMetric` improves is not a partial win
  to reinterpret; record it as observed in `outcome-evidence.md` and let the
  Product Learning loop (below) decide the next step.
- When the surface has no measurable traffic for a real experiment, use the
  qualitative fallback (`outcome.method: moderated-usability-study |
  direct-user-feedback | support-signal-analysis`) and grade
  `outcome.quality` accordingly — never invent a quantitative result to fill
  the field.

## Two distinct evidence-quality dimensions

Do not reuse the Behavioral UX Contract's `evidenceGrade` (A–D) to describe
the observation in `outcome-evidence.md` — they measure different things:

- **`sourceEvidenceGrade`** — the strength of the *prior literature* behind
  the hypothesis (A: strong replicated/meta-analytic evidence … D:
  practitioner heuristic only). This is the Behavioral UX Contract's
  `evidenceGrade`, carried over by reference when a related contract exists.
- **`outcome.method` / `outcome.quality`** — the strength of the evidence
  *this specific observation produced* (`randomized-experiment` with
  `strong` quality down to `direct-user-feedback` with
  `qualitative-supported` quality). A hypothesis can rest on grade-A prior
  literature and still be tested by a weak, inconclusive observation, or
  rest on grade-D practitioner heuristic and still be confirmed by a strong
  randomized experiment. Conflating the two hides which one is actually true.

## Product Learning loop

Outcome Evidence closes a loop that Delivery Evidence has no visibility into.
The loop has explicit stages; skipping straight from BUILD to LEARN is what
produces shipped features nobody validated:

```text
DISCOVER → HYPOTHESIZE → DESIGN → BUILD → VERIFY → RELEASE → OBSERVE → LEARN → CODIFY / UPDATE HYPOTHESIS
   ^                                                                                      |
   +--------------------------------------------------------------------------------------+
```

- **DISCOVER** — the problem/opportunity, from `00-intent.md`.
- **HYPOTHESIZE** — the falsifiable behavioral/product hypothesis, frozen in
  `outcome-plan.md` and, when applicable, the Behavioral UX Contract.
- **DESIGN** — `07-design.md` and, for a persuasive/high-risk surface, the
  Behavioral Adversarial Review.
- **BUILD** — implementation, `09-tasks.md`.
- **VERIFY** — `11-evidence.md` (Delivery Evidence): did we build the thing
  we designed, correctly.
- **RELEASE** — human approval, merge/deploy (external to this workflow).
- **OBSERVE** — the pre-registered window in `outcome-plan.md` runs in
  production; no artifact write happens until it closes.
- **LEARN** — `outcome-evidence.md` (Outcome Evidence): did the hypothesis
  hold, against the pre-registered threshold.
- **CODIFY / UPDATE HYPOTHESIS** — a confirmed hypothesis becomes reusable
  precedent (cite it in future `outcome-plan.md` hypotheses instead of
  re-deriving from `sourceEvidenceGrade: D`); a refuted hypothesis feeds the
  next DISCOVER/HYPOTHESIZE pass instead of being silently dropped.

## Validation

`node scripts/validate-outcome-plan.mjs outcome-plan.md` checks the freeze
invariant described above. `outcome-evidence.md` is read by
`11-outcome-evidence.prompt.md`, which runs only after `09-validate-evidence`
and only once the pre-registered observation window has actually closed. It
never runs at release time, and it never authors or edits `outcome-plan.md`
or `11-evidence.md`.
