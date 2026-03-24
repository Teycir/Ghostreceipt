# Task Plan - 2026-03-24

## Objective

Fix remaining desktop no-scroll usability issue reported after first compaction pass.

## Plan

- [x] Reduce shell/header height for short desktop viewports.
- [x] Remove redundant desktop-only history CTA row to reclaim vertical space.
- [x] Further tighten generator control density and spacing.
- [x] Strengthen desktop fit e2e gate at a shorter laptop viewport.
- [x] Re-run typecheck/lint and mobile+desktop e2e.

## Review

- Status: Completed
- Notes:
  - Tightened `HomeShell` spacing/padding and reduced desktop header density for short heights.
  - Compact form controls were reduced to a denser desktop footprint in `GeneratorForm`.
  - Desktop history CTA is now hidden on `md+` because corner nav already provides history access.
  - Desktop regression viewport tightened from `1366x768` to `1280x680` in `desktop-form-fit.spec.ts`.
  - Validation:
    - `npm run typecheck` pass
    - `npm run lint` pass
    - `npm run test:e2e -- tests/e2e/mobile-happy-path.spec.ts tests/e2e/desktop-form-fit.spec.ts --project=chromium` pass (`2 passed`)
