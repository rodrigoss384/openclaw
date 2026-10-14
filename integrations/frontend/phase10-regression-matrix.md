# Phase 10F — Regression Matrix / Closure

## Purpose

Phase 10F is the closure gate for frontend product semantics. It does not introduce a new product, design, evidence, navigation, retrieval, family-consistency or governance authority.

The executable closure gate is:

```bash
node integrations/frontend/test-phase10-regression-matrix.mjs
```

It re-runs the canonical focused suites and verifies that the acceptance scenarios from the approved Phase 10 plan remain behaviorally covered.

## Authority chain remains unchanged

- 10A: Design System semantic differentiation policy and derived craft contracts;
- 10B: `docs/frontend/navigation-capabilities.json` plus application-shell consumption;
- 10C: `docs/frontend/global-retrieval.json` plus retrieval backend integration contract when implemented;
- 10D: Phase 5 `visual-composition-evidence.json` plus subordinate product-semantics companion;
- 10E: existing Phase 7 family-consistency report plus cross-screen product-semantics findings;
- release evidence: `11-evidence.md` remains the delivery-evidence owner.

The 10F matrix is test inventory and closure evidence only. It cannot define or repair any of those contracts.

## Closure reconciliation: optional global retrieval

The approved plan distinguishes `required`, `optional` and `not-applicable`, and states that frontend entry/backend guarantees are mandatory **when retrieval is required**. Its final matrix also requires:

```text
optional + absent
→ PASS
```

The 10C validator previously treated every `optional` contract as an implemented global-retrieval runtime. Phase 10F corrected that over-constraint.

An `optional` contract now has two valid states:

### optional + absent

```text
applicability = optional
invocation.mode = none
searchableEntityTypes = []
shortcut = null
authorizationMode = not-applicable
resultContract = null
backendContractRef = null
```

The product-context evidence still has to justify why applicability derives to `optional`. No global trigger, command palette, result state or backend retrieval capability may be invented merely to satisfy the contract.

### optional + implemented

If an optional capability is actually implemented, it must satisfy the same runtime guarantees as required retrieval:

- application-shell binding;
- at least one authorized searchable entity;
- concrete invocation;
- discoverable and accessible trigger;
- focus management;
- full result-state/semantic contract;
- backend-authoritative authorization;
- retrieval backend contract and tenant/security evidence.

This distinction does **not** relax `required` retrieval.

10D accepts the explicit optional-absence evidence shape with current contract ref/hash and no trigger/runtime/result-authorization evidence. 10E does not reinterpret optional absence on ordinary route screens as a screen-local global retrieval capability.

## Semantic differentiation matrix

| Scenario | Expected | Canonical coverage |
|---|---|---|
| `status != phase` | PASS only when full signatures satisfy configured differentiation | 10A semantic differentiation suite |
| same semantic role remains consistent across screens | PASS | 10E cross-screen suite |
| color-only differentiation while forbidden | FAIL | 10A semantic differentiation suite |

## Navigation matrix

| Scenario | Expected | Canonical coverage |
|---|---|---|
| single real module with `single-module` mode | PASS | 10B navigation suite |
| invented/unbacked future module | FAIL | 10B source/capability/roadmap negative cases |
| entitlement/upsell without commercial source | FAIL | 10B `upsell-without-commercial-source` |
| upsell without required Behavioral UX | FAIL | 10B `upsell-without-bux` |

The matrix does not introduce a new compact-shell visual rule. `single-module` remains the governed product/navigation mode; visual treatment remains owned by the existing frontend contracts.

## Global retrieval matrix

| Scenario | Expected | Canonical coverage |
|---|---|---|
| required retrieval with missing trigger evidence | FAIL | 10D product-semantics evidence |
| required retrieval with missing backend contract | FAIL | 10C global-retrieval suite |
| tenant/authorization leaking result evidence | FAIL | 10D schema/validator negative cases |
| optional retrieval intentionally absent | PASS | direct 10F reconciliation regression |
| not-applicable retrieval with invented command palette/shortcut | FAIL | 10C + direct 10F regression |

## Phase 1–7 non-regression matrix

The closure gate re-runs the existing operational/family suites and requires retained negative coverage for:

- surface layering;
- accent semantics;
- semantic colors;
- text hierarchy;
- border policy;
- theme calibration;
- semantic presentation consistency;
- interaction affordance;
- actionable empty states;
- wayfinding;
- conditional controls/presence;
- decision support;
- reusable-reference utility;
- family consistency;
- Behavioral UX contract enforcement.

No Phase 10 rule is allowed to bypass these earlier owners.

## Failure semantics

A 10F matrix failure means Phase 10 is not closed. The failure must be repaired in the canonical owner identified by the underlying validator/finding.

The matrix itself must not:

- rewrite canonical contracts;
- downgrade a failed validator to advisory;
- infer missing product semantics;
- add a generic human gate;
- approve representative/release gates;
- merge or deploy.

Phase 10 closure means the regression matrix and full repository workflow are green. Merge remains an explicit external human decision.
