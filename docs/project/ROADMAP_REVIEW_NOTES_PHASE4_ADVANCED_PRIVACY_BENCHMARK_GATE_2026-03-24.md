# Roadmap Review Notes

## 1) Change Scope

- Roadmap item: Phase 4 exit criterion - advanced privacy modes ship only with benchmark evidence
- PR / commit: Working tree changes (not committed in this session)
- Owner: Codex + project owner
- Date: 2026-03-24

## 2) Measurement Commands

```bash
npm run typecheck
npm run lint
npm run test:gate:privacy
```

## 3) Metric Delta Table (Required)

| Surface | Metric | Budget (p50/p95) | Before | After | Delta | Pass/Fail |
|---------|--------|------------------|--------|-------|-------|-----------|
| advanced privacy policy | shipping-mode benchmark evidence required | required gate | N/A (no enforceable runtime policy) | Enforced by validator + CI test gate | N/A | Pass |
| advanced privacy policy | proof benchmark command linkage | required gate | N/A (not enforced) | Shipping evidence must include `test:perf:proof` command | N/A | Pass |
| advanced privacy policy | benchmark outcome gating | required gate | N/A (not enforced) | Shipping evidence must set `budgetsPass=true` | N/A | Pass |

Notes:
- Added manifest: `config/privacy/advanced-modes.json`.
- Added validator: `lib/policy/advanced-privacy-benchmark-gate.ts`.
- Added gate tests: `tests/unit/policy/advanced-privacy-benchmark-gate.test.ts`.
- Added npm script: `test:gate:privacy`.
- Current advanced modes remain `planned`; any future switch to `shipping` now hard-fails tests unless benchmark evidence is attached and passed.

## 4) Budget Exceptions (If Any)

- Exception: None
- Why this is acceptable now: N/A
- Mitigation: N/A
- Follow-up task: N/A

## 5) Risk / Rollback Notes

- User-visible risk: Low. This is a policy/validation gate only; no runtime feature behavior changed.
- Safe rollback action: Revert policy validator/test/manifest and restore roadmap checkbox.
- Flags/guards involved: Jest policy gate (`npm run test:gate:privacy`).

## 6) Validation Summary

- Typecheck: Pass
- Lint: Pass
- Tests:
  - `tests/unit/policy/advanced-privacy-benchmark-gate.test.ts` pass (`5/5`)
- Additional checks: Final roadmap checkbox updated to complete.
