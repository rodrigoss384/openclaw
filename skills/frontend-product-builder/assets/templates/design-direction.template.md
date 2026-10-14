---
artifact: frontend-design-direction
project: "<PROJECT_NAME>"
version: "0.1.0"
status: "draft"
language: "<pt-BR | en-US | other>"
product_context: "docs/frontend/product-context.md"
owner: "<OWNER_OR_TEAM>"
created_at: "<YYYY-MM-DD>"
updated_at: "<YYYY-MM-DD>"
gate:
  status: "<APPROVED_FOR_FOUNDATION | APPROVED_WITH_LIMITATIONS | BLOCKED_BY_DESIGN_DECISIONS>"
---

# Frontend Design Direction

Styling expression and visual-reference authority are recorded in `docs/frontend/styling-authority.json`.

## 1. Purpose

Describe which product scope this direction governs.

State whether it covers:

- the complete frontend;
- one product area;
- one new module;
- one representative workflow.

---

## 2. Evidence used

| ID | Evidence | Relevant implication |
|---|---|---|
| EVD-001 | `docs/frontend/product-context.md#...` | `<implication>` |
| EVD-002 | `<reference>` | `<implication>` |

---

## 3. Product-to-design translation

| Product evidence | Design requirement |
|---|---|
| `<evidence>` | `<implementable requirement>` |
| `<evidence>` | `<implementable requirement>` |

---

## 4. Interface archetype

**Selected archetype:**
`<dense operational workspace | analytical control center | review-and-approval workspace | other>`

**Rationale:**
`<Why this archetype supports the primary jobs>`

**Rejected archetypes:**

| Archetype | Reason rejected |
|---|---|
| `<archetype>` | `<reason>` |

---

## 5. Direction statement

Write one concise but implementable statement.

Example structure:

> A compact, desktop-oriented operational workspace with restrained neutral
> surfaces, strong information hierarchy, explicit critical states, compact
> page headers, semantic actions, and responsive transformation for tablet use.

Do not use unsupported adjectives.

---

## 6. Direction attributes

| Attribute | Decision | Concrete consequence |
|---|---|---|
| Tone | `<decision>` | `<rule>` |
| Density | `<decision>` | `<rule>` |
| Hierarchy | `<decision>` | `<rule>` |
| Layout character | `<decision>` | `<rule>` |
| Interaction character | `<decision>` | `<rule>` |
| Data character | `<decision>` | `<rule>` |

---

## 7. Candidate comparison

Complete only when multiple candidates were necessary.

| Criterion | Weight | Candidate A | Candidate B | Candidate C |
|---|---:|---:|---:|---:|
| Task efficiency | 20% | 0 | 0 | 0 |
| Information clarity | 20% | 0 | 0 | 0 |
| Domain fit | 15% | 0 | 0 | 0 |
| Accessibility | 15% | 0 | 0 | 0 |
| Scalability | 10% | 0 | 0 | 0 |
| Responsiveness | 10% | 0 | 0 | 0 |
| Implementation risk | 5% | 0 | 0 | 0 |
| Maintenance cost | 5% | 0 | 0 | 0 |

Scores range from 1 to 5.

**Recommended candidate:** `<candidate>`

**Reason:** `<reason>`

---

## 8. Density system

### Global density

`<spacious | comfortable | comfortable-compact | compact | dense>`

| Context | Density | Intended behavior |
|---|---|---|
| Application shell | `<density>` | `<behavior>` |
| Forms | `<density>` | `<behavior>` |
| Tables | `<density>` | `<behavior>` |
| Dashboards | `<density>` | `<behavior>` |
| Mobile adaptation | `<density>` | `<behavior>` |

### Preliminary dimensional intent

These are direction-level constraints, not final tokens.

| Element | Intent |
|---|---|
| Standard control height | `<compact, standard, large>` |
| Table row height | `<intent>` |
| Card padding | `<intent>` |
| Section spacing | `<intent>` |
| Page padding | `<intent>` |
| Minimum interactive target | `<intent>` |

---

## 9. Layout family

**Primary family:**
`<family>`

**Secondary approved patterns:**

- `<pattern>`
- `<pattern>`

**Prohibited patterns:**

- `<pattern and reason>`
- `<pattern and reason>`

