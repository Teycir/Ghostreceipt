# Task Plan: External Code Review Remediation (Signer, BTC, Security Hardening)

# Task Plan: ETH API-First Cascade + Multi-User Stress Hardening

- [x] Inspect `smartcontractpatternfinder` and align Etherscan key cascade behavior (shuffle + rolling attempts + short delay).
- [x] Inspect `honeypotscan` and port high-stress in-memory rate-limit protections (bounded store + throttled cleanup).
- [x] Set ETH provider strategy to API-first with RPC as last fallback attempt.
- [x] Make provider cascade ordering priority-driven (shuffle only within same priority).
- [x] Expand Etherscan env key loading to support primary + up to 6 key slots.
- [x] Update tests/docs to match new ETH cascade and stress-tuned limiter behavior.
- [x] Run typecheck + impacted unit suites and record results.

## Review
- ETH route now prefers Etherscan API key cascade and keeps `ethereum-public-rpc` as final fallback.
- Provider ordering is deterministic by `config.priority`; randomized load distribution now happens only within equal-priority groups.
- Etherscan key loading now supports `ETHERSCAN_API_KEY` and optional `_1` through `_6`.
- `EtherscanProvider` now follows rolling key attempts with `50ms` delay between keys, aligned to the reference implementation style.
- `RateLimiter` now includes:
  - throttled cleanup cycles,
  - bounded store size with eviction under high-cardinality load,
  - optional tuning knobs via config (`cleanupIntervalMs`, `maxStoreSize`).
- Verification:
  - `npm run typecheck` passes.
  - `npm test -- tests/unit/providers/cascade.test.ts tests/unit/security/rate-limit.test.ts tests/unit/providers/mempool.test.ts tests/unit/oracle-signer.test.ts tests/unit/api/oracle-verify-signature-route.test.ts tests/unit/api/fetch-tx-route.test.ts tests/unit/api/oracle-fetch-tx.test.ts` passes (61 tests).

# Task Plan: External Code Review Remediation (Signer, BTC, Security Hardening)

- [x] Replace HMAC-based oracle signing with Ed25519 asymmetric signatures.
- [x] Remove duplicate signer-side hashing path and enforce commitment hash as single source of truth.
- [x] Fix mempool BTC confirmation depth using current tip height.
- [x] Add rate limiting to `/api/oracle/verify-signature`.
- [x] Harden SSRF private/local address blocklist coverage.
- [x] Update `.env.example` and security docs for `TRUST_PROXY_HEADERS`, in-memory limiter/replay limits, CSP trade-offs, and BTC value semantics.
- [x] Add/update tests under `tests/` for signer behavior, verify route, mempool confirmations, and SSRF ranges.
- [x] Run typecheck and targeted tests; capture outcomes in review section.

## Review
- Oracle signing now uses Ed25519 (asymmetric) with deterministic `oraclePubKeyId` derived from public key material.
- Removed signer-side competing message hash path (`createMessageHash` / `signCanonicalData` / payload-reshash verify path), so the route commitment hash is the single signing input.
- `MempoolSpaceProvider` now fetches `/api/blocks/tip/height` and computes real confirmation depth (`tip - block + 1`).
- Added per-client/global rate limits to `POST /api/oracle/verify-signature`.
- Expanded SSRF block coverage for `0.0.0.0/8`, `100.64.0.0/10`, `127.0.0.0/8`, and `169.254.0.0/16`.
- Updated ops docs:
  - `.env.example` documents trusted proxy behavior and now defaults `TRUST_PROXY_HEADERS=true` for proxied deployments.
  - `docs/runbooks/SECURITY.md` now documents in-memory limiter/replay limits, CSP trade-offs, and BTC value semantics.
  - `README.md` now documents Ed25519 signing and BTC `valueAtomic` semantics.
- Verification:
  - `npm run typecheck` passes.
  - `npm test -- tests/unit/oracle-signer.test.ts tests/unit/api/oracle-verify-signature-route.test.ts tests/unit/providers/mempool.test.ts tests/unit/security/ssrf.test.ts tests/unit/api/fetch-tx-route.test.ts` passes (42 tests).

