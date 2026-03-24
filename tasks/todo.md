# Task Plan - 2026-03-24

## Objective

Continue the enhancement roadmap by implementing contract-aware public-signal decoding for verification (legacy + selective-disclosure shapes) and wiring verifier output to disclosure states.

## Plan

- [ ] Extend `lib/zk/share.ts` with a canonical contract-aware decoder that can resolve legacy and selective-disclosure public-signal layouts using oracle commitment anchoring.
- [ ] Update `lib/verify/receipt-verifier.ts` to consume the canonical decoder once and return disclosure-state metadata in verification results.
- [ ] Update `app/verify/page.tsx` to render disclosed vs hidden claim fields clearly.
- [ ] Add/expand unit tests in `tests/unit/zk/share.test.ts` and `tests/unit/zk/nullifier.test.ts` for decoder and hidden-claim nullifier compatibility path.
- [ ] Add targeted verifier unit coverage for contract-aware decode behavior.
- [ ] Validate with `npm run typecheck` plus impacted unit test suites.

## Review

- Status: In progress
- Notes:
  - Pending implementation.
