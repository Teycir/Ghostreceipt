# Task Plan - 2026-03-24

## Objective (Strict Real-Only Live Consensus Validation)

Align live consensus integration tests with production-parity requirements:
- no fixture candidates,
- no runtime fallback discovery in tests,
- no synthetic oracle key injection,
- strict consensus only (`consensus_verified` required).

## Plan

- [x] Refactor `tests/integration/live-consensus-flows.test.ts` to require real tx inputs from env (`LIVE_*` vars) for BTC/ETH(native)/ETH(USDC)/SOL.
- [x] Remove test-side fixture/fallback discovery paths and candidate retry loops.
- [x] Disable synthetic `ORACLE_PRIVATE_KEY` injection and require real key configuration.
- [x] Enforce strict consensus mode and assert `consensus_verified` only.
- [x] Run typecheck and the strict live suite.

## Review (Strict Real-Only Live Consensus Validation)

- Status: Completed
- Notes:
  - `tests/integration/live-consensus-flows.test.ts` now runs in strict real-only mode:
    - requires `LIVE_BTC_TX_HASH`, `LIVE_ETH_TX_HASH`, `LIVE_ETH_USDC_TX_HASH`, `LIVE_SOL_TX_SIGNATURE`,
    - requires real `ORACLE_PRIVATE_KEY`,
    - forces `ORACLE_*_CONSENSUS_MODE=strict`,
    - rejects single-source fallback by asserting `oracleValidationStatus === "consensus_verified"`.
  - Removed Exa fixture candidates and live fallback discovery helpers from the suite.
  - Validation:
    - `npm run typecheck` pass.
    - `LIVE_INTEGRATION=1 npm test -- tests/integration/live-consensus-flows.test.ts --runInBand --ci` fails fast with clear prerequisite error when `ORACLE_PRIVATE_KEY` is missing, as intended in strict mode.

## Objective (Activate User-Supplied Oracle Key + Exa-Derived Strict Inputs)

Use the user-provided oracle private key and Exa-derived live transaction inputs under strict consensus mode, then remove remaining runtime blockers so strict BTC/ETH(native+USDC)/SOL live validation passes end-to-end.

## Plan

- [x] Add user-provided `ORACLE_PRIVATE_KEY` and Exa-derived `LIVE_*` tx env values to local live env.
- [x] Register the corresponding oracle public key/keyId in transparency log so verify-signature accepts the signing key.
- [x] Extend Ethereum public RPC consensus provider to support `ethereumAsset='usdc'` in strict mode.
- [x] Validate Exa-derived tx hashes against real providers and adjust local RPC endpoint for strict dual-source ETH verification.
- [x] Run typecheck and strict live consensus integration test.

## Review (Activate User-Supplied Oracle Key + Exa-Derived Strict Inputs)

- Status: Completed
- Notes:
  - Added user key + Exa-derived live tx inputs in `.env.local`:
    - `ORACLE_PRIVATE_KEY=<redacted-local-secret>`
    - `LIVE_BTC_TX_HASH=d07422d13247b8f59bddd9ea53f8ccbd0f6a14e6f666eb3dde703c7db4fd1f58`
    - `LIVE_ETH_TX_HASH=0x07f38e681d32e36213e575b25a5f6367ac2fee9eb3c3976d9651ec0786c8ca42`
    - `LIVE_ETH_USDC_TX_HASH=0x49f81b3603bda9461ce92925666c215442ed48f53e62ea8b066f3e46d828213c`
    - `LIVE_SOL_TX_SIGNATURE=4AotthQtPNPMenWxNHr9QGaPh8moLAwX4bRMdbi8sezPW5N3vesV9HUDFYo9kH3anGgLNZTtPYDxpKfq7e58o5zs`
  - Added transparency log entry for the user key (`keyId=fb799d7d5cee5079`) in `config/oracle/transparency-log.json`.
  - Updated `lib/providers/ethereum/public-rpc.ts` to support USDC transfer extraction from receipt logs for strict consensus.
  - Set local `ETHEREUM_PUBLIC_RPC_URL=https://ethereum-rpc.publicnode.com` to satisfy strict dual-source ETH verification for Exa-derived hashes.
  - Validation:
    - `npm run typecheck` pass.
    - `LIVE_INTEGRATION=1 npm test -- tests/integration/live-consensus-flows.test.ts --runInBand --ci` pass (`4 passed`).

