# Roadmap Review Notes

## 1) Change Scope

- Roadmap item: Phase 4 compressed payload determinism and verifiability gate
- PR / commit: Working tree changes (not committed in this session)
- Owner: Codex + project owner
- Date: 2026-03-24

## 2) Measurement Commands

```bash
npm test -- tests/unit/zk/prover.test.ts --runInBand
```

## 3) Metric Delta Table (Required)

| Surface | Metric | Budget (p50/p95) | Before | After | Delta | Pass/Fail |
|---------|--------|------------------|--------|-------|-------|-----------|
| share payload | deterministic export for identical inputs | N/A (determinism gate) | N/A (new explicit assertion) | Pass | N/A | Pass |
| share payload | compressed payload import->export idempotency | N/A (determinism gate) | N/A (new explicit assertion) | Pass | N/A | Pass |
| verifier compatibility | compact payload import validation | N/A (determinism gate) | Pass (existing checks) | Pass (existing + determinism path) | 0 regressions | Pass |

Notes:
- Added explicit deterministic export coverage to `tests/unit/zk/prover.test.ts`.
- Gate ensures same input yields byte-identical compact payload and remains verifiable after round-trip.

## 4) Budget Exceptions (If Any)

- Exception: None
- Why this is acceptable now: N/A
- Mitigation: N/A
- Follow-up task: N/A

## 5) Risk / Rollback Notes

- User-visible risk: Low. Test-only change for deterministic behavior enforcement.
- Safe rollback action: Revert the new determinism test and uncheck the roadmap gate.
- Flags/guards involved: None

## 6) Validation Summary

- Typecheck: Not rerun (test-only change)
- Lint: Not rerun (test-only change)
- Tests:
  - `tests/unit/zk/prover.test.ts` pass (`11/11`)
- Additional checks: Roadmap Phase 4 determinism exit criterion updated to complete.
