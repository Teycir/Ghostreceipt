# Roadmap Review Notes

## 1) Change Scope

- Roadmap item: Phase 2 reliability and performance gates
- PR / commit: Working tree changes (not committed in this session)
- Owner: Codex + project owner
- Date: 2026-03-24

## 2) Measurement Commands

```bash
npm run typecheck
npm run lint
npm test -- tests/unit/zk/prover-runtime.test.ts --runInBand
npm run test:perf:proof
npm run test:stress:oracle
```

## 3) Metric Delta Table (Required)

| Surface | Metric | Budget (p50/p95) | Before | After | Delta | Pass/Fail |
|---------|--------|------------------|--------|-------|-------|-----------|
| generator | total_ms | <=25,000 / <=60,000 | N/A (p50 not enforced in gate) | p50=170, p95=171 | N/A | Pass |
| generator | prove_ms | <=25,000 / <=60,000 | N/A (p50 not enforced in gate) | p50=158, p95=161 | N/A | Pass |
| generator | witness_ms | <=250 / <=500 | N/A (p50 not enforced in gate) | p50=0, p95=0 | N/A | Pass |
| oracle fetch | fetch_p95_ms | <=1,000 / <=2,000 | N/A (current run baseline) | p95=383 | N/A | Pass |
| oracle verify | verify_p95_ms | <=500 / <=1,000 | N/A (current run baseline) | p95=8 | N/A | Pass |

Notes:
- `test:perf:proof` now enforces both p50 and p95 budgets.
- Worker failure fallback to main-thread proving is explicitly validated in `prover-runtime.test.ts`.
- Stress test metrics are from current deterministic stress suite output (100 users, concurrency=10).

## 4) Budget Exceptions (If Any)

- Exception: None
- Why this is acceptable now: N/A
- Mitigation: N/A
- Follow-up task: N/A

## 5) Risk / Rollback Notes

- User-visible risk: Low. Changes are test/perf-gate and coverage hardening.
- Safe rollback action: Revert p50 assertions/script env additions and fallback unit test.
- Flags/guards involved: `PROOF_PERF_*` env-configured budget gate.

## 6) Validation Summary

- Typecheck: Pass
- Lint: Pass
- Tests:
  - `tests/unit/zk/prover-runtime.test.ts` pass
  - `tests/integration/proof-performance-budget.test.ts` pass
  - `tests/integration/stress-oracle-volume.test.ts` pass
- Additional checks: Roadmap Phase-2 checkboxes updated to complete.
