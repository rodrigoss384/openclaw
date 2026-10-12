# Styling Authority and Visual Reference Contract

## Purpose

Prevent visual work from creating an accidental CSS architecture, hiding selector ownership problems behind global overrides, or drifting from approved references.

Create or update `docs/frontend/styling-authority.json` from `assets/templates/styling-authority.template.json`. Validate it with `assets/schemas/styling-authority.schema.json` and `scripts/validate-styling-authority.mjs`; audit both registered and undeclared non-module stylesheets with `scripts/audit-styling-authority.mjs`.

The contract is required for every user-visible web-interface change. Scale the evidence to the change; do not omit the contract for a small visual edit.

## Detect before selecting

Inspect direct evidence:

- package manifests, lockfile and styling configuration;
- stylesheet imports and cascade order;
- Tailwind config, theme directives, plugins and semantic utilities;
- CSS/Sass Modules, CSS-in-JS or zero-runtime styling libraries;
- design-token and theme sources;
- shared component library, variants and representative components;
- Storybook or equivalent workshop;
- global stylesheets and their actual consumers.

Record every detected mechanism and choose one primary authority. Preserve a viable established architecture. A new mechanism requires an explicit migration decision; convenience is not a migration reason.

## Class ownership trace

Before editing, replacing or overriding an existing class:

1. find all usages;
2. find every definition;
3. locate the stylesheet import and cascade position;
4. identify the owning component or layer;
5. identify tokens and variants it consumes;
6. record the decision and evidence in `classOwnershipTraces`.

If a class is used but no definition can be found, classify it as drift or a blocker. Do not create a selector in a global stylesheet merely because the class name resembles BEM or because no co-located module was found.

Do not solve ownership uncertainty by increasing specificity, adding `!important`, or appending a late global override.

## Global stylesheet boundary

Global stylesheets may own only responsibilities recorded in the contract:

- reset or normalize;
- `font-face` declarations;
- root reference/semantic tokens;
- theme selectors;
- documented base element styles;
- global keyframes;
- document-shell behavior;
- approved third-party overrides;
- explicitly recorded legacy global components.

New component, feature, page, route, layout-local or BEM selectors are forbidden in global stylesheets unless the project's primary approved architecture is `global-css-legacy` or a scoped exception records rationale, approver and timestamp. An exception does not authorize a silent architecture migration.

Every non-module stylesheet containing global rules must be listed in `authority.globalStylesheets` unless the project is explicitly governed by `global-css-legacy`. Creating a second plain CSS file and omitting it from the contract is a gate failure, not an escape hatch.

## Stack-aware implementation

### Tailwind authority

Use approved utilities, variants, plugins, shared components and semantic tokens. Prefer extending the canonical token/theme source over repeating raw palette values. Do not create BEM or a parallel stylesheet to avoid using the approved utility system. Avoid arbitrary values when a token or approved utility owns the decision.

### CSS Modules or Sass Modules authority

Co-locate component styles with the canonical owner and consume approved tokens. Do not move local selectors into a global sheet for convenience.

### CSS-in-JS or vanilla-extract authority

Use the installed library, approved theme and repository composition conventions. Do not introduce a second styling runtime or unmanaged plain-CSS path.

### Legacy global CSS authority

Preserve it only when recorded as the actual viable architecture. Trace ownership and cascade explicitly. A Tailwind or module migration requires a separate approved migration plan and representative proof.

## Raw-value policy

Raw color, spacing, typography, radius, shadow, border, breakpoint and z-index values belong in the canonical reference-token authority. Feature and screen code should consume semantic or component tokens.

Allow a scoped exception only when an external specification or integration requires the value, no existing semantic token can represent it, and the exception is recorded and approved. Inline style is acceptable for a genuinely calculated runtime value with documented rationale; it is not a shortcut around the styling authority.

## Visual reference contract

Record at least one approved visual authority: existing product, Storybook, Figma/design file, screenshot, user-supplied reference project, brand guide, approved probe or design-direction artifact.

Styling Authority v2 keeps only an adopted projection: `referenceId`, `status: adopted`, `appliedTo`, and the exact `visualResearchDigest`. URL/source, license, retention, rejected candidates, useful patterns, anti-patterns, adopted aspects and excluded aspects belong to the canonical `visual-research.json`; do not duplicate them here. The root `visualResearch.ref` and `visualResearch.semanticDigest` bind the projection to that owner.

Version 1 remains structurally valid only for explicit legacy/shadow consumption. Before Product Design Authority becomes primary, migrate with `scripts/migrate-styling-authority-v2.mjs` and an explicit applications mapping. Migration may not infer `appliedTo` or silently reinterpret a legacy reference.

Extract decisions such as layout rhythm, density, typography roles, palette relationships, component anatomy, interaction and motion into the canonical design direction and Design System, then point the v2 projection at the affected screen or decision IDs.

Do not copy defects, hidden behavior, inaccessible patterns, product semantics or code architecture from a visual reference. Product contracts, accessibility, approved brand and the project's design system have higher authority.

## Gate evidence

Before `SMALL SLICE`:

- validate `styling-authority.json`;
- resolve conflicting styling mechanisms;
- approve the visual reference contract;
- define global stylesheet responsibilities;
- identify token and component authorities.

Before broader `BUILD`:

- retain class ownership traces for existing classes touched by the slice;
- audit changed global stylesheets, raw and arbitrary values;
- compare rendered screenshots against approved reference aspects;
- validate the real route, responsive transformations, keyboard/focus and non-success state.

Storybook may supplement this evidence. It cannot replace the real-route representative gate.

## Stop conditions

Stop when the primary styling mechanism is ambiguous, systems claim the same responsibility, a class owner cannot be found, the patch requires a late global override, token sources conflict, the visual reference lacks approved aspects or the requested result implies an unapproved migration.

Return to the authority contract, design direction or migration decision. Do not patch around the ambiguity.