# Task Plan: Review Findings Remediation (Round 2)

- [x] Replace spoofable rate-limit identity fallback with trusted-IP-only strategy.
- [x] Add global API limiter fallback when client IP cannot be trusted.
- [x] Release idempotency replay reservations on request failure to allow safe retries.
- [x] Hide raw client error details in production error boundary UI.
- [x] Add/update tests in `tests/` for rate-limit identity and idempotency retry semantics.
- [x] Run typecheck and targeted tests; record verification results.

## Review
- `getClientIdentifier` now returns trusted proxy IP IDs only when `TRUST_PROXY_HEADERS=true`; otherwise returns `null` (no spoofable header fingerprint fallback).
- Added global fallback limiter (`200 req/min`) in `/api/oracle/fetch-tx` while preserving strict per-client limiter (`10 req/min`) when trusted client IDs exist.
- Added `ReplayProtection.release` and wired route failure cleanup so transient errors do not permanently consume `idempotencyKey`.
- `ErrorBoundary` now suppresses raw error messages in production and keeps details only in non-production builds.
- Updated tests:
  - `tests/unit/security/rate-limit.test.ts`
  - `tests/unit/security/replay.test.ts`
  - `tests/unit/api/fetch-tx-route.test.ts`
- Verification:
  - `npm run typecheck` passes.
  - `npm test -- tests/unit/security/rate-limit.test.ts tests/unit/security/replay.test.ts tests/unit/api/fetch-tx-route.test.ts` passes (28 tests).

---

# Task Plan: CVE-2025-59472 Scanner Finding Triage

- [x] Validate advisory affected/fixed ranges from primary sources.
- [x] Verify local dependency graph resolves to a fixed Next.js version.
- [x] Confirm runtime configuration does not enable the vulnerable execution mode.
- [x] Upgrade Next.js ecosystem to latest available stable versions.
- [x] Remove scanner exception and keep scans exception-free.
- [x] Record verification evidence and outcome.

## Review
- Primary-source verification:
  - OSV/GHSA entry for `GHSA-5f7q-jpqc-wp7h` / `CVE-2025-59472` reports fixed version `next@16.1.5` for the 16.x line.
- Local dependency verification:
  - `npm view next dist-tags --json` shows `latest: 16.2.1` and `canary: 16.2.1-canary.4`.
  - `npm view geist dist-tags --json` shows `latest: 1.7.0`.
  - `npm install next@latest geist@latest eslint-config-next@latest` completed with `up to date`.
  - `npm ls next geist --depth=2` resolves `next@16.2.1` both directly and under `geist@1.7.0`.
  - `npm audit --omit=dev` reports `found 0 vulnerabilities`.
- Runtime exposure verification:
  - `rg` found no project configuration enabling `experimental.ppr`, `cacheComponents`, or `NEXT_PRIVATE_MINIMAL_MODE`.
- Scanner verification (no exceptions):
  - Ran OSV-Scanner `v2.3.3` directly against `package-lock.json` with no `osv-scanner.toml` present.
  - Scan completed with no vulnerability IDs reported.

---

# Task Plan: Security Review Findings Remediation

- [x] Harden client identity extraction to prevent header spoofing and avoid global `unknown` throttling.
- [x] Add timer lifecycle controls (`dispose`/`unref`) for rate limiter and replay protection.
- [x] Enforce replay protection in a real runtime path (`idempotencyKey` on oracle fetch endpoint).
- [x] Integrate SSRF URL validation into provider outbound request paths.
- [x] Add/adjust unit tests under `tests/` for the new security behavior.
- [x] Run verification (`typecheck` + targeted tests) and record results.

## Review
- Added trust-aware client identity extraction with secure default (`TRUST_PROXY_HEADERS=false`) and deterministic non-global fallback fingerprint.
- Added `startCleanup`/`stopCleanup`/`dispose` lifecycle controls with `unref` for rate limiter and replay protection timers.
- Enforced anti-replay in `/api/oracle/fetch-tx` using `idempotencyKey` (returns `409` with `REPLAY_DETECTED` on replay).
- Enforced SSRF URL validation in mempool and etherscan provider fetch paths (including health checks).
- Added/updated tests:
  - `tests/unit/security/rate-limit.test.ts`
  - `tests/unit/security/replay.test.ts`
  - `tests/unit/providers/ssrf-enforcement.test.ts`
  - `tests/unit/api/fetch-tx-route.test.ts`
