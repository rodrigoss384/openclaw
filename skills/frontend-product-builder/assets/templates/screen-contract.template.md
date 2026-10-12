---
artifact: frontend-screen-contract
screen_id: "<screen-id>"
screen_name: "<SCREEN_NAME>"
route: "<ROUTE>"
version: "0.1.0"
status: "<draft | approved | deprecated>"
owner: "<OWNER_OR_TEAM>"
product_context: "docs/frontend/product-context.md"
design_direction: "docs/frontend/design-direction.md"
frontend_architecture: "docs/frontend/frontend-architecture.md"
design_system: "docs/frontend/design-system/design-system.json"
component_catalog: "docs/frontend/design-system/component-catalog.json"
layout_recipe: "<recipe-id>"
layout_recipe_source: "<recipe-source>"
api_contracts:
  - "<api-contract-path>"
created_at: "<YYYY-MM-DD>"
updated_at: "<YYYY-MM-DD>"
gate:
  status: "<APPROVED_FOR_COMPONENT_MAPPING | APPROVED_WITH_SCREEN_LIMITATIONS | BLOCKED_BY_SCREEN_DECISIONS>"
---

# Screen Contract — `<SCREEN_NAME>`

## 1. Purpose

Describe:

- what the screen enables;
- which user outcome it supports;
- why the route exists;
- what the screen explicitly does not own.

---

## 2. Primary user

| Concern | Definition |
|---|---|
| User or role | `<user>` |
| Capability | `<capability>` |
| Experience level | `<level>` |
| Task frequency | `<frequent, occasional, rare>` |
| Task urgency | `<low, medium, high, critical>` |
| Failure consequence | `<consequence>` |

Do not use role names as substitutes for capability definitions.

---

## 3. Primary job

Use this form:

```text
When <trigger>,
the <user>
needs to <task>
so that <outcome>.
```

### Trigger

`<trigger>`

### Task

`<task>`

### Outcome

`<outcome>`

### Completion signal

`<how the user knows the task is complete>`

---

## 4. Route contract

| Concern | Decision |
|---|---|
| Route | `<route>` |
| Route parameters | `<parameters>` |
| Search parameters | `<parameters>` |
| Parent layout | `<layout>` |
| Authentication | `<requirement>` |
| Capabilities | `<capabilities>` |
| Page title | `<title strategy>` |
| Breadcrumbs | `<strategy>` |
| Return navigation | `<strategy>` |
| Error boundary | `<boundary>` |
| Lazy loading | `<policy>` |

---

## 5. Selected layout recipe

**Recipe:**
`<recipe-id>`

**Source:** 
`<source>`

### Selection rationale

Explain why this recipe fits:

- dominant task;
- data shape;
- action hierarchy;
- information hierarchy;
- responsive transformation;
- accessibility requirements.

### Candidate recipes rejected

| Recipe | Why it was considered | Why it was rejected |
|---|---|---|
| `<recipe>` | `<reason>` | `<reason>` |

### Project-level extension

**Required:** `<yes/no>`

**Extension path:** `<path or not applicable>`

**Reason:** `<reason>`

---

## 6. Information hierarchy

Use these priorities:

- critical;
- primary;
- supporting;
- contextual;
- audit.

| Information | Priority | Why the user needs it | Placement |
|---|---|---|---|
| `<information>` | `<priority>` | `<reason>` | `<region>` |

### Progressive disclosure

| Content | Disclosure method | Reason |
|---|---|---|
| `<content>` | `<drawer, disclosure, tab, aside, overflow>` | `<reason>` |

Critical information must not be hidden through progressive disclosure.

---

## 7. Region inventory

| Order | Recipe region | Required | Screen usage | Content priority | Landmark |
|---:|---|---:|---|---|---|
| 1 | `<region>` | Yes | `<usage>` | `<priority>` | `<landmark>` |

### Omitted optional regions

| Region | Reason for omission |
|---|---|
| `<region>` | `<reason>` |

