# <Screen Name> — Component Map

## Document metadata

| Field | Value |
|---|---|
| Screen ID | `<screen-id>` |
| Screen specification | `docs/frontend/screens/<screen-id>/screen-spec.json` |
| State matrix | `docs/frontend/screens/<screen-id>/state-matrix.md` |
| Selected recipe | `<recipe-id>` |
| Feature owner | `<feature-or-team>` |
| Status | `draft` |
| Version | `1.0.0` |
| Last updated | `<YYYY-MM-DD>` |

---

## 1. Purpose

This document maps every screen region and product responsibility to:

- an existing project component;
- an approved catalog component;
- an approved composition;
- an approved extension;
- a feature-specific component;
- or a justified new component proposal.

No visible region may remain represented only as:

```text
custom div
temporary panel
modern card
new section
generic container
```

The map must establish:

- component responsibility;
- source catalog;
- ownership;
- variants;
- states;
- data boundary;
- interaction boundary;
- responsive behavior;
- accessibility behavior;
- fallback;
- testing obligations.

---

## 2. Component selection order

Use this order:

```text
1. Existing project component.
2. Existing approved catalog component.
3. Approved composition of existing components.
4. Approved extension to an existing component.
5. Feature-specific component.
6. New shared component proposal.
```

Do not skip directly to a new shared component.

---

## 3. Screen region inventory

| Priority | Region ID | Recipe region | Purpose | Required | State owner |
|---:|---|---|---|---|---|
| 1 | `<screenRegionId>` | `<recipeRegionId>` | `<Responsibility>` | Yes | `<owner>` |

Every region from `screen-spec.json` must appear here.

---

## 4. Component inventory

| Usage ID | Region | Component | Catalog source | Reuse status | Variant | Size | Layer |
|---|---|---|---|---|---|---|---|
| `<usage-id>` | `<regionId>` | `<ComponentName>` | `<catalog-file>` | `<canonical, extended, feature-specific, new-proposed>` | `<variant>` | `<size>` | `<primitive, shared, feature, screen>` |

Reuse status definitions:

### Canonical

The component is used within its existing responsibility and contract.

### Extended

The component remains the same canonical responsibility but requires an approved bounded semantic extension.

### Feature-specific

The component expresses domain composition that should remain inside the feature.

### New proposed

No existing component or composition owns the required responsibility.

---

## 5. Detailed component usage contracts

Duplicate this section for every component usage.

---

### Usage: `<component-usage-id>`

| Field | Value |
|---|---|
| Region | `<screenRegionId>` |
| Component | `<ComponentName>` |
| Catalog source | `<catalog-file>` |
| Existing project source | `<existing-project-path-or-none>` |
| Reuse status | `<canonical, extended, feature-specific, new-proposed>` |
| Layer | `<primitive, shared, feature, screen>` |
| Variant | `<variant-or-none>` |
| Size | `<size-or-none>` |

#### Responsibility

`<Describe the single responsibility this component owns in this screen.>`

#### Why this component

`<Explain why this component matches the product responsibility better than alternatives.>`

#### Rejected alternatives

| Alternative | Reason rejected |
|---|---|
| `<Component or composition>` | `<Reason>` |

#### Data owner

`<Query, form, URL, route, feature, context, static, or none.>`

#### Interaction owner

`<Component, feature, form, route, or workflow owner.>`

#### State owner

`<stateless, local, controlled, form-owned, query-owned, url-owned, feature-owned, route-owned>`

#### Required states

- `<State>`
- `<State>`

#### Slots used

| Slot | Content | Source | Required |
|---|---|---|---|
| `<slot>` | `<Content>` | `<Data or component source>` | `<Yes or No>` |

#### Props and inputs

| Prop or input | Source | Semantic purpose | Validation |
|---|---|---|---|
| `<prop>` | `<Owner>` | `<Purpose>` | `<Rule>` |

#### Events and outputs

| Event | Owner | Effect | Side-effect boundary |
|---|---|---|---|
| `<event>` | `<Owner>` | `<Effect>` | `<Where the actual side effect occurs>` |

#### Fallback

`<What renders when the ordinary component state cannot be presented.>`

#### Responsive behavior

- Compact: `<Behavior>`
- Constrained: `<Behavior>`
- Wide: `<Behavior>`
- Overflow: `<Behavior>`

#### Accessibility behavior

- Semantic element: `<Element or role>`
- Accessible name: `<Source>`
- Keyboard model: `<Behavior>`
- Focus model: `<Behavior>`
- Announcement model: `<Behavior>`