---

## 10. Application shell

| Element | Decision |
|---|---|
| Primary navigation | `<decision>` |
| Navigation states | `<decision>` |
| Global header | `<decision>` |
| Tenant/organization context | `<decision>` |
| User menu | `<decision>` |
| Breadcrumbs | `<decision>` |
| Page-width behavior | `<decision>` |
| Scroll ownership | `<decision>` |
| Mobile navigation | `<decision>` |

### Shell hierarchy

Describe what remains persistent and what changes per route.

---

## 11. Semantic Outline

Heading tags describe document structure and navigation. They are not a visual
scale and must not be selected to force size or weight.

| Semantic level | Typical content | Purpose | Notes |
|---|---|---|---|
| h1 | Page or route heading | `<purpose>` | `<notes>` |
| h2 | Major section | `<purpose>` | `<notes>` |
| h3 | Subsection | `<purpose>` | `<notes>` |
| h4-h6 | Rare nested structure | `<purpose>` | `<notes>` |

## 12. Visual Priority Ladder

Visual priority is expressed with semantic text styles, position, spacing,
contrast, component treatment, and action hierarchy.

| Priority | Typical content | Visual role | Treatment |
|---|---|---|---|
| Critical | Deadline/error/risk requiring attention | `<role>` | `<treatment>` |
| Primary | Dominant task and page orientation | `<role>` | `<treatment>` |
| Supporting | Decision information and explanatory copy | `<role>` | `<treatment>` |
| Contextual | Metadata and secondary affordances | `<role>` | `<treatment>` |
| Audit | Technical/accountability detail | `<role>` | `<treatment>` |

### Progressive disclosure

| Content type | Default placement |
|---|---|
| Critical information | Visible |
| Primary task information | Visible |
| Supporting metadata | `<placement>` |
| Rare administrative actions | `<placement>` |
| Audit detail | `<placement>` |
| Technical detail | `<placement>` |

---

## 13. Typography direction

| Role | Behavior |
|---|---|
| Interface font | `<family or category>` |
| Fallback | `<fallback>` |
| Page title | `<size behavior, weight, line height>` |
| Section title | `<behavior>` |
| Body | `<behavior>` |
| Label | `<behavior>` |
| Metadata | `<behavior>` |
| Numerical values | `<behavior>` |
| Identifiers | `<behavior>` |

### Typography restrictions

- `<restriction>`
- `<restriction>`

---

## 14. Semantic color direction

This section defines roles. Exact values belong in the design system.

| Semantic role | Intended use | Restrictions |
|---|---|---|
| Canvas | Application background | `<restriction>` |
| Surface | Main content | `<restriction>` |
| Elevated surface | Overlay or active layer | `<restriction>` |
| Primary text | Main content | `<restriction>` |
| Secondary text | Supporting content | `<restriction>` |
| Muted text | Low-priority metadata | Must remain accessible |
| Primary action | Dominant action | Maximum one per section |
| Success | Confirmed successful state | Not decorative |
| Warning | Attention required | Not equivalent to error |
| Danger | Destructive or critical | Not decorative |
| Information | Neutral guidance | Not used for every label |
| Focus | Keyboard focus | Must remain visible |
| Selection | Selected row/item | Must not depend on color alone |

### Theme policy

`<light | dark | both | system preference>`

### Brand-accent policy

`<How and where the accent may be used>`

---

## 15. Surface hierarchy

| Level | Purpose | Separation method | Common use |
|---|---|---|---|
| Surface 0 | Canvas | `<method>` | App background |
| Surface 1 | Primary content | `<method>` | Main page |
| Surface 2 | Nested/interactive | `<method>` | Cards, controls |
| Surface 3 | Overlay | `<method>` | Dialogs, menus |
| Critical | Attention context | `<method>` | Warning/danger |

### Card policy

Explain when a card is justified and when ordinary layout grouping should be
used instead.

---

## 15. Spacing direction

**Base rhythm:** `<4px | 8px | other>`

| Relationship | Intended spacing |
|---|---|
| Icon to label | `<intent>` |
| Label to control | `<intent>` |
| Field to field | `<intent>` |
| Content within card | `<intent>` |
| Section to section | `<intent>` |
| Page edge to content | `<intent>` |
| Modal edge to content | `<intent>` |

