# Task Plan - 2026-03-26

## Objective (Centralize Public RPC Endpoints + Apply Multi-Endpoint Hardening Across BTC/ETH/USDC/SOL)

Eliminate scattered hardcoded public-RPC URLs, move endpoint definitions to a single named-config registry, and harden all public-RPC providers with consistent retry/failover behavior so consensus checks do not silently depend on one brittle endpoint.

## Plan

- [x] Create a centralized config module with named endpoint constants mapped to URLs.
- [x] Refactor Solana, Ethereum/USDC, and Bitcoin public-RPC providers to resolve defaults by endpoint name and support runtime name-based overrides.
- [x] Apply endpoint-level retry + fallback hardening consistently across these providers.
- [x] Add/extend provider tests to lock null-result failover, retry behavior, and config-name resolution.
- [x] Run targeted tests + typecheck and capture review outcomes.

## Review (Centralize Public RPC Endpoints + Apply Multi-Endpoint Hardening Across BTC/ETH/USDC/SOL)

- Status: Completed
- Root causes addressed:
  - Public-RPC fallback behavior was uneven across chains/providers (especially around null-result handling and retry depth).
  - Endpoint URL defaults lived inline in provider files, making updates error-prone and scattered.
- Changes shipped:
  - Added centralized endpoint registry: `lib/config/public-rpc-endpoints.ts`
    - Named constants for BTC, ETH/USDC, and SOL public RPC endpoints.
    - Default endpoint-name lists per chain/asset.
    - Shared helper to resolve endpoint URLs from constant names.
  - Hardened providers:
    - `lib/providers/solana/public-rpc.ts`
    - `lib/providers/ethereum/public-rpc.ts`
    - `lib/providers/bitcoin/mempool.ts`
  - Consistent hardening pattern now applied:
    - endpoint-level retries with configurable retry count/delay
    - multi-endpoint failover for null/unusable RPC results
    - runtime URL override support (existing) plus new runtime constant-name override support (no code recompile needed for endpoint selection changes)
  - Added/extended tests:
    - `tests/unit/providers/solana-public-rpc.test.ts`
    - `tests/unit/providers/ethereum-public-rpc.test.ts`
    - `tests/unit/providers/mempool.test.ts`
- Validation:
  - `npm test -- tests/unit/providers/mempool.test.ts tests/unit/providers/solana-public-rpc.test.ts tests/unit/providers/ethereum-public-rpc.test.ts tests/unit/backend-core/http/fetch-tx-bitcoin-consensus.test.ts --runInBand --ci` pass
  - `npm run typecheck` pass

## Objective (Fix Production KEY_UNKNOWN Verification Failures)

Resolve production verify failures caused by oracle signatures minted with a key ID not present in transparency log (`KEY_UNKNOWN`), and prevent future key drift from silently reintroducing the issue.

## Plan

- [x] Confirm production signer key mismatch against transparency-log key IDs.
- [x] Rotate Pages secret to a transparency-log-approved key and redeploy production.
- [x] Validate live `/api/oracle/fetch-tx` and `/api/oracle/verify-signature` behavior post-deploy.
- [x] Add guardrails so misconfigured signing keys fail at generation time instead of producing unverifiable receipts.

## Review (Fix Production KEY_UNKNOWN Verification Failures)

- Status: Completed
- Root cause:
  - Production signing key ID was `03bf5b42b55d2077`, which was not present in `config/oracle/transparency-log.json`.
  - Verify path correctly rejected signatures with `KEY_UNKNOWN`, causing all newly generated receipts to fail verification.
- Production remediation executed:
  - Updated Pages secret `ORACLE_PRIVATE_KEY` (production + preview) to the local key whose ID is already transparency-approved (`fb799d7d5cee5079`).
  - Redeployed Pages (`main`) so runtime picked up updated secret bindings.
- Live validation:
  - `POST https://ghostreceipt.pages.dev/api/oracle/fetch-tx` now returns `oraclePubKeyId=fb799d7d5cee5079`.
  - `POST https://ghostreceipt.pages.dev/api/oracle/verify-signature` on fresh payload now returns `{"valid":true}`.
- Preventive code hardening shipped:
  - `lib/libraries/backend-core/http/fetch-tx.ts` now enforces signing-key transparency validity before returning signed oracle payloads (default on outside tests).
  - `scripts/sync-secrets.sh` no longer auto-generates random `ORACLE_PRIVATE_KEY` when missing; it fails fast with explicit guidance.
- Validation:
  - `npm test -- tests/unit/api/fetch-tx-route.test.ts tests/unit/backend-core/http/fetch-tx-bitcoin-consensus.test.ts --runInBand --ci` pass
  - `npm run typecheck` pass

## Objective (Fix "Open Verify" False Invalid Receipt Regressions)

Resolve the current regression where freshly generated receipts open the verify page and fail with `Oracle commitment mismatch detected`, even though receipt generation succeeds.

## Plan

- [x] Reproduce/confirm the mismatch path with targeted verification instrumentation and tests.
- [x] Patch verifier signal decoding/normalization to support the runtime proof signal shape without weakening validation guarantees.
- [x] Add regression coverage that exercises exported share payloads through verify flow (including compact pointer-style payload round-trip assumptions).
- [x] Run targeted tests/typecheck and document review findings.

## Review (Fix "Open Verify" False Invalid Receipt Regressions)

- Status: Completed
- Root cause:
  - Verifier assumed legacy oracle commitment always lived in signal slot `2`.
  - Some runtime proof signal arrays include a leading validity output, shifting legacy claim slots to `[1,2,3]`.
  - That deterministic offset mismatch surfaced as false `Oracle commitment mismatch detected` for valid receipts.
- Changes shipped:
  - Updated legacy signal decoding in `lib/zk/share.ts` to support commitment-guided decoding for both legacy layouts:
    - canonical: `[claimedAmount, minDate, oracleCommitment, ...]`
    - prefixed: `[valid, claimedAmount, minDate, oracleCommitment]`
  - Updated `decodeReceiptPublicSignals` to detect both legacy commitment positions deterministically.
  - Updated `lib/verify/receipt-verifier.ts` to decode proven claims using expected-commitment-aware legacy decoding.
  - Added regression tests:
    - `tests/unit/zk/share.test.ts` (legacy decode + contract detection with prefixed signals)
    - `tests/unit/verify/receipt-verifier.test.ts` (selective payload verification with prefixed proof verification signals)
- Validation:
  - `npm test -- tests/unit/zk/share.test.ts tests/unit/verify/receipt-verifier.test.ts --runInBand --ci` pass
  - `npm run typecheck` pass

## Objective (Receipt Delivery Reliability: Remove Share-Link CTA + Fix PDF + Fix Open-Receipt Validity)

Address current production UX breakages by removing the ambiguous share-link CTA, making PDF export fail loudly and reliably open print flow, and hardening verify-path proof decoding so valid receipts do not surface false `Oracle commitment mismatch`.

## Plan

- [x] Remove the share-link action from receipt success UI while keeping copy/open verification actions.
- [x] Make PDF export robust (gesture-safe print flow + explicit runtime errors surfaced to UI).
- [x] Harden verify logic to avoid false oracle-mismatch failures when compact pointer payload resolves correctly but selective/legacy signal decode path is brittle.
- [x] Add/adjust targeted tests for the new behavior and run test/build verification.

## Review (Receipt Delivery Reliability: Remove Share-Link CTA + Fix PDF + Fix Open-Receipt Validity)

- Status: Completed
- Changes shipped:
  - Removed share-link CTA button from success panel in `components/generator/receipt-success.tsx`.
  - Tightened share hook in `lib/generator/use-receipt-share.ts`:
    - removed native-share branch and related state
    - retains copy/open/social actions
    - improved unavailable-link and PDF guidance messages
  - Hardened PDF export in `lib/generator/pdf-export.ts`:
    - safer popup capability checks
    - explicit render failures
    - print trigger now load-driven with guarded timer fallback
  - Hardened verification in `lib/verify/receipt-verifier.ts`:
    - oracle-commitment mismatch fallback to verified legacy signal set when available
    - explicit failure when selective payload lacks required legacy verification signals
  - Added/updated tests:
    - `tests/unit/verify/receipt-verifier.test.ts`
    - `tests/unit/generator/pdf-export.test.ts` (`jsdom` export flow checks)
