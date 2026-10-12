# Frontend Overlay

Use this overlay for a new or materially changed product screen, workflow, dashboard, collection, detail, form, administration, authentication, or review surface.

## Authority boundaries

- The numbered feature package owns product requirements and delivery evidence.
- `docs/frontend/` owns frontend product context, visual direction, architecture, design-system, component and screen contracts.
- `docs/frontend/styling-authority.json` owns the detected styling mechanism, token/component sources, global stylesheet boundaries, class-ownership traces and approved visual-reference aspects.
- `07-design.md` references frontend artifacts; it does not duplicate them.
- Existing APIs, authentication, permissions, persistence and business rules remain unchanged unless the feature package explicitly approves a separate contract change.
- `prompts/spec-driven/frontend-craft-policy.json` owns the provider routing and command governance for visual craft; Impeccable may critique, propose, detect and refine, but it cannot silently redefine canonical product/design contracts or approve a gate.
- `.specs/features/<feature-slug>/frontend-design/` owns the Product Design Brief, open Visual Research, agent decision, asset requirements/acquisition request and derived Product Design readiness. The Product Design Authority selects visual direction with `visualDirectionSelectedBy=agent`; humans remain owners only of product truth, rights, critical consequences, accepted risk and broad-build/release authorization.

## Required order

Invoke `frontend-product-builder` and preserve exactly:

```text
DISCOVER → PRIORITIZE → VISUAL DIRECTION → COMPOSITION PROOF → CLASSIFY → RECIPE → TOKENS
→ COMPONENT MAP → PLAN → SMALL SLICE → BUILD → BROWSER
→ SCREENSHOTS → COMPOSITION AUDIT → DS AUDIT → PATCH → REPORT
```

Identify the operating mode: `new-build`, `integration`, `migration`, `extension`, or `repair`.

Run `product-design-control.mjs profile -> compile -> research -> decide -> gate -> verify` before `SMALL SLICE`. The agent acts as Product Design Authority under `design-authority-bounded`: it compares materially different probes, chooses the strongest contextual thesis, records alternatives and exclusions, and never transfers visual preference to the human. This is an internal state of `VISUAL DIRECTION`, not a new stage.

Use Impeccable as the primary Visual Craft Authority, but scope `shape` through `frontend-control.mjs readiness` after Product Design readiness instead of a generic prompt-time trigger. BUILD/PATCH craft detection and representative-slice critique remain governed as before. Use this authority split:

- `impeccable`: visual exploration, subject-specific identity, typography, palette, composition, hierarchy, signature, copy craft, anti-template detection and visual refinement;
- `frontend-product-builder`: visual composition contracts, product context, architecture, tokens, recipes, component ownership, states, responsive behavior, accessibility and evidence;
- `playwright-skill`: browser execution and browser evidence;
- Behavioral UX contracts: behavioral influence, persuasion and user-autonomy constraints;
- approved project brand/design system and canonical contracts: higher authority than Impeccable.

Use `frontend-design` only as the explicit legacy fallback when the Impeccable agent skill is unavailable. Never run both as competing visual authorities for the same decision.

For incremental redesign, invoke `ui-audit-redesign-engineer` for audit, reviewable lots and before/after validation. Add the full product-builder overlay only when product, screen, state, responsive or component architecture is materially reconstructed.

Do not let aesthetic experimentation change product semantics, permission behavior, accessibility, state ownership or an approved component contract.

## Visual direction release

Before `CLASSIFY`, create or update `docs/frontend/design-direction.md` and record:

- subject, audience and the interface's single primary job;
- real product terminology and representative content;
- brand assets and reference URLs/screenshots, or explicit confirmation that none exist;
- a compact palette of 4–6 named colors mapped later to semantic tokens;
- typography roles appropriate to the selected visitor mode; `operate` may deliberately use one family when that best serves clarity and density;
- layout thesis and one or more ASCII wireframes;
- one subject-specific signature element and one justified aesthetic risk;
- generic AI defaults considered and rejected;
- critique showing what changed before approval.

Prepare the provider context through `integrations/impeccable/frontend-craft.mjs`. `PRODUCT.md` and `DESIGN.md` generated for Impeccable are temporary compatibility projections only; they must contain source provenance/hashes and never become canonical project truth.