## Objective (Deterministic Multi-Endpoint Public RPC Lists Without Cascade Refactor)

Keep existing provider cascade topology intact while adding ordered public endpoint lists (most-likely first, deterministic fallback) for BTC/ETH/ETH-USDC/SOL consensus/public providers.

## Plan

- [x] Add ordered endpoint-list support in Ethereum public RPC provider, including dedicated list for USDC mode.
- [x] Add ordered endpoint-list support in Solana public RPC provider.
- [x] Add ordered endpoint-list support in Bitcoin mempool public provider.
- [x] Update `.env.example` with list-based env vars and backward-compatible single-URL vars.
- [x] Run typecheck, targeted unit tests, and strict live consensus integration suite.

## Review (Deterministic Multi-Endpoint Public RPC Lists Without Cascade Refactor)

- Status: Completed
- Notes:
  - Existing cascade chain ordering was not changed; only public providers gained internal endpoint failover lists.
  - Added deterministic, ordered list support:
    - ETH native: `ETHEREUM_PUBLIC_RPC_URLS` (+ single `ETHEREUM_PUBLIC_RPC_URL` fallback)
    - ETH USDC: `ETHEREUM_USDC_PUBLIC_RPC_URLS` (falls back to shared ETH list/single)
    - SOL: `SOLANA_PUBLIC_RPC_URLS` (+ single `SOLANA_PUBLIC_RPC_URL`)
    - BTC (mempool API): `BITCOIN_PUBLIC_RPC_URLS` (+ single `BITCOIN_PUBLIC_RPC_URL`)
  - Endpoint selection is deterministic by list order (no random selection).
  - Validation:
    - `npm run typecheck` pass.
    - `npm test -- tests/unit/backend-core/http/fetch-tx-bitcoin-consensus.test.ts tests/unit/api/fetch-tx-route.test.ts --runInBand --ci` pass.
    - `LIVE_INTEGRATION=1 npm test -- tests/integration/live-consensus-flows.test.ts --runInBand --ci` pass (`4 passed`).

## Objective (Hydrate Provider Keys In Jest From Local Env)

Load provider API keys into in-memory test env from local env files so test runs can use local secrets without manual export.

## Plan

- [x] Add provider-key hydration to `jest.setup.js`.
- [x] Load from local env files with sane precedence and do not override already-set env vars.
- [x] Restrict hydration to provider key variables only.
- [x] Run targeted provider/key-loader tests.

## Review (Hydrate Provider Keys In Jest From Local Env)

- Status: Completed
- Notes:
  - `jest.setup.js` now hydrates provider keys from `.env.test.local`, `.env.local`, `.env.test`, `.env` into `process.env` for tests.
  - Hydration is key-scoped (`ETHERSCAN_*`, `HELIUS_*`, `BLOCKCYPHER_*`) and non-destructive (existing env vars win).
  - Validation:
    - `npm test -- tests/unit/backend-core/http/fetch-tx-keys.test.ts tests/unit/providers/etherscan.test.ts tests/unit/providers/helius.test.ts --runInBand --ci` pass.

## Objective (Remove Key Loader Ceiling That Causes False Exhaustion)

Ensure provider key loaders consume full key pools from env (`_1..N`), not only `_1.._6`, so valid extra keys are not silently ignored and exhausted errors reflect real capacity.

## Plan

- [x] Replace fixed-suffix env loading with dynamic numeric suffix discovery for Etherscan/Helius/BlockCypher.
- [x] Keep deterministic ordering by numeric suffix while preserving primary key precedence.
- [x] Add unit coverage for suffixes above `_6`.
- [x] Run targeted key-loader/provider tests and typecheck.

## Review (Remove Key Loader Ceiling That Causes False Exhaustion)

