---
artifact: frontend-architecture
project: "<PROJECT_NAME>"
version: "0.1.0"
status: "draft"
language: "<pt-BR | en-US | other>"
product_context: "docs/frontend/product-context.md"
design_direction: "docs/frontend/design-direction.md"
owner: "<OWNER_OR_TEAM>"
created_at: "<YYYY-MM-DD>"
updated_at: "<YYYY-MM-DD>"
gate:
  status: "<APPROVED_FOR_FOUNDATION_IMPLEMENTATION | APPROVED_WITH_MIGRATION_LIMITATIONS | BLOCKED_BY_ARCHITECTURE_DECISIONS>"
---

# Frontend Architecture

## 1. Scope

Describe:

- the frontend scope governed by this document;
- whether the project is greenfield or existing;
- which product areas are included;
- which architectural concerns remain outside the document.

---

## 2. Evidence inspected

| ID | Source | Type | Status | Relevant implication |
|---|---|---|---|---|
| ARC-SRC-001 | `<path>` | Repository | Current | `<implication>` |
| ARC-SRC-002 | `<path>` | Specification | Approved | `<implication>` |

---

## 3. Existing architecture

### Framework and runtime

| Concern | Current implementation |
|---|---|
| Framework | `<React, etc.>` |
| Language | `<TypeScript, JavaScript>` |
| Build tool | `<Vite, other>` |
| Package manager | `<pnpm, npm, yarn>` |
| Routing | `<implementation>` |
| Styling | `<implementation>` |
| Server state | `<implementation>` |
| Client state | `<implementation>` |
| Forms | `<implementation>` |
| Validation | `<implementation>` |
| Testing | `<implementation>` |
| Storybook | `<yes/no>` |
| Browser testing | `<implementation>` |

### Existing structural map

```text
<repository structure>
```

### Existing strengths

- `<strength>`
- `<strength>`

### Existing problems

- `<problem>`
- `<problem>`

---

## 4. Architecture goals

- `<goal>`
- `<goal>`
- `<goal>`

### Non-goals

- `<non-goal>`
- `<non-goal>`

---

## 5. Technology baseline

| Capability | Decision | Reason | Existing or new |
|---|---|---|---|
| UI framework | React | `<reason>` | Existing |
| Language | TypeScript | `<reason>` | Existing |
| Build | Vite | `<reason>` | Existing |
| Styling | Tailwind CSS | `<reason>` | New |
| Component foundation | shadcn/ui | `<reason>` | New |
| Server state | TanStack Query | `<reason>` | New |
| Forms | React Hook Form | `<reason>` | New |
| Validation | Zod | `<reason>` | New |
| Routing | React Router | `<reason>` | Existing/New |
| Component workshop | Storybook | `<reason>` | New |
| Browser tests | Playwright | `<reason>` | New |

### Approved deviations

| Deviation | Reason | Impact | Review date |
|---|---|---|---|
| `<deviation>` | `<reason>` | `<impact>` | `<date>` |

---

## 6. Target structure

```text
src/
├── app/
├── routes/
├── features/
├── entities/
├── components/
├── lib/
├── styles/
├── mocks/
└── test/
```

Provide the project-specific expanded structure:

```text
<expanded structure>
```

---

## 7. Layer responsibilities

| Layer | Responsibility | May import | Must not import |
|---|---|---|---|
| app | Application composition | All lower layers | — |
| routes | Route composition | Features, entities, shared | Other routes' internals |
| features | User capabilities | Entities, shared | Routes |
| entities | Domain presentation | Shared | Features, routes |
| components | Shared presentation | Shared utilities | Product features |
| lib | Infrastructure | Other generic lib modules | Product UI |

---

## 8. Dependency rules

### Allowed direction

```text
app → routes → features → entities → shared
```

### Cross-feature policy

`<policy>`

### Public API policy

`<policy>`

### Deep-import policy

`<policy>`

### Circular-dependency detection

`<tool or method>`

---

## 9. State ownership