### Whitespace policy

Explain how whitespace communicates grouping and where large empty areas are
not acceptable.

---

## 16. Shape and radius direction

| Component class | Radius policy |
|---|---|
| Inputs | `<policy>` |
| Buttons | `<policy>` |
| Cards | `<policy>` |
| Dialogs | `<policy>` |
| Badges | `<policy>` |
| Pills | `<allowed use>` |

---

## 17. Borders and elevation

| Context | Preferred technique |
|---|---|
| Ordinary section separation | `<border/background/divider>` |
| Active component | `<technique>` |
| Dialog | `<technique>` |
| Popover/menu | `<technique>` |
| Critical state | `<technique>` |

### Shadow policy

`<policy>`

---

## 18. Iconography

| Decision | Rule |
|---|---|
| Icon family | `<family>` |
| Default size | `<size intent>` |
| Stroke style | `<style>` |
| Filled icons | `<policy>` |
| Status icons | `<policy>` |
| Icon-only actions | `<policy>` |
| Decorative icons | `<policy>` |

---

## 19. Motion

| Motion category | Policy |
|---|---|
| General level | `<minimal, moderate, expressive>` |
| State transition | `<policy>` |
| Overlay transition | `<policy>` |
| Loading | `<policy>` |
| Layout movement | `<policy>` |
| Reduced motion | `<policy>` |

---

## 20. Action hierarchy

| Action type | Visual treatment | Placement | Confirmation |
|---|---|---|---|
| Primary | `<treatment>` | `<placement>` | `<policy>` |
| Secondary | `<treatment>` | `<placement>` | `<policy>` |
| Tertiary | `<treatment>` | `<placement>` | `<policy>` |
| Contextual | `<treatment>` | `<placement>` | `<policy>` |
| Destructive | `<treatment>` | `<placement>` | `<policy>` |
| Warning | `<treatment>` | `<placement>` | `<policy>` |

### Action restrictions

- Maximum dominant actions per section: `<number>`
- Full-width buttons: `<allowed contexts>`
- Icon-only buttons: `<allowed contexts>`
- Export actions: `<treatment>`
- Destructive ordering: `<policy>`

---

## 21. Form direction

| Aspect | Decision |
|---|---|
| Label placement | `<decision>` |
| Required indicator | `<decision>` |
| Help text | `<decision>` |
| Validation timing | `<decision>` |
| Error placement | `<decision>` |
| Field grouping | `<decision>` |
| Maximum form width | `<decision>` |
| Multi-column behavior | `<decision>` |
| Action placement | `<decision>` |
| Success feedback | `<decision>` |

---

## 22. Table and list direction

| Aspect | Decision |
|---|---|
| Table usage | `<criteria>` |
| Card-list usage | `<criteria>` |
| Row density | `<decision>` |
| Column priority | `<decision>` |
| Sticky headers | `<policy>` |
| Truncation | `<policy>` |
| Horizontal scrolling | `<policy>` |
| Bulk actions | `<policy>` |
| Pagination | `<policy>` |
| Mobile transformation | `<policy>` |

---

## 23. Dashboard and metric direction

| Aspect | Decision |
|---|---|
| KPI grouping | `<decision>` |
| Critical metrics | `<treatment>` |
| Financial metrics | `<treatment>` |
| Operational metrics | `<treatment>` |
| Trends | `<treatment>` |
| Comparison periods | `<treatment>` |
| Charts | `<policy>` |
| Freshness | `<policy>` |
| Zero values | `<policy>` |

---

## 24. State and feedback direction

| State | Pattern |
|---|---|
| Initial loading | `<pattern>` |
| Refreshing | `<pattern>` |
| Empty | `<pattern>` |
| Success | `<pattern>` |
| Warning | `<pattern>` |
| Error | `<pattern>` |
| Unauthorized | `<pattern>` |
| Forbidden | `<pattern>` |
| Unavailable | `<pattern>` |
| Stale data | `<pattern>` |
| Automated suggestion | `<pattern>` |
| Human-confirmed result | `<pattern>` |

---

## 25. Responsive strategy

### Supported environment