- Status: Completed
- Notes:
  - `loadEtherscanKeysFromEnv`, `loadHeliusKeysFromEnv`, and `loadBlockCypherKeysFromEnv` now discover all numeric-suffixed env vars (`_1..N`) instead of hard-coding `_1.._6`.
  - Ordering is deterministic (base key first, then numeric suffix ascending), then deduplicated.
  - Added tests with `_9`, `_10`, `_12`, `_11` suffixes to prove non-truncated loading.
  - Validation:
    - `npm test -- tests/unit/backend-core/http/fetch-tx-keys.test.ts tests/unit/providers/api-key-cascade.test.ts tests/unit/providers/etherscan.test.ts tests/unit/providers/helius.test.ts tests/unit/providers/blockcypher.test.ts --runInBand --ci` pass.
    - `npm run typecheck` pass.

## Objective (Prevent False API-Key Exhaustion On Fresh Key Pools)

Treat key rotation as a key-specific recovery mechanism (rate-limit/auth/quota), not a generic response to upstream transport outages. Ensure unknown/5xx/fetch failures stop key rotation to avoid burning through healthy keys and emitting misleading "all keys exhausted" errors.

## Plan

- [x] Add a key-rotation decision hook to `ApiKeyCascade` so providers can classify whether a failure should advance to the next key.
- [x] Wire provider-specific classification for BlockCypher/Etherscan/Helius to rotate only on key/rate-limit/auth/quota signals.
- [x] Add/adjust provider and cascade unit tests for key-agnostic outage behavior (no key spray on HTTP 503).
- [x] Run targeted provider/cascade tests and typecheck to validate behavior.

## Review (Prevent False API-Key Exhaustion On Fresh Key Pools)

- Status: Completed
- Notes:
  - Added `shouldContinueToNextKey` option in `ApiKeyCascade` to allow provider-specific key-rotation gating.
  - Updated `blockcypher`, `etherscan`, and `helius` providers to rotate keys only for key-specific/rate-limit-like failures.
  - Generic upstream outages (`HTTP 5xx`, transport-style unknown failures) now fail fast on the active key instead of exhausting the full key pool.
  - Validation:
    - `npm test -- tests/unit/providers/api-key-cascade.test.ts tests/unit/providers/blockcypher.test.ts tests/unit/providers/etherscan.test.ts tests/unit/providers/helius.test.ts --runInBand --ci` pass.
    - `npm run typecheck` pass.

## Objective (Live Real-Data Consensus Integration Coverage)

Add full live integration coverage that validates consensus behavior with real data for BTC/ETH/SOL, including oracle fetch/signature flow, consensus labeling assertions, witness/proof verification, and signature verification.

## Plan

- [x] Add dedicated live integration test suite for consensus validation across BTC/ETH/SOL.
- [x] Force consensus-on execution in live tests via strict chain consensus env flags.
- [x] Assert consensus output fields (`oracleValidationStatus`, `oracleValidationLabel`) for real-data flows.
- [x] Run full witness + Groth16 prove/verify + verify-signature within consensus live tests.
- [x] Add a dedicated npm command for the new live consensus suite.
- [x] Execute the live consensus test command and capture outcomes.

## Review (Live Real-Data Consensus Integration Coverage)

- Status: Completed
- Notes:
  - Added `tests/integration/live-consensus-flows.test.ts` with real BTC/ETH/SOL candidates and full flow assertions:
    - `/api/oracle/fetch-tx` response schema parse,
    - consensus label/status validation (`consensus_verified` or `single_source_fallback`, never `single_source_only`),
    - oracle commitment recomputation,
    - witness build/validate,
    - Groth16 prove/verify,
    - `/api/oracle/verify-signature` validation.
  - Added `npm run test:live:consensus`.
  - Updated `scripts/run-live-oracle-tests.sh` so `npm run test:live:oracle` runs both:
    - `tests/integration/live-oracle-flows.test.ts`
    - `tests/integration/live-consensus-flows.test.ts`
  - Validation:
    - `npm run typecheck` pass.
    - `npm run test:live:consensus` pass.
    - `npm run test:live:oracle` pass.

