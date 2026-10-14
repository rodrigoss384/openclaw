---
artifact: frontend-component-contract
component: "<COMPONENT_NAME>"
category: "<primitive | composite | layout | feedback | navigation | data-display | domain>"
version: "0.1.0"
status: "<draft | approved | deprecated>"
owner: "<OWNER_OR_TEAM>"
source: "<SOURCE_PATH>"
foundation: "<shadcn/ui | Radix | native HTML | custom>"
design_system: "docs/frontend/design-system/design-system.json"
created_at: "<YYYY-MM-DD>"
updated_at: "<YYYY-MM-DD>"
gate:
  status: "<APPROVED_FOR_IMPLEMENTATION | APPROVED_WITH_LIMITATIONS | BLOCKED_BY_COMPONENT_DECISIONS>"
---

# Component Contract — `<COMPONENT_NAME>`

## 1. Purpose

Describe:

- what the component represents;
- which user or interface problem it solves;
- why it belongs in the shared or domain component system;
- which responsibility it explicitly does not own.

---

## 2. Classification

| Concern | Decision |
|---|---|
| Hierarchy level | `<primitive, composite, feature, screen>` |
| Category | `<category>` |
| Owner | `<owner>` |
| Source | `<path>` |
| Foundation | `<source component or native element>` |
| Public import | `<public import path>` |
| Stability | `<experimental, stable, deprecated>` |

---

## 3. Use cases

### Use when

- `<approved use>`
- `<approved use>`

### Do not use when

- `<prohibited use>`
- `<prohibited use>`

### Related components

| Component | Relationship | Selection rule |
|---|---|---|
| `<component>` | `<alternative, parent, child, replacement>` | `<rule>` |

---

## 4. Anatomy

```text
<COMPONENT_NAME>
├── <Slot>
├── <Slot>
│   ├── <Nested slot>
│   └── <Nested slot>
└── <Slot>
```

### Slot definitions

| Slot | Required | Multiple | Purpose | Content restrictions |
|---|---|---|---|---|
| `<slot>` | Yes | No | `<purpose>` | `<restrictions>` |

### Slot ordering

`<ordering rules>`

### Spacing ownership

Explain:

- which slot or parent owns each gap;
- which internal margins are prohibited;
- whether consumers may add outer spacing.

---

## 5. Public API

```ts
export type <COMPONENT_NAME>Props = {
  // approved public API
};
```

### Prop contract

| Prop | Type | Required | Default | Purpose | Restrictions |
|---|---|---|---|---|---|
| `<prop>` | `<type>` | No | `<default>` | `<purpose>` | `<restrictions>` |

### Public API restrictions

- `<restriction>`
- `<restriction>`

Do not expose internal implementation state without a consumer requirement.

Do not expose low-level visual props when a semantic prop is appropriate.

---

## 6. Variants

| Variant | Semantic intent | Allowed use | Prohibited use | Default |
|---|---|---|---|---|
| `<variant>` | `<intent>` | `<allowed>` | `<prohibited>` | Yes |

### Variant selection rules

- `<rule>`
- `<rule>`

### Invalid combinations

| Combination | Reason |
|---|---|
| `<variant + state or prop>` | `<reason>` |

---

## 7. Sizes

| Size | Intent | Height token | Target token | Text token | Icon token | Approved context |
|---|---|---|---|---|---|---|
| `<size>` | `<intent>` | `<token>` | `<token>` | `<token>` | `<token>` | `<context>` |

### Size restrictions

- `<restriction>`
- `<restriction>`

---

## 8. States

| State | Visual behavior | Interaction behavior | Accessibility behavior |
|---|---|---|---|
| Default | `<behavior>` | `<behavior>` | `<behavior>` |
| Hover | `<behavior>` | `<behavior>` | Not relied upon exclusively |
| Active | `<behavior>` | `<behavior>` | `<behavior>` |
| Focus-visible | `<behavior>` | `<behavior>` | Visible keyboard focus |
| Disabled | `<behavior>` | `<behavior>` | `<behavior>` |
| Loading | `<behavior>` | `<behavior>` | `<behavior>` |
| Invalid | `<behavior>` | `<behavior>` | `<behavior>` |
| Read-only | `<behavior>` | `<behavior>` | `<behavior>` |

Remove states that do not apply.

Add component-specific states when required.

---

## 9. Interaction model

### Pointer

- `<behavior>`
- `<behavior>`

### Keyboard

| Key | Behavior |
|---|---|
| `<key>` | `<behavior>` |

### Focus

- Initial focus: `<behavior>`
- Focus entry: `<behavior>`
- Focus exit: `<behavior>`
- Focus restoration: `<behavior>`
- Focus trap: `<behavior or not applicable>`

### Dismissal

`<behavior or not applicable>`

### Pending behavior

`<behavior or not applicable>`

---

## 10. Accessibility

| Concern | Requirement |
|---|---|
| Semantic element | `<element or role>` |
| Accessible name | `<source>` |
| Description | `<source or not applicable>` |
| Keyboard | `<requirements>` |
| Focus | `<requirements>` |
| State announcement | `<requirements>` |
| Error association | `<requirements>` |
| Color independence | `<requirements>` |
| Contrast | `<target>` |
| Reduced motion | `<behavior>` |

### ARIA policy

- `<required attributes>`
- `<prohibited or conditional attributes>`

Prefer native semantics before ARIA.

---

## 11. Content contract

