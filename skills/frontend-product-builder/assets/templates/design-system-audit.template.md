# <Screen Name> — Design-System Audit

## Document metadata

| Field | Value |
|---|---|
| Screen ID | `<screen-id>` |
| Slice ID | `<slice-id>` |
| Manifest | `docs/frontend/screens/<screen-id>/small-slice-manifest.json` |
| Component map | `docs/frontend/screens/<screen-id>/component-map.md` |
| Design system | `docs/frontend/design-system/design-system.json` |
| Component catalog | `docs/frontend/design-system/component-catalog.json` |
| Defect log | `docs/frontend/screens/<screen-id>/defect-log.md` |
| Auditor | `<person-or-agent>` |
| Completed at | `<ISO-8601 timestamp or pending>` |

**Gate status:** `blocked`

Allowed values:

```text
blocked
ready
validated
rejected
```

---

## 1. Purpose

This audit verifies that the representative implementation uses the approved design system and component architecture.

It does not perform an unbounded visual redesign.

The audit should identify:

- contract violations;
- component duplication;
- unsupported variants;
- raw values that bypass tokens;
- invalid layout ownership;
- inconsistent action hierarchy;
- responsive defects;
- accessibility defects;
- content defects.

A subjective preference is not automatically a defect.

---

## 2. Audit scope

### Routes or surfaces

- `<route-or-surface>`

### Files inspected

- `<path>`

### Screen states inspected

- `data`
- `<non-success-state-id>`

### Viewports inspected

- `390x844`
- `1024x768`
- `1440x900`

### Evidence sources

- `browser-validation.md`
- `screenshot-evidence.json`
- `<test-or-story-path>`

---

## 3. Token audit

### Styling authority and global CSS

| Check | Result | Evidence | Defect |
|---|---|---|---|
| `styling-authority.json` validates and matches the repository | `<pass or fail>` | `<evidence>` | `<ID or none>` |
| Existing classes changed by the slice have ownership traces | `<pass or fail>` | `<evidence>` | `<ID or none>` |
| Global stylesheets contain only approved global responsibilities | `<pass or fail>` | `<evidence>` | `<ID or none>` |
| No parallel styling architecture was introduced | `<pass or fail>` | `<evidence>` | `<ID or none>` |
| Rendered output matches approved reference aspects | `<pass or fail>` | `<evidence>` | `<ID or none>` |

### Color

| Check | Result | Evidence | Defect |
|---|---|---|---|
| Semantic color tokens are used | `<pass or fail>` | `<evidence>` | `<ID or none>` |
| Raw hex, RGB, HSL, or named colors are absent where tokens exist | `<pass or fail>` | `<evidence>` | `<ID or none>` |
| Status colors retain non-color meaning | `<pass or fail>` | `<evidence>` | `<ID or none>` |
| Theme behavior remains coherent | `<pass or fail>` | `<evidence>` | `<ID or none>` |

### Spacing

| Check | Result | Evidence | Defect |
|---|---|---|---|
| Approved spacing tokens are used | `<pass or fail>` | `<evidence>` | `<ID or none>` |
| Parents own spacing between siblings | `<pass or fail>` | `<evidence>` | `<ID or none>` |
| Components own internal spacing | `<pass or fail>` | `<evidence>` | `<ID or none>` |
| Arbitrary offsets are absent | `<pass or fail>` | `<evidence>` | `<ID or none>` |

### Typography

| Check | Result | Evidence | Defect |
|---|---|---|---|
| Approved typography tokens are used | `<pass or fail>` | `<evidence>` | `<ID or none>` |
| Heading hierarchy matches semantics | `<pass or fail>` | `<evidence>` | `<ID or none>` |
| Body and metadata hierarchy are distinguishable | `<pass or fail>` | `<evidence>` | `<ID or none>` |
| Long content remains readable | `<pass or fail>` | `<evidence>` | `<ID or none>` |

### Radius and elevation

| Check | Result | Evidence | Defect |
|---|---|---|---|
| Approved radius tokens are used | `<pass or fail>` | `<evidence>` | `<ID or none>` |
| Elevation expresses hierarchy rather than decoration | `<pass or fail>` | `<evidence>` | `<ID or none>` |
| Nested elevated surfaces are justified | `<pass or fail>` | `<evidence>` | `<ID or none>` |
| Arbitrary shadows are absent | `<pass or fail>` | `<evidence>` | `<ID or none>` |

---

## 4. Component-responsibility audit

