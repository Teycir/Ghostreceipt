# Task Plan: Enhancement M1 Step 5 - Proof Speed Track (Preload + Worker + Telemetry)

- [ ] Add artifact path/version resolver with cache-safe invalidation token.
- [ ] Add proactive artifact preload on generator idle with deduplicated requests.
- [ ] Move proof generation off main thread via Web Worker with safe fallback.
- [ ] Add performance telemetry for `fetch_ms`, `witness_ms`, `prove_ms`, `package_ms`, `total_ms`.
- [ ] Add UX slow-path guidance when proving crosses threshold.
- [ ] Add focused unit tests for artifact caching/versioning and worker-aware prover flow.
- [ ] Verify with typecheck and focused tests.

# Task Plan: Enhancement M1 Step 4 - Transparency Log Validation On Verifier Path

- [x] Define and add append-only transparency log JSON schema + repository-hosted artifact.
- [x] Implement transparency-log parser/validator with hash-chain integrity checks.
- [x] Enforce `oraclePubKeyId` validity at `signedAt` during oracle signature verification.
- [x] Add route/backend tests for unknown/revoked/expired key outcomes.
- [x] Add key-rotation runbook guidance + CI validation command for log consistency.
- [x] Verify with typecheck and focused tests.

## Review
- Added repository-hosted append-only transparency log artifact:
  - [`config/oracle/transparency-log.json`](/home/teycir/Repos/GhostReceipt/config/oracle/transparency-log.json)
- Added transparency-log parser/validator with hash-chain + key-id integrity checks:
  - [`lib/libraries/backend-core/http/oracle-transparency-log.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/backend-core/http/oracle-transparency-log.ts)
- Wired transparency validity enforcement into signature verification path:
  - [`lib/libraries/backend-core/http/verify-signature.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/backend-core/http/verify-signature.ts)
  - [`app/api/oracle/verify-signature/route.ts`](/home/teycir/Repos/GhostReceipt/app/api/oracle/verify-signature/route.ts)
  - [`app/verify/page.tsx`](/home/teycir/Repos/GhostReceipt/app/verify/page.tsx)
- Exported new transparency APIs through backend-core HTTP index:
  - [`lib/libraries/backend-core/http/index.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/backend-core/http/index.ts)
- Added tests for unknown/revoked/expired/log-tamper outcomes:
  - [`tests/unit/backend-core/http/oracle-transparency-log.test.ts`](/home/teycir/Repos/GhostReceipt/tests/unit/backend-core/http/oracle-transparency-log.test.ts)
  - [`tests/unit/api/oracle-verify-signature-route.test.ts`](/home/teycir/Repos/GhostReceipt/tests/unit/api/oracle-verify-signature-route.test.ts)
- Added CI + local validation command for transparency-log consistency:
  - [`scripts/check-oracle-transparency-log.mjs`](/home/teycir/Repos/GhostReceipt/scripts/check-oracle-transparency-log.mjs)
  - [`package.json`](/home/teycir/Repos/GhostReceipt/package.json)
  - [`.github/workflows/ci.yml`](/home/teycir/Repos/GhostReceipt/.github/workflows/ci.yml)
- Updated rotation/runbook + release checklist guidance:
  - [`docs/runbooks/SECURITY.md`](/home/teycir/Repos/GhostReceipt/docs/runbooks/SECURITY.md)
  - [`docs/project/RELEASE_READINESS_CHECKLIST.md`](/home/teycir/Repos/GhostReceipt/docs/project/RELEASE_READINESS_CHECKLIST.md)
- Verification:
  - `npm run check:oracle-transparency-log` passes.
  - `npm run typecheck` passes.
  - `npm run test -- tests/unit/backend-core/http/oracle-transparency-log.test.ts tests/unit/api/oracle-verify-signature-route.test.ts --runInBand` passes.

# Task Plan: Enhancement M1 Step 3 - Nullifier Registry + Verifier Conflict Checks

- [x] Define nullifier derivation from oracle commitment and document rationale in code/docs.
- [x] Add nullifier metadata to oracle payload/share payload path.
- [x] Implement server-side nullifier registry abstraction (adapter + in-memory default).
- [x] Enforce conflict semantics: same nullifier + same claim allow, same nullifier + different claim reject.
- [x] Add dedicated nullifier-check API route and wire verifier flow to call it.
- [x] Add focused unit tests for nullifier module and nullifier route behavior.
- [x] Verify with typecheck and focused tests.

## Review
- Added reusable nullifier derivation + claim digest helpers, registry abstraction, and in-memory adapter:
  - [`lib/libraries/backend-core/http/oracle-nullifier.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/backend-core/http/oracle-nullifier.ts)
- Exported nullifier module through backend-core HTTP index:
  - [`lib/libraries/backend-core/http/index.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/backend-core/http/index.ts)
- Added nullifier metadata to signed oracle payload and share payload validation path:
  - [`lib/validation/schemas.ts`](/home/teycir/Repos/GhostReceipt/lib/validation/schemas.ts)
  - [`lib/libraries/backend-core/http/fetch-tx.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/backend-core/http/fetch-tx.ts)
  - [`components/generator/generator-form.tsx`](/home/teycir/Repos/GhostReceipt/components/generator/generator-form.tsx)
  - [`lib/zk/prover.ts`](/home/teycir/Repos/GhostReceipt/lib/zk/prover.ts)
- Added dedicated nullifier-check API route and verifier integration:
  - [`app/api/oracle/check-nullifier/route.ts`](/home/teycir/Repos/GhostReceipt/app/api/oracle/check-nullifier/route.ts)
  - [`app/verify/page.tsx`](/home/teycir/Repos/GhostReceipt/app/verify/page.tsx)
- Added focused tests:
  - [`tests/unit/backend-core/http/oracle-nullifier.test.ts`](/home/teycir/Repos/GhostReceipt/tests/unit/backend-core/http/oracle-nullifier.test.ts)
  - [`tests/unit/api/oracle-check-nullifier-route.test.ts`](/home/teycir/Repos/GhostReceipt/tests/unit/api/oracle-check-nullifier-route.test.ts)
  - Updated impacted tests:
    - [`tests/unit/api/fetch-tx-route.test.ts`](/home/teycir/Repos/GhostReceipt/tests/unit/api/fetch-tx-route.test.ts)
    - [`tests/unit/zk/prover.test.ts`](/home/teycir/Repos/GhostReceipt/tests/unit/zk/prover.test.ts)
    - [`tests/unit/zk/witness.test.ts`](/home/teycir/Repos/GhostReceipt/tests/unit/zk/witness.test.ts)
    - [`tests/unit/generator/witness-integration.test.ts`](/home/teycir/Repos/GhostReceipt/tests/unit/generator/witness-integration.test.ts)
    - [`tests/integration/proof-generation.test.ts`](/home/teycir/Repos/GhostReceipt/tests/integration/proof-generation.test.ts)
- Verification:
  - `npm run typecheck` passes.
  - `npm run test -- tests/unit/backend-core/http/oracle-nullifier.test.ts tests/unit/api/oracle-check-nullifier-route.test.ts tests/unit/api/oracle-verify-signature-route.test.ts tests/unit/api/fetch-tx-route.test.ts tests/unit/zk/prover.test.ts tests/unit/zk/witness.test.ts tests/unit/generator/witness-integration.test.ts tests/integration/proof-generation.test.ts --runInBand` passes.

# Task Plan: Enhancement M1 Step 2 - Nonce Replay Registry + Window Enforcement

- [x] Add nonce replay registry abstraction with adapter interface for production/durable backends.
- [x] Implement in-memory nonce replay adapter for local/dev/tests.
- [x] Enforce replay window checks on verify route (`signedAt` future skew + `expiresAt` expiry).
- [x] Enforce nonce conflict policy: same nonce + same payload allowed (idempotent), same nonce + different payload rejected.
- [x] Add route-level replay error responses with structured reason metadata.
- [x] Add focused unit tests for replay allow/deny matrix and verify-route behavior.
- [x] Verify with typecheck and focused tests.

## Review
- Added reusable replay-registry abstraction + local in-memory adapter:
  - [`lib/libraries/backend-core/http/oracle-auth-replay.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/backend-core/http/oracle-auth-replay.ts)
- Exported replay helpers through backend-core HTTP index:
  - [`lib/libraries/backend-core/http/index.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/backend-core/http/index.ts)
- Wired verify route replay-window + nonce conflict enforcement:
  - [`app/api/oracle/verify-signature/route.ts`](/home/teycir/Repos/GhostReceipt/app/api/oracle/verify-signature/route.ts)
- Added focused tests for registry behavior and verify-route replay outcomes:
  - [`tests/unit/backend-core/http/oracle-auth-replay.test.ts`](/home/teycir/Repos/GhostReceipt/tests/unit/backend-core/http/oracle-auth-replay.test.ts)
  - [`tests/unit/api/oracle-verify-signature-route.test.ts`](/home/teycir/Repos/GhostReceipt/tests/unit/api/oracle-verify-signature-route.test.ts)
- Verification:
  - `npm run typecheck` passes.
  - `npm run test -- tests/unit/backend-core/http/oracle-auth-replay.test.ts tests/unit/api/oracle-verify-signature-route.test.ts tests/unit/api/fetch-tx-route.test.ts tests/unit/oracle-signer.test.ts tests/unit/security/replay.test.ts --runInBand` passes.

# Task Plan: Canonical Oracle Auth Structure (Single Schema, No Version Labels)

- [x] Remove `v1`/`v2` schema branching and keep one canonical oracle payload shape.
- [x] Remove version-labelled signer/verification helpers and keep one envelope signing path.
- [x] Remove `schemaVersion`/`signatureVersion` version labels from runtime payloads.
- [x] Update generator/verifier/share-payload code to require one auth envelope structure.
- [x] Update tests/fixtures to one structure naming and one verification path.
- [x] Verify with typecheck and focused tests.

## Review
- Unified schema to one canonical payload (no `OraclePayloadV1`/`OraclePayloadV2` split):
  - [`lib/validation/schemas.ts`](/home/teycir/Repos/GhostReceipt/lib/validation/schemas.ts)
- Unified signer API to one envelope model (`signAuthEnvelope`, `verifyAuthEnvelope`) and removed version-labelled methods:
  - [`lib/oracle/signer.ts`](/home/teycir/Repos/GhostReceipt/lib/oracle/signer.ts)
