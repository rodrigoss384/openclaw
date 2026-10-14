---
artifact: frontend-token-contract
project: "<PROJECT_NAME>"
version: "0.1.0"
status: "<draft | approved | deprecated>"
owner: "<OWNER_OR_TEAM>"
design_direction: "docs/frontend/design-direction.md"
design_system: "docs/frontend/design-system/design-system.json"
implementation: "src/styles/tokens.css"
created_at: "<YYYY-MM-DD>"
updated_at: "<YYYY-MM-DD>"
gate:
  status: "<APPROVED_FOR_IMPLEMENTATION | APPROVED_WITH_LIMITATIONS | BLOCKED_BY_TOKEN_DECISIONS>"
---

# Design Token Contract

## 1. Purpose

Describe:

- which product scope the tokens govern;
- which themes are supported;
- how tokens connect design direction to implementation;
- which files are authoritative.

---

## 2. Token sources of truth

| Priority | Artifact | Responsibility |
|---:|---|---|
| 1 | Approved design direction | Visual intent |
| 2 | `design-system.json` | Machine-readable token registry |
| 3 | This contract | Human-readable token rules |
| 4 | Token implementation | CSS variables and framework integration |
| 5 | Product components | Token consumers |

A consumer must not redefine token meaning.

---

## 3. Supported themes

| Theme | Supported | Default | Selector | Status |
|---|---|---|---|---|
| Light | `<yes/no>` | `<yes/no>` | `<selector>` | `<status>` |
| Dark | `<yes/no>` | `<yes/no>` | `<selector>` | `<status>` |
| High contrast | `<yes/no>` | No | `<selector>` | `<status>` |

### System preference

`<policy>`

### Theme persistence

`<policy>`

### Theme initialization

Explain how initial theme flashing is prevented when applicable.

---

## 4. Token architecture

### Reference tokens

Purpose:

`<purpose>`

Approved consumer scope:

`<scope>`

### Semantic tokens

Purpose:

`<purpose>`

Approved consumer scope:

`<scope>`

### Component tokens

Purpose:

`<purpose>`

Approved consumer scope:

`<scope>`

### Alias syntax

`<syntax>`

### Circular-alias prevention

`<validation method>`

---

## 5. Naming convention

### General pattern

```text
<layer>.<category>.<role>.<state>
```

Examples:

```text
reference.color.neutral.950
semantic.text.primary
semantic.action.primary.hover
component.button.radius
```

### Naming rules

- `<rule>`
- `<rule>`

### Prohibited naming

- Appearance-only names such as `darkGray`.
- Component-color names such as `goldButton`.
- Temporary names such as `newBlue`.
- Unscoped names such as `paddingLarge`.

---

## 6. Reference color palette

| Token | Value | Purpose | Status |
|---|---|---|---|
| `reference.color.neutral.0` | `<value>` | `<purpose>` | Stable |
| `reference.color.neutral.50` | `<value>` | `<purpose>` | Stable |
| `reference.color.neutral.100` | `<value>` | `<purpose>` | Stable |
| `reference.color.neutral.200` | `<value>` | `<purpose>` | Stable |
| `reference.color.neutral.400` | `<value>` | `<purpose>` | Stable |
| `reference.color.neutral.600` | `<value>` | `<purpose>` | Stable |
| `reference.color.neutral.800` | `<value>` | `<purpose>` | Stable |
| `reference.color.neutral.900` | `<value>` | `<purpose>` | Stable |
| `reference.color.neutral.950` | `<value>` | `<purpose>` | Stable |

Repeat for:

- primary;
- success;
- warning;
- danger;
- information;
- data-visualization palettes when applicable.

### Palette restrictions

- `<restriction>`
- `<restriction>`

Product components should normally not consume this palette directly.

---

## 7. Semantic colors

### Background

| Token | Light | Dark | Purpose |
|---|---|---|---|
| `semantic.background.canvas` | `<alias>` | `<alias>` | Application canvas |
| `semantic.background.surface` | `<alias>` | `<alias>` | Primary content surface |
| `semantic.background.surfaceSubtle` | `<alias>` | `<alias>` | Nested content |
| `semantic.background.surfaceElevated` | `<alias>` | `<alias>` | Overlays |
| `semantic.background.disabled` | `<alias>` | `<alias>` | Disabled surface |
| `semantic.background.selection` | `<alias>` | `<alias>` | Selected item |

### Text

