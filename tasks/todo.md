# Task Plan - 2026-03-24

## Objective

Remove high-volume verification tracks from docs and harden runtime defaults for free-tier capacity safety.

## Plan

- [x] Remove batch/compliance verification tracks from roadmap docs.
- [x] Audit runtime features for free-tier capacity risks.
- [x] Harden oracle route defaults (rate limits + in-memory registry ceilings) where safe.
- [x] Run targeted verification tests and typecheck after hardening.

## Review

- Status: Complete
- Notes:
  - Removed all `R-P2-04`/batch/compliance planning tracks from `docs/project/ENHANCEMENT_ROADMAP.md`.
  - Hardened free-tier runtime defaults:
    - `fetch-tx`: global minute `90 -> 60`, global burst `20 -> 12`.
    - `verify-signature`: global minute `120 -> 60`, global burst `30 -> 20`, replay max entries `5000 -> 2000` (client minute remains `12` for stability).
    - `check-nullifier`: client minute `15 -> 8`, global minute `150 -> 80`, client burst `4 -> 2`, global burst `40 -> 10`, registry max entries `10000 -> 3000`.
  - Verification commands run:
    - `npm run typecheck`
    - `npm test -- tests/unit/api/oracle-fetch-tx.test.ts tests/unit/api/oracle-verify-signature-route.test.ts tests/unit/api/oracle-check-nullifier-route.test.ts --runInBand`
    - `rg -n "batch verification|R-P2-04|compliance|accounting" docs/project -S`
