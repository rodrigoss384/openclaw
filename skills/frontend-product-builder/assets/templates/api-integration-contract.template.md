---
artifact: frontend-api-integration-contract
project: "<PROJECT_NAME>"
feature: "<FEATURE_NAME>"
version: "0.1.0"
status: "draft"
language: "<pt-BR | en-US | other>"
frontend_architecture: "docs/frontend/frontend-architecture.md"
owner: "<OWNER_OR_TEAM>"
created_at: "<YYYY-MM-DD>"
updated_at: "<YYYY-MM-DD>"
gate:
  status: "<APPROVED_FOR_SCREEN_INTEGRATION | APPROVED_WITH_DATA_LIMITATIONS | BLOCKED_BY_API_CONTRACT>"
---

# API Integration Contract — `<FEATURE_NAME>`

## 1. Purpose

Describe:

- the user capability;
- the frontend slice;
- the backend integration;
- which screens and components consume this contract.

---

## 2. Product context

| Concern | Definition |
|---|---|
| Primary actor | `<actor>` |
| Primary job | `<job>` |
| Screen | `<screen ID and name>` |
| Primary action | `<action>` |
| Operational criticality | `<low, medium, high, critical>` |
| Data sensitivity | `<classification>` |
| Tenant or organization scope | `<scope>` |

---

## 3. Sources

| ID | Source | Type | Status | Authority |
|---|---|---|---|---|
| API-SRC-001 | `<OpenAPI path, spec, code>` | API contract | Approved | High |

---

## 4. Endpoints

### API-001 — `<Capability>`

| Attribute | Definition |
|---|---|
| Method | `<GET, POST, PATCH, DELETE>` |
| Path | `<path>` |
| Purpose | `<purpose>` |
| Authentication | `<requirement>` |
| Capability | `<permission capability>` |
| Tenant context | `<header, path, session, none>` |
| Idempotent | `<yes/no/conditional>` |
| Retry safe | `<yes/no/conditional>` |
| Cancellation useful | `<yes/no>` |
| Audit relevant | `<yes/no>` |

Repeat for each endpoint.

---

## 5. Request contract

### Path parameters

| Name | Type | Required | Validation | Example |
|---|---|---|---|---|
| `<name>` | `<type>` | Yes | `<validation>` | `<example>` |

### Query parameters

| Name | Type | Required | Default | Validation | URL ownership |
|---|---|---|---|---|---|
| `<name>` | `<type>` | No | `<default>` | `<validation>` | Yes |

### Headers

| Header | Source | Required | Notes |
|---|---|---|---|
| `<header>` | `<source>` | Yes | `<notes>` |

### Request body

```ts
type RequestDto = {
  // approved transport shape
};
```

### Frontend input

```ts
type FeatureInput = {
  // user-oriented input
};
```

### Input mapping

```ts
function toRequestDto(
  input: FeatureInput,
): RequestDto {
  // mapping
}
```

---

## 6. Response contract

### Transport DTO

```ts
type ResponseDto = {
  // approved transport shape
};
```

### Frontend model

```ts
type FeatureModel = {
  // normalized frontend shape
};
```

### Mapping

```ts
function mapResponseDto(
  dto: ResponseDto,
): FeatureModel {
  // mapping
}
```

### Mapping decisions

| API field | Frontend field | Transformation | Reason |
|---|---|---|---|
| `<field>` | `<field>` | `<transformation>` | `<reason>` |

---

## 7. Runtime validation

**Required:** `<yes/no/partial>`

**Library:** `<Zod or other>`

**Reason:** `<reason>`

```ts
const responseSchema = z.object({
  // schema
});
```

### Invalid-response behavior

`<behavior>`

---

## 8. Query ownership

| Query | Owner | Consumer |
|---|---|---|
| `<query>` | `<feature/entity>` | `<screen/component>` |

### Query keys

```ts
export const featureKeys = {
  all: ["<resource>"] as const,

  lists: () =>
    [...featureKeys.all, "list"] as const,

  list: (filters: FeatureFilters) =>
    [
      ...featureKeys.lists(),
      normalizeFilters(filters),
    ] as const,

  details: () =>
    [...featureKeys.all, "detail"] as const,

  detail: (id: string) =>
    [...featureKeys.details(), id] as const,
};
```

### Key parameters

| Parameter | Included in key | Normalization |
|---|---|---|
| Tenant/organization | `<yes/no>` | `<normalization>` |
| Search | Yes | Trimmed |
| Page | Yes | Positive integer |
| Sort | Yes | Approved enum |
| Filters | Yes | Stable sorted representation |

---

## 9. Query behavior

