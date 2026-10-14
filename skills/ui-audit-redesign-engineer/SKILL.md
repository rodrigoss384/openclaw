---
name: ui-audit-redesign-engineer
description: Audit, plan, implement, and validate modernization of existing user interfaces without rebuilding the system or changing business rules. Use when asked to review screenshots or a frontend, create UI/component inventories, define remediation plans, modernize screens incrementally, compare before/after visuals, or operate in audit, plan, implement, or validate mode while preserving APIs, backend contracts, authentication, permissions, data models, legal rules, and functional behavior.
---

# UI Audit Redesign Engineer

## Mission

Improve the presentation layer of an existing product safely and incrementally. Treat UI work as a controlled modernization effort, not a rewrite.

The central rule: separate presentation, behavior, business rules, and integration contracts. A visual task must not silently alter domain behavior, legal logic, authorization, tenant isolation, persistence, or API semantics.

## Mode router

The skill operates in four modes:

- `audit`: identify inconsistencies and produce reports. Do not change code.
- `plan`: transform an approved audit into small, reviewable implementation lots. Do not change code unless explicitly requested.
- `implement`: apply only the named lot or scope. Do not modernize unrelated screens opportunistically.
- `validate`: verify the current lot with visual composition, accessibility, responsive, and regression checks.

If the user does not name a mode, choose the safest mode:

- choose `audit` when the user asks what is wrong, what is missing, or wants a review;
- choose `plan` when the user asks for next steps, sequencing, tasks, or implementation strategy;
- choose `implement` only when the user explicitly asks to change files/designs;
- choose `validate` after implementation or when the user asks whether the result is acceptable.

## Mandatory guardrails

During UI/redesign work, do not change without explicit separate authorization:

- API contracts, endpoints, payload shapes, or HTTP semantics;
- authentication, authorization, roles, permissions, RLS, or tenant isolation;
- business, legal, financial, calculation, workflow, or persistence rules;
- database schemas, migrations, queues, audit events, or external integrations;
- working functionality simply because it is visually difficult to organize.

Do not create a parallel frontend, replace real behavior with mocks, or introduce fake production data unless explicitly requested.

Before editing, follow the repository's local instructions, inspect the worktree, identify the affected frontend framework/build commands, and preserve user changes. When repository instructions require impact analysis, run it before editing exported functions, classes, or methods.

Resolve the styling authority before visual work: inspect configs, stylesheet imports, tokens, component sources and global stylesheets. Use or create `docs/frontend/styling-authority.json` when the project follows the spec-driven workflow. Never infer that an unresolved BEM-like class belongs in `globals.css`; trace usage, definition, cascade and owner first. A missing owner is drift or a blocker, not permission for a global override.

## Workflow by mode

### audit

Use when asked to inspect current UI quality. Read `references/visual-consistency-checklist.md`, `references/accessibility-responsive-checklist.md`, and `references/scope-and-safety-guardrails.md`.

Inspect what is available: screenshots, running app, frontend code, design tokens, shared components, Storybook, Playwright tests, and design files. If some inputs are missing, continue with available evidence and state the limitation.

Expected outputs, when appropriate:

- `docs/ui/ui-audit.md` using `templates/ui-audit.md`;
- `docs/ui/component-inventory.md` using `templates/component-inventory.md`;
- `docs/ui/ui-remediation-plan-draft.md` using `templates/ui-remediation-plan.md`.

### plan

Use when an audit exists or the user wants sequencing. Read `references/mode-workflows.md` and `templates/ui-remediation-plan.md`.

Create lots that can be implemented and reviewed separately. Prefer this order unless product context suggests otherwise:

1. foundations: tokens, typography, spacing, radius, shadows, focus states;
2. base components: buttons, fields, cards, alerts, modals, tabs, empty states, tables;
3. global shell: navigation, header, breadcrumbs, page headers, responsive behavior;
4. representative screens: login, dashboard/list, record/detail;
5. remaining vertical slices by product area;
6. validation hardening: screenshots, accessibility, keyboard, zoom, long text, empty/error/loading states.

Each lot must include scope, excluded changes, files/areas affected, risks, acceptance criteria, and validation commands.

### implement

Use only for a named lot or narrow scope. Read `references/scope-and-safety-guardrails.md` and any checklist relevant to the requested UI area.

Implementation rules:

- keep backend/API/domain behavior unchanged;
- prefer existing design tokens and shared components;
- preserve the approved styling architecture and global stylesheet boundaries;
- record class ownership before modifying or overriding existing selectors;
- introduce or normalize primitives before changing many pages;
- avoid one-off hardcoded colors, spacing, and variants;
- preserve labels, permissions, data loading, submission behavior, and analytics/audit hooks;
- keep changes reviewable; do not mix unrelated cleanup.
- do not add component, feature, page or BEM selectors to global CSS unless the registered legacy authority or an approved scoped exception permits it.

After implementation, update the relevant artifact status if the project uses spec-driven task files.

### validate

Use after a lot is implemented or when asked to check quality. Read `references/visual-consistency-checklist.md`, `references/accessibility-responsive-checklist.md`, and `templates/validation-report.md`.

Validate in proportion to risk:

- build/typecheck/lint/unit tests where available;
- visual hierarchy, reading path, focal point, proximity, alignment, whitespace, emphasis budget, and semantic-heading separation;
- Storybook component states if present;
- Playwright flows and screenshots if present;
- manual browser inspection when the app can run;
- keyboard navigation, focus-visible, zoom 125%, long text, empty/loading/error states, and responsive breakpoints.

Report what passed, what failed, what could not be run, and whether remaining issues block approval.

## Reference routing

- Visual/UI consistency: `references/visual-consistency-checklist.md`.
- Accessibility and responsive behavior: `references/accessibility-responsive-checklist.md`.
- Mode-by-mode detailed workflow: `references/mode-workflows.md`.
- Safety boundaries and anti-scope-creep rules: `references/scope-and-safety-guardrails.md`.
- Output formats: files under `templates/`.

Load only the references needed for the current mode.
