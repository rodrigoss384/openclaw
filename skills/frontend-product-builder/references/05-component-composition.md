# Component Composition and Catalog Governance

## Purpose

Define how coding agents select, reuse, configure, compose, extend, create,
register, test, and retire frontend components.

This reference prevents uncontrolled component creation and visual drift.

It establishes:

- canonical component ownership;
- component hierarchy;
- component selection procedure;
- reuse and extension rules;
- composition boundaries;
- public API requirements;
- data-access restrictions;
- state ownership;
- dependency rules;
- responsive contracts;
- accessibility contracts;
- catalog registration;
- duplicate detection;
- screen-to-component mapping;
- promotion and deprecation rules;
- completion gates.

The agent must not begin a screen by freely creating JSX.

The agent must first identify:

1. the selected layout recipe;
2. the regions required by the recipe;
3. the components assigned to each region;
4. the existing canonical components;
5. the missing capabilities;
6. whether the missing capability is local, shared, or domain-specific;
7. the tests and contracts required.

---

# Required artifacts

Component-system work must use:

- `assets/schemas/component-catalog.schema.json`;
- `assets/templates/component-catalog.template.json`;
- `assets/templates/screen-contract.template.md`;
- `assets/templates/component-map.template.md`.

Project-level artifacts:

```text
docs/frontend/
├── screens/
│   └── <screen-id>/
│       ├── screen-contract.md
│       └── component-map.md
└── design-system/
    ├── design-system.json
    ├── component-catalog.json
    └── components/
        ├── button.md
        ├── page-header.md
        └── ...
```

The project may generate `component-catalog.json` from approved catalog
fragments.

When generated, do not edit the generated file manually.

---

# Sources of truth

Use this precedence:

1. approved product requirements;
2. approved product context;
3. approved design direction;
4. approved frontend architecture;
5. approved layout recipe;
6. approved screen contract;
7. approved component map;
8. machine-readable component catalog;
9. human-readable component contracts;
10. canonical implementation;
11. screen-level implementation.

A screen-level implementation must not redefine a shared component contract.

When the catalog and implementation disagree:

1. inspect approval history;
2. identify whether implementation drifted;
3. identify whether the catalog is stale;
4. stop before propagating the inconsistency;
5. update the correct source through an explicit change.

---

# Component hierarchy

Use four implementation levels.

## Level 1 — Primitive

A primitive represents one low-level interaction or semantic element.

Examples:

- Button;
- Input;
- Textarea;
- Checkbox;
- RadioGroup;
- Select;
- Dialog;
- Popover;
- Tooltip;
- Badge;
- Separator;
- Skeleton.

Characteristics:

- product-agnostic;
- stable public API;
- no domain terminology;
- no feature-specific queries;
- no route knowledge;
- no business permissions;
- reusable across the complete application.

Typical locations:

```text
src/components/ui/
```

Examples of invalid primitives:

```text
ApproveDeadlineButton
LegalCaseInput
TenantDeleteDialog
```

These names contain domain or workflow meaning and therefore belong to a higher
layer.

---

## Level 2 — Shared composite

A shared composite combines primitives into a reusable product-wide pattern.

Examples:

- FormField;
- PageHeader;
- EntityHeader;
- FilterBar;
- SearchInput;
- EmptyState;
- ErrorState;
- ConfirmationDialog;
- MetricCard;
- DataTable;
- Pagination;
- StatusBadge;
- StickyActionBar;
- SectionNavigation.

Characteristics:

- reusable in several features;
- may understand product-wide interaction conventions;
- may express application-wide semantics;
- does not own one feature's business workflow;
- does not fetch one feature's domain data directly.

Typical locations:

```text
src/components/
├── layout/
├── feedback/
├── navigation/
├── data-display/
└── forms/
```

---

## Level 3 — Feature or domain component

A feature component belongs to one user capability.

Examples:

- DeadlineReviewPanel;
- CaseStatusUpdateForm;
- DocumentUploadQueue;
- TenantActivationDialog;
- PermissionAssignmentPanel;
- ReviewDecisionForm.

