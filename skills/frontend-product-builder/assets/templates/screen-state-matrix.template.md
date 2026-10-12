# <Screen Name> — State Matrix

## Document metadata

| Field | Value |
|---|---|
| Screen ID | `<screen-id>` |
| Screen specification | `docs/frontend/screens/<screen-id>/screen-spec.json` |
| Route or surface | `<route-or-surface>` |
| Dominant category | `<screen-category>` |
| Selected recipe | `<recipe-id>` |
| Feature owner | `<feature-or-team>` |
| Status | `draft` |
| Version | `1.0.0` |
| Last updated | `<YYYY-MM-DD>` |

---

## 1. Purpose

This document defines the complete product-state behavior of `<screen-name>`.

It is not a list of framework booleans.

It records:

- what triggered each state;
- what the user understands;
- which data remains authoritative;
- which regions remain visible;
- which components change state;
- which actions remain available;
- where focus moves;
- what is announced;
- how recovery works;
- which states require screenshots and browser validation.

Implementation must not begin until every relevant standard state has been evaluated.

---

## 2. Primary task

**Primary task**

`<Describe the single dominant task performed through this screen.>`

**Successful user outcome**

`<Describe the observable result that means the user completed or advanced the task.>`

**Authoritative completion source**

`<Backend response, persisted record, workflow transition, route state, or another authoritative source.>`

---

## 3. Region inventory

| Priority | Region ID | Recipe region | Purpose | Required | Primary state owner |
|---:|---|---|---|---|---|
| 1 | `<screenRegionId>` | `<recipeRegionId>` | `<Region responsibility>` | Yes | `<query-owned, form-owned, route-owned, feature-owned, stateless>` |

Rules:

- Use screen-region IDs from `screen-spec.json`.
- Preserve the same region names in the component map and implementation plan.
- Do not create state descriptions for unnamed ad hoc regions.
- A local region failure must not become a page failure without a truthful reason.

---

## 4. Standard state applicability

Evaluate every standard state.

Do not delete rows merely because a state is not expected.

Use `not-applicable` with a reason.

| State | Applicability | Reason | Blocking if undefined |
|---|---|---|---|
| `initial-loading` | `<required or not-applicable>` | `<Reason>` | Yes |
| `data` | `<required or not-applicable>` | `<Reason>` | Yes |
| `empty` | `<required or not-applicable>` | `<Reason>` | Yes |
| `partial` | `<required or not-applicable>` | `<Reason>` | Yes |
| `error` | `<required or not-applicable>` | `<Reason>` | Yes |
| `forbidden` | `<required or not-applicable>` | `<Reason>` | Yes |
| `unavailable` | `<required or not-applicable>` | `<Reason>` | Yes |
| `processing` | `<required or not-applicable>` | `<Reason>` | Yes |
| `success` | `<required or not-applicable>` | `<Reason>` | Yes |
| `stale` | `<required or not-applicable>` | `<Reason>` | Yes |

Custom states:

| State ID | Product meaning | Why a standard state is insufficient |
|---|---|---|
| `<custom-state-id>` | `<User-facing meaning>` | `<Rationale>` |

Custom state IDs must use product meaning.

Allowed:

```text
evidence-processing
decision-conflict
session-expired
dependency-missing
```

Avoid:

```text
query-error
is-loading
mutation-success
modal-open
```

---

## 5. State summary

| State ID | Category | Trigger | Authoritative data | Primary user understanding | Screenshot |
|---|---|---|---|---|---|
| `initial-loading` | `initial-loading` | `<Trigger>` | `<What is authoritative>` | `<What the user understands>` | Yes |
| `data` | `data` | `<Trigger>` | `<What is authoritative>` | `<What the user understands>` | Yes |

---

## 6. Detailed state contracts

Duplicate the following section for every relevant state.

---

### State: `<state-id>`

#### Classification

| Field | Value |
|---|---|
| Category | `<initial-loading, data, empty, partial, error, forbidden, unavailable, processing, success, stale, custom>` |
| Trigger | `<Exact condition>` |
| Exit condition | `<Condition that resolves this state>` |
| Screenshot required | `<Yes or No>` |
| Browser test required | `<Yes or No>` |
| Blocking state | `<Yes or No>` |

#### User understanding

`<Describe what the user should understand from this state without knowledge of implementation details.>`

#### Authoritative data

`<Identify what data is authoritative, provisional, preserved, stale, unavailable, or unknown.>`

Do not use vague descriptions such as:

```text
Data is loading.
```

Prefer:

```text
No authoritative customer collection is available yet. The route identity,
application shell, active tenant, and current URL filters are authoritative.
```

#### Visible regions

| Region ID | Presentation | Reason |
|---|---|---|
| `<screenRegionId>` | `<Visible presentation>` | `<Why it remains visible>` |

#### Hidden or replaced regions

