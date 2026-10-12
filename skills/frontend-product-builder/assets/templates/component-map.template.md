---
artifact: frontend-component-map
screen_id: "<screen-id>"
screen_name: "<SCREEN_NAME>"
version: "0.1.0"
status: "<draft | approved | deprecated>"
owner: "<OWNER_OR_TEAM>"
screen_contract: "docs/frontend/screens/<screen-id>/screen-contract.md"
design_system: "docs/frontend/design-system/design-system.json"
component_catalog: "docs/frontend/design-system/component-catalog.json"
layout_recipe: "<recipe-id>"
created_at: "<YYYY-MM-DD>"
updated_at: "<YYYY-MM-DD>"
gate:
  status: "<APPROVED_FOR_SCREEN_IMPLEMENTATION | APPROVED_WITH_COMPONENT_LIMITATIONS | BLOCKED_BY_COMPONENT_DECISIONS>"
---

# Component Map — `<SCREEN_NAME>`

## 1. Purpose

Map every layout-recipe region and interface capability to an approved
component decision before implementation.

---

## 2. Inputs inspected

| ID | Source | Status | Relevant implication |
|---|---|---|---|
| CMP-SRC-001 | `<path>` | Approved | `<implication>` |
| CMP-SRC-002 | `<path>` | Approved | `<implication>` |

---

## 3. Selected layout recipe

| Concern | Decision |
|---|---|
| Recipe | `<recipe-id>` |
| Source | `<source>` |
| Project extension | `<path or none>` |
| Gate status | `<status>` |

---

## 4. Existing-component search

### Directories searched

- `src/components`
- `src/features`
- `src/entities`
- `docs/frontend/design-system/components`
- `docs/frontend/design-system/component-catalog.json`
- `~/.agents/skills/frontend-product-builder/assets/catalog`

### Search terms

- `<capability>`
- `<component category>`
- `<semantic role>`
- `<recipe region>`
- `<possible existing name>`

### Candidates discovered

| Candidate | Catalog status | Capability match | Decision |
|---|---|---|---|
| `<component>` | `<status>` | `<high, medium, low>` | `<inspect, reuse, reject>` |

---

## 5. Disposition legend

Use one:

| Disposition | Meaning |
|---|---|
| `REUSE` | Existing component satisfies the requirement unchanged |
| `CONFIGURE` | Existing approved variant, size, slot, or option satisfies it |
| `COMPOSE` | Existing components together satisfy it |
| `EXTEND` | Existing canonical component needs a reusable contract change |
| `CREATE_LOCAL` | Screen-local composition without shared registration |
| `CREATE_SHARED` | New product-wide shared component |
| `CREATE_DOMAIN` | New feature or entity component |
| `BLOCKED` | Decision cannot proceed safely |

---

## 6. Region-to-component map

| Order | Recipe region | Capability required | Selected component | Level | Disposition | Owner |
|---:|---|---|---|---|---|---|
| 1 | `<region>` | `<capability>` | `<component>` | `<level>` | `<disposition>` | `<owner>` |

Every required recipe region must appear.

---

## 7. Detailed component decisions

Repeat this section for every mapped component.

### CMP-001 — `<ComponentName>`

#### Region

`<recipe region>`

#### Capability

`<required capability>`

#### Selected component

`<component>`

#### Disposition

`<REUSE | CONFIGURE | COMPOSE | EXTEND | CREATE_LOCAL | CREATE_SHARED | CREATE_DOMAIN | BLOCKED>`

#### Selection rationale

`<rationale>`

#### Candidates rejected

| Candidate | Reason rejected |
|---|---|
| `<candidate>` | `<reason>` |

#### Canonical ownership

| Concern | Decision |
|---|---|
| Level | `<level>` |
| Category | `<category>` |
| Owner | `<owner>` |
| Implementation | `<path>` |
| Public import | `<import>` |
| Contract | `<path>` |
| Catalog status | `<status>` |

#### Props and variants

```tsx
<Component
  variant="<variant>"
  size="<size>"
/>
```