- Validation:
  - `npm test -- tests/unit/verify/receipt-verifier.test.ts tests/unit/generator/pdf-export.test.ts tests/unit/generator/use-receipt-share.test.ts --runInBand --ci` pass
  - `npm run typecheck` pass
  - `npm run build` pass (required out-of-sandbox execution due Turbopack sandbox port restrictions)


## Objective (Provision Missing D1 Binding For Share Pointers)

Fix production `503` on `/api/share-pointer/create` by provisioning and binding `SHARE_POINTERS_DB` in Wrangler/Pages and initializing schema.

## Plan

- [x] Check Cloudflare D1 inventory and confirm missing database/binding state.
- [x] Create D1 database and add `SHARE_POINTERS_DB` binding in `wrangler.toml`.
- [x] Apply `scripts/sql/share-pointers.sql` on remote D1.
- [x] Redeploy and verify create/resolve APIs return success.

## Review (Provision Missing D1 Binding For Share Pointers)

- Status: Completed
- Actions completed:
  - Created D1 database: `ghostreceipt-share-pointers`
  - Added binding in [wrangler.toml](/home/teycir/Repos/GhostReceipt/wrangler.toml):
    - `binding = "SHARE_POINTERS_DB"`
    - `database_name = "ghostreceipt-share-pointers"`
    - `database_id = "7f085a83-b42a-4b17-a52d-26c71f41097d"`
  - Applied schema remotely:
    - `npx wrangler d1 execute ghostreceipt-share-pointers --remote --file=./scripts/sql/share-pointers.sql`
  - Deployed to Pages.
- Runtime validation:
  - `POST https://ghostreceipt.pages.dev/api/share-pointer/create` now returns `200` with `sid` verify URL.
  - `POST https://ghostreceipt.pages.dev/api/share-pointer/resolve` now resolves created IDs successfully.

## Objective (Main-Page History Removal + Safer QR Fallback)

Keep receipt history only on the dedicated `/history` page, and prevent invalid QR scans when compact pointer storage is unavailable.

## Plan

- [x] Remove history actions/widgets from main generator surfaces.
- [x] Keep `/history` page intact while eliminating main-page "View history" affordances.
- [x] Stop rendering QR when compact share links are unavailable (missing D1), and show explicit copy-link guidance.
- [x] Validate with targeted tests, typecheck, and production build.

## Review (Main-Page History Removal + Safer QR Fallback)

- Status: Completed
- Changes shipped:
  - Removed main-page history entry points:
    - [components/home-shell.tsx](/home/teycir/Repos/GhostReceipt/components/home-shell.tsx)
    - [components/generator/receipt-success.tsx](/home/teycir/Repos/GhostReceipt/components/generator/receipt-success.tsx)
    - [components/generator/generator-form.tsx](/home/teycir/Repos/GhostReceipt/components/generator/generator-form.tsx)
  - Kept dedicated history page unchanged at `/history`.
  - Added QR safety behavior in [lib/generator/use-receipt-share.ts](/home/teycir/Repos/GhostReceipt/lib/generator/use-receipt-share.ts):
    - When compact links are unavailable (`SHARE_POINTERS_DB` missing), the app now avoids generating a long-proof QR and shows a clear fallback message to copy/open the verify URL directly.
- Runtime verification note:
  - Production `POST /api/share-pointer/create` currently returns:
    - `INTERNAL_ERROR` with details `{ requiredBinding: "SHARE_POINTERS_DB", storageBackend: "memory" }`
  - This confirms compact pointer storage is not yet configured in deployed Pages environment.
- Validation:
  - `npm test -- tests/unit/functions/share-pointer-pages.test.ts tests/unit/api/share-pointer-routes.test.ts tests/unit/generator/use-receipt-share.test.ts --runInBand --ci` pass
  - `npm run typecheck` pass
  - `npm run build` pass

## Objective (Prevent Non-Resolvable QR Share Pointers On Pages)

Ensure compact `sid` QR links are only issued when durable storage is configured, so links opened from another device do not fail with "Share pointer was not found".

## Plan

- [x] Add storage-backend detection helper in shared pointer service.
- [x] Guard Cloudflare Pages share-pointer create/resolve routes to reject non-durable (memory-only) mode with explicit config error.
- [x] Surface the missing-binding warning in client share flow and document required D1 setup.
- [x] Add unit coverage for Pages share-pointer routes in missing-D1 mode; run targeted tests/typecheck/build.

## Review (Prevent Non-Resolvable QR Share Pointers On Pages)

- Status: Completed
- Root cause:
  - Cloudflare Pages runtime had no `SHARE_POINTERS_DB` D1 binding.
  - Share-pointer service fell back to in-memory storage, so `sid` links were not durable across requests/devices and resolved as not found.
- Fixes shipped:
  - Added share-pointer storage backend detection helpers in `lib/share/share-pointer-service.ts`.
  - Updated Pages routes:
    - `functions/api/share-pointer/create.ts`
    - `functions/api/share-pointer/resolve.ts`
    - `functions/api/share-pointer/[id].ts`
  - Routes now return `503` with explicit binding guidance when `SHARE_POINTERS_DB` is missing, instead of creating/trying non-durable pointers.
  - Updated share hook (`lib/generator/use-receipt-share.ts`) to surface a clear UI status message when compact links are unavailable.
  - Added `tests/unit/functions/share-pointer-pages.test.ts` to lock missing-binding behavior.
  - Updated deployment docs in `docs/runbooks/CLOUDFLARE_PAGES_DEPLOYMENT.md` and setup note in root `README.md`.
- Validation:
  - `npm test -- tests/unit/functions/share-pointer-pages.test.ts tests/unit/api/share-pointer-routes.test.ts tests/unit/generator/use-receipt-share.test.ts --runInBand --ci` pass
  - `npm run typecheck` pass
  - `npm run build` pass (outside sandbox; Turbopack sandbox port restriction avoided)
- Residual risk:
  - Existing deployed environments still require actual D1 binding + schema setup before compact cross-device QR links can work.

## Objective (Cloudflare Pages Deploy Stability + No Deprecated Deploy Command)

Fix Cloudflare Pages deployment failure caused by global-scope side effects in Functions bundle, and remove deprecated `wrangler pages publish` usage from CI deploy workflow.

## Plan

- [x] Remove broad backend-core barrel import from share-pointer service to avoid pulling replay/timer globals into Cloudflare Functions bundle.
- [x] Update deploy workflow to use `wrangler pages deploy` path.
- [x] Run targeted tests/typecheck/build and capture review notes.

## Review (Cloudflare Pages Deploy Stability + No Deprecated Deploy Command)

- Status: Completed
- Root cause:
  - `lib/share/share-pointer-service.ts` imported `@ghostreceipt/backend-core/http` barrel, which transitively initialized replay protection timers (`setInterval`) at module scope.
  - Cloudflare Pages Functions rejects global-scope async/timer/random operations, causing deploy-time function publish failure.
  - Deploy workflow used `cloudflare/pages-action@v1`, which emits deprecated `wrangler pages publish` warnings.
- Fixes shipped:
  - Narrowed share-pointer service import to side-effect-free module:
    - `@/lib/libraries/backend-core/http/share-pointer-storage`
  - Updated deploy workflow to:
    - `cloudflare/wrangler-action@v3`
    - `pages deploy out --project-name=ghostreceipt --branch=${{ github.ref_name }}`
- Validation:
  - `npm test -- tests/unit/api/share-pointer-routes.test.ts tests/unit/generator/use-receipt-share.test.ts --runInBand --ci` pass
  - `npm run typecheck` pass
  - `npm run build` pass
- Residual risk:
  - Other future imports of broad runtime barrels inside functions-facing modules could reintroduce global-scope side effects; keep functions paths on narrow module imports.

## Objective (Remove Next.js Viewport Metadata Warnings In CI)

Eliminate App Router viewport metadata warnings during `next build` so CI output is clean.

## Plan

- [x] Move viewport config out of `metadata` and into `export const viewport` in `app/layout.tsx`.
- [x] Run `npm run build` and verify no viewport metadata warnings remain.
- [x] Record review notes and residual risk.

## Review (Remove Next.js Viewport Metadata Warnings In CI)