#### Testing obligations

- Stories:
  - `<Story>`
- Component tests:
  - `<Test>`
- Browser tests:
  - `<Scenario>`
- Screenshot states:
  - `<State and viewport>`

---

## 6. Responsibility coverage

Every product responsibility must have exactly one primary owner.

| Responsibility | Primary component | Supporting components | Data owner | Interaction owner |
|---|---|---|---|---|
| `<Responsibility>` | `<Component>` | `<Supporting composition>` | `<Owner>` | `<Owner>` |

Warning signs:

- one responsibility owned by several competing components;
- one generic component owning unrelated responsibilities;
- shared components accessing feature transport;
- screen components containing primitive styling contracts;
- page-local wrappers duplicating shared components.

---

## 7. Region composition trees

Document the intended component hierarchy.

### Region: `<screenRegionId>`

```text
<Canonical region component>
├── <Child component>
│   ├── <Child component>
│   └── <Child component>
└── <Child component>
```

Rules:

- The tree describes responsibility, not every DOM element.
- Do not include styling-only wrappers unless they own a layout contract.
- Do not create a component solely because a `div` requires a class.
- Screen components orchestrate approved components and feature behavior.
- Shared components remain domain-neutral.
- Feature components may be domain-specific.

---

## 8. Data and interaction ownership matrix

| Usage ID | Query data | Form data | URL data | Local state | Mutation | Navigation | Permission |
|---|---|---|---|---|---|---|---|
| `<usage-id>` | `<Owner or none>` | `<Owner or none>` | `<Owner or none>` | `<Owner or none>` | `<Owner or none>` | `<Owner or none>` | `<Owner or none>` |

The component itself must not gain ownership merely because it renders the related UI.

Example:

```text
SearchInput
    ↓ emits query text
URL adapter
    ↓ serializes query
feature query hook
    ↓ executes request
collection
    ↓ renders data
```

---

## 9. Component-state coverage

| Usage ID | Default | Loading | Empty | Error | Disabled | Read-only | Processing | Stale |
|---|---|---|---|---|---|---|---|---|
| `<usage-id>` | `<State>` | `<State>` | `<State>` | `<State>` | `<State>` | `<State>` | `<State>` | `<State>` |

Use `N/A — <reason>` for unsupported or irrelevant states.

---

## 10. Component gap analysis

Complete this section before proposing a new component.

### Required responsibility

`<Describe the missing responsibility without naming a desired visual component.>`

### Existing project components reviewed

| Component | Why insufficient |
|---|---|
| `<Component>` | `<Reason>` |

### Catalog components reviewed

| Component | Why insufficient |
|---|---|
| `<Component>` | `<Reason>` |

### Composition attempts evaluated

| Composition | Why insufficient |
|---|---|
| `<Composition>` | `<Reason>` |

### Extension feasibility

`<Explain whether an existing canonical component can receive a bounded semantic extension.>`

### Decision

`<canonical, composition, extension, feature-specific, new shared proposal>`

A new component proposal is invalid when the rationale is only:

- different color;
- different shadow;
- different spacing;
- modern appearance;
- card-like layout;
- screen-specific name;
- preference for another API.

---

## 11. Extension contract

Complete only when `reuseStatus` is `extended`.

| Field | Decision |
|---|---|
| Canonical component | `<Component>` |
| New semantic capability | `<Capability>` |
| New variant or slot | `<Variant or slot>` |
| Existing responsibility preserved | `<How>` |
| Consumers | `<Expected consumers>` |
| Token additions | `<Tokens or none>` |
| Accessibility effect | `<Effect>` |
| Responsive effect | `<Effect>` |
| Test additions | `<Tests>` |
| Catalog update required | `<Yes or No>` |

The extension must not turn one component into several unrelated components.

---

## 12. Feature-specific component contract

Complete only when `reuseStatus` is `feature-specific`.

| Field | Decision |
|---|---|
| Name | `<FeatureComponentName>` |
| Feature path | `src/features/<feature>/components/<file>.tsx` |
| Domain responsibility | `<Responsibility>` |
| Shared components composed | `<Components>` |
| Data owner | `<Owner>` |
| Interaction owner | `<Owner>` |
| Transport access | `<Prohibited or justified feature adapter>` |
| Expected reuse | `<Within which feature surfaces>` |
| Promotion threshold | `<When it should be reviewed for shared promotion>` |

