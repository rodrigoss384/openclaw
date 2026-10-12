# Accessibility and Responsive Checklist

## Keyboard and focus

- [ ] All interactive controls are reachable by keyboard.
- [ ] Focus order follows the visual reading order.
- [ ] `focus-visible` treatment is clear on dark and light backgrounds.
- [ ] Modals trap focus and restore focus to the opener.
- [ ] Menus, tabs, dialogs, and disclosure controls support expected keyboard behavior.

## Forms

- [ ] Every field has a visible label or an accessible label.
- [ ] Required fields are communicated without relying only on color.
- [ ] Validation errors identify the field and the required correction.
- [ ] Disabled fields are visibly disabled and not confused with read-only content.
- [ ] Help text and error text remain legible at 125% zoom.

## Contrast and perception

- [ ] Text meets WCAG AA contrast against its background.
- [ ] Borders, focus rings, and status indicators remain visible in dark and light themes.
- [ ] Success, warning, danger, and info states are differentiated by icon/text plus color.
- [ ] Placeholder text is not used as the only instruction.

## Responsive breakpoints

Validate at least:

- [ ] 1440 × 900
- [ ] 1366 × 768
- [ ] 1280 × 800
- [ ] 1024 × 768

When mobile/tablet is in scope, add the product's supported mobile widths.

## Stress states

- [ ] Zoom at 125%.
- [ ] Long names, long process numbers, long document titles, and long tenant/company names.
- [ ] Empty datasets.
- [ ] Many table rows.
- [ ] Loading states.
- [ ] Error states.
- [ ] Permission-restricted states.
- [ ] Slow network or partial data when the app supports it.

## Visual regression

- [ ] Reference screenshots exist for the representative screens or changed components.
- [ ] Screenshot names describe screen, state, and viewport.
- [ ] Diff failures are reviewed as product changes, not blindly accepted.
- [ ] Baselines are updated only after design approval.
