---
name: frontend-product-builder
description: Build, extend, integrate, and validate production-grade React frontends from explicit product, design, architecture, layout, component, state, responsive, accessibility, and browser-validation contracts. Use for new application screens, workflows, dashboards, searchable collections, entity details, forms, administration, authentication, and review or approval surfaces.
---

# Frontend Product Builder

## Mission

Build credible production frontend products rather than isolated visual mockups.

Convert product intent into a validated implementation through:

```text
DISCOVER
→ PRIORITIZE
→ VISUAL DIRECTION
→ COMPOSITION PROOF
→ CLASSIFY
→ RECIPE
→ TOKENS
→ COMPONENT MAP
→ PLAN
→ SMALL SLICE
→ BUILD
→ BROWSER
→ SCREENSHOTS
→ COMPOSITION AUDIT
→ DESIGN-SYSTEM AUDIT
→ PATCH
→ REPORT
```

The skill must produce frontends that are:

- product-aware;
- visually coherent;
- compositionally disciplined;
- architecturally bounded;
- responsive;
- accessible;
- state-complete;
- component-driven;
- evidence-validated;
- extendable into production.

A polished success-state screenshot is not sufficient.

The implementation must remain credible under:

- initial loading;
- background refresh;
- empty data;
- filtered empty data;
- partial failure;
- full failure;
- permission limits;
- read-only access;
- unavailable dependencies;
- processing;
- mutation failure;
- stale data;
- conflicting data;
- long localized content;
- compact viewports;
- browser zoom;
- keyboard navigation;
- assistive technology.

---

## 1. Trigger conditions

Use this skill when the user asks to:

- create a frontend product;
- create a React application;
- build a new product screen;
- implement a complete workflow;
- create a dashboard;
- create a searchable list;
- create an entity-detail screen;
- create a form workflow;
- create an administration interface;
- create an authentication surface;
- create a review or approval workspace;
- integrate a new frontend feature into an existing repository;
- extend an existing frontend architecture with new product behavior;
- migrate an approved frontend surface;
- repair a frontend implementation when the repair requires product, state, component, responsive, or accessibility reconstruction.

This skill is optimized for product construction.

It is not primarily an isolated visual-audit or cosmetic-redesign skill.

A repair or extension remains valid only when the requested result requires a complete product contract rather than a superficial CSS patch.

---

## 2. Non-goals

Do not use this workflow as a substitute for:

- backend-only implementation;
- database design without frontend work;
- isolated logo or image generation;
- one-off marketing graphics;
- screenshot replication without product behavior;
- generic design inspiration without implementation;
- component-library replacement without approved migration;
- accessibility claims without validation;
- arbitrary framework migration;
- raw HTML mockups intended to be discarded;
- fake production architecture.

Do not create a parallel frontend application when the repository already contains an applicable application structure.

---

## 3. Path conventions

### Skill root

`SKILL_ROOT` means the directory containing this `SKILL.md`.

The installed location is expected to be:

```text
$HOME/.agents/skills/frontend-product-builder
```

## 3.1 Visual composition contract

For a new screen, redesign, substantial UI change, dominant-task change,
typography change, regional layout change, or action-hierarchy change, visual
composition is part of readiness, not a late cosmetic audit.

Read `references/13-visual-composition.md` before approving design readiness.

The design system must define `visualGrammar` with a base profile and semantic
text styles. The screen contract must define `visualHierarchy` with semantic
outline, visual priority, reading path, proximity groups, alignment anchors,
whitespace ownership, emphasis budget, and responsive priority preservation.

## 3.2 Behavioral UX contract

For any surface meant to influence a user's decision or behavior
(onboarding, activation, pricing, upgrade, renewal, retention,
cancellation), read `references/14-behavioral-ux.md` before DISCOVER
finalizes scope.

A `PERSUASIVE` or `HIGH-RISK` intervention (per that reference's risk
classification) requires a Behavioral UX Contract
(`assets/schemas/behavioral-ux-contract.schema.json`) declaring principle,
falsifiable hypothesis, evidence grade, honest user benefit, manipulation
risk, and guardrails before implementation. A `PROHIBITED` pattern (fake
scarcity, fake progress, hidden fees, confirm-shaming, difficult
cancellation, concealed billing, and the rest of that reference's list) is
a blocker, never a finding to negotiate. A `HIGH-RISK` surface additionally
requires the Behavioral Adversarial Review (§21) before release.

Do not use `h1` through `h6` as a visual scale. Headings describe the semantic
document outline; semantic text styles describe appearance.

For substantial frontend work, create and validate these project artifacts in
the screen directory:

```text
composition-proof.json
visual-composition-evidence.json
visual-quality-scorecard.json
```

The composition proof belongs to the existing representative gate. It must be
approved by a human before broad frontend build, but no heuristic or script may
claim aesthetic approval on the user's behalf.

During source construction, the staging location may be:

```text
skills-src/frontend-product-builder
```

For Linux and Bash, define the source-stage root with:

```bash
export SKILL_ROOT="skills-src/frontend-product-builder"
```

After installation, define:

```bash
export SKILL_ROOT="$HOME/.agents/skills/frontend-product-builder"
```

Commands and internal resource lookups must use:

```bash
"$SKILL_ROOT/references/..."
"$SKILL_ROOT/assets/..."
"$SKILL_ROOT/scripts/..."
```

Do not hardcode the staging path inside permanent project artifacts.

### Permanent path policy


Source-tree paths are documentation-only. They are allowed only in
installation, source-synchronization, or detector examples. Runtime
commands, generated contracts, reports, evidence, and project outputs
must use the installed global skill root or repository-relative paths.

The string:

```text
skills-src/frontend-product-builder
```

is allowed only while authoring and validating the source-stage skill.

It must not remain in:

- installed skill files;
- project screen specifications;
- project component catalogs;
- project design-system files;
- project integration contracts;
- readiness reports;
- CI commands;
- documentation intended for installed use.

Persistent references stored in JSON or project documentation should use:

```text
~/.agents/skills/frontend-product-builder/...
```

### Relative internal references

Files stored inside the skill should use relative references when the referenced file moves together with the skill.

Examples:

```text
../schemas/component-catalog.schema.json
../schemas/layout-recipe.schema.json
../schemas/screen-specification.schema.json
```

These references normally remain valid when the complete directory moves from `skills-src` to `.agents/skills`.

### Project outputs

Generated product artifacts belong in the project, not inside the skill:

```text
docs/frontend/
```

The skill sources remain reusable and read-only during ordinary project execution.

---

## 4. Environment conventions

The default command environment is Linux with Bash.

Use:

- POSIX-compatible paths;
- forward slashes;
- quoted shell variables;
- explicit exit-code checks;
- `node --check` for JavaScript syntax;
- Node scripts for JSON validation;
- the repository's existing package manager.

Do not provide PowerShell commands unless the user explicitly requests PowerShell.

Do not assume that the following utilities are installed:

- `jq`;
- `yq`;
- `fd`;
- `rg`;
- GNU-specific extensions beyond the detected environment.

Prefer Node-based portable checks when practical.

Example:

```bash
for script in \
  report-screen-readiness.mjs \
  validate-small-slice-manifest.mjs \
  audit-small-slice-files.mjs \
  audit-small-slice-scope.mjs \
  audit-small-slice-evidence.mjs \
  prepare-representative-gate.mjs; do
  node --check "$SKILL_ROOT/scripts/$script"
done
```

Example JSON syntax validation:

```bash
node -e '
  const fs = require("node:fs");
  const file = process.argv[1];
  JSON.parse(fs.readFileSync(file, "utf8"));
  console.log(`Valid JSON: ${file}`);
' "$FILE"
```

---

## 5. Default frontend stack

When starting a genuinely new frontend and no approved repository stack already exists, prefer:

- React;
- TypeScript;
- Vite;
- TanStack Router for `new-build` and `replacement` (type-safe params/search/navigation, natural fit with the rest of the TanStack stack below); React Router remains the correct choice for `integration`/`extension`/`repair` on a repository that already uses it — never migrate an existing router silently;
- Tailwind CSS;
- Radix UI primitives (or the project's equivalent headless-primitive library) as the actual accessible-behavior foundation; shadcn/ui as an optional one-time source accelerator copied into the project's own design system, never an ongoing dependency (see `references/04-design-system.md`, "shadcn/ui policy");
- TanStack Query;
- React Hook Form;
- Zod;
- Storybook;
- Playwright;
- the repository's approved unit-test runner.

These are defaults, not mandatory migrations.

Whenever the stack is (or includes) React, `$react-best-practices` and
`$react-composition-patterns` are required reading before BUILD and required
practice during BUILD/PATCH (Stage 9/Stage 13), regardless of whether the
stack is this default or an existing repository's own React setup. Whenever
the stack is (or includes) Tailwind, `$tailwind-patterns` is required
reading before TOKENS (Stage 5) for the same reason.

### Existing-repository rule

When the repository already has an established stack:

1. inspect it;
2. record it;
3. preserve it when viable;
4. adapt the skill contracts to it;
5. propose migration only when required;
6. never migrate silently.

Do not replace:

- package manager;
- build system;
- router;
- query library;
- form library;
- validation library;
- component foundation;
- CSS architecture;
- test runner;
- Storybook setup;
- browser-test framework;

without an explicit approved migration plan.

---

## 6. Required references

Read the applicable references before implementation.

### Product and visual direction

```text
references/01-product-discovery.md
references/02-design-direction.md
```

These define:

- users;
- jobs to be done;
- journeys;
- information architecture;
- terminology;
- permissions;
- product states;
- design archetype;
- density;
- visual hierarchy;
- typography;
- color;
- surfaces;
- spacing;
- motion;
- representative visual direction.

### Architecture and data

```text
references/03-frontend-architecture.md
references/07-data-and-forms.md
```

These define:

- feature boundaries;
- route ownership;
- dependency direction;
- server-state ownership;
- form-state ownership;
- URL-state ownership;
- DTO validation;
- mapping;
- frontend models;
- view models;
- query behavior;
- mutation behavior;
- invalidation;
- optimistic updates;
- dates;
- currency;
- enums;
- uploads;
- error normalization.

### Design system and components

```text
references/04-design-system.md
references/05-component-composition.md
```

These define:

- token layers;
- semantic tokens;
- component tokens;
- primitive components;
- shared composites;
- feature components;
- screen components;
- canonical responsibility;
- component selection;
- composition;
- extension;
- state ownership;
- responsive behavior;
- accessibility;
- testing;
- duplicate prevention.

### Layout and screen planning

```text
references/06-layout-recipes.md
references/08-screen-planning.md
```

These define:

- screen classification;
- layout-recipe selection;
- recipe regions;
- shell behavior;
- responsive transformations;
- scroll ownership;
- state matrices;
- component maps;
- implementation plans;
- representative-screen selection;
- representative slices;
- planning gates.

### Screen contract validation

```text
references/09-screen-contract-validation.md
references/10-small-slice-execution.md
references/11-small-slice-validation.md
references/12-styling-authority.md
```

This defines:

- screen specification validation;
- cross-reference audits;
- component-coverage audits;
- action-state audits;
- data-ownership audits;
- representative-gate audits;
- readiness reporting;
- release conditions for `SMALL SLICE`;
- release conditions for broader `BUILD`.

---

## 7. Required skill assets

### Schemas

```text
assets/schemas/design-system.schema.json
assets/schemas/layout-recipe.schema.json
assets/schemas/component-catalog.schema.json
assets/schemas/screen-specification.schema.json
assets/schemas/small-slice-manifest.schema.json
assets/schemas/styling-authority.schema.json
assets/schemas/entity-projections.schema.json
assets/schemas/browser-matrix.schema.json
assets/schemas/behavioral-ux-contract.schema.json
```

### Templates

```text
assets/templates/product-context.template.md
assets/templates/design-direction.template.md
assets/templates/frontend-architecture.template.md
assets/templates/api-integration-contract.template.md
assets/templates/design-system.template.json
assets/templates/styling-authority.template.json
assets/templates/component-contract.template.md
assets/templates/token-contract.template.md
assets/templates/layout-recipe.template.json
assets/templates/component-catalog.template.json
assets/templates/screen-contract.template.md
assets/templates/component-map.template.md
assets/templates/screen-specification.template.json
assets/templates/screen-state-matrix.template.md
assets/templates/screen-component-map.template.md
assets/templates/screen-implementation-plan.template.md
assets/templates/small-slice-manifest.template.json
assets/templates/repository-inspection.template.md
assets/templates/fixture-strategy.template.md
assets/templates/small-slice-implementation-journal.template.md
assets/templates/browser-validation.template.md
assets/templates/screenshot-evidence.template.json
assets/templates/design-system-audit.template.md
assets/templates/defect-log.template.md
assets/templates/behavioral-ux-contract.template.json
```

### Layout recipes

```text
assets/recipes/application-shell.recipe.json
assets/recipes/dashboard.recipe.json
assets/recipes/searchable-list.recipe.json
assets/recipes/entity-detail.recipe.json
assets/recipes/form-workflow.recipe.json
assets/recipes/administration.recipe.json
assets/recipes/authentication.recipe.json
assets/recipes/review-approval.recipe.json
```

### Component catalog fragments

```text
assets/catalog/foundational-components.json
assets/catalog/layout-components.json
assets/catalog/feedback-components.json
assets/catalog/data-display-collection-components.json
assets/catalog/data-display-analytical-components.json
assets/catalog/form-field-foundation-components.json
assets/catalog/form-field-control-components.json
assets/catalog/form-workflow-components.json
```

### Screen-validation scripts

```text
scripts/lib/screen-contract-utils.mjs
scripts/validate-screen-specification.mjs
scripts/audit-screen-spec-references.mjs
scripts/audit-screen-component-coverage.mjs
scripts/audit-screen-action-state-coverage.mjs
scripts/audit-screen-data-ownership.mjs
scripts/audit-representative-gate.mjs
scripts/report-screen-readiness.mjs
scripts/validate-styling-authority.mjs
scripts/audit-styling-authority.mjs
scripts/audit-cross-screen-projection-consistency.mjs
scripts/validate-behavioral-ux-contract.mjs
```

Do not silently continue when a required source asset is missing.

Record the missing asset as a blocker.

---

### Structural and contract validation scripts

Use these validators when changing the skill itself:

- `scripts/validate-skill-structure.mjs`
- `scripts/validate-layout-recipes.mjs`
- `scripts/validate-component-catalogs.mjs`
- `scripts/validate-contract-templates.mjs`

These maintenance validators verify the installed skill structure,
recipes, component catalogs, schemas, and contract templates. They do
not replace the project-level screen and small-slice gates.

### Integration-test runners

The integration suite is composed of these runners:

- `scripts/test-contract-fixtures.mjs`
- `scripts/test-primary-contract-clis.mjs`
- `scripts/test-styling-authority-cli.mjs`
- `scripts/test-screen-auditor-clis.mjs`
- `scripts/test-visual-composition-clis.mjs`
- `scripts/test-representative-gate-auditor-cli.mjs`
- `scripts/test-representative-gate-preparer-cli.mjs`
- `scripts/test-small-slice-auditor-clis.mjs`
- `scripts/test-behavioral-ux-contract-cli.mjs`
- `scripts/run-integration-suite.mjs`

The individual runners persist detailed JSON reports under
`evals/files/contracts/`. The consolidated runner executes the nine
runners listed above, in the required order. It does not run
`test-evidence-status-authority.mjs`, `test-styling-authority-v2.mjs`
or `test-ui-evidence-v2.mjs`; those are separate entrypoints invoked
directly by CI.

### Official integration command

Run the complete integration suite against the globally installed
skill:

```bash
node "$HOME/.agents/skills/frontend-product-builder/scripts/run-integration-suite.mjs" --root "$HOME/.agents/skills/frontend-product-builder"
```

A successful result requires every runner to be discovered, every
syntax check to pass, every suite to exit with status `0`, and the
consolidated expectation-mismatch count to remain `0`.

## 8. Required project outputs

Create project artifacts under:

```text
docs/frontend/
```

The expected package is:

```text
docs/frontend/
├── product-context.md
├── design-direction.md
├── frontend-architecture.md
├── styling-authority.json
├── design-system/
│   ├── design-system.json
│   ├── component-catalog.json
│   └── components/
├── integrations/
│   └── <feature-name>.md
└── screens/
    └── <screen-id>/
        ├── screen-spec.json
        ├── state-matrix.md
        ├── component-map.md
        ├── implementation-plan.md
        └── readiness-report.json
```

Representative implementation evidence may additionally include:

```text
docs/frontend/screens/<screen-id>/
├── screenshots/
├── browser-report/
├── accessibility-report/
├── design-system-audit/
└── component-audit/
```

Follow the repository's approved evidence location when one already exists.

---

## 9. Operating modes

Every execution must identify one mode.

### `new-build`

Create a new frontend application or new product area when no applicable implementation exists.

### `integration`

Add a new screen or workflow to an existing frontend architecture.

### `migration`

Move an existing approved product surface to a new approved architecture.

Migration requires:

- source inventory;
- destination architecture;
- compatibility plan;
- incremental sequence;
- rollback or containment strategy;
- explicit approval.

### `extension`

Add a bounded capability to an existing screen, component system, or workflow.

### `repair`

Correct an existing implementation that violates product, architecture, component, responsive, state, or accessibility contracts.

Do not label a broad replacement as a repair to avoid migration controls.

### `replacement`

Deliberately discard the existing frontend implementation while preserving
proven behavior, domain, and product contracts. Unlike `migration`
(preserve source and target coexist during an incremental, compatibility-
constrained transition) or `repair` (fix the existing implementation in
place), `replacement` starts implementation authority from zero: the old
code is evidence of behavior to preserve, never an architecture to inherit.

Declare, before any implementation:

| Carried forward from the legacy frontend | Authority level |
|---|---|
| Behavior evidence (what the product actually does today) | Yes — source of truth for acceptance criteria |
| Product terminology | Yes |
| Routes and user journeys | Yes, unless the replacement explicitly changes navigation as part of its own approved intent |
| Business states (loading/empty/error/permission/etc. as product concepts) | Yes |
| Approved visual direction | Maybe — carry forward only what `$frontend-design` explicitly re-approves for the replacement; do not assume the old visual direction survives by default |
| CSS, components, architecture | No authority — the replacement's own `03-frontend-architecture.md`/`04-design-system.md`/styling authority govern from scratch |
| Technical debt, dead code, undocumented behavior | No migration obligation — do not "preserve" what the replacement exists to eliminate |

`replacement` still runs the full canonical workflow (`DISCOVER` through
`REPORT`) and still requires the representative gate before broad build. The
difference from `new-build` is that `DISCOVER`'s primary evidence source is
the running legacy application (browser evidence, not just a PRD), and the
implementation plan records, per capability, whether it is `carried`,
`reimplemented-same-behavior`, `intentionally-changed`, or `dropped` —
never silently reproducing legacy CSS/component/architecture decisions on
the theory that "preserving behavior" requires preserving implementation.

A cutover strategy (big-bang vs. incremental route-by-route) is an explicit
decision recorded in the implementation plan, not an assumption. Do not
label a `replacement` as `migration` merely because both discard legacy
code — `migration` implies an approved destination architecture that stays
compatible with the source during transition; `replacement` does not carry
that compatibility obligation.

---

## 10. Repository inspection

Before planning implementation, inspect:

- repository root;
- package manager;
- workspace structure;
- package manifests;
- build system;
- React version;
- TypeScript setup;
- route structure;
- Tailwind or CSS setup;
- styling authority, stylesheet imports, global stylesheet responsibilities, and affected-class ownership;
- tokens;
- shared components;
- feature components;
- query client;
- form setup;
- validation setup;
- authentication;
- authorization;
- environment configuration;
- test framework;
- Storybook;
- Playwright or browser-test setup;
- formatting and linting;
- CI commands.

Record findings in the implementation plan.

Do not infer repository structure from common conventions when direct inspection is available.

---

## 11. Workflow


### Canonical workflow

Use this exact stage order — the same `FRONTEND_CANONICAL_WORKFLOW` sequence declared in the Mission above, `references/frontend-overlay.md`, `rules.md`, and `spec-driven-engineering/SKILL.md`'s frontend overlay:

```text
DISCOVER → PRIORITIZE → VISUAL DIRECTION → COMPOSITION PROOF → CLASSIFY → RECIPE → TOKENS → COMPONENT MAP → PLAN → SMALL SLICE → BUILD → BROWSER → SCREENSHOTS → COMPOSITION AUDIT → DS AUDIT → PATCH → REPORT
```

`DS AUDIT` is the canonical compact name for the
`DESIGN-SYSTEM AUDIT` stage described below. Do not reorder, omit, or
merge stages when reporting workflow progress.

`PRIORITIZE`, `COMPOSITION PROOF`, and `COMPOSITION AUDIT` are real checkpoints without a dedicated numbered `## Stage N` heading below — they are embedded, in this exact position, inside the stages that carry them:

- `PRIORITIZE` and `COMPOSITION PROOF` happen inside **Stage 2 — VISUAL DIRECTION** (§3.1 Visual composition contract): content priority (dominant task, focal point per state, `critical|primary|supporting|contextual|audit` map, reading path) is recorded before `visualHierarchy`/`composition-proof.json` are produced, and both gate the move to `CLASSIFY`.
- `COMPOSITION AUDIT` happens inside the representative gate, before **Stage 12 — DESIGN-SYSTEM AUDIT**: `validate-visual-composition-contract.mjs` and `audit-visual-composition-evidence.mjs` run against `composition-proof.json`/`visual-composition-evidence.json` before the `DS AUDIT` scripts run.

Reporting progress against any of these three checkpoints without also naming the stage that carries it (`VISUAL DIRECTION` or the representative gate before `DS AUDIT`) is a reporting defect, not a valid shorthand.

## Stage 1 — DISCOVER

Create or update:

```text
docs/frontend/product-context.md
```

Define:

- users;
- actors;
- jobs to be done;
- journeys;
- entry points;
- exit points;
- information architecture;
- screens;
- terminology;
- data concepts;
- permissions;
- tenant or organization scope;
- states;
- representative fixtures;
- assumptions;
- open questions;
- blockers.

### Discovery gate

Do not continue when critical ambiguity remains around:

- primary user;
- primary task;
- authorization;
- tenant scope;
- destructive consequences;
- decision authority;
- temporal semantics;
- upload safety;
- persistence meaning.

---

## Stage 2 — VISUAL DIRECTION

Create or update:

```text
docs/frontend/design-direction.md
```

Define:

- visual archetype;
- adjectives translated into rules;
- density;
- shell;
- hierarchy;
- typography;
- color;
- surfaces;
- spacing;
- radii;
- elevation;
- icons;
- motion;
- actions;
- forms;
- tables;
- dashboards;
- feedback states;
- responsive principles;
- representative-screen direction.
- approved visual references, adopted aspects, and excluded aspects.

Do not use adjectives without implementation consequences.

Example:

```text
"calm"
```

must become rules such as:

- restrained surface contrast;
- limited decorative elevation;
- predictable action hierarchy;
- low-frequency motion;
- stable spacing rhythm.

---

## Stage 3 — CLASSIFY

Identify the dominant screen category:

- `application-shell`;
- `dashboard`;
- `searchable-list`;
- `entity-detail`;
- `form`;
- `administration`;
- `authentication`;
- `review-approval`;
- `custom`.

Classification follows the dominant user task.

Do not classify by visual appearance alone.

Use `custom` only after evaluating approved recipes.

---

## Stage 4 — RECIPE

Select the closest approved recipe from:

```text
"$SKILL_ROOT/assets/recipes/"
```

Record:

- selected recipe;
- rejected alternatives;
- mapped regions;
- omitted optional regions;
- extensions;
- scroll ownership;
- sticky behavior;
- responsive behavior.

A recipe is a structural contract, not a screenshot template.

Do not implement from a blank canvas.

---

## Stage 5 — TOKENS

Create or update:

```text
docs/frontend/design-system/design-system.json
docs/frontend/styling-authority.json
```

Validate the styling authority before implementation with `node scripts/validate-styling-authority.mjs <contract> --check-references` from the repository root. Ready/approved authority must retain every local inspected file, approved visual source, and approval evidence in a non-empty canonical repository path; `.field-test/`, `/tmp`, planning sandboxes, missing files, and paths outside the repository block readiness. External HTTP(S) visual sources remain valid when their approval evidence is retained. Tailwind is preferred only for a genuine greenfield default or when it is the approved repository authority. Do not infer that a BEM-looking class belongs in a global stylesheet; trace its definition and owner first.

When Tailwind is the approved authority, apply `$tailwind-patterns` (v4 CSS-first configuration, container queries, token architecture) when defining the token layers below — not only when auditing them later.

Use:

```text
reference tokens
        ↓
semantic tokens
        ↓
component tokens
```

Avoid raw values when a token owns the decision.

Do not create screen-specific token aliases for arbitrary styling convenience.

A new token requires:

- semantic responsibility;
- expected consumers;
- naming consistency;
- theme behavior;
- accessibility review.

---

## Stage 6 — COMPONENT MAP

Create or update:

```text
docs/frontend/design-system/component-catalog.json
docs/frontend/screens/<screen-id>/component-map.md
```

Use this selection order:

```text
1. Existing project component.
2. Existing approved catalog component.
3. Approved composition.
4. Approved bounded extension.
5. Feature-specific component.
6. New shared component proposal.
```

Classify each screen use as:

- `canonical`;
- `extended`;
- `feature-specific`;
- `new-proposed`.

Do not create:

- `ModernCard`;
- `NewButton`;
- `AdvancedTable`;
- `CustomPanel`;
- `V2Dialog`;

as a shortcut around canonical responsibility.

---

## Stage 7 — PLAN

Create:

```text
docs/frontend/screens/<screen-id>/screen-spec.json
docs/frontend/screens/<screen-id>/state-matrix.md
docs/frontend/screens/<screen-id>/component-map.md
docs/frontend/screens/<screen-id>/implementation-plan.md
```

The required order is:

```text
screen-spec.json
        ↓
state-matrix.md
        ↓
component-map.md
        ↓
implementation-plan.md
```

Define:

- primary task;
- dominant category;
- recipe;
- regions;
- component usages;
- data dependencies;
- actions;
- state behavior;
- responsive transformations;
- accessibility;
- files;
- implementation sequence;
- fixtures;
- tests;
- browser scenarios;
- representative slice;
- blockers;
- out-of-scope work.

Do not begin JSX implementation before the planning package passes.

---

## 12. Screen contract validation

Before moving from `PLAN` to `SMALL SLICE`, run the screen contract pipeline below. It covers the screen and visual-composition contracts; the styling authority and the small-slice audits are covered separately by `prepare-representative-gate.mjs`, and both pipelines are required by `governance-control.mjs enforce --stage frontend-representative`.

For Linux and Bash:

```bash
export SKILL_ROOT="${SKILL_ROOT:-$HOME/.agents/skills/frontend-product-builder}"

SPEC="docs/frontend/screens/<screen-id>/screen-spec.json"

node "$SKILL_ROOT/scripts/validate-screen-specification.mjs" \
  "$SPEC"

node "$SKILL_ROOT/scripts/audit-screen-spec-references.mjs" \
  "$SPEC"

node "$SKILL_ROOT/scripts/audit-screen-component-coverage.mjs" \
  "$SPEC"

node "$SKILL_ROOT/scripts/audit-screen-action-state-coverage.mjs" \
  "$SPEC"

node "$SKILL_ROOT/scripts/audit-screen-data-ownership.mjs" \
  "$SPEC"

node "$SKILL_ROOT/scripts/audit-representative-gate.mjs" \
  "$SPEC"

node "$SKILL_ROOT/scripts/report-screen-readiness.mjs" \
  "$SPEC"
```

The consolidated command is:

```bash
node "$SKILL_ROOT/scripts/report-screen-readiness.mjs" \
  "docs/frontend/screens/<screen-id>/screen-spec.json"
```

Use full JSON Schema validation when the repository has approved:

```text
ajv
ajv-formats
```

Structural-only validation must be explicitly requested:

```bash
node "$SKILL_ROOT/scripts/report-screen-readiness.mjs" \
  "$SPEC" \
  --structural-only
```

Structural-only validation is not equivalent to complete schema validation.

For representative review or CI stabilization, use:

```bash
node "$SKILL_ROOT/scripts/report-screen-readiness.mjs" \
  "$SPEC" \
  --strict-warnings
```

### Release to `SMALL SLICE`

The workflow may enter `SMALL SLICE` only when the readiness report returns:

```text
ready-for-small-slice
```

or:

```text
representative-ready-for-review
```

or:

```text
broad-build-approved
```

The usual first valid result is:

```text
ready-for-small-slice
```

### Release to broader `BUILD`

The workflow may expand beyond the representative slice only when the readiness report returns:

```text
broad-build-approved
```

Do not change:

- gate status;
- approval identity;
- evidence;
- product questions;
- blockers;
- component ownership;
- mutation policies;
- idempotency;
- data ownership;
- permission treatment;

merely to make validation pass.

Correct the authoritative planning artifact and rerun validation.

---

## Stage 8 — SMALL SLICE

Implement only the approved representative slice.

The slice must use:

- real route ownership;
- real feature directories;
- real tokens;
- real canonical component imports;
- real state boundaries;
- real fixture or integration adapters;
- one meaningful non-success state;
- one responsive transformation;
- one keyboard or focus interaction;
- tests or stories;
- browser evidence.
- the approved styling authority and retained ownership traces for affected existing classes.

The slice must be directly extendable into the final screen.

Do not create:

- disconnected static mockups;
- throwaway components;
- temporary CSS architecture;
- hardcoded production data inside JSX;
- alternate route structures;
- parallel component systems;
- fake success-only implementations.

While the representative gate is:

```text
blocked
ready
rejected
```

implementation remains constrained to the approved representative slice and its required corrections.

---

## Stage 9 — BUILD

After representative-gate approval, complete the remaining approved implementation in dependency order.

Recommended order:

```text
1. Route and feature boundary.
2. Data validation and mapping.
3. Query, form, URL, route, and feature adapters.
4. Structural recipe regions.
5. Initial loading and data states.
6. Empty, partial, error, permission, unavailable, and stale states.
7. Actions and mutations.
8. Responsive transformations.
9. Keyboard, focus, and announcements.
10. Stories and tests.
11. Browser scenarios.
12. Screenshots and audits.
```

Do not postpone all non-success states until the end.

Do not postpone compact behavior until desktop implementation is complete.

### Required code-quality skills

When the project stack is React, apply `$react-best-practices` (rendering,
re-render, bundle, async/server-fetch idioms) and `$react-composition-patterns`
(compound components, avoiding boolean-prop proliferation, context interface
design, React 19 API changes) while writing components and hooks — not only
during a later review pass. When the project uses Tailwind, apply
`$tailwind-patterns` (v4 CSS-first configuration, container queries, token
architecture) while implementing TOKENS and every component that consumes
them. These are code-idiom skills, distinct from `$frontend-design` (visual
direction) and `04-design-system.md` (token/composition contracts): they
govern how the component is actually written, and their absence is exactly
the class of defect that produces a component reimplementing a native
control instead of composing the catalog one, or a component manually
copying another component's class recipe instead of composing it (see
`04-design-system.md`'s `DS-RECIPE-001`).

---

## Stage 10 — BROWSER

Validate the implementation in a real browser.

### Required tool

Browser validation is not optional narrative; it uses `$playwright-skill`,
regardless of which coding agent or CLI is executing this workflow. Define:

```bash
export PLAYWRIGHT_SKILL_ROOT="${PLAYWRIGHT_SKILL_ROOT:-$HOME/.agents/skills/playwright-skill}"
```

First time in an environment, install its browser once:

```bash
cd "$PLAYWRIGHT_SKILL_ROOT" && npm run setup
```

Every validation pass:

```bash
cd "$PLAYWRIGHT_SKILL_ROOT" && node -e "require('./lib/helpers').detectDevServers().then(s => console.log(JSON.stringify(s)))"
```

Write one parameterized script per viewport/scenario to
`/tmp/playwright-test-<scenario>.js` (never inside the skill or the project),
using the detected URL, then execute it:

```bash
cd "$PLAYWRIGHT_SKILL_ROOT" && node run.js /tmp/playwright-test-<scenario>.js
```

Default to a visible browser (`headless: false`); only pass `headless: true`
when the environment has no display (a remote/CI sandbox), and say so in the
implementation journal when that happens — a headless run is weaker evidence
for visual/interaction validation than a visible one. This exact command
sequence is agent-agnostic: any CLI coding agent with shell access can follow
it, not only one with automatic skill discovery.

### Browser matrix

The specific viewports/engines below are the default, not a universal
truth. When the project declares its own
`docs/frontend/browser-matrix.json`, that file is authoritative instead.
Criticality (from `applicability.md`, see
`skills/spec-driven-engineering/references/applicability-contract.md`)
drives default coverage:

```text
low      → Chromium, representative viewport only
standard → Chromium, full viewport set below
critical → Chromium + Firefox + WebKit, full viewport set below, on every
           critical journey
```

Zoom and text-scaling checks are required whenever applicable regardless of
criticality tier — they are not a coverage dial, they are an accessibility
floor.

Default viewport set, used when no project-specific `browser-matrix.json`
exists:

```text
390x844
1024x768
1440x900
125% browser zoom
200% text scaling
```

Additional viewports may be required by product context.

Validate:

- route loading;
- shell behavior;
- content hierarchy;
- primary task;
- all required screen states;
- responsive transformations;
- local and primary scroll ownership;
- sticky behavior;
- dialogs;
- drawers;
- menus;
- forms;
- tables;
- uploads;
- permissions;
- mutation pending states;
- keyboard operation;
- focus movement;
- announcements;
- reduced motion.

Do not infer browser correctness from source inspection alone.

---

## Stage 11 — SCREENSHOTS

Capture screenshot evidence for the state matrix using the same
`$playwright-skill` session as Stage 10 (`page.screenshot({ path, fullPage })`
inside the same `/tmp/playwright-test-*.js` script, one call per required
state/viewport). Save captured files under
`docs/frontend/screens/<screen-id>/screenshots/` and register each one in
`screenshot-evidence.json`.

Minimum representative coverage normally includes:

- primary data state;
- compact data state;
- initial loading;
- empty state;
- partial or error state;
- permission state when applicable;
- processing state when applicable;
- stale or conflict state when applicable.

Screenshots must use representative fixtures.

Do not use screenshots as a substitute for keyboard, focus, or semantic validation.

---

## Stage 12 — DESIGN-SYSTEM AUDIT

Audit:

- token usage;
- raw colors;
- raw spacing;
- arbitrary width;
- arbitrary radii;
- arbitrary elevation;
- component duplication;
- unsupported variants;
- unsupported component states;
- nested surfaces;
- inconsistent action hierarchy;
- page-level horizontal overflow;
- inaccessible interactions;
- missing focus;
- missing labels;
- tooltip-only critical information;
- incorrect responsive order.
- unauthorized component, feature, page, or BEM selectors in global stylesheets;
- parallel styling architectures;
- existing-class overrides without ownership traces;
- visual-reference drift;
- React/Tailwind idiom drift against `$react-best-practices`, `$react-composition-patterns`, and `$tailwind-patterns` (boolean-prop proliferation, avoidable re-renders, non-idiomatic Tailwind v4 usage).

Patch only verified defects.

Do not perform unbounded aesthetic rewrites during defect correction.

---

## Stage 13 — PATCH

For every verified defect:

```text
evidence
        ↓
contract violated
        ↓
authoritative artifact updated when needed
        ↓
implementation patched
        ↓
affected tests rerun
        ↓
browser scenario revalidated
        ↓
screenshot refreshed when needed
```

Do not fix planning defects through undocumented local JSX exceptions.

Update:

- screen specification;
- state matrix;
- component map;
- implementation plan;
- component catalog;
- design-system contract;
- integration contract;

when the defect proves that the existing contract is incorrect.

---

## Stage 14 — REPORT

Produce a final implementation report containing:

### Implemented

- routes;
- screens;
- states;
- actions;
- integrations;
- responsive behavior;
- accessibility behavior.

### Reused

- existing project architecture;
- existing shared components;
- catalog components;
- existing utilities.

### Extended

- approved component extensions;
- token extensions;
- recipe extensions.

### Created

- feature-specific components;
- approved shared components;
- adapters;
- fixtures;
- tests;
- stories.

### Validated

- viewports;
- browser scenarios;
- keyboard behavior;
- focus behavior;
- announcements;
- zoom;
- reflow;
- screenshots;
- audits.

### Deferred

- explicit out-of-scope work;
- accepted nonblocking risks;
- future integrations.

### Final status

Use one of:

```text
blocked
ready
approved
implemented
```

Do not claim completion when blocking evidence is missing.

---

## 13. Architecture rules

### Dependency direction

Prefer:

```text
screen
    ↓
feature components
    ↓
shared components
    ↓
primitives
```

Data direction:

```text
transport
    ↓
runtime validation
    ↓
DTO
    ↓
mapper
    ↓
frontend model
    ↓
view model
    ↓
screen and components
```

Do not allow shared presentation components to import feature transport or domain endpoints.

### State ownership

Assign each state to one owner:

- `stateless`;
- `local`;
- `controlled`;
- `form-owned`;
- `query-owned`;
- `url-owned`;
- `feature-owned`;
- `route-owned`.

Do not duplicate the same state in:

- local component state;
- form state;
- query state;
- URL state;
- route state;

without an explicit synchronization contract.

### Server state

Use the repository's approved server-state layer.

For the default stack, TanStack Query owns:

- query caching;
- freshness;
- background refresh;
- retry;
- invalidation;
- mutation state.

Presentation components render normalized state and do not parse transport responses.

### Forms

For the default stack:

- React Hook Form owns form state;
- Zod owns runtime validation contracts;
- adapters normalize server errors;
- shared form components do not submit directly;
- mutations remain feature-owned;
- recoverable failures preserve entered values.

---

## 14. Screen-state rules

Evaluate:

- `initial-loading`;
- `data`;
- `empty`;
- `partial`;
- `error`;
- `forbidden`;
- `unavailable`;
- `processing`;
- `success`;
- `stale`.

A state may be not applicable, but it must be evaluated and documented.

### Initial loading

Use only when no usable authoritative screen data is available.

### Background refresh

Preserve usable content, focus, scroll, form values, query, and selection when safe.

Do not replace the complete screen with a skeleton for every request.

### Partial failure

Present failure at the smallest truthful region.

Do not collapse an otherwise usable screen because one secondary region failed.

### Permission

Distinguish:

- route forbidden;
- hidden action;
- disabled action with reason;
- read-only screen;
- redacted region;
- unavailable field;
- backend rejection.

Frontend permission treatment is not the security boundary.

### Stale and conflict

Preserve user work.

Do not silently reload and discard:

- form values;
- review rationale;
- selected evidence;
- pending decision;
- uploaded file state.

---

## 15. Action and mutation rules

Every mutation-like action must define:

- user-facing label;
- semantic kind;
- region;
- owner;
- permission;
- eligibility;
- confirmation;
- pending behavior;
- duplicate prevention;
- idempotency;
- authoritative success;
- error normalization;
- invalidation or reconciliation;
- navigation after success;
- focus after failure.

Do not infer success from local state changes.

Do not leave the primary mutation enabled during its own pending state.

Destructive actions require an explicit safety contract.

A disabled action without an obvious reason requires visible explanation.

When an action's eligibility depends on more than one condition (state,
role, assignee, required evidence, exclusivity, idempotency), implement the
guard logic once as a pure, exported function and import it — never
reimplement it — in every consumer that needs eligibility (a list-row quick
action, a confirmation dialog, a detail-view control) and in the
mutation/execution handler itself. The handler must re-invoke that same
guard function immediately before mutating, never trusting a UI-computed
eligibility flag alone.

When an action's effect is a decision, approval, or conflict resolution,
record a durable audit entry with actor, timestamp, justification, and
result before the action's success state renders, and link every touched
object with a correlation id. A conflict resolution must additionally
preserve the rejected alternative in that audit entry; do not resolve a
conflict by silently discarding it.

---

## 16. Component rules

Every component must have one canonical responsibility.

Parents own spacing between siblings.

Components own their internal spacing.

Layout components own:

- placement;
- width;
- columns;
- regional overflow;
- sticky behavior.

Data-display components do not invent route width.

Feature components may be domain-specific.

Shared components remain domain-neutral.

Do not create a shared abstraction without credible consumers.

Do not create components only because a `div` needs classes.

---

## 17. Responsive rules

Responsive behavior is a product contract.

Define:

- region order;
- column count;
- moved regions;
- collapsed regions;
- hidden secondary content;
- action transformation;
- collection transformation;
- scroll ownership;
- sticky behavior;
- content priority.

Preserve:

- semantic order;
- DOM order;
- keyboard order;
- critical information;
- actions;
- validation;
- status;
- permission explanations.

Do not hide material consequences to fit narrow screens.

Do not introduce page-level horizontal overflow.

---

## 18. Accessibility rules

Require:

- semantic landmarks;
- coherent heading hierarchy;
- visible labels;
- accessible names;
- keyboard operation;
- visible focus;
- predictable focus movement;
- correct dialog focus containment;
- field-error association;
- navigable error summary;
- restrained live-region behavior;
- non-color status meaning;
- reduced-motion behavior;
- zoom and reflow validation.

Do not claim compliance solely from component-library usage.

Do not place essential information only in a tooltip.

Do not visually reorder content in a way that breaks focus order.

---

## 19. Content rules

Use product terminology from:

```text
docs/frontend/product-context.md
```

Do not expose:

- raw HTTP errors;
- stack traces;
- query keys;
- mutation keys;
- capability keys;
- schema paths;
- database identifiers;
- signed URLs;
- storage keys;
- raw DTO enums;
- internal status codes.

Normalize:

- dates;
- timezone;
- numbers;
- currency;
- percentages;
- identifiers;
- enum labels;
- error messages.

Long localized content must remain usable.

Do not apply a confidence-qualifier prefix (for example "Candidate") to a
confirmed operational status. Reserve it for genuinely unconfirmed inference.
A disabled-action reason is one of exactly one `reasonKind` dimension
(permission, dependency, pending-human-decision, business-block,
status-ineligible, technical-error); do not combine two dimensions in one
label, and never classify a dependency the action itself will resolve as a
business blocker.

Before a build intended for external stakeholder viewing (a demo, a pilot, a
client-facing prototype) is presented, scan the rendered, user-facing text —
not the source code — for internal planning language ("not part of this
increment", "out of scope for now"), leftover tooling/vendor artifacts (a
build-tool badge, a placeholder logo), and any string in a language other
than the project's `output-language`. Replace planning language with the
current state, the limitation, and the next available action; do not ship it
verbatim to an external viewer.

---

## 20. Upload rules

Generic upload components must not own:

- upload transport;
- storage SDKs;
- signed URL generation;
- malware scanning;
- authorization;
- persisted deletion;
- download requests.

Distinguish:

```text
selected
queued
uploading
uploaded
processing
accepted
rejected
failed
unavailable
```

Client `accept`, extension, size, and count checks are not complete security validation.

Drag-and-drop is supplementary.

A native accessible file picker remains required.

Do not fabricate upload progress.

---

## 21. Representative gate

The representative gate uses:

```text
blocked
ready
approved
rejected
not-required
```

### `blocked`

Required decisions or evidence are missing.

### `ready`

Evidence is complete and awaiting explicit approval.

Broad implementation remains blocked.

### `approved`

The representative slice passed review.

Broader implementation may continue.

### `rejected`

The slice failed review and must be corrected.

### `not-required`

An explicitly approved exception with rationale.

This status should be uncommon.

Required checks are:

```text
GATE-001  Primary task and category
GATE-002  Recipe and regions
GATE-003  State matrix
GATE-004  Component map
GATE-005  Ownership
GATE-006  Fixtures
GATE-007  Production architecture and styling authority
GATE-008  Responsive validation
GATE-009  Accessibility validation
GATE-010  Screenshots, design-system, styling and reference audits
GATE-011  Defect patching and revalidation
GATE-012  Absence of unresolved blockers
GATE-013  Behavioral Adversarial Review (only when a HIGH-RISK Behavioral UX
          surface applies — see references/14-behavioral-ux.md)
```

Do not approve the gate without retained evidence.

### Behavioral Adversarial Review (GATE-013)

When `applicability.behavioral-ux-risk: high-risk` (pricing, upgrade,
renewal, retention, cancellation, or any surface touching consent,
privacy, security, permissions, financial commitment, or data deletion),
answer every question below in writing, with evidence, before the
representative gate can be `approved`:

```text
Does the user understand the consequence?
Does the recommendation benefit the user?
Is the default easy to change?
Is there material information hidden?
Is there fabricated urgency?
Is there fabricated progress?
Is there an indefensible comparison?
Is loss framing exaggerated?
Do accept and decline have proportionate visibility?
Is cancelling materially harder than subscribing?
Does the metric improve by sacrificing trust?
Are we using a bias to compensate for a lack of real product value?
Would this decision still look reasonable if all information were
equally clear?
```

The last question is the strongest heuristic against deceptive design: if
the answer is no, the intervention is not release-ready regardless of its
projected metric impact. A `PROHIBITED` pattern found during this review
(see `references/14-behavioral-ux.md`) is a blocker, never a risk to
accept.

### Human review runbook

When the gate is `ready` and awaiting a person, do not stop at “approval required.” Run every safe automated validation available to the agent, then give the reviewer an evidence-based runbook with the real project `cwd`, package-manager command, ready signal, URL and route/story, safe fixture assumptions, viewports, states, keyboard path, visual-reference checklist, expected outcomes, evidence to return, and shutdown command. Separate terminals for long-running processes. Never invent a script, port or URL.

Provide scoped approve and reject responses containing the real gate and slice IDs. Running the application or seeing passing tests is evidence, not approval. Do not record the approver or release broad `BUILD` until the human explicitly approves the reviewed slice.

---

## 22. Stop conditions

Stop and return to the authoritative planning artifact when:

- the primary user task is unclear;
- route ownership is ambiguous;
- two recipes appear equally dominant;
- tenant or organization scope is unknown;
- permission behavior is unknown;
- a destructive operation lacks a safety contract;
- mutation completion authority is unclear;
- idempotency is undefined;
- temporal or timezone meaning is ambiguous;
- upload validation or completion meaning is undefined;
- review authority is unclear;
- stale behavior could discard user work;
- an accessible interaction model is not viable;
- a new component duplicates an existing responsibility;
- a required integration contract is missing;
- implementation requires an unapproved migration;
- representative fixtures would conceal a critical unknown.

Do not convert a blocker into an assumption merely to continue.

---

## 23. Prohibited implementation behavior

Do not:

- begin from a blank JSX page;
- implement only the success state;
- shape the screen directly from one endpoint;
- create components before catalog inspection;
- select a recipe only by appearance;
- choose a representative screen only because it is easy;
- create a throwaway representative slice;
- use fake production data inside JSX;
- erase usable content during background refresh;
- turn local failure into full-screen failure;
- treat permission as generic error;
- use raw transport errors in the interface;
- enable duplicate mutations;
- mark optimistic local state as persisted success;
- hide disabled-action reasons;
- resolve conflicts by silently discarding local work;
- perform broad implementation before representative approval;
- inject a global selector because an existing class definition was not found;
- create a parallel styling architecture or bypass the approved styling authority;
- treat Storybook as sufficient representative-gate evidence;
- fabricate test, browser, screenshot, or audit evidence.

---

## 24. Completion criteria

The work is complete only when:

- product context exists;
- design direction exists;
- styling authority exists and validates;
- architecture exists;
- design system exists;
- component catalog exists;
- integration contracts exist when applicable;
- screen planning package exists;
- screen specification validates;
- cross-reference audits pass;
- component coverage passes;
- action-state coverage passes;
- data ownership passes;
- representative gate is approved or explicitly not required;
- required states are implemented;
- required viewports are validated;
- keyboard and focus behavior are validated;
- screenshots exist;
- design-system audit is complete;
- component audit is complete;
- accessibility audit is complete;
- blocking defects are patched;
- readiness report releases the final workflow stage;
- final report is truthful.

Do not state that the frontend is production-ready when these conditions are not supported by evidence.
