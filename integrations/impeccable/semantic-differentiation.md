# Phase 10A — Cross-Role Semantic Differentiation

This document describes the integration boundary implemented by Phase 10A. It is **not** a policy authority.

## Canonical authority

The canonical owner is the existing Design System contract:

`skills/frontend-product-builder/assets/schemas/design-system.schema.json#visualGrammar.perceptualPolicy`

`presentationRoles` may declare a `presentationSignature` with four dimensions:

- `variantRole`
- `semanticColorRole`
- `shapeRole`
- `textRole`

`semanticDifferentiation` declares which semantic roles must remain distinct, which signature dimensions are compared, the minimum number of distinct dimensions, and `colorOnlyAllowed=false`.

When both `phase` and `status` presentation roles exist, they must participate in an explicit differentiation contract. A differentiated role must have a complete canonical presentation signature.

## Enforcement chain

```text
Design System
  -> frontend-craft.mjs derive/verify
  -> craft-contract.schema.json 1.3.0
  -> Phase 5 operational evidence
  -> Phase 7 family consistency
```

The derived craft contract carries the Design System signature for each semantic presentation assignment. It is subordinate to the Design System and may not invent or override a signature.

Phase 5 checks rendered `textRole` and `semanticColorRole` against the derived signature and rejects same-role drift or observable cross-role collapse.

Phase 7 checks presentation signatures across screens in one visual family and rejects same-role signature drift, insufficient cross-role differentiation, and color-only differentiation.

## Compatibility boundary

Phase 9 craft behavior is preserved by internal `*-core` compatibility files. Public entrypoints and canonical ownership remain unchanged. The current public craft contract is version `1.3.0`; the preserved `1.2.0` schema is used only internally to re-run the Phase 9 invariants before/after the 10A extension.

## Governance

`RULE-FE-SEMANTIC-001` and `frontend-craft-contract-control` include the `implementation` stage so semantic presentation is enforced during implementation rather than only at readiness/representative/release boundaries.

No new human approval gate is introduced. Existing representative and release approvals remain unchanged.

## Deterministic failures

10A blocks at least these conditions:

- differentiated roles with identical signatures;
- cross-role distinction expressed only by semantic color;
- missing canonical signature for a differentiated role;
- derived craft signature drift from the Design System;
- same semantic role mapped inconsistently across equivalent usages/screens;
- Phase 5 rendered evidence collapsing the expected role distinction;
- Phase 7 family evidence collapsing or drifting the role distinction.

A contract-level semantic defect returns to the canonical frontend owner / `DESIGN_READINESS`; it is not repaired by local prompt inference or by the Autonomy Controller.