- `npm run typecheck` passes.
- `npm test -- tests/unit/security/rate-limit.test.ts tests/unit/security/replay.test.ts tests/unit/providers/ssrf-enforcement.test.ts tests/unit/api/fetch-tx-route.test.ts` passes (28 tests).

---

# Task Plan: Provider Cascade & API Error Handling Corrections

- [x] Add chain-aware transaction hash validation at request schema boundary.
- [x] Fix cascade error normalization/mapping to be case-insensitive and consistent.
- [x] Implement configured retry behavior (`maxRetries`, `retryDelayMs`) in `ProviderCascade`.
- [x] Improve `NOT_FOUND` cascade behavior to avoid premature stop on first provider.
- [x] Add timeout cancellation plumbing with `AbortSignal` support in providers where available.
- [x] Add unit tests in `tests/` for cascade classification/failover/retry behavior.
- [x] Add route-level tests for invalid hash and error code/status mapping.
- [x] Run targeted tests and summarize results.

## Review
- `npm run typecheck` passes.
- `npm test -- tests/unit/providers/cascade.test.ts tests/unit/api/fetch-tx-route.test.ts` passes (7 tests).
- Jest reported two pre-existing config warnings: `coverageThresholds` should be `coverageThreshold`.

---

# Task Plan: Documentation Organization Cleanup

- [x] Create a central docs index in `docs/README.md`.
- [x] Move strategy/progress docs from repo root into `docs/project/`.
- [x] Move runbook-style docs into `docs/runbooks/`.
- [x] Update all internal references to new document paths.
- [x] Add a short archive note for old planning docs.
- [x] Verify references with repo-wide path scan.

## Review
- Docs are consolidated under `docs/` with `project/` and `runbooks/` groupings.
- Main entry points updated: `README.md`, `CONTRIBUTING.md`, and `agents.md`.
- Verified with `rg` scan that old root doc links are removed from active references.

---

# Task Plan: Review Follow-up Fixes

- [x] Preserve structured provider errors from cascade all-failure path.
- [x] Add real abort propagation for Ethereum public RPC provider calls.
- [x] Return HTTP 400 for malformed JSON request bodies in oracle route.
- [x] Fix Jest coverage threshold config key so CI enforces thresholds.
- [x] Add tests for preserved provider error and malformed JSON handling.
- [x] Run typecheck and targeted tests, then record results.

## Review
- `npm run typecheck` passes.
- `npm test -- tests/unit/providers/cascade.test.ts tests/unit/api/fetch-tx-route.test.ts` passes (10 tests).
- Jest coverage key typo fixed (`coverageThreshold`), and the previous config warning is gone.

---

# Task Plan: CI/CD Hardening

- [x] Tighten workflow security controls (permissions, concurrency, timeout).
- [x] Pin CI Node runtime to `.nvmrc` for env parity.
- [x] Run secret scan via maintained script as an early gate.
- [x] Add dependency-review gate for pull requests.
- [x] Harden secret scan scope to include docs/workflows.
- [x] Validate lint/typecheck/tests/build and summarize results.

## Review
- `npm run check:secrets` passes.
- `npm run lint` passes.
- `npm run typecheck` passes.
- `npm run test:coverage -- --ci --runInBand` passes with enforced thresholds.
- `npm run build` passes (required unsandboxed execution locally due Turbopack process restrictions).
- Next.js config warnings are removed (`typedRoutes` moved to top-level and config renamed to `next.config.mjs`).

---

# Task Plan: Verify & Sharing Integrity Fixes

