# Frontend Architecture

## Purpose

Define a predictable frontend architecture for production React applications.

The architecture must support:

- coherent visual implementation;
- feature isolation;
- reusable components;
- clear data ownership;
- safe API integration;
- independent testing;
- incremental development;
- accessibility;
- maintainability;
- responsive behavior;
- controlled agent-generated changes.

This reference prevents the agent from placing components, queries, schemas,
formatters, and business logic wherever they are convenient during one task.

---

# Required output

Use:

`assets/templates/frontend-architecture.template.md`

Create the project artifact at:

`docs/frontend/frontend-architecture.md`

If the repository already contains an approved architecture document, inspect
and extend it instead of creating a competing architecture.

Do not silently replace an established project structure.

---

# Architecture principles

## 1. Organize around user capabilities

The main organizational unit is a feature or user capability.

Examples:

- authentication;
- case search;
- deadline review;
- document upload;
- tenant administration;
- billing configuration;
- user invitation;
- report export.

Avoid organizing the entire application only by technical file type.

Weak structure:

```text
src/
├── components/
├── hooks/
├── services/
├── utils/
└── pages/
```

This structure becomes difficult to navigate as the application grows because
unrelated business capabilities are mixed inside generic directories.

Preferred structure:

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

Technical subdirectories may exist inside each feature.

---

## 2. Separate composition from implementation

A route or screen composes capabilities.

A route should not contain:

- raw HTTP requests;
- large validation schemas;
- complex data transformation;
- domain calculations;
- reusable interaction logic;
- repeated visual primitives.

A feature implements one user capability.

A shared component implements reusable presentation or interaction behavior.

A page is not a dumping ground for all code required by a route.

---

## 3. Establish explicit ownership

Every important concern must have one primary owner.

Examples:

| Concern | Primary owner |
|---|---|
| Route composition | `routes/` |
| Application providers | `app/` |
| User capability | `features/` |
| Domain entity presentation | `entities/` |
| Shared primitives | `components/ui/` |
| Shared layouts | `components/layout/` |
| Cross-product feedback | `components/feedback/` |
| HTTP client | `lib/api/` |
| Query infrastructure | `lib/query/` |
| Formatting | `lib/format/` |
| Design tokens | `styles/` |
| Test utilities | `test/` |
| Non-production fixtures | `mocks/` |

Do not create several competing owners for the same concern.

---

# Default project structure

For a greenfield application, use this baseline:

```text
src/
├── app/
│   ├── App.tsx
│   ├── providers/
│   │   ├── AppProviders.tsx
│   │   ├── QueryProvider.tsx
│   │   ├── RouterProvider.tsx
│   │   └── ThemeProvider.tsx
│   ├── router/
│   │   ├── routes.tsx
│   │   ├── route-paths.ts
│   │   └── route-guards.tsx
│   └── config/
│       ├── env.ts
│       └── runtime-config.ts
│
├── routes/
│   ├── authentication/
│   ├── dashboard/
│   ├── cases/
│   ├── administration/
│   └── errors/
│
├── features/
│   ├── auth/
│   ├── case-search/
│   ├── case-status-update/
│   ├── deadline-review/
│   ├── document-upload/
│   └── tenant-management/
│
├── entities/
│   ├── user/
│   ├── case/
│   ├── deadline/
│   ├── document/
│   └── tenant/
│
├── components/
│   ├── ui/
│   ├── layout/
│   ├── feedback/
│   ├── navigation/
│   └── data-display/
│
├── lib/
│   ├── api/
│   ├── query/
│   ├── auth/
│   ├── permissions/
│   ├── format/
│   ├── validation/
│   ├── errors/
│   ├── telemetry/
│   └── utilities/
│
├── styles/
│   ├── globals.css
│   ├── tokens.css
│   └── typography.css
│
├── mocks/
│   ├── handlers/
│   ├── fixtures/
│   └── browser.ts
│
├── test/
│   ├── render.tsx
│   ├── factories/
│   ├── matchers/
│   └── setup.ts
│
└── main.tsx
```

Adjust names to the product language and existing project conventions.