Characteristics:

- understands domain terminology;
- may use feature-owned hooks;
- may evaluate capability through approved permission helpers;
- may orchestrate form or mutation behavior;
- composes primitives and shared composites;
- belongs to one feature's public API.

Typical location:

```text
src/features/<feature-name>/components/
```

A reusable entity presentation component may live under:

```text
src/entities/<entity-name>/components/
```

---

## Level 4 — Screen or route composition

A screen composes regions from an approved layout recipe.

Examples:

- CasePortfolioRoute;
- CaseDetailRoute;
- TenantAdministrationRoute;
- DeadlineReviewRoute;
- LoginRoute.

Characteristics:

- owns route-level composition;
- selects or applies one layout recipe;
- composes features and entities;
- coordinates route boundaries;
- does not reimplement primitives;
- does not contain raw HTTP calls;
- does not contain large validation schemas;
- does not become a monolithic workflow implementation.

Typical location:

```text
src/routes/<route-area>/
```

---

# Canonical component ownership

Every reusable component must have one canonical owner.

The catalog must define:

- canonical name;
- hierarchy level;
- category;
- owner;
- implementation path;
- public import path;
- contract path;
- foundation;
- status;
- version.

Examples:

| Component | Canonical owner |
|---|---|
| Button | `components/ui` |
| FormField | `components/forms` |
| PageHeader | `components/layout` |
| EmptyState | `components/feedback` |
| DataTable | `components/data-display` |
| DeadlineReviewPanel | `features/deadline-review` |
| CaseSummary | `entities/case` |

Do not create a second owner because the existing component is inconvenient.

Investigate whether the inconvenience indicates:

- an invalid use case;
- a missing variant;
- a missing slot;
- a composition problem;
- an overly restrictive API;
- an unrelated component incorrectly selected.

---

# Component-selection procedure

Before creating or importing a component, use this sequence.

## Step 1 — Identify the region

Determine:

- selected layout recipe;
- region ID;
- region role;
- content priority;
- allowed component categories;
- prohibited components;
- responsive behavior;
- accessibility landmark.

Do not select a component without understanding its region.

---

## Step 2 — Identify required capability

Describe the required capability without naming an implementation.

Examples:

```text
Allow the user to submit the primary form action.
```

```text
Show that no records match the active filters and allow clearing filters.
```

```text
Present entity identity, current status, essential metadata, and one action.
```

Avoid starting with:

```text
I need another card.
```

```text
I need a blue button.
```

```text
I need a flex container.
```

These describe implementation or appearance rather than capability.

---

## Step 3 — Search the catalog

Search by:

- capability;
- category;
- allowed recipe;
- hierarchy level;
- semantic role;
- variant;
- state;
- allowed parent;
- allowed child.

Do not search only by exact component name.

A component may already implement the required capability under a different
user-oriented name.

---

## Step 4 — Inspect candidate contracts

For each plausible component, inspect:

- purpose;
- use cases;
- prohibited use cases;
- anatomy;
- public props;
- variants;
- sizes;
- states;
- responsive behavior;
- accessibility;
- content limits;
- composition rules;
- dependencies;
- Storybook coverage;
- tests.

Do not select a component based only on its screenshot.

---

## Step 5 — Choose one disposition

Use exactly one initial disposition:

- `REUSE`;
- `CONFIGURE`;
- `COMPOSE`;
- `EXTEND`;
- `CREATE_LOCAL`;
- `CREATE_SHARED`;
- `CREATE_DOMAIN`;
- `BLOCKED`.

Record the disposition in the component map.

---

# Disposition rules

## `REUSE`

Use when an existing component satisfies the capability without contract
changes.

Example:

```tsx
<Button variant="primary">
  Salvar alterações
</Button>
```

No catalog change is required unless the component usage reveals missing
documentation.

---

## `CONFIGURE`

Use when an approved variant, size, slot, or composition option satisfies the
capability.