- [x] Ensure verifier displays claims derived from verified proof signals, not URL metadata.
- [x] Reduce and stabilize share-link payload encoding.
- [x] Add user-facing QR generation error state.
- [x] Handle clipboard paste failures without unhandled promise rejections.
- [x] Add unit tests for proof export/import compatibility and claim extraction from public signals.
- [x] Run typecheck and targeted tests, then summarize.

## Review
- Verifier now only consumes `proof` from URL and derives displayed claims from verified `publicSignals`.
- Proof share payload export/import uses URL-safe base64url with backward-compatible JSON import support.
- Receipt QR generation now exposes a user-facing fallback error while preserving copy-link flow.
- Clipboard paste flow now handles denied/failed reads without surfacing unhandled promise rejections.
- Added unit tests: `tests/unit/zk/prover.test.ts` and `tests/unit/zk/share.test.ts`.
- `npm run typecheck` passes.
- `npm test -- tests/unit/zk/prover.test.ts tests/unit/zk/share.test.ts tests/unit/api/fetch-tx-route.test.ts tests/unit/providers/cascade.test.ts tests/unit/zk/witness.test.ts` passes (26 tests).

---

# Task Plan: Gitignore Hygiene

- [x] Audit current `.gitignore` entries against actual local/generated files.
- [x] Add missing ignore rules for local tool state directories.
- [x] Remove ignore rules that conflict with intentionally tracked files.

## Review
- Added ignores for `/.history/`, `.swc/`, and `.amazonq/`.
- Removed ignores for `package-lock.json` and `next-env.d.ts` to match tracked-file intent.

---

# Task Plan: Implementation Control Follow-up

- [x] Fix stale test fixtures to match current `OraclePayloadV1` fields.
- [x] Re-run lint/typecheck/tests/build to verify implementation health.
- [x] Align reuse/provenance wording with actual implementation state.
- [x] Refresh implementation progress tracking for API endpoint tests.

## Review
- Updated schema fields in:
  - `tests/integration/proof-generation.test.ts`
  - `tests/unit/generator/witness-integration.test.ts`
- `npm run check:secrets` passes.
- `npm run lint` passes.
- `npm run typecheck` passes.
- `npm run test:coverage -- --ci --runInBand` passes (52 tests).
- `npm run build` passes (required unsandboxed execution due Turbopack sandbox process constraints).

---

# Task Plan: Dependency Vulnerability Triage & Remediation

- [x] Capture current dependency vulnerability inventory from local tooling.
- [x] Normalize and prioritize findings by severity and direct/transitive upgrade path.
- [x] Apply the minimal safe dependency updates in `package.json`/`package-lock.json`.
- [x] Run verification checks (`lint`, `typecheck`, targeted tests) after upgrades.
- [x] Summarize resolved findings, remaining risk, and follow-up recommendations.

## Review
- Vulnerability inventory:
  - `npm audit --json` reports `0` vulnerabilities (info/low/moderate/high/critical all zero).
  - Dependency set totals from audit metadata: `772` total (`101` prod, `635` dev, `63` optional).
- Prioritization results:
  - No security findings to remediate, so no direct or transitive vulnerability upgrade path is required.
  - `npm outdated --json` shows only major-version availability for a subset of packages (feature/compatibility upgrades, not security-critical based on current audit output).
- Dependency updates applied:
  - None required. `package.json` and `package-lock.json` intentionally unchanged to avoid unnecessary major-version churn.
- Verification:
  - `npm run lint` passes.
  - `npm run typecheck` passes.
  - `npm test -- tests/unit/security/rate-limit.test.ts tests/unit/security/replay.test.ts tests/unit/providers/ssrf-enforcement.test.ts tests/unit/api/fetch-tx-route.test.ts` passes (30 tests).
- Remaining risk and follow-up:
  - Risk remains low at time of scan with current lockfile.
  - Follow-up recommendation: keep periodic `npm audit` checks in CI cadence and evaluate major-version upgrades separately as planned compatibility work.

---

# Task Plan: Reverted Tx Rejection & Anonymous Idempotency Isolation

