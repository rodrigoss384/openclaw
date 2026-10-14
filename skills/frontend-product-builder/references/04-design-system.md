# Machine-Readable Design System

## Purpose

Define a design system that can be understood and enforced by both humans and
coding agents.

The design system must reduce visual improvisation by establishing:

- semantic design tokens;
- component contracts;
- component ownership;
- approved variants;
- approved sizes;
- interaction states;
- responsive behavior;
- accessibility requirements;
- content constraints;
- composition rules;
- prohibited patterns;
- validation checks;
- change-governance rules.

This reference prevents each screen from independently inventing:

- colors;
- spacing;
- typography;
- radii;
- shadows;
- button behavior;
- card behavior;
- feedback patterns;
- responsive layouts;
- accessibility behavior.

---

# Required artifacts

The design-system phase must produce:

```text
docs/frontend/design-system/
├── design-system.json
├── tokens.md
├── components/
│   ├── button.md
│   ├── input.md
│   ├── card.md
│   └── ...
└── decisions/
    └── ...
```

The project implementation may include:

```text
src/
├── components/
│   ├── ui/
│   ├── layout/
│   ├── feedback/
│   ├── navigation/
│   └── data-display/
└── styles/
    ├── globals.css
    ├── tokens.css
    └── typography.css
```

Use:

- `assets/schemas/design-system.schema.json`;
- `assets/templates/design-system.template.json`;
- `assets/templates/component-contract.template.md`;
- `assets/templates/token-contract.template.md`.

Do not create all component contracts before components are actually planned.

Also create or update `docs/frontend/styling-authority.json` using `references/12-styling-authority.md`. The design-system artifact defines tokens and components; the styling-authority artifact defines how project code may express those decisions and what global stylesheets may own.

Create the foundational contracts first and add others incrementally.

---

# Sources of truth

Use this precedence:

1. approved product specification;
2. approved frontend product context;
3. approved design direction;
4. `docs/frontend/design-system/design-system.json`;
5. human-readable token and component contracts;
6. implemented shared components;
7. screen-level code.

A screen must not redefine a system-wide rule.

When implementation and design-system artifacts disagree:

1. determine which was approved most recently;
2. identify whether the implementation has drifted;
3. identify whether the artifact is stale;
4. do not silently choose one;
5. document and resolve the discrepancy.

---

# Design-system layers

Use three token layers.

## Layer 1 — Reference tokens

Reference tokens represent raw values.

Examples:

```text
color.neutral.950
color.blue.600
space.4
radius.2
font.size.3
duration.fast
```

Reference tokens do not express product meaning.

They answer:

> What value exists?

They do not answer:

> Where should this value be used?

Product components should normally not consume reference color tokens directly.

---

## Layer 2 — Semantic tokens

Semantic tokens represent meaning.

Examples:

```text
background.canvas
background.surface
text.primary
text.secondary
border.default
action.primary.background
status.danger.background
focus.ring
```

They answer:

> What role does this value perform?

Product components should primarily consume semantic tokens.

Semantic tokens may point to different reference values by theme.

Example:

```text
background.canvas
  light → color.neutral.50
  dark  → color.neutral.950
```

---

## Layer 3 — Component tokens

Component tokens represent narrowly scoped component decisions.

Examples:

```text
button.primary.background
button.primary.foreground
input.border.default
dialog.maxWidth
table.row.height.compact
```

Create component tokens only when:

- the value is used by several instances of the component;
- the value represents a stable component rule;
- a semantic token alone does not express the requirement;
- the token reduces duplication or inconsistency.

Do not create component tokens for every CSS property.

Do not create component tokens merely to mirror all implementation details.

---

# Token-definition requirements

Every token must define:

- path;
- type;
- value or alias;
- description;
- supported themes when applicable;
- status;
- usage restrictions when necessary.

Supported status values:

- `experimental`;
- `stable`;
- `deprecated`.

Deprecated tokens must define:

- replacement;
- migration note;
- planned removal version when known.