Example:

```tsx
<Button
  variant="danger"
  size="sm"
>
  Revogar acesso
</Button>
```

Do not create a wrapper solely to select a variant.

Invalid:

```tsx
function RedDeleteButton(props) {
  return <Button variant="danger" {...props} />;
}
```

unless the wrapper adds stable domain behavior rather than visual convenience.

---

## `COMPOSE`

Use when several existing components together satisfy the capability.

Example:

```tsx
<EmptyState>
  <EmptyState.Icon>
    <SearchX />
  </EmptyState.Icon>

  <EmptyState.Title>
    Nenhum processo encontrado
  </EmptyState.Title>

  <EmptyState.Description>
    Ajuste a busca ou remova alguns filtros.
  </EmptyState.Description>

  <EmptyState.Actions>
    <Button variant="outline" onClick={clearFilters}>
      Limpar filtros
    </Button>
  </EmptyState.Actions>
</EmptyState>
```

Composition should use approved slots and ownership rules.

Do not compose primitives into a second unofficial version of an existing
shared component.

---

## `EXTEND`

Use when the existing component is conceptually correct but lacks a reusable
capability.

Extension requires:

1. inspect all existing consumers;
2. define the missing semantic capability;
3. verify that the capability is not screen-specific;
4. update the component contract;
5. update the machine-readable catalog;
6. update implementation;
7. add stories;
8. add tests;
9. validate representative consumers.

Valid extension:

```text
DataTable lacks an approved row-density variant used by several operational
lists.
```

Potentially invalid extension:

```text
One screen needs a 37px table row.
```

The second case is likely a local deviation or an incorrect design decision.

---

## `CREATE_LOCAL`

Use for implementation that:

- belongs to one screen;
- has no probable reuse;
- contains no canonical interaction behavior;
- is simple composition;
- does not justify catalog registration.

Example:

```text
CaseFinancialExposureSummary
```

when it is a small screen-specific composition with no reuse.

Local components should normally live near the owning screen or feature.

A local component must still consume:

- approved tokens;
- approved primitives;
- approved layout rules;
- approved accessibility semantics.

`CREATE_LOCAL` does not permit visual improvisation.

---

## `CREATE_SHARED`

Use only when the capability:

- recurs across multiple unrelated features;
- represents product-wide behavior;
- has stable semantics;
- has a meaningful public contract;
- can be tested independently;
- belongs in the design system or shared component library.

Creating a shared component requires:

- component contract;
- catalog entry;
- Storybook stories;
- tests;
- representative integration;
- approval status.

Do not create a shared component for hypothetical reuse.

---

## `CREATE_DOMAIN`

Use when the capability:

- contains domain terminology;
- belongs to one entity or feature;
- is reusable inside that domain;
- may orchestrate approved domain hooks;
- should not become globally product-agnostic.

Examples:

- CaseIdentity;
- DeadlineStatusBadge;
- DocumentProcessingState;
- TenantCapabilitySummary.

Domain components may wrap shared components while adding domain mapping.

They must not duplicate primitive visual implementations.

---

## `BLOCKED`

Use when:

- no component fits;
- the product requirement is unclear;
- the layout recipe conflicts with the intended behavior;
- the missing capability would change a stable shared contract broadly;
- the component needs an unresolved API contract;
- accessibility behavior cannot be determined;
- responsive transformation is unknown;
- a duplicate canonical component already exists and ownership is disputed.

Do not resolve architectural ambiguity by creating another component.

---

# Reuse-first rule

Before creating any component, the agent must search:

```text
src/components
src/features
src/entities
docs/frontend/design-system/components
docs/frontend/design-system/component-catalog.json
~/.agents/skills/frontend-product-builder/assets/catalog
```

Search for:

- names;
- semantic capability;
- visual role;
- props;
- variants;
- slots;
- Storybook stories;
- similar markup;
- similar tests.

The final report must state what was searched.

---

# Duplicate detection

Potential duplicate indicators include:

- similar JSX structure;
- same underlying Radix primitive;
- same prop purpose;
- same visual role;
- same interaction behavior;
- same accessible role;
- same layout-recipe region;
- names containing suffixes such as:
  - `New`;
  - `Modern`;
  - `Better`;
  - `Custom`;
  - `V2`;
  - `Updated`;
  - `Alternative`;
  - `LegacyReplacement`.

Names do not prove duplication, but they require investigation.

Examples requiring review:

```text
Button.tsx
ModernButton.tsx
PrimaryButton.tsx
ActionButton.tsx
```

```text
Card.tsx
DashboardCard.tsx
InfoCard.tsx
GenericCard.tsx
```

A specialized composite is valid only when its contract differs meaningfully.

---

# Naming rules

Component names should describe semantic responsibility.

Preferred:

```text
PageHeader
EntityHeader
FilterBar
FormErrorSummary
ReviewDecisionForm
CriticalAlertGroup
```

Avoid names based only on appearance:

```text
BluePanel
RoundedBox
DarkCard
LargeWhiteModal
```

Avoid temporary names:

```text
NewHeader
BetterTable
CardV2
FinalButton
```

Avoid implementation names at feature level:

```text
FlexContainer
GridWrapper
StyledDiv
```

Layout utilities may have structural names when their responsibility is clear:

```text
Stack
Cluster
ContentGrid
SplitPane
PageContainer
```

---

# Public API principles

Component APIs must communicate intent.

Preferred:

```tsx
<StatusBadge tone="warning">
  Prazo próximo
</StatusBadge>
```

Avoid:

```tsx
<StatusBadge
  background="#78350f"
  color="#fef3c7"
  border="#92400e"
>
  Prazo próximo
</StatusBadge>
```

Preferred:

```tsx
<EntityHeader
  title={caseName}
  status={<CaseStatusBadge status={status} />}
  metadata={<CaseMetadata items={metadata} />}
  actions={<CaseHeaderActions caseId={caseId} />}
/>
```

Avoid a large prop surface with unrelated visual controls:

```tsx
<EntityHeader
  titleMarginTop={13}
  useBlueBorder
  compactSubtitle
  leftIconOffset={7}
  actionGap={19}
/>
```

---

# Prop policy

A public prop must have:

- consumer requirement;
- stable semantic meaning;
- explicit type;
- documented default when optional;
- interaction or visual consequence;
- test coverage when behaviorally meaningful.

Avoid adding props solely to bypass the component contract.

Potential warning signs:

```text
noPadding
customPadding
removeBorder
customBorder
useOldSpacing
forceMobile
disableResponsive
```

These props may indicate:

- incorrect parent selection;
- missing slot;
- incorrect spacing ownership;
- invalid variant;
- local override of a shared rule.

---

# Boolean prop policy

Prefer one semantic enum over several conflicting Boolean props.

Weak:

```tsx
<Button
  primary
  secondary
  destructive
  outlined
  compact
/>
```

Preferred:

```tsx
<Button
  variant="danger"
  size="sm"
/>
```

Boolean props remain appropriate for genuine binary state:

- `disabled`;
- `loading`;
- `readOnly`;
- `required`;
- `open`;
- `selected`.

---

# Slot policy

Complex shared components should expose named structural slots.

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

Slots clarify:

- content ownership;
- order;
- spacing;
- responsiveness;
- optionality;
- cardinality.

Do not expose an unrestricted `children` area when consumers require several
unrelated semantic regions.

Do not create a large component with dozens of props when composition slots
would be clearer.

---

# Controlled and uncontrolled behavior

Components with interactive state must document whether they are:

- controlled;
- uncontrolled;
- controlled with an optional initial value;
- stateless composition.

Examples:

```tsx
<Tabs
  value={activeTab}
  onValueChange={setActiveTab}
/>
```

```tsx
<Dialog defaultOpen={false} />
```

Do not mix controlled and uncontrolled ownership unintentionally.

Do not copy a controlled prop into local state without lifecycle analysis.

