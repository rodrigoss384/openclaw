# Phase 10D — Product Semantics Evidence

This document describes the executable Phase 10D evidence boundary. It is not a product, design, navigation, retrieval, or release policy authority.

## Canonical owner

`visual-composition-evidence.json` remains the canonical Phase 5 browser/composition evidence artifact governed by `frontend-product-builder`.

Phase 10D does not replace it with another evidence owner. When 10A, 10B or 10C semantics apply to a captured screen/state, the existing `visual-composition-evidence.json#presenceSignals` declares:

```text
signal = productSemantics.evidenceRef
value  = <repository-relative product-semantics-evidence.json>
```

The referenced `product-semantics-evidence.json` is subordinate evidence only. It cannot define or repair product semantics.

## Upstream authorities

The companion is checked against the existing authorities:

- 10A semantic presentation: Design System `visualGrammar.perceptualPolicy.presentationRoles` / `semanticDifferentiation`, propagated through the craft contract;
- 10B navigation: `docs/frontend/navigation-capabilities.json` and the canonical application-shell screen specification;
- 10C global retrieval: `docs/frontend/global-retrieval.json` plus its referenced backend retrieval contract.

If those owners disagree with the companion, the companion is stale or invalid. Evidence review must not modify the canonical contracts to make the evidence pass.

## Evidence contract

Schema:

```text
integrations/frontend/product-semantics-evidence.schema.json
```

Validator:

```text
integrations/frontend/product-semantics-evidence.mjs
```

Public Phase 5 enforcement remains:

```bash
node skills/frontend-product-builder/scripts/audit-theme-operational-evidence.mjs \
  <screen-spec.json> \
  <design-system.json> \
  <craft-contract.json> \
  <visual-composition-evidence.json>
```

The public auditor first executes the pre-existing Phase 5 objective audit, then 10A operational semantic checks, then Phase 10D product-semantics evidence checks.

## What 10D proves

### Semantic differentiation

For every rendered craft assignment carrying a canonical `presentationSignature`, evidence records the complete signature:

- `variantRole`
- `semanticColorRole`
- `shapeRole`
- `textRole`

The observed role/signature must match the craft contract and the target must agree with rendered browser evidence.

### Navigation

For every module in the applicable navigation capability contract, evidence records:

- `capabilityRef`
- `availability`
- `presentation`
- whether it rendered
- whether it is navigable
- actual destination
- whether an unavailable reason is visible

The evidence must preserve the 10B semantics:

- active/navigate is rendered and navigates to the exact authorized route;
- hidden is absent and non-navigable;
- disabled/upsell is visibly non-active, non-navigable, and exposes its reason.

The companion is bound to the current navigation contract by repository ref and SHA-256.

### Global retrieval

When 10C is applicable, evidence records:

- rendered trigger;
- invocation mode;
- accessible name;
- focus-management observation;
- shortcut exactly as declared by the contract, including `null`;
- captured result state;
- backend-authoritative authorization mode;
- tenant-scope validation;
- zero unauthorized results;
- result announcement;
- observed entity types;
- references to the canonical backend tenant-negative and retrieval evidence.

A screenshot may capture `loading`, `empty`, `error`, or `results`, but authorization-aware result evidence is still required structurally. This prevents a visually valid screenshot from standing in for tenancy/authorization proof.

When retrieval is explicitly `not-applicable`, no trigger/result evidence is allowed.

## Failure ownership

- canonical 10A/10B/10C contract invalid or stale -> return to the canonical owner / design readiness;
- companion or capture does not match a valid canonical contract -> recapture or repair the small slice;
- missing evidence during release review -> remain blocked; do not reconstruct it retroactively in evidence review.

## Human authority

Phase 10D creates no workflow stage and no human gate. A green product-semantics evidence audit is a prerequisite to the existing representative/release evidence paths when applicable; it is never representative approval or release approval.