Do not create empty directories preemptively when they have no planned use.

---

# Layer responsibilities

## `app/`

Owns application-wide composition.

Responsibilities:

- provider composition;
- routing configuration;
- runtime configuration;
- global error boundaries;
- query client;
- theme provider;
- authentication bootstrap;
- telemetry bootstrap;
- application-level guards.

Must not contain feature-specific visual implementations.

---

## `routes/`

Owns route-level composition.

Responsibilities:

- route components;
- route loaders where applicable;
- route boundaries;
- route-level layout selection;
- page metadata;
- composition of features and entities;
- route-specific permission handling.

Routes should remain relatively thin.

A route may coordinate several features but should not reimplement them.

---

## `features/`

Owns user capabilities.

A feature may contain:

```text
features/<feature-name>/
├── api/
├── components/
├── hooks/
├── model/
├── schemas/
├── tests/
├── stories/
└── index.ts
```

Not every feature requires every directory.

Create only what is necessary.

A feature may own:

- commands and mutations;
- capability-specific queries;
- form orchestration;
- feature-specific components;
- feature-specific permissions;
- feature-specific schemas;
- user interaction logic.

Examples:

```text
features/case-status-update/
features/document-upload/
features/deadline-review/
```

Avoid feature names based only on backend entities.

Prefer the user capability:

```text
deadline-review
```

over the generic:

```text
deadline
```

when the module implements a specific workflow.

---

## `entities/`

Owns domain entity presentation and reusable entity behavior.

An entity module may contain:

```text
entities/case/
├── api/
├── components/
├── formatters/
├── model/
├── schemas/
└── index.ts
```

Possible responsibilities:

- entity types used by the frontend;
- entity display components;
- entity labels;
- status mapping;
- formatting;
- reusable entity summaries;
- lightweight selectors.

Entities must not own route composition.

Entities must not directly depend on features.

---

## `components/ui/`

Owns low-level visual primitives.

Examples:

- Button;
- Input;
- Select;
- Checkbox;
- Textarea;
- Dialog;
- DropdownMenu;
- Popover;
- Tooltip;
- Tabs;
- Badge;
- Skeleton;
- Separator.

These components must not know product-specific domain concepts.

Invalid primitive:

```tsx
<ApproveLegalDeadlineButton />
```

Valid primitive:

```tsx
<Button variant="primary" />
```

The legal action belongs in a feature component.

### Product/tenant brand

The product's brand mark (logo, wordmark, tenant-specific visual treatment
of the name) is owned by one isolated, presentational component consumed by
the shell and by access/authentication surfaces. Do not inline brand markup
ad hoc inside `AppShell`, the sidebar, or the topbar — a rebrand or
white-label customization must remain a change to one file, never a change
scattered across shell layout code. See `styling-authority.json`'s
`tenantBrandLayer` for where tenant-specific brand values may apply.

---

## `components/layout/`

Owns reusable structural composition.

Examples:

- AppShell;
- PageContainer;
- PageHeader;
- Section;
- ContentGrid;
- SplitPane;
- SidebarLayout;
- StickyActionBar.

Layout components should establish predictable spacing and structure.

Do not place domain-specific data fetching inside layout components.

---

## `components/feedback/`

Owns reusable system feedback.

Examples:

- EmptyState;
- ErrorState;
- PermissionState;
- LoadingState;
- InlineAlert;
- Toast;
- ConfirmationDialog;
- RetryPanel.

Feedback components should support domain-specific content through props or
composition without embedding one feature's rules globally.

---

## `components/navigation/`

Owns shared navigation patterns.

Examples:

- Breadcrumbs;
- SidebarNavigation;
- TopNavigation;
- Pagination;
- StepNavigation;
- SectionNavigation;
- MobileNavigation;
- CommandMenu.

Navigation components may know route concepts but must not own product-specific
data fetching or mutation logic.

Avoid repeating route arrays in several screens.

---

## `components/data-display/`

Owns reusable data-presentation structures.

Examples:

- DataTable;
- DefinitionList;
- MetricCard;
- StatusBadge;
- MetadataList;
- Timeline;
- KeyValueGrid.

These components must allow semantic variation without hardcoding one domain.

---

## `lib/api/`

Owns API transport infrastructure.

Responsibilities:

- base URL;
- authentication headers;
- request serialization;
- response parsing;
- timeout behavior;
- cancellation;
- common error normalization;
- correlation identifiers;
- retry eligibility;
- generated API client configuration.

Do not place React hooks in the low-level HTTP client.

Do not import visual components into the API layer.

---

## `lib/query/`

Owns TanStack Query infrastructure.

Responsibilities:

- QueryClient configuration;
- common retry policy;
- query-key conventions;
- invalidation helpers;
- persistence policy when applicable;
- query error integration;
- development tooling configuration.

Feature-specific query hooks remain inside the owning feature or entity.

---

## `lib/format/`

Owns user-facing formatting.

Examples:

- date formatting;
- date-time formatting;
- currency;
- percentage;
- identifiers;
- file sizes;
- durations;
- status labels;
- unavailable-value representation.

Avoid formatting the same domain value differently in several pages.

Do not expose raw ISO dates directly in presentation components.

---

## `lib/errors/`

Owns normalized frontend error types and safe user-facing error mapping.

Responsibilities:

- distinguish transport, validation, authorization, conflict, and unknown errors;
- preserve technical details for logs;
- expose operational messages to the UI;
- identify retryable errors;
- attach correlation IDs when available.

Do not show stack traces, raw response bodies, or HTTP codes to ordinary users.

---

## `lib/auth/`

Owns frontend authentication integration.

Responsibilities may include:

- current-session query;
- logout;
- session refresh coordination;
- expired-session handling;
- authenticated-route support;
- tenant or organization context;
- safe user identity access.

Do not allow feature components to read or manipulate authentication tokens
directly.

---

## `lib/permissions/`

Owns capability-based frontend permission evaluation.

Responsibilities may include:

- capability types;
- capability lookup;
- route authorization helpers;
- component-level permission helpers;
- read-only behavior;
- permission-state presentation integration.

Do not scatter role-name comparisons across pages.

---

## `lib/validation/`

Owns shared validation helpers that are not specific to one feature.

Examples:

- reusable document-number validation;
- email normalization;
- date-range validation;
- file constraints;
- schema composition helpers.

Feature-specific schemas remain in the owning feature.

---

## `lib/telemetry/`

Owns client-side observability integration.

Responsibilities may include:

- error reporting;
- user-action telemetry;
- performance monitoring;
- correlation context;
- safe metadata filtering.

Do not record sensitive values without an explicit approved policy.

---

# Dependency direction

Use this default dependency direction:

```text
app
 ↓
routes
 ↓
features
 ↓
entities
 ↓
shared components and lib
```

Detailed rules:

- `app/` may import all lower layers.
- `routes/` may import features, entities, components, and lib.
- `features/` may import entities, components, and lib.
- `entities/` may import components and lib.
- `components/` may import other shared components and general utilities.
- `lib/` must not import routes, features, or product-specific visual modules.

Avoid reverse dependencies.

Invalid:

```text
components/ui/Button.tsx
  imports
features/deadline-review/model.ts
```

Invalid:

```text
entities/case/
  imports
routes/cases/CaseDetailRoute.tsx
```

---

# Cross-feature dependency policy

One feature should not deep-import another feature's internal files.

Invalid:

```ts
import { updateStatus } from
  "@/features/case-status-update/api/update-status";
```

from an unrelated feature.

Use one of these approaches:

1. compose both features at route level;
2. expose an explicit public capability through the feature's `index.ts`;
3. move genuinely shared domain behavior to an entity or shared library;
4. use an application-level event only when decoupling is justified.

Do not solve circular dependencies by moving everything into `utils/`.

---

# Public module APIs

Each feature or entity should expose an intentional public API.

Example:

```text
features/deadline-review/
├── components/
│   └── DeadlineReviewPanel.tsx
├── hooks/
│   └── useDeadlineReview.ts
├── model/
│   └── types.ts
└── index.ts
```

