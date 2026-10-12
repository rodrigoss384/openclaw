# Navigation Capability Contract — Phase 10B

## Authority

This file is explanatory only. It is not a policy or source of product truth.

Authority remains layered:

1. `docs/frontend/product-context.md` owns approved product information architecture, tasks, terminology and permission meaning.
2. `docs/frontend/navigation-capabilities.json` is the executable navigation projection for product modules.
3. The canonical `application-shell` screen specification consumes that projection through `architecture.integrationContracts` and owns concrete screen actions/permissions.
4. `application-shell.recipe.json` owns generic shell composition and behavior; it does **not** decide which product modules exist.
5. Design System/Impeccable remain visual-craft authorities and cannot invent product navigation semantics.

The machine-readable schema is `integrations/frontend/navigation-capability.schema.json`. Validation runs through `integrations/frontend/navigation-capability.mjs`.

## Contract shape

A navigation contract declares:

- `productContextRef`;
- `applicationShellScreenRef`;
- `navigationMode`: `single-module | multi-module | entitlement-aware | hybrid`;
- one or more modules with `id`, `label`, `capabilityRef`, `availability`, `presentation`, `sourceRef`, route/provenance fields and an optional reason.

Availability:

- `active` — operational product capability;
- `entitlement-locked` — real capability unavailable to the current entitlement;
- `approved-coming-soon` — non-operational capability backed by an approved roadmap source.

Presentation:

- `navigate`;
- `hidden`;
- `disabled-with-reason`;
- `upsell-entry`.

## Deterministic invariants

- No `sourceRef` means no valid module render.
- `active` must be `navigate`, have a concrete route, resolve to an application-shell permission with `allowed|read-only`, and match exactly one navigation action by `capabilityRef + label + targetRoute`.
- An unavailable module cannot carry an active route or application-shell navigation action.
- `approved-coming-soon` must have `roadmapRef` and cannot be rendered as active navigation.
- `upsell-entry` is only valid for `entitlement-locked`, requires `commercialCapabilityRef`, requires a valid Behavioral UX Contract, and must include a truthful reason.
- `hidden` and `disabled-with-reason` require a reason when retained in the executable inventory.
- The application-shell screen must bind the exact navigation contract path through `architecture.integrationContracts`.

The validator does not revalidate the whole screen-spec contract. Screen specification structure remains owned by the existing screen-spec schema/validators; Phase 10B checks only navigation relationships across those canonical artifacts.

## Navigation mode semantics

`single-module` means exactly one visible active module. It is a product-semantic fact, not a command to force a particular sidebar or compact visual chrome.

`multi-module` means at least two visible active modules and no visible unavailable module.

`entitlement-aware` means at least one active module plus at least one visible entitlement-locked capability.

`hybrid` means at least one active module plus at least one visible non-active capability, such as approved coming-soon or entitlement-locked content.

## Runtime use

When navigation capability is applicable, run:

```bash
node integrations/frontend/navigation-capability.mjs check \
  --root . \
  --contract docs/frontend/navigation-capabilities.json
```

The same validator is consumed at design readiness, implementation, the frontend representative gate and evidence/release review.

A failing contract returns to the appropriate canonical owner. It is never repaired by guessing a route, capability, entitlement, roadmap, commercial offering or Behavioral UX decision.

## Human authority

Phase 10B adds no workflow stage and no generic approval gate. Product navigation semantics remain consequential when not already decided by the canonical product artifacts. The Autonomy Controller may not reclassify a new module, capability, entitlement, commercial entry or navigation-semantic change as a reversible frontend choice merely to avoid human review.