## Objective (Best-Effort Multi-Chain Consensus + Zero-Friction Validation Label)

Shift oracle consensus behavior to reliability-first operation:
- attempt dual-source consensus on BTC/ETH/SOL,
- fall back to single-source signing when peer consensus source is unavailable,
- expose validation status as a read-only label in returned payload/UI (no extra user actions).

## Plan

- [x] Add cross-chain consensus mode support in backend fetch/sign flow with best-effort fallback on peer unavailability.
- [x] Add public consensus verification providers for Ethereum and Solana.
- [x] Add consensus validation label fields to oracle payload schema and return values.
- [x] Render validation label in existing success receipt card (no new buttons/checkboxes/inputs).
- [x] Add/adjust unit tests for consensus/fallback behavior and payload/schema compatibility.
- [x] Update project docs to reflect new best-effort consensus policy and ETH/SOL consensus sources.
- [x] Run targeted test suite and capture review notes.

## Review (Best-Effort Multi-Chain Consensus + Zero-Friction Validation Label)

- Status: Completed
- Notes:
  - Consensus logic is now multi-chain and reliability-first:
    - BTC/ETH/SOL attempt peer consensus validation.
    - Peer unavailability degrades to single-source signing in `best_effort`.
    - Canonical mismatches still fail closed.
  - Added public consensus verification providers:
    - `lib/providers/ethereum/public-rpc.ts`
    - `lib/providers/solana/public-rpc.ts`
  - Added passive validation metadata to oracle payload:
    - `oracleValidationStatus`
    - `oracleValidationLabel`
  - Generator success UI now renders validation as a standard read-only field (`Validation`) with no new controls or user actions.
  - Validation:
    - `npm run typecheck` pass.
    - `npm run test -- tests/unit/backend-core/http/fetch-tx-bitcoin-consensus.test.ts tests/unit/backend-core/http/fetch-tx-keys.test.ts tests/unit/api/fetch-tx-route.test.ts` pass.

## Objective (Roadmap Continuation: USDC Stabilization + Documentation)

Continue roadmap execution by closing documentation/tracking gaps for the newly added Ethereum USDC mode and adding dedicated regression coverage for unit formatting behavior.

## Plan

- [x] Add focused unit tests for `lib/format/units.ts` covering Ethereum native + USDC modes.
- [x] Update user-facing docs (`README`, `public/docs/faq.html`) to reflect USDC support and explicit Monero deferral.
- [x] Update canonical roadmap file with `R-P2-04` completion notes for Ethereum asset selector support.
- [x] Run typecheck + targeted tests.

## Review (Roadmap Continuation: USDC Stabilization + Documentation)

- Status: Completed
- Notes:
  - Added dedicated format-unit tests for `ETH` and `USDC` amount conversions/placeholders.
  - Updated public docs to state Ethereum USDC support and keep Monero explicitly deferred.
  - Added roadmap completion entries for `R-P2-04`.
  - Validation:
    - `npm run typecheck` pass.
    - `npm run test -- tests/unit/format/units.test.ts tests/unit/providers/etherscan.test.ts tests/unit/api/oracle-fetch-tx.test.ts` pass.

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
- [x] Add only stable free-tier provider integrations; skip Monero integration unless API stability criteria are met.
- [x] Run validation and record outcome.

## Review (Receipt History CTA Placement + Stable API Scope)

- Status: Completed
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

## Objective (Solana Proof Path Operational)

Make Solana fully operational in the proof generation path (not only oracle fetch/sign), including generator UX enablement, witness/circuit compatibility, artifact regeneration, and validation updates.

## Plan

- [x] Enable Solana selection in generator chain dropdown and apply client-side Solana signature validation/placeholder behavior.
- [x] Extend witness builder + witness validation to support Solana (`chainId = 2`) with tx-hash chunk derivation aligned to oracle commitment semantics.
- [x] Update `circuits/receipt.circom` chain constraint to accept `0|1|2` and regenerate zk artifacts (`wasm`, `zkey`, `verification_key`).
- [x] Update tests/docs/artifact versioning and run typecheck + targeted zk/generator tests.

