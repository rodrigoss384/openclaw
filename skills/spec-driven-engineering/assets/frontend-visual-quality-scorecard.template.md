# Frontend Visual Quality Scorecard

**Feature/screen:**  
**Representative route:**  
**Direction decision:** `docs/frontend/visual-direction-decision.md`  
**Styling authority:** `docs/frontend/styling-authority.json`  
**Reviewer/context:**  
**Status:** `blocked | ready | approved | rejected`  
**Timestamp:**

Use only `passed`, `failed`, `partial` or `not-run`. Every non-passed result requires evidence and disposition.

| ID | Criterion | Result | Screenshot/browser evidence | Defect/patch/revalidation |
|---|---|---|---|---|
| VIS-001 | Subject and brand specificity |  |  |  |
| VIS-002 | Primary-task clarity and hierarchy |  |  |  |
| VIS-003 | Grid, alignment and regional placement |  |  |  |
| VIS-004 | Spacing rhythm and density |  |  |  |
| VIS-005 | Typography roles, scale and wrapping |  |  |  |
| VIS-006 | Palette discipline and semantic-token use |  |  |  |
| VIS-007 | Canonical components and variant discipline |  |  |  |
| VIS-008 | Real content, copy tone and action naming |  |  |  |
| VIS-009 | Signature element, restraint and meaningful motion |  |  |  |
| VIS-010 | Responsive recomposition and content priority |  |  |  |
| VIS-011 | Non-success state visual completeness |  |  |  |
| VIS-012 | Absence of generic AI defaults/unrelated imitation |  |  |  |
| VIS-013 | Styling-authority compliance and class ownership |  |  |  |
| VIS-014 | Global stylesheet boundary and absence of parallel CSS |  |  |  |
| VIS-015 | Fidelity to approved visual-reference aspects |  |  |  |

## Required rendered evidence

| Evidence | Result | Location |
|---|---|---|
| `390x844` |  |  |
| `1024x768` |  |  |
| `1440x900` |  |  |
| 125% browser zoom |  |  |
| 200% text scaling |  |  |
| Keyboard/focus path |  |  |
| Meaningful non-success state |  |  |
| Before/after for patched defects |  |  |

## Release decision

- Blocking findings:
- Accepted nonblocking findings:
- Human approver:
- Human decision: `approved | rejected | awaiting-review`
- Readiness result: `broad-build-approved | not-approved`

Broad build is forbidden unless every blocking item is resolved, the human decision is `approved` and readiness is `broad-build-approved`.
