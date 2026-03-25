# Task Plan - 2026-03-24

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