- Unified server paths to one verify request structure and one fetch payload shape:
  - [`lib/libraries/backend-core/http/fetch-tx.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/backend-core/http/fetch-tx.ts)
  - [`lib/libraries/backend-core/http/verify-signature.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/backend-core/http/verify-signature.ts)
  - [`lib/libraries/backend-core/http/index.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/backend-core/http/index.ts)
- Unified client/share handling around one auth structure:
  - [`components/generator/generator-form.tsx`](/home/teycir/Repos/GhostReceipt/components/generator/generator-form.tsx)
  - [`app/verify/page.tsx`](/home/teycir/Repos/GhostReceipt/app/verify/page.tsx)
  - [`lib/zk/prover.ts`](/home/teycir/Repos/GhostReceipt/lib/zk/prover.ts)
- Updated test fixtures/assertions away from versioned naming:
  - [`tests/unit/api/oracle-verify-signature-route.test.ts`](/home/teycir/Repos/GhostReceipt/tests/unit/api/oracle-verify-signature-route.test.ts)
  - [`tests/unit/api/fetch-tx-route.test.ts`](/home/teycir/Repos/GhostReceipt/tests/unit/api/fetch-tx-route.test.ts)
  - [`tests/unit/oracle-signer.test.ts`](/home/teycir/Repos/GhostReceipt/tests/unit/oracle-signer.test.ts)
  - [`tests/unit/zk/prover.test.ts`](/home/teycir/Repos/GhostReceipt/tests/unit/zk/prover.test.ts)
  - [`tests/unit/zk/witness.test.ts`](/home/teycir/Repos/GhostReceipt/tests/unit/zk/witness.test.ts)
  - [`tests/unit/generator/witness-integration.test.ts`](/home/teycir/Repos/GhostReceipt/tests/unit/generator/witness-integration.test.ts)
  - [`tests/integration/proof-generation.test.ts`](/home/teycir/Repos/GhostReceipt/tests/integration/proof-generation.test.ts)
  - [`tests/integration/live-oracle-flows.test.ts`](/home/teycir/Repos/GhostReceipt/tests/integration/live-oracle-flows.test.ts)
  - [`tests/integration/stress-oracle-volume.test.ts`](/home/teycir/Repos/GhostReceipt/tests/integration/stress-oracle-volume.test.ts)
- Verification:
  - `npm run typecheck` passes.
  - `npm run test -- tests/unit/oracle-signer.test.ts tests/unit/api/fetch-tx-route.test.ts tests/unit/api/oracle-verify-signature-route.test.ts tests/unit/zk/prover.test.ts tests/unit/zk/witness.test.ts tests/unit/generator/witness-integration.test.ts tests/integration/proof-generation.test.ts --runInBand` passes.

# Task Plan: Enhancement M1 Step 1 - Oracle Attestation v2 Envelope

- [x] Add v2 oracle auth schema/types (`nonce`, `expiresAt`, `signatureVersion`) with v1 compatibility union types.
- [x] Add deterministic envelope canonicalization + full-envelope signing/verification helpers for v2 auth.
- [x] Update oracle fetch signing path to emit v2 payloads while keeping existing commitment/witness compatibility.
- [x] Update verify-signature route/core helper + verifier client path to validate v2 payloads and keep v1 support.
- [x] Add focused tests for v2 success path + tamper/backward-compatibility behavior.
- [x] Verify with typecheck and targeted unit/integration tests.

## Review
- Added v2-capable schema surface with v1 compatibility union:
  - [`lib/validation/schemas.ts`](/home/teycir/Repos/GhostReceipt/lib/validation/schemas.ts)
- Added deterministic v2 envelope canonicalization + signing/verification primitives:
  - [`lib/oracle/signer.ts`](/home/teycir/Repos/GhostReceipt/lib/oracle/signer.ts)
- Updated fetch signing pipeline to emit v2 auth envelope (`nonce`, `expiresAt`, `signatureVersion`) while preserving `messageHash` witness compatibility:
  - [`lib/libraries/backend-core/http/fetch-tx.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/backend-core/http/fetch-tx.ts)
- Updated verify-signature core schema/logic to accept v2 and legacy v1 payloads:
  - [`lib/libraries/backend-core/http/verify-signature.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/backend-core/http/verify-signature.ts)
  - [`lib/libraries/backend-core/http/index.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/backend-core/http/index.ts)
- Updated generator/share/import/verify client flows for v2 auth metadata transport:
  - [`components/generator/generator-form.tsx`](/home/teycir/Repos/GhostReceipt/components/generator/generator-form.tsx)
  - [`lib/zk/prover.ts`](/home/teycir/Repos/GhostReceipt/lib/zk/prover.ts)
  - [`app/verify/page.tsx`](/home/teycir/Repos/GhostReceipt/app/verify/page.tsx)
  - [`lib/libraries/zk-core/witness.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/zk-core/witness.ts)
- Added/updated focused coverage for v2 behavior + compatibility:
  - [`tests/unit/oracle-signer.test.ts`](/home/teycir/Repos/GhostReceipt/tests/unit/oracle-signer.test.ts)
  - [`tests/unit/api/oracle-verify-signature-route.test.ts`](/home/teycir/Repos/GhostReceipt/tests/unit/api/oracle-verify-signature-route.test.ts)
  - [`tests/unit/api/fetch-tx-route.test.ts`](/home/teycir/Repos/GhostReceipt/tests/unit/api/fetch-tx-route.test.ts)
  - [`tests/unit/zk/prover.test.ts`](/home/teycir/Repos/GhostReceipt/tests/unit/zk/prover.test.ts)
  - [`tests/integration/live-oracle-flows.test.ts`](/home/teycir/Repos/GhostReceipt/tests/integration/live-oracle-flows.test.ts)
  - [`tests/integration/stress-oracle-volume.test.ts`](/home/teycir/Repos/GhostReceipt/tests/integration/stress-oracle-volume.test.ts)
- Verification:
  - `npm run typecheck` passes.
  - `npm run test -- tests/unit/oracle-signer.test.ts tests/unit/api/fetch-tx-route.test.ts tests/unit/api/oracle-verify-signature-route.test.ts tests/unit/zk/prover.test.ts tests/unit/zk/witness.test.ts tests/integration/proof-generation.test.ts --runInBand` passes.

# Task Plan: CI Stress Test Rate-Limit Alignment

- [x] Diagnose `npm run test:stress:oracle` CI failure and identify rate-limit bottleneck.
- [x] Ensure stress test command sets burst/per-minute route limits high enough for synthetic CI load.
- [x] Re-run stress test command and confirm success-rate gate passes (`>= 0.99`).

## Review
- Updated stress script to set fetch/verify minute + burst limits before route modules initialize:
  - [`package.json`](/home/teycir/Repos/GhostReceipt/package.json)
- Verification:
  - `npm run test:stress:oracle` passes.
  - Summary after fix: `successRate=1`, `failureCount=0`, `fetchP95=440ms`, `verifyP95=6ms`.

# Task Plan: Reusable API Key Cascade Core (Cross-Project)

- [x] Extract a provider-agnostic API key cascade utility in backend-core (`rotation`, `attempt order`, `usage tracking`, `failover`).
- [x] Migrate Etherscan provider to the shared cascade utility (no behavior regression).
- [x] Migrate Helius provider to the shared cascade utility (random start + sequential failover).
- [x] Keep provider-specific non-retryable error guards while centralizing generic retry/failover mechanics.
- [x] Add focused unit tests for the shared key-cascade utility.
- [x] Re-run provider tests to prove migration parity.

## Review
- Added reusable API-key cascade utility:
  - [`lib/libraries/backend-core/providers/api-key-cascade.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/backend-core/providers/api-key-cascade.ts)
  - [`lib/libraries/backend-core/providers/index.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/backend-core/providers/index.ts)
  - [`lib/providers/api-key-cascade.ts`](/home/teycir/Repos/GhostReceipt/lib/providers/api-key-cascade.ts)
- Migrated providers to shared utility:
  - [`lib/providers/ethereum/etherscan.ts`](/home/teycir/Repos/GhostReceipt/lib/providers/ethereum/etherscan.ts)
  - [`lib/providers/solana/helius.ts`](/home/teycir/Repos/GhostReceipt/lib/providers/solana/helius.ts)
- Added Solana fetch-path support and validation:
  - [`lib/validation/schemas.ts`](/home/teycir/Repos/GhostReceipt/lib/validation/schemas.ts)
  - [`lib/libraries/backend-core/http/fetch-tx.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/backend-core/http/fetch-tx.ts)
  - [`lib/zk/oracle-commitment.ts`](/home/teycir/Repos/GhostReceipt/lib/zk/oracle-commitment.ts)
  - [`lib/libraries/zk-core/witness.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/zk-core/witness.ts)
- Added/updated tests:
  - [`tests/unit/providers/api-key-cascade.test.ts`](/home/teycir/Repos/GhostReceipt/tests/unit/providers/api-key-cascade.test.ts)
  - [`tests/unit/providers/helius.test.ts`](/home/teycir/Repos/GhostReceipt/tests/unit/providers/helius.test.ts)
  - [`tests/unit/providers/etherscan.test.ts`](/home/teycir/Repos/GhostReceipt/tests/unit/providers/etherscan.test.ts)
  - [`tests/unit/api/fetch-tx-route.test.ts`](/home/teycir/Repos/GhostReceipt/tests/unit/api/fetch-tx-route.test.ts)
  - [`tests/unit/api/oracle-fetch-tx.test.ts`](/home/teycir/Repos/GhostReceipt/tests/unit/api/oracle-fetch-tx.test.ts)
  - [`tests/unit/zk/oracle-commitment.test.ts`](/home/teycir/Repos/GhostReceipt/tests/unit/zk/oracle-commitment.test.ts)
  - [`tests/unit/zk/witness.test.ts`](/home/teycir/Repos/GhostReceipt/tests/unit/zk/witness.test.ts)
- Updated local env template key slots to match runtime loaders:
  - [`.env.example`](/home/teycir/Repos/GhostReceipt/.env.example)
- Verification:
  - `npm run typecheck` passes.
  - `npm run test -- tests/unit/providers/api-key-cascade.test.ts tests/unit/providers/etherscan.test.ts tests/unit/providers/helius.test.ts tests/unit/api/fetch-tx-route.test.ts tests/unit/api/oracle-fetch-tx.test.ts tests/unit/zk/oracle-commitment.test.ts tests/unit/zk/witness.test.ts --runInBand` passes.
  - `npm run test -- tests/unit/backend-core/http/fetch-tx-keys.test.ts --runInBand` passes.

# Task Plan: API Request-Per-Second Limits + User Wait Messaging

- [x] Add explicit per-second burst limits in shared oracle rate-limit envelope (in addition to existing rolling window limits).
- [x] Include machine-readable retry metadata in `429` responses (`Retry-After`, retry seconds, reset timestamp).
- [x] Rewire oracle routes to define and use both per-second and rolling-window limits with clear user-facing messages.
- [x] Update generator UX to show clear “wait and try later” messaging when `429` is returned.
- [x] Update verifier UX to surface rate-limit wait messaging instead of a generic signature failure.
- [x] Add/adjust tests for rate-limit response metadata and route behavior.
- [x] Verify with typecheck and focused unit tests.

## Review
- Added burst-limiter support to shared oracle rate-limit envelope and disposal lifecycle:
  - [`lib/libraries/backend-core/http/rate-limit-envelope.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/backend-core/http/rate-limit-envelope.ts)
  - [`lib/libraries/backend-core/http/oracle-route-envelope.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/backend-core/http/oracle-route-envelope.ts)
- Added `Retry-After` + retry details payload for `429` responses:
  - [`lib/libraries/backend/http-errors.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/backend/http-errors.ts)
- Rewired route rate-limit configs to define per-second and per-minute limits (env-overridable) and clearer wait messaging:
  - [`app/api/oracle/fetch-tx/route.ts`](/home/teycir/Repos/GhostReceipt/app/api/oracle/fetch-tx/route.ts)
  - [`app/api/oracle/verify-signature/route.ts`](/home/teycir/Repos/GhostReceipt/app/api/oracle/verify-signature/route.ts)