- Status: Completed
- Root cause:
  - `viewport` was declared inside `export const metadata`, which Next.js 16 flags as unsupported for App Router metadata.
- Fixes shipped:
  - Moved viewport declaration from `metadata.viewport` to dedicated `export const viewport` in `app/layout.tsx`.
  - Added `Viewport` type import from `next` for explicit typing.
- Validation:
  - `npm run build` pass
  - Build log contains no `Unsupported metadata viewport is configured` warnings.
- Residual risk:
  - New page-level metadata additions must keep viewport in `export const viewport`, not inside `metadata`.

## Objective (Short Verify Pointer Links For QR Scanability)

Replace long proof-in-query share URLs with compact pointer-based verify links so QR codes remain easily decodable by camera scanners (including Google Lens).

## Plan

- [x] Add share-pointer create/resolve APIs with storage-manager-backed persistence (D1 when available, in-memory fallback).
- [x] Update receipt share flow to prefer short `sid` verify URLs for QR/social/clipboard and keep long-link fallback on API failure.
- [x] Extend verify client to resolve `sid` before proof verification while preserving existing `proof` query compatibility.
- [x] Add route-level unit tests and run targeted tests + typecheck.

## Review (Short Verify Pointer Links For QR Scanability)

- Status: Completed
- Root cause:
  - QR encoded a full proof payload URL (`/verify?proof=...`) which produced very dense matrices; Google Lens often failed to decode and therefore showed no clickable link.
- Fixes shipped:
  - Added short-pointer API routes:
    - `POST /api/share-pointer/create`
    - `POST /api/share-pointer/resolve` (`{ id }`)
  - Added Cloudflare Pages parity routes:
    - `functions/api/share-pointer/create.ts`
    - `functions/api/share-pointer/[id].ts`
  - Added shared pointer service using existing storage manager:
    - D1-backed persistence when `SHARE_POINTERS_DB` binding exists.
    - In-memory fallback otherwise.
  - Updated generator share flow to prefer compact verify URLs (`/verify?sid=<pointerId>`) for QR/social/clipboard while preserving long-link fallback.
  - Updated verify client to resolve `sid` then run existing proof verification flow.
  - Added route unit tests for create/resolve behavior.
- Validation:
  - `npm test -- tests/unit/api/share-pointer-routes.test.ts tests/unit/generator/use-receipt-share.test.ts --runInBand --ci` pass
  - `npm run typecheck` pass
- Residual risk:
  - When running without persistent backing storage (no D1 binding), short links are process-local and may not survive restarts or multi-instance routing.

## Objective (Scanner-Safe Classic QR Styling)

Make receipt QR output strictly scanner-friendly by using classic black-on-white rendering and removing decorative cyan framing that can hurt camera recognition.

## Plan

- [x] Switch QR generation colors to pure black/white and increase quiet-zone margin.
- [x] Update QR frame styling to neutral scan-safe appearance (no cyan corner ornaments).
- [x] Run targeted tests + typecheck and capture verification notes.

## Review (Scanner-Safe Classic QR Styling)

- Status: Completed
- Root cause:
  - Decorative cyan-on-dark QR styling reduced scanner reliability, especially for phone camera tools like Google Lens expecting high-contrast finder patterns and quiet zone.
- Fixes shipped:
  - Updated QR generation options in `lib/generator/use-receipt-share.ts`:
    - `color.dark: #000000`
    - `color.light: #ffffff`
    - `margin: 8`
    - `width: 384`
    - error-correction preference order: `M -> L -> Q -> H` (screen readability first, with fallback resilience).
  - Updated `.qr-frame` in `app/globals.css` to neutral white framing and removed cyan corner ornaments.
  - Increased on-screen QR render size in `components/generator/receipt-success.tsx` (`h-72/w-72`, `sm:h-80/sm:w-80`) for easier camera scanning.
  - Added regression assertion in `tests/unit/generator/use-receipt-share.test.ts` for the new QR color/margin/size options.
- Validation:
  - `npm test -- tests/unit/generator/use-receipt-share.test.ts --runInBand --ci` pass
  - `npm run typecheck` pass
- Residual risk:
  - Extremely dense URLs can still produce visually dense QR matrices; copy/open link fallback remains available for edge scanner failures.

## Objective (Fresh Transaction Table Doc + README Link)

Create a dedicated test-data document containing amount/hash/time rows and link it from README docs navigation.

## Plan

- [x] Collect fresh cross-chain transaction rows with amount + hash + UTC timestamp.
- [x] Add a dedicated runbook doc with a markdown table and source links.
- [x] Link the new document from `README.md` and `docs/README.md`.

## Review (Fresh Transaction Table Doc + README Link)

- Status: Completed
- Added:
  - `docs/runbooks/FRESH_TRANSACTION_TEST_DATA_2026-03-26.md`
- Linked from:
  - `README.md` (For developers docs list)
  - `docs/README.md` (Runbooks list)
- Notes:
  - Table rows include BTC, ETH, and SOL with explicit amount semantics and UTC timestamps.

## Objective (Visible Circuit Runtime Fingerprint)

Expose a clear runtime fingerprint after receipt generation so users can verify proving backend details at a glance.

## Plan

- [x] Add prover runtime metadata (`backend`, `executionMode`, `artifactVersion`) and expose it after each proof generation.
- [x] Thread runtime metadata through generator state and display it in success telemetry UI.
- [x] Include runtime metadata in console telemetry log and validate with targeted tests/typecheck.

## Review (Visible Circuit Runtime Fingerprint)

- Status: Completed
- Changes shipped:
  - Added `ProofGenerator.getRuntimeInfo()` with:
    - `backend: groth16`
    - `executionMode: worker | main-thread`
    - `artifactVersion`
  - Threaded runtime telemetry into generator success state as `proofRuntime`.
  - Updated success UI telemetry card to show:
    - `Runtime: groth16 / <mode> / v<artifactVersion>`
  - Updated console telemetry log payload to include `runtime`.
- Validation:
  - `npm test -- tests/unit/zk/prover-runtime.test.ts --runInBand --ci` pass
  - `npm run typecheck` pass
- Residual risk:
  - If worker proving succeeds, runtime mode displays `worker`; otherwise it correctly reports `main-thread` fallback.

## Objective (QR Generation Failure for Long Verify URLs)

Fix the receipt share screen so QR generation succeeds for longer verification URLs instead of showing "Could not generate QR code" for valid receipts.

## Plan

- [x] Implement resilient QR generation that retries with lower error-correction levels when payload size is large.
- [x] Add unit tests under `tests/` that verify fallback sequencing and hard-failure behavior.
- [x] Run targeted tests + typecheck and capture review notes.

## Review (QR Generation Failure for Long Verify URLs)

- Status: Completed
- Root cause:
  - QR creation attempted only `errorCorrectionLevel: 'H'`, which fails for larger verify URLs even though lower correction levels can still encode them.
- Fixes shipped:
  - Added QR generation fallback sequence `H -> Q -> M -> L` in `lib/generator/use-receipt-share.ts`.
  - Kept existing user-facing error handling for true hard-limit cases when all levels fail.
  - Added unit tests in `tests/unit/generator/use-receipt-share.test.ts` for fallback and hard-failure behavior.
- Validation:
  - `npm test -- tests/unit/generator/use-receipt-share.test.ts --runInBand --ci` pass
  - `npm run typecheck` pass
- Residual risk:
  - Extremely long links can still exceed QR version-40 `L` capacity; in those rare cases users still need the copy/share link fallback.

## Objective (Browser `base64url` Runtime Error + Manifest Icon 404)

Fix the UI runtime failure (`Unknown encoding: base64url`) and remove manifest icon fetch errors (`/icon-192.png` 404) observed in production.

## Plan

- [x] Make share-payload base64url encoding/decoding runtime-safe in browser environments.
- [x] Ensure manifest icon entries point to files that actually exist in `public/`.
- [x] Run targeted verification and capture a review summary with residual risk.

## Review (Browser `base64url` Runtime Error + Manifest Icon 404)

- Status: Completed
- Root causes:
  - `lib/libraries/zk/share-payload.ts` used `Buffer.toString('base64url')`, which is not universally supported in browser Buffer polyfills.
  - `public/manifest.json` referenced `/icon-192.png` and `/icon-512.png` that were missing from `public/`.
  - `app/layout.tsx` also referenced missing `/favicon.ico` and `/apple-touch-icon.png`.
