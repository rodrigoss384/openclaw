# Small Slice Execution

## Purpose

This reference defines how an approved screen-planning package becomes the first architecturally real implementation slice.

The `SMALL SLICE` exists to validate the selected product, design, architecture, recipe, component, state, responsive, and accessibility system before broader construction.

It is not:

- a visual mockup;
- a disposable prototype;
- a disconnected Storybook-only composition;
- a temporary route;
- a second frontend architecture;
- a success-state-only demonstration;
- permission to implement the complete screen.

The slice must be directly extendable into the final implementation.

---

## 1. Required planning inputs

Before entering `SMALL SLICE`, the following project artifacts must exist:

```text
docs/frontend/product-context.md
docs/frontend/design-direction.md
docs/frontend/frontend-architecture.md
docs/frontend/design-system/design-system.json
docs/frontend/design-system/component-catalog.json
docs/frontend/styling-authority.json
docs/frontend/screens/<screen-id>/screen-spec.json
docs/frontend/screens/<screen-id>/state-matrix.md
docs/frontend/screens/<screen-id>/component-map.md
docs/frontend/screens/<screen-id>/implementation-plan.md
docs/frontend/screens/<screen-id>/readiness-report.json
```

Applicable integration contracts must also exist:

```text
docs/frontend/integrations/<feature-name>.md
```

The readiness report must release at least:

```text
ready-for-small-slice
```

Do not enter `SMALL SLICE` when the report returns:

```text
blocked
planning-incomplete
```

---

## 2. Required execution artifacts

Create:

```text
docs/frontend/screens/<screen-id>/
├── repository-inspection.md
├── fixture-strategy.md
└── small-slice-manifest.json
```

These artifacts have separate responsibilities.

### `repository-inspection.md`

Records the actual repository environment:

- package manager;
- workspace structure;
- application package;
- build system;
- React and TypeScript setup;
- routing;
- styling;
- styling authority, global stylesheet roles, and affected-class ownership;
- tokens;
- components;
- query layer;
- form layer;
- validation;
- authentication;
- authorization;
- tests;
- Storybook;
- browser testing;
- linting;
- formatting;
- CI;
- existing commands;
- migration constraints.

### `fixture-strategy.md`

Defines safe representative data:

- frontend-model shape;
- source;
- state coverage;
- long content;
- empty conditions;
- partial failure;
- permissions;
- stale data;
- conflict;
- processing;
- sensitive-data policy;
- deterministic behavior;
- cleanup and promotion policy.

### `small-slice-manifest.json`

Defines the executable slice boundary:

- readiness release;
- route or surface;
- slice purpose;
- proof obligations;
- in-scope work;
- out-of-scope work;
- architecture boundaries;
- fixtures;
- states;
- interactions;
- responsive behavior;
- accessibility behavior;
- file plan;
- implementation sequence;
- evidence plan;
- stop conditions;
- validation checks.

---

## 3. Repository inspection first

Do not implement before inspecting the real repository.

Inspection must determine:

- whether the repository is a monorepo;
- where the frontend application lives;
- which package manager is authoritative;
- which lockfile is authoritative;
- which package contains the screen;
- which route system is used;
- where features live;
- where shared components live;
- where design tokens live;
- how imports are resolved;
- how server state is managed;
- how forms are managed;
- how validation is performed;
- how authentication and permission state are supplied;
- which test commands already exist;
- whether Storybook exists;
- whether browser tests exist;
- which CI commands are authoritative.

Do not infer these from the default stack when direct evidence exists.

---

## 4. Package-manager authority

Use the package manager already established by the repository.

Common authority signals include:

```text
package-lock.json
npm-shrinkwrap.json
pnpm-lock.yaml
yarn.lock
bun.lock
bun.lockb
packageManager in package.json
```

When signals conflict:

1. inspect project documentation;
2. inspect CI;
3. inspect recent package scripts;
4. record the conflict;
5. stop before installing dependencies.

Do not generate an additional lockfile.

Do not run another package manager merely because it is locally available.

---

## 5. Repository-preservation rule

The slice must preserve the existing viable architecture.

Do not silently replace:

- router;
- query library;
- form library;
- schema-validation library;
- component foundation;
- styling architecture;
- test runner;
- Storybook;
- browser-test framework;
- linting;
- formatting;
- package manager;
- workspace system.

When the approved screen contract requires a migration, leave `SMALL SLICE` and create an explicit migration plan.

Before changing an existing class, complete its ownership trace. A missing definition is a blocker, not permission to create a global override. Validate the styling-authority contract before coding and after any approved contract change.

---

## 6. Slice definition

A valid representative slice proves several real system decisions together.

It normally includes:

- the real route or bounded interaction surface;
- the real feature boundary;
- one or more real recipe regions;
- canonical layout components;
- canonical product components;
- real design-system tokens;
- a real data or fixture adapter boundary;
- one primary data state;
- one meaningful non-success state;
- one meaningful action or interaction;
- one responsive transformation;
- one keyboard or focus behavior;
- one test or Storybook contract;
- one browser scenario;
- screenshot evidence.