| Prop or slot | Value or source | Reason |
|---|---|---|
| `<prop>` | `<value>` | `<reason>` |

#### Composition

```text
<Component>
├── <slot>
├── <slot>
└── <slot>
```

#### Data ownership

| Data | Owner | Source |
|---|---|---|
| `<data>` | `<owner>` | `<query, form, prop>` |

#### State ownership

| State | Owner | Lifecycle |
|---|---|---|
| `<state>` | `<owner>` | `<lifecycle>` |

#### Side effects

| Side effect | Present | Owner |
|---|---:|---|
| Navigation | `<yes/no>` | `<owner>` |
| Mutation | `<yes/no>` | `<owner>` |
| Focus | `<yes/no>` | `<owner>` |
| Scroll | `<yes/no>` | `<owner>` |
| Clipboard | `<yes/no>` | `<owner>` |
| Telemetry | `<yes/no>` | `<owner>` |

#### Responsive behavior

| View | Behavior |
|---|---|
| Compact | `<behavior>` |
| Medium | `<behavior>` |
| Wide | `<behavior>` |
| Ultrawide | `<behavior>` |

#### Accessibility

| Concern | Requirement |
|---|---|
| Semantic element | `<element>` |
| Accessible name | `<source>` |
| Keyboard | `<behavior>` |
| Focus | `<behavior>` |
| Announcements | `<behavior>` |
| Color independence | `<behavior>` |

#### Content cases

| Case | Example | Expected behavior |
|---|---|---|
| Short | `<example>` | `<behavior>` |
| Typical | `<example>` | `<behavior>` |
| Long | `<example>` | `<behavior>` |
| Empty | `<example>` | `<behavior>` |
| Unavailable | `<example>` | `<behavior>` |
| Error | `<example>` | `<behavior>` |

#### Required contract changes

`<changes or none>`

#### Tests

- `<test>`
- `<test>`

#### Storybook

- `<story>`
- `<story>`

#### Risks

- `<risk>`
- `<risk>`

---

## 8. Component hierarchy

Represent the final screen composition:

```text
<ScreenRoute>
├── <LayoutComponent>
│   ├── <SharedComposite>
│   │   ├── <Primitive>
│   │   └── <Primitive>
│   ├── <FeatureComponent>
│   │   ├── <EntityComponent>
│   │   └── <SharedComposite>
│   └── <FeedbackComponent>
└── <OverlayComponent>
```

### Dependency-direction validation

- [ ] Screen imports features, entities, and shared components.
- [ ] Features do not import routes.
- [ ] Entities do not import features.
- [ ] Shared composites do not import domain features.
- [ ] Primitives remain product-agnostic.
- [ ] No component cycle exists.

---

## 9. Region composition

### `<RegionName>`

```text
<Region>
├── <Component>
├── <Component>
└── <Component>
```

#### Spacing owner

`<component or recipe>`

#### Surface owner

`<component or recipe>`

#### Scroll owner

`<component or recipe>`

#### Primary action

`<component or none>`

Repeat for every region.

---

## 10. Shared components to create or extend

| Component | Disposition | Reason | Contract | Catalog update | Representative consumer |
|---|---|---|---|---|---|
| `<component>` | `<EXTEND/CREATE_SHARED>` | `<reason>` | `<path>` | `<required>` | `<consumer>` |

A shared component must not be created without a contract and catalog update.

---

## 11. Local components

| Component | Owner | Purpose | Why it remains local |
|---|---|---|---|
| `<component>` | `<screen/feature>` | `<purpose>` | `<reason>` |

Local components still use approved design-system components and tokens.

---

## 12. Domain components

| Component | Entity or feature | Purpose | Public API |
|---|---|---|---|
| `<component>` | `<owner>` | `<purpose>` | `<import>` |

---

## 13. Duplicate risk

| Proposed or existing component | Similar component | Risk | Resolution |
|---|---|---|---|
| `<component>` | `<component>` | `<high/medium/low>` | `<reuse, merge, document>` |