- Fixes shipped:
  - Replaced `base64url` Buffer encoding with base64 + URL-safe normalization in `lib/libraries/zk/share-payload.ts`.
  - Updated PWA manifest icon entry to use existing `/favicon.svg`.
  - Removed missing icon metadata references in `app/layout.tsx`, keeping only `/favicon.svg`.
- Validation:
  - `npm test -- tests/unit/zk/prover.test.ts --runInBand --ci` pass
  - `npm run typecheck` pass
  - Repo scan confirms no remaining references to:
    - `/icon-192.png`
    - `/icon-512.png`
    - `/favicon.ico`
    - `/apple-touch-icon.png`
- Residual risk:
  - Installability icon quality for strict PWA platforms may be lower with SVG-only icons; adding real `192x192` and `512x512` PNG assets would be the durable follow-up.

## Objective (Fraud + Error Hardening Sweep)

Perform a deep hardening pass focused on fraud-resistance and operational-error resilience across oracle request intake, signature validation, and provider URL safety.

## Plan

- [x] Complete threat-surface review and prioritize concrete fraud/error vectors in runtime paths.
- [x] Integrate shared JSON input sanitization into Next routes and Cloudflare Pages wrappers.
- [x] Close SSRF gaps for bracketed/IPv6 literal hosts and add regression tests.
- [x] Enforce oracle auth-envelope lifetime bounds to prevent overly long-lived signatures.
- [x] Run targeted tests + typecheck and record findings/residual risk.

## Review (Fraud + Error Hardening Sweep)

- Status: Completed
- High-risk findings prioritized:
  - Hidden/control-character JSON payload abuse window in route parsing paths.
  - Bracketed IPv6/private host SSRF bypass class in URL safety checks.
  - Missing signature TTL ceiling allowed overly long-lived auth envelopes.
- Hardening shipped:
  - JSON sanitizer integrated in:
    - `lib/security/secure-json.ts`
    - `lib/libraries/backend-core/http/pages/runtime-shared.ts`
    - parse-error passthrough updated in `lib/libraries/backend-core/http/request-envelope.ts`
  - SSRF protections expanded in `lib/security/ssrf.ts`:
    - bracketed IPv6 handling,
    - private IPv6 range blocking (`fc00::/7`, `fe80::/10`, `fec0::/10`, loopback/unspecified),
    - credentialed URL rejection (`user:pass@host`).
  - Signature-lifetime bounds enforced:
    - replay validator checks `SIGNATURE_TTL_TOO_LONG` in `lib/libraries/backend-core/http/oracle-auth-replay.ts`
    - route wiring in:
      - `app/api/oracle/verify-signature/route.ts`
      - `lib/libraries/backend-core/http/pages/verify-signature-pages.ts`
    - signer-side TTL clamp in `lib/libraries/backend-core/http/fetch-tx.ts`
  - Env template additions in `.env.example`:
    - `ORACLE_VERIFY_REPLAY_MAX_ENTRIES`
    - `ORACLE_VERIFY_REPLAY_MAX_FUTURE_SKEW_SECONDS`
    - `ORACLE_VERIFY_MAX_SIGNATURE_LIFETIME_SECONDS`
- Added/updated tests:
  - `tests/unit/security/secure-json.test.ts`
  - `tests/unit/backend-core/http/pages/runtime-shared.test.ts` (new)
  - `tests/unit/security/ssrf.test.ts`
  - `tests/unit/backend-core/http/oracle-auth-replay.test.ts`
  - `tests/unit/api/oracle-verify-signature-route.test.ts`
  - `tests/unit/api/oracle-fetch-tx.test.ts`
  - `tests/unit/backend-core/http/fetch-tx-bitcoin-consensus.test.ts`
- Validation:
  - `npm test -- tests/unit/security/secure-json.test.ts tests/unit/security/ssrf.test.ts tests/unit/backend-core/http/oracle-auth-replay.test.ts tests/unit/backend-core/http/pages/runtime-shared.test.ts tests/unit/api/oracle-verify-signature-route.test.ts tests/unit/api/oracle-fetch-tx.test.ts --runInBand --ci` pass
  - `npm test -- tests/unit/backend-core/http/fetch-tx-bitcoin-consensus.test.ts --runInBand --ci` pass
  - `npm run typecheck` pass
- Residual risk:
  - Rate-limit/replay registries remain in-memory per-instance; multi-instance strict global replay/rate control still requires shared backend coordination.

# Task Plan - 2026-03-25

## Objective (Manual Testing Runbook)

Create a step-by-step manual QA guide with real live-data reproduction flow.

## Plan

- [x] Add a dedicated manual testing runbook under `docs/runbooks/`.
- [x] Include real on-chain reproduction data and live test commands.
- [x] Link the runbook from docs and root README hubs.

## Review (Manual Testing Runbook)

- Status: Completed
- Added:
  - `docs/runbooks/MANUAL_TESTING.md`
- Coverage:
  - setup + prerequisites,
  - UI happy-path/negative-path checks,
  - static docs checks,
  - fail-safe drill,
  - live data CLI reproduction commands (`test:live:*`),
  - CI-quality verification commands,
  - sign-off template.
- Linked from:
  - `docs/README.md`
  - `README.md`

## Objective (Input Sanitization Hardening)

Strengthen JSON request sanitization for both Next API routes and Cloudflare Pages wrappers with shared, deterministic behavior.

## Plan

- [x] Add a shared JSON input sanitizer utility for key validation and string sanitization/rejection rules.
- [x] Integrate sanitizer into `parseSecureJson` and `parseJsonBodyWithLimits`.
- [x] Expose sanitizer parse errors through route envelope mapping.
- [x] Add unit tests for sanitizer behavior and parser integration.
- [x] Run targeted tests + typecheck and capture review notes.

## Objective (Investigate x5 Matrix Warning Noise)

Identify why warning volume spikes during large repeat matrix runs and reduce avoidable noise without hiding real failures.

## Plan

- [x] Reproduce warnings with reduced matrix run and inspect exact warning lines.
- [x] Isolate repeated warning source in matrix harness.
- [x] Patch harness to avoid repeated warnings for permanently unsupported datasets.
- [x] Re-run matrix sample and verify warning reduction.

## Review (Investigate x5 Matrix Warning Noise)

- Status: Completed
- Root cause:
  - `tests/integration/live-legacy-vs-edge-speed-matrix.test.ts` was retrying the same known unsupported SOL fixture across repeats (`4FKj...`), generating repeated cascade warnings + repeated skip warnings.
- Fix:
  - Added dataset-level skip tracking in the matrix test:
    - `loggedSkipDatasetKeys` to log skip warning once per dataset.
    - `permanentlySkippedDatasetKeys` to stop retrying a dataset after confirmed unsupported-native-SOL failure.
- Validation:
  - Reproduced baseline warning classes with live matrix sample (`repeats=2`).
  - Re-ran after patch and confirmed:
    - only one matrix skip warning for the unsupported dataset,
    - unsupported dataset no longer retried across repeats.
  - `npm run typecheck` pass.

## Objective (Observability Follow-Up: Oracle Client Failover)

Address silent failover suppression by adding warning logs in client failover path and test coverage.

## Plan

- [x] Add warning logging when fallback is triggered by HTTP response failover.
- [x] Add warning logging when fallback is triggered by thrown network/transport errors.
- [x] Extend unit tests to assert failover warnings are emitted.
- [x] Update fail-safe runbook with performance/disable guidance and observability signals.

## Review (Observability Follow-Up: Oracle Client Failover)

- Status: Completed
- Notes:
  - `lib/oracle/client.ts` now warns before backup retry in both:
    - response failover path (`404/405/5xx`)
    - thrown transport error path.
  - `tests/unit/oracle/client.test.ts` now verifies warning emission for:
    - primary `503` fallback,
    - primary network error fallback.
  - `docs/runbooks/ORACLE_FAILSAFE_ARCHITECTURE.md` now includes:
    - performance implications,
    - explicit disable behavior,
    - suggested observability signals.
- Validation:
  - `npm test -- tests/unit/oracle/client.test.ts --runInBand --ci` pass.

## Objective (Operationalize Step 1 + Step 2)

Execute the approved next steps:
1) make backup-base configuration explicit in deploy scripts,
2) run a repeatable failover drill and capture result.