Do not remove tokens without evaluating consumers.

---

# Token types

Use explicit token types.

Examples:

- `color`;
- `dimension`;
- `number`;
- `duration`;
- `fontFamily`;
- `fontSize`;
- `fontWeight`;
- `lineHeight`;
- `letterSpacing`;
- `shadow`;
- `border`;
- `cubicBezier`;
- `gradient`;
- `string`.

Do not store unrelated values as generic strings when a more specific type is
available.

---

# Token naming

Use semantic, stable names.

Preferred:

```text
text.primary
text.secondary
background.surface
border.strong
status.warning.foreground
action.danger.background
```

Avoid:

```text
darkGray
lightBlue
goldButton
cardWhite
headerBlack
bigPadding
```

Names should describe role rather than current appearance.

A semantic token may change visual value without requiring consumer renaming.

---

# Alias policy

Prefer aliases over repeated raw values.

Example conceptual representation:

```json
{
  "value": "{reference.color.neutral.950}",
  "type": "color",
  "description": "Primary text in the light theme."
}
```

Alias paths must resolve to existing tokens.

Do not create circular aliases.

Do not alias a semantic role to another unrelated semantic role merely because
their current values match.

Invalid:

```text
status.success.background
  aliases
action.primary.background
```

They may currently share a value but have different meanings and may diverge.

Both should independently reference the appropriate reference token.

---

# Color architecture

Define at least these semantic roles when applicable:

## Background

- `background.canvas`;
- `background.surface`;
- `background.surfaceSubtle`;
- `background.surfaceElevated`;
- `background.overlay`;
- `background.disabled`;
- `background.selection`.

## Text

- `text.primary`;
- `text.secondary`;
- `text.muted`;
- `text.inverse`;
- `text.disabled`;
- `text.link`.

## Border

- `border.default`;
- `border.subtle`;
- `border.strong`;
- `border.focus`;
- `border.disabled`.

## Actions

- `action.primary.background`;
- `action.primary.foreground`;
- `action.primary.hover`;
- `action.primary.active`;
- `action.secondary.background`;
- `action.secondary.foreground`;
- `action.secondary.hover`;
- `action.ghost.hover`;
- `action.danger.background`;
- `action.danger.foreground`;
- `action.danger.hover`.

## Status

- `status.info.background`;
- `status.info.foreground`;
- `status.info.border`;
- `status.success.background`;
- `status.success.foreground`;
- `status.success.border`;
- `status.warning.background`;
- `status.warning.foreground`;
- `status.warning.border`;
- `status.danger.background`;
- `status.danger.foreground`;
- `status.danger.border`.

## Focus

- `focus.ring`;
- `focus.offset`.

Do not use the primary brand color for every status.

Do not use danger tokens for decorative emphasis.

---

# Typography architecture

Define a constrained typography system.

At minimum:

- font families;
- fallback stacks;
- font sizes;
- line heights;
- font weights;
- letter spacing;
- numerical formatting behavior.

Create semantic text styles such as:

- `display`;
- `pageTitle`;
- `sectionTitle`;
- `subsectionTitle`;
- `body`;
- `bodyStrong`;
- `label`;
- `metadata`;
- `caption`;
- `code`;
- `metric`.

Do not allow each screen to choose independent heading sizes.

Operational products should normally use a restrained heading scale.

Avoid excessively small labels and metadata.

Avoid light font weights where readability is critical.

---

# Spacing architecture

Use a constrained spacing scale.

Recommended base:

- 4-pixel increments for fine-grained control;
- 8-pixel rhythm for major composition.

Example reference scale:

```text
0  → 0
1  → 4px
2  → 8px
3  → 12px
4  → 16px
5  → 20px
6  → 24px
8  → 32px
10 → 40px
12 → 48px
16 → 64px
```

The final scale must follow the approved design direction.

Do not introduce arbitrary spacing values without documented justification.

Avoid values such as:

```text
13px
19px
27px
37px
```

