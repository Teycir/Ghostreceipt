# Task Plan - 2026-03-24

## Objective

Apply shared shell/chrome to home route so all app pages use homogeneous styling.

## Plan

- [x] Extend reusable `UnifiedPageShell` to support home loader lifecycle needs.
- [x] Refactor `HomeShell` to render through `UnifiedPageShell` without changing startup overlay behavior.
- [x] Run verification commands and capture summary.

## Review

- Status: Complete
- Notes:
  - `components/unified-page-shell.tsx` now supports:
    - optional `onBackgroundReady` callback passthrough to `EyeCandy`
    - `mainShellState` (`loading|ready`) and custom `mainShellStyle`
  - `components/home-shell.tsx` now uses `UnifiedPageShell` for primary page chrome while preserving the startup overlay and transition timing.
  - Verification: `npm run typecheck` and `npm run lint` both passed.