`index.ts`:

```ts
export { DeadlineReviewPanel } from "./components/DeadlineReviewPanel";
export type { DeadlineReviewDecision } from "./model/types";
```

Consumers should normally import from:

```ts
import {
  DeadlineReviewPanel,
  type DeadlineReviewDecision,
} from "@/features/deadline-review";
```

Avoid exposing every internal file.

Avoid large barrel files that create circular dependencies.

---

# State ownership model

Classify state before implementing it.

## Server state

Examples:

- users;
- cases;
- documents;
- permissions returned by the server;
- reports;
- status lists;
- configuration loaded from an API.

Default owner:

- TanStack Query.

Do not copy server state into global client state merely to access it elsewhere.

---

## URL state

Examples:

- search query;
- filters;
- sort;
- page;
- selected tab when shareable;
- selected entity ID;
- date range;
- dashboard view.

Default owner:

- URL search parameters or route parameters.

Use URL state when users benefit from:

- bookmarking;
- sharing;
- browser navigation;
- preserving state after refresh.

Do not put every transient interaction into the URL.

---

## Form state

Examples:

- input values;
- dirty fields;
- validation;
- submission state;
- field arrays;
- conditional sections.

Default owner:

- React Hook Form.

Do not maintain the same field simultaneously in React Hook Form and separate
local state without a documented reason.

---

## Local interaction state

Examples:

- popover open;
- temporary selection;
- expansion;
- hover-related enhancement;
- local dialog state;
- unsaved UI-only preference.

Default owner:

- component state.

Keep local state close to its consumer.

---

## Cross-feature client state

Examples:

- unsaved multi-route workflow;
- global command palette state;
- temporary workspace composition;
- cross-route user preference not stored on the server.

Use a global client-state library only when:

- the state is not server state;
- the URL is not appropriate;
- several distant consumers need coordinated access;
- lifting state would create excessive coupling;
- persistence and lifecycle are clearly defined.

Document the reason before adding a global store.

---

# `useEffect` policy

`useEffect` is for synchronization with external systems, not as a general data
workflow mechanism.

Appropriate uses include:

- subscribing to a browser API;
- integrating a non-React library;
- synchronizing document title;
- observing media queries when no standard hook exists;
- registering and cleaning up external listeners;
- sending telemetry after a committed state transition.

Avoid `useEffect` for:

- ordinary API fetching;
- deriving values from props or state;
- synchronizing one React state variable with another;
- resetting forms whenever query data changes without lifecycle analysis;
- triggering mutations from render-derived conditions;
- filtering or sorting arrays;
- copying query data into component state;
- implementing URL synchronization ad hoc.

Prefer:

- TanStack Query;
- derived values;
- memoization when necessary;
- event handlers;
- route loaders;
- controlled initialization;
- explicit state machines for complex workflows.

---

# API boundary

Frontend code should not assume that backend DTOs are ideal presentation models.

Use this conceptual flow:

```text
HTTP response
    ↓
transport DTO
    ↓
runtime validation when justified
    ↓
mapping and normalization
    ↓
frontend/domain model
    ↓
view model or formatter
    ↓
component
```

A simple endpoint may not need every layer as a separate file.

Do not add abstractions without value.

However, create a mapping boundary when:

- backend names are technical;
- enums require user-facing labels;
- nullable values require interpretation;
- dates require parsing;
- several endpoints return different shapes for the same concept;
- sensitive fields must be removed;
- the UI requires derived state;
- API evolution should be isolated.

---

# DTO policy

Suffix transport-specific types clearly when needed:

```ts
type CaseDto = {
  id: string;
  procedural_status: string;
  updated_at: string;
};
```

Map to a frontend model:

```ts
type Case = {
  id: string;
  proceduralStatus: ProceduralStatus;
  updatedAt: string;
};
```

Example mapping:

```ts
function mapCaseDto(dto: CaseDto): Case {
  return {
    id: dto.id,
    proceduralStatus: parseProceduralStatus(dto.procedural_status),
    updatedAt: dto.updated_at,
  };
}
```