| Token | Light | Dark | Purpose |
|---|---|---|---|
| `semantic.text.primary` | `<alias>` | `<alias>` | Main text |
| `semantic.text.secondary` | `<alias>` | `<alias>` | Supporting text |
| `semantic.text.muted` | `<alias>` | `<alias>` | Metadata |
| `semantic.text.inverse` | `<alias>` | `<alias>` | Inverse surfaces |
| `semantic.text.disabled` | `<alias>` | `<alias>` | Disabled content |
| `semantic.text.link` | `<alias>` | `<alias>` | Navigation link |

### Borders

| Token | Light | Dark | Purpose |
|---|---|---|---|
| `semantic.border.default` | `<alias>` | `<alias>` | Default border |
| `semantic.border.subtle` | `<alias>` | `<alias>` | Low-emphasis separator |
| `semantic.border.strong` | `<alias>` | `<alias>` | Strong structure |
| `semantic.border.focus` | `<alias>` | `<alias>` | Focus |
| `semantic.border.disabled` | `<alias>` | `<alias>` | Disabled border |

### Actions

| Token | Default | Hover | Active | Foreground |
|---|---|---|---|---|
| Primary | `<token>` | `<token>` | `<token>` | `<token>` |
| Secondary | `<token>` | `<token>` | `<token>` | `<token>` |
| Danger | `<token>` | `<token>` | `<token>` | `<token>` |

### Statuses

| Status | Background | Foreground | Border | Icon |
|---|---|---|---|---|
| Information | `<token>` | `<token>` | `<token>` | `<token>` |
| Success | `<token>` | `<token>` | `<token>` | `<token>` |
| Warning | `<token>` | `<token>` | `<token>` | `<token>` |
| Danger | `<token>` | `<token>` | `<token>` | `<token>` |

---

## 8. Contrast requirements

| Combination | Minimum target | Measured result | Status |
|---|---:|---:|---|
| Primary text / canvas | WCAG AA | `<result>` | `<status>` |
| Secondary text / surface | WCAG AA | `<result>` | `<status>` |
| Button foreground / background | WCAG AA | `<result>` | `<status>` |
| Status foreground / background | WCAG AA | `<result>` | `<status>` |
| Focus indicator / adjacent colors | Visible | `<result>` | `<status>` |

### Large-text exceptions

`<policy>`

### Non-text contrast

`<policy>`

---

## 9. Typography tokens

### Font families

| Token | Value | Use |
|---|---|---|
| `reference.font.family.interface` | `<stack>` | Product interface |
| `reference.font.family.mono` | `<stack>` | Approved technical content |

### Font sizes

| Token | Value | Semantic use |
|---|---:|---|
| `reference.font.size.xs` | `<value>` | Caption |
| `reference.font.size.sm` | `<value>` | Label and compact body |
| `reference.font.size.md` | `<value>` | Body |
| `reference.font.size.lg` | `<value>` | Subsection |
| `reference.font.size.xl` | `<value>` | Section |
| `reference.font.size.2xl` | `<value>` | Page title |
| `reference.font.size.3xl` | `<value>` | Approved large display |

### Font weights

| Token | Value | Use |
|---|---:|---|
| `regular` | 400 | Body |
| `medium` | 500 | Label |
| `semibold` | 600 | Heading |
| `bold` | 700 | Strong emphasis |

### Line heights

| Token | Value | Use |
|---|---:|---|
| `tight` | `<value>` | Headings |
| `normal` | `<value>` | Interface |
| `relaxed` | `<value>` | Long-form content |

---

## 10. Semantic text styles

| Style | Font size | Weight | Line height | Letter spacing | Use |
|---|---|---|---|---|---|
| `text.pageTitle` | `<token>` | `<token>` | `<token>` | `<token>` | Page title |
| `text.sectionTitle` | `<token>` | `<token>` | `<token>` | `<token>` | Section title |
| `text.body` | `<token>` | `<token>` | `<token>` | `<token>` | Body |
| `text.label` | `<token>` | `<token>` | `<token>` | `<token>` | Field label |
| `text.metadata` | `<token>` | `<token>` | `<token>` | `<token>` | Metadata |
| `text.metric` | `<token>` | `<token>` | `<token>` | `<token>` | KPI |
| `text.code` | `<token>` | `<token>` | `<token>` | `<token>` | Approved identifiers |

---

## 11. Spacing scale

