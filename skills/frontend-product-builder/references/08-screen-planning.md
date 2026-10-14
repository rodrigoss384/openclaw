# Screen Planning and Construction Contract

## Purpose

This reference defines how the frontend product builder converts approved product, design, architecture, recipe, and component-system inputs into an implementable screen contract.

A screen must not begin as an empty canvas.

A screen must begin as a product task with:

- a known user;
- a known route or interaction surface;
- an explicit primary task;
- explicit permissions;
- known data dependencies;
- a selected layout recipe;
- mapped regions;
- approved components;
- defined states;
- responsive decisions;
- accessibility behavior;
- an implementation sequence;
- a validation gate.

The screen specification is the authoritative planning artifact for one screen or one bounded interaction surface.

The default project output is:

```text
docs/frontend/screens/<screen-id>/screen-spec.json
```

Supporting artifacts are:

```text
docs/frontend/screens/<screen-id>/state-matrix.md
docs/frontend/screens/<screen-id>/component-map.md
docs/frontend/screens/<screen-id>/implementation-plan.md
```

---

## 1. Definition of a screen

A screen is a bounded product surface through which a user completes or advances a recognizable task.

A screen may be:

- a route;
- an application shell;
- a dashboard;
- a searchable collection;
- an entity detail;
- a create or edit workflow;
- an administration surface;
- an authentication surface;
- a review and approval workspace;
- a dialog when the dialog contains a complete bounded task;
- a drawer when the drawer contains a complete bounded contextual task.

A component demo is not a screen.

A card is not a screen.

A visual mockup without data, state, permission, and interaction contracts is not a complete screen specification.

A backend endpoint must not define the screen boundary by itself.

The screen boundary follows the user task.

---

## 2. Required inputs

Before creating a screen specification, inspect and reference the applicable project artifacts.

Required inputs normally include:

```text
docs/frontend/product-context.md
docs/frontend/design-direction.md
docs/frontend/frontend-architecture.md
docs/frontend/design-system/design-system.json
docs/frontend/design-system/component-catalog.json
docs/frontend/styling-authority.json
docs/frontend/integrations/<feature-name>.md
```

The relevant skill-level sources include:

```text
assets/recipes/*.recipe.json
assets/catalog/*.json
```

Do not invent missing project decisions silently.

Missing decisions must be recorded as:

- assumptions;
- open questions;
- blockers;
- explicit temporary defaults.

A blocker remains a blocker when it affects:

- authorization;
- tenant or organization scope;
- authoritative data ownership;
- mutation safety;
- destructive consequences;
- temporal semantics;
- upload security;
- review or approval authority;
- legal or policy meaning.

---

## 3. Planning sequence

Use this sequence for every screen:

```text
1. Identify the user task.
2. Identify the route or bounded interaction surface.
3. Identify entry and exit conditions.
4. Identify users, roles, permissions, and scope.
5. Select the dominant screen category.
6. Select the closest layout recipe.
7. Map recipe regions to the product task.
8. Identify authoritative data dependencies.
9. Define the complete state matrix.
10. Map every region to approved components.
11. Define actions and mutation behavior.
12. Define responsive transformations.
13. Define accessibility behavior.
14. Define content and formatting rules.
15. Define the representative implementation slice.
16. Define implementation order.
17. Validate the specification.
18. Begin implementation only after the planning gate passes.
```

Do not implement the visually easiest region first when another region determines the architecture or state model.

---

## 4. Screen category

Every screen must declare one dominant category.

Approved categories include:

- `application-shell`;
- `dashboard`;
- `searchable-list`;
- `entity-detail`;
- `form`;
- `administration`;
- `authentication`;
- `review-approval`;
- `custom`.

Use `custom` only when no approved recipe can express the dominant task.

A custom category requires:

- a written classification rationale;
- evaluated existing recipes;
- documented rejected recipes;
- explicit layout rules;
- a new recipe proposal when the pattern will recur.

A screen may contain secondary patterns, but it still has one dominant task and one dominant recipe.

Example:

```text
Entity detail
├── related searchable list
├── edit dialog
└── audit history
```

The dominant screen remains `entity-detail`.

The related list and dialog use subordinate component or workflow contracts.

---

## 5. Recipe selection

Select the closest approved recipe before mapping components.