---

# Data access policy

## Primitives

Must not:

- call APIs;
- use feature query hooks;
- know tenant IDs;
- read route parameters;
- evaluate business permissions.

## Shared composites

Normally must not:

- call feature APIs;
- own domain queries;
- depend on one backend DTO;
- navigate to one feature route.

Shared composites may use application-wide infrastructure when required, such
as:

- theme context;
- localization;
- generic form context;
- overlay context;
- generic table state.

## Domain and feature components

May use:

- feature-owned queries;
- feature-owned mutations;
- approved capability helpers;
- domain formatters;
- domain schemas.

## Screen components

May coordinate:

- route parameters;
- route-level query preconditions;
- feature composition;
- route error boundaries;
- layout recipe selection.

Screens must not become transport layers.

---

# Side-effect policy

Component contracts must identify side effects.

Possible side effects:

- navigation;
- mutation;
- file selection;
- clipboard;
- focus movement;
- scroll movement;
- document title;
- telemetry;
- browser storage;
- external link.

Low-level visual components should avoid hidden side effects.

A button must not navigate merely because its label is “Abrir”.

Navigation should be explicit through:

- link semantics;
- callback;
- route composition;
- domain action.

---

# Reference resolution policy

Any component that cites, links, or previews another domain object,
document, or excerpt by id must declare `referenceResolution` on its
`componentUsage`:

- `routed`: a real route for the target exists and is inside the current
  slice's scope. Render a native link/Link component with a real, resolvable
  `href`. This is required whenever a row, card, or list item's primary
  function is navigation to a fixed destination (see the design-system
  Data-display policy) — never a `<button onClick>` standing in for it.
- `overlay-resolved`: no route exists yet, or the target's route is out of
  the current slice's scope. Render a non-navigational trigger (a button,
  not an anchor) that opens a centralized overlay/panel resolved through one
  shared selector. Never render a dead `#` href, `javascript:void(0)`, or a
  guessed route as a placeholder for a route that does not exist yet.

Do not let a citation silently fall back to a dead link when its target
route has not been built. Choosing `overlay-resolved` is the correct,
honest alternative — it is not a downgrade to route it later.

For any overlay, popover, dialog, or panel opened from a specific trigger
element, the focus contract must explicitly name "return focus to the
triggering element (via ref), not the nearest focusable ancestor" as the
default; deviations require a written reason.

---

# Permission policy

Shared components do not interpret domain role names.

Invalid:

```tsx
if (user.role === "ADMIN") {
  return <Button>Excluir</Button>;
}
```

Preferred feature composition:

```tsx
const canDelete = useCapability("case.delete");

return canDelete
  ? <Button variant="danger">Excluir</Button>
  : null;
```

The backend remains authoritative.

Component contracts may define how missing capability is presented:

- hidden;
- disabled with explanation;
- read-only;
- forbidden state.

---

# Error ownership

Components must not display raw errors by default.

The error path should be:

```text
transport error
    ↓
normalized frontend error
    ↓
feature interpretation
    ↓
approved feedback component
    ↓
user-operational message
```

Shared feedback components receive safe content.

They do not parse arbitrary backend response bodies.

---

# Responsive ownership

Each component must define its own internal transformation.

The parent layout recipe defines placement and region transformation.

Example:

```text
Layout recipe:
Page-header actions move below the title in compact view.

PageHeader component:
Actions wrap, secondary actions may move to overflow, and title text remains
readable.
```

The screen must not reimplement component responsiveness through one-off class
overrides.

---

# Spacing ownership

Every gap must have one owner.

Component contracts must define:

- internal padding owner;
- gap between slots;
- outer spacing allowance;
- nested component behavior.

Examples:

- `PageContainer` owns page horizontal padding.
- `Section` owns heading-to-content spacing.
- `FormField` owns label-to-control-to-error spacing.
- `Stack` owns sibling vertical gaps.
- `Card` owns internal padding.
- `DialogFooter` owns action alignment and gaps.