### Suspicious names found

- `<NewComponent>`
- `<ModernComponent>`
- `<ComponentV2>`

Document why they are duplicates or semantically distinct.

---

## 14. State-to-component map

| Screen state | Region | Component | User action |
|---|---|---|---|
| Initial loading | `<region>` | `<component>` | Wait |
| Refreshing | `<region>` | `<component>` | Continue |
| Data | `<region>` | `<component>` | `<action>` |
| Empty | `<region>` | `<component>` | `<action>` |
| No results | `<region>` | `<component>` | `<action>` |
| Warning | `<region>` | `<component>` | `<action>` |
| Error | `<region>` | `<component>` | Retry |
| Forbidden | `<region>` | `<component>` | Return |
| Unavailable | `<region>` | `<component>` | Retry later |
| Stale | `<region>` | `<component>` | Refresh |
| Processing | `<region>` | `<component>` | Wait |

Do not use the same generic visual content for states with different meanings.

---

## 15. Responsive component map

### Compact

```text
<component tree>
```

### Medium

```text
<component tree>
```

### Wide

```text
<component tree>
```

### Structural differences

| Component | Wide | Medium | Compact |
|---|---|---|---|
| `<component>` | `<behavior>` | `<behavior>` | `<behavior>` |

---

## 16. Accessibility map

| Region | Component | Landmark or role | Accessible name | Focus behavior |
|---|---|---|---|---|
| `<region>` | `<component>` | `<semantics>` | `<name source>` | `<behavior>` |

### Focus sequence

1. `<component>`
2. `<component>`
3. `<component>`

### Live or status announcements

| Event | Component | Announcement policy |
|---|---|---|
| `<event>` | `<component>` | `<policy>` |

---

## 17. Test-responsibility map

| Behavior | Test level | Component or screen | Tool |
|---|---|---|---|
| `<behavior>` | Unit | `<owner>` | `<tool>` |
| `<behavior>` | Component | `<owner>` | `<tool>` |
| `<behavior>` | Browser | `<owner>` | Playwright |
| `<behavior>` | Accessibility | `<owner>` | `<tool>` |
| `<behavior>` | Visual | `<owner>` | Playwright |

---

## 18. Implementation sequence

1. `<foundation or component update>`
2. `<shared composition>`
3. `<feature component>`
4. `<screen static composition>`
5. `<state implementation>`
6. `<data integration>`
7. `<mutation integration>`
8. `<browser validation>`
9. `<artifact synchronization>`

Shared foundational work must precede screen-specific overrides.

---

## 19. Deviations

| Deviation | Reason | Scope | Removal condition |
|---|---|---|---|
| `<deviation>` | `<reason>` | `<scope>` | `<condition>` |

An empty table is preferred.

---

## 20. Acceptance checklist

- [ ] Existing components were searched.
- [ ] Every required recipe region is mapped.
- [ ] Every capability has a disposition.
- [ ] Canonical ownership is explicit.
- [ ] Props and variants are semantic.
- [ ] Data ownership is explicit.
- [ ] State ownership is explicit.
- [ ] Side effects are explicit.
- [ ] Responsive behavior is explicit.
- [ ] Accessibility behavior is explicit.
- [ ] Loading, empty, error, unavailable, and permission states are mapped.
- [ ] Duplicate risk was evaluated.
- [ ] Shared additions have contracts.
- [ ] Shared additions have catalog entries.
- [ ] Local components remain intentionally local.
- [ ] Domain components have feature or entity ownership.
- [ ] Dependency direction is valid.
- [ ] Test responsibilities are mapped.
- [ ] No unresolved blocking component decision remains.

---

## 21. Component-map gate

**Status:**
`<APPROVED_FOR_SCREEN_IMPLEMENTATION | APPROVED_WITH_COMPONENT_LIMITATIONS | BLOCKED_BY_COMPONENT_DECISIONS>`

**Rationale:**
`<rationale>`

**Approved by:**
`<name or role>`

**Approval date:**
`<YYYY-MM-DD>`