The specification must record:

- selected recipe ID;
- recipe source;
- recipe status;
- mapped regions;
- omitted optional regions;
- approved extensions;
- rejected recipe alternatives;
- reason for any extension.

Do not copy a recipe mechanically.

A recipe supplies a structural contract, not the product content.

For every recipe region, determine whether it is:

- required and implemented;
- optional and implemented;
- optional and omitted;
- extended;
- replaced through an approved exception.

Do not omit a required region merely because the first implementation has no real data.

Use representative fixtures instead.

---

## 6. Screen contract

The screen specification must define:

### Identity

- screen ID;
- screen name;
- route or surface;
- feature owner;
- category;
- primary task;
- secondary tasks;
- actors;
- prerequisites.

### Product context

- journey;
- jobs to be done;
- terminology;
- permissions;
- tenant or scope context;
- assumptions;
- open questions.

### Visual direction

- archetype;
- density;
- visual adjectives;
- enforced visual rules;
- prohibited visual tendencies.

### Architecture

- feature boundary;
- route ownership;
- client-state ownership;
- form-state ownership;
- URL-state ownership;
- server-state ownership;
- API and mapper boundary;
- error strategy;
- performance strategy.

### Recipe

- selected recipe;
- mapped regions;
- region priority;
- scroll ownership;
- sticky behavior;
- extension decisions.

### Components

- canonical component;
- variant;
- size;
- state;
- region;
- data owner;
- interaction owner;
- fallback;
- reuse status.

### Data

- query, mutation, route, URL, form, context, or static source;
- authoritative owner;
- DTO and frontend-model boundary;
- loading behavior;
- empty behavior;
- error behavior;
- stale behavior;
- permission behavior;
- cache and freshness policy.

### Actions

- user-facing label;
- semantic kind;
- location;
- eligibility;
- permission;
- confirmation;
- pending behavior;
- success behavior;
- failure behavior;
- idempotency policy.

### States

- trigger;
- visible regions;
- hidden regions;
- component states;
- enabled actions;
- focus behavior;
- announcement behavior;
- recovery;
- screenshot requirement.

### Responsive behavior

- container or viewport range;
- layout transformation;
- region movement;
- action transformation;
- table or collection transformation;
- scroll ownership;
- sticky behavior;
- content-priority behavior.

### Accessibility

- landmarks;
- heading hierarchy;
- accessible names;
- keyboard model;
- focus movement;
- error navigation;
- announcements;
- reduced motion;
- zoom and reflow.

### Implementation

- files;
- implementation sequence;
- representative slice;
- tests;
- stories;
- fixtures;
- migrations;
- out-of-scope work.

---

## 7. State-first planning

Do not define only the successful data state.

Every screen must evaluate the states relevant to its task.

The standard state vocabulary includes:

```text
initial-loading
data
empty
partial
error
forbidden
unavailable
processing
success
stale
```

Additional domain-specific states may be defined when necessary.

Examples:

```text
awaiting-review
upload-processing
decision-conflict
session-expired
dependency-missing
```

Custom state IDs must describe product meaning rather than implementation state.

Avoid:

```text
isLoadingTrue
queryError
mutationSuccess
modalOpen
```

Prefer:

```text
initial-loading
evidence-unavailable
decision-submitting
decision-completed
```

A state must define more than visibility.

It must define:

- what the user understands;
- what data is authoritative;
- what remains visible;
- what actions remain available;
- what receives focus;
- what is announced;
- how the user recovers.

---

## 8. Initial loading versus background refresh

Initial loading and background refresh are distinct.

### Initial loading

Use when no authoritative usable screen data is available yet.

The screen may use:

- structural skeleton;
- bounded loading state;
- preserved application shell;
- visible screen identity when already known.

### Background refresh

Use when usable authoritative or previously confirmed data remains available while a newer version is requested.

The screen should normally preserve:

- current content;
- current focus;
- current scroll position;
- current query;
- current form values;
- current selection.

Use a local freshness or processing indicator.

Do not replace the complete screen with a skeleton during every background request.

---

## 9. Empty state

An empty state must describe why no usable result exists.

Distinguish:

- collection has no records;
- current filters return no records;
- search query returns no records;
- user has no permission to create;
- dependency is missing;
- feature is not configured;
- data is not yet available;
- data is unavailable because of an error.