A feature-specific component must not duplicate a shared component under a domain-specific name.

---

## 13. New shared component proposal

Complete only when `reuseStatus` is `new-proposed`.

### Identity

| Field | Value |
|---|---|
| Proposed name | `<ComponentName>` |
| Proposed ID | `<component-id>` |
| Layer | `<shared-composite or another approved layer>` |
| Category | `<Category>` |
| Proposed source | `<catalog-fragment>` |
| Expected implementation | `<path>` |

### Responsibility

`<One canonical responsibility.>`

### Expected consumers

- `<Consumer>`
- `<Consumer>`

### Why composition is insufficient

`<Rationale>`

### State ownership

`<Ownership model>`

### Data-access policy

`<Policy>`

### Variants

- `<Variant>`
- `<Variant>`

### Required states

- `<State>`
- `<State>`

### Accessibility model

`<Semantic, keyboard, focus, and announcement contract.>`

### Responsive behavior

`<Behavior>`

### Test obligations

- `<Story>`
- `<Component test>`
- `<Browser scenario>`

### Approval

| Field | Value |
|---|---|
| Status | `<blocked, proposed, approved, rejected>` |
| Approved by | `<Name or null>` |
| Evidence | `<Evidence>` |

Implementation must not create the proposed shared component while its status remains `blocked` or `proposed`.

---

## 14. Duplicate-risk review

Search the existing project for equivalent responsibilities.

| Search target | Search performed | Result | Decision |
|---|---|---|---|
| Component name | `<Search>` | `<Result>` | `<Reuse or no match>` |
| Similar JSX anatomy | `<Search>` | `<Result>` | `<Decision>` |
| Similar labels or variants | `<Search>` | `<Result>` | `<Decision>` |
| Similar hook or state model | `<Search>` | `<Result>` | `<Decision>` |

Review suspicious names such as:

```text
ModernCard
CustomPanel
NewButton
AdvancedTable
SmartForm
GenericSection
PageContainer
ActionBox
```

Names alone do not prove duplication, but they require responsibility review.

---

## 15. Styling and token ownership

| Usage ID | Surface owner | Spacing owner | Width owner | Overflow owner | Tokens |
|---|---|---|---|---|---|
| `<usage-id>` | `<Owner>` | `<Owner>` | `<Owner>` | `<Owner>` | `<Tokens>` |

Rules:

- Parents own spacing between sibling components.
- Components own internal spacing.
- Layout components own width and placement.
- Data-display components do not invent route width.
- Raw values require explicit approval.
- Page-local classes must not create parallel component variants.

---

## 16. Responsive composition map

| Range | Region | Component change | Composition change | DOM order change |
|---|---|---|---|---|
| Compact | `<region>` | `<Behavior>` | `<Behavior>` | `No` |
| Constrained | `<region>` | `<Behavior>` | `<Behavior>` | `No` |
| Wide | `<region>` | `<Behavior>` | `<Behavior>` | `No` |

A responsive presentation change must not silently change responsibility.

---

## 17. Accessibility composition review

| Region | Landmark or group | Heading | Keyboard model | Focus behavior | Announcement owner |
|---|---|---|---|---|---|
| `<region>` | `<Semantic>` | `<Heading>` | `<Behavior>` | `<Behavior>` | `<Component>` |

Check:

- [ ] No duplicated accessible names.
- [ ] No interactive component nested inside another interactive component.
- [ ] No tooltip-only essential information.
- [ ] No visual reorder that breaks focus order.
- [ ] Dialog and overlay foundations own focus correctly.
- [ ] Validation remains associated with controls.
- [ ] Status changes use one deliberate announcement strategy.
- [ ] Icon-only actions have explicit accessible names.

---

## 18. Component-map gate

The component map passes only when:

- [ ] Every recipe region is represented.
- [ ] Every product responsibility has one primary owner.
- [ ] Every visible component has a source or approved proposal.
- [ ] Existing project components were inspected first.
- [ ] Catalog components were inspected.
- [ ] Component state ownership is explicit.
- [ ] Data and interaction ownership are explicit.
- [ ] Fallback behavior is defined.
- [ ] Responsive behavior is defined.
- [ ] Accessibility behavior is defined.
- [ ] Duplicate risks were reviewed.
- [ ] New shared proposals have approval.
- [ ] No component owns transport or mutation outside its contract.

**Gate status:** `<blocked, ready, approved, rejected>`

**Blocking issues:**

- `<Issue or none>`

**Approval evidence:**

- `<Evidence>`
