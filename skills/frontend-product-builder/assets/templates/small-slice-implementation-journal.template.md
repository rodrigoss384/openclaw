# <Screen Name> — Small Slice Implementation Journal

## Document metadata

| Field | Value |
|---|---|
| Screen ID | `<screen-id>` |
| Slice ID | `<slice-id>` |
| Manifest | `docs/frontend/screens/<screen-id>/small-slice-manifest.json` |
| Repository inspection | `docs/frontend/screens/<screen-id>/repository-inspection.md` |
| Fixture strategy | `docs/frontend/screens/<screen-id>/fixture-strategy.md` |
| Owner | `<feature-or-team>` |
| Started at | `<ISO-8601 timestamp>` |
| Last updated | `<ISO-8601 timestamp>` |

**Execution status:** `draft`

Allowed values:

```text
draft
ready
in-progress
blocked
validated
rejected
```

---

## 1. Purpose

This journal records the actual execution of the approved representative slice.

It exists to preserve traceability between:

```text
planning contract
        ↓
declared file plan
        ↓
implementation work
        ↓
commands executed
        ↓
browser evidence
        ↓
defects
        ↓
patches
        ↓
revalidation
        ↓
representative-gate preparation
```

The journal must not be used to retroactively authorize unplanned work.

When implementation requires work outside the manifest:

1. stop;
2. record the condition;
3. update the authoritative planning artifact;
4. update the manifest;
5. rerun validation;
6. continue only after release.

---

## 2. Execution baseline

### Repository

| Field | Value |
|---|---|
| Repository root | `<absolute-or-project-relative-path>` |
| Application package | `<application-package>` |
| Branch | `<branch>` |
| Commit | `<commit-hash>` |
| Package manager | `<package-manager-and-version>` |
| Authoritative lockfile | `<lockfile>` |
| Working tree status | `<clean-or-documented-existing-changes>` |

### Baseline command

```bash
git status --short
```

### Baseline output

```text
<preserved command output>
```

### Existing changes

| Path | Status | Related to slice | Handling |
|---|---|---|---|
| `<path>` | `<modified, untracked, deleted>` | `<yes or no>` | `<preserve, coordinate, include>` |

Do not claim that a file was changed by the slice when it was already modified before execution.

---

## 3. Release confirmation

| Check | Evidence | Result |
|---|---|---|
| Readiness report exists | `docs/frontend/screens/<screen-id>/readiness-report.json` | `<pass or fail>` |
| Readiness status releases `SMALL SLICE` | `<status>` | `<pass or fail>` |
| Repository inspection approved | `repository-inspection.md` | `<pass or fail>` |
| Fixture strategy approved | `fixture-strategy.md` | `<pass or fail>` |
| Manifest validates | `small-slice-manifest.json` | `<pass or fail>` |
| Scope audit passes | `<audit output>` | `<pass or fail>` |
| No active blocker exists | `<manifest evidence>` | `<pass or fail>` |

### Release decision

`<released, blocked>`

### Blocking reason

`<reason or none>`

Implementation must not begin while this decision is `blocked`.

---

## 4. Approved slice boundary

### In scope

- `<approved responsibility>`

### Out of scope

- `<excluded responsibility>`

### Production architecture being proven

- `<route ownership>`
- `<feature boundary>`
- `<data boundary>`
- `<state ownership>`
- `<side-effect boundary>`
- `<component responsibility>`
- `<token responsibility>`

### Required proof dimensions

| Dimension | Contract |
|---|---|
| Architecture | `<proof>` |
| State | `<proof>` |
| Interaction | `<proof>` |
| Responsive | `<proof>` |
| Accessibility | `<proof>` |

---

## 5. Planned files

Copy the authoritative file plan from:

```text
small-slice-manifest.json
```

| Path | Action | Disposition | Purpose | Status |
|---|---|---|---|---|
| `<path>` | `<inspect, reuse, create, modify, remove>` | `<production, fixture, test, story, evidence, configuration>` | `<purpose>` | `<planned, started, completed, blocked>` |

Do not add files silently.

---

## 6. Actual file changes

Update this table as work occurs.

| Path | Actual action | Manifest entry | Reason | Validation |
|---|---|---|---|---|
| `<path>` | `<created, modified, removed, inspected>` | `<entry ID or path>` | `<reason>` | `<pending, passed, failed>` |

### Unplanned files

| Path | Why it became necessary | Planning update | Decision |
|---|---|---|---|
| `<path or none>` | `<reason>` | `<artifact updated>` | `<approved, rejected, pending>` |

Any unresolved row blocks execution.

---

## 7. Dependency changes

| Dependency or configuration | Existing or new | Reason | Approval | Lockfile impact |
|---|---|---|---|---|
| `<dependency or none>` | `<existing or new>` | `<reason>` | `<approved or not required>` | `<none or path>` |

Do not install a new dependency without:

- repository inspection;
- explicit need;
- scope confirmation;
- package-manager authority;
- approval;
- lockfile review.

---

## 8. Implementation sequence

| Order | Step ID | Description | Started | Completed | Result |
|---:|---|---|---|---|---|
| 1 | `<step-id>` | `<description>` | `<timestamp>` | `<timestamp>` | `<pass, fail, blocked>` |

A failed `stopOnFailure` step blocks subsequent implementation.

---

## 9. Command log

Record commands that:

- install dependencies;
- generate files;
- run migrations;
- build;
- typecheck;
- lint;
- test;
- launch Storybook;
- launch the application;
- run browser tests;
- capture screenshots;
- execute audits.

| Timestamp | Working directory | Command | Exit code | Purpose | Output reference |
|---|---|---|---:|---|---|
| `<timestamp>` | `<directory>` | `<command>` | `<code>` | `<purpose>` | `<path or summary>` |

Do not record commands as successful unless they were executed.

---

## 10. Decision log

| Decision ID | Trigger | Decision | Alternatives rejected | Contract updated | Owner |
|---|---|---|---|---|---|
| `DEC-001` | `<trigger>` | `<decision>` | `<alternatives>` | `<artifact or none>` | `<owner>` |

Use this section for decisions that affect:

- architecture;
- ownership;
- component responsibility;
- fixture behavior;
- responsive transformation;
- accessibility behavior;
- mutation semantics;
- scope.

---

## 11. State implementation

| State ID | Role | Fixture | Implemented | Tested | Browser validated | Evidence |
|---|---|---|---|---|---|---|
| `data` | `primary` | `<fixture-id>` | `<yes or no>` | `<yes or no>` | `<yes or no>` | `<path>` |
| `<state-id>` | `non-success` | `<fixture-id>` | `<yes or no>` | `<yes or no>` | `<yes or no>` | `<path>` |

### Preservation behavior

| Transition or failure | Context that must survive | Result |
|---|---|---|
| `<condition>` | `<filter, form, selection, content, scroll>` | `<pass or fail>` |

---

## 12. Interaction implementation

| Interaction ID | Trigger | Owner | Keyboard | Focus | Success | Failure | Result |
|---|---|---|---|---|---|---|---|
| `<interaction-id>` | `<trigger>` | `<owner>` | `<behavior>` | `<behavior>` | `<behavior>` | `<behavior>` | `<pass or fail>` |

Do not treat a visually clickable control as proof of a complete interaction.

---

## 13. Responsive implementation

| Range | Condition | Layout | Transformation | Scroll owner | Result |
|---|---|---|---|---|---|
| `compact` | `<condition>` | `<layout>` | `<transformation>` | `<owner>` | `<pass or fail>` |
| `wide` | `<condition>` | `<layout>` | `<transformation>` | `<owner>` | `<pass or fail>` |

### Horizontal overflow

| Viewport | Page-level overflow | Intended local overflow | Result |
|---|---|---|---|
| `390x844` | `<present or absent>` | `<region or none>` | `<pass or fail>` |
| `1024x768` | `<present or absent>` | `<region or none>` | `<pass or fail>` |
| `1440x900` | `<present or absent>` | `<region or none>` | `<pass or fail>` |

---

## 14. Accessibility implementation

| Concern | Contract | Implementation | Evidence | Result |
|---|---|---|---|---|
| Semantics | `<contract>` | `<implementation>` | `<path>` | `<pass or fail>` |
| Accessible names | `<contract>` | `<implementation>` | `<path>` | `<pass or fail>` |
| Keyboard | `<contract>` | `<implementation>` | `<path>` | `<pass or fail>` |
| Focus | `<contract>` | `<implementation>` | `<path>` | `<pass or fail>` |
| Announcements | `<contract>` | `<implementation>` | `<path>` | `<pass or fail>` |
| Reduced motion | `<contract>` | `<implementation>` | `<path>` | `<pass or fail>` |
| Zoom and reflow | `<contract>` | `<implementation>` | `<path>` | `<pass or fail>` |

---

## 15. Test results

| Test type | Command | Result | Evidence |
|---|---|---|---|
| Typecheck | `<command>` | `<pass, fail, unavailable>` | `<path or output>` |
| Lint | `<command>` | `<pass, fail, unavailable>` | `<path or output>` |
| Unit | `<command>` | `<pass, fail, unavailable>` | `<path or output>` |
| Component | `<command>` | `<pass, fail, unavailable>` | `<path or output>` |
| Feature | `<command>` | `<pass, fail, unavailable>` | `<path or output>` |
| Storybook | `<command>` | `<pass, fail, unavailable>` | `<path or output>` |
| Browser | `<command>` | `<pass, fail, unavailable>` | `<path or output>` |

`Unavailable` requires documented approved handling.

---

## 16. Browser-validation summary

Authoritative document:

```text
docs/frontend/screens/<screen-id>/browser-validation.md
```

