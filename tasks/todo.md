# Task Plan - 2026-03-24

## Objective

Continue the enhancement roadmap by implementing Phase-1 selective-disclosure decoder prep in runtime code without breaking current proof verification behavior.

## Plan

- [x] Add a canonical public-signal decoder in `lib/zk/share.ts` that centralizes index mapping (legacy-active contract) and exposes oracle commitment + claim fields from one API.
- [x] Add unit tests in `tests/unit/zk/share.test.ts` for decoder mapping/error handling and keep existing extraction behavior stable.
- [x] Update verifier wiring in `lib/verify/receipt-verifier.ts` to use decoder output instead of hard-coded public-signal indexes.
- [x] Validate with `npm run typecheck` and targeted unit tests.

## Review

- Status: Completed
- Notes:
  - Added canonical legacy signal contract helpers in `lib/zk/share.ts`:
    - `extractOracleCommitment(publicSignals)`
    - `decodeLegacyReceiptPublicSignals(publicSignals)`
    - centralized signal index constants used by both commitment and claim extraction.
  - Updated verifier wiring in `lib/verify/receipt-verifier.ts` to source oracle commitment through shared decoder helper instead of direct index reads.
  - Expanded `tests/unit/zk/share.test.ts` with commitment + canonical decode coverage.
  - Validation:
    - `npm run typecheck` pass
    - `npm run test -- tests/unit/zk/share.test.ts` pass
    - `npm run test -- tests/unit/zk` pass