| Region ID | Behavior | Reason |
|---|---|---|
| `<screenRegionId>` | `<Hidden, replaced, redacted, or omitted>` | `<Reason>` |

#### Component states

| Component usage ID | Component | State | Notes |
|---|---|---|---|
| `<component-usage-id>` | `<Component>` | `<State>` | `<Specific behavior>` |

#### Enabled actions

| Action ID | Label | Eligibility |
|---|---|---|
| `<action-id>` | `<User-facing label>` | `<Why it remains eligible>` |

Use `None` when no action is available.

#### Disabled actions

| Action ID | Label | Visible reason |
|---|---|---|
| `<action-id>` | `<User-facing label>` | `<Why the user cannot perform it>` |

A disabled action without an obvious reason requires visible explanation.

#### Focus behavior

`<Describe initial focus, preserved focus, focus movement, and recovery focus.>`

#### Announcement behavior

`<Describe live-region, status, alert, or silent behavior.>`

#### Recovery

1. `<Recovery action or transition>`
2. `<Fallback or escalation>`
3. `<Preservation behavior>`

#### Content requirements

- Title: `<State title or not applicable>`
- Description: `<Content requirement>`
- Primary action: `<Action or none>`
- Secondary action: `<Action or none>`
- Correlation reference: `<When allowed>`
- Prohibited technical content:
  - `<Raw error, status code, capability key, schema path, or transport detail>`

#### Responsive behavior

- Compact: `<Behavior>`
- Constrained: `<Behavior>`
- Wide: `<Behavior>`
- Zoom and reflow: `<Behavior>`

#### Validation assertions

- [ ] The state communicates product meaning rather than framework state.
- [ ] Existing usable data is preserved when safe.
- [ ] The failure is presented at the smallest truthful scope.
- [ ] Actions match actual permission and eligibility.
- [ ] Focus behavior is explicit.
- [ ] Announcement behavior is explicit.
- [ ] Recovery preserves user work when possible.
- [ ] Compact behavior is defined.
- [ ] The state does not expose technical internals.

---

## 7. Initial loading contract

Initial loading applies only when no usable authoritative screen data is available.

### Authoritative information allowed before data resolution

- `<Route identity>`
- `<Application shell>`
- `<Current tenant or organization>`
- `<URL filters>`
- `<Known screen title>`
- `<Other authoritative context>`

### Initial loading presentation

| Region | Component | Loading treatment |
|---|---|---|
| `<region>` | `<LoadingState or structural skeleton>` | `<Behavior>` |

Requirements:

- Preserve the application shell.
- Do not use random-width skeleton elements.
- Skeleton anatomy must reflect the actual region anatomy.
- Do not render fake values.
- Do not announce every skeleton region separately.
- Do not show an empty state before loading resolves.

---

## 8. Background refresh contract

Background refresh must remain distinct from initial loading.

| Field | Decision |
|---|---|
| Existing content remains visible | `<Yes or No with reason>` |
| Focus remains preserved | `<Behavior>` |
| Scroll remains preserved | `<Behavior>` |
| Query remains visible | `<Behavior>` |
| Selected item remains visible | `<Behavior>` |
| Form values remain preserved | `<Behavior>` |
| Refresh indicator | `<Component and location>` |
| Stale threshold | `<Policy>` |
| Failure behavior | `<Local feedback and recovery>` |

Prohibited behavior:

```text
Background request
→ erase current content
→ show complete screen skeleton
```

Preferred behavior:

```text
Current authoritative or previously confirmed content remains visible
+ local refresh or freshness indication
```

---

## 9. Empty-state distinctions

Evaluate each empty condition separately.

| Empty condition | Applicable | User meaning | Component | Primary action | Permission behavior |
|---|---|---|---|---|---|
| Collection has no records | `<Yes or No>` | `<Meaning>` | `<EmptyState variant>` | `<Action>` | `<Behavior>` |
| Current filters return no records | `<Yes or No>` | `<Meaning>` | `<EmptyState variant>` | `<Clear filters>` | `<Behavior>` |
| Search query returns no records | `<Yes or No>` | `<Meaning>` | `<EmptyState variant>` | `<Clear or edit query>` | `<Behavior>` |
| Required dependency is absent | `<Yes or No>` | `<Meaning>` | `<Unavailable or empty composition>` | `<Configure dependency>` | `<Behavior>` |
| Feature is not configured | `<Yes or No>` | `<Meaning>` | `<EmptyState variant>` | `<Configure>` | `<Behavior>` |
| User cannot create | `<Yes or No>` | `<Meaning>` | `<Read-only empty state>` | `None` | `<Explanation>` |

Do not use one generic empty state for all conditions.

---

## 10. Partial-state inventory

