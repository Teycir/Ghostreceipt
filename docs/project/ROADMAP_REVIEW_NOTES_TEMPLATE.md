# Roadmap Review Notes Template

Use this template for changes linked to items in `docs/project/ENHANCEMENT_ROADMAP.md`.

## 1) Change Scope

- Roadmap item:
- PR / commit:
- Owner:
- Date:

## 2) Measurement Commands

List exact commands used to collect before/after metrics.

```bash
# Example:
# npm run test:perf:proof
# npm run test:stress:oracle
```

## 3) Metric Delta Table (Required)

| Surface | Metric | Budget (p50/p95) | Before | After | Delta | Pass/Fail |
|---------|--------|------------------|--------|-------|-------|-----------|
| generator | total_ms | <=25,000 / <=60,000 |  |  |  |  |
| generator | prove_ms | <=25,000 / <=60,000 |  |  |  |  |
| generator | witness_ms | <=250 / <=500 |  |  |  |  |
| generator | package_ms | <=500 / <=1,000 |  |  |  |  |
| oracle fetch | fetch_p95_ms | <=1,000 / <=2,000 |  |  |  |  |
| oracle verify | verify_p95_ms | <=500 / <=1,000 |  |  |  |  |

Rules:
- `Delta = After - Before`.
- Include only impacted surfaces; remove non-applicable rows.
- If no baseline exists, mark `Before` as `N/A (new metric)` and explain in notes.

## 4) Budget Exceptions (If Any)

- Exception:
- Why this is acceptable now:
- Mitigation:
- Follow-up task:

## 5) Risk / Rollback Notes

- User-visible risk:
- Safe rollback action:
- Flags/guards involved:

## 6) Validation Summary

- Typecheck:
- Tests:
- Additional checks:
