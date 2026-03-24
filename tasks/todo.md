# Task Plan - 2026-03-24

## Objective

Add full live integration coverage that exercises real BTC/ETH/Solana transactions discovered from Exa, proving oracle fetch/sign/verify behavior and maintaining zk prove/verify evidence for currently supported circuit chains.

## Plan

- [x] Add Exa-derived real-transaction fixtures for BTC/ETH/Solana in `tests/integration/live-oracle-flows.test.ts`.
- [x] Refactor live flow test harness to run by chain and support chain-specific assertions.
- [x] Enforce API-only policy in live tests (no public RPC fallback; require Etherscan + Helius keys for live mode).
- [x] Keep BTC/ETH on full witness + groth16 prove/verify live path.
- [x] Enforce API-only provider cascade behavior for Ethereum/Solana and remove public-RPC runtime paths.
- [x] Run targeted validation commands and capture outcomes.
- [x] Record completion details in roadmap and task review notes.

## Review

- Status: Completed
- Notes:
  - Live integration suite now uses Exa-sourced real transaction fixtures for BTC/ETH/Solana and tries candidates per chain.
  - `tests/integration/live-oracle-flows.test.ts` now:
    - requires API-key configuration in live mode (`ETHERSCAN_API_KEY*`, `HELIUS_API_KEY*`)
    - rejects public-RPC fallback in live mode with explicit setup errors
    - keeps BTC/ETH on full witness + groth16 prove/verify
    - runs Solana full oracle fetch/signature verification flow.
  - API-only provider policy is enforced in runtime cascade:
    - Ethereum: Etherscan keys are mandatory; no `ethereum-public-rpc` fallback.
    - Solana: Helius keys are mandatory; no public-RPC fallback.
  - Removed public-RPC implementation/tests introduced in this branch:
    - deleted `lib/providers/ethereum/public-rpc.ts`
    - deleted `tests/unit/providers/public-rpc-reverted.test.ts`
    - deleted `lib/providers/solana/public-rpc.ts`.
  - Validation:
    - `npm run typecheck` pass
    - `npm run test -- tests/unit/backend-core/http/fetch-tx-keys.test.ts tests/integration/live-oracle-flows.test.ts tests/integration/stress-oracle-volume.test.ts` pass (`live`/`stress` suites skipped without env flags)
    - `LIVE_INTEGRATION=1 npm run test -- tests/integration/live-oracle-flows.test.ts` fails fast with explicit API-key requirement message in this environment (expected).
