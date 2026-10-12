# <Screen Name> — Browser Validation

## Document metadata

| Field | Value |
|---|---|
| Screen ID | `<screen-id>` |
| Slice ID | `<slice-id>` |
| Manifest | `docs/frontend/screens/<screen-id>/small-slice-manifest.json` |
| Implementation journal | `docs/frontend/screens/<screen-id>/small-slice-implementation-journal.md` |
| Defect log | `docs/frontend/screens/<screen-id>/defect-log.md` |
| Validator | `<person-or-agent>` |
| Started at | `<ISO-8601 timestamp>` |
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

This document records browser-observed behavior for the representative slice.

Source inspection alone cannot prove:

- layout behavior;
- real focus movement;
- scroll ownership;
- sticky behavior;
- overlay behavior;
- zoom and reflow;
- text expansion;
- keyboard operation;
- browser announcements;
- reduced-motion behavior;
- page-level overflow;
- screenshot validity.

Every pass result must be based on executed browser evidence.

---

## 2. Validation environment

| Field | Value |
|---|---|
| Operating system | `<Linux distribution and version>` |
| Desktop environment | `<environment>` |
| Browser | `<browser name>` |
| Browser version | `<version>` |
| Rendering engine | `<engine>` |
| Node.js | `<version>` |
| Application command | `<command>` |
| Application URL | `<URL>` |
| Route | `<route>` |
| Locale | `<locale>` |
| Timezone | `<IANA timezone>` |
| Reduced motion | `<default, reduce>` |
| Color scheme | `<light, dark, system>` |

### Build or development source

`<development server, production build, Storybook, browser test server>`

### Commit

`<commit hash>`

### Working tree

`<clean or documented changes>`

---

## 3. Fixture environment

| Fixture ID | State | Source | Deterministic | Safe | Result |
|---|---|---|---|---|---|
| `<fixture-id>` | `<state-id>` | `<path>` | Yes | Yes | `<loaded or failed>` |

### Fixed clock

`<ISO-8601 timestamp or not applicable>`

### Locale

`<locale>`

### Timezone

`<IANA timezone>`

### Network behavior

`<fixture adapter, mocked transport, controlled backend, real approved integration>`

---

## 4. Required viewports

| Viewport ID | Width | Height | Purpose | Required |
|---|---:|---:|---|---|
| `compact` | 390 | 844 | Compact responsive proof | Yes |
| `constrained` | 1024 | 768 | Intermediate layout and reflow | Yes |
| `wide` | 1440 | 900 | Wide representative state | Yes |

Additional project-specific viewports:

| Viewport ID | Width | Height | Purpose | Required |
|---|---:|---:|---|---|
| `<id>` | `<width>` | `<height>` | `<purpose>` | `<yes or no>` |

---

## 5. Scenario inventory

| Scenario ID | State | Fixture | Interaction | Viewports | Required |
|---|---|---|---|---|---|
| `BROWSER-001` | `data` | `<primary-fixture-id>` | `<primary interaction>` | `compact, constrained, wide` | Yes |
| `BROWSER-002` | `<non-success-state-id>` | `<fixture-id>` | `<recovery interaction>` | `<viewports>` | Yes |
| `BROWSER-003` | `<state>` | `<fixture>` | `keyboard traversal` | `<viewports>` | Yes |
| `BROWSER-004` | `<state>` | `<fixture>` | `zoom and reflow` | `<viewports>` | Yes |

---

## 6. Scenario result template

Duplicate this section for each browser scenario.

### Scenario `<scenario-id>` — `<name>`

| Field | Value |
|---|---|
| State | `<state-id>` |
| Fixture | `<fixture-id>` |
| Route | `<route>` |
| Viewport | `<width>x<height>` |
| Browser zoom | `<percentage>` |
| Text scaling | `<percentage>` |
| Reduced motion | `<default or reduce>` |
| Started at | `<timestamp>` |
| Completed at | `<timestamp>` |

#### Preconditions

- `<precondition>`

#### Steps executed

1. `<step>`
2. `<step>`
3. `<step>`

#### Expected behavior

- `<expected behavior>`

#### Observed behavior

- `<observed behavior>`

#### Semantic structure

| Check | Result | Evidence |
|---|---|---|
| Landmark ownership | `<pass or fail>` | `<evidence>` |
| Heading hierarchy | `<pass or fail>` | `<evidence>` |
| Control semantics | `<pass or fail>` | `<evidence>` |
| Collection semantics | `<pass, fail, not applicable>` | `<evidence>` |
| Form semantics | `<pass, fail, not applicable>` | `<evidence>` |
| Dialog semantics | `<pass, fail, not applicable>` | `<evidence>` |

#### Keyboard behavior

