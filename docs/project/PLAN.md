# GhostReceipt Plan (2026 Refresh)

## 1) Product Goal
GhostReceipt lets a user prove a payment claim (amount + time window) from on-chain data without revealing sender, receiver, or tx hash.

Core promise: **generate and share a verifiable receipt in under 60 seconds with near-zero UX friction**.

## 2) Non-Negotiable UX Principles (Zero Friction)
- One primary CTA on home: `Paste transaction hash`.
- No required signup to generate a receipt.
- Progressive disclosure only: show advanced fields only when needed.
- Fast perceived performance:
  - Tx fetch response starts in < 1.5s (p95 where feasible).
  - First proof attempt guided with live validation and clear recovery paths.
- Human copy over crypto jargon.
- One-click share and one-click verify links.
- Never dead-end the user: every error has a direct next action.
- Mobile-first completion flow (thumb-friendly inputs, sticky action button).

## 2.1) Hard Constraint: No Credit Card Required
- The project must be buildable, testable, and deployable without entering a credit card.
- Every external dependency must have one of:
  - a free no-card tier, or
  - a self-host/local fallback used by default.
- If a service later requires card verification, it is optional and cannot block core flows.
- Local development must work fully with `.env.example` and free/public RPC/data sources.

## 2.2) Hard Constraint: No Forced User API Keys
- Users must be able to generate and verify receipts without bringing any API key.
- BYOK is optional advanced mode only; never required for the happy path.
- System default is managed free/public providers with automatic provider/key cascade.

## 3) Updated Tech Stack (Latest + Practical)
### 3.1) API Types We Use (and Why)
GhostReceipt intentionally uses multiple API categories so users are never blocked by signup, card requirements, or a single provider outage.

Type A: Public no-key read APIs (default happy path)
- BTC: `mempool.space` first.
- ETH: Etherscan API first with rolling server-side key cascade; public RPC as final fallback.
- Reason: zero-friction onboarding and no forced API key flow.

Type B: Managed keyed third-party APIs (fallback path)
- For ETH, managed keyed fallback uses only Etherscan keys provided by project maintainers.
- Keys are owned by GhostReceipt and stored server-side only (`.env.local` in dev, runtime secrets in deploy).
- Multiple managed keys are used in a cascade manager (rotate on error/rate limit, then retry) following the smartcontractpatternfinder strategy.
- Reason: improve reliability while keeping users keyless by default.

Type C: First-party internal Oracle API (trust boundary)
- Endpoint family like `POST /api/oracle/fetch-tx`.
- Validates inputs, fetches upstream data, normalizes canonical fields, signs payload.
- Reason: isolate provider differences and feed deterministic data into proof generation.

Type D: Optional BYOK APIs (advanced mode only)
- User can add personal key(s) as a priority provider.
- This mode is opt-in and never required for generating or verifying receipts.
- Reason: power-user throughput boost without harming baseline UX.

Current key provisioning policy:
- ETH keyed provider pool: Etherscan only (project-maintained keys already supplied).
- Non-ETH keyed provider pools: same cascade design, keys to be added later; until then use public/free providers plus provider fallback.

Operational guardrails for all API types:
- Never expose provider keys in client bundles.
- Never require a credit card for core user flows.
- Never force user key entry for the happy path.
- Always provide bounded concurrency + immediate provider/key failover.

### Frontend
- **Next.js 16.2+** (App Router, Server Components where useful).
- **React 19 + TypeScript**.
- **Tailwind CSS + shadcn/ui** for fast, accessible UI primitives.
- **TanStack Query** for resilient async state and retries.
- **Zod + React Hook Form** for strict input validation and inline feedback.

### Edge / Backend
- **Cloudflare Workers** for Oracle/API runtime (optional deploy target).
- **Node/Next API fallback runtime** for local-first and no-card operation.
- **In-memory or file cache in dev**, KV/Durable Objects only when available.
- **Cloudflare R2** only as optional enhancement (never required for core flow).

