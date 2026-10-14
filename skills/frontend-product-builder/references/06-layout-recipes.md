# Layout Recipes

## Purpose

Define reusable page-composition contracts for frontend creation.

A layout recipe establishes the structural decisions that must be made before
screen-level JSX is written.

Recipes prevent coding agents from treating every screen as a blank canvas and
improvising:

- page hierarchy;
- region placement;
- column structure;
- navigation;
- action placement;
- scrolling;
- surface usage;
- density;
- progressive disclosure;
- responsive behavior;
- loading, empty, error, and permission states.

A recipe is not a finished screen.

It is a constrained composition model that receives:

- product context;
- screen contract;
- design-system components;
- domain content;
- feature components;
- responsive requirements.

---

# Required artifacts

The skill provides reusable recipes under:

`assets/recipes/`

A project may reference these recipes directly or create approved project-level
extensions under:

```text
docs/frontend/layout-recipes/
├── application-shell.json
├── operational-dashboard.json
├── case-detail.json
└── ...
```

Use:

- `assets/schemas/layout-recipe.schema.json`;
- `assets/templates/layout-recipe.template.json`.

Do not duplicate a skill-level recipe at project level unless the project
requires an intentional extension or override.

Project-level recipes must record:

- base recipe;
- changed regions;
- changed responsive behavior;
- project-specific constraints;
- reason for divergence.

---

# Recipe source precedence

Use this order:

1. approved product specification;
2. approved product context;
3. approved design direction;
4. approved frontend architecture;
5. approved design system;
6. approved project-level layout recipe;
7. skill-level layout recipe;
8. screen implementation.

A screen must not silently override the structural rules of its recipe.

When the recipe conflicts with product requirements:

1. identify the conflict;
2. determine whether the recipe is unsuitable or outdated;
3. propose a recipe extension or new recipe;
4. obtain approval;
5. update the recipe registry;
6. only then implement the screen.

---

# Core rule

Do not implement a product screen without selecting an approved layout recipe.

The selected recipe must be recorded in the screen contract.

Invalid implementation workflow:

```text
Functional requirement
        ↓
Open route component
        ↓
Start adding divs
        ↓
Adjust until it looks acceptable
```

Required workflow:

```text
Functional requirement
        ↓
Product context
        ↓
Screen classification
        ↓
Layout recipe selection
        ↓
Region and component map
        ↓
Screen contract
        ↓
Implementation
        ↓
Rendered validation
```

---

# What a recipe controls

A recipe must control, when applicable:

- screen archetype;
- required regions;
- optional regions;
- region order;
- region hierarchy;
- cardinality;
- allowed component categories;
- prohibited component categories;
- spacing ownership;
- surface hierarchy;
- page width;
- column behavior;
- sticky behavior;
- scroll ownership;
- action placement;
- overflow behavior;
- responsive transformation;
- state placement;
- accessibility landmarks;
- focus sequence;
- heading hierarchy;
- validation checks.

A recipe must not define:

- backend business rules;
- API response shapes;
- product-specific labels;
- tenant permissions;
- exact production data;
- feature-specific mutation behavior;
- brand values already owned by design tokens.

---

# Machine-readable craft and presence defaults

Recipe prose explains intent, but coding agents must not infer structural presence or
base geometry from prose. Migrated recipes therefore expose two machine-readable
contracts:

- `craftDefaults` owns reusable region geometry and structural surface roles;
- `presenceDefaults` owns whether each structural region is always present,
  conditionally present, or never present.

`visibilityCondition` remains explanatory documentation only. It is not an execution
condition and must not be parsed heuristically.

For a migrated recipe family:

- every recipe region has one spatial assignment;
- every recipe region has one presence rule;
- `always` regions remain `required=true` with cardinality minimum at least one;
- `conditional` regions remain `required=false` with cardinality minimum zero;
- typed presence signals express real product state or capability, never prompt wording;
- a mandatory region may remain `always` when its purpose includes rendering an
  honest empty, unavailable, forbidden, or disabled state;
- semantic critical/danger meaning is separate from structural surface layering.

When a screen selects a migrated recipe, the craft adapter projects these defaults
only for the selected regions and records the recipe hash in the derived craft
contract. Screen-specific decisions may refine unresolved dimensions, but they must
not silently contradict these recipe relationships.

---

# Screen classification