| Action | Expected | Observed | Result |
|---|---|---|---|
| Initial tab entry | `<expected>` | `<observed>` | `<pass or fail>` |
| Forward traversal | `<expected>` | `<observed>` | `<pass or fail>` |
| Reverse traversal | `<expected>` | `<observed>` | `<pass or fail>` |
| Activation | `<expected>` | `<observed>` | `<pass or fail>` |
| Escape | `<expected or not applicable>` | `<observed>` | `<pass, fail, not applicable>` |
| Arrow keys | `<expected or not applicable>` | `<observed>` | `<pass, fail, not applicable>` |

#### Focus behavior

| Transition | Expected target | Observed target | Result |
|---|---|---|---|
| Route entry | `<target>` | `<target>` | `<pass or fail>` |
| Action completion | `<target>` | `<target>` | `<pass or fail>` |
| Recoverable error | `<target>` | `<target>` | `<pass or fail>` |
| Dialog open | `<target>` | `<target>` | `<pass, fail, not applicable>` |
| Dialog close | `<target>` | `<target>` | `<pass, fail, not applicable>` |

#### Announcement behavior

| Event | Expected announcement | Observed | Result |
|---|---|---|---|
| `<event>` | `<announcement or deliberately silent>` | `<observed>` | `<pass or fail>` |

Do not create a live-region announcement for every visual state change.

#### Responsive behavior

| Check | Result | Evidence |
|---|---|---|
| Region order preserved | `<pass or fail>` | `<evidence>` |
| DOM and focus order preserved | `<pass or fail>` | `<evidence>` |
| Action priority preserved | `<pass or fail>` | `<evidence>` |
| Critical content remains available | `<pass or fail>` | `<evidence>` |
| Local overflow remains local | `<pass or fail>` | `<evidence>` |
| No page-level horizontal overflow | `<pass or fail>` | `<evidence>` |
| Sticky behavior remains usable | `<pass, fail, not applicable>` | `<evidence>` |

#### State preservation

| Context | Expected | Observed | Result |
|---|---|---|---|
| Query or filter | `<expected>` | `<observed>` | `<pass, fail, not applicable>` |
| Selection | `<expected>` | `<observed>` | `<pass, fail, not applicable>` |
| Form values | `<expected>` | `<observed>` | `<pass, fail, not applicable>` |
| Scroll | `<expected>` | `<observed>` | `<pass, fail, not applicable>` |
| Usable data | `<expected>` | `<observed>` | `<pass, fail, not applicable>` |

#### Screenshot evidence

- `<capture-id>`
- `<path>`

#### Defects created

- `<defect-id or none>`

#### Scenario result

`<pass, fail, blocked>`

---

## 7. Initial-loading validation

| Check | Expected | Result |
|---|---|---|
| Loading replaces content only when no usable data exists | `<expected>` | `<pass, fail, not applicable>` |
| Skeleton geometry matches intended content | `<expected>` | `<pass, fail, not applicable>` |
| Focus is not repeatedly reset | `<expected>` | `<pass, fail, not applicable>` |
| Busy state is semantically appropriate | `<expected>` | `<pass, fail, not applicable>` |

---

## 8. Background-refresh validation

| Check | Expected | Result |
|---|---|---|
| Existing usable content remains visible | `<expected>` | `<pass, fail, not applicable>` |
| Focus remains stable | `<expected>` | `<pass, fail, not applicable>` |
| Scroll remains stable | `<expected>` | `<pass, fail, not applicable>` |
| Selection remains stable | `<expected>` | `<pass, fail, not applicable>` |
| Refresh indication is restrained | `<expected>` | `<pass, fail, not applicable>` |

---

## 9. Non-success-state validation

| Check | Expected | Result |
|---|---|---|
| Failure scope is truthful | `<expected>` | `<pass or fail>` |
| Unaffected regions remain usable | `<expected>` | `<pass or fail>` |
| Recovery is visible | `<expected>` | `<pass or fail>` |
| Recovery is keyboard operable | `<expected>` | `<pass or fail>` |
| Focus moves deliberately | `<expected>` | `<pass or fail>` |
| Technical errors are normalized | `<expected>` | `<pass or fail>` |
| User work is preserved | `<expected>` | `<pass, fail, not applicable>` |

---

## 10. Permission validation

| Check | Expected | Result |
|---|---|---|
| Route-forbidden behavior is explicit | `<expected>` | `<pass, fail, not applicable>` |
| Read-only behavior is explicit | `<expected>` | `<pass, fail, not applicable>` |
| Hidden actions are genuinely absent | `<expected>` | `<pass, fail, not applicable>` |
| Disabled actions have reasons | `<expected>` | `<pass, fail, not applicable>` |
| Raw capability keys are not exposed | `<expected>` | `<pass, fail, not applicable>` |
| Backend authority remains documented | `<expected>` | `<pass, fail, not applicable>` |

---

## 11. Mutation validation