These are not interchangeable.

The empty-state action must match actual eligibility.

Do not show a create action when:

- the user lacks capability;
- the tenant is read-only;
- a prerequisite is absent;
- creation is disabled by workflow state.

---

## 10. Partial state

Use a partial state when some regions are authoritative and usable while another region cannot be resolved.

Examples:

- entity header is available but audit history failed;
- dashboard metrics are available but one chart failed;
- review evidence is available but one document is still processing;
- list results are available but aggregate count failed.

The smallest truthful region owns the failure.

Do not replace the complete screen because one secondary region failed.

The specification must record:

- available regions;
- affected regions;
- local fallback;
- retry location;
- whether primary actions remain eligible.

---

## 11. Permission and forbidden state

Permission is not equivalent to generic error.

The specification must distinguish:

- route access denied;
- visible but read-only screen;
- hidden action;
- visible disabled action with explanation;
- redacted region;
- unavailable field;
- server rejection after stale client capability state.

Frontend permission treatment improves clarity but is not the security boundary.

The backend remains authoritative.

Do not expose:

- capability keys;
- policy IDs;
- role internals;
- authorization traces.

### Disjoint reason taxonomy

A `disabledAction` must classify its `reasonKind` as exactly one of:
`permission`, `dependency`, `pending-human-decision`, `business-block`,
`status-ineligible`, or `technical-error`. These dimensions are disjoint —
combining two of them into one free-text label (for example presenting a
normal dependency as a business blocker, or a confirmed operational status as
a low-confidence candidate) is a contract violation, not a wording choice.

Specific consequences:

