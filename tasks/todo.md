# Task Plan - 2026-03-24

## Objective

Close the final roadmap gate by enforcing benchmark evidence before any advanced privacy mode can be marked as shipping.

## Plan

- [x] Add an advanced-privacy mode manifest with explicit shipping/evidence fields.
- [x] Implement benchmark-evidence policy validator in shared library code.
- [x] Add policy gate unit tests (validator behavior + manifest compliance).
- [x] Add script/docs wiring and mark roadmap exit criterion complete.

## Review

- Status: Completed
- Notes:
  - Added manifest policy source: `config/privacy/advanced-modes.json`.
  - Added validator: `lib/policy/advanced-privacy-benchmark-gate.ts`.
  - Added tests: `tests/unit/policy/advanced-privacy-benchmark-gate.test.ts`.
  - Added script: `npm run test:gate:privacy`.
  - Validation:
    - `npm run typecheck` pass
    - `npm run lint` pass
    - `npm run test:gate:privacy` pass (`5 passed`)
  - Updated roadmap final Phase-4 checkbox and added review note `ROADMAP_REVIEW_NOTES_PHASE4_ADVANCED_PRIVACY_BENCHMARK_GATE_2026-03-24.md`.
