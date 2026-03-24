# Task Plan - 2026-03-24

## Objective

Center the main generator frame on desktop so the first screen feels balanced and no longer sits too high.

## Plan

- [x] Update home shell alignment to center the main content area (desktop-first).
- [x] Keep mobile behavior safe so compact form flow still works.
- [x] Validate with typecheck/lint.

## Review

- Status: Completed
- Notes:
  - Updated `components/home-shell.tsx`:
    - switched `UnifiedPageShell` to `centerContent`
    - set responsive shell classes to keep mobile top-first and desktop centered
      - `justify-start pt-2 pb-14 sm:justify-center sm:pt-0 sm:pb-24`
  - Validation:
    - `npm run typecheck` pass
    - `npm run lint` pass
