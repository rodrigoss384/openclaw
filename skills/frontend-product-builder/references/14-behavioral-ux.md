# Behavioral UX

## Mission

> Psicologia gera hipótese; evidência de usuário decide.

Use behavioral science to reduce unnecessary effort, improve comprehension,
help users decide, and test adoption hypotheses — never to teach the agent
which bias to exploit. The question is never "which bias can I use here?"
It is:

```text
what cognitive difficulty exists here?
what benefit to the user are we trying to create?
what hypothesis could improve this?
how will we know if it worked?
```

This is not a persuasion/growth-hacking skill. It does not exist to
increase conversion at the expense of comprehension, autonomy, or trust.

## Why principles are renamed

Popular "psychological trigger" material mixes strong meta-analytic
evidence, valid-but-contextual classic studies, marketing generalizations,
and unsupported numbers. Treating a contextual phenomenon as a universal
command is how legitimate psychology turns into deceptive design. Each
principle below is renamed from its popular "trigger" framing to a
truthful, bounded policy, with an evidence grade.

## Evidence grade

```text
A   Strong, replicated/meta-analytic evidence
B   Good evidence, context-dependent
C   Limited or indirect evidence
D   Practitioner heuristic or product precedent only
```

A grade does not claim academic precision. It exists so a single blog post
never carries the same weight as a meta-analysis inside this workflow.

## The seven principles

### 1. Reversible Choice Assistance (was "Smart Defaults") — Grade A, context-dependent — Medium risk

Defaults measurably influence decisions on average, but the effect size
varies substantially by context — there is no universal constant (no
"70–90% never change defaults" rule). A default is legitimate only with:

```text
default + justification + visibility + editability + reset + known impact
```

A default is **manipulative**, not facilitative, when it hides a
commitment (an annual-billed-monthly plan preselected while cancellation
cost and annual commitment are not equally visible is a real regulatory
example of this failure mode, not a hypothetical).

### 2. Truthful Progress & Momentum (was "Goal Gradient / Endowed Progress") — Grade B — Medium risk

Endowed-progress effects are real (progress that reflects steps genuinely
already completed measurably increases completion). The policy is:

> Never fabricate progress.

If the user created an account, verified email, named a workspace, and
picked a preference, showing that as real progress is honest. Showing 25%
completion when nothing happened yet, purely to raise completion rates, is
a misrepresentation — reject "never start the user at 0%" as a rule; the
correct rule only ever shows real, semantically defensible progress.

### 3. Value Before Commitment (was "Reciprocity") — Grade B, mechanism-dependent — Low/medium risk

Do not frame this as manufacturing "unconscious debt," and do not carry
forward unsupported magnitude claims about free-sample effects — the
mechanism is plausibly reduced uncertainty and direct experience, not debt.
The operative policy: let the user experience real value (partial
diagnosis, real preview, simulation, demo, initial result) before asking
for a commitment ("save?", "continue?", "create your account?"). This
reduces risk and uncertainty for the user — it does not work because "they
owe us something."

### 4. Meaningful Ownership (was "IKEA Effect / Endowment Effect") — Grade B — Low/medium risk

IKEA-effect labor-driven valuation and endowment-effect ownership-driven
valuation are related but distinct constructs — do not conflate them, and
note the boundary condition: effort increases valuation only when the task
is completed successfully; a failed or destroyed build effect disappears.
A healthy application: let the user build something useful, see the
result, personalize it — this beats forcing ten setup questions before an
empty dashboard.

**The critical guardrail:** the more work a user has invested, the greater
the product's responsibility to preserve, export, or honestly explain that
work's state. Turning ownership into a threat ("sign up now or lose
everything" when the data could technically be preserved) is manipulative
use of endowment + loss aversion, not a legitimate application of this
principle.

### 5. Truthful Consequence Framing (was "Loss Aversion") — Grade A, contextual — **HIGH-RISK**

Loss aversion is a real, replicated phenomenon, but its magnitude is not a
fixed "losses hurt exactly twice as much as gains" constant — that is an
overstated reading of an average coefficient found in one meta-analysis,
and it varies by task and experimental design. Showing a real consequence
("deleting this workspace removes 12 reports and 4 integrations") is
legitimate decision information. Showing a fabricated or exaggerated threat
("you're about to lose everything you built!") to block a cancellation is
a different, high-risk category — classify accordingly.

### 6. Relevant Comparative Context (was "Contrast / Anchoring") — Grade A/B, contextual — **HIGH-RISK**