| Setting | Decision | Reason |
|---|---|---|
| `staleTime` | `<value>` | `<reason>` |
| Garbage collection | `<value>` | `<reason>` |
| Retry | `<policy>` | `<reason>` |
| Refetch on focus | `<policy>` | `<reason>` |
| Polling | `<policy>` | `<reason>` |
| Placeholder data | `<policy>` | `<reason>` |
| Keep previous data | `<policy>` | `<reason>` |
| Cancellation | `<policy>` | `<reason>` |
| Background refresh | `<policy>` | `<reason>` |

---

## 10. Pagination, sorting, and filtering

### Pagination model

`<page, offset, cursor, infinite, none>`

### URL contract

```text
<example URL>
```

### Filter schema

```ts
const filterSchema = z.object({
  // filter parsing
});
```

### Defaults

| Parameter | Default |
|---|---|
| Page | 1 |
| Page size | 25 |
| Sort | `<sort>` |

### Sorting ownership

`<server/client/not applicable>`

### Reset behavior

Describe when page, selection, or sorting resets.

### Clear-all behavior

`<behavior>`

---

## 11. Mutation contract

### Mutation input

```ts
type MutationInput = {
  // input
};
```

### Preconditions

- `<precondition>`
- `<precondition>`

### Idempotency

`<behavior>`

### Retry safety

`<behavior>`

### Pending behavior

- `<button or section behavior>`
- `<duplicate prevention>`
- `<cancellation behavior>`

### Success behavior

- `<feedback>`
- `<navigation>`
- `<form reset or preservation>`
- `<dialog behavior>`

### Failure behavior

- `<field errors>`
- `<form alert>`
- `<retry>`
- `<preserve user input>`

### Conflict behavior

`<behavior>`

---

## 12. Cache strategy

### After successful mutation

| Query scope | Strategy | Reason |
|---|---|---|
| Detail | `<invalidate/set data/remove>` | `<reason>` |
| Lists | `<invalidate/set data/remove>` | `<reason>` |
| Dashboard | `<invalidate/set data/remove>` | `<reason>` |
| Permissions | `<invalidate/set data/remove>` | `<reason>` |

### Optimistic update

**Used:** `<yes/no>`

**Justification:** `<reason>`

### Rollback

```ts
<rollback strategy or not applicable>
```

### Tenant or organization isolation

`<policy>`

---

## 13. Error model

| Error category | Detection | User message | Recovery | Log detail |
|---|---|---|---|---|
| Validation | `<detection>` | `<message>` | Correct fields | `<detail>` |
| Unauthorized | `<detection>` | `<message>` | Renew session | `<detail>` |
| Forbidden | `<detection>` | `<message>` | Return/read-only | `<detail>` |
| Not found | `<detection>` | `<message>` | Return/search | `<detail>` |
| Conflict | `<detection>` | `<message>` | Reload/compare | `<detail>` |
| Rate limit | `<detection>` | `<message>` | Retry later | `<detail>` |
| Network | `<detection>` | `<message>` | Retry | `<detail>` |
| Unknown | `<detection>` | `<message>` | Support path | `<detail>` |

### Correlation-identifier policy

`<policy>`

### Technical-detail policy

`<policy>`

---

## 14. Form contract

Complete when the feature contains a form.

### Form type

`<create | edit | filter | review | wizard | other>`

### Form values

```ts
type FormValues = {
  // form-oriented values
};
```

### Validation schema

```ts
const formSchema = z.object({
  // rules
});
```

### Field contract

| Field | Label | Required | Input type | Validation | Help text | Server error |
|---|---|---|---|---|---|---|
| `<field>` | `<label>` | Yes | `<type>` | `<rule>` | `<text>` | `<mapping>` |

### Initialization

`<behavior>`

### Dirty-state behavior

`<behavior>`

### Conditional-field behavior

`<behavior>`

### Submission behavior

`<behavior>`

### First-invalid-field behavior

`<behavior>`

### Navigation-interruption behavior

`<behavior>`

---

## 15. Data semantics

### Dates

| Field | API representation | Semantic type | Display format | Time zone |
|---|---|---|---|---|
| `<field>` | `<ISO/date-only>` | `<instant/date-only>` | `<format>` | `<zone>` |

### Currency and decimals

| Field | API representation | Precision | Display | Calculation owner |
|---|---|---|---|---|
| `<field>` | `<minor units/string>` | `<precision>` | `<format>` | Backend |

### Enums

| API value | Frontend value | User label | Tone | Unknown fallback |
|---|---|---|---|---|
| `<value>` | `<value>` | `<label>` | `<tone>` | `<fallback>` |

### Missing-value semantics

| Condition | Presentation |
|---|---|
| Zero | `<presentation>` |
| Unknown | `<presentation>` |
| Not informed | `<presentation>` |
| Not applicable | `<presentation>` |
| Not calculated | `<presentation>` |
| Restricted | `<presentation>` |