## Review (Solana Proof Path Operational)

- Status: Completed
- Notes:
  - Enabled `Solana (SOL)` in the primary chain dropdown and added client-side base58 signature validation + placeholder messaging.
  - Witness generation now supports Solana with `chainId=2` and deterministic `txHash[8]` chunk derivation from `sha256(base58Decode(signature))` to match oracle commitment semantics.
  - Circuit chain constraint now accepts `0|1|2` via quadratic-safe `IsEqual` selector checks.
  - Regenerated ZK artifacts in `public/zk` (`receipt.wasm`, `receipt_final.zkey`, `verification_key.json`, `Verifier.sol`).
  - Updated runbooks/self-review/provenance notes and bumped `NEXT_PUBLIC_ZK_ARTIFACT_VERSION` default stamp to `2026-03-25`.
  - Validation:
    - `npm run compile:circuit` pass
    - `npm run typecheck` pass
    - `npm run test -- tests/unit/zk/witness.test.ts tests/unit/generator/witness-integration.test.ts tests/unit/format/units.test.ts tests/integration/proof-generation.test.ts` pass
    - `npm run test -- tests/unit/zk/oracle-commitment.test.ts tests/unit/zk/prover-runtime.test.ts` pass

## Objective (Live Solana E2E Integration Coverage)

Add a dedicated real-data end-to-end Solana integration test that validates oracle fetch/signature + commitment binding + witness + Groth16 prove/verify in one isolated flow.

## Plan

- [x] Add `tests/integration/live-solana-e2e.test.ts` with live-gated execution (`LIVE_INTEGRATION=1`).
- [x] Use real Solana transaction candidates (env override + curated fixtures) and assert full pipeline success.
- [x] Run the dedicated live Solana integration test and capture result in review.

## Review (Live Solana E2E Integration Coverage)

- Status: Completed
- Notes:
  - Added dedicated live Solana E2E integration test at `tests/integration/live-solana-e2e.test.ts`.
  - Added shared local env hydration helper for live tests: `tests/integration/helpers/load-env-local.ts` (loads `.env.local` into `process.env` for `NODE_ENV=test` runs).
  - Flow covers: real `/api/oracle/fetch-tx` (Solana via Helius) -> commitment recomputation check -> witness build/validation -> Groth16 `fullProve` -> Groth16 verify -> `/api/oracle/verify-signature`.
  - Candidate sourcing supports:
    - env override: `LIVE_SOL_TX_SIGNATURE`
    - curated real tx fixtures (Solscan mainnet signatures).
  - Added helper script: `npm run test:live:solana`.
  - Validation:
    - `npm run typecheck` pass
    - `npm run test -- tests/integration/live-solana-e2e.test.ts` pass (skipped by default without `LIVE_INTEGRATION=1`)
    - `LIVE_INTEGRATION=1 npm run test -- tests/integration/live-solana-e2e.test.ts --runInBand` pass with local `.env.local` Helius keys.

## Objective (Husky Hook Repair)

Fix broken Husky pre-commit/pre-push hook bootstrap so normal `git commit` and `git push` no longer fail with `.husky/h` path errors.

## Plan

- [x] Update top-level hooks to source `.husky/_/h` directly.
- [x] Add compatibility fallback in `.husky/_/husky.sh` for old templates.
- [x] Validate hook scripts execute without bootstrap errors.

## Review (Husky Hook Repair)

- Status: Completed
- Notes:
  - Patched `.husky/pre-commit` and `.husky/pre-push` to source `.husky/_/h`.
  - Updated `.husky/_/husky.sh` to support both caller contexts (`./_/h` and `./h`) as a defensive compatibility shim.
  - Validation:
    - `HUSKY=0 sh .husky/pre-commit` pass
    - `HUSKY=0 sh .husky/pre-push` pass
    - `sh .husky/_/husky.sh` pass

## Objective (CI Artifact Version Test Stability)