| Component usage | Declared status | Catalog source | Actual component | Result | Defect |
|---|---|---|---|---|---|
| `<usage-id>` | `<canonical, extended, feature-specific, new-proposed>` | `<catalog>` | `<component>` | `<pass or fail>` | `<ID or none>` |

### Responsibility checks

| Check | Result | Defect |
|---|---|---|
| Existing project components were considered first | `<pass or fail>` | `<ID or none>` |
| Canonical responsibility is not duplicated | `<pass or fail>` | `<ID or none>` |
| Extensions remain bounded | `<pass or fail>` | `<ID or none>` |
| Feature-specific components contain real domain behavior | `<pass or fail>` | `<ID or none>` |
| Shared components remain domain-neutral | `<pass or fail>` | `<ID or none>` |
| Presentation components do not own transport | `<pass or fail>` | `<ID or none>` |
| Visual components do not own mutation execution | `<pass or fail>` | `<ID or none>` |

---

## 5. Variant and state audit

| Component | Variant | Supported | Size | Supported | State | Supported | Result |
|---|---|---|---|---|---|---|---|
| `<component>` | `<variant>` | `<yes or no>` | `<size>` | `<yes or no>` | `<state>` | `<yes or no>` | `<pass or fail>` |

Do not create local variants through class overrides when the component contract does not support them.

---

## 6. Layout audit

| Check | Result | Evidence | Defect |
|---|---|---|---|
| Selected recipe structure is preserved | `<pass or fail>` | `<evidence>` | `<ID or none>` |
| Required regions are present | `<pass or fail>` | `<evidence>` | `<ID or none>` |
| Omitted regions are deliberately omitted | `<pass or fail>` | `<evidence>` | `<ID or none>` |
| Width ownership is explicit | `<pass or fail>` | `<evidence>` | `<ID or none>` |
| Primary scroll ownership is explicit | `<pass or fail>` | `<evidence>` | `<ID or none>` |
| Local scroll remains local | `<pass or fail>` | `<evidence>` | `<ID or none>` |
| Sticky regions do not conceal content | `<pass or fail>` | `<evidence>` | `<ID or none>` |
| Page-level horizontal overflow is absent | `<pass or fail>` | `<evidence>` | `<ID or none>` |

---

## 7. Action-hierarchy audit

| Check | Result | Evidence | Defect |
|---|---|---|---|
| One dominant primary action exists per state | `<pass or fail>` | `<evidence>` | `<ID or none>` |
| Secondary actions remain subordinate | `<pass or fail>` | `<evidence>` | `<ID or none>` |
| Destructive actions remain separated | `<pass, fail, not applicable>` | `<evidence>` | `<ID or none>` |
| Disabled actions expose reasons when needed | `<pass, fail, not applicable>` | `<evidence>` | `<ID or none>` |
| Pending actions prevent duplicate execution | `<pass, fail, not applicable>` | `<evidence>` | `<ID or none>` |
| Compact transformation preserves action priority | `<pass or fail>` | `<evidence>` | `<ID or none>` |

---

## 8. Feedback-state audit

| State | Component responsibility | Scope | Recovery | Result | Defect |
|---|---|---|---|---|---|
| Initial loading | `<component>` | `<scope>` | `<behavior>` | `<pass, fail, not applicable>` | `<ID or none>` |
| Background refresh | `<component>` | `<scope>` | `<behavior>` | `<pass, fail, not applicable>` | `<ID or none>` |
| Empty | `<component>` | `<scope>` | `<behavior>` | `<pass, fail, not applicable>` | `<ID or none>` |
| Error | `<component>` | `<scope>` | `<behavior>` | `<pass, fail, not applicable>` | `<ID or none>` |
| Permission | `<component>` | `<scope>` | `<behavior>` | `<pass, fail, not applicable>` | `<ID or none>` |
| Processing | `<component>` | `<scope>` | `<behavior>` | `<pass, fail, not applicable>` | `<ID or none>` |
| Stale or conflict | `<component>` | `<scope>` | `<behavior>` | `<pass, fail, not applicable>` | `<ID or none>` |

---

## 9. Responsive audit

| Check | Compact | Constrained | Wide | Defect |
|---|---|---|---|---|
| Task order | `<pass or fail>` | `<pass or fail>` | `<pass or fail>` | `<ID or none>` |
| Region order | `<pass or fail>` | `<pass or fail>` | `<pass or fail>` | `<ID or none>` |
| DOM and focus order | `<pass or fail>` | `<pass or fail>` | `<pass or fail>` | `<ID or none>` |
| Action priority | `<pass or fail>` | `<pass or fail>` | `<pass or fail>` | `<ID or none>` |
| Content priority | `<pass or fail>` | `<pass or fail>` | `<pass or fail>` | `<ID or none>` |
| Scroll ownership | `<pass or fail>` | `<pass or fail>` | `<pass or fail>` | `<ID or none>` |
| Overflow | `<pass or fail>` | `<pass or fail>` | `<pass or fail>` | `<ID or none>` |