### Content shape

| Content | Minimum | Typical | Maximum realistic | Behavior |
|---|---:|---:|---:|---|
| `<content>` | `<length>` | `<length>` | `<length>` | `<behavior>` |

### Wrapping

`<policy>`

### Truncation

`<policy>`

### Full-value access

`<tooltip, expansion, details panel, not required>`

### Localization

`<expected expansion and behavior>`

### Empty content

`<behavior>`

### Technical content

Explain whether identifiers, code, timestamps, or raw values are allowed.

---

## 12. Responsive behavior

| Container or viewport | Behavior |
|---|---|
| Narrow | `<behavior>` |
| Medium | `<behavior>` |
| Wide | `<behavior>` |
| Very wide | `<behavior>` |

### Transformation rules

- `<wrap>`
- `<stack>`
- `<collapse>`
- `<move to overflow>`
- `<scroll internally>`
- `<switch pattern>`

### Overflow policy

`<policy>`

### Container-query policy

`<policy>`

### Mobile limitation

`<limitation or none>`

---

## 13. Design tokens

| Purpose | Token |
|---|---|
| Background | `<token>` |
| Foreground | `<token>` |
| Border | `<token>` |
| Focus | `<token>` |
| Radius | `<token>` |
| Spacing | `<token>` |
| Typography | `<token>` |
| Motion | `<token>` |
| Elevation | `<token>` |

### Direct values

List any approved direct values.

| Value | Reason | Removal condition |
|---|---|---|
| `<value>` | `<reason>` | `<condition>` |

An empty table is preferred.

---

## 14. Composition rules

### Allowed parents

- `<component or layout>`
- `<component or layout>`

### Allowed children

- `<component>`
- `<component>`

### Prohibited nesting

- `<pattern>`
- `<pattern>`

### Action hierarchy

`<rules>`

### Surface hierarchy

`<rules>`

---

## 15. Implementation guidance

### Canonical implementation

```tsx
<approved implementation example>
```

### Variant implementation

```tsx
<approved variant example>
```

### Composition example

```tsx
<approved composition example>
```

### Anti-pattern

```tsx
<prohibited implementation example>
```

Explain why the anti-pattern is invalid.

---

## 16. Storybook contract

**Story file:**
`<path>`

### Required stories

- [ ] Default
- [ ] Variants
- [ ] Sizes
- [ ] Long content
- [ ] Empty or missing content
- [ ] Disabled
- [ ] Loading
- [ ] Invalid
- [ ] Dark theme
- [ ] Narrow container
- [ ] Keyboard focus
- [ ] Reduced motion when applicable

Remove inapplicable items and add component-specific states.

---

## 17. Test contract

**Test file:**
`<path>`

### Unit or component tests

- [ ] Semantic role
- [ ] Accessible name
- [ ] Keyboard behavior
- [ ] Focus behavior
- [ ] Disabled behavior
- [ ] Loading behavior
- [ ] Variant contract
- [ ] Error association
- [ ] Content variation
- [ ] Responsive transformation where practical

### Browser tests

- `<interaction>`
- `<viewport>`
- `<theme>`
- `<overflow check>`

---

## 18. Performance

| Concern | Requirement |
|---|---|
| Rerender sensitivity | `<requirement>` |
| Memoization | `<required, unnecessary, conditional>` |
| Virtualization | `<required, unnecessary, conditional>` |
| Lazy loading | `<required, unnecessary, conditional>` |
| Portal | `<policy>` |

Do not add optimization without evidence.

---

## 19. Security and privacy

Document when the component may display or accept:

- personal data;
- confidential data;
- tokens;
- files;
- audit information;
- restricted values.

### Restrictions

- `<restriction>`
- `<restriction>`

---

## 20. Known limitations

- `<limitation>`
- `<limitation>`

---

## 21. Deprecation

Complete only when deprecated.

| Concern | Decision |
|---|---|
| Replacement | `<component>` |
| Reason | `<reason>` |
| Migration | `<instructions>` |
| Removal version | `<version>` |
| Remaining consumers | `<consumers>` |

---

## 22. Change history

| Version | Date | Change | Breaking | Owner |
|---|---|---|---|---|
| 0.1.0 | `<date>` | Initial contract | No | `<owner>` |

---

## 23. Acceptance checklist

- [ ] Purpose is explicit.
- [ ] Hierarchy level is correct.
- [ ] Public API expresses intent.
- [ ] Anatomy and slots are explicit.
- [ ] Variants are semantic.
- [ ] Sizes are constrained.
- [ ] Relevant states are defined.
- [ ] Keyboard behavior is defined.
- [ ] Focus behavior is defined.
- [ ] Accessibility behavior is defined.
- [ ] Content limits are defined.
- [ ] Responsive transformations are defined.
- [ ] Design tokens are mapped.
- [ ] Composition rules are defined.
- [ ] Storybook states are defined.
- [ ] Tests are defined.
- [ ] Known limitations are documented.
- [ ] Machine-readable registry entry is synchronized.
- [ ] No unresolved blocking component decision remains.

---

## 24. Component gate

**Status:**
`<APPROVED_FOR_IMPLEMENTATION | APPROVED_WITH_LIMITATIONS | BLOCKED_BY_COMPONENT_DECISIONS>`

**Rationale:**
`<rationale>`

**Approved by:**
`<name or role>`

**Approval date:**
`<YYYY-MM-DD>`