Avoid:

```tsx
<PageHeader className="mb-8">
  ...
</PageHeader>

<section className="mt-8">
  ...
</section>
```

when both margins represent the same relationship.

The recipe or parent stack should own this gap.

---

# Surface ownership

A shared component must state whether it owns a surface.

Examples:

- `Card` owns a surface.
- `Section` normally does not.
- `PageHeader` normally does not require a card surface.
- `Dialog` owns an elevated overlay surface.
- `EmptyState` may render with or without a containing surface according to its
  parent.

Do not wrap components in additional cards to create arbitrary visual depth.

---

# Content variability

Every stable component should be validated with:

- shortest plausible content;
- typical content;
- longest plausible content;
- empty optional content;
- missing values;
- localized expansion;
- large numbers;
- zero values;
- long identifiers;
- multiline errors;
- unavailable states.

Fixture content must be domain-plausible.

Do not approve a component using only:

```text
John Doe
Example
123
Lorem ipsum
```

---

# Component dependency direction

Use this default direction:

```text
screen
  ↓
feature
  ↓
entity
  ↓
shared composite
  ↓
primitive
```

Rules:

- primitives must not import composites;
- shared composites must not import feature components;
- entities must not import features;
- features must not import routes;
- component contracts must list direct component dependencies;
- circular component dependencies are blocking.

A component may compose another component at the same level when ownership is
clear and no cycle is introduced.

---

# Provider policy

Avoid providers for state used by only one small subtree.

A provider requires justification when it:

- crosses several deeply nested consumers;
- represents application infrastructure;
- owns stable shared state;
- prevents excessive prop threading;
- has an explicit lifecycle.

Examples of plausible providers:

- QueryClientProvider;
- ThemeProvider;
- RouterProvider;
- FormProvider;
- approved DataTable context;
- approved overlay or command-menu context.

Invalid provider creation:

```text
DashboardCardSpacingProvider
```

```text
ButtonColorProvider
```

```text
CurrentModalButtonProvider
```

These likely represent incorrect component APIs or local state.

---

# Local component policy

A local component remains local when:

- used by one screen or feature;
- tightly coupled to one screen's content;
- not a canonical interaction pattern;
- unlikely to be reused;
- simple enough to understand near its consumer.

Do not register every extracted JSX fragment in the shared catalog.

Local extraction may improve readability without creating a design-system
component.

Examples:

```text
CaseExposureSummary
DeadlineReviewIntroduction
TenantMigrationWarning
```

---

# Promotion policy

Promote a local or domain component to shared only when evidence exists.

Suggested promotion indicators:

- used in at least three unrelated product areas;
- same semantic capability repeats;
- copies begin to diverge;
- accessibility behavior should be centralized;
- interaction behavior is difficult to implement safely;
- product-wide consistency has measurable value.

Promotion steps:

1. identify existing consumers;
2. define common semantic capability;
3. remove feature-specific assumptions;
4. create shared contract;
5. register in catalog;
6. migrate one representative consumer;
7. validate;
8. migrate remaining consumers incrementally.

Do not create a highly generic API to support every historical difference.

---

# Demotion policy

A shared component may be demoted when:

- only one consumer remains;
- its API became feature-specific;
- abstraction adds more complexity than reuse value;
- consumers use incompatible override patterns;
- a simpler canonical component replaced it.

Demotion requires:

- consumer inventory;
- replacement plan;
- catalog status update;
- contract update;
- import migration;
- deletion only after validation.

---

# Composition planning

Before implementing a screen, create:

```text
docs/frontend/screens/<screen-id>/screen-contract.md
docs/frontend/screens/<screen-id>/component-map.md
```

The component map must connect:

```text
Layout recipe
    ↓
Regions
    ↓
Capabilities
    ↓
Selected components
    ↓
Disposition
    ↓
Data owner
    ↓
State owner
    ↓
Responsive behavior
    ↓
Accessibility
    ↓
Tests
```

Do not start screen implementation while required regions remain unmapped.

