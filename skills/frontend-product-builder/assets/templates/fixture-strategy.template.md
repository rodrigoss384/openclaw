# <Screen Name> — Fixture Strategy

## Document metadata

| Field | Value |
|---|---|
| Screen ID | `<screen-id>` |
| Small-slice manifest | `docs/frontend/screens/<screen-id>/small-slice-manifest.json` |
| Screen specification | `docs/frontend/screens/<screen-id>/screen-spec.json` |
| Feature | `<feature>` |
| Status | `draft` |
| Last updated | `<YYYY-MM-DD>` |

---

## 1. Purpose

This document defines deterministic, synthetic, safe representative data for the approved `SMALL SLICE`.

Fixtures must:

- express real frontend-model semantics;
- support the selected primary state;
- support the selected non-success state;
- preserve architecture boundaries;
- remain deterministic;
- avoid production data;
- avoid secrets;
- support browser and screenshot evidence;
- remain removable or replaceable without rewriting the screen.

Fixtures must not bypass the data model merely to simplify visual implementation.

---

## 2. Fixture boundary

| Layer | Path or owner | Decision |
|---|---|---|
| Transport DTO | `<Path, simulated contract, or not applicable>` | `<Decision>` |
| Runtime validation | `<Schema or adapter>` | `<Decision>` |
| Mapper | `<Path>` | `<Decision>` |
| Frontend model | `<Path or type>` | `<Decision>` |
| View model | `<Path or type>` | `<Decision>` |
| Fixture source | `<Path>` | `<Decision>` |
| Fixture adapter | `<Path>` | `<Decision>` |
| Screen consumer | `<Path>` | `<Decision>` |

Expected direction:

```text
fixture source
        ↓
fixture adapter
        ↓
frontend model or mapped DTO
        ↓
view model
        ↓
screen
```

Avoid:

```text
screen component
        ↓
inline hardcoded objects
```

---

## 3. Data-safety policy

Fixtures must not contain:

- real names copied from production;
- real email addresses;
- real phone numbers;
- real personal identifiers;
- real addresses;
- real customer documents;
- real credentials;
- API keys;
- tokens;
- private keys;
- signed URLs;
- real tenant IDs;
- production database IDs;
- production logs.

### Synthetic-data convention

| Data type | Convention |
|---|---|
| Person name | `<Clearly fictional naming convention>` |
| Email | `<Reserved or fictional domain convention>` |
| Phone | `<Clearly synthetic format>` |
| Tenant | `<Synthetic tenant convention>` |
| Record ID | `<Stable synthetic ID convention>` |
| Dates | `<Fixed-date convention>` |
| Currency | `<Representative but synthetic amount convention>` |
| Files | `<Repository-owned synthetic file convention>` |

### Production-data declaration

```text
containsProductionData = false
```

This value must remain false.

---

## 4. Determinism policy

| Concern | Decision |
|---|---|
| Random values | `<Prohibited or fixed-seed policy>` |
| Current time | `<Injected fixed clock>` |
| Timezone | `<Explicit timezone>` |
| Locale | `<Explicit locale>` |
| External network | `<Prohibited>` |
| External images | `<Prohibited or approved stable source>` |
| Ordering | `<Explicit stable ordering>` |
| Generated IDs | `<Stable IDs>` |
| Feature flags | `<Explicit values>` |

Recommended:

```text
Fixed clock: 2026-08-03T15:00:00-03:00
Locale: pt-BR
Timezone: America/Sao_Paulo
```

The actual values must match the product context.

---

## 5. Fixture inventory

| Fixture ID | State ID | Purpose | Source | Model | Representative |
|---|---|---|---|---|---|
| `<fixture-id>` | `<state-id>` | `<Purpose>` | `<Path>` | `<Model>` | Yes |

---

## 6. Detailed fixture contract

Duplicate this section for each fixture.

### Fixture: `<fixture-id>`

| Field | Value |
|---|---|
| Screen state | `<state-id>` |
| Source file | `<Path>` |
| Adapter | `<Path>` |
| Model | `<Frontend model or view model>` |
| Deterministic | Yes |
| Production data | No |
| Representative | `<Yes or No>` |

#### Product meaning

`<What real product condition this fixture represents.>`

#### Data authority

`<What the screen should treat as authoritative in this fixture.>`

#### Regions exercised

- `<Region>`

#### Components exercised

- `<Component usage ID>`

#### Actions exercised

- `<Action ID or none>`

#### Edge cases

- `<Long label>`
- `<Large value>`
- `<Missing optional content>`
- `<Boundary count>`
- `<Localized date>`
- `<Stale timestamp>`
- `<Permission limitation>`

#### Expected responsive behavior

- Compact: `<Behavior>`
- Constrained: `<Behavior>`
- Wide: `<Behavior>`

#### Expected accessibility behavior

- Semantics: `<Behavior>`
- Keyboard: `<Behavior>`
- Focus: `<Behavior>`
- Announcement: `<Behavior>`

#### Expected evidence

- `<Story>`
- `<Test>`
- `<Browser scenario>`
- `<Screenshot>`

---

## 7. Primary fixture

The primary fixture must prove the ordinary product task without using unrealistically ideal data.

It should include:

- realistic content volume;
- realistic label lengths;
- meaningful statuses;
- optional content variation;
- at least one boundary value;
- stable ordering;
- actionable data when the slice includes actions.

Do not make every value short and visually convenient.

---

## 8. Non-success fixture

The selected non-success fixture must prove one meaningful adverse state.

Approved examples:

- filtered empty result;
- partial secondary-region failure;
- read-only permission;
- unavailable dependency;
- stale evidence;
- recoverable mutation failure;
- upload processing;
- conflict.