- Updated UX to surface explicit wait-and-retry messaging for `429` responses:
  - [`components/generator/generator-form.tsx`](/home/teycir/Repos/GhostReceipt/components/generator/generator-form.tsx)
  - [`app/verify/page.tsx`](/home/teycir/Repos/GhostReceipt/app/verify/page.tsx)
- Added targeted unit test for rate-limit response metadata:
  - [`tests/unit/backend/http-errors.test.ts`](/home/teycir/Repos/GhostReceipt/tests/unit/backend/http-errors.test.ts)
- Verification:
  - `npm run typecheck` passes.
  - `npm run test -- tests/unit/backend/http-errors.test.ts tests/unit/api/fetch-tx-route.test.ts tests/unit/api/oracle-verify-signature-route.test.ts --runInBand` passes.

# Task Plan: Helius Local Key Pool Scaffolding

- [x] Add env loader utility for Helius API keys (same style as Etherscan).
- [x] Export Helius key loader through backend-core HTTP index.
- [x] Add `.env.example` placeholders for local Helius key pool setup.
- [x] Add focused unit tests for env key loading/deduplication behavior.
- [x] Update security runbook examples to treat Helius keys as secrets.
- [x] Verify with typecheck and focused unit tests.

## Review
- Added Helius key loader in backend-core HTTP module:
  - [`lib/libraries/backend-core/http/fetch-tx.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/backend-core/http/fetch-tx.ts)
- Exported new loader:
  - [`lib/libraries/backend-core/http/index.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/backend-core/http/index.ts)
- Added local-env placeholders for managed Helius key pool:
  - [`.env.example`](/home/teycir/Repos/GhostReceipt/.env.example)
- Updated security runbook to include Helius key handling/rotation examples:
  - [`docs/runbooks/SECURITY.md`](/home/teycir/Repos/GhostReceipt/docs/runbooks/SECURITY.md)
- Added focused unit tests:
  - [`tests/unit/backend-core/http/fetch-tx-keys.test.ts`](/home/teycir/Repos/GhostReceipt/tests/unit/backend-core/http/fetch-tx-keys.test.ts)
- Verification:
  - `npm run typecheck` passes.
  - `npm run test -- tests/unit/backend-core/http/fetch-tx-keys.test.ts tests/unit/providers/etherscan.test.ts --runInBand` passes.

# Task Plan: Provider Key Rollout Constraints (Helius Now, Alchemy/Monero Later)

- [ ] Configure Helius key pool in local/deployment secret stores only (no tracked file commits).
- [x] Add Solana provider integration to consume Helius key cascade from secrets.
- [x] Add runtime health metrics for Helius key rotation and failover.
- [ ] Create deferred implementation track for Alchemy integration (blocked by technical constraints).
- [ ] Create deferred implementation track for Monero provider/circuit integration (blocked by technical constraints).
- [ ] Revisit deferred tracks after constraints are resolved and move them into active milestone execution.

## Review (Latest Increment)
- Added shared cross-request key-cascade metrics registry (scope-based) with per-key success/failure counters:
  - [`lib/libraries/backend-core/providers/api-key-cascade.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/backend-core/providers/api-key-cascade.ts)
- Exported new metrics types/config through provider indexes:
  - [`lib/libraries/backend-core/providers/index.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/backend-core/providers/index.ts)
  - [`lib/providers/api-key-cascade.ts`](/home/teycir/Repos/GhostReceipt/lib/providers/api-key-cascade.ts)
- Wired runtime metrics scopes into providers and exposed static snapshot/reset helpers:
  - [`lib/providers/solana/helius.ts`](/home/teycir/Repos/GhostReceipt/lib/providers/solana/helius.ts)
  - [`lib/providers/ethereum/etherscan.ts`](/home/teycir/Repos/GhostReceipt/lib/providers/ethereum/etherscan.ts)
- Added tests for shared metrics behavior and provider failover metrics:
  - [`tests/unit/providers/api-key-cascade.test.ts`](/home/teycir/Repos/GhostReceipt/tests/unit/providers/api-key-cascade.test.ts)
  - [`tests/unit/providers/helius.test.ts`](/home/teycir/Repos/GhostReceipt/tests/unit/providers/helius.test.ts)
  - [`tests/unit/providers/etherscan.test.ts`](/home/teycir/Repos/GhostReceipt/tests/unit/providers/etherscan.test.ts)
- Verification:
  - `npm run typecheck` passes.
  - `npm run test -- tests/unit/providers/api-key-cascade.test.ts tests/unit/providers/helius.test.ts tests/unit/providers/etherscan.test.ts --runInBand` passes.

# Task Plan: Enhancement Phase 1 (Cryptographic Robustness + Speed)

## Decision Snapshot
- [ ] Use `ENHANCEMENT_ROADMAP.md` as primary execution source for this track.
- [ ] Keep proving flow target as a hard SLO: `p95 < 60s`, `p50 < 25s`.
- [ ] Keep security hardening off the proof hot path unless required for correctness.
- [ ] Keep existing circuit constraints unchanged for this phase to avoid immediate proving slowdown.
- [ ] Assume no VPS/self-hosted infrastructure for current rollout; design around managed/freemium providers only.

## Workstream A: Oracle Attestation v2 (Bound Signature Envelope)
- [x] Define canonical `oracleAuth` schema with `messageHash`, `nonce`, `signedAt`, `expiresAt`, `oraclePubKeyId`, `oracleSignature`.
- [x] Canonicalize and sign the full envelope (not `messageHash` alone).
- [x] Update fetch route signing path to emit the canonical envelope.
- [x] Update verify-signature route to validate canonical envelope signature binding.
- [x] Remove legacy version branching and keep one canonical auth structure.
- [x] Add focused unit tests for envelope tampering cases (field swap, timestamp change, nonce change).

## Workstream B: Replay Protection (Nonce + Time Window)
- [x] Add nonce replay registry abstraction with adapters:
- [x] In-memory adapter for local tests/dev.
- [x] Durable/shared adapter interface for production deployment target.
- [x] Enforce replay window checks (`signedAt` skew + expiry checks).
- [x] Reject nonce reuse for different payloads; allow idempotent re-verification of identical payload.
- [x] Add route-level error codes/messages for replay outcomes.
- [x] Add unit/integration tests for replay allow/deny matrix.

## Workstream C: Nullifier Registry (Anti-Equivocation)
- [x] Define nullifier derivation (`chain + txHash` or commitment-derived variant) and document rationale.
- [x] Add nullifier to share payload metadata.
- [x] Implement server-side nullifier registry with conflict semantics:
- [x] same nullifier + same claim -> allow.
- [x] same nullifier + different claim -> reject.
- [x] Update verifier flow to query/check nullifier status.
- [x] Add tests for collision/conflict behavior and regression coverage.

## Workstream D: Oracle Transparency Log
- [x] Define append-only transparency log JSON schema (`keyId`, `publicKey`, `validFrom`, `validUntil`, `status`, chain hash fields).
- [x] Add repository-hosted log artifact and update policy.
- [x] Add verifier checks that key was valid at `signedAt`.
- [x] Add key rotation runbook updates and CI validation for log consistency.
- [x] Add tests for revoked/expired/unknown key behavior.

## Workstream E: Speed Track (Must Ship Alongside Security)
- [ ] Add first-class performance telemetry around generator steps:
- [ ] `fetch_ms`, `witness_ms`, `prove_ms`, `package_ms`, `total_ms`.
- [ ] Preload/proactively fetch proof artifacts (`wasm`, `zkey`, `vkey`) on generator idle.
- [ ] Move proof generation to Web Worker to prevent main-thread blocking.
- [ ] Add artifact caching strategy (memory + persistent cache) with safe version invalidation.
- [ ] Keep security checks in lightweight API/verifier paths, not in-circuit additions for this phase.
- [ ] Add UX guardrails: show fallback message and next action when prove step crosses threshold.

## Workstream F: Verification And Gates
- [ ] Add a dedicated performance test that tracks proof flow timing budgets on CI-friendly fixtures.
- [ ] Add regression tests for v1/v2 payload compatibility.
- [ ] Run and record validation commands:
- [ ] `npm run typecheck`
- [ ] `npm run test -- tests/unit/api/fetch-tx-route.test.ts tests/unit/api/oracle-verify-signature-route.test.ts --runInBand`
- [ ] `npm run test -- tests/unit/zk/prover.test.ts tests/integration/proof-generation.test.ts --runInBand`
- [ ] `npm run test -- tests/e2e/generator.spec.ts --runInBand`

## Workstream G: Priority Expansion Backlog (Beyond Phase 1 Hardening)
- [ ] P0: Move multi-oracle quorum design up from long-term backlog and produce MVP architecture doc (`2-of-3` signing quorum).
- [ ] P0: Add on-chain Solidity verifier milestone (snarkjs-generated verifier + deployment plan) in near-term roadmap.
- [ ] P0: Keep replay window + transparency log mandatory in same release train as Attestation v2.
- [ ] P1: Add ERC-20 transfer/event-log receipt proofs (USDT + USDC first, then DAI).
- [ ] P1: Add Monero receipt track (dedicated circuit + view-key-based witness model + trust-model docs).
- [ ] P1: Add proof-system decision artifact (`Groth16` stay vs `PLONK/Fflonk` migration rationale).
- [ ] P1: Add batch verification experience (`/verify/batch`) with import + pass/fail table.
- [ ] P2: Add selective disclosure circuit modes (partial reveal controls).
- [ ] P2: Add PDF export for invoice/compliance workflow.
- [ ] P2: Add receipt labels/categories in payload metadata.
- [ ] P2: Add local receipt history (`/history`, IndexedDB, export JSON).
- [ ] P2: Add Solana adapter track with fallback provider strategy.
- [ ] P2: Add webhook/embed API (`POST /api/generate-receipt`) with auth + rate limits.
- [ ] P2: Add proof payload compression/versioning to improve share-link and QR usability.
- [ ] P3: Add range-proof mode for bounded amount disclosure.
- [ ] P3: Add TLS-notary feasibility track and integration design options.

## Workstream H: Feature Design Specs (Write Before Build)
- [ ] Write an RFC for multi-oracle quorum key management, signer selection, and verifier semantics.
- [ ] Write an RFC for nullifier semantics (claim binding policy and verifier conflict outcomes).
- [ ] Write an RFC for ERC-20 event proof format (token metadata, decimals handling, normalization rules).
- [ ] Write an RFC for selective disclosure and range proof public input contracts.
- [ ] Write an RFC for on-chain verifier integration (ABI, contract addresses, gas targets, trust boundaries).
- [ ] Write an RFC for proof compression + backward-compatible share payload parsing.
- [ ] Write an RFC for batch verify UX and report export schema.
- [ ] Write an RFC for webhook/embed API auth model and abuse controls.

## Workstream I: Performance Guardrails For New Features
- [ ] Define per-feature latency budgets before implementation (API, proving, verify, batch verify).
- [ ] Require feature PRs to report `before/after` metrics for `p50/p95` generate and verify flows.
- [ ] For any circuit growth, require proving benchmark evidence that `p95` target remains under `60s`.
- [ ] Keep optional heavy features (batch, PDF, history indexing) off critical initial render path.
- [ ] Add feature flags for high-risk features so performance regressions can be rolled back safely.