| Token | Value | Intended use |
|---|---:|---|
| `reference.space.0` | 0 | No spacing |
| `reference.space.1` | 4px | Icon gap |
| `reference.space.2` | 8px | Compact gap |
| `reference.space.3` | 12px | Control group |
| `reference.space.4` | 16px | Component spacing |
| `reference.space.5` | 20px | Medium internal spacing |
| `reference.space.6` | 24px | Card padding |
| `reference.space.8` | 32px | Section gap |
| `reference.space.10` | 40px | Large section |
| `reference.space.12` | 48px | Page region |

### Spacing ownership rules

- `<rule>`
- `<rule>`

### Approved exceptions

| Value | Context | Reason |
|---|---|---|
| `<value>` | `<context>` | `<reason>` |

An empty table is preferred.

---

## 12. Sizing tokens

### Controls

| Token | Value | Use |
|---|---:|---|
| `reference.control.height.sm` | `<value>` | Compact controls |
| `reference.control.height.md` | `<value>` | Default controls |
| `reference.control.height.lg` | `<value>` | Large controls |
| `reference.control.target.minimum` | `<value>` | Minimum target |

### Icons

| Token | Value | Use |
|---|---:|---|
| `reference.icon.size.sm` | `<value>` | Compact controls |
| `reference.icon.size.md` | `<value>` | Default controls |
| `reference.icon.size.lg` | `<value>` | Prominent status |

### Containers

| Token | Value | Use |
|---|---:|---|
| `<token>` | `<value>` | `<use>` |

### Dialogs and drawers

| Token | Value | Use |
|---|---:|---|
| `<token>` | `<value>` | `<use>` |

---

## 13. Radius tokens

| Token | Value | Allowed use |
|---|---:|---|
| `reference.radius.none` | 0 | Dividers and selected structures |
| `reference.radius.sm` | `<value>` | Controls |
| `reference.radius.md` | `<value>` | Cards |
| `reference.radius.lg` | `<value>` | Dialogs |
| `reference.radius.full` | 9999px | Avatars and approved pills |

### Radius restrictions

- `<restriction>`
- `<restriction>`

---

## 14. Border tokens

| Token | Value | Use |
|---|---|---|
| `<token>` | `<value>` | `<use>` |

### Invalid-state borders

`<policy>`

### Selected-state borders

`<policy>`

### Divider policy

`<policy>`

---

## 15. Shadow and elevation tokens

| Token | Value | Use |
|---|---|---|
| `elevation.none` | `<value>` | Ordinary surfaces |
| `elevation.subtle` | `<value>` | Approved raised surface |
| `elevation.overlay` | `<value>` | Dropdown or popover |
| `elevation.modal` | `<value>` | Dialog |

### Shadow restrictions

- `<restriction>`
- `<restriction>`

---

## 16. Motion tokens

### Durations

| Token | Value | Use |
|---|---:|---|
| `reference.duration.instant` | 0ms | No transition |
| `reference.duration.fast` | `<value>` | Hover and small state |
| `reference.duration.normal` | `<value>` | Overlay |
| `reference.duration.slow` | `<value>` | Approved large transition |

### Easings

| Token | Value | Use |
|---|---|---|
| `<token>` | `<value>` | `<use>` |

### Reduced-motion mapping

`<policy>`

---

## 17. Breakpoints

| Token | Value | Operational meaning |
|---|---:|---|
| `breakpoint.sm` | `<value>` | Compact single-column layout |
| `breakpoint.md` | `<value>` | Tablet adaptation |
| `breakpoint.lg` | `<value>` | Standard application shell |
| `breakpoint.xl` | `<value>` | Multi-column workspace |
| `breakpoint.2xl` | `<value>` | Wide dashboards |

### Breakpoint restrictions

- `<restriction>`
- `<restriction>`

---

## 18. Z-index scale

| Token | Value | Use |
|---|---:|---|
| `z.base` | 0 | Base |
| `z.sticky` | `<value>` | Sticky content |
| `z.dropdown` | `<value>` | Dropdown |
| `z.popover` | `<value>` | Popover |
| `z.drawer` | `<value>` | Drawer |
| `z.modal` | `<value>` | Dialog |
| `z.toast` | `<value>` | Toast |
| `z.tooltip` | `<value>` | Tooltip |

### Stacking-context policy

`<policy>`

---

## 19. Component-token policy

### Approved component token categories

- `<category>`
- `<category>`

### Creation criteria

A component token may be created when:

- `<criterion>`;
- `<criterion>`;
- `<criterion>`.

### Prohibited component-token usage

