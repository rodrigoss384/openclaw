---
artifact: frontend-product-context
project: "<PROJECT_NAME>"
version: "0.1.0"
status: "draft"
language: "<pt-BR | en-US | other>"
owner: "<OWNER_OR_TEAM>"
created_at: "<YYYY-MM-DD>"
updated_at: "<YYYY-MM-DD>"
sources_status:
  approved: 0
  draft: 0
  inferred: 0
gate:
  status: "<APPROVED_FOR_DESIGN_DIRECTION | APPROVED_WITH_ASSUMPTIONS | BLOCKED_BY_PRODUCT_DECISIONS>"
---

# Frontend Product Context

## 1. Document purpose

Describe why this document exists, which frontend scope it covers, and which
decisions it does not replace.

---

## 2. Evidence inventory

| ID | Source | Type | Status | Authority | Relevant content | Conflict or risk |
|---|---|---|---|---|---|---|
| SRC-001 | `<path or URL>` | Specification | Approved | High | `<summary>` | None |

Status values:

- Approved
- Draft
- Inferred
- Deprecated
- Unknown

---

## 3. Product definition

### Product category

`<Example: operational legal B2B application>`

### Dominant interaction mode

Choose and justify:

- task-oriented;
- data-oriented;
- decision-oriented;
- monitoring-oriented;
- content-oriented;
- transaction-oriented.

### Product purpose

`<One precise paragraph>`

### User value

`<What operational outcome the product improves>`

### Explicit non-goals

- `<Non-goal 1>`
- `<Non-goal 2>`

---

## 4. Actors and roles

### ACT-001 — `<Role name>`

| Attribute | Definition |
|---|---|
| Domain knowledge | `<low, medium, high + explanation>` |
| Technical knowledge | `<low, medium, high + explanation>` |
| Usage frequency | `<daily, weekly, occasional>` |
| Usage environment | `<desktop office, field tablet, mobile, etc.>` |
| Primary objective | `<objective>` |
| Critical decisions | `<decisions>` |
| Sensitive actions | `<actions>` |
| Information restrictions | `<restrictions>` |
| Accessibility considerations | `<known considerations or unknown>` |

Repeat for each role.

---

## 5. Jobs-to-be-done

| ID | Actor | Job | Trigger | Frequency | Urgency | Desired outcome | Failure consequence |
|---|---|---|---|---:|---|---|---|
| JOB-001 | ACT-001 | `<job>` | `<trigger>` | Daily | Critical | `<outcome>` | `<consequence>` |

### Priority interpretation

Explain which jobs require the fastest access and why.

---

## 6. Primary journeys

### JRN-001 — `<Journey name>`

**Actor:** ACT-001
**Trigger:** `<trigger>`
**Desired outcome:** `<outcome>` 
**Expected frequency:** `<frequency>`

| Step | User goal | Required information | User action | System feedback | Exceptions |
|---:|---|---|---|---|---|
| 1 | `<goal>` | `<information>` | `<action>` | `<feedback>` | `<exception>` |

**Completion evidence:** `<what confirms success>`

**Likely next task:** `<next task>`

Repeat for each primary journey.

---

## 7. Information architecture

| Area ID | Product area | User purpose | Main roles | Frequency | Sensitivity | Child areas |
|---|---|---|---|---:|---|---|
| AREA-001 | `<area>` | `<purpose>` | ACT-001 | Daily | High | `<children>` |

### Navigation rationale

Explain why areas are grouped by user intent rather than implementation
structure.

### Cross-area navigation

Document important transitions between areas.

---

## 8. Screen inventory

| Screen ID | Screen | Route concept | Area | Primary actor | Primary task | Primary action | Recipe candidate | Density | Status |
|---|---|---|---|---|---|---|---|---|---|
| SCR-001 | `<screen>` | `/example` | AREA-001 | ACT-001 | JOB-001 | `<action>` | searchable-list | High | Planned |

Status values:

- Proposed
- Planned
- Approved
- Implemented
- Deprecated

This inventory does not authorize implementation by itself.

---

## 9. Content hierarchy

### SCR-001 — `<Screen name>`

| Level | Content | Why it belongs at this level |
|---|---|---|
| 1 — Orientation | `<content>` | `<reason>` |
| 2 — Decision | `<content>` | `<reason>` |
| 3 — Action support | `<content>` | `<reason>` |
| 4 — Context | `<content>` | `<reason>` |
| 5 — Audit/technical | `<content>` | `<reason>` |

Repeat for important screens.

---

## 10. Domain terminology

| ID | Internal value | User-facing label | Definition | Allowed abbreviation | Prohibited label | Notes |
|---|---|---|---|---|---|---|
| TERM-001 | `example_internal` | `<label>` | `<definition>` | `<abbr or none>` | `<prohibited>` | `<notes>` |

### Language rules

- Product language: `<language>`
- Tone: `<operational, institutional, conversational, etc.>`
- Technical terminology policy: `<policy>`
- Capitalization rules: `<rules>`
- Abbreviation rules: `<rules>`

---

## 11. Data-formatting rules

| Data type | User-facing format | Empty | Unknown | Not applicable | Example |
|---|---|---|---|---|---|
| Date | `dd/MM/yyyy` | `<label>` | `<label>` | `<label>` | `30/07/2026` |
| Date and time | `<format>` | `<label>` | `<label>` | `<label>` | `<example>` |
| Currency | `<format>` | `<label>` | `<label>` | `<label>` | `<example>` |
| Percentage | `<format>` | `<label>` | `<label>` | `<label>` | `<example>` |