Do not invoke Impeccable `shape` merely because direction is described as open-ended. First materialize the deterministic screen/recipe/Design-System sources needed by `frontend-control.mjs readiness`. If the controller returns `shape.allowed=true`, invoke `shape` only for the exact `shape.dimensions` subset. Retain 2–3 lightweight rendered direction probes under `docs/frontend/visual-direction-previews/` only when those unresolved dimensions admit materially different alternatives; approved brand/design-system constraints may legitimately reduce this to one evidence-backed direction.

Record the agent selection in `design-authority-decision.json` and project it into the existing canonical owners. A selected Impeccable comp is an adopted visual reference, not an implementation contract. Record adopted and excluded aspects, incorporate only the agent decision into existing canonical artifacts, then rerun `frontend-control.mjs readiness --after-adoption <prior-report>`. If the same provider dimension remains underived after canonical source change, treat it as a contract-model blocker instead of repeating `shape`. The controller creates a controlled back-edge to `VISUAL DIRECTION`; it does not add or reorder canonical stages. Human selection is reserved for brand-consequential or other explicitly consequential scope, never color/layout preference.

Use [frontend-visual-direction-decision.template.md](../assets/frontend-visual-direction-decision.template.md) for the decision and [frontend-visual-quality-scorecard.template.md](../assets/frontend-visual-quality-scorecard.template.md) for representative review.

Before `CLASSIFY` for substantial frontend work, produce the 2.2 composition
contract:

- `docs/frontend/design-system/design-system.json#visualGrammar`;
- `docs/frontend/screens/<screen-id>/screen-spec.json#visualHierarchy`;
- `docs/frontend/screens/<screen-id>/composition-proof.json`.

Separate semantic headings from visual priority. Heading tags describe document
structure; visual priority uses `critical|primary|supporting|contextual|audit`
and semantic text styles. Do not use `H1` through `H6` as a visual scale.

## Planning release

Before JSX implementation:

1. Inspect the actual repository stack and component system.
2. Create or explicitly migrate `docs/frontend/styling-authority.json` to Styling Authority v2: preserve the detected architecture, declare global stylesheet roles and token/component sources, and retain only adopted visual-reference IDs bound to the semantic digest of `visual-research.json`.
3. Verify `product-design-readiness.json`, then run `frontend-control.mjs readiness`; resolve canonical-owner relationships at their owner, use Impeccable `shape` only for `shape.dimensions`, adopt the agent-selected provider decisions into canonical artifacts, and rerun readiness. Use `frontend-design` only if the Impeccable agent skill is unavailable and degraded routing is recorded.
4. Create or update applicable `docs/frontend/` contracts.
5. Define every applicable state: initial loading, background refresh, data, empty, filtered empty, partial failure, full error, forbidden/read-only, unavailable, processing/mutation failure, stale and conflict.
6. Define ownership, actions, responsive transformations and accessibility behavior.
7. Validate the styling authority, screen specification and, when substantial, visual composition contract with the installed frontend skill scripts.
8. Require a readiness result that releases `SMALL SLICE`.

Before editing an existing class, trace its usage, definition, import/cascade, owner and tokens. If its definition is unresolved, stop; never create a `globals.css` override as a guess. Tailwind utilities are mandatory only when Tailwind is the approved authority. Other viable project architectures remain valid and must not be paralleled or silently migrated.

## Build craft enforcement

During BUILD and PATCH, run the governed Impeccable detector through `integrations/impeccable/frontend-craft.mjs` for affected user-visible files or directories. Automatic design hooks are preferred where supported but are not required for portability; the adapter's pinned detector path is the fallback.

Treat detector output as evidence:

- a real contract/craft defect routes to PATCH;
- a false positive may receive only a narrow ignore linked to a `decisionId` or Design System rule ID;
- a project-wide ignore requires explicit human approval;
- a finding that shows an approved contract itself is wrong routes back to design readiness instead of silently rewriting implementation against the contract.