- `<prohibition>`;
- `<prohibition>`.

---

## 20. CSS variable mapping

### Light theme

```css
:root {
  /* approved mappings */
}
```

### Dark theme

```css
.dark {
  /* approved mappings */
}
```

### High-contrast theme

```css
[data-contrast="high"] {
  /* approved mappings */
}
```

Remove unsupported themes.

---

## 21. Tailwind mapping

### Tailwind version

`<version>`

### Configuration strategy

`<Tailwind v3 config, Tailwind v4 CSS theme, other>`

### Semantic utility mapping

| Semantic utility | CSS variable or token |
|---|---|
| `bg-background` | `<token>` |
| `text-foreground` | `<token>` |
| `border-border` | `<token>` |
| `bg-primary` | `<token>` |
| `text-primary-foreground` | `<token>` |
| `ring-ring` | `<token>` |

### Arbitrary-value policy

`<policy>`

---

## 22. JavaScript or TypeScript access

When runtime token access is required:

```ts
export const designTokens = {
  // approved runtime-safe tokens
} as const;
```

Document:

- why runtime access is required;
- which tokens are exposed;
- whether CSS remains authoritative;
- SSR or hydration implications.

Do not duplicate every CSS token in TypeScript without a consumer need.

---

## 23. Data-visualization tokens

Complete when charts are supported.

| Series role | Token | Use |
|---|---|---|
| Primary series | `<token>` | `<use>` |
| Secondary series | `<token>` | `<use>` |
| Positive | `<token>` | `<use>` |
| Negative | `<token>` | `<use>` |
| Neutral | `<token>` | `<use>` |

### Chart restrictions

- `<restriction>`
- `<restriction>`

Charts must remain interpretable without depending only on color.

---

## 24. External-brand exceptions

| Brand or integration | Approved colors | Scope | Restrictions |
|---|---|---|---|
| `<integration>` | `<colors>` | `<scope>` | `<restrictions>` |

Do not add external brand colors to the primary product token system unless they
serve a reusable product role.

---

## 25. Token lifecycle

### Add

1. Search for an existing semantic equivalent.
2. Identify the consumer.
3. Select the correct layer.
4. Define themes.
5. Update machine-readable registry.
6. Update implementation.
7. Validate contrast and consumers.

### Change

1. Inspect consumers.
2. Determine visual and behavioral impact.
3. Update references.
4. Run screenshots.
5. Document breaking visual change.

### Deprecate

1. Mark as deprecated.
2. Define replacement.
3. Document migration.
4. Identify consumers.
5. Define removal condition.

### Remove

Only after:

- consumers are migrated;
- validation passes;
- documentation is updated;
- release impact is understood.

---

## 26. Validation

### Schema validation

Command:

```text
<command>
```

### Alias resolution

Command:

```text
<command>
```

### Contrast validation

Command:

```text
<command>
```

### Literal-value audit

Command:

```text
<command>
```

### Tailwind arbitrary-value audit

Command:

```text
<command>
```

### Theme screenshot validation

Command:

```text
<command>
```

---

## 27. Token acceptance checklist

- [ ] Token layers are explicit.
- [ ] Token names describe role rather than appearance.
- [ ] Every token has a type.
- [ ] Every token has a description.
- [ ] Theme values are explicit.
- [ ] Alias paths resolve.
- [ ] Circular aliases are absent.
- [ ] Semantic background roles are complete.
- [ ] Semantic text roles are complete.
- [ ] Action roles are complete.
- [ ] Status roles are complete.
- [ ] Contrast has been measured.
- [ ] Typography scale is constrained.
- [ ] Spacing scale is constrained.
- [ ] Sizing scale is constrained.
- [ ] Radius scale is constrained.
- [ ] Elevation is restrained.
- [ ] Motion respects reduced-motion preferences.
- [ ] Breakpoints have operational meaning.
- [ ] Z-index values are semantic.
- [ ] Tailwind mapping is explicit.
- [ ] Component-token criteria are explicit.
- [ ] Validation commands are documented.
- [ ] `design-system.json` is synchronized.
- [ ] No unresolved blocking token decision remains.

---

## 28. Token gate

**Status:**
`<APPROVED_FOR_IMPLEMENTATION | APPROVED_WITH_LIMITATIONS | BLOCKED_BY_TOKEN_DECISIONS>`

**Rationale:**
`<rationale>`

**Approved by:**
`<name or role>`

**Approval date:** 
`<YYYY-MM-DD>`