Resolve CI failure in `tests/unit/zk/artifacts.test.ts` caused by hardcoded fallback version expectation after artifact-version bump.

## Plan

- [x] Replace hardcoded fallback version assertion with dynamic default-version baseline.
- [x] Run targeted unit test and typecheck.

## Review (CI Artifact Version Test Stability)

- Status: Completed
- Notes:
  - Updated invalid-version fallback test to derive the expected default from `getZkArtifactVersion()` when env is unset.
  - This removes brittle coupling to literal date strings and prevents repeated breakage on intentional artifact-version updates.
  - Validation:
    - `npm run test -- tests/unit/zk/artifacts.test.ts` pass
    - `npm run typecheck` pass

## Objective (Release Readiness Artifact Checksum Automation)

Advance the roadmap into release-readiness execution by automating deterministic checksum capture for core ZK artifacts and wiring the command into release/provenance docs.

## Plan

- [x] Add a reusable checksum utility for canonical ZK artifacts (`wasm`, `zkey`, `verification_key`, plus optional related artifacts).
- [x] Add a CLI script + npm command to print a deterministic checksum report for release evidence collection.
- [x] Add focused unit tests for checksum utility behavior in `tests/unit`.
- [x] Update release/provenance docs to reference the new checksum command and current artifact evidence path.
- [x] Run typecheck + targeted tests + checksum command and record outcomes.

## Review (Release Readiness Artifact Checksum Automation)

- Status: Completed
- Notes:
  - Added reusable checksum utility at `lib/zk/artifact-checksums.js` with deterministic canonical target ordering and strict required-artifact enforcement.
  - Added CLI command `npm run check:zk-artifact-checksums` via `scripts/check-zk-artifact-checksums.mjs` (supports `--json` and `--required-only`).
  - Added focused unit coverage at `tests/unit/zk/artifact-checksums.test.ts`.
  - Updated release/provenance docs and roadmap tracking to include checksum automation in release gates and reproducibility commands.
  - Added roadmap review note: `docs/project/ROADMAP_REVIEW_NOTES_RELEASE_READINESS_CHECKSUM_AUTOMATION_2026-03-25.md`.
  - Validation:
    - `npm run test -- tests/unit/zk/artifact-checksums.test.ts` pass
    - `npm run typecheck` pass
    - `npm run check:zk-artifact-checksums -- --json` pass

## Objective (Release Readiness Command + API-Only Doc Consistency Gate)

Continue roadmap execution by adding an automated release-readiness checker command and eliminating stale ETH public-RPC fallback claims from trust-critical docs.

## Plan

- [x] Add reusable release-readiness doc checks module for critical documentation expectations.
- [x] Add `check:release-readiness` CLI command + npm script to run doc checks and key release checks (`oracle transparency`, `zk checksums`).
- [x] Update README API/trust sections to align with current API-only ETH/SOL provider policy.
- [x] Add focused unit tests for release-readiness doc check behavior.
- [x] Run validation commands and record completion evidence.

## Review (Release Readiness Command + API-Only Doc Consistency Gate)

- Status: Completed
- Notes:
  - Added release-readiness doc consistency checks at `lib/release/readiness-checks.js` (with typings in `lib/release/readiness-checks.d.ts`).
  - Added new gate command `npm run check:release-readiness` via `scripts/check-release-readiness.mjs`.
  - New command enforces:
    - trust-critical doc checks (README trust-model presence, API-only wording, security/circuit runbook anchors)
    - execution of `check-oracle-transparency-log`
    - execution of `check-zk-artifact-checksums --required-only`.
  - Updated README provider wording to remove stale public-RPC fallback claims and align ETH/SOL with current API-only runtime policy.
  - Added focused unit coverage at `tests/unit/release/readiness-checks.test.ts`.
  - Validation:
    - `npm run test -- tests/unit/release/readiness-checks.test.ts` pass
    - `npm run typecheck` pass
    - `npm run check:release-readiness` pass

## Objective (BTC Free-Tier Fallback Cascade Hardening)

Align Bitcoin provider reliability with zero-budget constraints by removing paid-key assumptions from the runtime fallback path and using real free-tier/public providers only.

