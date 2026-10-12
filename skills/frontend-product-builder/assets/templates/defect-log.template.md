# <Screen Name> — Small Slice Defect Log

## Document metadata

| Field | Value |
|---|---|
| Screen ID | `<screen-id>` |
| Slice ID | `<slice-id>` |
| Manifest | `docs/frontend/screens/<screen-id>/small-slice-manifest.json` |
| Implementation journal | `docs/frontend/screens/<screen-id>/small-slice-implementation-journal.md` |
| Browser validation | `docs/frontend/screens/<screen-id>/browser-validation.md` |
| Design-system audit | `docs/frontend/screens/<screen-id>/design-system-audit.md` |
| Owner | `<feature-or-team>` |
| Last updated | `<ISO-8601 timestamp>` |

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

This log records verified defects discovered during:

- implementation;
- tests;
- Storybook;
- browser validation;
- screenshot review;
- design-system audit;
- component audit;
- responsive audit;
- accessibility audit;
- scope audit;
- evidence audit.

Do not record subjective preferences as defects without identifying the violated contract.

Do not close a defect only because the code changed.

A defect closes after the affected behavior is revalidated.

---

## 2. Severity model

### `blocking`

Prevents truthful continuation or representative approval.

Examples:

- data loss;
- unsafe mutation;
- permission violation;
- inaccessible primary task;
- incorrect authoritative state;
- page unusable at a required viewport;
- missing required state;
- unapproved architecture or migration;
- undeclared file or dependency;
- production data in fixtures;
- missing required evidence.

### `high`

Materially breaks a required task or contract but may not stop all validation.

### `medium`

Creates a significant usability, consistency, responsive, or accessibility defect in a bounded scenario.

### `low`

Creates a minor verified contract deviation with limited product impact.

Severity must reflect user and product impact, not implementation difficulty.

---

## 3. Status model

### `open`

Verified and not corrected.

### `in-progress`

Correction is underway.

### `patched`

Code or contract changed, but revalidation is incomplete.

### `resolved`

Affected tests, scenarios, and evidence pass after correction.

### `accepted`

A nonblocking defect was explicitly accepted with owner, rationale, and review date.

### `rejected`

The reported condition was not a valid defect after investigation.

Blocking defects cannot be accepted merely to release the gate.

---

## 4. Defect summary

| Severity | Open | In progress | Patched | Resolved | Accepted | Rejected |
|---|---:|---:|---:|---:|---:|---:|
| Blocking | 0 | 0 | 0 | 0 | 0 | 0 |
| High | 0 | 0 | 0 | 0 | 0 | 0 |
| Medium | 0 | 0 | 0 | 0 | 0 | 0 |
| Low | 0 | 0 | 0 | 0 | 0 | 0 |

The counts must match the detailed inventory.

---

## 5. Defect inventory

| ID | Title | Category | Severity | Status | State | Viewport | Owner |
|---|---|---|---|---|---|---|---|
| `<DEFECT-001>` | `<title>` | `<category>` | `<blocking, high, medium, low>` | `<status>` | `<state-id>` | `<viewport or all>` | `<owner>` |

Defect IDs must remain stable.

Recommended ID pattern:

```text
DEFECT-001
DEFECT-002
DEFECT-003
```

---

## 6. Detailed defect template

Duplicate this section for each defect.

## `<DEFECT-001>` — `<Title>`

### Classification

| Field | Value |
|---|---|
| Category | `<product, state, architecture, component, token, responsive, accessibility, content, test, evidence, scope>` |
| Severity | `<blocking, high, medium, low>` |
| Status | `<open, in-progress, patched, resolved, accepted, rejected>` |
| Owner | `<owner>` |
| Discovered at | `<timestamp>` |
| Last updated | `<timestamp>` |

### Source

- `<browser scenario>`
- `<test>`
- `<screenshot capture>`
- `<audit>`
- `<manual verification>`

### Affected contract

`<authoritative artifact and contract section>`

Examples:

```text
screen-spec.json → states
state-matrix.md → partial failure
component-map.md → canonical responsibility
small-slice-manifest.json → responsive proof
design-system.json → semantic token
```

### Preconditions

- `<precondition>`

### Reproduction steps