### Added project-specific regions

| Region | Reason | Recipe extension |
|---|---|---|
| `<region>` | `<reason>` | `<path>` |

Do not add regions without recipe analysis.

---

## 8. Primary and secondary actions

### Primary action

| Concern | Decision |
|---|---|
| Action | `<action>` |
| Region | `<region>` |
| Capability | `<capability>` |
| Eligibility | `<conditions>` |
| Pending behavior | `<behavior>` |
| Success behavior | `<behavior>` |
| Failure behavior | `<behavior>` |
| Duplicate prevention | `<behavior>` |

### Secondary actions

| Action | Region | Priority | Eligibility | Narrow behavior |
|---|---|---|---|---|
| `<action>` | `<region>` | Secondary | `<conditions>` | `<behavior>` |

### Destructive or sensitive actions

| Action | Region | Impact | Confirmation | Reauthentication | Audit |
|---|---|---|---|---|---|
| `<action>` | `<region>` | `<impact>` | `<behavior>` | `<behavior>` | `<behavior>` |

---

## 9. Data dependencies

| Data | Owner | Query or source | Required | Freshness | Failure scope |
|---|---|---|---:|---|---|
| `<data>` | `<feature/entity>` | `<query>` | Yes | `<policy>` | `<scope>` |

### Data dependency graph

```text
<route prerequisite>
    ↓
<primary query>
    ↓
<dependent query>
```

### Cancellation

`<policy>`

### Background refresh

`<policy>`

### Tenant or organization isolation

`<policy>`

---

## 10. State ownership

| State | Type | Owner | Persistence | URL |
|---|---|---|---|---:|
| `<state>` | `<server, URL, form, local, feature>` | `<owner>` | `<lifecycle>` | `<yes/no>` |

### Prohibited duplication

Describe values that must not exist simultaneously in several state systems.

---

## 11. Permissions

| Capability | Required for | Missing-capability behavior |
|---|---|---|
| `<capability>` | `<region or action>` | `<hidden, disabled, read-only, forbidden>` |

### Disclosure policy

`<policy>`

The backend remains authoritative.

---

## 12. Content contract

### Terminology

| Technical or backend term | User-facing term |
|---|---|
| `<technical term>` | `<user term>` |

### Date and time

`<format and time-zone policy>`

### Numbers and currency

`<format policy>`

### Missing values

| Condition | Presentation |
|---|---|
| Zero | `<presentation>` |
| Unknown | `<presentation>` |
| Not informed | `<presentation>` |
| Not applicable | `<presentation>` |
| Not calculated | `<presentation>` |
| Restricted | `<presentation>` |

### Long-content cases

| Content | Maximum realistic example | Behavior |
|---|---|---|
| `<content>` | `<example>` | `<wrap, truncate, expand>` |

---

## 13. Screen states

| State | Scope | Required | Rendering | User action |
|---|---|---:|---|---|
| Initial loading | Route | Yes | `<behavior>` | Wait |
| Refreshing | Region | `<yes/no>` | `<behavior>` | Continue |
| Data | Route | Yes | `<behavior>` | `<action>` |
| Empty | Region | `<yes/no>` | `<behavior>` | `<action>` |
| No results | Region | `<yes/no>` | `<behavior>` | `<action>` |
| Warning | Region | `<yes/no>` | `<behavior>` | `<action>` |
| Partial | Region | `<yes/no>` | `<behavior>` | `<action>` |
| Error | Region/route | Yes | `<behavior>` | Retry |
| Unauthorized | Route | `<yes/no>` | `<behavior>` | Authenticate |
| Forbidden | Route/region | Yes | `<behavior>` | Return |
| Unavailable | Region | `<yes/no>` | `<behavior>` | Retry later |
| Stale | Region/route | `<yes/no>` | `<behavior>` | Refresh |
| Processing | Region | `<yes/no>` | `<behavior>` | Wait |

### State distinctions

Explain distinctions such as:

- empty versus no results;
- zero versus unavailable;
- warning versus error;
- processing versus complete;
- machine suggestion versus human decision.

---

## 14. Responsive transformations

### Compact

```text
<structural layout>
```

### Medium

```text
<structural layout>
```

### Wide

```text
<structural layout>
```

### Ultrawide

```text
<structural layout>
```

### Transformation matrix

| From | To | Structural change | Reason |
|---|---|---|---|
| Wide | Medium | `<change>` | `<reason>` |
| Medium | Compact | `<change>` | `<reason>` |

### Overflow ownership

`<policy>`

### Scroll ownership

`<policy>`

### Zoom expectation

`<policy>`

Do not describe responsiveness only through CSS breakpoint classes.

---

## 15. Accessibility requirements

### Landmarks

| Region | Landmark | Label |
|---|---|---|
| `<region>` | `<landmark>` | `<label>` |

### Heading structure

```text
h1 — <screen>
  h2 — <section>
    h3 — <subsection>
```

### Focus order

1. `<region>`
2. `<region>`
3. `<region>`

### Keyboard

- `<requirement>`
- `<requirement>`

### Announcements

- `<requirement>`
- `<requirement>`

### Color independence

`<policy>`

### Contrast

`WCAG 2.2 AA`

---

## 16. Security and privacy

| Concern | Decision |
|---|---|
| Sensitive data | `<data>` |
| Masking | `<policy>` |
| Logging | `<policy>` |
| Browser storage | `<policy>` |
| Cache | `<policy>` |
| Export | `<policy>` |
| Audit | `<policy>` |
| Technical details | `<policy>` |

---

## 17. Performance

| Concern | Requirement |
|---|---|
| Initial route load | `<requirement>` |
| Lazy loading | `<requirement>` |
| Query concurrency | `<requirement>` |
| Large lists | `<requirement>` |
| Images or documents | `<requirement>` |
| Rerender risk | `<requirement>` |
| Bundle impact | `<requirement>` |

---

## 18. Component-map dependency

The screen must have:

```text
docs/frontend/screens/<screen-id>/component-map.md
```

The component map must be approved before implementation.

---

## 19. Validation plan

### Static

- [ ] Route and recipe are explicit.
- [ ] Regions match the selected recipe.
- [ ] Primary action hierarchy is valid.
- [ ] Data ownership is explicit.
- [ ] Permissions are explicit.
- [ ] Screen states are complete.
- [ ] Responsive transformations are structural.
- [ ] Accessibility requirements are explicit.

### Component

- `<component test>`
- `<component test>`

### Browser

| Scenario | Viewport | Expected result |
|---|---|---|
| Default data | 1440×900 | `<result>` |
| Desktop constrained | 1366×768 | `<result>` |
| Medium | 1024×768 | `<result>` |
| Compact | 390×844 | `<result>` |
| Zoom | 125% | `<result>` |
| Keyboard | 1366×768 | `<result>` |
| Long content | 1366×768 | `<result>` |
| Error | 1366×768 | `<result>` |

### Visual regression

`<screenshots and thresholds>`

---

## 20. Acceptance criteria

Use verifiable criteria.

- [ ] `<criterion>`
- [ ] `<criterion>`
- [ ] `<criterion>`

Avoid criteria such as:

- “looks modern”;
- “looks professional”;
- “responsive and beautiful”.

---

## 21. Open questions

| ID | Question | Impact | Owner | Status |
|---|---|---|---|---|
| SCR-DEC-001 | `<question>` | High | `<owner>` | Open |

---

## 22. Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| `<risk>` | `<level>` | `<level>` | `<mitigation>` |

---

## 23. Screen gate

**Status:**
`<APPROVED_FOR_COMPONENT_MAPPING | APPROVED_WITH_SCREEN_LIMITATIONS | BLOCKED_BY_SCREEN_DECISIONS>`

**Rationale:**
`<rationale>`

**Approved by:**
`<name or role>`

**Approval date:** 
`<YYYY-MM-DD>`