## Plan

- [x] Add a dedicated failover drill command.
- [x] Update deployment helper scripts to include `NEXT_PUBLIC_ORACLE_EDGE_BACKUP_BASE`.
- [x] Execute drill command and document pass/fail result.

## Review (Operationalize Step 1 + Step 2)

- Status: Completed
- Changes:
  - Added command:
    - `npm run test:drill:oracle-failover`
    - Script file: `scripts/run-oracle-failover-drill.sh`
  - Updated deploy helper scripts to mention backup-base setup:
    - `scripts/deploy-check.sh`
    - `scripts/setup-cloudflare.sh`
    - `scripts/sync-secrets.sh`
  - Added quick drill command to fail-safe runbook:
    - `docs/runbooks/ORACLE_FAILSAFE_ARCHITECTURE.md`
- Validation:
  - `npm run test:drill:oracle-failover` pass.
  - Drill output confirms policy paths:
    - primary success path,
    - fallback on `503`,
    - fallback on network error,
    - no fallback on `429`.

## Objective (Fail-Safe Architecture: Client Primary, Edge Backup)

Implement a clean fail-safe oracle routing architecture where the client keeps `/api/oracle/*` as primary and uses edge as optional backup, then align README/how-to/HTML/deployment docs with the same policy.

## Plan

- [x] Add a shared client oracle transport helper with explicit fallback policy.
- [x] Wire generator and verifier API calls to the shared helper.
- [x] Add unit tests covering fallback and non-fallback behavior.
- [x] Update README + docs + public HTML pages to document client-primary/edge-backup behavior.
- [x] Run targeted tests and capture verification notes.

## Review (Fail-Safe Architecture: Client Primary, Edge Backup)

- Status: Completed
- Notes:
  - Added shared helper: `lib/oracle/client.ts`.
  - Added optional env config: `NEXT_PUBLIC_ORACLE_EDGE_BACKUP_BASE` (`.env.example`).
  - Fallback policy now centralized:
    - primary route: `/api/oracle/*`
    - optional backup base: `NEXT_PUBLIC_ORACLE_EDGE_BACKUP_BASE`
    - fallback triggers only on transport/platform failures (`network`, `404/405`, `5xx`)
    - no fallback on normal `4xx` (including `429`)
  - Generator/verifier paths now use shared transport:
    - `lib/generator/use-proof-generator.ts`
    - `lib/verify/receipt-verifier.ts`
  - Added unit coverage:
    - `tests/unit/oracle/client.test.ts`
  - Documentation updates completed across:
    - `README.md`
    - `docs/README.md`
    - `docs/DEPLOYMENT_CHECKLIST.md`
    - `docs/DEPLOYMENT_READY.md`
    - `docs/CLOUDFLARE_DEPLOYMENT.md`
    - `docs/runbooks/CLOUDFLARE_PAGES_DEPLOYMENT.md`
    - `docs/runbooks/CLOUDFLARE_DEPLOYMENT.md`
    - `docs/runbooks/QUICK_DEPLOY.md`
    - `docs/runbooks/SECURITY.md`
    - `docs/runbooks/ORACLE_FAILSAFE_ARCHITECTURE.md` (new)
    - `functions/README.md`
    - `public/docs/how-to-use.html`
    - `public/docs/faq.html`
    - `public/docs/security.html`
- Validation:
  - `npm test -- tests/unit/oracle/client.test.ts tests/unit/verify/receipt-verifier.test.ts --runInBand --ci` pass.
  - `npm run typecheck` pass.
  - Also resolved the previously observed matrix typing issue by splitting `configuredScenarios` and filtered `scenarios` assignment in `tests/integration/live-legacy-vs-edge-speed-matrix.test.ts`.

## Objective (Live Confirmation: Multi-Crypto + Multi-Dataset Legacy vs Edge)

Confirm legacy-vs-edge speed behavior on additional chains and multiple real transaction datasets.

## Plan

- [x] Add a gated live matrix benchmark covering BTC, ETH(native), ETH(USDC), and SOL where datasets are available.
- [x] Use multiple real tx hashes per chain where possible and compare legacy vs edge on identical inputs.
- [x] Execute the matrix benchmark in live mode and collect per-scenario timings.
- [x] Document conclusions in this task file.

## Review (Live Confirmation: Multi-Crypto + Multi-Dataset Legacy vs Edge)

- Status: Completed
- Notes:
  - Added matrix benchmark suite: `tests/integration/live-legacy-vs-edge-speed-matrix.test.ts`.
  - Added command: `npm run test:live:speed:matrix`.
  - Matrix compared legacy vs edge on real datasets across:
    - `bitcoin-native` (3 datasets),
    - `ethereum-native` (3 datasets),
    - `ethereum-usdc` (1 dataset),
    - `solana-native` (2 datasets completed, 1 dataset skipped).
  - One Solana fixture was skipped because it is not a native SOL transfer (`PROVIDER_ERROR`), which is expected for this fetch path.
- Validation:
  - `npm run test:live:speed:matrix` pass.
  - `SPEED_COMPARE_MATRIX_REPEATS_PER_TX=3 npm run test:live:speed:matrix` pass.
  - `SPEED_COMPARE_MATRIX=1 SPEED_COMPARE_MATRIX_REPEATS_PER_TX=15 SPEED_COMPARE_MATRIX_TEST_TIMEOUT_MS=1800000 npx jest tests/integration/live-legacy-vs-edge-speed-matrix.test.ts --runInBand --ci --testTimeout=1800000 --forceExit` pass.
  - Global result (`samplesPerMode=9`):
    - Legacy mean total: `3226ms`
    - Edge mean total: `4167ms`
    - Delta (edge vs legacy): `+29.17%`
  - Expanded-sample result (`samplesPerMode=27`, `repeatsPerTx=3`):
    - Legacy mean total: `3433ms`
    - Edge mean total: `3194ms`
    - Delta (edge vs legacy): `-6.96%`
  - 5x expanded result (`samplesPerMode=135`, `repeatsPerTx=15`):
    - Legacy mean total: `3237ms`
    - Edge mean total: `3471ms`
    - Delta (edge vs legacy): `+7.23%`
  - Per-scenario deltas (edge vs legacy):
    - `bitcoin-native`:
      - baseline run: `-20.57%` (edge faster)
      - expanded-sample run: `-5.95%` (edge faster)
    - `ethereum-native`:
      - baseline run: `+45.87%` (edge slower)
      - expanded-sample run: `-2.64%` (edge faster)
    - `ethereum-usdc`:
      - baseline run: `+1.70%` (near parity, edge slightly slower)
      - expanded-sample run: `-20.91%` (edge faster)
    - `solana-native`:
      - baseline run: `+71.02%` (edge slower)
      - expanded-sample run: `+1.17%` (near parity, edge slightly slower)
      - 5x expanded run: `+31.09%` (edge slower)
  - Data quality note:
    - Solana fixture `4FKj...` is not a native SOL transfer for this route; matrix harness now logs and skips those unusable samples instead of failing the whole benchmark.

## Objective (Live Benchmark: Legacy vs Edge Speed on Same Data)

Measure and compare end-to-end oracle route latency between legacy Next app routes and edge Pages function wrappers using the same live transaction data.

## Plan

- [x] Add a gated live integration benchmark test for legacy vs edge route latency on identical input.
- [x] Capture per-mode timing metrics (`fetch`, `verify`, `total`) with warmup + measured iterations.
- [x] Run benchmark test command and collect results.
- [x] Document benchmark summary and conclusions in this task file.

## Review (Live Benchmark: Legacy vs Edge Speed on Same Data)

- Status: Completed
- Notes:
  - Added live benchmark suite: `tests/integration/live-legacy-vs-edge-speed.test.ts`.
  - Added runnable command: `npm run test:live:speed:legacy-vs-edge`.
  - Benchmark compares:
    - legacy path: Next app routes (`app/api/oracle/fetch-tx`, `app/api/oracle/verify-signature`)
    - edge path: Pages function wrappers (`functions/api/oracle/fetch-tx`, `functions/api/oracle/verify-signature`)
  - Fairness controls:
    - same BTC tx hash for all rounds,
    - warmup phase + measured phase,
    - alternating execution order per round,
    - canonical fetch cache disabled (`ORACLE_FETCH_TX_CANONICAL_CACHE_TTL_MS=0`) during run.