## Plan

- [x] Replace Blockchair in active BTC cascade with a free-tier API fallback provider (BlockCypher).
- [x] Remove Blockchair API key wiring from oracle fetch route/runtime options.
- [x] Update BTC provider/cascade tests for new fallback topology.
- [x] Update docs/config templates to remove Blockchair key dependency messaging.
- [x] Run targeted tests + typecheck and capture review evidence.

## Review (BTC Free-Tier Fallback Cascade Hardening)

- Status: Completed
- Notes:
  - Removed Blockchair from active BTC runtime cascade and replaced fallback with `blockcypher` free-tier API provider.
  - Added `BlockCypherProvider` implementation at `lib/providers/bitcoin/blockcypher.ts`.
  - Removed `BLOCKCHAIR_API_KEY` wiring from `/api/oracle/fetch-tx` request flow and fetch options.
  - Updated BTC cascade coverage to assert free-provider topology (`mempool.space` + `blockcypher`).
  - Updated docs/config guidance to stop requiring Blockchair key setup in default flow.
  - Validation:
    - `npm run test -- tests/unit/providers/blockcypher.test.ts tests/unit/backend-core/http/fetch-tx-keys.test.ts tests/unit/providers/provider-throttle.test.ts tests/unit/api/fetch-tx-route.test.ts` pass
    - `npm run typecheck` pass
    - `npm run check:release-readiness` pass

## Objective (BTC BlockCypher-Primary + Conservative Spike Controls)

Use the provided BlockCypher key pool as primary BTC source, keep public provider as last fallback, and ensure retry/throttle behavior remains conservative under volume spikes.

## Plan

- [x] Persist BlockCypher token pool in `.env.local` using numbered env vars.
- [x] Add BlockCypher env loader + key-rotation wiring in BTC cascade creation.
- [x] Switch BTC provider priority/order to BlockCypher primary and mempool.space fallback.
- [x] Make BlockCypher retry behavior conservative on `429` (avoid key-spray amplification).
- [x] Update/unit-test docs + route/provider tests for new order and conservative behavior.
- [x] Run targeted test suite + typecheck and capture review evidence.

## Review (BTC BlockCypher-Primary + Conservative Spike Controls)

- Status: Completed
- Notes:
  - Persisted the user-provided BlockCypher key pool in local env with numbered token vars (`BLOCKCYPHER_API_TOKEN`, `_1.._4`) next to existing Etherscan/Helius keys.
  - Added `loadBlockCypherKeysFromEnv()` and wired BTC cascade creation to pass key-rotation config into `BlockCypherProvider`.
  - Enforced BlockCypher as BTC primary by provider priority/order (`blockcypher` priority `1`, `mempool.space` priority `2`), keeping mempool as last public fallback.
  - Hardened conservative spike behavior by stopping intra-provider key spray on BlockCypher `429` and failing over to public fallback instead.
  - Updated README/.env template/roadmap notes and unit-route/provider tests to match the new topology and behavior.
  - Validation:
    - `npm run test -- tests/unit/providers/blockcypher.test.ts tests/unit/backend-core/http/fetch-tx-keys.test.ts tests/unit/api/fetch-tx-route.test.ts tests/unit/api/oracle-fetch-tx.test.ts tests/unit/providers/provider-throttle.test.ts` pass
    - `npm run typecheck` pass

## Objective (Live BTC BlockCypher E2E Integration)

Add a dedicated live BTC end-to-end integration test that validates the full oracle and ZK flow using BlockCypher as the primary provider path.

## Plan

- [x] Add `tests/integration/live-bitcoin-blockcypher-e2e.test.ts` with `LIVE_INTEGRATION=1` gating and `.env.local` hydration.
- [x] Require BlockCypher API token configuration and fail fast if missing.
- [x] Execute full flow: fetch-tx route, commitment recomputation, witness build/validation, Groth16 prove/verify, verify-signature route.
- [x] Add npm script for this live test and run it with live mode enabled.
- [x] Record validation evidence in this review section.

## Review (Live BTC BlockCypher E2E Integration)