---

## 16. File-upload contract

Complete when applicable.

| Concern | Decision |
|---|---|
| Accepted MIME types | `<types>` |
| Accepted extensions | `<extensions>` |
| Maximum size | `<size>` |
| Maximum count | `<count>` |
| Duplicate policy | `<policy>` |
| Progress | `<policy>` |
| Cancellation | `<policy>` |
| Retry | `<policy>` |
| Processing state | `<policy>` |
| Security scan | `<policy>` |
| Partial failure | `<policy>` |
| Removal | `<policy>` |

---

## 17. Frontend state matrix

### Query states

| State | UI behavior | User action |
|---|---|---|
| Initial loading | `<behavior>` | Wait |
| Refreshing | `<behavior>` | Continue |
| Data | `<behavior>` | `<action>` |
| Empty | `<behavior>` | `<action>` |
| Warning | `<behavior>` | `<action>` |
| Error | `<behavior>` | Retry |
| Unauthorized | `<behavior>` | Reauthenticate |
| Forbidden | `<behavior>` | Return |
| Stale | `<behavior>` | Refresh/review |
| Unavailable | `<behavior>` | Retry later |

### Mutation states

| State | UI behavior | User action |
|---|---|---|
| Default | `<behavior>` | Submit |
| Invalid | `<behavior>` | Correct fields |
| Pending | `<behavior>` | Wait/cancel |
| Success | `<behavior>` | Continue |
| Conflict | `<behavior>` | Reload/review |
| Failure | `<behavior>` | Retry/correct |

---

## 18. Permissions

| Capability | Required | Missing-capability behavior |
|---|---|---|
| `<capability>` | Yes | `<hide/disable/read-only/forbidden>` |

The backend remains authoritative.

---

## 19. Security and privacy

- Sensitive fields: `<fields>`
- Masking: `<policy>`
- Logging restrictions: `<policy>`
- Browser-storage restrictions: `<policy>`
- Query-cache restrictions: `<policy>`
- Tenant-isolation requirements: `<policy>`
- Export restrictions: `<policy>`
- Audit requirements: `<policy>`

---

## 20. Accessibility

- [ ] Fields have visible labels.
- [ ] Errors are programmatically associated.
- [ ] Pending state is announced where appropriate.
- [ ] Keyboard submission works.
- [ ] Focus moves appropriately after errors.
- [ ] Loading and empty states have meaningful text.
- [ ] Upload controls have non-drag alternatives.
- [ ] Status is not communicated through color alone.
- [ ] Conditional fields preserve predictable focus order.
- [ ] Pagination and sorting controls have accessible names.

---

## 21. Test plan

### Unit

- `<mapping test>`
- `<formatter test>`
- `<schema test>`
- `<query-key test>`
- `<URL-parameter parsing test>`

### Component

- `<loading>`
- `<data>`
- `<empty>`
- `<error>`
- `<permission>`
- `<long content>`
- `<background refresh>`

### Mutation

- `<pending>`
- `<success>`
- `<server validation>`
- `<conflict>`
- `<cache update>`
- `<duplicate prevention>`
- `<retry eligibility>`
- `<rollback when applicable>`

### Browser

- `<route>`
- `<interaction>`
- `<viewport>`
- `<network behavior>`
- `<tenant-context behavior>`
- `<keyboard behavior>`

---

## 22. Open questions

| ID | Question | Impact | Owner | Status |
|---|---|---|---|---|
| API-DEC-001 | `<question>` | High | `<owner>` | Open |

---

## 23. Integration checklist

- [ ] Endpoint behavior is confirmed.
- [ ] Authentication and permissions are confirmed.
- [ ] Tenant or organization scope is confirmed.
- [ ] Request and response types are explicit.
- [ ] Mapping is explicit.
- [ ] Query keys are stable.
- [ ] Request-shaping parameters are included in keys.
- [ ] Pagination, sorting, and filters are explicit.
- [ ] Retry and idempotency are explicit.
- [ ] Mutation cache impact is explicit.
- [ ] Error categories are mapped.
- [ ] Form validation is explicit.
- [ ] Server errors preserve user input.
- [ ] Date and financial semantics are confirmed.
- [ ] Loading, empty, error, stale, and permission states are defined.
- [ ] Cache isolation is defined.
- [ ] Tests cover non-ideal behavior.
- [ ] Browser validation is planned.

---

## 24. Integration gate

**Status:**
`<APPROVED_FOR_SCREEN_INTEGRATION | APPROVED_WITH_DATA_LIMITATIONS | BLOCKED_BY_API_CONTRACT>`

**Rationale:**
`<rationale>`

**Approved by:**
`<name or role>`

**Approval date:**
`<YYYY-MM-DD>`
