# Task Plan - 2026-03-24

## Objective

Fix desktop generator layout so the full form fits common laptop viewports without forced vertical scrolling.

## Plan

- [x] Reduce desktop shell/header vertical footprint and widen the form container.
- [x] Apply denser desktop field layout for required inputs.
- [x] Add desktop e2e regression that checks no forced vertical overflow.
- [x] Validate with typecheck/lint and desktop+mobile e2e.

## Review

- Status: Completed
- Notes:
  - Reduced home-shell vertical footprint via compact `UnifiedPageShell` configuration and tighter card spacing.
  - Densified required form layout in `GeneratorForm` with desktop two-column grouping.
  - Added `tests/e2e/desktop-form-fit.spec.ts` to assert no forced vertical page overflow at `1366x768`.
  - Validation:
    - `npm run typecheck` pass
    - `npm run lint` pass
    - `npm run test:e2e -- tests/e2e/mobile-happy-path.spec.ts tests/e2e/desktop-form-fit.spec.ts --project=chromium` pass (`2 passed`)
