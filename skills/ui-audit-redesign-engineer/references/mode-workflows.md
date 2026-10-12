# Mode Workflows

## Audit mode workflow

1. Confirm available inputs: screenshots, running app, repo, design file, Storybook, tests.
2. Inspect the product surface:
   - global shell and navigation;
   - representative pages;
   - shared components;
   - duplicated local components;
   - global styles and tokens;
   - styling authority, stylesheet imports, selector ownership and global CSS boundaries;
   - hardcoded colors, spacing, sizes, z-indexes, and shadows.
3. Classify findings:
   - `Critical`: blocks use, accessibility, trust, or legal/operational clarity;
   - `High`: damages comprehension, hierarchy, or key flow completion;
   - `Medium`: inconsistency, polish, responsive weakness;
   - `Low`: minor refinement or nice-to-have.
4. Separate:
   - visual issue;
   - functional behavior;
   - pre-existing bug;
   - missing design decision.
5. Produce audit, component inventory, and draft remediation plan when requested.

## Plan mode workflow

1. Treat the audit as source material, not as permission to implement everything.
2. Group work into reviewable lots.
3. For each lot, define:
   - objective;
   - included screens/components;
   - excluded changes;
   - dependencies;
   - risk level;
   - acceptance criteria;
   - validation steps.
4. Prioritize foundation and shared components before broad screen work.
5. Keep business/API/domain changes out of scope.

## Implement mode workflow

1. Identify the exact lot requested.
2. Inspect repository status and local instructions.
3. Locate affected files and shared components.
4. Trace every affected existing class to its definition, import/cascade and owner; block unresolved ownership instead of creating a global override.
5. Prefer token/component changes that improve multiple surfaces safely.
6. Change only the scoped files/areas using the approved styling mechanism.
7. Preserve behavior and data flow.
8. Run relevant checks, including global stylesheet and raw-value audits.
9. Update task/status artifacts if the project uses them.

## Validate mode workflow

1. Identify the lot or diff to validate.
2. Run available static checks and tests.
3. Validate representative viewports.
4. Exercise keyboard navigation and focus.
5. Check loading, empty, error, long-content, and restricted-permission states where applicable.
6. Compare before/after screenshots when available.
7. Report pass/fail/blocked items and required follow-ups.

## Suggested artifact sequence

1. `docs/ui/ui-audit.md`
2. `docs/ui/component-inventory.md`
3. `docs/ui/ui-remediation-plan-draft.md`
4. approved implementation task list
5. per-lot validation report