## Milestone Plan (Execution Buckets)

### Milestone M1: Trust + Speed Baseline (Immediate)
- [ ] Deliver Attestation v2 (`nonce`, `signedAt`, `expiresAt`, fully bound signature envelope).
- [ ] Deliver replay-window + nonce registry enforcement.
- [ ] Deliver nullifier registry conflict checks.
- [x] Deliver transparency-log key validity checks at verification time.
- [ ] Deliver proof-path speed baseline:
- [ ] artifact preload (`wasm`, `zkey`, `vkey`),
- [ ] worker-based proving,
- [ ] timing telemetry and UX threshold fallbacks.
- [ ] Exit criteria:
- [ ] cryptographic checks active and tested,
- [ ] generator `p95 < 60s`, `p50 < 25s` in benchmark environment.

### Milestone M2: Trustless Integration Starter
- [ ] Generate and test Solidity verifier contract from current circuit.
- [ ] Add contract deployment runbook + verification docs.
- [ ] Add minimal integration example (contract-side verification of receipt proof).
- [ ] Exit criteria:
- [ ] deployed verifier addresses documented,
- [ ] end-to-end contract verification demo passes.

### Milestone M3: Payment Coverage Expansion (EVM + Monero)
- [ ] Add ERC-20 event-log proof support (USDT + USDC first, then DAI and other tokens).
- [ ] Start with explicit stablecoin allowlist and expand only after validation:
- [ ] `USDT` (Tether),
- [ ] `USDC`,
- [ ] `DAI`.
- [ ] Add Monero adapter track with dedicated witness/circuit constraints:
- [ ] tx key + view key input model,
- [ ] Monero-specific proof semantics,
- [ ] explicit trust-model differences in docs.
- [ ] Implement Monero provider cascade as managed APIs only (no self-hosted `monerod` requirement in this milestone).
- [ ] Preserve baseline BTC/ETH UX speed while adding new chains.
- [ ] Exit criteria:
- [ ] stablecoin proof flow works in integration tests,
- [ ] USDT and USDC flows are validated before enabling broader token list,
- [ ] Monero proof flow works on stagenet/testnet fixtures.

### Milestone M4: Verification + Operations UX
- [ ] Add batch verification (`/verify/batch`) with multi-file input and pass/fail table.
- [ ] Add PDF export path with QR + human-readable proof summary.
- [ ] Add labels/categories + local history (`/history`, IndexedDB, JSON export).
- [ ] Exit criteria:
- [ ] accounting/compliance workflow validated by E2E tests.

### Milestone M5: Integrations + Shareability
- [ ] Add webhook/embed API (`POST /api/generate-receipt`) with auth + rate-limit policy.
- [ ] Add proof payload compression/versioning with backward-compatible parsing.
- [ ] Add Solana adapter track with fallback strategy.
- [ ] Exit criteria:
- [ ] integration API docs published,
- [ ] compressed share payloads remain verifiable and scannable by QR.

### Milestone M6: Advanced Trust Minimization
- [ ] Deliver multi-oracle quorum alpha (`2-of-3` signing/verification model).
- [ ] Deliver selective-disclosure and range-proof design + implementation tranche.
- [ ] Publish TLS-notary integration feasibility and phased adoption plan.
- [ ] Exit criteria:
- [ ] single-key compromise no longer a single point of total trust failure.

## Sequence (Execution Order)
- [x] Step 1: Implement Attestation v2 schema + signing + verification compatibility layer.
- [x] Step 2: Implement nonce replay registry + replay window enforcement.
- [x] Step 3: Implement nullifier registry + verifier conflict checks.
- [x] Step 4: Implement transparency log validation on verifier path.
- [ ] Step 5: Implement speed track changes (artifact preload/cache + worker proving + UX thresholds).
- [ ] Step 6: Run gates, document metrics deltas, and finalize rollout notes.
- [ ] Step 7: Deliver on-chain verifier MVP (contract artifact + docs + integration tests).
- [ ] Step 8: Deliver ERC-20 event-log proof support + Monero receipt track MVP.
- [ ] Step 9: Deliver batch verify + PDF export + labels/history product slice.
- [ ] Step 10: Deliver Solana + webhook/embed API integrations + payload compression.
- [ ] Step 11: Deliver multi-oracle quorum alpha and document TLS-notary path.

## Acceptance Criteria
- [ ] Cryptographic robustness:
- [ ] Signature envelope is fully bound and tamper-resistant.
- [ ] Replay attempts are rejected within configured window.
- [ ] Nullifier conflict attacks are rejected.
- [x] Revoked/expired oracle keys fail verification.
- [ ] Speed:
- [ ] Generator flow `p95 < 60s` and `p50 < 25s` on defined benchmark environment.
- [ ] No major UI thread stalls during proof generation.
- [ ] User-facing fallback guidance appears before abandonment thresholds.
- [ ] Product and ecosystem:
- [ ] On-chain verifier contract path available for trustless integrations.
- [ ] ERC-20 transfer proof flow validated for major stablecoins.
- [ ] Batch verify and export workflows available for accounting/compliance users.
- [ ] Multi-oracle quorum plan is implementation-ready with explicit rollout milestones.

# Task Plan: Phase 2 Extraction - Unified Oracle Route Body Envelope

- [x] Extract a reusable oracle route body pipeline that combines rate-limit checks + secure JSON parse + zod validation.
- [x] Rewire `fetch-tx` route to use the unified oracle route body envelope helper.
- [x] Rewire `verify-signature` route to use the unified oracle route body envelope helper.
- [x] Keep route behavior/status/messages stable for existing tests.
- [x] Verify with typecheck.
- [x] Verify with focused oracle route unit tests.

## Review
- Added unified route-body envelope module:
  - [`lib/libraries/backend-core/http/oracle-route-envelope.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/backend-core/http/oracle-route-envelope.ts)
- Extended backend-core HTTP exports:
  - [`lib/libraries/backend-core/http/index.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/backend-core/http/index.ts)
- Refactored routes to consume the unified envelope helper:
  - [`app/api/oracle/fetch-tx/route.ts`](/home/teycir/Repos/GhostReceipt/app/api/oracle/fetch-tx/route.ts)
  - [`app/api/oracle/verify-signature/route.ts`](/home/teycir/Repos/GhostReceipt/app/api/oracle/verify-signature/route.ts)
- Updated extraction docs:
  - [`lib/libraries/README.md`](/home/teycir/Repos/GhostReceipt/lib/libraries/README.md)
- Verification:
  - `npm run typecheck` passes.
  - `npm run test -- tests/unit/api/fetch-tx-route.test.ts tests/unit/api/oracle-verify-signature-route.test.ts --runInBand` passes.

# Task Plan: Phase 2 Extraction - Shared Oracle Rate-Limit Envelope

- [x] Extract reusable route rate-limit helper (global + client checks) into backend-core HTTP module.
- [x] Extract reusable route limiter pair factory/dispose helpers.
- [x] Rewire `fetch-tx` and `verify-signature` routes to use shared rate-limit helpers.
- [x] Preserve existing status/messages and route behavior expected by tests.
- [x] Verify with typecheck.
- [x] Verify with focused oracle route unit tests.

## Review
- Added shared rate-limit module:
  - [`lib/libraries/backend-core/http/rate-limit-envelope.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/backend-core/http/rate-limit-envelope.ts)
- Extended backend-core HTTP exports:
  - [`lib/libraries/backend-core/http/index.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/backend-core/http/index.ts)
- Refactored routes to consume shared rate-limit helpers:
  - [`app/api/oracle/fetch-tx/route.ts`](/home/teycir/Repos/GhostReceipt/app/api/oracle/fetch-tx/route.ts)
  - [`app/api/oracle/verify-signature/route.ts`](/home/teycir/Repos/GhostReceipt/app/api/oracle/verify-signature/route.ts)
- Updated library extraction docs:
  - [`lib/libraries/README.md`](/home/teycir/Repos/GhostReceipt/lib/libraries/README.md)
- Verification:
  - `npm run typecheck` passes.
  - `npm run test -- tests/unit/api/fetch-tx-route.test.ts tests/unit/api/oracle-verify-signature-route.test.ts --runInBand` passes.

# Task Plan: Phase 2 Extraction - Shared Oracle Request Envelope

- [x] Extract secure JSON parse + invalid-body error mapping into backend-core HTTP helper.
- [x] Extract zod body validation + standardized invalid-request error response helper.
- [x] Rewire `fetch-tx` and `verify-signature` routes to use shared request-envelope helpers.
- [x] Preserve route-level behavior/messages expected by existing tests.
- [x] Verify with typecheck.
- [x] Verify with focused oracle route unit tests.

## Review
- Added shared request-envelope module:
  - [`lib/libraries/backend-core/http/request-envelope.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/backend-core/http/request-envelope.ts)
- Extended backend-core HTTP export surface:
  - [`lib/libraries/backend-core/http/index.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/backend-core/http/index.ts)
- Refactored routes to consume shared parse/validation envelope:
  - [`app/api/oracle/fetch-tx/route.ts`](/home/teycir/Repos/GhostReceipt/app/api/oracle/fetch-tx/route.ts)
  - [`app/api/oracle/verify-signature/route.ts`](/home/teycir/Repos/GhostReceipt/app/api/oracle/verify-signature/route.ts)
- Updated library extraction docs:
  - [`lib/libraries/README.md`](/home/teycir/Repos/GhostReceipt/lib/libraries/README.md)
- Verification:
  - `npm run typecheck` passes.
  - `npm run test -- tests/unit/api/fetch-tx-route.test.ts tests/unit/api/oracle-verify-signature-route.test.ts --runInBand` passes.

# Task Plan: Dropdown Contrast + Loader Cleanup + Fetch Session Extraction

- [x] Darken premium dropdown panel/item backgrounds to avoid text overlap with animated page background.
- [x] Remove loader animated text block while preserving the privacy tagline and use-case list flow.
- [x] Extract fetch route replay/idempotency/session-cookie helpers into `backend-core/http`.
- [x] Rewire fetch route to consume extracted session/replay helpers and keep behavior stable.
- [x] Verify with typecheck.
- [x] Verify with focused fetch-route unit tests.

## Review
- Updated dropdown contrast in reusable UI primitive:
  - [`lib/libraries/ui/premium-select.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/ui/premium-select.ts)
- Removed loader animated copy block and unused loader animation class usage:
  - [`components/home-shell.tsx`](/home/teycir/Repos/GhostReceipt/components/home-shell.tsx)
  - [`app/globals.css`](/home/teycir/Repos/GhostReceipt/app/globals.css)
- Added fetch session/idempotency extraction module:
  - [`lib/libraries/backend-core/http/fetch-tx-idempotency.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/backend-core/http/fetch-tx-idempotency.ts)
