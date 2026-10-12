# UI Remediation Plan

Date: `<YYYY-MM-DD>`
Source: `<audit file or design decision>`
Mode: `plan`

## Principles

- Preserve existing functional behavior.
- Implement in small reviewable lots.
- Normalize foundations/components before broad page work.
- Validate accessibility, responsiveness, and visual regression per lot.

## Lots

| Lot | Objective | Scope | Explicitly excluded | Risk | Acceptance criteria | Validation |
|---|---|---|---|---|---|---|
| 1 | Foundations | `<tokens/type/spacing>` | `<backend/API/domain>` | Medium | `<done state>` | `<commands/manual checks>` |

## Recommended order

1. `<Lot 1>`
2. `<Lot 2>`
3. `<Lot 3>`

## Dependencies and blockers

- `<Design approval, missing screenshots, unavailable stack, etc.>`

## Non-goals

- No API contract changes.
- No domain-rule changes.
- No application rewrite.
