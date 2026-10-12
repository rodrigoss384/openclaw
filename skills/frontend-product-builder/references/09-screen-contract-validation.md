# Screen Contract Validation

## Purpose

This reference defines the automated validation pipeline applied to:

```text
docs/frontend/screens/<screen-id>/screen-spec.json
```

The validation pipeline protects the transition from planning to implementation.

It verifies:

- JSON syntax;
- JSON Schema compliance;
- unresolved placeholders;
- identifier uniqueness;
- cross-file references;
- region references;
- component ownership;
- catalog compatibility;
- action-state coverage;
- data ownership;
- mutation boundaries;
- representative-gate consistency;
- planning-artifact availability;
- readiness for `SMALL SLICE`;
- readiness for broader `BUILD`.
- workflow 2.2 visual composition readiness for substantial frontend work.

The scripts diagnose contract defects.

They must not silently rewrite product, architecture, component, permission, data, or safety decisions.

For workflow 2.2, legacy screen contracts remain readable, but they do not
release a substantial frontend broad build until `visualHierarchy` and the
composition proof are completed.

---

## 1. Validation pipeline

Run the scripts in this order:

```text
validate-screen-specification.mjs
        ↓
audit-screen-spec-references.mjs
        ↓
audit-screen-component-coverage.mjs
        ↓
audit-screen-action-state-coverage.mjs
        ↓
audit-screen-data-ownership.mjs
        ↓
validate-visual-composition-contract.mjs
        ↓
audit-representative-gate.mjs
        ↓
report-screen-readiness.mjs
```

When a substantial frontend surface is in scope, run:

```bash
node "$SKILL_ROOT/scripts/validate-visual-composition-contract.mjs" \
  docs/frontend/screens/<screen-id>/screen-spec.json \
  docs/frontend/design-system/design-system.json \
  docs/frontend/screens/<screen-id>/composition-proof.json
```

The consolidated command is:

```powershell
node scripts/report-screen-readiness.mjs `
  docs/frontend/screens/<screen-id>/screen-spec.json
```

When the scripts are still in staging:

```powershell
node ~/.agents/skills/frontend-product-builder/scripts/report-screen-readiness.mjs `
  docs/frontend/screens/<screen-id>/screen-spec.json
```

---

## 2. Validation modes

### Full validation

Full validation runs JSON Schema Draft 2020-12 through:

```text
ajv
ajv-formats
```

Use the package manager already selected by the repository.

Do not introduce another package manager only for the validator.

### Structural-only validation

Use:

```powershell
node scripts/report-screen-readiness.mjs `
  docs/frontend/screens/<screen-id>/screen-spec.json `
  --structural-only
```

This mode skips complete JSON Schema execution.

It remains useful before dependency approval, but it is not equivalent to full validation.

A structural-only readiness report must not be treated as final gate evidence when full schema validation is required.

### Strict warnings

Use:

```powershell
node scripts/report-screen-readiness.mjs `
  docs/frontend/screens/<screen-id>/screen-spec.json `
  --strict-warnings
```

In this mode, warnings block readiness.

Strict warnings are appropriate for:

- representative-screen approval;
- CI merge gates;
- release preparation;
- design-system stabilization;
- component-catalog stabilization.

---

## 3. Exit-code behavior

Each audit returns:

```text
0
```

when no blocking issue exists.

It returns:

```text
1
```

when:

- one or more errors exist;
- strict warnings are enabled and warnings exist;
- the consolidated readiness report does not release `SMALL SLICE`.

A command that exits successfully is evidence only when:

- the command was actually executed;
- the correct specification path was used;
- output was retained when required;
- structural-only limitations are documented;
- warnings were reviewed.

---

## 4. Machine-readable output

Every audit supports:

```text
--json
```

Example:

```powershell
node scripts/audit-screen-data-ownership.mjs `
  docs/frontend/screens/customer-list/screen-spec.json `
  --json
```

The output contract is:

```json
{
  "title": "Screen Data Ownership Audit",
  "summary": {
    "errors": 0,
    "warnings": 1,
    "information": 4,
    "total": 5
  },
  "issues": []
}
```

The consolidated readiness report is written by default to:

```text
docs/frontend/screens/<screen-id>/readiness-report.json
```

A custom destination may be supplied as the second positional argument:

```powershell
node scripts/report-screen-readiness.mjs `
  docs/frontend/screens/customer-list/screen-spec.json `
  artifacts/frontend/customer-list-readiness.json
```

---

## 5. Specification validation

`validate-screen-specification.mjs` verifies:

- JSON syntax;
- required top-level blocks;
- unresolved `<placeholder>` values;
- duplicate region IDs;
- duplicate component-usage IDs;
- duplicate dependency IDs;
- duplicate state IDs;
- duplicate action IDs;
- duplicate implementation-step IDs;
- duplicate implementation-step order;
- duplicate gate-check IDs;
- basic representative-gate consistency;
- JSON Schema compliance.

A syntactically valid JSON file is not necessarily a valid screen specification.

---

## 6. Reference audit

`audit-screen-spec-references.mjs` verifies that:

- component usages reference existing screen regions;
- actions reference existing screen regions;
- state component references exist;
- visible regions exist;
- hidden regions exist;
- actions referenced by states exist;
- one action is not enabled and disabled simultaneously;
- one region is not visible and hidden simultaneously;
- product-context source exists;
- design-direction source exists;
- frontend-architecture source exists;
- selected recipe exists;
- integration contracts are available;
- fixture references are resolvable.

Missing project artifacts must not be replaced by invented assumptions.

---

## 7. Component coverage audit

`audit-screen-component-coverage.mjs` verifies:

- every active recipe region has component ownership;
- omitted recipe regions are not accidentally implemented;
- canonical components exist in their declared catalog;
- variants exist;
- sizes exist;
- component states exist;
- extended usages contain an extension contract;
- new proposals contain a proposed-component contract;
- fallbacks are explicit;
- generic visual responsibilities are reviewed.

A `div` does not become an approved component merely because it has several classes.

---

## 8. Action and state audit

`audit-screen-action-state-coverage.mjs` verifies:

- visible-region actions are enabled or disabled explicitly;
- hidden-region actions are not enabled;
- every action receives state coverage;
- no state enables several primary actions;
- mutation actions are not available during their own processing state;
- forbidden states do not expose mutation actions;
- stale states do not proceed without review;
- error and unavailable states provide recovery;
- mutation actions define idempotency;
- duplicate prevention is explicit;
- destructive actions define confirmation;
- successful mutation behavior identifies authoritative completion;
- technical state IDs and technical user-facing reasons are reviewed.

State behavior must describe what the user can understand and do.

---

## 9. Data-ownership audit

`audit-screen-data-ownership.mjs` verifies:

- architecture ownership fields are explicit;
- data dependencies have real owners;
- presentation components do not own transport;
- authoritative sources are named;
- mapping is explicit;
- query cache and retry policies exist;
- interactive queries consider cancellation;
- mutation invalidation or reconciliation is explicit;
- component state ownership matches dependency types;
- form-owned components have form ownership;
- URL-owned components have URL ownership;
- mutation actions match mutation dependencies;
- unused dependencies are reviewed;
- backend permission authority remains explicit.