### Chain Data
- Multi-provider strategy from day 1 (avoid single API dependency):
  - BTC: mempool.space first, Blockchair fallback.
  - ETH: Etherscan API first with rolling key cascade; public RPC is the last fallback attempt.
- Provider Cascade Policy (based on smartcontractpatternfinder pattern):
  - Immediate failover to next provider/key on any request error or rate-limit response.
  - Shuffle managed keys at startup to distribute load and avoid hot-spotting.
  - Keep small rotation delay between attempts (e.g., ~50ms) to reduce burst collisions.
  - Use bounded concurrency (semaphore-style) per upstream to stay within free-tier limits.
  - Optional user-provided key can be appended at highest priority, but absence never blocks usage.
  - Apply the same cascade semantics for non-ETH providers; add provider-specific keys later without changing API contracts.
- Normalize into one canonical schema before signing.

### ZK Stack
- **Circom 2** + **snarkjs** (stable production path).
- Keep circuit modular so we can optionally evaluate **Noir/Barretenberg** in a later optimization track.
- Server Oracle signs canonical tx facts used by proof generation.

### Security / Observability
- Oracle key management via Worker secrets; no keys in client bundle.
- Console + structured JSON logs by default.
- **Cloudflare Workers Observability/Tracing** when deployed there.
- Sentry is optional and must not be required for core operation.

## 4) High-Level Architecture
1. User submits `{chain, txHash, claimedAmount, minDate}`.
2. Edge Oracle fetches tx data from provider A; falls back to provider B.
3. Oracle normalizes and signs canonical message digest.
4. Client receives signed payload and generates zk proof locally.
5. Client creates compact share payload (proof + public signals + metadata).
6. Verifier page validates proof and renders receipt UX.

## 5) Canonical Data Contract (Versioned)
Define `ReceiptOraclePayloadV1`:
- `chain`
- `txHash` (can be excluded from final share payload)
- `valueAtomic`
- `timestampUnix`
- `confirmations`
- `messageHash`
- `oracleSignature`
- `oraclePubKeyId`
- `schemaVersion`

Rules:
- Sign only canonical, deterministic fields.
- Version payload schema from the start.
- Reject provider responses that cannot be normalized losslessly.

## 6) Implementation Phases

## Phase 0: Foundation and Reliability
### Deliverables
- Monorepo/app baseline with strict TypeScript and linting.
- Environment matrix (`dev`, `staging`, `prod`) and secret handling.
- CI with build + typecheck + tests.
- `No-Card Mode` documented and enabled by default for local/dev.

### Acceptance
- Clean CI on pull requests.
- No secrets committed.
- Fresh developer setup works end-to-end with no paid accounts.

## Phase 1: Oracle API (Fast + Correct)
### Deliverables
- `POST /api/oracle/fetch-tx` (edge) with:
  - input validation (Zod),
  - provider fallback,
  - provider/key cascade manager (immediate rotate-on-failure),
  - canonical normalization,
  - oracle signing,
  - idempotency key support.
- KV caching (short TTL) for repeated tx lookups.
- Structured error taxonomy (`INVALID_HASH`, `UNSUPPORTED_CHAIN`, `PROVIDER_TIMEOUT`, etc.).

### Acceptance
- BTC + ETH happy paths verified.
- Fallback provider proven via integration tests.
- No-API-key user flow works end-to-end in local and production defaults.
- p95 response target tracked in logs.

## Phase 2: ZK Circuit and Proof Pipeline
### Deliverables
- `receipt.circom` supporting:
  - oracle signature validity,
  - `realValue >= claimedAmount`,
  - `realTimestamp >= minDate`.
- Deterministic witness input builder in app code.
- Proof generation module with robust failure handling.

### Acceptance
- Known-valid vectors pass proof + verification.
- Known-invalid vectors fail deterministically.