- Extended backend-core HTTP exports:
  - [`lib/libraries/backend-core/http/index.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/backend-core/http/index.ts)
- Refactored fetch route to consume extracted session/replay helpers:
  - [`app/api/oracle/fetch-tx/route.ts`](/home/teycir/Repos/GhostReceipt/app/api/oracle/fetch-tx/route.ts)
- Updated extraction docs:
  - [`lib/libraries/README.md`](/home/teycir/Repos/GhostReceipt/lib/libraries/README.md)
- Verification:
  - `npm run typecheck` passes.
  - `npm run test -- tests/unit/api/fetch-tx-route.test.ts --runInBand` passes.

# Task Plan: Phase 2 Extraction - Oracle Verify Orchestration to `backend-core/http`

- [x] Extract verify-signature request schema into backend-core HTTP module.
- [x] Extract key-aware signature verification flow into backend-core helper.
- [x] Rewire verify-signature API route to consume extracted backend-core helpers.
- [x] Keep route behavior and test compatibility unchanged.
- [x] Verify with typecheck.
- [x] Verify with focused verify-route unit tests.

## Review
- Added verify extraction module:
  - [`lib/libraries/backend-core/http/verify-signature.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/backend-core/http/verify-signature.ts)
- Extended backend-core HTTP exports in:
  - [`lib/libraries/backend-core/http/index.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/backend-core/http/index.ts)
- Refactored route to use extracted schema + verification helper:
  - [`app/api/oracle/verify-signature/route.ts`](/home/teycir/Repos/GhostReceipt/app/api/oracle/verify-signature/route.ts)
- Updated reusable library docs:
  - [`lib/libraries/README.md`](/home/teycir/Repos/GhostReceipt/lib/libraries/README.md)
- Verification:
  - `npm run typecheck` passes.
  - `npm run test -- tests/unit/api/oracle-verify-signature-route.test.ts --runInBand` passes.

# Task Plan: Phase 2 Extraction - Oracle Fetch Orchestration to `backend-core/http`

- [x] Extract provider factory + Etherscan key loading from fetch route into package-style backend-core module.
- [x] Extract canonical-data signing flow into backend-core reusable function.
- [x] Extract fetch route error mapping into backend-core reusable function and keep route test compatibility.
- [x] Rewire `app/api/oracle/fetch-tx/route.ts` to call extracted backend-core helpers.
- [x] Verify with typecheck.

## Review
- Added backend-core HTTP extraction files:
  - [`lib/libraries/backend-core/http/fetch-tx.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/backend-core/http/fetch-tx.ts)
  - [`lib/libraries/backend-core/http/index.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/backend-core/http/index.ts)
- Exported HTTP helpers from backend-core root via [`lib/libraries/backend-core/index.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/backend-core/index.ts).
- Refactored [`app/api/oracle/fetch-tx/route.ts`](/home/teycir/Repos/GhostReceipt/app/api/oracle/fetch-tx/route.ts) to use:
  - `fetchAndSignOracleTransaction`
  - `mapFetchTxErrorToResponse`
- Preserved test compatibility with:
  - `export const mapErrorToResponse = mapFetchTxErrorToResponse`.
- Verification:
  - `npm run typecheck` passes.
  - `npm run test -- tests/unit/api/fetch-tx-route.test.ts --runInBand` passes.

# Task Plan: Phase 2 Package-Style Core Libraries (`backend-core` + `zk-core`)

- [x] Create package-style module roots for reusable `backend-core` and `zk-core`.
- [x] Move provider cascade + provider contracts into `backend-core` and keep old `lib/providers/*` paths as wrappers.
- [x] Move witness builder/validator into `zk-core` and keep old `lib/zk/witness.ts` as wrapper.
- [x] Add import aliases (`@ghostreceipt/backend-core`, `@ghostreceipt/zk-core`) in tsconfig.
- [x] Switch key runtime imports to new aliases to validate the package-style surface.
- [x] Verify with typecheck.

## Review
- Added package-style backend core modules:
  - [`lib/libraries/backend-core/providers/types.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/backend-core/providers/types.ts)
  - [`lib/libraries/backend-core/providers/cascade.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/backend-core/providers/cascade.ts)
  - [`lib/libraries/backend-core/providers/index.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/backend-core/providers/index.ts)
  - [`lib/libraries/backend-core/index.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/backend-core/index.ts)
- Added package-style zk core modules:
  - [`lib/libraries/zk-core/witness.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/zk-core/witness.ts)
  - [`lib/libraries/zk-core/index.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/zk-core/index.ts)
- Preserved backward compatibility via wrappers:
  - [`lib/providers/types.ts`](/home/teycir/Repos/GhostReceipt/lib/providers/types.ts)
  - [`lib/providers/cascade.ts`](/home/teycir/Repos/GhostReceipt/lib/providers/cascade.ts)
  - [`lib/zk/witness.ts`](/home/teycir/Repos/GhostReceipt/lib/zk/witness.ts)
- Added package-style alias paths in [`tsconfig.json`](/home/teycir/Repos/GhostReceipt/tsconfig.json):
  - `@ghostreceipt/backend-core`
  - `@ghostreceipt/backend-core/*`
  - `@ghostreceipt/zk-core`
  - `@ghostreceipt/zk-core/*`
- Switched key runtime imports to alias surfaces:
  - [`app/api/oracle/fetch-tx/route.ts`](/home/teycir/Repos/GhostReceipt/app/api/oracle/fetch-tx/route.ts) now imports provider contracts/cascade from `@ghostreceipt/backend-core/*`.
  - [`lib/zk/prover.ts`](/home/teycir/Repos/GhostReceipt/lib/zk/prover.ts) now imports `ReceiptWitness` type from `@ghostreceipt/zk-core`.
- Expanded library docs in [`lib/libraries/README.md`](/home/teycir/Repos/GhostReceipt/lib/libraries/README.md) with `backend-core` and `zk-core` packaging guidance.
- Verification:
  - `npm run typecheck` passes.

# Task Plan: Reusable Libraries Split (UI + Backend + ZK)

- [x] Create reusable library namespaces under `lib/libraries/` for `ui`, `backend`, and `zk`.
- [x] Encapsulate premium-select UI logic/styles into reusable UI library primitives.
- [x] Extract easy backend reusable primitives (oracle signer cache + API error helpers) into backend library and adopt in routes.
- [x] Extract reusable ZK payload helpers (encode/decode + malicious-structure guard) into zk library and adopt in prover.
- [x] Add reusable library entry points and short usage documentation for future zk apps.
- [x] Verify with typecheck.

## Review
- Added reusable library namespaces and entry points:
  - [`lib/libraries/index.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/index.ts)
  - [`lib/libraries/ui/index.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/ui/index.ts)
  - [`lib/libraries/backend/index.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/backend/index.ts)
  - [`lib/libraries/zk/index.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/zk/index.ts)