- A dependency that the action itself will resolve (for example, a document
  a reviewer's own approval action will validate) must never be classified
  `business-block`.
- A confidence-qualifier prefix (for example "Candidate") is reserved for a
  genuinely unconfirmed inference. Do not apply it to a confirmed operational
  status of an entity's own lifecycle.
- `pending-human-decision` and `dependency` remain distinct: the former means
  a person must act; the latter means another object/record must exist or
  reach a state first.

---

## 12. Stale and conflict state

A stale screen contains data that may no longer match the authoritative source.

A conflict exists when proceeding may overwrite, invalidate, or contradict newer authoritative data.

The specification must define:

- what changed;
- which regions are stale;
- whether current content remains visible;
- whether actions are blocked;
- whether refresh is safe;
- whether local values must be preserved;
- whether comparison is required;
- whether the user can reconcile.

Do not silently refresh away local form or review work.

---

## 13. Component mapping

Every visible region must map to:

- one approved component;
- one approved composition;
- or one explicitly proposed new component.

The component map must classify each use as:

- `canonical`;
- `extended`;
- `new-proposed`;
- `feature-specific`.

### Canonical

Use an existing component without changing its responsibility.

### Extended

Add an approved semantic variant or bounded capability without duplicating the component.

### New proposed

Create a component only when no existing contract owns the responsibility.

A new component proposal must define:

- responsibility;
- layer;
- expected consumers;
- why composition is insufficient;
- state ownership;
- data-access policy;
- accessibility model;
- responsive behavior;
- testing requirements.

### Feature-specific

Use when the component expresses domain behavior that should not become globally shared.

A feature-specific component may compose shared components but must not duplicate them.

---

## 14. Component selection order

Select components in this order:

```text
1. Existing project component.
2. Existing approved catalog component.
3. Approved composition of existing components.
4. Approved extension to an existing component.
5. Feature-specific component.
6. New shared component proposal.
```

Do not begin with a new shared component.

Do not use a visual difference alone as justification for a new component.

---

## 15. Data dependency contract

Every dependency must declare its ownership.

Approved source types include:

- `query`;
- `mutation`;
- `route`;
- `url`;
- `form`;
- `context`;
- `feature`;
- `static`.

For server dependencies, record:

- query or mutation purpose;
- authoritative endpoint or integration contract;
- DTO;
- validation;
- mapper;
- frontend model;
- view model;
- cache key ownership;
- stale-time policy;
- invalidation;
- permission;
- retry;
- cancellation;
- error normalization.

The screen component must not parse transport data directly.

The sequence remains:

```text
transport response
        ↓
runtime validation
        ↓
DTO
        ↓
mapper
        ↓
frontend model
        ↓
view model
        ↓
screen and components
```

### Hierarchical scope resolution

When the product has a nested entity hierarchy (for example tenant → client →
case → process), declare `productContext.scope.scopeHierarchy` as the ordered
list of levels.

Every `dataDependency` that reads at a level below the root must declare
`scopeResolution.requestedLevel` and `scopeResolution.resolvedVia`:

- `exact-parent-chain`: every item is reached by walking explicit parent-id
  references down to the requested level. This is the only value allowed for
  a dependency feeding an entity-detail screen of a non-root level.
- `ancestor-aggregate`: items are gathered by a broader, shared ancestor key
  (for example `clientId`) and may therefore include siblings of the
  requested entity (for example another case belonging to the same client).
  This value is allowed only on a dependency explicitly designated as a
  consolidated/360 view for the ancestor level itself
  (`scopeResolution.allowedForLevels` includes that level), never for a
  detail screen of a descendant level.

A detail screen for a finer-grained entity (a case, a process, an event) must
never declare a dependency whose `resolvedVia` is `ancestor-aggregate`. Doing
so is the structural cause of a sibling-scope leak: a case-detail screen that
resolves its data through the client id instead of the case id will render
objects belonging to a different case of the same client.

Do not infer a fine-grained scope (case) from a coarser shared key (client).
`dataDependency.scopeKey` must name the exact foreign key the query filters
by — never a key one level higher in `scopeHierarchy` than the screen's own
classification.

When a dependency legitimately consolidates items reached through more than
one relation chain (a client-level dossier showing cases, processes, and
events together), it must:

- be the one explicitly designated consolidated/360 dependency for that
  ancestor level, not an incidental reuse of a narrower helper;
- tag every aggregated item with its own derived provenance via
  `dataDependency.originField`, so the screen can render where each item came
  from and never presents it as if it belonged natively to the ancestor.

### Shared derivation of values shown more than once

When the same semantic value (a status, a severity, a count, an eligibility
result) is rendered by more than one screen-spec for the same entity — a list
and its own detail, or two different screens showing the same object — every
`dataDependency`/`componentUsage` that renders it must declare the same
`sharedSelectorId`, naming the one canonical, exported selector that computes
it. Do not let two screens compute the same displayed value with two
independent formulas; that is how a list and its detail end up disagreeing
about the same object's severity, or a filtered view keeps showing the
unfiltered total.

A filtered or viewed collection must render the count of what is actually
displayed, not a static total — for example "2 of 16", never a bare "16" when
only 2 rows are shown.

### Cross-screen projection registry

Declaring a matching `sharedSelectorId` inside one screen-spec only proves
that screen's own internal consistency. When an entity's derived value
appears across more than one *validated* screen-spec under
`docs/frontend/screens/`, also register it in
`docs/frontend/screens/_shared/entity-projections.json`
(`assets/schemas/entity-projections.schema.json`): the value's id, the
entity type, the canonical `sharedSelectorId`, every screen that renders it,
and where the selector actually lives.

Run
`scripts/audit-cross-screen-projection-consistency.mjs entity-projections.json --screens-dir docs/frontend/screens`
before releasing `ready-for-small-slice` for any screen whose entity already
has a registered projection, or whenever a new screen starts rendering a
value another screen already renders for the same entity. This is the check
that catches a list and its own detail computing "severity" through two
different formulas — the class of defect a single screen-spec's own
validation cannot see.

---

## 16. URL state

URL state should own navigable, shareable, or restorable screen state when appropriate.

Common examples:

- search query;
- filters;
- sort;
- page;
- selected tab with navigational meaning;
- selected record in a split view;
- date range;
- dashboard segment.

Do not place ephemeral visual state in the URL without a product reason.

Examples of local or component state:

- tooltip visibility;
- uncontrolled popover disclosure;
- temporary menu opening;
- hover;
- local animation progress.

The specification must define:

- serialization;
- defaults;
- invalid-value handling;
- back and forward behavior;
- pagination reset;
- tenant or scope changes;
- shareability.

---

## 17. Action contract

Every action must declare a semantic kind.

Approved kinds include:

- `primary`;
- `secondary`;
- `destructive`;
- `navigation`;
- `mutation`;
- `local`;
- `recovery`.

One action may have more than one operational property, but its dominant user-facing role must remain clear.

For mutation actions, define:

- eligibility;
- permission;
- validation;
- confirmation;
- idempotency;
- pending state;
- duplicate prevention;
- optimistic behavior;
- authoritative success;
- error normalization;
- invalidation;
- navigation after success;
- focus after failure.

A disabled action without an obvious reason requires visible eligibility explanation.

---

## 18. Responsive decisions

Responsive behavior must be specified before implementation.

Do not rely on:

```text
desktop first
then stack everything on mobile
```

For every supported width or container range, define:

- region order;
- column count;
- hidden content;
- moved content;
- collapsed content;
- sticky behavior;
- scroll owner;
- table transformation;
- action placement;
- navigation transformation;
- content priority.

Responsive behavior must preserve:

- task order;
- semantic order;
- focus order;
- visible consequences;
- critical actions;
- validation;
- status;
- permissions.

Do not hide required information merely to fit a narrow viewport.

---

## 19. Scroll ownership

Every screen must identify scroll owners explicitly.

Common valid models include:

### Document scroll

The route content uses the document or application content scroll.

### Main content scroll

The application shell owns the viewport and one main content region scrolls.

### Local collection scroll

A bounded table, evidence viewer, or menu owns local overflow.

### Modal scroll

The modal body owns vertical overflow while the header and actions remain available.

Do not create several competing vertical scroll containers without a strong interaction requirement.

The specification must define:

- primary vertical scroll owner;
- local overflow regions;
- sticky elements;
- focus-scroll behavior;
- restoration behavior.

---

## 20. Representative screen

A representative screen is the first implementation slice used to validate the system before broad construction.

It should exercise several foundational decisions, such as:

- application shell;
- route hierarchy;
- typography;
- spacing;
- surfaces;
- responsive behavior;
- query state;
- form or action state;
- feedback;
- accessibility;
- component composition.

The representative screen must not be selected only because it is simple.

Select a screen that reveals whether the design system and architecture are credible.

Examples:

- a searchable operational list with filters and actions;
- an entity detail with status, metadata, related data, and edit flow;
- a review workspace with evidence and decision controls;
- an administration screen with permissions and sensitive form actions.

Before implementing additional screens, validate the representative screen through:

- browser inspection;
- approved viewports;
- screenshots;
- keyboard navigation;
- loading, empty, error, and permission states;
- design-system audit;
- component audit;
- responsive audit;
- accessibility audit.

---

## 21. Representative slice

The representative slice is smaller than the complete screen but must be architecturally real.

A valid slice includes:

- real route ownership;
- real design-system tokens;
- real component imports;
- real query or fixture adapter boundary;
- one meaningful state transition;
- one responsive transformation;
- one accessibility interaction;
- tests or stories required by the component contracts.
- the approved styling authority and an ownership trace for every affected existing class.

A representative slice must not be:

- a disconnected static mockup;
- a screenshot-only replica;
- hardcoded production data;
- a parallel temporary component tree;
- throwaway CSS;
- an alternate architecture that will be replaced later.

The slice should be extended into the final screen rather than discarded.

---

## 22. Implementation sequence

Plan implementation in dependency order.

Recommended default sequence:

```text
1. Confirm route and feature boundary.
2. Confirm screen specification.
3. Confirm recipe and region mapping.
4. Confirm tokens and component contracts.
5. Create route and screen shell.
6. Create data adapters and representative fixtures.
7. Implement structural regions.
8. Implement initial loading and data states.
9. Implement empty, partial, error, permission, and stale states.
10. Implement actions and mutations.
11. Implement responsive transformations.
12. Implement keyboard and focus behavior.
13. Add stories and component tests.
14. Add route-level browser tests.
15. Capture screenshots.
16. Run design-system and component audits.
17. Patch verified defects.
18. Update the implementation report.
```

Do not postpone non-success states until the end.

Do not postpone responsive behavior until all desktop screens are complete.

---

## 23. Planning gate

Implementation must not begin until the screen planning gate confirms:

- primary task is explicit;
- screen category is selected;
- recipe is selected;
- required recipe regions are mapped;
- permissions are understood;
- data owners are understood;
- states are defined;
- actions are defined;
- scroll ownership is defined;
- responsive transformations are defined;
- accessibility behavior is defined;
- canonical components are mapped;
- new component proposals are justified;
- representative slice is defined;
- blockers are resolved or explicitly accepted.

A failed gate returns the workflow to planning.

Do not compensate for missing product decisions with decorative implementation.

---

## 24. Stop conditions

Stop implementation and request resolution when:

- route or screen ownership is ambiguous;
- the primary task is unclear;
- two conflicting recipes appear equally dominant;
- tenant or authorization scope is unknown;
- a destructive operation lacks a safety contract;
- a mutation lacks authoritative success criteria;
- temporal semantics are ambiguous;
- file-upload security is undefined;
- a review decision lacks authority or audit meaning;
- a required component has no viable accessible interaction model;
- a custom component would duplicate an existing catalog responsibility;
- representative fixtures would conceal a critical unknown.

Record the stop condition in:

```text
docs/frontend/screens/<screen-id>/screen-spec.json
```

through:

- `productContext.openQuestions`;
- `productContext.assumptions`;
- `implementation.blockers`;
- failed validation checks.

---

## 25. Anti-patterns

### Blank-canvas implementation

```text
Open route
→ begin JSX
→ choose components visually
→ discover states later
```

Required:

```text
Classify task
→ select recipe
→ define states
→ map components
→ plan slice
→ implement
```

### Success-state-only screen

```text
Data exists
→ render polished screen
```

Missing:

- loading;
- empty;
- partial;
- error;
- forbidden;
- stale;
- processing;
- recovery.

### Endpoint-shaped screen

```text
One endpoint response
→ one screen layout
```

Required:

```text
User task
→ screen contract
→ data dependencies
```

### Component invention before catalog review

```text
Need a panel
→ create NewPanel
```

Required:

```text
Need responsibility
→ inspect catalog
→ compose
→ extend
→ propose only when necessary
```

### Desktop screenshot treated as specification

A screenshot does not define:

- focus;
- keyboard behavior;
- loading;
- permission;
- URL state;
- mutations;
- narrow layout;
- zoom;
- localization;
- content limits.

### Skeleton on every request

Background refresh should normally preserve usable content.

### Hidden complexity

Do not hide:

- destructive consequences;
- permission limits;
- partial failures;
- stale evidence;
- unsaved state;
- upload processing;
- failed files;
- disabled-action reasons.

---

## 26. Required output quality

A complete screen specification should allow another qualified engineer to answer:

- What user task does this screen serve?
- Why was this recipe selected?
- Which regions are required?
- Which components are canonical?
- Who owns each state?
- Which data is authoritative?
- What happens in every important state?
- Which actions mutate data?
- What blocks each action?
- How does the screen behave narrowly?
- What scrolls?
- Where does focus move?
- What is announced?
- What is the representative slice?
- Which files will be created?
- Which tests prove the behavior?
- Which unresolved decisions still block implementation?

When these answers are not available, the screen is not ready to build.

---

## 27. Operational planning package

Every screen implementation must use the complete planning package:

```text
docs/frontend/screens/<screen-id>/
├── screen-spec.json
├── state-matrix.md
├── component-map.md
└── implementation-plan.md
```

The files have distinct responsibilities.

### `screen-spec.json`

Owns the machine-readable screen contract:

- identity;
- product context;
- visual direction;
- architecture;
- selected recipe;
- regions;
- components;
- data dependencies;
- states;
- actions;
- responsive behavior;
- accessibility;
- implementation summary;
- representative gate.

### `state-matrix.md`

Owns the detailed human-reviewable state behavior:

- standard-state applicability;
- custom product states;
- authoritative-data behavior;
- region visibility;
- action eligibility;
- focus;
- announcements;
- recovery;
- state transitions;
- screenshot coverage.

### `component-map.md`

Owns component-selection evidence:

- existing project-component review;
- catalog selection;
- composition;
- extension;
- feature-specific components;
- new-component proposals;
- data ownership;
- interaction ownership;
- state ownership;
- responsive behavior;
- accessibility;
- duplicate-risk review.

### `implementation-plan.md`

Owns execution control:

- repository inspection;
- representative-screen selection;
- representative slice;
- file plan;
- architecture boundaries;
- fixtures;
- implementation order;
- tests;
- browser scenarios;
- screenshots;
- audits;
- stop conditions;
- representative gate;
- completion report.

Do not collapse all four responsibilities into one informal document.

---

## 28. Required planning order

Use this order:

```text
1. Create and validate screen-spec.json.
2. Complete state-matrix.md.
3. Complete component-map.md.
4. Complete implementation-plan.md.
5. Resolve planning blockers.
6. Mark the implementation plan ready.
7. Approve the representative slice.
8. Implement only the approved SMALL SLICE.
9. Validate the slice in the browser.
10. Capture screenshots.
11. Run design-system and component audits.
12. Patch verified defects.
13. Approve or reject the representative gate.
14. Continue broad implementation only after approval.
```

A later artifact may expose a defect in an earlier artifact.

When this occurs, update the earlier artifact rather than introducing an undocumented implementation exception.

---

## 29. Planning consistency

The following identifiers must remain consistent across all planning artifacts:

- screen ID;
- recipe ID;
- screen-region IDs;
- component-usage IDs;
- data-dependency IDs;
- state IDs;
- action IDs;
- implementation-step IDs;
- gate-check IDs.

Example:

```text
screen-spec.json
    region: searchAndFilters

state-matrix.md
    region: searchAndFilters

component-map.md
    region: searchAndFilters

implementation-plan.md
    region: searchAndFilters
```

Do not rename a region only in JSX.

Update the planning package first.

---

## 30. State-matrix gate

The state matrix blocks implementation when:

- a standard state was not evaluated;
- initial loading and background refresh are conflated;
- empty conditions are conflated;
- partial failures lack local treatment;
- permissions are represented as generic errors;
- mutation processing lacks authoritative completion;
- stale or conflict behavior could discard user work;
- focus behavior is missing;
- announcement behavior is missing;
- recovery is undefined;
- required screenshots are undefined.

A state matrix must describe user meaning rather than framework flags.

---

## 31. Component-map gate

The component map blocks implementation when:

- a visible region has no approved component owner;
- an existing project component was not inspected;
- a catalog component was ignored without rationale;
- a new shared component lacks a gap analysis;
- a feature-specific component duplicates a shared component;
- state ownership is unclear;
- data ownership is unclear;
- interaction ownership is unclear;
- responsive behavior is missing;
- accessibility behavior is missing;
- a shared component would execute feature transport or mutation without an approved contract.

Do not approve components based only on visual similarity.

Approve based on responsibility and behavior.

---

## 32. Representative-screen selection

Do not select the representative screen only because it is:

- the smallest;
- the first route alphabetically;
- visually attractive;
- free from data dependencies;
- free from non-success states;
- easy to mock.

Prefer a screen that exercises several real system decisions:

- route hierarchy;
- application shell;
- data boundary;
- state behavior;
- component composition;
- actions;
- permissions;
- responsive transformation;
- focus behavior;
- feedback;
- typography;
- spacing;
- surfaces.

The representative screen must remain feasible.

Do not choose a screen blocked by unresolved authority, safety, permission, temporal, or integration decisions.

---

## 33. Representative-screen scoring

Candidate screens may be scored against:

- business importance;
- architecture coverage;
- design-system coverage;
- component-composition coverage;
- state complexity;
- interaction coverage;
- responsive value;
- accessibility value;
- scope and permission coverage;
- fixture feasibility;
- rework risk;
- unresolved ambiguity.

Scoring supports judgment.

It does not replace product and architecture review.

A high numerical score must not override a critical blocker.

---

## 34. Representative slice approval

The representative slice must prove that the selected system can produce a credible production screen.

It must include:

- real route ownership;
- real feature structure;
- real design-system tokens;
- real component contracts;
- real state boundaries;
- a real data or fixture adapter;
- one non-success state;
- one responsive transformation;
- one keyboard or focus interaction;
- tests or stories;
- browser evidence;
- screenshots.

The slice must be directly extendable.

Do not approve a slice that will be deleted before final implementation.

---

## 35. Gate status model

Use these statuses:

### `blocked`

Required evidence or decisions are missing.

Implementation must not proceed.

### `ready`

Planning or implementation evidence is complete and awaits explicit review.

Broad implementation must not proceed.

### `approved`

The representative slice passed the gate.

Broader implementation may continue.

### `rejected`

The slice or plan failed review.

Return to the relevant artifact or implementation step.

### `not-required`

An explicit approved exception.

This status should be uncommon and requires a written rationale.

---

## 36. Gate evidence

Valid evidence includes:

- validated specification files;
- repository paths;
- passing tests;
- Storybook stories;
- browser-test output;
- screenshot paths;
- accessibility audit output;
- design-system audit output;
- component-collision audit output;
- documented product approval;
- documented architecture approval.

Invalid evidence includes:

- “looks good”;
- “should work”;
- “similar to the mockup”;
- unexecuted commands;
- unstored screenshots;
- unverified assumptions;
- temporary throwaway code.

---

## 37. Small-slice constraint

Before representative-gate approval, implementation is limited to the approved representative slice.

Do not expand opportunistically into:

- additional routes;
- unrelated components;
- broad design-system rewrites;
- package migrations;
- global CSS replacement;
- component or page overrides in global CSS;
- generalized abstractions without consumers;
- complete backend integration beyond the slice;
- all remaining screen states.

Expansion before approval increases rework and hides system defects.

---

## 38. Planning change control

When implementation reveals a planning defect:

```text
implementation evidence
        ↓
identify incorrect planning artifact
        ↓
update the artifact
        ↓
revalidate dependent artifacts
        ↓
continue implementation
```

Do not solve planning defects through undocumented local exceptions.

Changes that require planning updates include:

- recipe-region changes;
- component responsibility changes;
- state-ownership changes;
- route changes;
- new mutation behavior;
- permission changes;
- scroll-owner changes;
- responsive region movement;
- new shared component proposals;
- changed success criteria.

---

## 39. Implementation release condition

The workflow may move from `PLAN` to `SMALL SLICE` only when:

- `screen-spec.json` is valid;
- state matrix status is approved;
- component map status is approved;
- implementation plan status is approved;
- blockers are empty;
- representative slice is explicit;
- required files are known;
- fixtures are known;
- tests are known;
- browser scenarios are known.

The workflow may move from `SMALL SLICE` to broader `BUILD` only when:

- the representative gate is approved;
- browser validation passed;
- required screenshots exist;
- blocking design-system defects are resolved;
- blocking component defects are resolved;
- blocking accessibility defects are resolved;
- blocking responsive defects are resolved.

---

## 40. Planning anti-patterns

### Informal component list

```text
Use Card, Button, Table, Modal.
```

This does not define:

- responsibility;
- region;
- variant;
- state;
- data owner;
- interaction owner;
- fallback;
- responsive behavior.

### Generic state checklist

```text
Loading, error, success.
```

This does not define:

- authoritative data;
- visible regions;
- preserved content;
- action eligibility;
- focus;
- announcements;
- recovery.

### File list without dependency order

```text
Create page.tsx, components.tsx, api.ts.
```

This does not define:

- architecture boundaries;
- sequence;
- completion evidence;
- tests;
- blockers.

### Representative mockup

```text
Static JSX with hardcoded data
```

This does not validate:

- production state ownership;
- data mapping;
- real component contracts;
- error behavior;
- responsive state;
- focus behavior.

### Approval without evidence

```text
Approved because it looks polished.
```

Visual polish cannot compensate for:

- incorrect permissions;
- missing states;
- unsafe mutations;
- inaccessible interaction;
- duplicated components;
- invalid responsive behavior;
- fake data boundaries.


## Semantic presentation por screen

Quando a screen renderiza dados com papel semântico repetível, declare `semanticPresentation.mode=registry` e mapeie cada `componentUsageId` relevante para um `semanticRole`. A derivação resolve esse papel exclusivamente por `design-system.json#visualGrammar.perceptualPolicy.presentationRoles` e exige que o component usage use a mesma `componentFamily` registrada e existente no catalog referenciado. Não infira `status`, `classification`, `reusable-reference` ou outro papel pelo nome do componente, cor, copy ou prompt.

Use `mode=not-applicable` somente quando a screen realmente não possui apresentação semântica de dados e registre rationale explícita. Se `semanticPresentation` estiver ausente, a dimensão derivada permanece `unresolved`; ausência nunca significa `not-applicable`.