| State type | Examples | Owner | Persistence |
|---|---|---|---|
| Server | `<examples>` | TanStack Query | Query cache |
| URL | `<examples>` | Router/search params | Browser URL |
| Form | `<examples>` | React Hook Form | Component lifecycle |
| Local UI | `<examples>` | Component state | Component lifecycle |
| Cross-feature client | `<examples>` | `<decision>` | `<persistence>` |

### Global-store decision

**Required:** `<yes/no>`

**Library:** `<library or not applicable>`

**Justification:** `<justification>`

---

## 10. API boundary

### Transport

| Concern | Decision |
|---|---|
| HTTP client | `<decision>` |
| Base URL | `<decision>` |
| Authentication | `<decision>` |
| Timeout | `<decision>` |
| Cancellation | `<decision>` |
| Serialization | `<decision>` |
| Correlation ID | `<decision>` |
| Retry eligibility | `<decision>` |

### Data flow

```text
HTTP
  ↓
DTO
  ↓
validation/normalization
  ↓
frontend model
  ↓
view model/formatter
  ↓
component
```

### Generated-client policy

`<policy>`

### Runtime-validation policy

`<policy>`

### Date-storage policy

`<ISO strings, Date objects, Temporal, other>`

---

## 11. Error architecture

| Error category | Detection | User behavior | Logging | Retry |
|---|---|---|---|---|
| Validation | `<method>` | `<behavior>` | `<behavior>` | No |
| Unauthorized | `<method>` | `<behavior>` | `<behavior>` | Session-dependent |
| Forbidden | `<method>` | `<behavior>` | `<behavior>` | No |
| Conflict | `<method>` | `<behavior>` | `<behavior>` | Manual |
| Rate limit | `<method>` | `<behavior>` | `<behavior>` | Delayed |
| Network | `<method>` | `<behavior>` | `<behavior>` | Conditional |
| Unknown | `<method>` | `<behavior>` | `<behavior>` | Conditional |

### User-facing error policy

`<policy>`

### Technical-detail policy

`<policy>`

### Error-boundary policy

`<policy>`

---

## 12. Query architecture

### Query-key convention

```ts
<query-key factory example>
```

### Default query behavior

| Setting | Decision |
|---|---|
| `staleTime` | `<decision>` |
| Garbage collection | `<decision>` |
| Refetch on focus | `<decision>` |
| Retry | `<decision>` |
| Network mode | `<decision>` |

### Feature ownership

`<policy>`

### Cancellation policy

`<policy>`

### Background-refresh policy

`<policy>`

---

## 13. Mutation architecture

| Concern | Decision |
|---|---|
| Pending feedback | `<decision>` |
| Success feedback | `<decision>` |
| Error feedback | `<decision>` |
| Invalidation | `<decision>` |
| Optimistic updates | `<policy>` |
| Conflict handling | `<policy>` |
| Duplicate submission | `<policy>` |
| Idempotency | `<policy>` |
| Cancellation | `<policy>` |

---

## 14. Routing

| Concern | Decision |
|---|---|
| Route declarations | `<location>` |
| Route path constants | `<location>` |
| Nested layouts | `<policy>` |
| Authentication guards | `<policy>` |
| Permission guards | `<policy>` |
| Not found | `<policy>` |
| Error boundaries | `<policy>` |
| Lazy loading | `<policy>` |
| Page titles | `<policy>` |
| Breadcrumbs | `<policy>` |
| Search parameters | `<policy>` |
| Focus after navigation | `<policy>` |

---

## 15. Authentication

| Concern | Decision |
|---|---|
| Session source | `<decision>` |
| Token handling | `<decision>` |
| Refresh | `<decision>` |
| Logout | `<decision>` |
| Expired session | `<decision>` |
| Current user | `<decision>` |
| Tenant/organization context | `<decision>` |

---

## 16. Permissions

### Capability model

```ts
<capability model>
```

### Frontend behavior

| Missing capability | Behavior |
|---|---|
| Hidden action | `<criteria>` |
| Disabled action | `<criteria>` |
| Read-only content | `<criteria>` |
| Forbidden route | `<criteria>` |