---

# Screen contract requirements

Every non-trivial route must define:

- screen ID;
- route;
- primary user;
- primary task;
- selected recipe;
- information hierarchy;
- data dependencies;
- permissions;
- primary action;
- secondary actions;
- states;
- responsive transformations;
- accessibility requirements;
- acceptance criteria;
- open decisions.

Use:

`assets/templates/screen-contract.template.md`

---

# Component map requirements

Every non-trivial screen must map:

- recipe region;
- required capability;
- selected component;
- hierarchy level;
- catalog status;
- disposition;
- component owner;
- data owner;
- state owner;
- props and variants;
- responsive transformation;
- accessibility behavior;
- tests;
- deviations.

Use:

`assets/templates/component-map.template.md`

---

# Screen implementation sequence

Use this sequence:

1. read product context;
2. read design direction;
3. read architecture;
4. select layout recipe;
5. create screen contract;
6. map recipe regions;
7. search component catalog;
8. assign components;
9. resolve missing component decisions;
10. update contracts when required;
11. implement static composition;
12. implement states;
13. connect data;
14. connect mutations;
15. test responsive behavior;
16. test accessibility;
17. run duplicate and design-system audits;
18. update artifacts;
19. report gate status.

Do not connect API calls before the screen hierarchy and states are understood.

---

# Static composition before integration

For substantial screens, first validate composition using controlled fixtures.

The fixture should include:

- realistic labels;
- realistic long values;
- status variation;
- zero values;
- unavailable values;
- loading;
- empty;
- error;
- restricted state;
- narrow viewport.

The static composition is not production completion.

It is a visual and structural validation stage.

Do not leave hardcoded fixtures inside production behavior.

---

# Component contract synchronization

When a component changes, synchronize:

```text
Machine-readable catalog entry
Human-readable contract
Implementation
Storybook stories
Tests
Representative screenshots
Consumer documentation when required
```

A change is incomplete when only the JSX was updated.

---

# Breaking component changes

A component change is potentially breaking when it modifies:

- public prop name;
- prop type;
- default variant;
- default size;
- slot order;
- focus behavior;
- keyboard behavior;
- DOM semantics;
- accessible name source;
- controlled-state behavior;
- responsive transformation;
- default spacing;
- default surface;
- export path.

Breaking changes require:

- consumer inventory;
- migration strategy;
- version update;
- contract update;
- catalog update;
- representative browser validation.

---

# Component status

Use:

## `experimental`

The component:

- is being validated;
- may have limited consumers;
- may change before broad adoption;
- still requires representative testing.

## `stable`

The component has:

- approved contract;
- approved catalog entry;
- stable public API;
- meaningful Storybook states;
- component tests;
- accessibility validation;
- responsive validation;
- representative production consumer.

## `deprecated`

The component defines:

- replacement;
- reason;
- migration;
- remaining consumers;
- planned removal condition.

Do not introduce new consumers of deprecated components.

---

# Catalog-fragment policy

Skill-level catalogs may be divided by category:

```text
assets/catalog/
├── foundational-components.json
├── layout-components.json
├── feedback-components.json
├── data-display-collection-components.json
├── data-display-analytical-components.json
├── form-field-foundation-components.json
├── form-field-control-components.json
└── form-workflow-components.json
```

Project-level assembly may add:

```text
docs/frontend/design-system/catalog/
├── domain-components.json
├── project-layout-components.json
└── project-overrides.json
```

All fragments must:

- validate against the catalog schema;
- use unique canonical names;
- use unique IDs;
- avoid conflicting public imports;
- avoid conflicting ownership;
- avoid duplicate semantic capabilities.

The assembly script must fail on collisions.

---

# Validation requirements

The component-catalog validation process must detect:

- duplicate component IDs;
- duplicate canonical names;
- duplicate public import paths;
- missing contract paths;
- missing implementation paths;
- invalid hierarchy dependencies;
- circular dependencies;
- unknown variants;
- unknown sizes;
- unknown states;
- missing accessibility requirements;
- missing responsive behavior;
- stable components without tests;
- stable components without Storybook stories where applicable;
- deprecated components without replacements;
- shared components importing feature modules;
- primitives importing product domains;
- screens using unregistered shared components;
- local components duplicating canonical components;
- recipe regions mapped to prohibited component categories.

Some checks are automated.

Others require browser or manual validation.

---

# Anti-patterns

Do not:

- create a component before searching the catalog;
- create wrappers that only rename a visual variant;
- use `Custom`, `Modern`, `New`, or `V2` to bypass canonical ownership;
- create a shared component for one speculative screen;
- put feature queries inside primitives;
- put route navigation inside generic visual components;
- add many Boolean visual props;
- expose CSS properties as component props;
- use `className` as the primary customization contract;
- create providers for local state;
- duplicate form-field behavior;
- duplicate dialog behavior;
- duplicate table behavior;
- register trivial markup as a design-system component;
- create one universal component with dozens of unrelated modes;
- change shared defaults to solve one screen;
- use inherited backend DTO names as component names;
- create a local version of a shared component because its import is
  inconvenient;
- claim reuse without checking accessibility and responsive contracts;
- call a component stable before representative integration.

---

# Required component decision report

For each created or materially changed component, report:

## Capability

The interface capability required.

## Candidates inspected

Existing components and contracts evaluated.

## Disposition

One of:

- `REUSE`;
- `CONFIGURE`;
- `COMPOSE`;
- `EXTEND`;
- `CREATE_LOCAL`;
- `CREATE_SHARED`;
- `CREATE_DOMAIN`;
- `BLOCKED`.

## Ownership

Canonical owner and public import.

## Contract changes

Props, slots, variants, states, responsive, or accessibility changes.

## Consumers

Existing and representative consumers.

## Validation

Stories, tests, browser checks, and design-system audits.

## Risks

Breaking behavior, migration, or visual drift.

---

# Screen-composition completion gate

A screen passes component planning only when:

- [ ] An approved layout recipe is selected.
- [ ] A screen contract exists.
- [ ] Every required recipe region is mapped.
- [ ] Every mapped capability has a selected component or explicit blocked
      decision.
- [ ] Existing components were searched.
- [ ] Dispositions are recorded.
- [ ] Shared component additions have contracts.
- [ ] Domain components have explicit ownership.
- [ ] Data and state ownership are explicit.
- [ ] Variants and sizes are approved.
- [ ] Responsive transformations are mapped.
- [ ] Accessibility behavior is mapped.
- [ ] Loading, empty, error, unavailable, and permission states are mapped.
- [ ] Duplicate-component risk was evaluated.
- [ ] Test responsibilities are mapped.
- [ ] No blocking component decision remains.

Use one status:

- `APPROVED_FOR_SCREEN_IMPLEMENTATION`;
- `APPROVED_WITH_COMPONENT_LIMITATIONS`;
- `BLOCKED_BY_COMPONENT_DECISIONS`.

---

# Component-system completion gate

A shared component system passes only when:

- [ ] The component catalog validates against its schema.
- [ ] Canonical names and IDs are unique.
- [ ] Component hierarchy is explicit.
- [ ] Dependency direction is valid.
- [ ] Public imports are explicit.
- [ ] Stable components have contracts.
- [ ] Stable interactive components have tests.
- [ ] Stable visual components have representative stories where applicable.
- [ ] Responsive behavior is explicit.
- [ ] Accessibility behavior is explicit.
- [ ] Recipe compatibility is explicit.
- [ ] Deprecated components define replacements.
- [ ] Duplicate detection passes.
- [ ] Representative screens use the catalog.
- [ ] No unresolved canonical ownership dispute remains.

Use one status:

- `APPROVED_FOR_COMPONENT_COMPOSITION`;
- `APPROVED_WITH_CATALOG_LIMITATIONS`;
- `BLOCKED_BY_COMPONENT_GOVERNANCE`.