The slice must not attempt to prove every screen state at once.

It must prove the system is viable.

---

## 7. Required proof dimensions

Every slice must declare five proof dimensions.

### Architecture proof

Demonstrates:

- route ownership;
- feature structure;
- dependency direction;
- state ownership;
- data boundary;
- side-effect boundary.

### State proof

Demonstrates:

- one primary state;
- one meaningful non-success state;
- preservation of usable context;
- truthful fallback scope;
- explicit recovery.

### Interaction proof

Demonstrates:

- one product-relevant interaction;
- eligibility;
- ownership;
- keyboard behavior;
- focus behavior;
- pending or transition behavior when applicable.

### Responsive proof

Demonstrates:

- one meaningful region transformation;
- preserved task order;
- preserved DOM and focus order;
- explicit scroll ownership;
- no page-level horizontal overflow.

### Accessibility proof

Demonstrates:

- semantic structure;
- accessible names;
- keyboard operation;
- visible focus;
- deliberate announcement or silent behavior;
- zoom and reflow expectations.

A slice missing one of these dimensions is incomplete.

---

## 8. Slice scope

The slice manifest must classify all work as:

- in scope;
- out of scope;
- assumption;
- blocker.

### In scope

Work required to prove the slice.

### Out of scope

Work intentionally excluded from this slice and not needed for its validity.

### Assumption

A reversible temporary decision that does not conceal a critical unknown.

### Blocker

A missing decision or capability that makes the slice unsafe or architecturally false.

Do not turn a blocker into an assumption when it affects:

- authorization;
- tenant scope;
- destructive behavior;
- mutation authority;
- persistence;
- idempotency;
- time or timezone meaning;
- upload safety;
- review authority;
- conflict handling;
- accessibility viability.

---

## 9. Production-path rule

The slice must use production-intended paths.

Allowed:

```text
src/features/customers/routes/customer-list-route.tsx
src/features/customers/components/customer-list-screen.tsx
src/features/customers/api/customer-list.mapper.ts
src/features/customers/fixtures/customer-list.fixtures.ts
```

Prohibited:

```text
src/temp/
src/mockup/
src/prototype/
src/experimental-final/
src/new-version/
src/v2/
```

unless those paths are already approved repository architecture.

The slice must not require later relocation merely to become production code.

---

## 10. Fixture boundary

Fixtures must pass through the same frontend-model boundary intended for real data.

Preferred:

```text
fixture source
        ↓
validated fixture DTO or frontend fixture source
        ↓
mapper
        ↓
frontend model
        ↓
view model
        ↓
screen
```

Avoid:

```text
hardcoded object inside JSX
        ↓
screen
```

Fixtures should exercise product behavior, not bypass it.

---

## 11. Fixture safety

Fixtures must not contain:

- production personal data;
- real credentials;
- API keys;
- tokens;
- private keys;
- real customer documents;
- signed URLs;
- real tenant identifiers;
- secrets copied from logs;
- realistic sensitive data that could be mistaken for production.

Use clearly synthetic values.

When the domain requires sensitive-looking structure, use intentionally fictional data and document the policy.

---

## 12. Fixture determinism

Representative fixtures must be deterministic.

Do not use uncontrolled:

- random numbers;
- current time;
- network requests;
- locale-dependent values;
- system timezone;
- unordered object iteration;
- external image URLs;
- mutable global state.

When current time is necessary, inject a fixed clock.

When IDs are necessary, use stable synthetic IDs.

When images are necessary, use repository-owned approved assets or deterministic generated placeholders.

---

## 13. Fixture-state coverage

The slice fixture strategy should normally include:

- primary data;
- meaningful non-success state;
- long localized content;
- boundary values;
- permission state when relevant;
- stale or conflict state when the slice proves mutation or review behavior;
- processing state when the slice proves an asynchronous workflow.

Do not create dozens of fixtures merely to appear comprehensive.

Create the smallest set that proves the declared slice.

---

## 14. State preservation

The slice must preserve usable state when safe.

Examples:

- background refresh preserves data;
- partial failure preserves unaffected regions;
- failed mutation preserves form values;
- stale data preserves current content;
- blocked navigation preserves unsaved work;
- failed upload preserves other successful files.

Do not use the slice to establish destructive reset behavior that contradicts the screen state matrix.

---

## 15. File declaration

Every file created or modified by the slice must appear in:

```text
small-slice-manifest.json
```

Allowed actions:

- `inspect`;
- `reuse`;
- `create`;
- `modify`;
- `remove`.

Unexpected file creation requires:

1. pause;
2. update the manifest;
3. explain the need;
4. validate scope;
5. continue only when the file belongs to the approved slice.

Do not hide unplanned work inside a generic file.

---

## 16. Persistent implementation rule

Every implementation file must declare one disposition.

Approved dispositions:

- `production`;
- `fixture`;
- `test`;
- `story`;
- `evidence`;
- `configuration`.

Do not use:

- `temporary`;
- `throwaway`;
- `prototype-only`.

A generated report may be evidence, but implementation code must be production-intended.

---