unless the value is required by an external specification or measured
integration constraint.

---

# Sizing architecture

Define reusable sizes for:

- controls;
- icons;
- avatars;
- page containers;
- dialogs;
- drawers;
- sidebars;
- navigation rails;
- table rows;
- interactive targets.

Control size and target size are related but not always identical.

A compact visible control may require a larger interactive target.

Do not enforce fixed heights on content containers whose content may wrap.

---

# Radius architecture

Use a small radius scale.

Example:

```text
radius.none
radius.small
radius.medium
radius.large
radius.full
```

Define which component categories may use each radius.

Example:

- controls: `small` or `medium`;
- cards: `medium`;
- dialogs: `large`;
- badges: `small` or `full`;
- avatars: `full`.

Do not let each component invent its own radius.

Do not make all controls pill-shaped.

---

# Elevation architecture

Use restrained elevation.

Define:

- no elevation;
- subtle elevation;
- overlay elevation;
- modal elevation.

Prefer:

- background contrast;
- borders;
- dividers;
- spacing;

before adding shadows.

Shadows should normally be used for:

- dialogs;
- popovers;
- dropdown menus;
- floating panels;
- drag states.

Do not use large decorative shadows on ordinary operational cards.

---

# Border architecture

Define:

- width scale;
- style;
- semantic border colors;
- focus behavior;
- selected-state behavior;
- invalid-state behavior.

Do not communicate invalid state only through border color.

Do not add multiple nested borders without a structural reason.

---

# Motion architecture

Define:

- duration tokens;
- easing tokens;
- motion categories;
- reduced-motion behavior.

Example duration roles:

- `instant`;
- `fast`;
- `normal`;
- `slow`.

Motion should support:

- state change;
- continuity;
- overlay entry and exit;
- progress;
- feedback.

Do not use motion merely to create visual activity.

Do not animate layout properties that create unnecessary instability.

Respect reduced-motion preferences.

---

# Breakpoint architecture

Define breakpoints based on layout needs, not device brand names.

Possible semantic names:

- `compact`;
- `medium`;
- `wide`;
- `ultrawide`.

Tailwind names may remain:

- `sm`;
- `md`;
- `lg`;
- `xl`;
- `2xl`.

The design system must document what each breakpoint means operationally.

Example:

| Breakpoint | Operational meaning |
|---|---|
| `sm` | Single-column compact layout |
| `md` | Tablet layout with adapted navigation |
| `lg` | Standard application shell |
| `xl` | Multi-column operational workspace |
| `2xl` | Wide dashboard and split-pane layouts |

Do not create new breakpoints for individual pages without approval.

---

# Z-index architecture

Define a small semantic scale.

Example:

```text
z.base
z.sticky
z.dropdown
z.popover
z.drawer
z.modal
z.toast
z.tooltip
```

Do not introduce arbitrary values such as:

```text
z-[99999]
```

without investigating the stacking context.

Use portals consistently for overlays when supported by the component
foundation.

---

# Tailwind integration

Tailwind must consume the approved token system.

The implementation may map CSS variables into Tailwind utilities.

Example conceptual CSS:

```css
:root {
  --background-canvas: 0 0% 100%;
  --background-surface: 0 0% 98%;
  --text-primary: 222 47% 11%;
  --border-default: 214 32% 91%;
}

.dark {
  --background-canvas: 222 47% 6%;
  --background-surface: 222 35% 9%;
  --text-primary: 210 40% 98%;
  --border-default: 217 20% 20%;
}
```

Example conceptual component usage:

```tsx
<div className="bg-background text-foreground">
```

Adapt the exact configuration to the installed Tailwind version.

Do not silently mix Tailwind v3 and v4 configuration patterns.

---

# Tailwind usage policy

Prefer semantic utility classes.

Preferred:

```tsx
<div className="bg-background text-foreground border-border">
```

Avoid product code that directly consumes arbitrary palette values:

```tsx
<div className="bg-slate-950 text-slate-100 border-slate-700">
```

Direct palette utilities may be acceptable inside the design-system
implementation when they define semantic tokens.

Product screens should consume semantic classes or shared components.

Avoid arbitrary values:

```tsx
className="p-[19px] rounded-[11px] text-[13px]"
```

Use arbitrary values only when:

- the value comes from an approved external specification;
- a browser or third-party integration requires it;
- no system token is appropriate;
- the deviation is documented.

Tailwind is not a universal migration requirement. If another viable styling architecture is established, preserve it and bind it to the same token and component governance. Never add a Tailwind path beside the canonical architecture without an approved migration.

---

# shadcn/ui policy

The real authority hierarchy is:

```text
Radix (and equivalent headless-primitive libraries)
        ↓
primitive behavior, accessibility, keyboard interaction
        ↓
shadcn/ui source
        ↓
optional one-time bootstrap/accelerator
        ↓
the project's own internal design system (Level 1-4, see Component hierarchy)
        ↓
real, durable authority
```

Treat shadcn/ui as a **source accelerator**, not a component foundation the
project depends on or upgrades: its generated files are copied into the
project once, then owned exactly like any other Level 1/2 component — there
is no ongoing dependency relationship to preserve, and re-running the
generator to "sync" a component is not a legitimate maintenance path (see
"Do not repeatedly regenerate" below). The actual foundation the project
depends on is Radix (or the project's equivalent headless-primitive
library) for accessible primitive behavior, and the project's own design
system for everything semantic, product-specific, and governed.

shadcn/ui, when used, provides:

- a starting-point implementation built on Radix primitives;
- common interaction patterns already wired to those primitives;
- a fast way to bootstrap Level 1 components before the project has
  authored its own.

It does not automatically define, and copying it does not substitute for:

- product visual direction;
- product-specific semantic variants;
- content hierarchy;
- density;
- layout recipes;
- domain components;
- component governance.

When adding a shadcn/ui component:

1. inspect the generated implementation;
2. map it to product tokens;
3. remove unused variants;
4. add required semantic variants;
5. document its contract;
6. test keyboard behavior;
7. test themes;
8. test responsive behavior;
9. add stories;
10. avoid duplicating an existing primitive.

Do not repeatedly regenerate a component and overwrite project changes.

---

# Component hierarchy

Use four levels.

## Level 1 — Primitive

Examples:

- Button;
- Input;
- Label;
- Checkbox;
- Select;
- Dialog;
- Popover;
- Badge.

Characteristics:

- product-agnostic;
- highly reusable;
- no feature-specific data fetching;
- no domain-specific naming;
- stable API.

---

## Level 2 — Shared composite

Examples:

- FormField;
- PageHeader;
- FilterBar;
- EmptyState;
- MetricCard;
- DataTable;
- ConfirmationDialog;
- SearchInput.

Characteristics:

- composes primitives;
- reusable across several product areas;
- may express application-wide interaction conventions;
- does not own one specific feature workflow.

---

## Level 3 — Feature component

Examples:

- DeadlineReviewPanel;
- CaseStatusForm;
- DocumentUploadQueue;
- TenantActivationDialog.

Characteristics:

- belongs to one user capability;
- may use queries or mutations through feature hooks;
- uses shared components;
- understands domain terminology;
- follows feature permissions and states.

---

## Level 4 — Screen composition

Examples:

- CasePortfolioScreen;
- CaseDetailRoute;
- TenantAdministrationRoute.

Characteristics:

- composes features and entities;
- establishes route-level hierarchy;
- selects layout recipes;
- does not reimplement primitives or feature logic.

---

# Component contract requirements

Every stable shared component must define:

- component name;
- category;
- purpose;
- owner;
- implementation source;
- foundation source;
- anatomy and slots;
- public props;
- variants;
- sizes;
- states;
- responsive behavior;
- accessibility requirements;
- content rules;
- composition rules;
- design tokens used;
- approved usage;
- prohibited usage;
- examples;
- Storybook coverage;
- test coverage;
- status;
- version.

