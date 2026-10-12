# Small Slice Validation

## Purpose

This reference defines the automated validation and evidence-reconciliation pipeline for a production-intended representative frontend slice.

The pipeline operates on:

```text
docs/frontend/screens/<screen-id>/small-slice-manifest.json
```

It protects the transition from:

```text
SMALL SLICE implementation
        ↓
representative review
        ↓
representative gate ready
        ↓
explicit approval
        ↓
broader BUILD
```

The pipeline does not approve the representative gate automatically.

---

## 1. Required execution artifacts

The screen directory should contain:

```text
docs/frontend/screens/<screen-id>/
├── screen-spec.json
├── state-matrix.md
├── component-map.md
├── implementation-plan.md
├── readiness-report.json
├── repository-inspection.md
├── fixture-strategy.md
├── small-slice-manifest.json
├── small-slice-implementation-journal.md
├── browser-validation.md
├── screenshot-evidence.json
├── composition-proof.json
├── visual-composition-evidence.json
├── visual-quality-scorecard.json
├── design-system-audit.md
├── defect-log.md
└── representative-gate-preparation.json
```

Implementation evidence may additionally include:

```text
screenshots/
browser-report/
accessibility-report/
component-audit/
test-results/
```

---

## 2. Validation pipeline

Run:

```text
validate-small-slice-manifest.mjs
        ↓
audit-small-slice-files.mjs
        ↓
audit-small-slice-scope.mjs
        ↓
audit-small-slice-evidence.mjs
        ↓
validate-visual-composition-contract.mjs
        ↓
audit-visual-composition-evidence.mjs
        ↓
validate-visual-quality-scorecard.mjs
        ↓
validate-styling-authority.mjs
        ↓
audit-styling-authority.mjs
        ↓
prepare-representative-gate.mjs
```

For Linux and Bash:

```bash
SKILL_ROOT="${SKILL_ROOT:-$HOME/.agents/skills/frontend-product-builder}"

MANIFEST="docs/frontend/screens/<screen-id>/small-slice-manifest.json"

node "$SKILL_ROOT/scripts/validate-small-slice-manifest.mjs" \
  "$MANIFEST"

node "$SKILL_ROOT/scripts/audit-small-slice-files.mjs" \
  "$MANIFEST"

node "$SKILL_ROOT/scripts/audit-small-slice-scope.mjs" \
  "$MANIFEST"

node "$SKILL_ROOT/scripts/audit-small-slice-evidence.mjs" \
  "$MANIFEST"

node "$SKILL_ROOT/scripts/validate-visual-composition-contract.mjs" \
  "docs/frontend/screens/<screen-id>/screen-spec.json" \
  "docs/frontend/design-system/design-system.json" \
  "docs/frontend/screens/<screen-id>/composition-proof.json"

node "$SKILL_ROOT/scripts/audit-visual-composition-evidence.mjs" \
  "docs/frontend/screens/<screen-id>/screen-spec.json" \
  "docs/frontend/design-system/design-system.json" \
  "docs/frontend/screens/<screen-id>/composition-proof.json" \
  "docs/frontend/screens/<screen-id>/visual-composition-evidence.json"

node "$SKILL_ROOT/scripts/validate-visual-quality-scorecard.mjs" \
  "docs/frontend/screens/<screen-id>/visual-quality-scorecard.json"

node "$SKILL_ROOT/scripts/validate-styling-authority.mjs" \
  "docs/frontend/styling-authority.json"

node "$SKILL_ROOT/scripts/audit-styling-authority.mjs" \
  "docs/frontend/styling-authority.json" \
  "."

node "$SKILL_ROOT/scripts/prepare-representative-gate.mjs" \
  "$MANIFEST"
```

Run commands from the project repository root.

Run composition audit before design-system audit. If the implementation needs
to change reading path, focal point, typography roles, region priority, or action
hierarchy, return to design readiness instead of patching around the approved
contract.

---

## 3. Baseline model

File and scope audits compare the current repository against:

```text
repository.baselineCommit
```

The baseline must identify the repository state immediately before small-slice implementation.

The manifest also records:

```text
repository.baselineBranch
repository.baselineCapturedAt
repository.preExistingChanges
```

### Pre-existing changes

A pre-existing change is a file that already differed from the baseline before the slice began.