## 17. Side-effect boundaries

The manifest must identify owners for:

- navigation;
- query execution;
- mutation;
- form submission;
- persistence;
- upload;
- clipboard;
- storage;
- browser APIs;
- focus movement;
- scroll movement;
- telemetry.

A visual component must not acquire a side effect merely because it renders the control that triggers it.

Example:

```text
Button
        ↓ emits intent
feature action
        ↓ evaluates eligibility
mutation adapter
        ↓ executes request
authoritative source
        ↓ confirms result
screen state
        ↓ updates presentation
```

---

## 18. Small-slice implementation order

Use this default dependency order:

```text
1. Confirm readiness release.
2. Complete repository inspection.
3. Complete fixture strategy.
4. Validate the small-slice manifest.
5. Inspect planned repository files.
6. Establish route and feature boundary.
7. Establish data and fixture adapters.
8. Implement structural regions.
9. Implement the primary state.
10. Implement the selected non-success state.
11. Implement the selected interaction.
12. Implement the selected responsive transformation.
13. Implement keyboard and focus behavior.
14. Add tests and stories.
15. Run browser validation.
16. Capture screenshots.
17. Run audits.
18. Patch verified defects.
19. Prepare representative-gate evidence.
```

Do not skip directly to visual composition.

---

## 19. Slice execution statuses

Use:

### `draft`

The manifest is incomplete.

Implementation is blocked.

### `ready`

The manifest is complete and validated.

Slice implementation may begin.

### `in-progress`

Implementation is limited to declared slice work.

### `validated`

The slice implementation and required evidence are complete.

Representative review may begin.

### `blocked`

A stop condition prevents truthful continuation.

### `rejected`

The slice contract or implementation was rejected and must be revised.

Do not use `validated` before browser and evidence requirements are complete.

---

## 20. Evidence plan

Before implementation, declare required evidence.

Evidence types include:

- source file;
- fixture;
- Storybook story;
- unit test;
- component test;
- feature test;
- browser test;
- screenshot;
- accessibility report;
- responsive report;
- design-system audit;
- component audit;
- readiness report.

Each evidence item must have:

- stable ID;
- type;
- purpose;
- expected path;
- required status;
- current status.

Do not fabricate completed evidence before execution.

---

## 21. Stop conditions

Stop slice implementation when:

- readiness no longer releases `SMALL SLICE`;
- repository inspection contradicts the approved architecture;
- the authoritative package manager is unclear;
- the route belongs to another application package;
- a planned component does not exist;
- an existing component owns the responsibility differently;
- fixture data cannot represent the real model truthfully;
- the selected non-success state requires an unresolved product decision;
- mutation authority is unclear;
- permission behavior is unclear;
- an accessible interaction model is not viable;
- the responsive transformation changes semantic order;
- the slice requires an unapproved migration;
- unplanned files or dependencies become necessary;
- implementation would expand beyond the declared slice.

Record the condition in the manifest and return to planning.

---

## 22. Scope expansion

Do not expand the slice opportunistically.

Prohibited expansion includes:

- implementing all remaining routes;
- completing every screen state;
- replacing the design system;
- migrating the package manager;
- replacing routing;
- creating generic abstractions without current consumers;
- rewriting unrelated components;
- adding broad dependencies;
- integrating the complete backend when fixtures are the approved slice boundary.

Scope expansion requires:

1. evidence that the current slice is insufficient;
2. planning-package update;
3. manifest update;
4. readiness revalidation;
5. explicit approval.

---

## 23. Completion conditions

The slice may be marked `validated` only when:

- repository inspection exists;
- fixture strategy exists;
- manifest validates;
- planned files match actual changes;
- production architecture is used;
- primary state works;
- selected non-success state works;
- selected interaction works;
- responsive proof works;
- accessibility proof works;
- required tests pass;
- required browser scenario passes;
- screenshots exist;
- required audits exist;
- blocking defects are patched;
- evidence references are traceable;
- no stop condition remains unresolved.

The representative gate remains a separate approval decision.

---

## 24. Anti-patterns

### Static screen first

```text
Create JSX
→ make it look correct
→ add architecture later
```

Required:

```text
Inspect repository
→ define fixture boundary
→ validate manifest
→ implement real slice
```

### Hardcoded fixture inside the route

```tsx
const customers = [...]
```

inside the screen component.

Required:

```text
fixture source
→ adapter or mapper
→ frontend model
→ screen
```

### Temporary alternate route

```text
/demo-customer-list
```

that will later be replaced by the real route.

Use the real route or the real approved route boundary from the start.

### Broad abstraction during slice

```text
Create UniversalDataPage
```

before the representative screen proves a reusable responsibility.

### Evidence after the fact

Do not decide screenshots, browser scenarios, and tests only after implementation.

Declare evidence before coding.

### Silent dependency installation

Do not install a package merely because the slice is difficult without it.

Inspect the repository, document the dependency, and obtain approval.

### Completion by appearance

The slice is not validated because it resembles a design reference.

It must satisfy architecture, state, interaction, responsive, accessibility, and evidence obligations.