- Status: Completed
- Notes:
  - Added dedicated live BTC integration at `tests/integration/live-bitcoin-blockcypher-e2e.test.ts`.
  - Test is explicitly `LIVE_INTEGRATION=1` gated and hydrates `.env.local`.
  - Enforces BlockCypher token presence before execution (`BLOCKCYPHER_API_TOKEN` + `_1.._6` / alias keys).
  - Validates full E2E pipeline:
    - `/api/oracle/fetch-tx` (bitcoin)
    - oracle commitment recomputation
    - witness build + validation
    - Groth16 prove + verify
    - `/api/oracle/verify-signature`
  - Asserts BlockCypher provider usage via runtime metrics (`totalAttempts > 0`, `totalSuccesses > 0`) so the run proves BlockCypher path, not public fallback.
  - Added script `npm run test:live:btc:blockcypher` for repeatable execution.
  - Validation:
    - `npm run typecheck` pass
    - `npm run test:live:btc:blockcypher` pass (`[Cascade] Success with provider: blockcypher`)
  - Residual note:
    - Jest emitted a standard open-handles warning after completion (`Jest did not exit one second after the test run has completed`), but the test itself passed with real network/API flow.

## Objective (No-UX BTC Oracle Trust Hardening: Dual-Source Fail-Closed)

Harden BTC oracle trust without adding any user-facing steps by requiring dual-source canonical agreement before signing and failing closed on disagreement/provider verification gaps.

## Plan

- [x] Add strict BTC dual-source consensus gate in canonical fetch/sign flow (`blockcypher` + `mempool.space`).
- [x] Fail closed when verification provider is unavailable or canonical values mismatch.
- [x] Keep production default strict while preserving test ergonomics (`ORACLE_BTC_CONSENSUS_MODE` with test default `off`).
- [x] Add focused unit tests for strict-pass, strict-mismatch, strict-unavailable, and off-mode behavior.
- [x] Append roadmap/progress/docs with the hardening change and run validation.

## Review (No-UX BTC Oracle Trust Hardening: Dual-Source Fail-Closed)

- Status: Completed
- Notes:
  - Added strict BTC consensus gate in `fetch-tx` path: after BTC canonical fetch, oracle signing proceeds only when a second provider independently confirms immutable canonical fields.
  - Hardened behavior is fail-closed:
    - verification provider fetch failure => request rejected (`Bitcoin consensus unavailable`)
    - canonical mismatch => request rejected (`Bitcoin consensus mismatch`)
  - Added configurable mode:
    - `ORACLE_BTC_CONSENSUS_MODE=strict|off`
    - default is `strict` outside test env, `off` in `NODE_ENV=test` for deterministic unit-test isolation.
  - Added dedicated unit coverage: `tests/unit/backend-core/http/fetch-tx-bitcoin-consensus.test.ts`.
  - Added error mapping for consensus failures to `PROVIDER_ERROR` (HTTP 502) and route-level unit assertion.
  - Updated docs/config:
    - `.env.example` includes `ORACLE_BTC_CONSENSUS_MODE=strict`
    - README/API model and configuration updated with strict BTC consensus behavior
    - enhancement roadmap/progress entries appended
  - Validation:
    - `npm run test -- tests/unit/backend-core/http/fetch-tx-bitcoin-consensus.test.ts tests/unit/backend-core/http/fetch-tx-keys.test.ts tests/unit/api/fetch-tx-route.test.ts`
    - `npm run typecheck`
    - `npm run test:live:btc:blockcypher` pass (`[Cascade] Success with provider: blockcypher`)

## Objective (Stabilize Current Error Gates Without Touching Real Local Test Data)

Resolve current lint/test/release-check failures while preserving user-provided real local env test data as-is.

## Plan

- [x] Identify current failing gate(s) and isolate root cause.
- [x] Apply minimal code/test fixes only (no secret/data deletion from local env files).
- [ ] Re-run quality checks (secrets/readiness/typecheck/lint/tests) and verify green.
- [ ] Commit and push only after gates are confirmed green.