---

## 10. Accessibility audit

| Check | Result | Evidence | Defect |
|---|---|---|---|
| Landmarks are semantic | `<pass or fail>` | `<evidence>` | `<ID or none>` |
| Heading hierarchy is coherent | `<pass or fail>` | `<evidence>` | `<ID or none>` |
| Controls have accessible names | `<pass or fail>` | `<evidence>` | `<ID or none>` |
| Visible focus is present | `<pass or fail>` | `<evidence>` | `<ID or none>` |
| Keyboard behavior is complete | `<pass or fail>` | `<evidence>` | `<ID or none>` |
| Focus movement is deliberate | `<pass or fail>` | `<evidence>` | `<ID or none>` |
| Error association is correct | `<pass, fail, not applicable>` | `<evidence>` | `<ID or none>` |
| Announcements are restrained and useful | `<pass or fail>` | `<evidence>` | `<ID or none>` |
| Status meaning does not depend on color | `<pass or fail>` | `<evidence>` | `<ID or none>` |
| Reduced-motion behavior is supported | `<pass, fail, not applicable>` | `<evidence>` | `<ID or none>` |
| Zoom and reflow are usable | `<pass or fail>` | `<evidence>` | `<ID or none>` |

---

## 11. Content audit

| Check | Result | Evidence | Defect |
|---|---|---|---|
| Product terminology is used | `<pass or fail>` | `<evidence>` | `<ID or none>` |
| Raw technical errors are absent | `<pass or fail>` | `<evidence>` | `<ID or none>` |
| Raw enum values are normalized | `<pass or fail>` | `<evidence>` | `<ID or none>` |
| Dates and timezones are normalized | `<pass, fail, not applicable>` | `<evidence>` | `<ID or none>` |
| Currency and numbers are normalized | `<pass, fail, not applicable>` | `<evidence>` | `<ID or none>` |
| Long localized content remains usable | `<pass or fail>` | `<evidence>` | `<ID or none>` |

---

## 12. Raw-value findings

| Finding | File | Line | Approved token | Severity | Defect |
|---|---|---:|---|---|---|
| `<raw color, spacing, radius, width, shadow>` | `<path>` | `<line>` | `<token>` | `<severity>` | `<ID>` |

No finding should be automatically replaced without confirming the authoritative token.

---

## 13. Duplicate-component findings

| Existing responsibility | New implementation | Why duplicate | Required correction | Defect |
|---|---|---|---|---|
| `<existing component>` | `<new component>` | `<reason>` | `<reuse, compose, extend, remove>` | `<ID>` |

---

## 14. Audit findings

| Defect ID | Category | Severity | Evidence | Contract violated | Status |
|---|---|---|---|---|---|
| `<defect-id>` | `<tokens, components, layout, responsive, accessibility, content>` | `<severity>` | `<evidence>` | `<contract>` | `<open, resolved, accepted>` |

---

## 15. Revalidation

| Defect ID | Patch | Tests rerun | Browser scenario rerun | Screenshot refreshed | Result |
|---|---|---|---|---|---|
| `<defect-id>` | `<path or commit>` | `<tests>` | `<scenario>` | `<capture-id>` | `<pass or fail>` |

---

## 16. Final summary

| Area | Result |
|---|---|
| Tokens | `<pass or fail>` |
| Components | `<pass or fail>` |
| Variants and states | `<pass or fail>` |
| Layout | `<pass or fail>` |
| Action hierarchy | `<pass or fail>` |
| Feedback states | `<pass or fail>` |
| Responsive behavior | `<pass or fail>` |
| Accessibility | `<pass or fail>` |
| Content | `<pass or fail>` |

### Open blocking defects

- `<defect IDs or none>`

### Accepted nonblocking findings

- `<finding IDs or none>`

### Final decision

The audit may be marked `validated` only when:

- [ ] No unsupported component responsibility remains.
- [ ] No blocking token violation remains.
- [ ] No blocking layout defect remains.
- [ ] No blocking responsive defect remains.
- [ ] No blocking accessibility defect remains.
- [ ] Required patches were browser revalidated.
- [ ] Required screenshots were refreshed.
- [ ] Defect-log statuses match this audit.

**Gate status:** `blocked`

### Final rationale

`<rationale>`