---

## 17. Formatting and localization

| Concern | Decision |
|---|---|
| Locale | `<locale>` |
| Time zone | `<policy>` |
| Dates | `<format>` |
| Date and time | `<format>` |
| Currency | `<format>` |
| Numbers | `<format>` |
| Missing value | `<label>` |
| Not applicable | `<label>` |
| Not calculated | `<label>` |
| Restricted value | `<label>` |

---

## 18. Environment configuration

### Allowed public variables

| Variable | Purpose | Validation |
|---|---|---|
| `<variable>` | `<purpose>` | `<validation>` |

### Secret-handling rule

`<rule>`

---

## 19. Performance architecture

| Concern | Policy |
|---|---|
| Route splitting | `<policy>` |
| Bundle analysis | `<policy>` |
| Table virtualization | `<policy>` |
| Expensive calculations | `<policy>` |
| Image handling | `<policy>` |
| Query cancellation | `<policy>` |
| Memoization | `<policy>` |
| Performance monitoring | `<policy>` |

---

## 20. Accessibility architecture

| Concern | Policy |
|---|---|
| Route headings | `<policy>` |
| Focus after navigation | `<policy>` |
| Dialog focus trapping | `<policy>` |
| Route-change announcements | `<policy>` |
| Shared feedback semantics | `<policy>` |
| Reduced motion | `<policy>` |
| Error-boundary accessibility | `<policy>` |
| Keyboard interaction | `<policy>` |

---

## 21. Testing architecture

| Test level | Tool | Scope |
|---|---|---|
| Unit | `<tool>` | Formatters, mapping, validation |
| Component | `<tool>` | Shared and feature components |
| Storybook | Storybook | Visual states |
| Integration | `<tool>` | Feature workflows |
| Browser | Playwright | Routes and interactions |
| Visual | Playwright | Screenshot comparisons |
| Accessibility | `<tool>` | WCAG checks |

### Provider test harness

`<location and behavior>`

### Fixture policy

`<location, safety and realism requirements>`

---

## 22. Migration plan

Complete for existing projects.

| Phase | Scope | Risk | Compatibility strategy | Validation |
|---|---|---|---|---|
| MIG-001 | `<scope>` | `<risk>` | `<strategy>` | `<validation>` |

### Temporary deviations

| Deviation | Reason | Removal condition |
|---|---|---|
| `<deviation>` | `<reason>` | `<condition>` |

---

## 23. Architecture decisions

| ADR | Decision | Status | Artifact |
|---|---|---|---|
| ADR-001 | `<decision>` | Proposed | `docs/adr/ADR-001-....md` |

---

## 24. Architecture acceptance checklist

- [ ] Project structure is explicit.
- [ ] Layer ownership is explicit.
- [ ] Dependency direction is explicit.
- [ ] Cross-feature imports are controlled.
- [ ] Server-state ownership is explicit.
- [ ] URL-state ownership is explicit.
- [ ] Form-state ownership is explicit.
- [ ] Global-state need is justified.
- [ ] API transport is isolated.
- [ ] DTO mapping policy is defined.
- [ ] Error normalization is defined.
- [ ] Query-key convention is defined.
- [ ] Mutation invalidation is defined.
- [ ] Routing and guards are defined.
- [ ] Authentication integration is defined.
- [ ] Permission behavior is defined.
- [ ] Formatting is centralized.
- [ ] Environment variables are validated.
- [ ] Performance boundaries are defined.
- [ ] Accessibility responsibilities are defined.
- [ ] Test architecture is defined.
- [ ] Migration does not require a big-bang rewrite.

---

## 25. Architecture gate

**Status:**
`<APPROVED_FOR_FOUNDATION_IMPLEMENTATION | APPROVED_WITH_MIGRATION_LIMITATIONS | BLOCKED_BY_ARCHITECTURE_DECISIONS>`

**Rationale:**
`<rationale>`

**Approved by:**
`<name or role>`

**Approval date:**
`<YYYY-MM-DD>`