- Validation:
  - `npm run test:live:speed:legacy-vs-edge` pass.
  - Result summary (warmup=1, measured=4):
    - Legacy mean total: `1322ms`
    - Edge mean total: `1418ms`
    - Delta (edge vs legacy): `+7.26%`
    - Legacy p50 total: `1323ms`, p95 total: `1331ms`
    - Edge p50 total: `1322ms`, p95 total: `1719ms`

## Objective (Live Integration: Real-World Conditions Run)

Execute the live integration suite against real provider endpoints and live chain transactions, then capture pass/fail evidence and blockers.

## Plan

- [x] Run `npm run test:live:oracle` with `LIVE_INTEGRATION=1` flow enabled.
- [x] Capture concrete failures (missing env keys, tx mismatches, provider errors) if any.
- [x] Document run outcome and validation evidence in this task file.

## Review (Live Integration: Real-World Conditions Run)

- Status: Completed
- Notes:
  - Executed live integration suite using real provider calls and real-world chain transactions via `scripts/run-live-oracle-tests.sh`.
  - `tests/integration/live-oracle-flows.test.ts` passed with successful provider cascade calls (`blockcypher`, `etherscan`, `helius`).
  - `tests/integration/live-consensus-flows.test.ts` passed in strict consensus mode (BTC + ETH native + ETH USDC + SOL paths).
  - No env-key, tx-format, schema, commitment, witness, proof, or signature-verification failures occurred in this run.
- Validation:
  - `npm run test:live:oracle` pass.
  - Result summary: `2` test suites passed, `7` tests passed, `0` failed.

## Objective (Integration Coverage: Edge Worker With Client Fallback)

Add integration test coverage for the new proof runtime path that prefers the edge worker execution path and safely falls back to client/main-thread proving when worker execution fails.

## Plan

- [x] Add integration tests that validate successful worker-path proof resolution when worker runtime is available.
- [x] Add integration tests that validate fallback to direct `groth16.fullProve` when worker runtime errors.
- [x] Run targeted integration tests for the new suite.
- [x] Document review/results in this task file.

## Review (Integration Coverage: Edge Worker With Client Fallback)

- Status: Completed
- Notes:
  - Added integration suite: `tests/integration/proof-worker-edge-fallback.test.ts`.
  - Added coverage for the worker-first runtime branch by stubbing a browser-like `window` + `Worker` runtime and asserting worker-returned proof/public signals are used.
  - Added coverage for runtime fallback by simulating worker-constructor failure and asserting `groth16.fullProve` executes as the client/main-thread fallback.
  - Reused Jest module mocking for `snarkjs` (`groth16.fullProve`) to keep integration runtime deterministic and avoid readonly spy failures from direct `spyOn`.
- Validation:
  - `npm test -- tests/integration/proof-worker-edge-fallback.test.ts --runInBand --ci` pass.

## Objective (Modularity Hardening: Reusable Pages Adapters)

Ensure the recent Cloudflare Pages refactor is fully reusable across projects by removing duplicated in-memory adapter logic from route handlers and centralizing it in backend-core primitives.

## Plan

- [x] Add no-timer mode support to shared in-memory replay/nullifier adapters without changing existing defaults.
- [x] Refactor Pages `verify-signature` and `check-nullifier` handlers to use the shared adapters instead of local Map adapters.
- [x] Add focused unit tests for no-timer adapter mode and Pages handler regression coverage.
- [x] Run `npm run typecheck` and targeted unit tests for backend-core + Pages wrappers.
- [x] Document review/results in this task file.

## Review (Modularity Hardening: Reusable Pages Adapters)

- Status: Completed
- Notes:
  - Added `startCleanupTimer` option to shared reusable adapters:
    - `InMemoryOracleAuthReplayAdapter`
    - `InMemoryNullifierRegistryAdapter`
  - Defaults are unchanged (`startCleanupTimer: true`) to preserve existing behavior in other runtimes.
  - Cloudflare Pages handlers now use shared adapters in no-timer mode (`startCleanupTimer: false`) instead of route-local Map adapter duplication.
  - This makes the Pages runtime slimmer and keeps replay/nullifier behavior centralized in backend-core for reuse in other projects.
- Validation:
  - `npm run typecheck` pass.
  - `npm test -- tests/unit/backend-core/http/oracle-auth-replay.test.ts tests/unit/backend-core/http/oracle-nullifier.test.ts tests/unit/functions/oracle-pages-wrappers.test.ts --runInBand --ci` pass.

## Objective (Restore Real Production Oracle APIs On Cloudflare Pages)

Move production Pages Functions from fail-closed stubs back to real behavior while keeping stability-first controls and extracting reusable modules for other projects.

## Plan

- [x] Replace fail-closed `functions/api/oracle/fetch-tx.ts` with real production handler.
- [x] Replace fail-closed `functions/api/oracle/verify-signature.ts` with real production handler.
- [x] Add `functions/api/oracle/check-nullifier.ts` production handler for parity.
- [x] Extract shared Pages runtime logic into reusable backend-core modules.
- [x] Keep function entrypoints thin and generic for reuse in other projects.
- [x] Add/keep focused unit tests for function behavior.
- [x] Run typecheck and targeted unit tests.
- [x] Deploy to Cloudflare Pages and smoke-check production endpoints.

## Review (Restore Real Production Oracle APIs On Cloudflare Pages)

- Status: Completed
- Notes:
  - Added reusable, project-agnostic handler modules:
    - `lib/libraries/backend-core/http/pages/runtime-shared.ts`
    - `lib/libraries/backend-core/http/pages/fetch-tx-pages.ts`
    - `lib/libraries/backend-core/http/pages/verify-signature-pages.ts`
    - `lib/libraries/backend-core/http/pages/check-nullifier-pages.ts`
  - `functions/api/oracle/*` files are now thin entrypoints that call backend-core reusable handlers.
  - Added backend-core exports in `lib/libraries/backend-core/http/index.ts` so other projects can import the same primitives/handlers directly.
  - Removed global-scope timer dependencies from the Pages runtime path to satisfy Cloudflare publish/runtime constraints.
  - Updated Pages deployment/runtime docs and function docs to reflect the modular architecture.
- Validation:
  - `npm run typecheck` pass.
  - `npm test -- tests/unit/functions/oracle-pages-wrappers.test.ts --runInBand --ci` pass.
  - `npm test -- tests/unit/functions/oracle-pages-wrappers.test.ts tests/unit/api/fetch-tx-route.test.ts tests/unit/api/oracle-verify-signature-route.test.ts tests/unit/api/oracle-check-nullifier-route.test.ts --runInBand --ci` pass.
  - `npm run deploy` pass.
  - Production smoke checks on `https://ghostreceipt.pages.dev`:
    - `POST /api/oracle/fetch-tx` invalid body -> `400 INVALID_HASH`
    - `POST /api/oracle/verify-signature` invalid body -> `400 INVALID_HASH`
    - `POST /api/oracle/check-nullifier` invalid body -> `400 INVALID_HASH`

## Objective (Implement P1-06 Safely: Durable Limiter With Legacy Fallback)

Implement item `2` with stability-first guarantees:
- keep `legacy` as the default mode,
- add `durable_prefer` and `durable_strict` modes,
- fallback to legacy only for technical durable-backend failures (not for rate-limit denials),
- keep behavior rollback-safe via env flags.

## Plan

- [x] Add resilient rate-limit backend abstraction in backend-core HTTP limiter path.
- [x] Add durable backend env controls and defaults in `.env.example`.
- [x] Return safe error response when strict durable mode backend is unavailable.
- [x] Add focused unit tests for `legacy`, `durable_prefer`, and strict-unavailable behavior.
- [x] Run typecheck and targeted unit tests.

## Review (Implement P1-06 Safely: Durable Limiter With Legacy Fallback)