The fixture must define:

- what remains usable;
- what remains visible;
- which actions remain eligible;
- how recovery works;
- what focus does;
- what is announced.

Do not use a generic exception object as the fixture contract.

---

## 9. Long-content fixture

Evaluate representative expansion.

| Content type | Representative value | Expected behavior |
|---|---|---|
| Screen title | `<Value>` | `<Wrap or constrain>` |
| Entity name | `<Value>` | `<Behavior>` |
| Status label | `<Value>` | `<Behavior>` |
| Action label | `<Value>` | `<Behavior>` |
| Error text | `<Value>` | `<Behavior>` |
| Metadata | `<Value>` | `<Behavior>` |

Do not shorten product content merely to avoid layout defects.

---

## 10. Permission fixture

When applicable:

| Capability | Fixture treatment | User-facing meaning | Backend authority |
|---|---|---|---|
| `<Capability>` | `<Allowed, read-only, disabled, hidden, forbidden>` | `<Meaning>` | Required |

Do not place raw capability keys in user-facing fixture content.

---

## 11. Temporal fixture

When dates, freshness, deadlines, or timelines are present:

| Concern | Decision |
|---|---|
| Fixed current time | `<ISO timestamp>` |
| Timezone | `<IANA timezone>` |
| Locale | `<Locale>` |
| Relative-time policy | `<Policy>` |
| Absolute-time policy | `<Policy>` |
| Stale threshold | `<Policy>` |
| DST-sensitive case | `<Case or not applicable>` |

Do not derive expected screenshots from uncontrolled current time.

---

## 12. Collection fixture

When a collection is present:

| Concern | Decision |
|---|---|
| Stable item IDs | `<Policy>` |
| Ordering | `<Policy>` |
| Page or cursor | `<Policy>` |
| Total count | `<Authoritative, unknown, or not applicable>` |
| Selection | `<Policy>` |
| Long row | `<Fixture>` |
| Missing optional value | `<Fixture>` |
| Status variation | `<Fixture>` |
| Empty result | `<Fixture>` |

Do not use array index as item identity.

---

## 13. Form fixture

When a form is present:

| Concern | Decision |
|---|---|
| Initial values | `<Policy>` |
| Dirty baseline | `<Policy>` |
| Validation errors | `<Normalized contract>` |
| Server errors | `<Normalized contract>` |
| Conflict | `<Policy>` |
| Submission success | `<Authoritative fixture behavior>` |
| Failed submission | `<Preservation behavior>` |

A failed fixture submission must not erase user-entered values.

---

## 14. Upload fixture

When upload behavior is present:

| Concern | Decision |
|---|---|
| Browser `File` construction | `<Policy>` |
| File names | `<Synthetic names>` |
| Sizes | `<Representative sizes>` |
| MIME types | `<Declared fixture types>` |
| Progress | `<Authoritative fixture progression or indeterminate>` |
| Processing | `<Policy>` |
| Rejection | `<Normalized reason>` |
| Object URL | `<Cleanup policy>` |

Do not use real uploaded customer documents.

Do not fabricate determinate progress without a controlled fixture source.

---

## 15. Fixture switching

Define how developers, stories, tests, and browser scenarios select fixtures.

| Consumer | Selection mechanism | Production isolation |
|---|---|---|
| Storybook | `<Mechanism>` | `<Isolation>` |
| Unit tests | `<Mechanism>` | `<Isolation>` |
| Browser tests | `<Mechanism>` | `<Isolation>` |
| Development route | `<Mechanism or prohibited>` | `<Isolation>` |
| Production build | `<Fixture exclusion policy>` | `<Isolation>` |

Fixtures must not be accidentally enabled in production.

---

## 16. Fixture lifecycle

| Stage | Policy |
|---|---|
| SMALL SLICE | `<Fixture use>` |
| Integration | `<Replace or retain through adapter>` |
| Production | `<Excluded, retained for stories/tests, or approved demo mode>` |
| Maintenance | `<Ownership>` |
| Deletion | `<Conditions>` |

Representative fixtures normally remain useful for:

- stories;
- component tests;
- browser tests;
- visual regression;
- documentation.

They should not remain as production data sources.

---

## 17. Fixture validation

- [ ] Fixture IDs are stable.
- [ ] Fixture state IDs match the screen specification.
- [ ] Fixture shapes match the approved model boundary.
- [ ] No fixture is declared inline inside the screen component.
- [ ] No production data is present.
- [ ] No secrets are present.
- [ ] Time is deterministic.
- [ ] Ordering is deterministic.
- [ ] Locale and timezone are explicit.
- [ ] Primary state is representative.
- [ ] Non-success state preserves truthful context.
- [ ] Long content is covered.
- [ ] Responsive expectations are recorded.
- [ ] Accessibility expectations are recorded.
- [ ] Fixture selection cannot leak into production.

---

## 18. Fixture-strategy gate

The fixture strategy passes only when:

- [ ] The model boundary is explicit.
- [ ] Fixture sources are explicit.
- [ ] The adapter boundary is explicit.
- [ ] Primary and non-success fixtures exist.
- [ ] Data is deterministic.
- [ ] Production data is absent.
- [ ] Sensitive data is absent.
- [ ] Locale, timezone, and clock are controlled when relevant.
- [ ] Edge cases are representative.
- [ ] Production isolation is explicit.
- [ ] Evidence consumers are identified.
- [ ] No unresolved fixture blocker remains.

**Gate status:** `<blocked, ready, approved, rejected>`

**Blocking issues:**

- `<Issue or none>`

**Approval evidence:**

- `<Evidence>`