Before selecting a recipe, classify the screen by its dominant user task.

## Application shell

Use when the screen belongs to an authenticated application environment with
persistent global navigation and shared context.

Typical concerns:

- primary navigation;
- organization or tenant context;
- user menu;
- global utilities;
- content canvas;
- scroll ownership;
- compact navigation transformation.

---

## Dashboard

Use when the screen helps users:

- monitor;
- prioritize;
- compare;
- identify exceptions;
- decide what to work on next.

A dashboard is not a collection of every available metric.

It must support an operational or analytical decision.

---

## Searchable list

Use when the dominant task is:

- locate records;
- filter records;
- compare rows;
- select records;
- perform contextual or bulk actions;
- navigate to details.

---

## Entity detail

Use when the dominant task is understanding, reviewing, editing, or acting on
one domain entity.

Examples:

- case;
- customer;
- invoice;
- tenant;
- user;
- document;
- request.

---

## Form workflow

Use when the dominant task is creating or editing structured information.

The form may be:

- single page;
- grouped sections;
- side panel;
- dialog;
- wizard.

---

## Administration

Use when users configure:

- accounts;
- tenants;
- roles;
- permissions;
- integrations;
- feature availability;
- system settings.

Administration interfaces usually have lower task frequency but higher action
sensitivity.

---

## Authentication

Use for:

- login;
- password recovery;
- account activation;
- multifactor verification;
- session recovery.

Authentication screens require strong clarity and limited distraction.

---

## Review and approval

Use when users must:

- compare evidence;
- inspect automated output;
- review changes;
- approve;
- reject;
- request correction;
- record a human decision.

This recipe is especially important for legal, financial, medical, governance,
or AI-assisted workflows.

---

# Recipe-selection workflow

## Step 1 — Identify the primary job

Use the approved product context.

Record:

- user;
- trigger;
- desired outcome;
- task frequency;
- task urgency;
- decision information;
- primary action;
- failure consequence.

---

## Step 2 — Identify the dominant interaction

Choose one dominant mode:

- navigation;
- monitoring;
- searching;
- comparing;
- reviewing;
- creating;
- editing;
- approving;
- configuring.

A screen may support several actions, but the recipe must be selected according
to the dominant task.

---

## Step 3 — Identify data shape

Record:

- collection versus single entity;
- expected item count;
- text lengths;
- number of metrics;
- number of actions;
- number of sections;
- whether comparison is required;
- whether audit context is required;
- whether content is asynchronous;
- whether the user must retain context while acting.

---

## Step 4 — Select candidate recipes

Select at most three plausible recipes.

Do not create several candidates when one recipe clearly fits.

---

## Step 5 — Score recipe fit

Evaluate each candidate from 1 to 5.

| Criterion | Suggested weight |
|---|---:|
| Primary-task fit | 25% |
| Information-hierarchy fit | 20% |
| Data-shape fit | 15% |
| Action-hierarchy fit | 10% |
| Responsive fit | 10% |
| Accessibility fit | 10% |
| Reuse of existing components | 5% |
| Implementation risk | 5% |

Document the selected recipe in the screen contract.

---

# Recipe anatomy

Every recipe must define these areas.

## Metadata

- ID;
- name;
- version;
- status;
- category;
- owner;
- source;
- description.

## Purpose

- user problem;
- dominant task;
- outcome supported.

## Applicability

- use when;
- do not use when;
- required product inputs.

## Regions

Each region defines:

- ID;
- name;
- role;
- order;
- required or optional;
- cardinality;
- content priority;
- allowed components;
- prohibited components;
- spacing ownership;
- sticky behavior;
- scroll behavior;
- responsive behavior.

## Composition

Defines:

- layout model;
- page container;
- width policy;
- columns;
- vertical rhythm;
- surface hierarchy;
- spacing ownership;
- nesting rules.

## Actions

Defines:

- primary action placement;
- secondary action placement;
- destructive action placement;
- overflow behavior;
- maximum dominant actions;
- narrow-layout transformation.

## Content

Defines:

- density;
- heading behavior;
- width behavior;
- truncation;
- long-content handling;
- empty-state placement;
- loading behavior;
- error scope.

## Responsive behavior

Defines transformations between:

- compact;
- medium;
- wide;
- ultrawide.

Responsive design is represented as structural change, not merely breakpoint
class names.

## States