Each entry must state:

- path;
- status;
- handling.

Example:

```json
{
  "path": "src/existing-file.ts",
  "status": "modified",
  "handling": "Preserve and exclude from slice ownership."
}
```

Do not add a path to `preExistingChanges` merely to hide an undeclared slice change.

---

## 4. File audit

`audit-small-slice-files.mjs` compares:

```text
baseline commit
        ↓
current tracked changes
        +
current untracked files
```

against:

```text
manifest.files
manifest.evidence
planning artifact references
preExistingChanges
```

The audit verifies:

- every actual slice change is declared;
- every created file exists;
- every modified file changed;
- every removed file is removed;
- inspected and reused files remain unchanged;
- evidence and planning artifacts are explicitly referenced;
- pre-existing changes are not attributed to the slice;
- file actions match Git status.

### Action semantics

```text
inspect
```

The file must exist and must not be changed by the slice.

```text
reuse
```

The file must exist and must not be changed by the slice.

```text
create
```

The file must appear as added or untracked relative to the baseline.

```text
modify
```

The file must appear as modified relative to the baseline.

```text
remove
```

The file must be absent and appear removed relative to the baseline.

---

## 5. Scope audit

`audit-small-slice-scope.mjs` verifies:

- package-manager authority;
- authoritative lockfile;
- dependency changes;
- migration approval;
- application-package boundary;
- route expansion;
- temporary path names;
- scope blockers;
- triggered stop conditions;
- installed-skill path policy.

### Dependency approval

Every dependency addition, update, or removal must be declared in:

```text
scope.approvedDependencyChanges
```

Example:

```json
{
  "name": "@example/package",
  "packageFile": "apps/web/package.json",
  "change": "add",
  "reason": "Required by the approved interaction contract.",
  "approved": true
}
```

The audit compares dependency sections from the baseline and current package files.

Compared sections:

```text
dependencies
devDependencies
peerDependencies
optionalDependencies
```

### Lockfile policy

Only the declared authoritative lockfile may change.

Changing another lockfile indicates:

- incorrect package-manager use;
- accidental lockfile generation;
- unapproved migration;
- repository inconsistency.

---

## 6. Evidence audit

`audit-small-slice-evidence.mjs` verifies:

- required evidence types exist;
- completed evidence paths exist;
- evidence files are non-empty;
- required evidence is complete before manifest validation;
- Markdown gate markers are validated;
- screenshots use safe synthetic fixtures;
- screenshot files exist;
- required screenshot captures are approved;
- screenshot checks pass;
- screenshot approvals contain identity and date;
- browser validation references captures;
- individual screenshot evidence appears in the registry;
- unresolved placeholders are absent.

Required execution evidence types:

```text
implementation-journal
browser-validation
screenshot-registry
design-system-audit
defect-log
```

### Sibling-scope isolation test

When the screen's `dataDependency` declares `scopeResolution` (see
`references/08-screen-planning.md` §15 "Hierarchical scope resolution") and
the product has a `productContext.scope.scopeHierarchy` with more than one
level, the implementation plan and test suite must include a dedicated
sibling-scope isolation test, not only the generic tests already listed:

- a fixture with at least two sibling entities sharing the same coarser
  ancestor id (for example two cases belonging to the same client);
- an assertion that a scoped/detail view of one sibling contains zero
  objects belonging to the other sibling;
- the same assertion re-run after every mutation-type action available on
  that screen, since an action can reintroduce a leak that a load-time-only
  test would miss.

This test category exists because a cross-sibling data leak (an object from
one case appearing inside another case of the same client) is not caught by
a screenshot, a schema-valid fixture, or a generic "protect the business
rule" test written without this invariant explicitly in mind. Its absence is
a blocking gap in the implementation plan whenever `scopeHierarchy` applies,
not merely a nice-to-have.

---

## 7. Evidence completion status

Completion is recorded in one place: each `evidence[]` entry's own `status`
field in `small-slice-manifest.json`, which is schema-validated against
`planned | available | passed | failed | not-applicable`.

`audit-small-slice-evidence.mjs` and `prepare-representative-gate.mjs` both
require `status: "passed"` for these four evidence types, and GATE-008
(responsive), GATE-009 (accessibility), GATE-010 (audits) and GATE-011
(defects) derive from it:

- `implementation-journal`
- `browser-validation`
- `design-system-audit`
- `defect-log`

```json
{ "id": "browser-validation-evidence", "type": "browser-validation",
  "path": "docs/frontend/screens/<screen-id>/browser-validation.md",
  "status": "passed" }
```

The narrative bodies of those files are still read, but only to reject
unresolved placeholders. A bolded status marker inside the Markdown
(`**Gate status:** ...`) is human-readable prose with no mechanical effect —
it does not release any gate. Writing one is optional; setting the wrong
`status` blocks the gate regardless of what the prose says.

---

## 8. Screenshot registry

The registry is:

```text
docs/frontend/screens/<screen-id>/screenshot-evidence.json
```

When the manifest is validated:

```text
meta.status
```

must be:

```text
validated
```

Every required capture must be:

```text
approved
```

An approved capture requires:

- non-empty image file;
- `capturedAt`;
- `approvedBy`;
- `approvedAt`;
- no failed or pending applicable check;
- safe synthetic fixture;
- accurate viewport;
- accurate state;
- browser-validation reference.

The registry must explicitly declare:

```json
{
  "containsProductionData": false,
  "containsSecrets": false,
  "syntheticFixturesOnly": true
}
```

---

## 9. Representative-gate preparation

`prepare-representative-gate.mjs` executes the four slice audits plus styling-contract validation and global-stylesheet audit, then creates:

```text
representative-gate-preparation.json
```

The artifact contains:

- aggregate audit summary;
- blockers;
- all twelve gate checks;
- evidence references;
- recommended gate status;
- manual action requirement.

Possible preparation statuses:

```text
blocked
ready-for-review
```

Possible recommendations:

```text
blocked
ready
```

The script never recommends:

```text
approved
```

Approval requires an explicit human decision.

The preparation report must be accompanied by an actionable reviewer runbook. Use real repository commands and paths, state the ready signal and exact URL/route/story, list representative states/viewports/keyboard actions and approved visual-reference aspects, explain how to stop the process, and provide scoped approve/reject responses with real IDs. Run automatable checks before handoff. A successful command or completed checklist does not itself change the gate status.

---

## 10. Gate-check mapping

```text
GATE-001  Primary task and category
GATE-002  Recipe and regions
GATE-003  State matrix
GATE-004  Component map
GATE-005  Ownership
GATE-006  Fixtures
GATE-007  Production implementation path
GATE-008  Responsive browser validation
GATE-009  Accessibility validation
GATE-010  Screenshots and audits
GATE-011  Defect patching and revalidation
GATE-012  Absence of blockers
```

Each check is prepared as:

```text
passed
pending
failed
```

The preparation artifact does not modify the gate in `screen-spec.json`.

---

## 11. Structural-only mode

The manifest validator supports:

```bash
--structural-only
```

This skips full JSON Schema validation.

Structural-only validation cannot release representative review.

The preparation script must remain:

```text
blocked
```

when:

- the current run uses structural-only mode;
- the referenced readiness report was generated in structural-only mode.

---

## 12. Strict-warning mode

Use:

```bash
--strict-warnings
```

for:

- representative review;
- CI;
- design-system stabilization;
- component-system stabilization;
- release preparation.

In this mode, warnings block gate preparation.

Example:

```bash
node "$HOME/.agents/skills/frontend-product-builder/scripts/prepare-representative-gate.mjs" \
  "docs/frontend/screens/customer-list/small-slice-manifest.json" \
  --strict-warnings
```

---

## 13. Output path

Default:

```text
docs/frontend/screens/<screen-id>/representative-gate-preparation.json
```

Custom:

```bash
node "$HOME/.agents/skills/frontend-product-builder/scripts/prepare-representative-gate.mjs" \
  "docs/frontend/screens/customer-list/small-slice-manifest.json" \
  "artifacts/customer-list-gate-preparation.json"
```

---

## 14. Exit codes

Individual audits return:

```text
0
```

when no blocking error exists.

They return:

```text
1
```

when errors exist or strict warnings are blocking.

Gate preparation returns:

```text
0
```

only when:

```text
preparation.status = ready-for-review
```

It returns:

```text
1
```

while preparation remains blocked.

A blocked preparation report is still written to disk for diagnosis.

