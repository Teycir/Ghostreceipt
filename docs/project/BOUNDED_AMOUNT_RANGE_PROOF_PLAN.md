# Bounded Amount Disclosure and Range-Proof Plan

**Status**: Approved for staged implementation  
**Roadmap item**: `R-P3-03`  
**Date**: 2026-03-24  
**Owner**: GhostReceipt maintainers

## 1) Scope

This document defines a single canonical plan for bounded amount disclosure and range-proof rollout.

Policy:
- Keep one runtime verification schema.
- No legacy parser retention after cutover.
- Keep free-tier-safe operation as a hard requirement.

## 2) Goals and Non-Goals

Goals:
- Allow proving amount is inside a user-selected bound set without exposing exact value.
- Preserve deterministic verification and canonical payload parsing.
- Keep proof generation within product SLO guardrails (`p50 < 25s`, `p95 < 60s`) before general rollout.

Non-goals:
- No proving-system migration in this item.
- No mandatory paid proving infrastructure.
- No temporary dual-schema runtime paths.

## 3) Proposed Proof Statement Modes

Mode A: Lower-bound statement
- Prove `realValue >= minAmount`.
- Optional public disclosure of `minAmount` via selective-disclosure mask.

Mode B: Closed range statement
- Prove `minAmount <= realValue <= maxAmount`.
- Optional public disclosure of one or both bounds.

Mode C: Hidden-bound statement
- Prove bounds exist and are satisfied, while both bounds remain hidden.
- Verifier receives only digest commitments and oracle binding.

All modes remain bound to oracle-authenticated transaction facts already enforced by existing constraints.

## 4) Canonical Public Input Additions

Range-proof rollout extends selective-disclosure contract with range-specific fields:
1. `oracleCommitment`
2. `disclosureMask`
3. `disclosedMinAmount`
4. `disclosedMaxAmount`
5. `rangeMode` (`0` lower-bound, `1` closed-range, `2` hidden-bound)
6. `claimDigest`
7. `rangeDigest`

Definitions:
- `claimDigest = Poseidon(minAmount, maxAmount, rangeMode, disclosureMask)`
- `rangeDigest = Poseidon(realValueBucket, rangeMode)` (or equivalent deterministic circuit commitment)
- If a bound is hidden by mask, its disclosed value must be `0`.

## 5) Proving-Time Budget Projections

These projections are planning estimates and must be replaced by measured numbers during implementation.

| Stage | Circuit Change | Expected p50 | Expected p95 | Budget Outlook |
|------|----------------|--------------|--------------|----------------|
| Baseline (today) | Current Groth16 receipt circuit | <= 25s | <= 60s | Pass |
| Stage 1 | Add lower-bound range constraint + digest wiring | 22s-30s | 52s-72s | Medium risk |
| Stage 2 | Add closed-range constraints (two-sided) | 26s-36s | 62s-90s | High risk |
| Stage 3 | Add hidden-bound mode + full selector logic | 28s-40s | 68s-100s | High risk |

Interpretation:
- Stage 1 may pass current SLO in optimized environments.
- Stage 2+ likely needs circuit optimization before broad rollout.
- If p95 exceeds 60s without mitigation, rollout is blocked by policy.

## 6) Rollout Safety Gating

Hard gates before enabling each stage:
- `npm run test:perf:proof` passes with measured `p95 <= 60s`.
- Deterministic decode/verify tests pass for canonical payload schema.
- No increase in required paid infrastructure.
- Mobile verification UX remains responsive and error rates do not regress.

If any gate fails:
- Keep feature disabled.
- Reduce circuit complexity or split rollout scope.
- Re-run benchmark + compatibility tests before retry.

## 7) Phased Implementation Plan

Phase 1: Lower-bound only
- Add minimal constraint set for `realValue >= minAmount`.
- Add canonical decoder support for range-mode `0`.
- Ship behind internal feature flag.

Phase 2: Closed range
- Add `realValue <= maxAmount` constraint path.
- Expand decoder, verifier rendering, and payload tests for mode `1`.
- Keep gated by proof-performance budget.

Phase 3: Hidden-bound mode
- Introduce selector constraints for hidden bound disclosures.
- Add verifier UI states for `Disclosed` vs `Hidden` bounds.
- Remove obsolete non-canonical helper logic during cutover.

## 8) Test and Verification Contract

Required checks before roadmap closeout:
- `npm run typecheck`
- `npm run test -- tests/unit/zk`
- `npm run test -- tests/integration`
- `npm run test:perf:proof`

Required new assertions:
- Public-signal ordering is fixed and documented.
- Hidden-bound fields enforce zeroed public values.
- Canonical payload import rejects malformed range fields.

## 9) Risks and Mitigations

Risk: proving-time budget regression.
- Mitigation: stage-gated rollout and strict benchmark blocking.

Risk: circuit complexity increases verification failures on low-end devices.
- Mitigation: keep lower-bound mode as minimal baseline and defer high-cost modes until optimized.

Risk: payload growth harms QR scannability.
- Mitigation: keep compact key strategy and monitor encoded-length deltas per mode.