| Target | Decision |
|---|---|
| Primary viewport | `<viewport>` |
| Minimum supported viewport | `<viewport>` |
| Tablet support | `<full, adapted, limited, none>` |
| Mobile support | `<full, adapted, limited, none>` |
| Expected zoom | `<expectation>` |
| Text scaling | `<expectation>` |

### Transformation rules

| Pattern | Wide desktop | Desktop | Tablet | Mobile |
|---|---|---|---|---|
| Navigation | `<behavior>` | `<behavior>` | `<behavior>` | `<behavior>` |
| Page actions | `<behavior>` | `<behavior>` | `<behavior>` | `<behavior>` |
| KPI grid | `<behavior>` | `<behavior>` | `<behavior>` | `<behavior>` |
| Filters | `<behavior>` | `<behavior>` | `<behavior>` | `<behavior>` |
| Tables | `<behavior>` | `<behavior>` | `<behavior>` | `<behavior>` |
| Detail panels | `<behavior>` | `<behavior>` | `<behavior>` | `<behavior>` |
| Tabs | `<behavior>` | `<behavior>` | `<behavior>` | `<behavior>` |
| Forms | `<behavior>` | `<behavior>` | `<behavior>` | `<behavior>` |

---

## 26. Accessibility baseline

| Requirement | Direction rule |
|---|---|
| Contrast | `<rule>` |
| Keyboard focus | `<rule>` |
| Target size | `<rule>` |
| Labels | `<rule>` |
| Error association | `<rule>` |
| Color independence | `<rule>` |
| Reduced motion | `<rule>` |
| Semantic structure | `<rule>` |
| Screen-reader names | `<rule>` |

---

## 27. Reference analysis

For each approved visual reference:

### REF-001 — `<Reference name>`

**Useful characteristics:**

- `<characteristic>`
- `<characteristic>`

**Characteristics not suitable for this product:**

- `<characteristic and reason>`
- `<characteristic and reason>`

**Assumed behavior requiring validation:**

- `<assumption>`

---

## 28. Representative screens

| Screen ID | Screen | Why representative | Patterns validated |
|---|---|---|---|
| SCR-001 | `<screen>` | `<reason>` | `<patterns>` |
| SCR-002 | `<screen>` | `<reason>` | `<patterns>` |
| SCR-003 | `<screen>` | `<reason>` | `<patterns>` |

Do not implement the entire screen inventory before these patterns are
validated.

---

## 29. Prohibited patterns

- `<Example: unrestricted use of cards as page layout>`
- `<Example: primary accent used for destructive actions>`
- `<Example: fixed-height content cards>`
- `<Example: absolute positioning for ordinary layout>`
- `<Example: technical identifiers exposed directly>`
- `<Project-specific prohibition>`

---

## 30. Open design decisions

| Decision ID | Question | Impact | Recommended decision | Owner | Status |
|---|---|---|---|---|---|
| DSD-001 | `<question>` | High | `<recommendation>` | `<owner>` | Open |

---

## 31. Direction acceptance checklist

- [ ] Direction is grounded in product evidence.
- [ ] Interface archetype is explicit.
- [ ] Density is explicit.
- [ ] Layout family is explicit.
- [ ] Application-shell behavior is explicit.
- [ ] Content hierarchy is explicit.
- [ ] Typography behavior is explicit.
- [ ] Semantic color roles are explicit.
- [ ] Surface hierarchy is explicit.
- [ ] Spacing policy is explicit.
- [ ] Radius and elevation policies are explicit.
- [ ] Action hierarchy is explicit.
- [ ] Form behavior is explicit.
- [ ] Table and list behavior are explicit.
- [ ] Dashboard behavior is explicit.
- [ ] State patterns are explicit.
- [ ] Responsive transformations are explicit.
- [ ] Accessibility baseline is explicit.
- [ ] Prohibited patterns are recorded.
- [ ] Representative screens are selected.
- [ ] No unresolved high-impact design decision remains.

---

## 32. Direction gate

**Status:**
`<APPROVED_FOR_FOUNDATION | APPROVED_WITH_LIMITATIONS | BLOCKED_BY_DESIGN_DECISIONS>`

**Rationale:**
`<rationale>`

**Limitations:**

- `<limitation>`
- `<limitation>`

**Approved by:**
`<name or role>`

**Approval date:**
`<YYYY-MM-DD>`
