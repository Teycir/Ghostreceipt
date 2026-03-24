# Roadmap Review Notes

## 1) Change Scope

- Roadmap item: `R-P3-01` Compact canonical proof payload format with hard cutover
- PR / commit: Working tree changes (not committed in this session)
- Owner: Codex + project owner
- Date: 2026-03-24

## 2) Measurement Commands

```bash
npm run typecheck
npm test -- tests/unit/zk/prover.test.ts tests/unit/zk/share.test.ts tests/unit/history/receipt-history.test.ts --runInBand
```

## 3) Metric Delta Table (Required)

| Surface | Metric | Budget (p50/p95) | Before | After | Delta | Pass/Fail |
|---------|--------|------------------|--------|-------|-------|-----------|
| share payload | encoded length (sample proof fixture) | N/A (must shrink) | Legacy encoded payload length | Compact encoded payload length | Reduced | Pass |
| verifier import | canonical parse compatibility | deterministic parse required | Legacy shape accepted | Legacy shape rejected (hard cutover) | stricter | Pass |
| generator runtime | package_ms | <=500 / <=1,000 | N/A (no new telemetry sample in this note) | N/A (logic unchanged except payload key mapping) | N/A | Pass |

Notes:
- This change is payload schema/encoding focused and does not alter witness/prove cryptographic execution.
- The compactness and cutover behavior are asserted in unit tests.

## 4) Budget Exceptions (If Any)

- Exception: None
- Why this is acceptable now: N/A
- Mitigation: N/A
- Follow-up task: N/A

## 5) Risk / Rollback Notes

- User-visible risk: Previously generated links using the legacy encoded payload no longer decode by design.
- Safe rollback action: Reintroduce legacy decoder branch in `ProofGenerator.importProof` (not recommended unless explicitly requested).
- Flags/guards involved: Hard-cutover strict parser (`fromCompactPayload`) with malformed-shape rejection.

## 6) Validation Summary

- Typecheck: Pass
- Tests: Pass (targeted zk + history unit tests)
- Additional checks: Roadmap tracking updated for `R-P3-01` completion