The required boundary remains:

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
screen
```

---

## 10. Representative-gate audit

`audit-representative-gate.mjs` verifies:

- gate identity;
- gate enablement;
- representative-screen designation;
- representative-slice consistency;
- all twelve gate checks;
- check evidence;
- blocked, ready, approved, rejected, and not-required consistency;
- unresolved product questions;
- implementation blockers;
- approval identity and date;
- planning artifacts;
- evidence-file existence;
- screenshot evidence;
- specification status compatibility.

The required checks are:

```text
GATE-001  Primary task and category
GATE-002  Recipe and regions
GATE-003  State matrix
GATE-004  Component map
GATE-005  Ownership
GATE-006  Fixtures
GATE-007  Production architecture
GATE-008  Responsive validation
GATE-009  Accessibility validation
GATE-010  Screenshots and audits
GATE-011  Defect patching and revalidation
GATE-012  Absence of unresolved blockers
```

---

## 11. Readiness statuses

The consolidated report may return:

### `blocked`

One or more audit errors exist, or strict warnings are blocking.

The workflow remains in:

```text
PLAN
```

### `planning-incomplete`

Automated audits do not contain blocking errors, but planning status, questions, blockers, or approval state remain incomplete.

The workflow remains in:

```text
PLAN
```

### `ready-for-small-slice`

The specification is ready or approved, no blockers remain, and automated audits pass.

The workflow may enter:

```text
SMALL SLICE
```

The representative gate may still be blocked because the slice has not yet been implemented and validated.

### `representative-ready-for-review`

The representative slice has evidence and the gate is marked ready.

The workflow remains limited to representative review until explicit approval.

### `broad-build-approved`

The representative gate is approved or explicitly not required, and automated audits pass.

The workflow may enter broader:

```text
BUILD
```

---

## 12. Planning release versus build release

These are separate decisions.

### Release to `SMALL SLICE`

Requires:

- valid screen specification;
- approved state matrix;
- approved component map;
- approved implementation plan;
- no unresolved product questions;
- no unresolved blockers;
- passing automated contract audits;
- specification status `ready`, `approved`, or `implemented`.

The representative gate may remain:

```text
blocked
```

because representative implementation evidence does not exist yet.

### Release to broader `BUILD`

Requires:

- completed representative slice;
- browser validation;
- screenshots;
- component audit;
- design-system audit;
- accessibility audit;
- responsive audit;
- defect patching;
- representative gate `approved`;
- passing readiness report.

---

## 13. Warning policy

Warnings indicate suspicious or incomplete conditions that may still be legitimate.

Examples:

- a standard state category is absent from the JSON but documented as not applicable in the state matrix;
- a dependency owner uses an unusual but valid project convention;
- a canonical component extension is being introduced;
- a mutation remains enabled in stale state because the backend safely merges revisions;
- a planning evidence string is descriptive rather than a file path.

Warnings require review.

They must not be ignored mechanically.

Use `--strict-warnings` when the project expects every warning to be resolved or formally accepted.

---

## 14. Failure triage order

When the consolidated report fails, fix issues in this order:

```text
1. JSON syntax.
2. JSON Schema.
3. Placeholders.
4. Duplicate IDs.
5. Invalid references.
6. Missing regions.
7. Missing or invalid component contracts.
8. Action-state coverage.
9. Data and mutation ownership.
10. Product questions and blockers.
11. Representative-gate evidence.
12. Readiness status.
```

Do not patch later-stage symptoms while earlier structural defects remain.

---

## 15. Evidence handling

Valid evidence includes:

- screen specification path;
- state matrix path;
- component map path;
- implementation plan path;
- fixture path;
- Storybook story path;
- test path;
- browser-test report;
- screenshot path;
- accessibility report;
- design-system audit;
- component audit;
- documented approval.

Evidence should use stable repository-relative paths where possible.

Do not use:

- temporary local paths;
- unstored screenshots;
- terminal claims without retained output;
- “looks good”;
- “should pass”;
- unexecuted commands;
- fabricated test results.

---

## 16. Continuous integration

A project may expose an approved package command such as:

```json
{
  "scripts": {
    "frontend:screen:validate": "node scripts/report-screen-readiness.mjs"
  }
}
```

Do not add package scripts without inspecting the existing package manager and command conventions.

A CI invocation may use:

```powershell
node scripts/report-screen-readiness.mjs `
  docs/frontend/screens/customer-list/screen-spec.json `
  artifacts/customer-list-readiness.json `
  --strict-warnings
```

Store the generated report as a build artifact when the delivery workflow requires traceability.

---

## 17. No silent auto-fix

The validation pipeline must not automatically:

- choose a recipe;
- rename regions;
- create components;
- change permissions;
- add mutation policies;
- declare idempotency;
- resolve product questions;
- approve gate checks;
- fabricate evidence;
- remove warnings;
- set approval names or dates.

These decisions require product, design, architecture, implementation, or human-review evidence.

---

## 18. Stop conditions

Stop before implementation when validation reveals:

- ambiguous primary task;
- missing recipe;
- region without ownership;
- permission uncertainty;
- mutation without authority;
- destructive action without safety policy;
- missing temporal semantics;
- undefined upload completion;
- stale behavior that could discard work;
- inaccessible interaction;
- component duplication;
- missing planning artifacts;
- unresolved blockers disguised as assumptions.

The correct response is:

```text
return to planning
        ↓
update authoritative artifact
        ↓
rerun validation
```

Do not add a local JSX exception.

---

## 19. Required command sequence

Before `SMALL SLICE`:

```powershell
$spec = `
  ".\docs\frontend\screens\<screen-id>\screen-spec.json"

node `
  ".\scripts\validate-screen-specification.mjs" `
  $spec

node `
  ".\scripts\audit-screen-spec-references.mjs" `
  $spec

node `
  ".\scripts\audit-screen-component-coverage.mjs" `
  $spec

node `
  ".\scripts\audit-screen-action-state-coverage.mjs" `
  $spec

node `
  ".\scripts\audit-screen-data-ownership.mjs" `
  $spec

node `
  ".\scripts\audit-representative-gate.mjs" `
  $spec

node `
  ".\scripts\report-screen-readiness.mjs" `
  $spec
```

The consolidated report does not eliminate the value of individual audit output during diagnosis.

---

## 20. Required output package

After planning validation:

```text
docs/frontend/screens/<screen-id>/
├── screen-spec.json
├── state-matrix.md
├── component-map.md
├── implementation-plan.md
└── readiness-report.json
```

After representative implementation validation, the same directory or an approved evidence directory should also reference:

```text
screenshots/
browser-report/
accessibility-report/
design-system-audit/
component-audit/
```

The exact evidence structure follows the repository architecture, but all references must remain traceable.
