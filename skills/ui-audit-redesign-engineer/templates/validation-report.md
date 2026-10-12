# UI Validation Report

Date: `<YYYY-MM-DD>`
Scope: `<lot/screen/component>`
Mode: `validate`

## Result

Status: `<pass | pass-with-notes | fail | blocked>`

## Checks run

| Check | Result | Evidence / notes |
|---|---|---|
| Build/typecheck | `<pass/fail/not run>` | `<command/output summary>` |
| Lint/unit tests | `<pass/fail/not run>` | `<command/output summary>` |
| Visual inspection | `<pass/fail/not run>` | `<screenshots/routes>` |
| Accessibility | `<pass/fail/not run>` | `<keyboard/contrast/labels>` |
| Responsive | `<pass/fail/not run>` | `<viewports>` |
| Regression visual | `<pass/fail/not run>` | `<Playwright/Storybook/diff>` |

## Before/after notes

- `<What changed visually.>`
- `<What behavior was preserved.>`

## Issues found

| ID | Severity | Issue | Recommendation | Blocks approval? |
|---|---|---|---|---|
| VAL-001 | Medium | `<issue>` | `<fix>` | No |

## Follow-ups

- `<Next lot or remaining correction.>`