## Phase 3: Zero-Friction Generator UX
### Deliverables
- Single-flow generator page with:
  - chain selector,
  - tx hash input,
  - claim amount,
  - optional advanced settings collapsed by default.
- Real-time validation, optimistic progress states, and retry UX.
- Copy link + QR code for share payload.

### Acceptance
- New user can complete flow in <= 60s on mobile.
- All API/proof errors map to actionable UI messages.

## Phase 4: Verify Experience (Trust at a Glance)
### Deliverables
- `/verify` route that decodes payload and verifies proof.
- Valid state: concise “Verified Receipt” with claim facts.
- Invalid state: explicit “Receipt Invalid / Counterfeit” with reason bucket.
- Redaction visuals with accessible alternatives.

### Acceptance
- Verifier works offline after payload load (where feasible).
- Share link is deterministic and tamper-evident.

## Phase 5: Monero Track (Explicit Scope)
Monero is a separate track due to hidden amounts.

### Deliverables
- UX path requiring user-provided view key/tx key material when needed.
- Oracle signs existence/time facts only.
- Separate circuit path for Monero constraints.

### Acceptance
- Monero flow does not degrade BTC/ETH path simplicity.
- Clear user messaging about what can/cannot be proven.

## 7) Security and Abuse Controls
- Rate limits by IP + fingerprint hints (via Durable Objects coordination).
- Anti-replay nonce/timestamp windows on oracle signatures.
- Signed payload expiry.
- Strict CSP and dependency auditing.
- No PII in logs.

## 8) Testing Strategy
All tests live in `tests/` (never inline in production files).

- Unit tests:
  - normalization logic,
  - payload hashing/signing,
  - witness builder.
- Integration tests:
  - oracle provider fallback,
  - end-to-end proof generation and verify path.
- UX tests:
  - mobile happy path,
  - critical error recovery journey.

## 9) Metrics for “0 Friction”
- Time-to-first-successful-receipt (median and p95).
- Generator drop-off by step.
- Proof failure rate (by reason).
- Verification success rate from shared links.
- Support/error events per 1,000 sessions.

## 10) Suggested Build Order (Execution)
1. Phase 0 + Phase 1 skeleton.
2. Circuit + witness pipeline (Phase 2).
3. Generator UX (Phase 3).
4. Verify UX and share format hardening (Phase 4).
5. Monero specialized path (Phase 5).

## 11) Source Signals Used (via Exa)
- Next.js 16.2 release notes: https://nextjs.org/blog/next-16-2
- Next.js release archive: https://nextjs.org/blog
- Cloudflare Workers Observability: https://developers.cloudflare.com/workers/observability/
- Cloudflare Workers Tracing: https://developers.cloudflare.com/workers/observability/traces/
- Durable Objects best practices: https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/
- EIP-6963 (wallet provider discovery): https://eips.ethereum.org/EIPS/eip-6963
- EIP-4337 (account abstraction): https://eips.ethereum.org/EIPS/eip-4337
- Circom 2 docs: https://docs.circom.io/
- Noir browser app tutorial: https://noir-lang.org/docs/tutorials/noirjs_app
- TanStack Query docs: https://tanstack.com/query/latest/docs/framework/react

## 12) Reuse Map from Existing Repos
This section identifies what to reuse from:
- `https://github.com/Teycir/xmrproof`
- `https://github.com/Teycir/Timeseal`
- `https://github.com/Teycir/Sanctum`
- `https://github.com/Teycir/smartcontractpatternfinder`

### A) Copy First (High ROI, Low Refactor)
- Text scramble + reveal animation core:
  - `xmrproof/src/lib/textAnimation.ts`
  - `xmrproof/src/hooks/useTextScramble.ts`
  - `Sanctum/lib/ui/textAnimation.ts` (includes reveal helper extension)
  - `Sanctum/lib/ui/hooks.ts`
- QR generation utility for shareable receipt links:
  - `Timeseal/lib/qrcode.ts`
  - `Sanctum/lib/shared/qrcode.ts`