Defines where and how the recipe presents:

- loading;
- empty;
- partial;
- error;
- unavailable;
- forbidden;
- stale;
- processing.

## Accessibility

Defines:

- landmarks;
- heading hierarchy;
- focus order;
- keyboard expectations;
- announcements;
- minimum target;
- contrast;
- color independence.

## Constraints

Defines:

- required component categories;
- prohibited patterns;
- performance constraints;
- data-magnitude assumptions;
- implementation restrictions.

## Validation

Defines:

- automated checks;
- browser checks;
- manual checks;
- blocking severity.

---

# Region model

A region is a structural slot in the layout.

Examples:

```text
SearchableList
├── PageHeader
├── SearchAndFilters
├── ActiveFilterSummary
├── BulkActionToolbar
├── ResultsSummary
├── ResultsTable
├── Pagination
└── ContextualDetails
```

Regions are not necessarily visual cards.

A region may render:

- directly in the page canvas;
- on a surface;
- in a sidebar;
- inside a drawer;
- in a dialog;
- in an overflow menu;
- conditionally.

---

# Region ordering

Region order must follow user-task hierarchy.

Typical sequence:

1. orientation;
2. critical attention;
3. decision information;
4. primary action support;
5. detailed content;
6. secondary context;
7. audit or technical detail.

Do not order regions according to backend response structure.

Do not place infrequent administrative actions before the main task.

---

# Content priority

Use these priority levels:

- `critical`;
- `primary`;
- `supporting`;
- `contextual`;
- `audit`.

A recipe must define how lower-priority content is progressively disclosed.

Possible patterns:

- secondary surface;
- collapsible section;
- side panel;
- drawer;
- overflow menu;
- secondary navigation;
- details element;
- audit tab.

Do not collapse critical content.

---

# Spacing ownership

Every structural gap must have one owner.

Examples:

- the page recipe owns spacing between major regions;
- a section owns spacing between its heading and body;
- a form group owns field spacing;
- a card owns internal padding;
- a toolbar owns action gaps;
- a table owns row and cell spacing.

Do not add page-specific margins to compensate for an unclear recipe.

Avoid parent gap and child margin controlling the same relationship.

---

# Surface policy

Recipes must explicitly identify which regions require distinct surfaces.

A separate surface is justified when it represents:

- a different interaction boundary;
- a selected or editable unit;
- a nested context;
- a floating layer;
- a critical status;
- a grouped comparison;
- a meaningful visual containment.

A surface is not justified merely because the content exists.

Do not wrap every region in a card.

---

# Width policy

Recipes must define one of these width models:

- constrained;
- fluid;
- hybrid;
- split;
- full-bleed within shell.

## Constrained

Use for:

- forms;
- long-form reading;
- authentication;
- focused task flows.

## Fluid

Use for:

- operational tables;
- dense dashboards;
- multi-panel workspaces.

## Hybrid

Use when:

- header and forms are constrained;
- tables or dashboards require fluid width.

## Split

Use for:

- master-detail;
- review-and-approval;
- comparison.

Do not allow each section to independently choose its width model.

---

# Scroll ownership

Every recipe must define who controls scrolling.

Possible owners:

- browser document;
- application content canvas;
- table region;
- side panel;
- modal;
- drawer.

Avoid several nested vertical scroll containers.

Nested scrolling must be intentional and tested with:

- keyboard;
- touchpad;
- touch;
- zoom;
- screen readers.

Sticky elements must remain inside the correct scroll container.

---

# Sticky behavior

Sticky elements may include:

- application navigation;
- page actions;
- table header;
- filter bar;
- details panel;
- review actions.

Use sticky behavior only when it improves task continuity.

Do not create several stacked sticky bars that consume a large part of the
viewport.

The recipe must define:

- sticky container;
- offset;
- stacking order;
- narrow-layout behavior;
- collision behavior.

---

# Action hierarchy

Every recipe must define:

- primary action region;
- secondary actions;
- contextual row or item actions;
- destructive actions;
- bulk actions;
- overflow actions.

Rules:

- one region normally contains at most one dominant primary action;
- export is normally secondary;
- destructive actions are visually and spatially separated;
- infrequent actions may move to overflow;
- mobile action reduction must preserve the primary task;
- actions must not be repeated in several regions without justification.

---

# Filters and search

Recipes containing filters must define:

- immediate versus apply-button behavior;
- URL ownership;
- active-filter display;
- clear-all behavior;
- compact-layout transformation;
- server versus client filtering;
- pagination reset behavior.

Filters must not occupy most of the screen before results become visible unless
the workflow explicitly requires advanced search.

---

# Navigation within screens

Possible patterns:

- tabs;
- section navigation;
- anchor navigation;
- segmented control;
- step navigation;
- side navigation;
- select menu;
- accordion;
- grouped overflow navigation.

Do not use a long horizontal tab row when labels can overflow.

The recipe must define the narrow-layout transformation.

---

# Tables and result regions

Recipes using data tables must define:

- column priority;
- row density;
- sorting;
- selection;
- contextual actions;
- bulk actions;
- pagination;
- loading;
- empty;
- error;
- horizontal overflow;
- narrow-layout strategy.

Do not automatically transform every table into cards.

Possible narrow strategies:

- controlled internal horizontal scroll;
- reduced columns;
- column chooser;
- master-detail;
- summary rows;
- alternate card representation.

The choice depends on task and data.

---

# Metric regions

Dashboard recipes must classify metrics.

Possible groups:

- critical;
- financial;
- operational;
- quality;
- progress;
- informational.

Do not present every metric with the same visual weight.

A metric should normally include:

- label;
- value;
- context;
- trend or comparison when meaningful;
- freshness when relevant;
- action or drill-down when useful.

---

# Empty-state placement

The recipe must distinguish:

- entire screen empty;
- section empty;
- no search results;
- no filtered results;
- unavailable data;
- missing configuration;
- permission restriction;
- processing state.

An entire-screen empty state belongs near the main task region.

A section-empty state should not replace unrelated successful sections.

---

# Loading strategy

Recipes must specify:

- initial route loading;
- section loading;
- background refresh;
- mutation pending;
- deferred panel loading.

Avoid replacing an entire populated screen with a skeleton during background
refresh.

Avoid layout shift caused by unrealistic skeleton dimensions.

---

# Error scope

Errors should appear at the smallest valid boundary.

Examples:

- field;
- form;
- table;
- dashboard widget;
- details panel;
- route;
- application.

A failed secondary panel should not necessarily destroy the main screen.

The recipe should define whether partial success is supported.

---

# Responsive transformation

Responsive behavior must be expressed as transformation rules.

Examples:

```text
Wide:
Page header actions remain inline.

Medium:
Secondary actions move to overflow.

Compact:
Primary action becomes full width below title.
```

Examples:

```text
Wide:
Filters remain visible in a horizontal toolbar.

Medium:
Filters wrap into two rows.

Compact:
Filters move into a drawer and active-filter chips remain visible.
```

Examples:

```text
Wide:
Detail screen uses main content plus contextual aside.

Medium:
Aside moves below primary content.

Compact:
Aside content moves into grouped expandable sections.
```

Do not describe responsiveness only as:

- add `md:grid-cols-2`;
- add `lg:flex-row`.

The recipe must explain why and what changes.

---

# Viewport model

Use the design-system breakpoints.

Interpret them operationally:

- compact: constrained width and reduced simultaneous content;
- medium: adapted navigation and stacked secondary regions;
- wide: standard application workspace;
- ultrawide: optional additional columns or persistent context.

Do not add recipe-specific breakpoints unless the layout cannot be expressed
with the approved scale.

---

# Zoom and text scaling

Validate recipes at:

- standard zoom;
- 125% zoom;
- long localized labels;
- increased text size where supported.

A layout that only works at 100% zoom is not complete.

Do not clip content with fixed heights.

---

# Accessibility landmarks

Recipes should map structural regions to appropriate semantics.

Examples:

- `<header>`;
- `<nav>`;
- `<main>`;
- `<aside>`;
- `<section>`;
- `<form>`;
- `<footer>`.

Do not create several unlabeled navigation landmarks.

Sections should have accessible headings when they represent meaningful
document structure.

---

# Heading hierarchy

A recipe must define:

- one route-level `h1`;
- section heading progression;
- card heading behavior;
- dialog title behavior;
- hidden headings where semantics require them.

Do not select heading elements based on font size. Use
`visualHierarchy.visualPriorityLadder` and semantic text styles to express
visual priority.

---

# Focus order

Focus order should generally follow:

1. global navigation;
2. page orientation;
3. page actions;
4. filters;
5. main content;
6. contextual content;
7. secondary actions.

Exceptions must be justified by task flow.

Responsive transformation must preserve a logical focus sequence.

---

# Recipe extension

Extend a recipe when:

- the dominant task remains the same;
- the existing structural model still fits;
- only some regions or constraints differ.

A project-level extension must define:

```json
{
  "extends": "searchable-list",
  "overrides": {
    "regions": [],
    "responsive": {}
  }
}
```

The exact implementation may differ, but the conceptual relationship must be
recorded.

---

# New recipe creation

Create a new recipe when:

- no existing recipe fits the dominant task;
- extension would override most structural rules;
- a new interaction model is required;
- the responsive transformation is fundamentally different;
- the screen represents a recurring new archetype.

Before creating a new recipe:

1. identify at least one real screen;
2. identify probable reuse;
3. define why existing recipes fail;
4. create a draft using the template;
5. validate against the schema;
6. implement one representative screen;
7. validate in the browser;
8. approve or revise the recipe;
9. only then use it widely.

Do not create speculative recipes for hypothetical future screens.

---

# Recipe status

Use:

## `experimental`

The recipe is being validated by representative screens.

## `stable`

The recipe has:

- approved structure;
- approved responsive behavior;
- representative implementation;
- browser validation;
- no unresolved blocking issues.

## `deprecated`

The recipe must define:

- replacement;
- migration guidance;
- remaining consumers;
- removal condition.

---

# Recipe validation

Every recipe should define checks for:

- required regions;
- region order;
- primary action count;
- surface usage;
- scroll ownership;
- responsive behavior;
- page overflow;
- heading hierarchy;
- landmark structure;
- focus order;
- state placement;
- prohibited patterns.

Validation methods may include:

- JSON Schema;
- static script;
- lint;
- component test;
- browser test;
- screenshot comparison;
- manual review.

---

# Recipe-selection anti-patterns

Do not:

- select a recipe based only on visual preference;
- use dashboard for any page containing cards;
- use searchable list for small static collections;
- use entity detail for multi-entity comparison;
- use a form workflow for read-only review;
- use horizontal tabs for every detail screen;
- create a custom layout before evaluating existing recipes;
- override most of a recipe locally;
- wrap every region in a card;
- place all actions in the page header;
- allow filters to displace the primary content excessively;
- use fixed viewport heights without understanding scroll ownership;
- create nested vertical scrolling accidentally;
- use absolute positioning for ordinary composition;
- treat desktop and mobile as scaled versions of the same arrangement;
- declare a recipe stable before browser validation.

---

# Required screen-recipe report

Before screen implementation, report:

## Screen classification

The dominant task and interaction mode.

## Candidate recipes

Recipes evaluated.

## Selection

Selected recipe and score rationale.

## Regions

Required and optional regions used.

## Component map

Components assigned to each region.

## Deviations

Project-specific extensions or omissions.

## Responsive transformation

How the recipe changes across approved viewports.

## Risks

Content, overflow, density, or state risks.

## Gate status

Use one:

- `APPROVED_FOR_SCREEN_CONTRACT`;
- `APPROVED_WITH_RECIPE_LIMITATIONS`;
- `BLOCKED_BY_LAYOUT_DECISIONS`.

---

# Layout-recipe completion gate

A recipe passes only when:

- [ ] It validates against the recipe schema.
- [ ] Its dominant task is explicit.
- [ ] Applicability is explicit.
- [ ] Required and optional regions are defined.
- [ ] Region order is explicit.
- [ ] Spacing ownership is explicit.
- [ ] Surface policy is explicit.
- [ ] Width policy is explicit.
- [ ] Scroll ownership is explicit.
- [ ] Action hierarchy is explicit.
- [ ] State placement is explicit.
- [ ] Responsive transformations are explicit.
- [ ] Accessibility landmarks are explicit.
- [ ] Focus order is explicit.
- [ ] Prohibited patterns are explicit.
- [ ] Validation checks are explicit.
- [ ] A representative implementation exists before stable status.
- [ ] No blocking layout decision remains.

Use one status:

- `APPROVED_FOR_REPRESENTATIVE_SCREEN`;
- `APPROVED_WITH_LAYOUT_LIMITATIONS`;
- `BLOCKED_BY_LAYOUT_DECISIONS`.