Anchoring is robust in judgment tasks, but its economic magnitude is
smaller and less universal than early studies suggested, and depends on
the anchor's relevance/plausibility as an actual price. Do not adopt "always
show the higher number first" or "always anchor with an expensive plan" as
a rule, and never invent a reference price ("real value: R$30,000") without
a defensible methodology. A comparison must be true and genuinely
comparable, or it does not belong in the interface.

### 7. Trust & Transparency — **FOUNDATIONAL**, not persuasive — Low risk

This is the strongest part of the source material, and it does not belong
in a "persuasion" category at all — treat it at the same architectural
level as accessibility, security, and observability. Show total price
first, renewal date, trial end date, billing cadence, and cancellation/
data-retention consequences explicitly. Hidden or partitioned pricing
measurably increases consumer search/cognitive cost and has drawn direct
regulatory action; transparency is a product-quality property, not a
"transparency bias" to weigh against other triggers.

## Risk classification

```text
FACILITATIVE   PERSUASIVE   HIGH-RISK   PROHIBITED
```

### FACILITATIVE

Autocomplete, clearly editable defaults, real progress, price explanation,
justified recommendations. Apply freely.

### PERSUASIVE

Recommended plan, onboarding progress, feature suggestion, comparative
framing. Requires: user benefit + hypothesis + guardrails declared in the
Behavioral UX Contract (below).

### HIGH-RISK

Loss framing, pricing anchors, cancellation, trial conversion, defaults
with financial impact, consent, privacy, data deletion. Requires explicit
Behavioral Adversarial Review (see below) before release.

### PROHIBITED

```text
fake scarcity
fake countdown
fake social proof
fake progress
hidden fees
false price anchor
confirm-shaming
difficult cancellation
concealed recurring billing
threatening data loss that is not real
preselected harmful/costly add-on without clear informed choice
```

These are not "aggressive but effective" tactics to weigh against
conversion. They are deceptive-design patterns with active regulatory
exposure (EU DSA dark-pattern prohibitions; FTC actions against
subscription/cancellation and pricing practices are real, ongoing
enforcement, not theoretical risk). Treat a `PROHIBITED` pattern as a
blocker, not a finding to negotiate.

## Where this applies

Apply with more latitude in: onboarding, activation, first-run, empty
states, feature discovery, trial education, product education.

Apply with stronger review in: pricing, upgrade, renewal, retention,
cancellation.

Restrict persuasion severely in: security, permissions, privacy, financial
commitment, data deletion, legal decisions, consent, authorization,
critical operational actions. On these surfaces, comprehension, truth,
autonomy, and safety come before conversion, without exception.

## Behavioral UX Contract

Every `PERSUASIVE` or `HIGH-RISK` intervention declares one contract object
before implementation (`assets/schemas/behavioral-ux-contract.schema.json`,
`assets/templates/behavioral-ux-contract.template.json`):

```json
{
  "id": "BUX-ONBOARDING-001",
  "surface": "onboarding",
  "userGoal": "reach first value",
  "productGoal": "activation",
  "principle": "truthful-progress",
  "hypothesis": "showing real completed steps improves orientation and completion",
  "evidenceGrade": "A",
  "userBenefit": "orientation-and-progress",
  "businessBenefit": "activation",
  "truthful": true,
  "reversible": true,
  "userControl": "preserved",
  "manipulationRisk": "low",
  "experimentRequired": true,
  "primaryMetric": "activation-completion",
  "guardrails": ["setup-error-rate", "support-contact-rate", "early-churn"]
}
```

This forces the agent to declare a hypothesis, a benefit, an evidence
grade, and a risk — never just "use loss aversion here." Validate with
`scripts/validate-behavioral-ux-contract.mjs`.

## User benefit is mandatory, not decorative

Every intervention must be able to honestly complete this sentence:

> This helps the user by ___.

If it cannot be completed honestly, the intervention is not eligible for
implementation regardless of its expected business impact.

## What this replaces (rejected formulations)

The following formulations from popular behavioral-UX material are
explicitly rejected as workflow policy — they may appear in research notes
as context, never as a rule an agent follows:

- "Decision fatigue is when too many options lead to no choice" — conflates
  choice overload (contextual, moderated by task complexity and preference
  uncertainty) with a distinct construct.
- "70–90% of users never change defaults" — not a supported universal
  constant.
- "Never start the user at 0%" — replaced by "never fabricate progress."
- "Create unconscious debt" — replaced by "deliver value before asking for
  commitment."
- "Free samples increase purchases by 2,000%" — no defensible primary
  source at this magnitude; remove until a specific, contextualized source
  exists.
- "Loss is exactly twice as powerful as gain" — an average meta-analytic
  coefficient, not a universal emotional ratio.
- "A price range always anchors on the higher number" — treat as a
  contextual hypothesis, never a pricing rule.