1. `<step>`
2. `<step>`
3. `<step>`

### Expected behavior

`<expected behavior>`

### Observed behavior

`<observed behavior>`

### Evidence

- `<path>`
- `<screenshot capture ID>`
- `<test output>`
- `<browser output>`

### Impact

`<user, product, data, architecture, accessibility, or evidence impact>`

### Root cause

`<verified root cause or pending investigation>`

Do not present an unverified guess as the root cause.

### Required correction

`<bounded correction>`

### Authoritative artifact update

| Artifact | Required | Updated | Evidence |
|---|---|---|---|
| `<artifact>` | `<yes or no>` | `<yes or no>` | `<path>` |

A planning-contract defect must not be fixed only through a local JSX exception.

### Patch

| Field | Value |
|---|---|
| Files changed | `<paths>` |
| Commit or diff | `<reference>` |
| Patch completed at | `<timestamp>` |
| Patch owner | `<owner>` |

### Revalidation plan

- `<test>`
- `<browser scenario>`
- `<viewport>`
- `<keyboard or focus check>`
- `<screenshot refresh>`
- `<audit rerun>`

### Revalidation result

| Check | Command or scenario | Result | Evidence |
|---|---|---|---|
| `<check>` | `<command>` | `<pass or fail>` | `<path>` |

### Resolution

| Field | Value |
|---|---|
| Final status | `<resolved, accepted, rejected>` |
| Closed at | `<timestamp>` |
| Closed by | `<owner>` |
| Rationale | `<rationale>` |

### Acceptance contract

Complete only when status is `accepted`.

| Field | Value |
|---|---|
| Accepting owner | `<owner>` |
| Reason | `<reason>` |
| User impact | `<impact>` |
| Expiration or review date | `<date>` |
| Follow-up reference | `<issue or none>` |

A blocking defect cannot use this section to bypass the gate.

---

## 7. Contract corrections

| Defect ID | Authoritative artifact | Change | Revalidated |
|---|---|---|---|
| `<defect-id>` | `<screen spec, state matrix, component map, manifest, catalog, design system>` | `<change>` | `<yes or no>` |

---

## 8. Patch batches

| Batch ID | Defects | Files | Tests | Browser scenarios | Status |
|---|---|---|---|---|---|
| `PATCH-001` | `<defect IDs>` | `<paths>` | `<tests>` | `<scenarios>` | `<planned, patched, validated>` |

Do not combine unrelated broad refactors into a defect patch batch.

---

## 9. Regression review

| Concern | Result | Evidence |
|---|---|---|
| Primary state still works | `<pass or fail>` | `<evidence>` |
| Non-success state still works | `<pass or fail>` | `<evidence>` |
| Interaction still works | `<pass or fail>` | `<evidence>` |
| Compact layout still works | `<pass or fail>` | `<evidence>` |
| Wide layout still works | `<pass or fail>` | `<evidence>` |
| Keyboard behavior still works | `<pass or fail>` | `<evidence>` |
| Focus behavior still works | `<pass or fail>` | `<evidence>` |
| Fixtures remain deterministic | `<pass or fail>` | `<evidence>` |
| Scope remains bounded | `<pass or fail>` | `<evidence>` |

---

## 10. Gate blockers

| Defect ID | Reason it blocks | Required evidence | Status |
|---|---|---|---|
| `<defect-id or none>` | `<reason>` | `<evidence>` | `<open or resolved>` |

---

## 11. Final reconciliation

The defect log may become `validated` only when:

- [ ] Every verified defect has a stable ID.
- [ ] Every defect identifies a violated contract.
- [ ] Blocking defects are resolved.
- [ ] High-severity defects required by the slice are resolved.
- [ ] Patched defects were revalidated.
- [ ] Planning artifacts were updated when needed.
- [ ] Screenshots were refreshed when visual output changed.
- [ ] Browser scenarios were rerun when interaction changed.
- [ ] Accepted defects are nonblocking and explicitly authorized.
- [ ] Summary counts match the detailed inventory.
- [ ] No scope-expansion defect remains open.

**Gate status:** `blocked`

### Open blocking defect IDs

- `<defect IDs or none>`

### Final rationale

`<rationale>`
