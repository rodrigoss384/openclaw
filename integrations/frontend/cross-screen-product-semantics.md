# Phase 10E — Cross-Screen Product Semantics

This document is explanatory only. It does not create a new product-semantics authority.

## Canonical owner

Phase 10E extends the existing Phase 7 family-consistency runtime:

```bash
node integrations/impeccable/frontend-family-consistency.mjs \
  --root <project-root> \
  --manifest <frontend-family-consistency-manifest.json> \
  --output <frontend-family-consistency-report.json> \
  --check
```

The manifest remains unchanged. Each sample already supplies `screenSpec`, `craftContract` and `visual-composition-evidence`. When Phase 10A/10B/10C semantics apply, the Phase 10D browser evidence points to its subordinate `product-semantics-evidence.json` through `presenceSignals[].signal=productSemantics.evidenceRef`.

10E therefore derives cross-screen comparisons from existing evidence and contracts rather than adding a second family policy or another canonical report.

## What is compared

### Semantic differentiation

For rendered semantic observations, the same semantic role must preserve the same full presentation signature across screens in one visual family:

- `variantRole`
- `semanticColorRole`
- `shapeRole`
- `textRole`

Local `componentUsageId` values are not required to match.

### Navigation shell semantics

Within one `productContext.source`, application-shell samples must agree on:

- navigation applicability;
- canonical navigation contract reference;
- canonical navigation contract SHA-256;
- module capability reference;
- module availability;
- module presentation;
- rendered/non-rendered state required by that presentation;
- navigability;
- exact destination when navigable;
- whether an unavailable reason is structurally present.

Navigation capability semantics must not become a screen-local contract outside the canonical application shell.

### Global retrieval shell semantics

Within one `productContext.source`, application-shell samples must agree on:

- retrieval applicability;
- canonical retrieval contract reference;
- canonical retrieval contract SHA-256;
- global trigger rendered semantics;
- invocation mode;
- focus-management requirement as observed;
- shortcut semantics, including `null` when no shortcut exists;
- backend-authoritative authorization mode;
- authorization filtering;
- tenant-scope validation;
- zero unauthorized results;
- result-announcement guarantee.

Global retrieval must not be promoted into a screen-local capability outside the application shell.

## What is intentionally not compared

10E compares contract/presentation semantics, not literal screen content.

The following may legitimately differ without producing a 10E finding:

- screen copy;
- accessible-name wording;
- local component usage IDs;
- the currently captured retrieval state (`loading`, `empty`, `error`, `results`);
- the entity types present in one particular result capture;
- literal result content.

Different `productContext.source` groups may use different navigation or retrieval contracts.

## Failure semantics

10E findings are contract findings. The existing Phase 7 report is updated as follows:

```text
checks.crossScreen = failed
transition = DESIGN_READINESS
status = failed
```

The finding routes back to the canonical owner set. Evidence review must not repair product semantics inside the report or companion evidence.

## Human authority

10E does not add a workflow stage or human gate. `CONSISTENT` means only that the Phase 7 quality contract passed. Existing representative/release human approvals remain authoritative and unchanged.
