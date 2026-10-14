# Visual Composition

Use this reference during `PRIORITIZE`, `COMPOSITION PROOF`, `SMALL SLICE`,
`COMPOSITION AUDIT`, and `REPORT`.

Tailwind, tokens, and shared components provide materials. They do not decide
what the user should notice first, what belongs together, or how the screen
should breathe. Visual composition turns product priority into rendered
hierarchy.

## Profiles

Every substantial surface chooses one base profile:

- `productive`: operational apps, dashboards, forms, tables, admin workflows,
  review queues, and repeated work.
- `expressive`: landing pages, onboarding, editorial presentation, exploratory
  experiences, or marketing.

Use `momentOverrides` only for a bounded region with purpose, limits, evidence,
and approval.

## Required separation

Keep these contracts separate:

- Semantic outline: `h1` through `h6` describe document structure and navigation.
- Visual priority: `critical`, `primary`, `supporting`, `contextual`, and
  `audit` describe what should attract attention.
- Text role: `display`, `pageTitle`, `sectionTitle`, `subsectionTitle`, `body`,
  `bodyStrong`, `label`, `metadata`, `caption`, `metric`, and `code` describe
  the approved composed typography treatment.

Do not choose an `h3` because it looks smaller, or an `h1` because it should be
large. Change the semantic text style assignment instead.

## Composition proof

Before broad frontend build for substantial work, produce
`composition-proof.json` and, when possible, low-fidelity grayscale captures.

Use real or domain-plausible content. Direction that is still open requires two
or three alternatives. A mature approved design system may use one alternative.

The proof must show:

- dominant task and focal point per state;
- semantic outline independent from visual treatment;
- reading path;
- typography role assignment;
- alignment anchors and key lines;
- proximity groups and separation rules;
- whitespace zones and owners;
- responsive preservation of priority;
- non-success state treatment.

Human approval of the proof belongs to the existing representative gate. Scripts
can block contradictions, missing evidence, and drift. Scripts cannot declare
that the design is beautiful.

## Objective blockers

Block readiness or representative approval when any applies:

- semantic outline is missing, invalid, or used as a visual scale;
- visual priority, reading path, or text roles are incomplete;
- two dominant focal points compete in the same state or viewport without an
  approved exception;
- primary and supporting content rely only on color to differ;
- typography roles resolve to indistinguishable size, weight, line-height, and
  color without an approved exception;
- related elements are farther apart than unrelated groups without rationale;
- declared alignment anchors fail beyond the tolerance;
- mobile or compact layouts invert the approved priority;
- rendered evidence hashes do not match the approved contracts;
- scorecard is incomplete or auto-approved without human decision.

## Small visual changes

For a small change, record `visual-impact`.

- `unchanged`: validate affected token usage, semantic role, and before/after
  evidence.
- `changed`: return to design readiness and complete the full composition
  contract.

Do not treat a change to action hierarchy, dominant task, heading structure,
region layout, typography scale, or responsive priority as cosmetic.

## Tailwind and prose

Tailwind utilities are implementation details for approved tokens and component
variants. Do not introduce arbitrary font sizes, weights, spacing, colors, or
layout offsets unless a documented exception exists.

Use `prose` only for long-form content or uncontrolled HTML such as Markdown,
CMS output, or rich text. Do not use it to solve application UI hierarchy.