| Check | Expected | Result |
|---|---|---|
| Eligibility is enforced | `<expected>` | `<pass, fail, not applicable>` |
| Duplicate submission is prevented | `<expected>` | `<pass, fail, not applicable>` |
| Pending state is visible | `<expected>` | `<pass, fail, not applicable>` |
| Primary mutation is not repeatable while pending | `<expected>` | `<pass, fail, not applicable>` |
| Authoritative success is used | `<expected>` | `<pass, fail, not applicable>` |
| Failure preserves recoverable context | `<expected>` | `<pass, fail, not applicable>` |
| Cache or route reconciliation occurs | `<expected>` | `<pass, fail, not applicable>` |

---

## 12. Zoom validation

### 125% browser zoom

| Viewport | Result | Defects |
|---|---|---|
| `390x844` | `<pass or fail>` | `<IDs or none>` |
| `1024x768` | `<pass or fail>` | `<IDs or none>` |
| `1440x900` | `<pass or fail>` | `<IDs or none>` |

### 200% text scaling or equivalent reflow validation

| Check | Result | Defects |
|---|---|---|
| Critical text remains visible | `<pass or fail>` | `<IDs or none>` |
| Controls remain operable | `<pass or fail>` | `<IDs or none>` |
| Labels remain associated | `<pass or fail>` | `<IDs or none>` |
| Content does not overlap | `<pass or fail>` | `<IDs or none>` |
| Page-level overflow remains absent | `<pass or fail>` | `<IDs or none>` |

---

## 13. Reduced-motion validation

| Check | Result | Evidence |
|---|---|---|
| Nonessential motion is removed or reduced | `<pass, fail, not applicable>` | `<evidence>` |
| Focus is not communicated by motion alone | `<pass, fail, not applicable>` | `<evidence>` |
| Processing remains understandable | `<pass, fail, not applicable>` | `<evidence>` |
| Layout does not depend on animation completion | `<pass, fail, not applicable>` | `<evidence>` |

---

## 14. Content-stress validation

| Content case | Viewport | Result | Defects |
|---|---|---|---|
| Long title | `<viewport>` | `<pass or fail>` | `<IDs or none>` |
| Long entity name | `<viewport>` | `<pass or fail>` | `<IDs or none>` |
| Long action label | `<viewport>` | `<pass or fail>` | `<IDs or none>` |
| Long status label | `<viewport>` | `<pass or fail>` | `<IDs or none>` |
| Long error message | `<viewport>` | `<pass or fail>` | `<IDs or none>` |
| Missing optional content | `<viewport>` | `<pass or fail>` | `<IDs or none>` |

---

## 15. Browser console and network

| Check | Result | Evidence |
|---|---|---|
| No unexpected console errors | `<pass or fail>` | `<output>` |
| No unexpected rejected promises | `<pass or fail>` | `<output>` |
| No uncontrolled production request | `<pass or fail>` | `<output>` |
| Fixture transport remains isolated | `<pass or fail>` | `<output>` |
| No secret or token is logged | `<pass or fail>` | `<output>` |

---

## 16. Defect reconciliation

| Defect ID | Scenario | Severity | Patched | Revalidated | Result |
|---|---|---|---|---|---|
| `<defect-id>` | `<scenario-id>` | `<severity>` | `<yes or no>` | `<yes or no>` | `<resolved, open, accepted>` |

Every patched defect must be revalidated in the scenario that exposed it.

---

## 17. Validation summary

| Area | Required | Result |
|---|---|---|
| Primary state | Yes | `<pass or fail>` |
| Non-success state | Yes | `<pass or fail>` |
| Interaction | Yes | `<pass or fail>` |
| Compact viewport | Yes | `<pass or fail>` |
| Constrained viewport | Yes | `<pass or fail>` |
| Wide viewport | Yes | `<pass or fail>` |
| Keyboard | Yes | `<pass or fail>` |
| Focus | Yes | `<pass or fail>` |
| Zoom | Yes | `<pass or fail>` |
| Reflow | Yes | `<pass or fail>` |
| Reduced motion | `<yes or applicable>` | `<pass, fail, not applicable>` |
| No page-level overflow | Yes | `<pass or fail>` |
| Console and network | Yes | `<pass or fail>` |

---

## 18. Final decision

The browser-validation gate may become `validated` only when:

- [ ] Every required scenario was executed.
- [ ] Every required viewport was executed.
- [ ] Primary-state behavior passes.
- [ ] Non-success-state behavior passes.
- [ ] Required interaction behavior passes.
- [ ] Keyboard behavior passes.
- [ ] Focus behavior passes.
- [ ] Responsive transformation passes.
- [ ] Page-level overflow is absent.
- [ ] Zoom and reflow pass.
- [ ] Required screenshots exist.
- [ ] No blocking browser defect remains open.
- [ ] Patched defects were revalidated.
- [ ] Evidence paths are traceable.

**Gate status:** `blocked`

### Final rationale

`<rationale>`

### Blocking defects

- `<defect IDs or none>`