Choose one date policy and document it.

Possible policies include:

- preserve ISO strings in models and format at the presentation boundary;
- parse timestamp values into `Date` objects;
- use a date-time abstraction approved by the project.

Do not mix these policies arbitrarily.

Be especially careful when query-cache persistence, serialization, SSR, or
hydration is involved.

---

# View-model policy

Create a view model when presentation requires coordinated derivation.

Example:

```ts
type CaseSummaryViewModel = {
  title: string;
  clientLabel: string;
  statusLabel: string;
  statusTone: "neutral" | "info" | "warning" | "danger";
  updatedAtLabel: string;
  hasCriticalAttention: boolean;
};
```

Do not put large formatting expressions directly inside JSX.

Do not create view models that duplicate the entire server object without
adding presentation value.

---

# Routing architecture

Define:

- route paths centrally;
- authenticated and public route groups;
- nested layouts;
- route-level error boundaries;
- permission boundaries;
- not-found behavior;
- lazy-loading strategy;
- page titles;
- breadcrumbs;
- search-parameter parsing.

Avoid scattering literal route strings throughout components.

Example:

```ts
export const routePaths = {
  dashboard: "/dashboard",
  caseList: "/cases",
  caseDetail: (caseId: string) => `/cases/${caseId}`,
} as const;
```

Use route-level code splitting for substantial product areas when beneficial.

Do not lazily split every small component.

---

# Route guards

Separate:

- authentication;
- authorization;
- feature availability;
- tenant or organization context;
- data preconditions.

Do not use visual hiding as the only authorization control.

The backend remains authoritative.

Frontend guards improve workflow and prevent invalid navigation.

---

# Error boundaries

Use boundaries at appropriate levels:

- application;
- route;
- complex isolated widget when failure should not break the page.

An error boundary is not a replacement for query and mutation error states.

Render user-operational recovery actions where possible.

Examples:

- Retry;
- Return to list;
- Reload module;
- Contact administrator with correlation identifier.

---

# Authentication architecture

The frontend authentication layer may own:

- current-session query;
- token refresh integration;
- logout;
- session-expired behavior;
- authenticated route composition;
- user identity;
- tenant or organization context.

Do not scatter token access throughout features.

Do not expose tokens to visual components.

Do not store sensitive tokens in unsafe browser storage when the established
security architecture uses protected cookies.

Follow the approved backend authentication design.

---

# Permission architecture

Prefer capability-oriented checks.

Example:

```ts
type Capability =
  | "case.view"
  | "case.edit"
  | "case.export"
  | "deadline.confirm"
  | "tenant.admin";
```

Use a centralized helper or hook:

```ts
const canConfirm = useCapability("deadline.confirm");
```

Avoid checking role names throughout presentation code:

```ts
user.role === "ADMIN"
```

Role-to-capability mapping may change.

The backend remains authoritative.

---

# Environment configuration

Centralize environment access.

Example:

```ts
import { z } from "zod";

const envSchema = z.object({
  VITE_API_BASE_URL: z.string().url(),
  VITE_APP_ENV: z.enum(["development", "test", "production"]),
});

export const env = envSchema.parse(import.meta.env);
```

Do not access `import.meta.env` across many files.

Do not expose secrets through Vite environment variables.

Frontend environment variables are visible to the client bundle.

---

# Formatting and localization

Centralize:

- locale;
- time zone;
- date formats;
- currency;
- number formatting;
- translation keys;
- unavailable-value labels.

Do not hardcode localized formatting repeatedly in components.

Example:

```ts
export const formatCurrency = (
  value: number,
  locale = "pt-BR",
  currency = "BRL",
) =>
  new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(value);
```

Determine whether values are stored in major or minor currency units.

Do not infer silently.

---

# Performance boundaries

Performance decisions must be based on measured or plausible application needs.

Consider:

- route-level code splitting;
- expensive derived calculations;
- table virtualization;
- image optimization;
- request cancellation;
- query caching;
- bundle analysis;
- memoization;
- expensive context updates;
- unnecessary rerenders.

