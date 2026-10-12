# Visual Consistency Checklist

## Structure

- [ ] The page has one identifiable primary objective.
- [ ] Each state/viewport has no more than one dominant focal point unless an approved exception exists.
- [ ] The intended reading path is visible without relying on explanatory text.
- [ ] The title size is proportional to the screen's function.
- [ ] The header does not consume excessive vertical space.
- [ ] Global actions and local actions are visually separated.
- [ ] Primary content appears before secondary actions.
- [ ] Layout regions have clear hierarchy: shell, page header, filters, content, secondary panels.
- [ ] Related controls are grouped; unrelated controls are separated.
- [ ] Related elements are closer to each other than to unrelated groups.
- [ ] Key lines and alignment anchors are consistent across regions.

## Typography

- [ ] A consistent type scale is used.
- [ ] Semantic headings are not used as a visual size scale.
- [ ] Visual text roles are distinct enough for page title, section title, body, metadata, and metric text.
- [ ] Labels are not excessively small.
- [ ] Secondary text has sufficient contrast.
- [ ] Font weights are not mixed arbitrarily.
- [ ] Font weight, size, line-height, and color come from composed semantic text styles when the project defines them.
- [ ] Long text uses a readable measure and line height.
- [ ] Numeric values, dates, and statuses use consistent formatting.

## Components

- [ ] Similar buttons use the same component and variants.
- [ ] Inputs use consistent height, radius, border, and focus treatment.
- [ ] Selects, textareas, date inputs, and file uploads align with input styling.
- [ ] Cards use consistent padding, elevation, borders, and header structure.
- [ ] Modals use standardized title, body, footer, dismissal, and destructive-action patterns.
- [ ] Active, hover, focus, disabled, loading, and error states are visible.
- [ ] Tables have consistent density, headers, sorting/filter affordances, and empty states.

## Styling authority

- [ ] The primary styling mechanism and token source are explicit.
- [ ] Existing classes touched by the lot have a traced definition and owner.
- [ ] Global stylesheets contain only approved global responsibilities.
- [ ] No parallel CSS architecture or local BEM escape hatch was introduced.
- [ ] Raw and arbitrary values are confined to approved token sources or documented exceptions.
- [ ] Rendered output is compared with the approved aspects of visual references.

## Semantics

- [ ] Destructive actions have a dedicated treatment.
- [ ] Warning is not used as decoration.
- [ ] Neutral states do not appear as errors.
- [ ] Color is not the only differentiator.
- [ ] Color is not the only signal of visual priority.
- [ ] Export and utility actions do not visually compete with the main action.
- [ ] Primary actions are reserved for the most important next step.
- [ ] Badges/statuses map consistently to meaning.

## Content

- [ ] Internal names, technical implementation details, or debugging terms are not exposed to users.
- [ ] HTTP codes or stack traces are not shown as user-facing messages.
- [ ] Dates use the product's local format.
- [ ] Currency and numeric values use consistent locale formatting.
- [ ] Empty states offer explanation and a reasonable next action.
- [ ] Error messages are actionable and written for the user's role.
- [ ] Loading states set correct expectations and avoid layout jumps.

## Responsiveness

- [ ] There is no unexpected horizontal overflow.
- [ ] Tabs do not become clipped or unreachable.
- [ ] Tables have a strategy for smaller screens.
- [ ] Modals remain within the viewport.
- [ ] Buttons do not wrap awkwardly or overlap content.
- [ ] Filter bars collapse or reflow predictably.
- [ ] Dense dashboards preserve priority across common breakpoints.
- [ ] Compact layouts preserve the approved reading path and action hierarchy.

## Accessibility

- [ ] Keyboard focus is visible.
- [ ] Labels are associated with fields.
- [ ] Error messages are understandable and discoverable by assistive tech.
- [ ] Contrast meets WCAG AA for text and meaningful UI elements.
- [ ] Interactive targets have adequate size and spacing.
- [ ] Icon-only controls have accessible names.
- [ ] Motion is not required to understand state changes.
