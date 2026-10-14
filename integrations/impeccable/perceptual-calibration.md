# Perceptual calibration closure

This enforcement closes the remaining perceptual gaps without creating a new workflow phase or a parallel visual authority. The Design System remains canonical; these validators consume its semantic tokens plus browser evidence.

## Surface layering

Adjacent surface roles are evaluated in OKLab. Separation must be lightness-dominant and remain subtle relative to the theme's own primary-text contrast span. The validator intentionally does not prescribe a universal 3–5% luminosity delta or a fixed palette.

## Accent and semantic color

Accent scarcity and semantic color roles remain owned by the existing Phase 5 policy. Cross-theme calibration now additionally compares the perceptual salience of rendered semantic colors relative to the local surface and primary-text span. Exact color reuse is allowed only with per-theme context validation and still fails if simultaneous background context makes the color materially heavier or lighter.

## Text hierarchy

The existing primary → secondary → muted → disabled contrast ordering remains authoritative and is unchanged.

## Borders

Default structural borders must remain quieter than muted text and may not outrank the strong-border token. Strong borders remain restricted to the existing semantic purposes such as focus, error, selection, or explicit structure.

## Contrast-driven density

Ordinary light/dark themes retain the existing stable geometry envelope (2 px geometry / 0.03 content-occupancy drift). A wider bounded envelope is available only when measured text contrast load differs materially across themes. In that case the higher-contrast theme must reduce content occupancy, proving additional spatial separation instead of merely opting out of consistency.

This is deliberately contextual: dark mode does not automatically receive more spacing, and no arbitrary global spacing multiplier is introduced.

## Regression ownership

- Phase 5: per-theme surface and border calibration.
- Phase 7: cross-theme semantic-color weight and contrast-driven density.
- Phase 10F: explicit regression suite for all four calibrated invariants.
