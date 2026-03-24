# Task Plan - 2026-03-24

## Objective

Fix mobile form usability by reducing vertical footprint and hiding optional fields by default.

## Plan

- [x] Compact generator form spacing, typography, and input/select heights for mobile.
- [x] Add collapsible optional fields section (collapsed by default).
- [x] Re-layout optional inputs in a tighter side-by-side grid.
- [x] Validate with typecheck/lint and mobile e2e regression.

## Review

- Status: Completed
- Notes:
  - Updated `components/generator/generator-form.tsx` with compact field density, optional section toggle, and 2-column optional inputs.
  - Updated `components/ui/input.tsx` and `lib/libraries/ui/components/premium-select.tsx` to support compact class overrides.
  - Tightened home container spacing in `components/home-shell.tsx`.
  - Validation:
    - `npm run typecheck` pass
    - `npm run lint` pass
    - `npm run test:e2e -- tests/e2e/mobile-happy-path.spec.ts --project=chromium` pass (`1 passed`)
