# Selective Disclosure Public-Input Contract

**Status**: Approved for implementation  
**Roadmap item**: `R-P3-02`  
**Date**: 2026-03-24  
**Owner**: GhostReceipt maintainers

## 1) Scope

This document defines the single canonical public-input contract for selective disclosure.

Policy:
- One runtime schema only.
- No legacy parser branch after cutover.
- Old links can fail after cutover by design.

## 2) Goals and Non-Goals

Goals:
- Keep deterministic verification and a single canonical decode path.
- Let sender choose whether to disclose amount threshold and/or date threshold.
- Keep oracle binding mandatory for trust (`oracleCommitment` stays required).
- Stay within roadmap latency budgets.

Non-goals:
- No dual-format compatibility window.
- No range proofs in this item (handled by `R-P3-03`).
- No new paid infrastructure.

## 3) Canonical Contract

Public signal order (authoritative):
1. `oracleCommitment`
2. `disclosureMask`
3. `disclosedClaimedAmount`
4. `disclosedMinDate`
5. `claimDigest`

Definitions:
- `oracleCommitment`: existing oracle message hash bound to oracle signature metadata.
- `disclosureMask`: bitfield string value:
  - bit `0` (`1`): disclose amount threshold.
  - bit `1` (`2`): disclose minimum date threshold.
  - allowed values: `0..3`.
- `disclosedClaimedAmount`:
  - equals private `claimedAmount` if amount bit is set.
  - must be `0` if amount bit is not set.
- `disclosedMinDate`:
  - equals private `minDate` if date bit is set.
  - must be `0` if date bit is not set.
- `claimDigest`:
  - deterministic field hash of private claim tuple:
  - `Poseidon(claimedAmount, minDate, disclosureMask)`
  - binds hidden and disclosed modes to one proof statement.

Private inputs:
- `claimedAmount`, `minDate`, `realValue`, `realTimestamp`, `txHash`, `chainId`.

Required constraints:
- `realValue >= claimedAmount`
- `realTimestamp >= minDate`
- disclosure-mask gates for public claim fields as defined above
- `claimDigest` matches private values + mask

## 4) Share Payload Contract (Post-Cutover)

The compact share payload container remains canonical and single-schema:
- `p`: proof points
- `s`: public signals (now using the order in Section 3)
- `o`: oracle auth block
- `m`: optional receipt metadata

Verifier extraction must move from hard-coded indexes (`[0],[1],[2]`) to a contract decoder that maps:
- `oracleCommitment` from `s[0]`
- selective disclosure fields from `s[1..4]`

## 5) Phased Implementation Plan

Phase 1: Circuit and decoder prep
- add new circuit public-signal layout and constraints
- add one canonical TypeScript decoder for selective-disclosure claims
- update verifier to consume decoder output only

Phase 2: UI and generation wiring
- add disclosure toggles in generator UI (amount/date)
- pass `disclosureMask` and gated public values during witness/proof packaging
- render verification output conditionally based on disclosure flags

Phase 3: Hard cutover
- remove previous public-signal assumptions from runtime code
- reject pre-cutover payload shape with explicit error
- keep one parser path only

## 6) Hard Cutover Checklist

- Update `extractVerifiedClaims` for new signal contract.
- Update generator export/import tests for new canonical `s` order.
- Update verify page claims rendering for hidden fields.
- Remove obsolete helper logic tied to old signal order.
- Update docs and review note with budget deltas.
- Run typecheck + unit + integration + proof perf checks.

Cutover is complete only when old payload behavior is deleted, not just deprecated.

## 7) Migration Trigger Points

Proceed only if all are true:
- Proof verification remains deterministic for identical inputs across environments.
- `test:perf:proof` budgets pass (`p50 <= 25s`, `p95 <= 60s`).
- QR/share size impact is acceptable for current mobile scan baseline.
- No free-tier cost increase is introduced.

Stop and rework if any are true:
- Budget regressions without mitigation.
- Decoder ambiguity or non-deterministic claim extraction.
- Significant QR scan reliability drop in E2E checks.

## 8) Risks and Mitigations

Risk: mismatch between circuit signal order and TypeScript extraction.
- Mitigation: one authoritative decoder + unit tests that assert exact index mapping.

Risk: selective disclosure UX confusion.
- Mitigation: explicit verifier labels (`Disclosed` vs `Hidden`) and deterministic rendering.

Risk: payload growth harms scanability.
- Mitigation: preserve compact payload keys and monitor encoded-length deltas in tests.
