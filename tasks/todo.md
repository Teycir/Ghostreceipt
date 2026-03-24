# Task Plan - 2026-03-24

## Objective

Implement roadmap items 1 and 2 by wiring generator disclosure toggles into share packaging (`disclosureMask`, gated claim fields, `claimDigest`) and enforcing selective-contract share payload shape/order in export/import tests.

## Plan

- [x] Add selective share-signal builders/digest helpers in `lib/zk/share.ts` for generator packaging.
- [x] Extend `lib/zk/prover.ts` payload schema to support selective display signals and preserved proof-verification signals.
- [x] Add disclosure toggles to generator form/types and pass disclosure options from `use-proof-generator` into export packaging.
- [x] Update verifier to validate selective payload consistency against proven legacy claims using preserved verification signals.
- [x] Update/expand unit tests for prover payload export/import order and verifier selective-path behavior.
- [x] Validate with typecheck and impacted unit suites.

## Review

- Status: Completed
- Notes:
  - Added selective packaging helpers in `lib/zk/share.ts`:
    - `deriveSelectiveClaimDigest(...)`
    - `buildSelectiveDisclosurePublicSignals(...)`
  - Extended compact share payload format in `lib/zk/prover.ts`:
    - `s` now supports selective display signals for generator exports
    - `v` now preserves legacy proof-verification signals when selective packaging is used
    - `exportProof(...)` is now async and accepts selective disclosure packaging options.
  - Added generator disclosure toggles and wiring:
    - `discloseAmount` / `discloseMinDate` added to `GeneratorFormValues`
    - UI controls added to `components/generator/generator-form.tsx`
    - `use-proof-generator` now forwards disclosure settings to selective packaging export.
  - Updated verifier consistency logic:
    - proof verification uses `proofPublicSignals` when present
    - selective `s` payload claims are checked against proven legacy claim tuple
    - selective `claimDigest` is recomputed and enforced.
  - Updated tests to enforce selective payload order/fields and selective verification behavior:
    - `tests/unit/zk/share.test.ts`
    - `tests/unit/zk/prover.test.ts`
    - `tests/unit/verify/receipt-verifier.test.ts`
    - `tests/integration/proof-generation.test.ts`
  - Validation:
    - `npm run typecheck` pass
    - `npm run test -- tests/unit/zk/share.test.ts tests/unit/zk/prover.test.ts tests/unit/verify/receipt-verifier.test.ts tests/integration/proof-generation.test.ts` pass
    - `npm run test -- tests/unit/zk` pass