| Region | Failure source | Regions preserved | Local fallback | Retry | Primary task still possible |
|---|---|---|---|---|---|
| `<affected-region>` | `<Failure>` | `<Preserved regions>` | `<Local ErrorState>` | `<Retry action>` | `<Yes or No>` |

Rules:

- Preserve unaffected regions.
- Keep current focus unless the failed region owned it.
- Place retry in or near the affected region.
- Do not display a global error when local recovery is sufficient.
- Record whether primary mutations remain safe.

---

## 11. Permission-state inventory

| Capability | Scope | Treatment | Visible explanation | Backend authority |
|---|---|---|---|---|
| `<capability>` | `<route, region, action, field>` | `<route-forbidden, hidden, disabled-with-reason, read-only, redacted, unavailable, allowed>` | `<User-facing explanation>` | Required |

Rules:

- Frontend treatment is not the security boundary.
- Avoid capability IDs in user-facing copy.
- Do not show generic errors for expected permission limits.
- Read-only and forbidden are different.
- Hidden and disabled are deliberate product decisions, not interchangeable defaults.

---

## 12. Processing-state inventory

| Process | Trigger | Existing content | Action locking | Progress model | Completion source |
|---|---|---|---|---|---|
| `<process>` | `<Trigger>` | `<Preserved or replaced>` | `<Actions blocked>` | `<Determinate or indeterminate>` | `<Authoritative source>` |

Do not fabricate progress.

Do not present success before authoritative completion.

---

## 13. Stale and conflict behavior

| Field | Decision |
|---|---|
| Stale trigger | `<Trigger>` |
| Conflict trigger | `<Trigger>` |
| Regions affected | `<Regions>` |
| Existing content remains visible | `<Behavior>` |
| Local values remain preserved | `<Behavior>` |
| Actions blocked | `<Actions>` |
| Refresh safety | `<Safe, unsafe, or conditional>` |
| Comparison required | `<Yes or No>` |
| User resolution choices | `<Choices>` |
| Focus behavior | `<Behavior>` |

Prohibited:

```text
Conflict detected
→ reload
→ discard local work
```

Required:

```text
Conflict detected
→ preserve local work
→ explain changed authority
→ compare or reconcile
→ explicit resolution
```

---

## 14. State transitions

Document meaningful transitions.

| From | Event | To | Preserved data | Focus outcome | Announcement |
|---|---|---|---|---|---|
| `<state>` | `<Event>` | `<state>` | `<Preserved data>` | `<Focus>` | `<Announcement>` |

Example:

```text
data
→ user submits
→ processing
→ authoritative success
→ success
```

Error example:

```text
data
→ user submits
→ processing
→ normalized server rejection
→ error
→ values preserved
```

---

## 15. Region-state coverage

Every required region must have behavior for every relevant state.

| Region ID | Initial loading | Data | Empty | Partial | Error | Forbidden | Processing | Stale |
|---|---|---|---|---|---|---|---|---|
| `<region>` | `<Behavior>` | `<Behavior>` | `<Behavior>` | `<Behavior>` | `<Behavior>` | `<Behavior>` | `<Behavior>` | `<Behavior>` |

Use `N/A — <reason>` rather than leaving cells blank.

---

## 16. Action-state coverage

| Action ID | Data | Empty | Partial | Error | Forbidden | Processing | Stale |
|---|---|---|---|---|---|---|---|
| `<action-id>` | `<Enabled>` | `<Behavior>` | `<Behavior>` | `<Recovery>` | `<Hidden or disabled>` | `<Pending>` | `<Blocked or conditional>` |

---

## 17. Screenshot matrix

| State | Viewport | Theme | Required content | File name |
|---|---|---|---|---|
| `data` | `1440x900` | `<light or dark>` | `<Regions>` | `<screen-id>-data-1440x900.png` |
| `initial-loading` | `390x844` | `<light or dark>` | `<Regions>` | `<screen-id>-loading-390x844.png` |

Minimum representative coverage normally includes:

- primary data state;
- compact viewport;
- initial loading;
- empty state;
- error or partial state;
- permission state when relevant;
- processing or mutation state;
- stale or conflict state when relevant.

---

## 18. State matrix gate

The state matrix passes only when:

- [ ] Every standard state was evaluated.
- [ ] Every applicable state has a detailed contract.
- [ ] Every required region has state coverage.
- [ ] Every action has state coverage.
- [ ] Initial loading and background refresh are distinct.
- [ ] Empty conditions are not conflated.
- [ ] Partial failures remain local where truthful.
- [ ] Permission treatment is explicit.
- [ ] Processing completion is authoritative.
- [ ] Stale and conflict behavior preserves user work.
- [ ] Focus and announcements are defined.
- [ ] Screenshot coverage is defined.
- [ ] No raw framework or transport state is exposed.

**Gate status:** `<blocked, ready, approved, rejected>`

**Blocking issues:**

- `<Issue or none>`

**Approval evidence:**

- `<Evidence>`