### Time-zone policy

`<policy>`

### Identifier policy

Explain which identifiers are shown, masked, shortened, or hidden.

---

## 12. Data characteristics

| Data ID | Data | Minimum | Typical | High | Max realistic length | Optional | Layout consequence |
|---|---|---:|---:|---:|---:|---|---|
| DATA-001 | `<data>` | 0 | 20 | 2,000 | 120 chars | Yes | `<consequence>` |

### Sorting and filtering

| Collection | Default sort | Search fields | Filters | Pagination | Freshness |
|---|---|---|---|---|---|
| `<collection>` | `<sort>` | `<fields>` | `<filters>` | `<strategy>` | `<requirement>` |

---

## 13. Action model

| Action ID | Action | Screen | Classification | Roles | Prerequisite | Confirmation | Undo | Audit |
|---|---|---|---|---|---|---|---|---|
| ACTN-001 | `<action>` | SCR-001 | Primary | ACT-001 | `<condition>` | No | No | Yes |

Classification values:

- Primary
- Secondary
- Tertiary
- Contextual
- Destructive
- Irreversible
- Bulk
- Automated suggestion
- Human confirmation

### Action feedback

| Action ID | Pending behavior | Success feedback | Failure recovery | Conflict handling |
|---|---|---|---|---|
| ACTN-001 | `<behavior>` | `<feedback>` | `<recovery>` | `<handling>` |

---

## 14. Permissions matrix

| Capability | ACT-001 | ACT-002 | No access behavior | Notes |
|---|---|---|---|---|
| View item | View | View | Hide | `<notes>` |
| Edit item | Edit | Read-only | Disable with explanation | `<notes>` |
| Delete item | No | Delete | Hide | `<notes>` |

Allowed values:

- View
- Create
- Edit
- Approve
- Delete
- Export
- Administer
- Read-only
- No access

---

## 15. State matrix

### Query states

| Scope | Initial loading | Refreshing | Success | Empty | Warning | Error | Unauthorized | Forbidden |
|---|---|---|---|---|---|---|---|---|
| SCR-001 | `<behavior>` | `<behavior>` | `<behavior>` | `<behavior>` | `<behavior>` | `<behavior>` | `<behavior>` | `<behavior>` |

### Mutation states

| Action | Invalid | Pending | Success | Conflict | Failure | Retry | Cancel |
|---|---|---|---|---|---|---|---|
| ACTN-001 | `<behavior>` | `<behavior>` | `<behavior>` | `<behavior>` | `<behavior>` | `<behavior>` | `<behavior>` |

---

## 16. Fixture catalog

| Fixture ID | Purpose | Description | Expected screens/components |
|---|---|---|---|
| FIX-001 | Typical | `<description>` | `<scope>` |
| FIX-002 | Empty | `<description>` | `<scope>` |
| FIX-003 | Long content | `<description>` | `<scope>` |
| FIX-004 | High density | `<description>` | `<scope>` |
| FIX-005 | Warning | `<description>` | `<scope>` |
| FIX-006 | Error | `<description>` | `<scope>` |
| FIX-007 | Restricted permission | `<description>` | `<scope>` |

### Fixture safety

Confirm that fixtures contain no real confidential or personally identifying
information.

---

## 17. Constraints

| Constraint ID | Category | Constraint | Evidence | Status | Frontend implication |
|---|---|---|---|---|---|
| CON-001 | Browser | `<constraint>` | SRC-001 | Verified | `<implication>` |

Categories may include:

- browser;
- viewport;
- localization;
- accessibility;
- latency;
- performance;
- security;
- regulatory;
- audit;
- integration;
- device;
- offline.

---

## 18. Risks

| Risk ID | Risk | Probability | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| RSK-001 | `<risk>` | Medium | High | `<mitigation>` | `<owner>` |

---

## 19. Assumptions

| Assumption ID | Assumption | Impact | Reason | Validation method | Status |
|---|---|---|---|---|---|
| ASM-001 | `<assumption>` | Low | `<reason>` | `<method>` | Open |

Impact values:

- Low
- Medium
- High

High-impact assumptions must not remain unresolved at the design-direction gate.

---

## 20. Open decisions

| Decision ID | Question | Impact | Options | Recommended option | Owner | Deadline |
|---|---|---|---|---|---|---|
| DEC-001 | `<question>` | High | `<options>` | `<recommendation>` | `<owner>` | `<date>` |

---

## 21. Frontend acceptance implications

- [ ] Primary users and jobs are explicit.
- [ ] Critical workflows are documented.
- [ ] Screen inventory is derived from tasks.
- [ ] Content hierarchy is defined.
- [ ] Domain language is normalized.
- [ ] Data formats are defined.
- [ ] Realistic data magnitude is recorded.
- [ ] Action hierarchy is defined.
- [ ] Permissions have frontend behavior.
- [ ] Query and mutation states are documented.
- [ ] Fixtures cover non-ideal content.
- [ ] Constraints and risks are visible.
- [ ] No unresolved high-impact assumption remains.

---

## 22. Discovery gate

**Status:**
`<APPROVED_FOR_DESIGN_DIRECTION | APPROVED_WITH_ASSUMPTIONS | BLOCKED_BY_PRODUCT_DECISIONS>`

**Rationale:**
`<rationale>`

**Approved by:**
`<name or role>`

**Approval date:**
`<YYYY-MM-DD>`
