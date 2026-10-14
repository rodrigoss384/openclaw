# Design Direction for Frontend Creation

## Purpose

Translate approved product context into explicit, implementable visual and
interaction constraints before full-screen implementation.

Design direction is not decoration and is not a collection of subjective
adjectives.

A valid direction must control:

- hierarchy;
- density;
- layout character;
- typography;
- surfaces;
- semantic color;
- spacing rhythm;
- shape;
- elevation;
- iconography;
- motion;
- data presentation;
- interaction feedback;
- responsive behavior.

The result must reduce the number of visual decisions the coding agent is
allowed to improvise.

For substantial frontend work, continue into `13-visual-composition.md` and
produce a composition proof before broad build readiness.

---

# Required inputs

Before defining design direction, inspect:

1. `docs/frontend/product-context.md`;
2. approved product specifications;
3. existing brand rules, when available;
4. accessibility and localization constraints;
5. target devices and viewports;
6. reference screenshots or prototypes;
7. existing design-system artifacts, when applicable.

Do not define a direction while discovery is
`BLOCKED_BY_PRODUCT_DECISIONS`.

---

# Required output

Use:

`assets/templates/design-direction.template.md`

Create the project artifact at:

`docs/frontend/design-direction.md`

The artifact must be approved before implementing several product screens.

A small technical foundation may be prepared first when necessary, but do not
build the product interface around an unapproved visual direction.

---

# Direction workflow

## Step 1 — Translate product evidence into visual requirements

Extract implications from the product context.

Examples:

| Product evidence | Visual implication |
|---|---|
| Users review dozens of records per hour | Compact density and persistent filters |
| Errors can cause legal harm | Strong warning hierarchy and explicit confirmations |
| Users work primarily on desktop | Desktop operational shell with tested tablet fallback |
| Long procedural labels are common | Flexible text wrapping and no fixed-height cards |
| Configuration is infrequent | Administrative actions receive lower prominence |
| AI output requires human approval | Visually distinguish suggestion from confirmed decision |

Do not copy visual patterns from another product without checking task fit.

---

## Step 2 — Define the product interface archetype

Choose the dominant archetype.

Examples:

- dense operational workspace;
- analytical control center;
- review-and-approval workspace;
- structured case-management interface;
- guided transactional workflow;
- content-centric application;
- self-service customer portal;
- administrative console.

The archetype constrains the direction.

A dense operational workspace should not behave like a marketing landing page.

An administrative console should not use decorative hero sections.

---

## Step 3 — Define visual attributes operationally

Avoid leaving attributes as vague adjectives.

Translate each attribute into concrete rules.

### Invalid

- modern;
- beautiful;
- premium;
- clean;
- intuitive;
- elegant.

### Valid

- use a restrained neutral surface system with one primary accent;
- use medium-to-high information density;
- use compact page headers;
- use an 8-point spacing rhythm;
- use subtle elevation only for overlays;
- use borders rather than large shadows for section separation;
- use one primary action per section;
- use tabular numerals for financial values;
- use responsive grids that collapse from four to two to one column.

Adjectives may appear only when followed by implementable consequences.

---

# Direction candidate policy

## Default behavior

Compare at least two materially different directions and select one. This is the
`design-authority-bounded` contract in `prompts/spec-driven/autonomy-policy.json`
(`minimumCandidates: 2`), enforced by
`integrations/frontend/product-design-control.mjs` (`PDA-03`).

Comparison is not decoration: the selected direction must carry a thesis, one
subject-specific signature element and one justified aesthetic risk, and must
name the generic defaults it rejected. `PDA-04` rejects a direction that cannot
show product, audience and task specificity instead of a generic template.

Do not manufacture candidates that differ only cosmetically — that fails the
"meaningful structural dimensions" test below and wastes the comparison.

## Ambiguous behavior

When major visual decisions are genuinely ambiguous, propose at most three
candidates.

Each candidate must differ in meaningful structural dimensions, such as:

- density;
- navigation model;
- surface hierarchy;
- layout family;
- emphasis strategy.

Do not create candidates that differ only in accent color.

---

# Candidate evaluation

Score each candidate from 1 to 5 on:

- task efficiency;
- information clarity;
- domain fit;
- accessibility;
- scalability across screens;
- responsiveness;
- component reuse;
- implementation risk;
- maintenance cost;
- brand compatibility.

Use a weighted recommendation rather than selecting by taste.

Suggested default weights:

| Criterion | Weight |
|---|---:|
| Task efficiency | 18% |
| Information clarity | 18% |
| Domain fit | 14% |
| Accessibility | 14% |
| Distinctiveness and brand compatibility | 12% |
| Scalability | 8% |
| Responsiveness | 8% |
| Implementation risk | 4% |
| Maintenance cost | 4% |

Distinctiveness carries real weight on purpose. A rubric whose weight is entirely
utilitarian selects the least distinctive workable direction every time, which is
how correct-but-generic interfaces get produced. Score distinctiveness on whether
the direction is specific to this product, audience and task — not on how
decorated it is.

Adjust weights only when product evidence justifies it.

---

# Design dimensions

## 1. Density

Choose:

- `spacious`;
- `comfortable`;
- `comfortable-compact`;
- `compact`;
- `dense`.

Define density separately for:

- application shell;
- forms;
- tables;
- dashboards;
- mobile adaptation.

A product may use compact tables and comfortable forms.

Do not apply one density blindly to every component.

Document:

- standard control height;
- table row height;
- card padding;
- page section gap;
- content maximum width;
- minimum touch target.

---

## 2. Layout family

Choose the dominant page-composition family.

Examples:

- sidebar shell with content canvas;
- top-navigation shell;
- split workspace;
- master-detail;
- dashboard grid;
- single-column task flow;
- multi-panel review workspace;
- searchable list plus details drawer.

The layout family must be compatible with the screen recipes that will be used.

Do not select a layout family based only on visual novelty.

---

## 3. Application shell

Define:

- navigation placement;
- navigation width;
- expanded and collapsed behavior;
- global header behavior;
- organization or tenant context;
- user menu;
- breadcrumbs;
- page-width behavior;
- scroll ownership;
- mobile navigation transformation.

Avoid repeating the same navigation information in several places.

Avoid headers that consume excessive vertical space in operational products.

---

## 4. Content hierarchy

Define visual treatment for:

- page title;
- page description;
- entity context;
- critical alert;
- KPI;
- section title;
- primary data;
- secondary metadata;
- audit detail;
- technical detail.

Specify which content can be:

- visible immediately;
- collapsed;
- placed in a drawer;
- placed in an overflow menu;
- placed in a secondary tab;
- available only in an audit view.

Do not use cards as the default container for every piece of content.

---

## 5. Typography

Define:

- interface font family;
- fallback stack;
- heading behavior;
- body behavior;
- label behavior;
- metadata behavior;
- numerical behavior;
- code or identifier behavior;
- maximum heading sizes;
- line-height policy;
- text-width policy.

For data-heavy applications, consider:

- tabular numerals;
- restrained heading scale;
- strong label/value distinction;
- legible small text;
- predictable wrapping.

Do not use excessively thin font weights for important operational content.

Do not use uppercase labels indiscriminately.

---

## 6. Semantic color

Define roles, not page-specific colors.

Required semantic roles:

- canvas;
- surface;
- elevated surface;
- subdued surface;
- primary text;
- secondary text;
- muted text;
- default border;
- strong border;
- primary action;
- primary-action contrast;
- success;
- warning;
- danger;
- information;
- focus;
- selection;
- disabled.

Document whether the product supports:

- light mode;
- dark mode;
- both;
- system preference.

A dark product still requires semantic surface levels and accessible contrast.

Do not use the primary brand color for every action and status.

Do not use danger color decoratively.

---

## 7. Surface hierarchy

Define a limited surface system.

Example:

- Level 0: application canvas;
- Level 1: primary content surface;
- Level 2: nested or interactive surface;
- Level 3: overlay;
- Critical surface: warning or danger context.

For each level, define:

- background role;
- border behavior;
- elevation behavior;
- common usage.

Avoid arbitrary combinations of white cards, dark backgrounds, gradients, and
shadows unless the direction explicitly requires them.

---

## 8. Spacing rhythm

Select a base rhythm, normally 4 or 8 pixels.

Define:

- inline gap;
- control gap;
- field gap;
- card padding;
- section gap;
- page padding;
- modal padding;
- table cell padding.

The final token values will be created in the design-system phase.

Do not use whitespace to compensate for missing hierarchy.

Do not leave large unused areas without a documented purpose.

---

## 9. Shape and radius

Define:

- button radius;
- input radius;
- card radius;
- modal radius;
- badge radius;
- pill usage.

Use a small, coherent radius scale.

Do not assign a different radius to each component.

Do not make every component pill-shaped.

---

## 10. Elevation and borders

Define when to use:

- border;
- shadow;
- background contrast;
- divider;
- overlay.

For operational applications, prefer restrained elevation.

Use stronger elevation mainly for:

- dialogs;
- popovers;
- menus;
- floating panels;
- drag states.

Do not use large shadows to separate ordinary page sections.

---

## 11. Iconography

Define:

- icon library;
- default sizes;
- stroke behavior;
- filled-icon policy;
- status icon policy;
- icon-only control policy;
- decorative-icon policy.

Every icon-only interactive control must have an accessible name.

Do not use different icon families without justification.

Do not use information icons beside every label.

---

## 12. Motion

Define:

- whether motion is minimal, moderate, or expressive;
- duration range;
- easing principles;
- allowed transition types;
- loading motion;
- overlay motion;
- reduced-motion behavior.

Motion should communicate:

- state change;
- continuity;
- hierarchy;
- progress.

Do not animate routine layout movement without purpose.

Do not block interaction with decorative animation.

---

## 13. Actions

Define visual hierarchy for:

- primary;
- secondary;
- tertiary;
- ghost;
- link;
- destructive;
- warning;
- disabled;
- loading.

Rules must include:

- maximum dominant actions per section;
- button ordering;
- destructive confirmation;
- icon-only usage;
- full-width usage;
- toolbar usage;
- mobile transformation.

Do not use the same visual treatment for saving, exporting, disabling, and
deleting.

---

## 14. Forms

Define:

- label placement;
- required-field convention;
- help-text convention;
- validation timing;
- error placement;
- success confirmation;
- field grouping;
- maximum comfortable form width;
- multi-column behavior;
- destructive action placement;
- sticky action behavior.

Do not create arbitrary field widths based only on available screen width.

Field width should reflect expected input length and grouping.

---

## 15. Tables and lists

Define:

- table versus card-list criteria;
- row density;
- column priority;
- sticky-header policy;
- horizontal-scroll policy;
- truncation policy;
- bulk-action behavior;
- empty-state behavior;
- pagination behavior;
- mobile transformation.

Do not force every desktop table into a mobile card layout.

Some operational tables may use controlled horizontal scrolling or a
master-detail pattern.

---

## 16. Dashboards and metrics

Define:

- number of top-level KPI groups;
- distinction between critical, financial, operational, and informational data;
- comparison-period behavior;
- trend treatment;
- chart policy;
- metric-card hierarchy;
- zero-state behavior;
- freshness display.

Avoid grids containing many equally prominent metrics.

A dashboard must help users decide or act, not merely display available data.

---

## 17. Status and feedback

Define visual patterns for:

- loading;
- skeleton;
- progress;
- success;
- warning;
- danger;
- information;
- empty;
- unavailable;
- unauthorized;
- stale;
- offline;
- automated suggestion;
- human-confirmed result.

Do not use error styling for neutral absence of data.

Do not present automated recommendations as confirmed facts.

---

## 18. Responsive strategy