- Status: Completed (feature-flagged, stability-first default)
- Notes:
  - Added backend modes in route rate-limiter path:
    - `legacy` (default),
    - `durable_prefer` (technical durable failure -> legacy fallback),
    - `durable_strict` (technical durable failure -> fail closed).
  - Fallback guardrail enforced:
    - No fallback-allow on explicit durable deny decisions.
  - Added per-limiter backend scopes (`fetch-tx`, `verify-signature`, `check-nullifier`) for deterministic durable buckets.
  - Added strict-mode envelope behavior: backend outage returns `503` with `INTERNAL_ERROR`.
  - Added env controls in `.env.example` for backend mode, durable endpoint, timeout, and circuit-breaker thresholds.
  - Hardened catch-path observability:
    - non-JSON durable responses now include parse-error details in fatal exceptions,
    - durable `429` parse fallback now logs warning details before safe deny fallback,
    - invalid durable URL config is validated and logged before safe legacy fallback.
- Validation:
  - `npm run typecheck` pass.
  - `npm test -- tests/unit/backend-core/http/rate-limit-envelope.test.ts tests/unit/backend-core/http/oracle-route-envelope.test.ts --runInBand --ci` pass.
  - `npm test -- tests/unit/api/fetch-tx-route.test.ts tests/unit/api/oracle-verify-signature-route.test.ts --runInBand --ci` pass.
  - `npm test -- tests/unit/api/oracle-check-nullifier-route.test.ts --runInBand --ci` pass.

## Objective (Deploy Safety Hotfix: Remove False-Positive Oracle Function Behavior)

After preview deploy validation, `/api/oracle/*` Cloudflare Functions were confirmed to be placeholder logic (unsafe success responses). Ship immediate fail-closed stubs to prevent trust-model violations.

## Plan

- [x] Replace placeholder success responses in `functions/api/oracle/fetch-tx.ts` and `functions/api/oracle/verify-signature.ts` with explicit `503` fail-closed responses.
- [x] Add structured error payloads and no-store headers for fail-closed function responses.
- [x] Update `functions/README.md` to reflect fail-closed status and required production parity work.

## Objective (Spike-Safety Step 1: Cloudflare Edge Route Wall)

Implement only item `1` from the safety batch with rollback-safe operations and no extra API spend:
- add an edge-layer rate-limit runbook for oracle routes,
- wire it into deployment docs/README,
- keep item `2` (Durable Object global limiter) explicitly deferred for local validation.

## Plan

- [x] Add a dedicated Cloudflare edge rate-limit runbook with explicit thresholds, rollout, verification, and rollback steps.
- [x] Update deployment checklists/runbooks to make edge rule setup part of standard release flow.
- [x] Update roadmap to mark item `1` done and item `2` deferred for local confirmation.
- [x] Add a concise README pointer for operators.
- [x] Document execution summary and assumptions in this task file.

## Review (Spike-Safety Step 1: Cloudflare Edge Route Wall)

- Status: Completed
- Notes:
  - Added runbook: `docs/runbooks/CLOUDFLARE_EDGE_RATE_LIMIT_RULES.md`.
  - Updated deployment docs to include edge wall setup:
    - `docs/runbooks/CLOUDFLARE_PAGES_DEPLOYMENT.md`
    - `docs/DEPLOYMENT_CHECKLIST.md`
  - Updated roadmap queue with explicit status:
    - `R-P1-05` (edge route wall) marked complete,
    - `R-P1-06` (Durable Object global limiter) kept deferred for local confirmation.
  - Added README operator pointer to the new runbook.
- Assumptions:
  - Item `1` = Cloudflare edge route-level rate limiting.
  - Item `2` = Durable Object coordinated global limiter to validate locally later.
- Validation:
  - Docs-only change; no runtime code path was modified.

## Objective (Low-Cost Premium UX Batch: Share + Errors + Shortcuts + Referral)

Ship the next free-plan-safe UX improvements with strong visual consistency:
- one-click "copy all share data" packet,
- keyboard shortcuts (`Cmd/Ctrl+V`, `Cmd/Ctrl+Enter`, `Cmd/Ctrl+C` on success),
- smarter actionable validation/fetch errors,
- premium but subtle referral CTA on verify page.

## Plan

- [x] Add share packet helpers (`verification code` + copy-all text) in shared social utilities.
- [x] Extend `useReceiptShare` and success card UI with one-click copy-all and premium status presentation.
- [x] Add generator keyboard shortcuts for paste and generate, with safe editable-field guards.
- [x] Improve generator smart error copy for amount/date mismatch and confirmation guidance.
- [x] Add verify-page referral footer CTA with consistent glass-card styling.
- [x] Add/update unit tests and run typecheck + targeted tests.

## Review (Low-Cost Premium UX Batch: Share + Errors + Shortcuts + Referral)

- Status: Completed
- Notes:
  - Added share packet utilities in `lib/share/social.ts`:
    - `deriveVerificationCode(proof)`
    - `buildShareBundleText({ chain, proof, verifyUrl })`
  - Extended `useReceiptShare` with:
    - `copyShareBundle()`
    - `copyFlavor` state (`url` vs `bundle`)
    - returned `verificationCode`
  - Updated `components/generator/receipt-success.tsx` with premium consistent share UX:
    - verification code card,
    - one-click "Copy Link + Code (All)" action,
    - keyboard shortcut chips,
    - unified status strip,
    - `Cmd/Ctrl + C` quick-copy shortcut for verify URL.
  - Updated `components/generator/generator-form.tsx` with guarded shortcuts:
    - `Cmd/Ctrl + V` paste tx hash when not focused in editable inputs,
    - `Cmd/Ctrl + Enter` generate receipt.
  - Upgraded actionable smart errors in `lib/generator/error-messages.ts`:
    - amount mismatch now suggests exact value correction,
    - date mismatch now includes human-readable dates,
    - added `INSUFFICIENT_CONFIRMATIONS` guidance.
  - Added premium referral CTA card in `app/verify/verify-client.tsx`.
- Validation:
  - `npm run typecheck` pass.
  - `npm test -- tests/unit/generator/error-messages.test.ts tests/unit/share/social.test.ts --runInBand --ci` pass.

## Objective (Harmonized Validation UX Across Generator + Verify)

Implement the next low-cost UX improvements with zero additional API spend:
- shared visual validation-strength badge on both generator and verifier,
- shared inline explainers/tooltips for proof meaning and hidden fields,
- shared-proof metadata support so verifier can render the same validation context.

## Plan

- [x] Add shared UI primitives for validation badges and inline explainers.
- [x] Extend share payload metadata in `lib/zk/prover.ts` to persist validation status/label.
- [x] Thread validation metadata through proof generation and verifier result types.
- [x] Apply shared UI components in `components/generator/receipt-success.tsx` and `app/verify/page.tsx`.
- [x] Add/update unit tests for metadata round-trip and verification result mapping.
- [x] Run typecheck + targeted unit tests.

## Review (Harmonized Validation UX Across Generator + Verify)

- Status: Completed
- Notes:
  - Added shared components:
    - `components/ui/validation-strength-badge.tsx`
    - `components/ui/info-tooltip.tsx`
  - Validation metadata (`oracleValidationStatus`, `oracleValidationLabel`) is now persisted inside compact proof payload metadata and round-tripped in `lib/zk/prover.ts`.
  - Generator flow now exports validation metadata with the share payload and surfaces status + label in `proofResult`.
  - Generator success and verify pages now both render the same validation-strength badge and inline explainers for claim meaning/privacy.
  - Verifier result now exposes validation status/label when present in shared payload metadata.
- Validation:
  - `npm run typecheck` pass.
  - `npm test -- tests/unit/zk/prover.test.ts tests/unit/verify/receipt-verifier.test.ts --runInBand --ci` pass.

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
- [x] Re-run quality checks (secrets/readiness/typecheck/lint/tests) and verify green.
- [ ] Commit and push only after gates are confirmed green.

## Objective (Docs Alignment: README + Diagrams + Mechanism + HTML Pages)

Align user-facing documentation with current consensus behavior across BTC/ETH/SOL and passive validation labels, covering README diagrams/mechanism text and static HTML docs pages.

## Plan

- [x] Review README architecture/API/trust/flow sections for stale strict-BTC-only language.
- [x] Update README diagrams and mechanism documentation to reflect multi-chain consensus modes and validation labels.
- [x] Update static docs pages (`faq`, `how-to-use`, `security`) with the same mechanism language and zero-friction validation-label explanation.
- [x] Run a quick validation pass and record completion notes.

## Review (Docs Alignment: README + Diagrams + Mechanism + HTML Pages)

