# Task Plan - 2026-03-24

## Objective (Ethereum USDC Dropdown + Stable API-Only Scope)

Add a stablecoin option in the generator dropdown flow using Etherscan only (USDC on Ethereum ERC-20), keep Monero excluded due current stability constraints, and preserve existing BTC/ETH/SOL behavior.

## Plan

- [x] Add API request/schema support for Ethereum asset mode (`native` or `usdc`).
- [x] Extend Etherscan provider to extract USDC transfer value from ERC-20 logs when `usdc` mode is selected.
- [x] Prevent canonical cache collisions by keying Ethereum cache entries by `txHash + ethereumAsset`.
- [x] Add generator dropdown option for Ethereum asset selection and wire request payload.
- [x] Update amount/unit formatting across generator, success card, PDF export, and history views for USDC display.
- [x] Add/adjust unit API/provider tests for new USDC mode and schema constraints.
- [x] Run typecheck and targeted tests.

## Review (Ethereum USDC Dropdown + Stable API-Only Scope)

- Status: Completed
- Notes:
  - Added `ethereumAsset` request support (`native` / `usdc`) via `OracleFetchTxRequestSchema`.
  - Etherscan now supports USDC mode by summing USDC `Transfer` log values from `eth_getTransactionReceipt` logs.
  - Home generator includes an `Ethereum Asset` dropdown with `ETH (native)` and `USDC (ERC-20)`.
  - Amount unit labels/placeholders/human formatting now reflect USDC base units when selected.
  - Monero intentionally not integrated in this scope.
  - Validation:
    - `npm run typecheck` pass.
    - `npm run test -- tests/unit/providers/etherscan.test.ts tests/unit/api/oracle-fetch-tx.test.ts tests/unit/generator/pdf-export.test.ts tests/unit/history/receipt-history.test.ts` pass.

## Objective (Receipt History CTA Placement + Stable API Scope)

Fix overlap/floating behavior by placing the receipt history CTA directly below the generator frame on both mobile and desktop, and lock Monero out of current scope unless a stable free-tier API path is proven.

## Plan

- [x] Remove floating/fixed history CTA from home screen layout.
- [x] Place a single in-flow `View Receipt History` button directly below the generator frame for all breakpoints.
- [x] Increase mobile bottom spacing so CTA stays visible above footer overlap.
- [ ] Add only stable free-tier provider integrations; skip Monero integration unless API stability criteria are met.
- [x] Run validation and record outcome.

## Review (Receipt History CTA Placement + Stable API Scope)

- Status: In progress
- Notes:
  - Home page now uses one in-flow history CTA below the generator card (mobile + desktop).
  - Floating corner history link is removed from the home layout to prevent overlap/follow behavior.
  - Monero remains intentionally excluded for now pending stable free-tier provider confirmation.
  - Validation:
    - `npm run typecheck` pass.

## Objective (Doc-Based Provider Throttling)

Parameterize provider throttling by documented API limits (Etherscan, Helius, mempool, Blockchair) and apply context-aware pacing so live API fetch flows remain reliable without hardcoded one-off delays.

## Plan

- [x] Add a shared provider-throttling utility that:
  - consumes provider + context + env overrides
  - computes request spacing from doc-based RPS defaults
  - supports per-provider keyed queues.
- [x] Integrate throttling utility into all active oracle providers (`etherscan`, `helius`, `mempool.space`, `blockchair`) and remove one-off throttle logic from individual providers.
- [x] Parameterize API-key cascade attempt delay for Etherscan/Helius using provider-specific throttle policy instead of fixed literals.
- [x] Add/adjust unit tests for throttling policy resolution and provider behavior with deterministic zero-throttle test overrides.
- [x] Run typecheck + targeted provider tests + live integration (`BTC/ETH/SOL`) with real API data and keys.
- [x] Record completion summary in roadmap/task review notes.

## Review (Doc-Based Provider Throttling)

- Status: Completed
- Notes:
  - Added shared throttle policy module: `lib/libraries/backend-core/providers/provider-throttle.ts`.
  - Added context-aware throttling profiles:
    - `reliability` (default), `balanced`, `throughput`, `off`
    - global env override: `ORACLE_PROVIDER_THROTTLE_CONTEXT`
    - provider-specific context envs: `ETHERSCAN_THROTTLE_CONTEXT`, `HELIUS_THROTTLE_CONTEXT`, `MEMPOOL_THROTTLE_CONTEXT`, `BLOCKCHAIR_THROTTLE_CONTEXT`.
  - Added conservative safety buffer for computed throttles:
    - default 10% extra wait on derived intervals to reduce provider-block risk
    - configurable via `ORACLE_PROVIDER_THROTTLE_SAFETY_BUFFER_MULTIPLIER`.
  - Added provider-specific env overrides:
    - direct throttle: `*_REQUEST_THROTTLE_MS`
    - documented-rate override: `*_RATE_LIMIT_RPS`
    - key attempt delay (where applicable): `ETHERSCAN_KEY_ATTEMPT_DELAY_MS`, `HELIUS_KEY_ATTEMPT_DELAY_MS`.
  - Applied policy to active providers:
    - `etherscan` + `helius`: request throttling and API-key attempt delay now resolved by shared policy.
    - `mempool.space` + `blockchair`: request throttling now resolved by shared policy.
  - Validation:
    - `npm run typecheck` pass
    - `npm run test -- tests/unit/providers/provider-throttle.test.ts tests/unit/providers/etherscan.test.ts tests/unit/providers/helius.test.ts tests/unit/providers/mempool.test.ts tests/unit/backend-core/http/fetch-tx-keys.test.ts` pass
    - `LIVE_INTEGRATION=1 npm run test -- tests/integration/live-oracle-flows.test.ts` pass with real API providers (`mempool.space`, `etherscan`, `helius`).

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
  - Ported Etherscan throttling/cascade pacing pattern from `Repos/smartcontractpatternfinder`:
    - added shared inter-request throttling for Etherscan v2 proxy calls
    - added safer delay between key attempts in API-key cascade execution for Ethereum.
  - Removed public-RPC implementation/tests introduced in this branch:
    - deleted `lib/providers/ethereum/public-rpc.ts`
    - deleted `tests/unit/providers/public-rpc-reverted.test.ts`
    - deleted `lib/providers/solana/public-rpc.ts`.
  - Validation:
    - `npm run typecheck` pass
    - `npm run test -- tests/unit/backend-core/http/fetch-tx-keys.test.ts tests/integration/live-oracle-flows.test.ts tests/integration/stress-oracle-volume.test.ts` pass (`live`/`stress` suites skipped without env flags)
    - `LIVE_INTEGRATION=1 npm run test -- tests/integration/live-oracle-flows.test.ts` passes with real BTC/ETH/SOL API data (`mempool.space`, `etherscan`, `helius`) when keys are provided.
