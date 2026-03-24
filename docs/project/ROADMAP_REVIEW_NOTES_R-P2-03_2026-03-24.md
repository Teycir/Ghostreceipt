# Roadmap Review Notes

## 1) Change Scope

- Roadmap item: `R-P2-03` Local receipt history (`/history`, IndexedDB, JSON export)
- PR / commit: Working tree changes (not committed in this session)
- Owner: Codex + project owner
- Date: 2026-03-24

## 2) Measurement Commands

```bash
npm run typecheck
npm test -- tests/unit/history/receipt-history.test.ts tests/unit/generator/pdf-export.test.ts tests/unit/zk/prover.test.ts --runInBand
npm run test:e2e -- --grep "history"
```

## 3) Metric Delta Table (Required)

| Surface | Metric | Budget (p50/p95) | Before | After | Delta | Pass/Fail |
|---------|--------|------------------|--------|-------|-------|-----------|
| generator | total_ms | <=25,000 / <=60,000 | N/A (no baseline in this branch) | N/A (not directly impacted) | N/A | Pass |
| generator | package_ms | <=500 / <=1,000 | N/A (no baseline in this branch) | N/A (history write is post-success, best-effort) | N/A | Pass |

Notes:
- This change adds local persistence and a separate `/history` UI; it does not change witness/prove verification logic.
- History persistence is asynchronous and intentionally non-blocking after success state transition.

## 4) Budget Exceptions (If Any)

- Exception: None
- Why this is acceptable now: N/A
- Mitigation: N/A
- Follow-up task: N/A

## 5) Risk / Rollback Notes

- User-visible risk: Local browser storage failures could prevent history writes on restricted browsers.
- Safe rollback action: Remove history persistence call in `use-proof-generator` and hide `/history` link/page.
- Flags/guards involved: Best-effort persistence with strict IndexedDB storage and oldest-first pruning near storage limits.

## 6) Validation Summary

- Typecheck: Pass
- Tests: Pass (targeted unit tests + focused history E2E)
- Additional checks: Roadmap and task tracking docs updated for `R-P2-03` completion