Define transformation rules, not only breakpoints.

For each major pattern, document what happens when space decreases.

Examples:

- four KPI columns → two → one;
- horizontal page actions → overflow menu;
- side-by-side review panels → stacked panels;
- persistent filters → filter drawer;
- sidebar → compact rail → drawer;
- tabs → grouped navigation or select;
- full metadata → prioritized metadata with progressive disclosure.

Specify:

- minimum supported viewport;
- desktop target viewport;
- tablet behavior;
- mobile behavior;
- zoom expectation;
- text scaling expectation.

Do not claim mobile support when the workflow is intentionally desktop-only.

State the limitation explicitly.

---

# Reference-image policy

When screenshots, Figma frames, Penpot files, Stitch outputs, or other product
references exist:

1. identify the structural pattern;
2. identify hierarchy;
3. identify density;
4. identify spacing rhythm;
5. identify typography behavior;
6. identify interaction patterns;
7. identify useful component patterns;
8. identify what does not fit the product context.

Do not reproduce references mechanically.

Do not copy visual defects merely because they appear in the reference.

Do not infer hidden behavior from a static image without marking it as an
assumption.

Record every approved reference in `docs/frontend/styling-authority.json` with its source, approved aspects, excluded aspects and approval evidence. A reference project may calibrate rhythm, typography, palette, component anatomy or motion, but it does not become the code architecture or override product, accessibility, brand or design-system contracts.

---

# Freehand-prevention rules

Before implementation, the approved direction must constrain:

- one primary layout family;
- one typography system;
- one semantic color system;
- one spacing scale;
- one radius scale;
- one elevation policy;
- one icon family;
- one motion policy;
- one responsive strategy;
- one action hierarchy.

If the agent still has to invent these separately on each page, the direction
is incomplete.

---

# Representative-screen policy

Before creating many screens, choose representative archetypes.

Recommended minimum:

1. one authentication or entry screen;
2. one high-density operational screen;
3. one detailed entity or form screen.

The representative screens validate:

- shell;
- typography;
- surface hierarchy;
- component variants;
- density;
- responsive behavior;
- long content;
- feedback states.

Do not build the entire screen inventory before representative patterns are
approved.

---

# Direction approval gate

Design direction is complete only when:

- it is grounded in product evidence;
- density is explicit;
- layout family is explicit;
- shell behavior is explicit;
- typography behavior is explicit;
- semantic color roles are explicit;
- surface hierarchy is explicit;
- spacing and shape policies are explicit;
- actions and statuses are semantically distinct;
- forms and data presentation have rules;
- responsive transformations are explicit;
- prohibited patterns are recorded;
- representative screens are selected;
- unresolved design decisions are visible.

Use one status:

- `APPROVED_FOR_FOUNDATION`;
- `APPROVED_WITH_LIMITATIONS`;
- `BLOCKED_BY_DESIGN_DECISIONS`.

---

# Anti-patterns

Do not:

- define a direction only as “modern and clean”;
- select colors before understanding hierarchy and states;
- create every page with the same card grid;
- use gradients as a substitute for hierarchy;
- use the brand accent for all controls;
- use a large hero header in an operational workspace without justification;
- use oversized headings in data-dense screens;
- treat whitespace as universally positive;
- choose mobile-first layouts without understanding the real workflow;
- create multiple candidates that differ only cosmetically;
- begin full-screen implementation before approval;
- mix component libraries casually;
- allow each page to establish its own visual rules.

---

# Required design-direction report

At the end of direct mode, report:

## Evidence

Product-context sections and references used.

## Recommended direction

The selected direction and its operational rationale.

## Candidate comparison

Only when multiple candidates were genuinely necessary.

## Constraints established

Density, layout, typography, surfaces, actions, forms, data display, states, and
responsiveness.

## Representative screens

Screens selected to validate the system.

## Open decisions

Questions requiring human visual or product approval.

## Artifact

Path to `docs/frontend/design-direction.md`.

## Gate status

One of the direction statuses defined above.