| Scenario | Result | Defects | Evidence |
|---|---|---|---|
| `<scenario>` | `<pass or fail>` | `<defect IDs or none>` | `<path>` |

---

## 17. Screenshot summary

Authoritative document:

```text
docs/frontend/screens/<screen-id>/screenshot-evidence.json
```

| Capture ID | State | Viewport | Status | Path |
|---|---|---|---|---|
| `<capture-id>` | `<state-id>` | `<width>x<height>` | `<planned, captured, rejected, approved>` | `<path>` |

---

## 18. Design-system audit summary

Authoritative document:

```text
docs/frontend/screens/<screen-id>/design-system-audit.md
```

| Area | Result | Defects |
|---|---|---|
| Tokens | `<pass or fail>` | `<IDs or none>` |
| Components | `<pass or fail>` | `<IDs or none>` |
| Layout | `<pass or fail>` | `<IDs or none>` |
| Responsive behavior | `<pass or fail>` | `<IDs or none>` |
| Accessibility | `<pass or fail>` | `<IDs or none>` |

---

## 19. Defect summary

Authoritative document:

```text
docs/frontend/screens/<screen-id>/defect-log.md
```

| Severity | Open | Resolved | Accepted |
|---|---:|---:|---:|
| Blocking | `<count>` | `<count>` | `<count>` |
| High | `<count>` | `<count>` | `<count>` |
| Medium | `<count>` | `<count>` | `<count>` |
| Low | `<count>` | `<count>` | `<count>` |

No blocking defect may remain open when the slice is marked `validated`.

---

## 20. Scope checkpoints

Perform this checkpoint after each meaningful implementation phase.

### Checkpoint `<number>`

| Check | Result |
|---|---|
| All changed files remain declared | `<pass or fail>` |
| No new route was introduced | `<pass or fail>` |
| No parallel component system was introduced | `<pass or fail>` |
| No new styling system was introduced | `<pass or fail>` |
| No unapproved dependency was installed | `<pass or fail>` |
| No unrelated screen was modified | `<pass or fail>` |
| No state was added without contract update | `<pass or fail>` |
| No permission behavior was invented | `<pass or fail>` |
| No migration became necessary | `<pass or fail>` |
| Stop conditions remain inactive | `<pass or fail>` |

### Checkpoint decision

`<continue, pause, return-to-plan>`

---

## 21. Triggered stop conditions

| Stop-condition ID | Triggered at | Evidence | Impact | Required decision | Status |
|---|---|---|---|---|---|
| `<condition-id or none>` | `<timestamp>` | `<evidence>` | `<impact>` | `<decision>` | `<triggered, resolved, accepted>` |

An accepted stop condition requires explicit authority and must not conceal an unsafe continuation.

---

## 22. Final file reconciliation

Run the authoritative file audit and record the result.

| Check | Result |
|---|---|
| Every changed file is declared | `<pass or fail>` |
| Every declared created file exists | `<pass or fail>` |
| Every declared modified file changed | `<pass or fail>` |
| Every declared removed file is removed | `<pass or fail>` |
| No undeclared lockfile exists | `<pass or fail>` |
| No temporary production code exists | `<pass or fail>` |
| Evidence artifacts are traceable | `<pass or fail>` |

### File-audit command

```bash
node "$HOME/.agents/skills/frontend-product-builder/scripts/audit-small-slice-files.mjs" \
  "docs/frontend/screens/<screen-id>/small-slice-manifest.json"
```

### File-audit result

`<pass or fail>`

---

## 23. Final evidence reconciliation

Run the evidence audit and record the result.

```bash
node "$HOME/.agents/skills/frontend-product-builder/scripts/audit-small-slice-evidence.mjs" \
  "docs/frontend/screens/<screen-id>/small-slice-manifest.json"
```

### Evidence-audit result

`<pass or fail>`

---

## 24. Completion decision

The slice may be marked `validated` only when:

- [ ] Readiness still releases `SMALL SLICE`.
- [ ] Repository assumptions remain correct.
- [ ] Fixtures remain deterministic and safe.
- [ ] Actual files match the manifest.
- [ ] Scope has not expanded.
- [ ] Primary state is complete.
- [ ] Selected non-success state is complete.
- [ ] Interaction proof is complete.
- [ ] Responsive proof is complete.
- [ ] Accessibility proof is complete.
- [ ] Required tests pass.
- [ ] Browser validation passes.
- [ ] Required screenshots exist.
- [ ] Design-system audit passes.
- [ ] No blocking defect remains open.
- [ ] Required evidence is traceable.
- [ ] No stop condition remains triggered.

**Final status:** `draft`

Allowed final values:

```text
draft
blocked
validated
rejected
```

### Final rationale

`<rationale>`

### Representative-review recommendation

`<blocked, ready-for-review>`

### Prepared gate artifact

```text
docs/frontend/screens/<screen-id>/representative-gate-preparation.json
```