- [x] Reject reverted Ethereum transactions in providers and surface a deterministic API error.
- [x] Isolate idempotency replay scope for anonymous clients using server-issued session identity.
- [x] Add/update tests under `tests/` for reverted tx mapping and anonymous idempotency behavior.
- [x] Run verification (`lint`, `typecheck`, targeted tests) and summarize outcomes.

## Review
- Reverted Ethereum transactions are now rejected at provider level and mapped to deterministic API error handling:
  - `lib/providers/ethereum/public-rpc.ts` throws provider error code `REVERTED` when receipt status indicates revert.
  - `lib/providers/ethereum/etherscan.ts` also maps reverted status to `REVERTED`.
  - `app/api/oracle/fetch-tx/route.ts` maps `REVERTED` to API code `TRANSACTION_REVERTED` with HTTP `422`.
- Anonymous idempotency replay scope is isolated by server-issued session identity in `app/api/oracle/fetch-tx/route.ts`:
  - Introduced secure `gr_sid` cookie flow for anonymous callers.
  - Replay keys now use `sid:<session>` scope instead of global anonymous scope.
- Added/updated tests:
  - `tests/unit/api/fetch-tx-route.test.ts`
  - `tests/unit/api/oracle-verify-signature-route.test.ts`
  - `tests/unit/providers/public-rpc-reverted.test.ts`
  - `tests/unit/zk/oracle-commitment.test.ts`
  - `tests/unit/zk/witness.test.ts`
  - `tests/unit/zk/prover.test.ts`
  - `tests/unit/generator/witness-integration.test.ts`
  - `tests/integration/proof-generation.test.ts`
  - `tests/unit/zk/test-vectors.ts` (migrated fixtures to `oracleCommitment` and `chainId`)
- Verification:
  - `npm run lint` passes.
  - `npm run typecheck` passes.
  - Targeted tests pass (`8` suites, `42` tests).
  - Full coverage pass: `npm run test:coverage -- --ci --runInBand` (`17` suites, `113` tests).

---

# Task Plan: External Review Triage Alignment

- [x] Validate which external-review gaps are already addressed in repo code/docs.
- [x] Fix circuit runbook drift to match current commitment-based circuit inputs/constraints.
- [x] Harden circuit compilation script for trusted-setup acquisition fallback and artifact path accuracy.
- [x] Verify script syntax and updated docs references.

## Review
- Updated `docs/runbooks/CIRCUIT_COMPILATION.md` to reflect current circuit model:
  - Replaced `oracleSignature` docs with `oracleCommitment` + `chainId`.
  - Corrected witness calculator path to `public/zk/receipt_js/receipt.wasm`.
  - Added explicit trusted-setup/provenance guidance and production checklist.
- Updated `scripts/compile-circuit.sh`:
  - Added fallback to local ptau generation when Hermez ptau download fails.
  - Corrected generated-file output path to `receipt_js/receipt.wasm`.
  - Preserves final ptau for reproducibility and removes only local intermediate ptau files.
- Validation:
  - `bash -n scripts/compile-circuit.sh` passes.
  - `rg` confirms no stale `oracleSignature` witness-input references remain in the circuit runbook (except a historical note).

---

# Task Plan: Trust Model & Release-Readiness Docs

- [x] Add an explicit Oracle Trust Model section to `README.md`.
- [x] Expand `docs/runbooks/SECURITY.md` with oracle key custody, rotation, and incident response policy.
- [x] Add a trusted setup provenance checklist template under `docs/runbooks/`.
- [x] Add a first-release and live-demo readiness checklist under `docs/project/`.
- [x] Update docs indexes/links and verify references.

## Review
- Added `Oracle Trust Model` section in `README.md` with:
  - explicit centralized-oracle trust assumptions,
  - oracle capability/non-capability framing,
  - operational controls and links to runbooks/checklists.
- Expanded `docs/runbooks/SECURITY.md`:
  - added oracle key custody policy,
  - added 90-day rotation cadence and immediate-rotation triggers,
  - added high-level rotation procedure and compromise-response addendum,
  - corrected note about `package-lock.json` (tracked, not gitignored).
- Added trusted setup provenance template:
  - `docs/runbooks/TRUSTED_SETUP_PROVENANCE_TEMPLATE.md`.