- Status: Completed
- Notes:
  - Updated `README.md`:
    - Added explicit `Mechanism` section.
    - Updated architecture + logic-flow mermaid diagrams for multi-chain consensus behavior.
    - Aligned API/config/FAQ wording with consensus modes and passive validation labels.
  - Updated static docs pages:
    - `public/docs/how-to-use.html` (consensus step + validation label explanation + strict-mode troubleshooting note)
    - `public/docs/faq.html` (validation labels FAQ entry)
    - `public/docs/security.html` (consensus modes + passive label + updated data flow)
  - Validation:
    - `npm run check:release-readiness` pass
    - `npm run lint` pass

## Objective (Local History JSON Import + Merge)

Add a low-friction import path for exported local history JSON so users can restore or migrate receipts across browser profiles/devices without any backend sync.

## Plan

- [x] Add import parsing + validation helpers in `lib/history/receipt-history.ts` with schema-version checks.
- [x] Add dedupe-aware import execution (skip existing proof payloads, ignore invalid entries, import valid unique entries).
- [x] Wire `/history` UI with `Import JSON` action and status summary (`imported / skipped / invalid`).
- [x] Add unit tests in `tests/unit/history/receipt-history.test.ts` for import parsing/version/duplicate behavior.
- [x] Run targeted tests and typecheck.

## Review (Local History JSON Import + Merge)

- Status: Completed
- Notes:
  - Added import preview + execution APIs in `lib/history/receipt-history.ts`:
    - `previewReceiptHistoryImport(payload, existingProofs)` validates JSON envelope/schema and classifies entries.
    - `importReceiptHistoryJson(payload)` imports only valid, unique proof entries and returns summary counts.
  - Added `/history` UI import flow in `app/history/page.tsx`:
    - `Import JSON` button opens a hidden file picker.
    - Selected JSON is parsed/imported, list reloads, and user gets `imported / skipped / invalid` status message.
  - Added import-focused unit tests in `tests/unit/history/receipt-history.test.ts` for:
    - duplicate + invalid accounting,
    - unsupported schema rejection,
    - malformed JSON rejection.
  - Validation:
    - `npm test -- tests/unit/history/receipt-history.test.ts --runInBand --ci` pass.
    - `npm run typecheck` pass.

## Objective (E2E Coverage: Local History JSON Import)

Add a Playwright regression test for the `/history` JSON import flow to verify users can restore exported receipts from file input and see imported data immediately.

## Plan

- [x] Add deterministic e2e fixture JSON for import in `tests/e2e/fixtures/`.
- [x] Add a focused Playwright spec that imports the fixture on `/history`.
- [x] Assert import summary message and imported receipt card fields are rendered.
- [x] Run the targeted Playwright spec and typecheck.

## Review (E2E Coverage: Local History JSON Import)

- Status: Completed
- Notes:
  - Added e2e import fixture: `tests/e2e/fixtures/history-import-sample.json`
    - includes one valid entry and one intentionally invalid entry to verify import accounting.
  - Added Playwright regression spec: `tests/e2e/history-import.spec.ts`
    - navigates to `/history`,
    - imports fixture via file input,
    - asserts status summary (`Imported 1 receipt. Ignored 1 invalid entry.`),
    - asserts imported receipt fields (`label`, `category`, `proof`, `amount`) are rendered.
  - Validation:
    - `npm run test:e2e -- tests/e2e/history-import.spec.ts` pass.
    - `npm run typecheck` pass.

## Objective (Cost-Constrained UX Wave: Features 1-6)

Ship six high-ROI UX upgrades while keeping default API/provider usage flat so free-tier operation remains safe.

## Plan

- [x] Update roadmap with a dedicated no-extra-API UX slice for features 1-6 and explicit deferrals for higher-cost ideas.
- [x] Add smart transaction-hash detection with local chain auto-selection (no auto-submit, no background fetch).
- [x] Add local draft save/restore for generator input state.
- [x] Add smart actionable generator error messaging for common failure classes.
- [x] Add recent receipts quick panel (last 5 local entries) on the generator surface.
- [x] Add recipient-facing verification preview card on success page.
- [x] Refine native share to a prominent one-tap path with graceful unsupported fallback.
- [x] Add/update tests and run targeted verification commands.

## Review (Cost-Constrained UX Wave: Features 1-6)

- Status: Completed
- Notes:
  - Roadmap updates:
    - Added/closed `R-P2-05`..`R-P2-10` in `docs/project/ENHANCEMENT_ROADMAP.md`.
    - Marked explicit deferrals as accepted for higher-cost items (`Paste & Go`, auto-retry loops, live demo auto-calls, public gallery).
  - Smart tx hash detection:
    - Added `lib/generator/tx-hash-detection.ts`.
    - Generator now auto-detects BTC/ETH/SOL hash format and auto-selects chain locally.
    - Added inline format feedback and detection hint in generator form.
  - Draft-safe form:
    - Added `lib/generator/form-draft.ts` with load/save/clear helpers.
    - Generator now auto-restores local draft and auto-saves edits (debounced, localStorage only).
  - Smart error guidance:
    - Added `lib/generator/error-messages.ts`.
    - `use-proof-generator` now maps fetch/validation failures to actionable user-facing guidance.
  - Recent receipts quick panel:
    - Generator now shows last 5 local receipts with `Open Verify` / `Copy URL` quick actions.
  - Verification preview + native share:
    - Added recipient preview card on success screen reflecting disclosed/hidden fields.
    - Promoted one-tap native share CTA with graceful fallback text when Web Share is unavailable.
  - Test coverage:
    - Added unit tests:
      - `tests/unit/generator/tx-hash-detection.test.ts`
      - `tests/unit/generator/form-draft.test.ts`
      - `tests/unit/generator/error-messages.test.ts`
    - Added e2e coverage:
      - `tests/e2e/recent-receipts-panel.spec.ts`
      - Updated `tests/e2e/generator.spec.ts` with chain auto-detection scenario.
  - Validation:
    - `npm test -- tests/unit/generator/tx-hash-detection.test.ts tests/unit/generator/form-draft.test.ts tests/unit/generator/error-messages.test.ts tests/unit/history/receipt-history.test.ts --runInBand --ci` pass.
    - `npm run test:e2e -- tests/e2e/history-import.spec.ts tests/e2e/recent-receipts-panel.spec.ts` pass.
    - `npm run test:e2e -- tests/e2e/generator.spec.ts --grep "auto-detect chain from tx hash format"` pass.
    - `npm run typecheck` pass.

## Objective (Env-Backed Endpoint Registry + Startup Config Validation)

Eliminate URL literals from provider/config TS endpoint registries, make endpoint config env-backed and reusable, and fail fast with precise missing-config diagnostics at app/API load.

## Plan

- [x] Move provider/public endpoint URL values from TS literals to env-backed endpoint registry keys in config.
- [x] Keep endpoint-name selection flow and strict name resolution while requiring resolved URLs to exist.
- [x] Add runtime startup validation that reports exact missing/invalid config keys.
- [x] Run typecheck and targeted provider/API route tests.

## Review (Env-Backed Endpoint Registry + Startup Config Validation)

- Status: Completed
- Notes:
  - `lib/config/public-rpc-endpoints.ts` now resolves endpoint URLs from env keys only (`*_URL` variables), with no URL literals.
  - All provider modules now consume env-backed endpoint maps and fail fast when endpoint URL config is missing/invalid.
  - Added runtime config validator `lib/config/runtime-config.ts` and wired checks at app/API load:
    - `app/layout.tsx`
    - `app/api/oracle/fetch-tx/route.ts`
    - `app/api/oracle/verify-signature/route.ts`
    - `app/api/oracle/check-nullifier/route.ts`
  - Updated `.env.example` with endpoint registry URL env vars and strict startup validation toggle.
  - Updated `jest.setup.js` to seed endpoint env vars for deterministic test execution.
  - Validation:
    - `npm run typecheck` pass.
    - `npm test -- tests/unit/providers/mempool.test.ts tests/unit/providers/ethereum-public-rpc.test.ts tests/unit/providers/solana-public-rpc.test.ts tests/unit/providers/ssrf-enforcement.test.ts tests/unit/api/fetch-tx-route.test.ts tests/unit/api/oracle-verify-signature-route.test.ts tests/unit/api/oracle-check-nullifier-route.test.ts --runInBand --ci` pass.