- URL state encode/decode pattern for compact share payloads:
  - `Sanctum/lib/url/state.ts`
- Clipboard UX helpers:
  - `xmrproof/src/lib/clipboard-utils.ts`
  - `Sanctum/lib/hooks/useSecureClipboard.ts` (auto-clear behavior)
- Footer baseline (same footer pattern across projects):
  - `xmrproof/src/components/Footer.tsx` as the base implementation for GhostReceipt.
  - Keep social share actions + source/creator links, and skin with GhostReceipt theme tokens.
- Static footer-linked docs pages (same simple system as Sanctum):
  - Use static files under `public/` for non-app docs content.
  - Initial pages: `how-to-use.html`, `faq.html`, `security.html`, `canary.html`, `license.html`.
  - Footer links should target these static pages first to avoid App Router overhead for informational content.
- API hardening pattern (method allowlist, SSRF checks, fallback nodes):
  - `xmrproof/src/app/api/rpc/route.ts`
- API cascade/key rotation pattern (no forced BYOK, immediate failover):
  - `smartcontractpatternfinder/crates/scpf-core/src/fetcher.rs`
  - `smartcontractpatternfinder/crates/scpf-cli/src/keys.rs`
  - `smartcontractpatternfinder/crates/scpf-types/src/api_key_config.rs`

### B) Reuse with Adaptation (Medium ROI)
- Success/result UX pattern for verification receipts:
  - `Timeseal/app/components/SealSuccess.tsx`
  - Adapt to GhostReceipt proof object (`proof`, `publicSignals`, `verifyLink`).
- Loading/progress overlays for proof generation:
  - `Sanctum/app/components/LoadingOverlay.tsx`
  - `Timeseal/app/components/EncryptionProgress.tsx`
- Mobile and interaction UX primitives:
  - `Timeseal/app/components/BottomSheet.tsx`
  - `Timeseal/app/components/CommandPalette.tsx`
  - `Timeseal/lib/mobile.ts` (haptics/share/copy helpers)
- Validation/middleware scaffolding:
  - `Timeseal/lib/schemas.ts`
  - `Timeseal/lib/http.ts`
  - `Timeseal/lib/middleware.ts`
  - `Timeseal/lib/rateLimit.ts`

### C) Keep as Inspiration, Don’t Copy Directly
- Large domain-specific flows:
  - `Timeseal/app/components/CreateSealForm.tsx`
  - `Sanctum/app/create/page.tsx`
- Monero-only verification internals:
  - `xmrproof/src/lib/verify.ts`
  - `xmrproof/src/lib/monero-utils.ts`
  - Useful patterns, but GhostReceipt must remain multi-chain and proof-centric.

### D) License/Compliance Gate Before Copy
- `xmrproof` license: MIT (safe to reuse with attribution notice kept).
- `smartcontractpatternfinder` license: MIT (safe to reuse with attribution notice kept).
- `Timeseal` and `Sanctum` licenses: Business Source License 1.1.
- If we reuse footer code from Timeseal/Sanctum variants, confirm BSL terms for production use first.
- Action: keep a `THIRD_PARTY_NOTICES.md` and confirm reuse scope is allowed for GhostReceipt’s deployment model before shipping production.

### E) Execution Plan for Reuse
1. Create `src/shared/reuse/` in GhostReceipt and import copy-first utilities.
2. Build a minimal `ReceiptSuccess` component using Timeseal/Sanctum patterns.
3. Add shared footer component and static docs pages in `public/` (`how-to-use`, `faq`, `security`, `canary`, `license`).
4. Add API hardening baseline from xmrproof proxy route patterns.
5. Add provider cascade manager inspired by smartcontractpatternfinder (shuffle keys, immediate rotate-on-error, bounded concurrency).
6. Add tests in `tests/` for:
   - URL state encode/decode,
   - QR generation,
   - clipboard safety behavior,
   - API allowlist/rate-limit behavior,
   - provider cascade behavior when key/provider N fails.