- Added release/demo readiness checklist:
  - `docs/project/RELEASE_READINESS_CHECKLIST.md`.
- Updated index/discovery links:
  - `docs/README.md`
  - `README.md` documentation section.
- Validation:
  - `rg` confirms new links and trust-model references are present.

---

# Task Plan: Release Artifact & Discoverability Follow-up

- [x] Add `CHANGELOG.md` with an initial structured release history.
- [x] Add a repo metadata checklist covering GitHub topics typo fix and live demo URL publication.
- [x] Update `README.md` to expose GhostReceipt release/demo status transparently.
- [x] Update docs index links for new release/discoverability docs.
- [x] Verify references and summarize follow-up items that require GitHub settings access.

## Review
- Added `CHANGELOG.md` with an `Unreleased` section covering recent security/ZK/oracle pipeline updates.
- Added `docs/project/REPO_METADATA_CHECKLIST.md` for repository-level actions that require GitHub settings access:
  - topic typo fix (`payement` -> `payment`),
  - live demo URL publication,
  - first-tag release metadata hygiene.
- Updated `README.md`:
  - added explicit status line (`Unreleased`, live demo not yet published),
  - added links to metadata checklist and changelog.
- Updated `docs/README.md`:
  - added links to metadata checklist and changelog.
- Validation:
  - `rg` confirms the new references are present in README/docs index.
- Remaining manual actions (outside repo files):
  - update GitHub repo topics in repository settings,
  - set repo website/live demo URL once deployed,
  - publish first tagged release notes on GitHub Releases.

---

# Task Plan: Cryptographic Execution Evidence

- [x] Add a completed trusted-setup provenance record populated from current artifacts.
- [x] Add a plain-language circuit self-review mapping product claims to enforced constraints.
- [x] Link new evidence docs from `README.md` and `docs/README.md`.
- [x] Verify references and record remaining external actions.

## Review
- Added completed provenance record:
  - `docs/runbooks/TRUSTED_SETUP_PROVENANCE_2026-03-22.md`
  - includes versions, commit hash, artifact checksums, and verification command results (`Powers Of tau file OK`, `ZKey Ok`).
- Added circuit self-review doc:
  - `docs/runbooks/CIRCUIT_SELF_REVIEW.md`
  - maps product claims to constraints and explicitly lists current trust/coverage limits.
- Linked both docs from:
  - `README.md`
  - `docs/README.md`
- Verification:
  - `snarkjs powersoftau verify public/zk/pot14_final.ptau` passes.
  - `snarkjs zkey verify public/zk/receipt.r1cs public/zk/pot14_final.ptau public/zk/receipt_final.zkey` passes.
  - `rg` confirms link wiring in README/docs index.
- Remaining external/manual actions:
  - Obtain security + cryptography reviewer sign-off fields in the provenance record.
  - Publish live demo URL and update GitHub repo metadata settings.

---

# Task Plan: Phase 1 Shipment Lock-in

- [x] Run focused verification for `/api/oracle/fetch-tx` endpoint, BTC/ETH adapters, and signing flow.
- [x] Confirm Zod request validation and structured error mapping behavior in tests.
- [x] Update `docs/project/IMPLEMENTATION_PROGRESS.md` to mark Phase 1 as shipped.
- [x] Record verification evidence and define immediate next phase.

## Review
- Implemented BTC fallback adapter integration in route:
  - Added `BlockchairProvider` and wired it into BTC provider cascade.
  - BTC fallback is now always attempted (API key optional).
- Improved failover behavior in `ProviderCascade`:
  - `RATE_LIMIT` now fails over immediately to the next provider (no repeated retries on the same limited provider).
- Updated phase tracking:
  - `docs/project/IMPLEMENTATION_PROGRESS.md` now marks Phase 1 as shipped and records deferred/non-blocking items.
- Verification (non-mocked route flow):
  - `npm run typecheck` passes.
  - `npm test -- tests/unit/api/oracle-fetch-tx.test.ts` passes (10 tests).
  - Console logs confirm BTC provider cascade attempts fallback on primary error.