Use targeted commands by finding. `layout`, `typeset`, `adapt` and `clarify` are normal directed refinements; `harden`, `optimize`, `distill` and `colorize` require a concrete finding. `bolder`, `quieter`, `animate`, `delight` and `live` require explicit approval; `overdrive` requires strong explicit approval. `init` and `document` are not canonical commands in the managed workflow; `extract` is design-system-maintenance only. Limit visual inspection to two rounds and `polish` to one round.

## Representative gate

Implement only the approved representative slice. It must use production architecture and include:

- approved composition proof;
- one meaningful non-success state;
- one responsive transformation;
- one keyboard or focus interaction;
- tests or stories;
- browser evidence and screenshots;
- a composition audit, design-system audit and defect log;
- global stylesheet, raw-value and class-ownership evidence;
- comparison against the approved aspects of visual references.

After Playwright/browser evidence, screenshots and composition evidence exist, critique the rendered slice with Impeccable `critique` before requesting approval. Keep the craft review independent from the objective composition/design-system validators before synthesizing findings. If the Impeccable agent skill is unavailable, record degraded routing, run the pinned detector, and use `frontend-design` only as the legacy qualitative fallback.

Retain a visual-quality scorecard covering:

- subject and brand specificity;
- hierarchy and primary-task clarity;
- alignment, grid and regional placement;
- spacing rhythm and density;
- typography roles, scale and wrapping;
- palette discipline and semantic-token use;
- component consistency and absence of arbitrary variants;
- real copy/content and absence of generic AI phrasing;
- signature element and justified restraint;
- responsive composition, not merely element shrinking;
- non-success states with equal visual care;
- resemblance to generic AI defaults or unrelated products;
- adherence to styling authority and absence of reference drift;
- semantic outline independent from visual priority;
- focal point, reading path, proximity groups, key lines, whitespace ownership and emphasis budget;
- rendered computed-style and geometry evidence compared with the approved composition proof.

Any failed scorecard or Impeccable finding must link to screenshot/browser evidence, the relevant canonical contract and the patch/revalidation result. Scores produced by Impeccable are diagnostic only and are never approval thresholds.

Use `blocked`, `ready`, `approved`, `rejected`, or `not-required`. Broad `BUILD` is forbidden until explicit human approval is retained, the visual scorecard has no blocking finding and the readiness report releases it as `broad-build-approved`. Impeccable may never set the human approval state.

Run composition audit before design-system audit:

```bash
node "$SKILL_ROOT/scripts/validate-visual-composition-contract.mjs" \
  docs/frontend/screens/<screen-id>/screen-spec.json \
  docs/frontend/design-system/design-system.json \
  docs/frontend/screens/<screen-id>/composition-proof.json

node "$SKILL_ROOT/scripts/audit-visual-composition-evidence.mjs" \
  docs/frontend/screens/<screen-id>/screen-spec.json \
  docs/frontend/design-system/design-system.json \
  docs/frontend/screens/<screen-id>/composition-proof.json \
  docs/frontend/screens/<screen-id>/visual-composition-evidence.json

node "$SKILL_ROOT/scripts/validate-visual-quality-scorecard.mjs" \
  docs/frontend/screens/<screen-id>/visual-quality-scorecard.json
```

If implementation needs to change reading path, focal point, typography roles,
region priority, token authority or action hierarchy, return to design readiness.

## Final evidence

Validate at minimum `390x844`, `1024x768`, `1440x900`, 125% browser zoom, and 200% text scaling. Record keyboard, focus, announcements, reduced motion, state coverage, screenshots, design-system audit, Impeccable provenance/findings and residual defects in `11-evidence.md` by reference.

For critical UI, run the governed Impeccable `audit` in addition to the existing objective validators. For standard substantial UI, detector + `critique` are sufficient unless the feature contract requires the broader audit. `web-design-guidelines` remains an optional independent standards review rather than a second primary craft authority.

For superficial cosmetic work, use the UI audit/redesign route and record why the product-builder overlay is `not-applicable`.

`frontend-blueprint` is not a mandatory authority in this workflow. Its useful reference-discovery behavior is represented by the visual-reference contract above; requiring its separate phase would duplicate discovery and may introduce an unrelated prototyping path. Use it only when explicitly requested or when an approved local workflow adopts it.
