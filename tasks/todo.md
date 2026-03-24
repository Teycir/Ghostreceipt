# Task Plan - 2026-03-24

## Objective

Fix CI/deploy blockers from fetch-tx route test flakiness and stale coverage threshold path.

## Plan

- [x] Reproduce failing fetch-tx route tests and isolate root cause.
- [x] Reset route state per test to avoid rate-limit/replay leakage.
- [x] Fix stale Jest coverage threshold path for cascade module.
- [x] Re-run targeted failing tests and full coverage suite.

## Review

- Status: Completed
- Notes:
  - Updated `tests/unit/api/fetch-tx-route.test.ts` and `tests/unit/api/oracle-fetch-tx.test.ts` to call `__disposeOracleFetchRouteForTests()` in `beforeEach` and `afterEach`.
  - Updated `jest.config.js` coverage threshold target from `./lib/providers/cascade.ts` to `./lib/libraries/backend-core/providers/cascade.ts`.
  - Validation:
    - `npm test -- tests/unit/api/fetch-tx-route.test.ts tests/unit/api/oracle-fetch-tx.test.ts --runInBand` pass
    - `npm run test:coverage` pass