Do not add memoization mechanically.

Do not virtualize small lists.

Do not optimize at the expense of accessibility or predictable behavior.

---

# Accessibility architecture

Accessibility is not limited to individual components.

Architecture must support:

- semantic route headings;
- predictable focus behavior after navigation;
- route-change announcements when necessary;
- accessible dialogs and overlays;
- centralized feedback patterns;
- labels and descriptions;
- keyboard navigation;
- reduced-motion support;
- accessible error boundaries;
- consistent status semantics.

Shared primitives should implement these behaviors once where possible.

---

# Feature implementation sequence

For a new feature, use this sequence:

1. inspect the product context;
2. define the user capability;
3. define route ownership;
4. define API integration contract;
5. define query keys;
6. define transport types;
7. define mapping;
8. define query or mutation hooks;
9. define state matrix;
10. build isolated components;
11. compose the feature;
12. integrate into the route;
13. validate in Storybook where applicable;
14. validate in the browser;
15. run architecture and design-system checks.

Do not start with the final route component.

---

# Architecture decision policy

Record a decision when it:

- affects several features;
- introduces a dependency;
- changes data ownership;
- creates a new project-wide convention;
- adds a global store;
- changes routing;
- changes error handling;
- changes the API client;
- changes authentication or permission handling.

Small local implementation choices do not require an ADR.

---

# Migration policy for existing repositories

When the existing project does not match this architecture:

1. map the current architecture;
2. identify concrete pain points;
3. preserve working behavior;
4. propose an incremental target;
5. migrate only the active slice;
6. create compatibility boundaries;
7. avoid large file moves mixed with feature development;
8. run tests before and after;
9. document temporary deviations.

Do not reorganize the entire repository merely because this reference defines a
preferred structure.

---

# Architecture quality checks

Before completing foundation mode, verify:

- [ ] Each major concern has one owner.
- [ ] Routes remain composition-oriented.
- [ ] Features represent user capabilities.
- [ ] Shared primitives contain no product-specific rules.
- [ ] API transport is isolated from visual components.
- [ ] Server-state ownership is explicit.
- [ ] URL-state ownership is explicit.
- [ ] Form-state ownership is explicit.
- [ ] No unnecessary global store was introduced.
- [ ] Query and mutation infrastructure is centralized appropriately.
- [ ] Backend DTOs do not leak indiscriminately into JSX.
- [ ] Formatting is centralized.
- [ ] Authentication and permissions are not scattered.
- [ ] Dependency direction is respected.
- [ ] Cross-feature deep imports are absent.
- [ ] Environment configuration is validated centrally.
- [ ] Tests can render feature components with project providers.
- [ ] Accessibility responsibilities are shared rather than reimplemented.
- [ ] Performance decisions are documented where relevant.
- [ ] Existing architecture is migrated incrementally.

---

# Stop conditions

Stop and request guidance when:

- the project has an established conflicting architecture;
- a proposed reorganization affects many unrelated features;
- API contracts are unavailable;
- authentication architecture is unclear;
- tenant or organization boundaries are unclear;
- a global state store appears necessary but ownership is unresolved;
- generated API clients conflict with handwritten DTOs;
- route behavior would have to be guessed;
- the feature requires backend changes;
- shared components have broad untested consumers;
- uncommitted work may be overwritten.

---

# Required architecture report

At the end of foundation or architecture work, report:

## Existing architecture

What was found.

## Target architecture

The approved organization and dependency direction.

## State ownership

Server, URL, form, local, and cross-feature state decisions.

## API boundary

Transport, mapping, errors, and generated-client decisions.

## Routing

Route composition and guard strategy.

## Deviations

Where the repository intentionally differs from this reference.

## Risks

Migration, coupling, and test risks.

## Artifact

Path to `docs/frontend/frontend-architecture.md`.

## Gate status

One of:

- `APPROVED_FOR_FOUNDATION_IMPLEMENTATION`;
- `APPROVED_WITH_MIGRATION_LIMITATIONS`;
- `BLOCKED_BY_ARCHITECTURE_DECISIONS`.