---

## 15. Correct execution order

Before implementation:

```text
screen readiness
repository inspection
fixture strategy
manifest validation
```

During implementation:

```text
implementation journal
file checkpoints
scope checkpoints
tests
browser validation
screenshots
defect logging
patching
revalidation
```

Before representative review:

```text
manifest status = validated
file audit passes
scope audit passes
evidence audit passes
browser gate = validated
design-system audit gate = validated
defect-log gate = validated
required screenshots = approved
no blocker remains
gate preparation = ready-for-review
```

---

## 16. No automatic approval

The scripts must not:

- change `representativeGate.status`;
- insert an approver;
- insert an approval date;
- set a gate check to passed without evidence;
- fabricate screenshot paths;
- mark defects resolved;
- remove blockers;
- alter file plans;
- approve dependency changes;
- modify product decisions.

After preparation reaches:

```text
ready-for-review
```

a reviewer must inspect:

```text
representative-gate-preparation.json
```

and manually update:

```text
screen-spec.json
```

to:

```text
representativeGate.status = ready
```

The later transition to:

```text
approved
```

requires explicit approval identity, date, and evidence.

---

## 17. Failure triage

Fix failures in this order:

```text
1. Manifest JSON syntax.
2. Manifest schema.
3. Unresolved placeholders.
4. Baseline commit and branch.
5. Missing project references.
6. Undeclared files.
7. File-action mismatches.
8. Unapproved dependency changes.
9. Lockfile or package-manager conflict.
10. Scope expansion.
11. Missing execution evidence.
12. Browser-validation status.
13. Screenshot approval.
14. Design-system audit.
15. Open defects.
16. Gate preparation.
```

Do not patch evidence artifacts to conceal a failing implementation.

---

## 18. Required final commands

```bash
SKILL_ROOT="${SKILL_ROOT:-$HOME/.agents/skills/frontend-product-builder}"

MANIFEST="docs/frontend/screens/<screen-id>/small-slice-manifest.json"

node "$SKILL_ROOT/scripts/validate-small-slice-manifest.mjs" \
  "$MANIFEST" \
  --strict-warnings

node "$SKILL_ROOT/scripts/audit-small-slice-files.mjs" \
  "$MANIFEST" \
  --strict-warnings

node "$SKILL_ROOT/scripts/audit-small-slice-scope.mjs" \
  "$MANIFEST" \
  --strict-warnings

node "$SKILL_ROOT/scripts/audit-small-slice-evidence.mjs" \
  "$MANIFEST" \
  --strict-warnings

node "$SKILL_ROOT/scripts/validate-styling-authority.mjs" \
  "docs/frontend/styling-authority.json" \
  --strict-warnings

node "$SKILL_ROOT/scripts/audit-styling-authority.mjs" \
  "docs/frontend/styling-authority.json" \
  "." \
  --strict-warnings

node "$SKILL_ROOT/scripts/prepare-representative-gate.mjs" \
  "$MANIFEST" \
  --strict-warnings
```

Run from the project repository root.

---

## 19. Completion criteria

The representative slice is ready for review only when:

- manifest validates fully;
- baseline is valid;
- files reconcile;
- scope remains bounded;
- dependency changes are approved;
- authoritative lockfile is preserved;
- fixtures are safe;
- browser validation passes;
- required screenshots are approved;
- design-system audit passes;
- styling authority validates and matches changed files;
- affected existing classes have ownership traces;
- no unauthorized component, page, or BEM selector was added to a global stylesheet;
- screenshots were compared against approved visual-reference aspects;
- defect log is validated;
- no blocking defect remains;
- no stop condition remains triggered;
- all twelve gate checks pass;
- styling authority and registered global stylesheets pass;
- gate preparation returns `ready-for-review`.

This does not itself constitute approval.


## Phase 5 theme-aware operational evidence

For substantial frontend slices, browser evidence must make theme, surface hierarchy, spatial fit, semantic presentation, presence signals, rendered interactions, wayfinding, reusable-reference utility and required decision signals machine-readable in `visual-composition-evidence.json`. Run `audit-theme-operational-evidence.mjs` with the screen specification, Design System, derived craft contract and visual evidence. This audit is objective evidence; it does not replace Impeccable critique or the human representative gate.