- UI encapsulation:
  - moved premium select component into reusable UI library [`lib/libraries/ui/components/premium-select.tsx`](/home/teycir/Repos/GhostReceipt/lib/libraries/ui/components/premium-select.tsx),
  - extracted premium select classes/helpers into [`lib/libraries/ui/premium-select.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/ui/premium-select.ts),
  - preserved compatibility by re-exporting as app `Select` in [`components/ui/select.tsx`](/home/teycir/Repos/GhostReceipt/components/ui/select.tsx).
- Backend reuse extraction:
  - added reusable API error/rate-limit response helpers in [`lib/libraries/backend/http-errors.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/backend/http-errors.ts),
  - added shared oracle-signer env cache in [`lib/libraries/backend/oracle-signer-cache.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/backend/oracle-signer-cache.ts),
  - adopted helpers in routes:
    - [`app/api/oracle/fetch-tx/route.ts`](/home/teycir/Repos/GhostReceipt/app/api/oracle/fetch-tx/route.ts)
    - [`app/api/oracle/verify-signature/route.ts`](/home/teycir/Repos/GhostReceipt/app/api/oracle/verify-signature/route.ts)
- ZK reuse extraction:
  - moved share payload encode/decode + dangerous-key scan into [`lib/libraries/zk/share-payload.ts`](/home/teycir/Repos/GhostReceipt/lib/libraries/zk/share-payload.ts),
  - updated [`lib/zk/prover.ts`](/home/teycir/Repos/GhostReceipt/lib/zk/prover.ts) to consume these library primitives.
- Added reuse documentation + low-effort backend/zk extraction candidates for future apps in [`lib/libraries/README.md`](/home/teycir/Repos/GhostReceipt/lib/libraries/README.md).
- Verification:
  - `npm run typecheck` passes.

# Task Plan: Premium Dropdown Items (CodePen-Inspired Option 1)

- [x] Port a premium glassmorphism dropdown style inspired by the selected CodePen direction.
- [x] Make dropdown item backgrounds fully stylable (custom listbox, not native browser option menu).
- [x] Keep current `Select` usage compatible with generator form state handling.
- [x] Verify with typecheck.

## Review
- Reworked [`components/ui/select.tsx`](/home/teycir/Repos/GhostReceipt/components/ui/select.tsx) from a native `<select>` to a custom accessible dropdown (`button` + `listbox`) so item backgrounds can be styled to a premium glass finish.
- Added:
  - glass gradient trigger surface,
  - premium dropdown panel background/shadow,
  - highlighted and selected item treatments,
  - keyboard navigation (`ArrowUp/ArrowDown`, `Enter/Space`, `Escape`),
  - outside-click close behavior.
- Preserved generator compatibility by dispatching a select-like `onChange` payload (`event.target.value`) on item selection.
- Verification:
  - `npm run typecheck` passes.

# Task Plan: Footer Share Label Removal + Mobile Responsiveness

- [x] Remove the `Share:` label from footer social icons.
- [x] Improve footer layout behavior on small screens (clean wrapping and spacing).
- [x] Verify with typecheck.

## Review
- Updated [`components/footer.tsx`](/home/teycir/Repos/GhostReceipt/components/footer.tsx):
  - removed `Share:` label next to social icons,
  - switched to responsive Tailwind layout classes for better mobile wrapping,
  - improved spacing/tap-target sizing for social icons on small screens.
- Verification:
  - `npm run typecheck` passes.

# Task Plan: Loader Copy Placement Simplification

- [x] Remove `Use Cases + Benefits` header from loader card.
- [x] Remove animated text block from inside loader use-case card.
- [x] Place rotating animated text directly below `Prove the payment. Keep the privacy.` line.
- [x] Verify with typecheck.

## Review
- Updated [`components/home-shell.tsx`](/home/teycir/Repos/GhostReceipt/components/home-shell.tsx) to move the rotating animated use-case text under the loader tagline and keep the use-case card as list-only content.
- Updated [`app/globals.css`](/home/teycir/Repos/GhostReceipt/app/globals.css) to add `startup-overlay__tag-animated` styling and remove now-unused in-card animated text/header styles.
- Verification:
  - `npm run typecheck` passes.

# Task Plan: Match HTML Docs Design + Add Source Code Footer Link

- [x] Make `public/docs/how-to-use.html` use the same design language as the existing docs pages.
- [x] Add `Source Code` link to the main app footer.
- [x] Add `Source Code` link in static docs footers for consistency.
- [x] Verify with link checks and typecheck.

## Review
- Updated [`public/docs/how-to-use.html`](/home/teycir/Repos/GhostReceipt/public/docs/how-to-use.html) to match the visual system used in other static docs pages:
  - same layout width/padding,
  - same background/ambient gradients,
  - same typography/link/code styles,
  - same footer structure.
- Added `Source Code` link (`https://github.com/Teycir/Ghostreceipt#readme`) to:
  - main app footer in [`components/footer.tsx`](/home/teycir/Repos/GhostReceipt/components/footer.tsx),
  - static docs footers in [`public/docs/how-to-use.html`](/home/teycir/Repos/GhostReceipt/public/docs/how-to-use.html), [`public/docs/faq.html`](/home/teycir/Repos/GhostReceipt/public/docs/faq.html), [`public/docs/security.html`](/home/teycir/Repos/GhostReceipt/public/docs/security.html), and [`public/docs/license.html`](/home/teycir/Repos/GhostReceipt/public/docs/license.html).
- Verification:
  - footer/source link presence verified with `rg`,
  - `npm run typecheck` passes.

# Task Plan: Add/Refresh How-To-Use HTML Page

- [x] Create or refresh a complete `How to Use` static HTML page for GhostReceipt docs.
- [x] Ensure the page is reachable via docs path and direct HTML alias.
- [x] Keep styling and navigation consistent with existing docs pages.
- [x] Verify links and run typecheck.

## Review
- Replaced [`public/docs/how-to-use.html`](/home/teycir/Repos/GhostReceipt/public/docs/how-to-use.html) with a fuller step-by-step guide:
  - quick start,
  - structured input explanations,
  - proof generation + sharing flow,
  - verifier/privacy expectations,
  - troubleshooting section.
- Added direct alias [`public/how-to-use.html`](/home/teycir/Repos/GhostReceipt/public/how-to-use.html) that redirects to `/docs/how-to-use.html`.
- Kept docs navigation consistent with existing static pages (`FAQ`, `Security`, `License`, `Home`).
- Verification:
  - link/path checks pass via `rg` scan,
  - `npm run typecheck` passes.

# Task Plan: Timeseal Footer Social Share Ports (X/Reddit/LinkedIn)

- [x] Copy Timeseal-style footer social share actions (X, Reddit, LinkedIn) into GhostReceipt footer.
- [x] Point social share links to GhostReceipt website messaging (not Timeseal URLs).
- [x] Keep existing docs/footer links intact and responsive.
- [x] Verify with typecheck and record outcomes.

## Review
- Updated [`components/footer.tsx`](/home/teycir/Repos/GhostReceipt/components/footer.tsx) to include Timeseal-style social share icons and links for:
  - X/Twitter,
  - Reddit,
  - LinkedIn.
- Kept the existing docs/creator footer links intact, and added a dedicated `Share:` group beside them.
- Share URLs now target GhostReceipt messaging + GhostReceipt site URL (`https://ghostreceipt.pages.dev`) instead of Timeseal endpoints.
- Verification:
  - `npm run typecheck` passes.

# Task Plan: Timeseal-Style Loader Text List (Use Cases + Benefits)

- [x] Inspect `Timeseal` loader-adjacent text animation pattern and map it to GhostReceipt.
- [x] Add animated rotating use-case/benefit text directly under loader title/tagline.
- [x] Render a visible text list of use cases and benefits with active highlighting.
- [x] Ensure startup loader remains long enough to show every list entry at least once.
- [x] Verify with typecheck and record outcomes.

## Review
- Updated [`components/home-shell.tsx`](/home/teycir/Repos/GhostReceipt/components/home-shell.tsx) to:
  - mirror Timeseal-like character-by-character rotating copy below the loader title,
  - show a persistent use-case/benefit text list with active item emphasis,
  - gate loader completion on `backgroundReady + minimumElapsed + all use-cases shown`.
- Updated [`app/globals.css`](/home/teycir/Repos/GhostReceipt/app/globals.css) with styles for:
  - animated loader text line,
  - list layout and active-state treatment,
  - improved readability for multi-line use-case/benefit messaging.
- Verification:
  - `npm run typecheck` passes.

# Task Plan: Sanctum-Style Share Actions In Receipt Success

- [x] Review Sanctum result/share UX pattern and extract applicable behavior.
- [x] Add a clearly visible share block in GhostReceipt success state (URL preview + copy + quick actions).
- [x] Keep social network actions available from the same visible share block.
- [x] Add Sanctum-inspired secure clipboard copy behavior.
- [x] Verify with typecheck and build.

## Review
- Implemented Sanctum-style share UX prominence in [`components/generator/receipt-success.tsx`](/home/teycir/Repos/GhostReceipt/components/generator/receipt-success.tsx):
  - visible `Verification URL` block,
  - primary `Copy URL` CTA with explicit copied-state messaging,
  - quick action row (`Open Receipt`, `Share`, `X`, `Telegram`, `LinkedIn`, `Reddit`).
- Added secure clipboard helper inspired by Sanctum in [`lib/shared/use-secure-clipboard.ts`](/home/teycir/Repos/GhostReceipt/lib/shared/use-secure-clipboard.ts):
  - copied-state feedback,
  - clipboard auto-clear timer behavior.
- Verification:
  - `npm run typecheck` passes.
  - `npm run build` passes (existing export/middleware/viewport warnings unchanged).

# Task Plan: Informational Loader (xmrproof-Inspired Use Cases)

- [x] Add informational use-case messaging to startup loader.
- [x] Rotate multiple practical GhostReceipt use cases during load.
- [x] Keep transition from loader to main UI as a smooth fade.
- [x] Run typecheck/build and record outcomes.

## Review
- Updated [`components/home-shell.tsx`](/home/teycir/Repos/GhostReceipt/components/home-shell.tsx) to include:
  - rotating loader use-case cards,
  - explanatory startup status copy,
  - smoother cross-fade timing into the main UI.
- Updated [`app/globals.css`](/home/teycir/Repos/GhostReceipt/app/globals.css) with:
  - use-case card styles,
  - entry animation for rotating informational content,
  - active indicator dots for use-case progression.
- Verification:
  - `npm run typecheck` passes.
  - `npm run build` passes (existing export/middleware/viewport warnings unchanged).

# Task Plan: Premium Form Polish + Social Share Actions

- [x] Upgrade dropdown/select visuals to a premium glass+gradient style.
- [x] Upgrade primary CTA button styling to a premium gradient treatment.
- [x] Add social sharing actions to receipt success flow (native share + platform links).
- [x] Verify with typecheck and production build.

## Review
- Upgraded shared select styling in [`components/ui/select.tsx`](/home/teycir/Repos/GhostReceipt/components/ui/select.tsx) with:
  - richer glass gradient surface,
  - custom chevron icon,
  - stronger premium border/focus states.
- Upgraded shared button styling in [`components/ui/button.tsx`](/home/teycir/Repos/GhostReceipt/components/ui/button.tsx) with:
  - premium blue gradient primary CTA,
  - deeper depth/shadow treatment,
  - improved focus ring and typography feel.
- Added social sharing actions in [`components/generator/receipt-success.tsx`](/home/teycir/Repos/GhostReceipt/components/generator/receipt-success.tsx):
  - native share button (`navigator.share` fallback to copy),
  - quick-share buttons for X, Telegram, LinkedIn, Reddit,
  - lightweight status feedback.
- Hardened success-panel action buttons with explicit `type="button"` to avoid accidental form submits.
- Reference alignment:
  - Sanctum repo does not expose a dedicated social-share component in the expected path, so the implementation follows Sanctum’s practical share/copy action pattern and adapts it to GhostReceipt’s receipt flow.
- Verification:
  - `npm run typecheck` passes.
  - `npm run build` passes.

# Task Plan: Add Branded Startup Loading Animation

- [x] Introduce a home startup overlay with motion matching the liquid blue shader visual language.
- [x] Keep startup visible until background shader reports readiness with a minimum display duration.
- [x] Fade from startup overlay into the main home UI without layout jump/flicker.
- [x] Verify TypeScript/build success after integration.

## Review
- Added [`components/home-shell.tsx`](/home/teycir/Repos/GhostReceipt/components/home-shell.tsx) as a client shell that coordinates:
  - startup overlay timing,
  - shader readiness signal,
  - smooth transition to the main UI.
- Updated [`components/eye-candy.tsx`](/home/teycir/Repos/GhostReceipt/components/eye-candy.tsx) to expose optional `onReady` callback fired on first render (or fallback paths).
- Updated [`app/page.tsx`](/home/teycir/Repos/GhostReceipt/app/page.tsx) to render `HomeShell`.
- Added loader animation styles to [`app/globals.css`](/home/teycir/Repos/GhostReceipt/app/globals.css) with blue liquid blobs + shimmer bar for a CodePen-like first impression.
- Verification:
  - `npm run typecheck` passes.
  - `npm run build` passes.

# Task Plan: Fix Oracle Fetch-Tx Unit Timeout + Jest Teardown Leak

- [x] Make `tests/unit/api/oracle-fetch-tx.test.ts` deterministic by mocking provider network calls in "valid request" cases.
- [x] Add explicit route-level dispose teardown in unit tests that import oracle route modules.
- [x] Run targeted unit test commands to verify timeout and open-handle issues are resolved.
- [x] Document verification outcomes.

## Review
- Updated [`tests/unit/api/oracle-fetch-tx.test.ts`](/home/teycir/Repos/GhostReceipt/tests/unit/api/oracle-fetch-tx.test.ts) to mock provider fetches for valid BTC/ETH requests, removing slow/flaky live network dependency from this unit suite.
- Added explicit route cleanup in unit suites:
  - [`tests/unit/api/oracle-fetch-tx.test.ts`](/home/teycir/Repos/GhostReceipt/tests/unit/api/oracle-fetch-tx.test.ts)
  - [`tests/unit/api/fetch-tx-route.test.ts`](/home/teycir/Repos/GhostReceipt/tests/unit/api/fetch-tx-route.test.ts)
  - [`tests/unit/api/oracle-verify-signature-route.test.ts`](/home/teycir/Repos/GhostReceipt/tests/unit/api/oracle-verify-signature-route.test.ts)
  by calling `__disposeOracleFetchRouteForTests()` / `__disposeOracleVerifyRouteForTests()` in `afterAll`.
- Verification:
  - `npm test -- tests/unit/api/oracle-fetch-tx.test.ts tests/unit/api/fetch-tx-route.test.ts tests/unit/api/oracle-verify-signature-route.test.ts --runInBand --detectOpenHandles` passes.
  - `npm test -- tests/unit/api/oracle-fetch-tx.test.ts` passes with `should accept valid Ethereum request` completing quickly.

# Task Plan: Integrate Liquid Silk Background

- [x] Add Three.js runtime dependency for shader-based background rendering.
- [x] Replace legacy particle eye-candy with the provided liquid-silk shader background.
- [x] Keep integration client-safe with cleanup and mobile/performance defaults.
- [x] Verify with TypeScript check.

## Review
- Added `three@0.160.0` dependency.
- Replaced [`components/eye-candy.tsx`](/home/teycir/Repos/GhostReceipt/components/eye-candy.tsx) with a Three.js shader background implementation based on the provided code.
- Removed debug GUI dependency for production cleanliness; kept the visual engine/shader behavior.
- Added robust lifecycle cleanup (RAF cancel, resize listener removal, GPU resource disposal).
- Applied mobile-friendly defaults (`resolution` and `octaves`) to avoid frame drops on smaller devices.

# Task Plan: Fully Automated Cloudflare Deploy (No PR Secret Traps)

- [x] Remove deploy workflow PR trigger that cannot reliably access repository secrets.
- [x] Keep deployment automatic on `push` to `main` and support manual `workflow_dispatch`.
- [x] Add explicit secret validation before running Cloudflare Pages action.
- [x] Update deployment checklist to reflect automated trigger behavior.

## Review
- Deployment workflow now runs automatically on `main` pushes (and manual dispatch), not on PR events.
- Added a dedicated validation step that fails early with a clear error if required Cloudflare secrets are missing.
- Deployment checklist now documents that PRs are CI-only and deploy is push-to-main driven.

# Task Plan: Add CI/CD Recovery Steps to Deployment Checklist

- [x] Add explicit checklist step to configure required Cloudflare GitHub secrets.
- [x] Add explicit checklist step to re-run failed deployment workflow after secrets are set.
- [x] Verify the new section is present in `docs/DEPLOYMENT_CHECKLIST.md`.

## Review
- Added a dedicated "Fix CI/CD Break (Missing apiToken)" subsection in the deployment checklist with two actionable steps:
  1. Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in GitHub Actions secrets.
  2. Re-run the failed workflow from the Actions tab.

# Task Plan: CI/CD Deploy Secret Guard (Cloudflare Pages)

- [x] Confirm deployment workflow failure source for missing Cloudflare token input.
- [x] Guard Cloudflare deploy step against missing `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`.
- [x] Add explicit workflow warning when deployment is skipped due to missing secrets.
- [x] Verify workflow file no longer calls Pages action without secret checks.

## Review
- Root cause confirmed in `.github/workflows/deploy.yml`: unguarded `cloudflare/pages-action@v1` invocation on PR/push paths.
- Added secret-presence guard on deploy step and a clear skip warning step when secrets are missing.
- Verification:
  - Workflow now references `cloudflare/pages-action@v1` only behind an `if` condition requiring non-empty Cloudflare secrets.

# Task Plan: Purge Legacy Platform References From Repo

- [x] Identify all case-insensitive legacy platform mentions across tracked files.
- [x] Remove or replace all legacy platform mentions with Cloudflare/generic alternatives.
- [x] Run repo-wide verification to confirm zero matches remain.
- [x] Record implementation + verification evidence.

## Review
- Updated [docs/runbooks/SECURITY.md](/home/teycir/Repos/GhostReceipt/docs/runbooks/SECURITY.md) to remove provider-mixing language and keep runtime storage guidance generic/Cloudflare-oriented.
- Updated [docs/project/PLAN.md](/home/teycir/Repos/GhostReceipt/docs/project/PLAN.md) source signals to replace the legacy GitHub release URL with a Next.js blog archive link.
- Verification:
  - Case-insensitive repository sweep for the legacy keyword now returns no matches.

# Task Plan: Oracle Volume Stress Test (100 Users/Hour + Concurrency)

- [x] Add a dedicated stress integration test for `/api/oracle/fetch-tx` + `/api/oracle/verify-signature`.
- [x] Simulate 100-user/hour equivalent traffic with configurable concurrency and mixed BTC/ETH load.
- [x] Capture latency and success-rate metrics with explicit assertions.
- [x] Add a dedicated npm script for running stress tests on demand.
- [x] Run typecheck and stress test command; record outcomes.

## Review
- Added new stress suite: `tests/integration/stress-oracle-volume.test.ts`
  - env-gated (`STRESS_TEST=1`) so it runs only when explicitly requested,
  - simulates 100 users with concurrency 10 by default (`STRESS_USERS`, `STRESS_CONCURRENCY` override support),
  - mixed BTC/ETH traffic split (`STRESS_BTC_RATIO`, default `0.5`),
  - runs full route path per simulated user:
    - `POST /api/oracle/fetch-tx`,
    - `POST /api/oracle/verify-signature`,
  - collects and logs metrics (`successRate`, `fetchP95`, `verifyP95`, total duration),
  - asserts non-regression thresholds:
    - success rate `>= 99%`,
    - fetch p95 `< 2000ms`,
    - verify p95 `< 1000ms`.
- Stress suite is deterministic/stable in CI:
  - mocks provider network calls (`MempoolSpaceProvider`, `EthereumPublicRpcProvider`) while preserving full oracle route logic,
  - uses unique per-user trusted proxy IPs to model concurrency without hitting per-client throttling,
  - includes route-level disposer hooks to clean timers/limiters.
- CI/CD wiring:
  - `package.json`: added `test:stress:oracle`,
  - `.github/workflows/ci.yml`: added stress integration step in Quality Gate,
  - `.github/workflows/deploy.yml`: added stress integration step before deploy,
  - `scripts/deploy-check.sh`: added stress integration check.
- Verification:
  - `npm run typecheck` passes.
  - `npm run test:stress:oracle` passes with summary metrics.

# Task Plan: CI/CD Reliability Hardening (Live Integration)

- [x] Eliminate open-handle warnings from live integration tests via explicit route-level timer teardown.
- [x] Make live oracle test command CI-safe (`--ci` + bounded retries).
- [x] Add a dedicated GitHub Actions workflow for live BTC/ETH integration checks (scheduled + manual).
- [x] Keep main CI deterministic by avoiding mandatory external-network live tests on PR quality gates.
- [x] Run typecheck and live command to verify stability.

## Review
- Added route-level teardown hooks for tests:
  - `app/api/oracle/fetch-tx/route.ts` -> `__disposeOracleFetchRouteForTests()`
  - `app/api/oracle/verify-signature/route.ts` -> `__disposeOracleVerifyRouteForTests()`
- Wired teardown hooks into live suite `afterAll` in `tests/integration/live-oracle-flows.test.ts`.
- Added resilient live test runner script: `scripts/run-live-oracle-tests.sh`
  - bounded retry (`MAX_ATTEMPTS=2`),
  - CI mode (`--ci`),
  - long timeout for proof generation (`--testTimeout=180000`),
  - forced process exit (`--forceExit`) to prevent CI hangs.
- Updated `package.json`:
  - `test:live:oracle` now calls `bash scripts/run-live-oracle-tests.sh`.
- Added dedicated workflow:
  - `.github/workflows/live-integration.yml`
  - runs on `workflow_dispatch` and nightly `schedule`,
  - does not alter existing PR/push quality gates (`ci.yml`) to keep deterministic CI.
- Verification:
  - `npm run typecheck` passes.
  - `npm run test:live:oracle` passes (BTC + ETH live flows) and exits cleanly.

# Task Plan: Live E2E Oracle Integration (BTC + ETH)

- [x] Add a live integration test suite that fetches real BTC and ETH transaction hashes at runtime.
- [x] Cover full oracle flow per chain: `/api/oracle/fetch-tx` success + `/api/oracle/verify-signature` validation.
- [x] Validate oracle commitment integrity against canonical payload in the live suite.
- [x] Add a dedicated test script for running live integration tests explicitly.
- [x] Run typecheck + live test command and record outcomes.

## Review
- Added new live integration suite: `tests/integration/live-oracle-flows.test.ts`
  - dynamically discovers BTC tx hash from mempool tip block (`mempool.space`),
  - dynamically discovers successful ETH tx hash from public RPCs (`eth.llamarpc.com`, `ethereum.publicnode.com`),
  - executes end-to-end oracle flow per chain:
    - `POST /api/oracle/fetch-tx` with live tx hash,
    - schema + canonical payload assertions,
    - commitment recomputation parity check (`computeOracleCommitment`),
    - witness build/validate check with payload-derived claim bounds,
    - Groth16 live proof generation (`groth16.fullProve`) using `public/zk/receipt_js/receipt.wasm` + `public/zk/receipt_final.zkey`,
    - Groth16 live proof verification (`groth16.verify`) using `public/zk/verification_key.json`,
    - `POST /api/oracle/verify-signature` and `valid === true`.
- Added explicit command in `package.json`:
  - `test:live:oracle` => `LIVE_INTEGRATION=1 jest tests/integration/live-oracle-flows.test.ts --runInBand`
- Verification:
  - `npm run typecheck` passes.
  - `npm run test:live:oracle` passes (BTC and ETH live flows including live prove/verify).

# Task Plan: Review-Driven Trust Clarity + Public Docs Hygiene

- [x] Add a prominent trust-assumptions warning and CI status badge to `README.md`.
- [x] Clarify centralized oracle guarantees/limits and BTC `valueAtomic` semantics in user-facing docs.
- [x] Remove local workstation filesystem-path references from public-facing reference sections.
- [x] Add roadmap/threat-model artifacts for oracle compromise handling and decentralization direction.
- [x] Run verification checks and record outcomes.

## Review
- Updated `README.md` to include:
  - a visible CI badge for `.github/workflows/ci.yml`,
  - a top-level trust-assumptions warning block,
  - explicit "what verified receipts prove vs do not prove" language,
  - stronger BTC `valueAtomic` semantics disclosure,
  - sanitized references (GitHub links instead of local absolute filesystem paths).
- Updated static user docs:
  - `public/docs/security.html` now references Ed25519 signatures (not HMAC), clarifies centralized oracle assumptions, and states trust boundaries more explicitly.
  - `public/docs/faq.html` now includes dedicated answers for current trust assumptions and BTC tx-level value semantics.
- Added threat-model documentation:
  - New file `docs/runbooks/THREAT_MODEL.md` covering scope, trust boundaries, key threats, compromise expectations, and trust-minimization roadmap direction.
  - Linked from both `README.md` and `docs/README.md`.
- Added roadmap tracking for trust hardening in `docs/project/ROADMAP.md`:
  - consumer-facing trust assumptions + compromise response item,
  - multi-oracle and TLS-notary/light-client exploration items.
- Removed local workstation path exposure from planning/provenance docs:
  - `docs/project/PLAN.md`,
  - `agents.md`,
  - `docs/runbooks/TRUSTED_SETUP_PROVENANCE_2026-03-22.md`.
- Verification:
  - `npm run typecheck` passes.
  - `rg -n "HMAC|HMAC-SHA256" README.md public/docs/security.html public/docs/faq.html docs/runbooks/THREAT_MODEL.md docs/README.md` returns no matches.
  - `rg -n "/home/teycir/Repos" README.md docs/project/PLAN.md agents.md docs/runbooks/TRUSTED_SETUP_PROVENANCE_2026-03-22.md` returns no matches.

# Task Plan: Etherscan V2 Robustness + Live Validation

- [x] Confirm live Etherscan API behavior via Exa/Fetch docs + direct network calls.
- [x] Replace deprecated Etherscan v1 provider flow with v2 proxy flow and strict hex parsing.
- [x] Add regression tests for v2 URL usage, response normalization, and reverted tx handling.
- [x] Validate end-to-end route behavior with real chain data (no mocked validation path).

## Review
- Updated [`lib/providers/ethereum/etherscan.ts`](/home/teycir/Repos/GhostReceipt/lib/providers/ethereum/etherscan.ts) to:
  - use `https://api.etherscan.io/v2/api` with `chainid=1`,
  - fetch tx + receipt + tip block + block timestamp via proxy actions,
  - parse/normalize hex quantities safely before producing canonical data.
- Added regression coverage in [`tests/unit/providers/etherscan.test.ts`](/home/teycir/Repos/GhostReceipt/tests/unit/providers/etherscan.test.ts) for v2 URL semantics, normalization, and reverted receipt status.
- Verification:
  - `npm run typecheck` passes.
  - `npm test -- tests/unit/providers/etherscan.test.ts tests/unit/providers/ssrf-enforcement.test.ts tests/unit/security/secure-json.test.ts tests/unit/security/safe-compare.test.ts tests/unit/security/ssrf.test.ts tests/unit/security/replay.test.ts tests/unit/api/fetch-tx-route.test.ts tests/unit/api/oracle-verify-signature-route.test.ts` passes (56 tests).
  - Live network validation:
    - `curl https://api.etherscan.io/v2/api?...` returns real `{"status":"0","message":"NOTOK","result":"Missing/Invalid API Key"}` on invalid key and is now handled cleanly.
    - Real `POST /api/oracle/fetch-tx` (ethereum tx) succeeded and server logs show Etherscan attempted/fell back safely to `ethereum-public-rpc`.
    - Real `POST /api/oracle/verify-signature` with returned payload verifies `{"valid":true}`.

# Task Plan: DDEP Robustness Re-Review (Real-Data Validation)

- [x] Harden request deserialization against nested prototype-pollution payloads and byte-size ambiguity.
- [x] Harden SSRF hostname checks against obfuscated numeric/IPv6-mapped forms.
- [x] Harden signature key-id comparison with timing-safe equality.
- [x] Add bounded replay-store growth protections.
- [x] Validate with real external data and live endpoint calls (no mocked provider responses).

# Task Plan: Re-Review Sync (Open-Issue Verification)

- [x] Verify re-review "still open" claims directly in current code.
- [x] Patch any genuinely missing hardening/documentation item.
- [x] Record final status with file-level evidence.

## Review
- Verified both signer-instantiation concerns are already fixed with route-level signer caches:
  - [`app/api/oracle/fetch-tx/route.ts`](/home/teycir/Repos/GhostReceipt/app/api/oracle/fetch-tx/route.ts)
  - [`app/api/oracle/verify-signature/route.ts`](/home/teycir/Repos/GhostReceipt/app/api/oracle/verify-signature/route.ts)
- Verified serverless in-memory limits were already documented in [`docs/runbooks/SECURITY.md`](/home/teycir/Repos/GhostReceipt/docs/runbooks/SECURITY.md) under "Runtime Storage Limits".
- Added the same operational warning to [`.env.example`](/home/teycir/Repos/GhostReceipt/.env.example) near `TRUST_PROXY_HEADERS` for setup-time visibility.
- No runtime code changes required in this pass; tests were not re-run because this change is documentation-only.

# Task Plan: Sensitive Hardening Sweep (Defense In Depth)

- [x] Tighten validation for oracle commitment and idempotency key inputs.
- [x] Remove raw private key duplication in route-level signer caches (use fingerprint comparison).
- [x] Add regression tests for tightened input validation and key-rotation-safe caches.
- [x] Run typecheck + targeted tests and capture verification evidence.

## Review
- Tightened input validation:
  - `OracleCommitmentSchema` now enforces numeric field-element format (`1..78` decimal digits).
  - `idempotencyKey` now enforces `8..128` chars and safe token charset (`[A-Za-z0-9._:-]`).
- Hardened key handling:
  - Route-level signer caches now compare/store only SHA-256 private-key fingerprints instead of duplicating raw key strings.
  - Applied consistently in both oracle routes: fetch and verify.
- Added regression tests:
  - invalid idempotency key format rejected in fetch route tests,
  - cached signer refresh on key change in fetch route tests,
  - non-numeric commitment rejected in verify route tests.
- Verification:
  - `npm run typecheck` passes.
  - `npm test -- tests/unit/api/fetch-tx-route.test.ts tests/unit/api/oracle-verify-signature-route.test.ts tests/unit/security/rate-limit.test.ts tests/unit/security/ssrf.test.ts tests/unit/providers/mempool.test.ts tests/unit/oracle-signer.test.ts` passes (62 tests).
  - `npm test -- tests/unit/zk/witness.test.ts tests/unit/generator/witness-integration.test.ts tests/integration/proof-generation.test.ts` passes (22 tests).

# Task Plan: Re-Review Closure (Verify Route Signer Caching)

- [x] Confirm any still-open bug deltas after prior remediation pass.
- [x] Remove per-request signer instantiation in `/api/oracle/verify-signature` private-key path.
- [x] Add regression test proving cache refresh when `ORACLE_PRIVATE_KEY` changes.
- [x] Update `tasks/lessons.md` with closure-validation pattern.
- [x] Run typecheck + targeted tests and document verification.

## Review
- Verified all previously reported critical/significant issues are now covered in current codebase; remaining actionable delta was signer instantiation symmetry between oracle routes.
- Added key-aware signer cache to [`app/api/oracle/verify-signature/route.ts`](/home/teycir/Repos/GhostReceipt/app/api/oracle/verify-signature/route.ts), matching `/api/oracle/fetch-tx` behavior.
- Added regression test in [`tests/unit/api/oracle-verify-signature-route.test.ts`](/home/teycir/Repos/GhostReceipt/tests/unit/api/oracle-verify-signature-route.test.ts) to ensure cached signer refreshes correctly when `ORACLE_PRIVATE_KEY` changes.
- Verification:
  - `npm run typecheck` passes.
  - `npm test -- tests/unit/api/oracle-verify-signature-route.test.ts tests/unit/api/fetch-tx-route.test.ts tests/unit/providers/mempool.test.ts tests/unit/security/ssrf.test.ts` passes (31 tests).

# Task Plan: Re-Review Delta Hardening (Signer Instantiation + Verification)

- [x] Verify current branch status against re-review claims and isolate true remaining work.
- [x] Add key-aware module-level `OracleSigner` singleton for `/api/oracle/fetch-tx`.
- [x] Update `tasks/lessons.md` with stale-review validation pattern.
- [x] Run `npm run typecheck` and targeted route/security tests; capture outcomes.

## Review
- Re-validated the re-review findings against current branch state:
  - Already resolved in codebase: Ed25519 signing, BTC confirmation depth computation, verify-signature rate limiting, SSRF range hardening, and in-memory limits documentation.
  - Remaining practical improvement: avoid per-request `OracleSigner` instantiation in `/api/oracle/fetch-tx`.
- Implemented key-aware module singleton for signer creation in [`app/api/oracle/fetch-tx/route.ts`](/home/teycir/Repos/GhostReceipt/app/api/oracle/fetch-tx/route.ts).
- Verification:
  - `npm run typecheck` passes.
  - `npm test -- tests/unit/api/fetch-tx-route.test.ts tests/unit/api/oracle-fetch-tx.test.ts tests/unit/api/oracle-verify-signature-route.test.ts tests/unit/providers/mempool.test.ts tests/unit/security/ssrf.test.ts` passes (40 tests).

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

---

# Task Plan: Continue Full Run Validation

- [x] Run `npm run check:secrets`.
- [x] Run `npm run lint`.
- [x] Run `npm run typecheck`.
- [x] Run `npm run test:coverage -- --ci --runInBand`.
- [x] Run `npm run build`.
- [x] Record outcomes in a `Review` section.

## Review
- `npm run check:secrets` passes (`No secrets detected`).
- `npm run lint` fails with `4` issues in `lib/security/secure-logging.ts`:
  - `no-control-regex` errors at lines `54` and `56`,
  - `no-console` warnings at lines `66` and `115` (and `--max-warnings=0` is enforced).
- `npm run typecheck` passes.
- `npm run test:coverage -- --ci --runInBand` fails:
  - `2` failing suites, `4` failing tests total:
    - `tests/unit/zk/prover.test.ts` (`3` failures),
    - `tests/integration/proof-generation.test.ts` (`1` failure),
  - all failures rooted at `lib/zk/prover.ts` import validation path with error:
    - `Failed to import proof: Invalid proof format: potentially malicious structure`.
- `npm run build`:
  - fails in sandbox due Turbopack process restriction (`Operation not permitted (os error 1)` while binding a port),
  - passes when rerun outside sandbox.
- Build warnings observed:
  - Next.js middleware deprecation warning (`middleware` -> `proxy` convention),
  - metadata warning about unsupported `viewport` placement on `/`, `/_not-found`, and `/verify`.

---

# Task Plan: Lint Remediation (secure-logging)

- [x] Remove `no-control-regex` violations in `lib/security/secure-logging.ts`.
- [x] Remove `no-console` warnings in `lib/security/secure-logging.ts`.
- [x] Run `npm run lint` and document final status.

## Review
- Replaced control-character and ANSI-stripping regex literals with explicit char-code sanitization helpers in `lib/security/secure-logging.ts`.
- Switched info-level logging paths from `console.log` to `console.info` in `secureLog` and `structuredLog`.
- Verification:
  - `npm run lint` passes with `--max-warnings=0`.

---

# Task Plan: Full Validation Rerun

- [x] Run `npm run check:secrets`.
- [x] Run `npm run lint`.
- [x] Run `npm run typecheck`.
- [x] Run `npm run test:coverage -- --ci --runInBand` (outside sandbox).
- [x] Run `npm run build` (outside sandbox).
- [x] Record outcomes in a `Review` section.

## Review
- `npm run check:secrets` passes (`No secrets detected`).
- `npm run lint` passes (`--max-warnings=0`).
- `npm run typecheck` passes.
- `npm run test:coverage -- --ci --runInBand` fails:
  - `2` failing suites, `4` failing tests total:
    - `tests/unit/zk/prover.test.ts` (`3` failures),
    - `tests/integration/proof-generation.test.ts` (`1` failure),
  - all failures are in `ProofGenerator.importProof` (`lib/zk/prover.ts`) returning:
    - `Failed to import proof: Invalid proof format: potentially malicious structure`.
- `npm run build` passes when run outside sandbox.
- Build warnings observed:
  - middleware convention deprecation (`middleware` -> `proxy`),
  - unsupported metadata `viewport` placement for `/`, `/_not-found`, and `/verify`.

---

# Task Plan: Prover Import False-Positive Fix

- [x] Identify root cause in `ProofGenerator.importProof` malicious-structure check.
- [x] Replace inherited-property check with own-key recursive scan for dangerous keys.
- [x] Add regression test for payloads containing prototype-pollution keys.
- [x] Re-run failing suites and full coverage verification.

## Review
- Root cause: `constructor in parsed.proof` treated inherited `Object.prototype.constructor` as malicious, causing false positives for normal payloads.
- Updated `lib/zk/prover.ts`:
  - replaced inline `'in'` checks with `hasDangerousKeys` recursive traversal over own enumerable keys only,
  - retained blocking for `__proto__`, `constructor`, and `prototype` when present in parsed JSON payload keys.
- Added regression in `tests/unit/zk/prover.test.ts` to assert rejection of payloads containing `__proto__` keys.
- Verification:
  - `npm test -- tests/unit/zk/prover.test.ts tests/integration/proof-generation.test.ts` passes (`11` tests).
  - `npm run test:coverage -- --ci --runInBand` passes (`21` suites, `139` tests).
  - `npm run lint` passes.
  - `npm run typecheck` passes.