When the component renders a status, severity, or priority value that can
also appear for the same entity in another screen or component (a list row
and that entity's own detail view, for example), the contract must declare
`statusSource`: the name of the one canonical, exported selector/computation
that produces the value. Do not let the component compute or re-derive the
value locally from raw fields when a `statusSource` exists; consume it. When
the component renders more than one status-like vocabulary (for example a
generic severity and a domain lifecycle state), declare a `statusSource` per
vocabulary and never infer one vocabulary's tone from the other's data.

Use:

`assets/templates/component-contract.template.md`

Do not create a contract for trivial one-use local markup.

Create a contract when the component is:

- reused;
- part of the shared library;
- visually or behaviorally important;
- likely to be used by coding agents;
- safety or accessibility sensitive.

---

# Component API policy

Component APIs must express intent.

Preferred:

```tsx
<Button variant="danger">
  Excluir
</Button>
```

Avoid:

```tsx
<Button
  backgroundColor="red"
  textColor="white"
  borderColor="darkred"
>
  Excluir
</Button>
```

Prefer semantic props over low-level style props.

Avoid Boolean-prop proliferation.

Weak:

```tsx
<Button
  primary
  destructive
  compact
  outlined
/>
```

Preferred:

```tsx
<Button
  variant="danger"
  size="sm"
/>
```

Do not expose every CSS property as a component prop.

Use `className` escape hatches carefully.

An escape hatch must not become the default customization mechanism.

---

# Variant policy

Every variant must define:

- semantic intent;
- allowed contexts;
- prohibited contexts;
- visual treatment;
- interaction states;
- accessibility implications.

Example button variants:

- `primary`;
- `secondary`;
- `outline`;
- `ghost`;
- `link`;
- `danger`;
- `warning`, only when operationally justified.

Do not create variants based only on appearance:

- `blue`;
- `gold`;
- `gray`;
- `rounded`;
- `shadowed`.

A variant must communicate purpose.

---

# Size policy

Use a constrained size set.

Example:

- `sm`;
- `md`;
- `lg`;
- `icon`.

Define:

- visible height;
- horizontal padding;
- icon size;
- text style;
- target size;
- approved usage.

Do not let every consumer independently choose height and padding.

---

# Component state model

Components must consider relevant states.

Possible states:

- default;
- hover;
- active;
- focus-visible;
- disabled;
- loading;
- selected;
- invalid;
- read-only;
- expanded;
- collapsed;
- checked;
- indeterminate;
- unavailable.

Not every component needs every state.

States must be explicit rather than accidental CSS outcomes.

---

# Component anatomy

Define named slots for complex components.

Example:

```text
PageHeader
├── Breadcrumbs
├── TitleGroup
│   ├── Eyebrow
│   ├── Title
│   └── Description
├── Metadata
└── Actions
```

Named slots help agents understand where content belongs.

Avoid generic components with many unrelated children and no structural
contract.

---

# Composition rules

Component contracts must explain:

- what may be nested;
- what should not be nested;
- ordering;
- spacing ownership;
- responsive transformation;
- action placement;
- content limits.

Example:

- `PageHeader` owns spacing between title, metadata, and actions.
- Screens must not add arbitrary margins between internal header slots.
- `DialogFooter` owns action alignment.
- Forms must not place destructive actions beside primary submission without a
  separation rule.

---

# Spacing ownership

Every gap should have one owner.

Examples:

- a stack component owns vertical gaps between children;
- a form group owns spacing between label, control, help, and error;
- a page section owns spacing between its heading and content;
- a card owns internal padding;
- the page layout owns spacing between major sections.

Avoid both parent and child applying margins for the same relationship.

Prefer `gap` over child margins in repeated layouts.

---

# Responsive component contracts

A component contract must define whether the component:

- wraps;
- stacks;
- scrolls;
- collapses;
- truncates;
- moves actions into overflow;
- changes navigation pattern;
- switches to a drawer;
- becomes full width;
- remains desktop-only.

Do not assume responsiveness emerges automatically from flex and grid classes.

---

# Content contracts

Components must account for content shape.

Define when relevant:

- minimum content;
- maximum practical content;
- wrapping policy;
- truncation policy;
- tooltip policy;
- localization expansion;
- long identifier behavior;
- empty value behavior;
- number formatting;
- line-clamp behavior.

Do not truncate information that is critical to a decision without providing
access to the full value.

Do not use tooltips as the only access method for essential content.

---

# Accessibility contracts

Each component contract must define applicable requirements.

Examples:

- semantic element;
- keyboard interactions;
- focus behavior;
- accessible name;
- label association;
- state announcement;
- ARIA attributes;
- error association;
- screen-reader order;
- reduced-motion behavior;
- minimum contrast;
- color independence.

Prefer native HTML semantics before ARIA.

Do not add ARIA attributes that conflict with native behavior.

---

# Icon policy

Use one approved icon library unless an exception is documented.

Define:

- default icon size;
- stroke width;
- decorative icon behavior;
- icon-only button labels;
- status icon behavior;
- directional icon behavior.

Decorative icons should normally be hidden from assistive technology.

Interactive icon-only controls require accessible names.

Do not use an information icon beside every label.

---

# Feedback component policy

Shared feedback components must distinguish:

- loading;
- empty;
- no search results;
- error;
- warning;
- permission denied;
- unavailable;
- stale data;
- success;
- processing.

Do not use one generic feedback component with only a title and icon when the
states require different semantics or actions.

An empty state should not look like an error.

A warning should not look like a neutral informational panel.

---

# Data-display policy

Data-display components must define:

- hierarchy;
- density;
- alignment;
- numeric behavior;
- wrapping;
- sorting;
- selection;
- empty state;
- loading;
- row actions;
- responsiveness.

Numerical values should use tabular numerals when comparison benefits.

Table actions should not dominate the data.

Avoid equal visual prominence for every metric.

When a row, card, or list item's primary function is navigation to a fixed
destination, it must render as a native link (an `<a>` element or the
framework's Link component) with a real, resolvable `href` — never a
`<button>`/`onClick` div standing in for navigation — in every responsive
representation, including a collapsed mobile card. A native link supports
copy-link and open-in-new-tab; a button-styled row does not. This applies at
every breakpoint the component collapses to, not only the desktop table.

When a list or table applies a filter or a saved view, the displayed count
must reflect the set actually rendered, not a static total. Show "N of TOTAL"
(for example "2 of 16") whenever a filter narrows the set; never show the
unfiltered total while a filter is active.

When a prop or slot is documented as changing behavior at a specific
breakpoint (for example "column kept on the mobile card"), that documented
effect must have at least one test, story, or screenshot diff proving the
render actually differs; a documented responsive flag with no observable
effect is a drift risk, not a completed contract.

---

# Form-component policy

Form components must define:

- visible label;
- optional and required conventions;
- help text;
- error text;
- disabled state;
- read-only state;
- pending state;
- description association;
- input width behavior;
- responsive behavior.

Placeholder text must not replace a label.

Do not use color alone to communicate an invalid field.

---

# Layout-component policy

Shared layout components must establish:

- maximum widths;
- page padding;
- section spacing;
- column behavior;
- scroll ownership;
- sticky behavior;
- breakpoint transformation.

Do not add a generic `Card` around every section.

Use cards only when the content requires a distinct surface or interaction
boundary.

---

# Component implementation policy

Use:

- TypeScript;
- explicit prop types;
- `forwardRef` when required for interoperability;
- Radix or native primitives where appropriate;
- `class-variance-authority` or an approved equivalent for variants;
- a shared `cn` helper;
- token-backed classes;
- composition rather than style-prop APIs.

Do not use `React.FC` when the project convention avoids it.

Follow the approved project convention consistently.

Avoid exporting internal implementation helpers unless they are part of the
public contract.

---

# Storybook requirements

Stable shared components should include stories for meaningful states.

Possible stories:

- default;
- variants;
- sizes;
- long content;
- loading;
- disabled;
- invalid;
- dark theme;
- responsive narrow container;
- keyboard-focused;
- right-to-left when supported.

Do not create only one ideal-state story.

Stories should use realistic product content where appropriate.

---

# Component testing requirements

Test behavior rather than implementation details.

Depending on the component, test:

- semantic role;
- accessible name;
- keyboard operation;
- focus;
- disabled behavior;
- loading behavior;
- selection;
- dismissal;
- validation association;
- responsive transformation where testable;
- variant class contract;
- integration with forms.

Do not snapshot large implementation trees as the only test.

---

# Design-system validation

The design-system validation process must detect:

- raw colors outside approved token files;
- arbitrary spacing;
- arbitrary radii;
- arbitrary z-index;
- duplicate primitive components;
- component variants not in the registry;
- shared components without contracts;
- product components importing reference palette values;
- inline style usage;
- direct role comparisons in shared components;
- missing focus-visible styles;
- missing accessible names;
- page-level horizontal overflow;
- fixed heights that clip variable content;
- prohibited absolute positioning;
- mixed icon libraries;
- status colors used without text or icon support;
- missing Storybook states;
- missing component tests.
- component, page, or BEM selectors added to global stylesheets without authority;
- a parallel styling mechanism;
- modified existing classes without ownership evidence;
- mismatch between implementation and `styling-authority.json`.

Blocking checks:

- `STATUS-001` — a status/severity/priority value rendered for the same
  entity in more than one screen or component computes from more than one
  formula instead of a single declared `statusSource`.
- `DATA-DISPLAY-LINK-001` — a row/card whose primary function is navigation
  to a fixed destination renders as a non-anchor element (no real `href`).
- `DATA-DISPLAY-COUNT-001` — a filtered or viewed list's displayed count does
  not reflect the rendered set (an unfiltered total shown while a filter
  narrows the result).
- `PROP-EFFECT-001` — a prop/slot documented as changing render at a
  breakpoint has no test, story, or screenshot evidence that it actually
  does.
- `DS-RECIPE-001` (warning) — an ad hoc element's class list overlaps a
  significant subset of a registered shared component's canonical class
  recipe (for example manually typing `rounded-lg border bg-card` instead of
  composing `Card`), signaling that the shared component should be composed
  instead of its recipe partially copied. This is distinct from "duplicate
  primitive components" above, which only catches a full reimplementation.

Some checks may be automated.

Others require browser or human review.

Every check in `design-system.json` must define:

- identifier;
- severity;
- description;
- automated or manual;
- blocking or advisory;
- relevant script or inspection method.

---

# Severity model

Use:

## `error`

A violation that must block completion.

Examples:

- inaccessible shared control;
- unknown destructive variant;
- raw sensitive backend value exposed;
- page-level horizontal overflow;
- duplicate canonical primitive.

## `warning`

A violation requiring review.

Examples:

- arbitrary value with no documented reason;
- missing story for a meaningful state;
- component contract not yet approved.

## `info`

A non-blocking recommendation.

Examples:

- possible consolidation;
- token candidate;
- documentation improvement.

---

# Governance

## Adding a token

Before adding a token:

1. search for an existing semantic equivalent;
2. identify the consumer;
3. identify whether the need is global or component-specific;
4. select the correct token layer;
5. define themes;
6. define description;
7. update machine-readable registry;
8. update implementation;
9. add validation where useful.

Do not add tokens solely to avoid reusing an existing appropriate value.

---

## Adding a component

Before adding a shared component:

1. identify repeated or system-wide need;
2. search the existing catalog;
3. identify hierarchy level;
4. define contract;
5. identify foundation component;
6. define variants and states;
7. map tokens;
8. implement stories;
9. implement tests;
10. register the component;
11. validate in a representative screen.

Do not add a shared abstraction based on one speculative use.

---

## Changing a component

Before changing a stable component:

1. inspect all consumers;
2. classify change as compatible or breaking;
3. update contract;
4. update stories;
5. update tests;
6. validate representative screens;
7. document migration when breaking.

Do not alter shared defaults merely to solve one screen.

Use a valid variant or improve the composition model.

---

## Deprecating a component

A deprecated component must define:

- reason;
- replacement;
- migration example;
- affected consumers;
- removal condition;
- status in registry.

Do not delete a shared component immediately after adding a replacement.

---

# Agent behavior

Before creating UI code, the agent must:

1. read the approved design direction;
2. read `design-system.json`;
3. identify the intended component hierarchy;
4. identify approved tokens;
5. identify existing components;
6. identify the layout recipe;
7. identify missing contracts;
8. avoid creating unregistered shared patterns.

After implementation, the agent must:

1. run design-system checks;
2. inspect rendered output;
3. compare with approved direction;
4. test content variation;
5. test responsive behavior;
6. update contracts when the system intentionally changed;
7. report deviations.

---

# Design-system completion gate

Foundation-level design system work passes only when:

- [ ] `design-system.json` validates against its schema.
- [ ] Token layers are explicit.
- [ ] Semantic color roles are complete.
- [ ] Typography roles are explicit.
- [ ] Spacing, sizing, radius, elevation, border, motion, breakpoint, and
      z-index systems are explicit.
- [ ] Tailwind integration is defined.
- [ ] shadcn/ui integration is defined.
- [ ] Canonical primitive locations are defined.
- [ ] Foundational components are registered.
- [ ] Component contracts exist for foundational shared components.
- [ ] Variant semantics are explicit.
- [ ] Accessibility requirements are explicit.
- [ ] Responsive requirements are explicit.
- [ ] Validation checks are registered.
- [ ] Governance rules are documented.
- [ ] Representative components render in Storybook.
- [ ] Light and dark themes are validated when supported.
- [ ] No unresolved blocking design-system decision remains.

Use one status:

- `APPROVED_FOR_COMPONENT_IMPLEMENTATION`;
- `APPROVED_WITH_SYSTEM_LIMITATIONS`;
- `BLOCKED_BY_DESIGN_SYSTEM_DECISIONS`.

---

# Required report

At the end of design-system work, report:

## Inputs

Design direction, architecture, references, and existing components inspected.

## Tokens

Token layers created or changed.

## Components

Components registered, implemented, changed, or deprecated.

## Contracts

Human-readable contracts created or updated.

## Integration

Tailwind, shadcn/ui, Storybook, and theme integration.

## Validation

Schema validation, tests, stories, browser inspection, and adherence checks.

## Deviations

Any direct values, exceptions, or temporary compatibility decisions.

## Artifact

Path to:

`docs/frontend/design-system/design-system.json`

## Gate status

One of the design-system statuses defined above.


## Semantic Presentation Registry

O registry canônico de apresentação semântica vive em `design-system.json#visualGrammar.perceptualPolicy.presentationRoles`; não crie um arquivo paralelo para esse papel. Cada chave representa um papel semântico de dados do produto e resolve uma `componentFamily` com política de consistência `strict|contextual`. A invariável local é `same semantic role -> same component family`: uma screen que declara o papel `status`, por exemplo, deve usar a família registrada para `status`, e não escolher uma segunda família por preferência estética.

Os nomes concretos de papéis e famílias são decisões do Design System do produto, não universais. `status -> StatusBadge`, `classification -> ClassificationBadge` e `reusable-reference -> ReferenceValue` são exemplos do template, não uma lista obrigatória para todo projeto. Adicione/remova papéis no registry quando o domínio exigir, preserve a relação semântica e valide a família contra o component catalog canônico. Impeccable pode detectar/criticar inconsistência de apresentação, mas não cria nem altera silenciosamente este registry.
