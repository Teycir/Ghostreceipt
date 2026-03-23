# GhostReceipt Roadmap (Start to Finish)

This roadmap is execution-first and checkbox-driven so progress is visible at every step.

## Phase 0: Project Setup and Governance
- [ ] Confirm product scope for v1 (BTC + ETH first, Monero as separate track)
- [ ] Finalize architecture decisions from `PLAN.md`
- [ ] Define coding standards and contribution workflow
- [ ] Create `THIRD_PARTY_NOTICES.md` for reusable code attribution
- [ ] Add `LICENSE` and standard repo metadata files
- [ ] Create issue templates and PR template
- [ ] Add CI baseline (`typecheck`, `lint`, `tests`)
- [ ] Add environment templates (`.env.example`, `.env.local.example`)
- [ ] Verify local onboarding works with no credit card and no BYOK

## Phase 1: App Skeleton and Shared Foundations
- [ ] Initialize Next.js + TypeScript + Tailwind app structure
- [ ] Create app shell routes:
- [ ] ` /` (generator), `/verify`, static docs pages in `public/*.html`
- [ ] Add global styles and design tokens
- [ ] Add shared UI primitives (buttons, inputs, toasts, cards)
- [ ] Add shared utility modules:
- [ ] URL state encoding/decoding
- [ ] Clipboard helpers
- [ ] QR generation helper
- [ ] Text animation helper
- [ ] Add error boundary and fallback UI
- [ ] Add analytics and logging interfaces (no vendor lock-in)

## Phase 2: Oracle API and Data Normalization
- [ ] Implement `POST /api/oracle/fetch-tx` endpoint
- [ ] Add strict input validation (Zod)
- [ ] Implement chain adapters:
- [ ] BTC adapter (mempool.space primary, Blockchair fallback)
- [ ] ETH adapter (API-first Etherscan cascade, RPC last fallback)
- [ ] Define and enforce canonical response schema
- [ ] Add deterministic message hashing for oracle payload
- [ ] Add oracle signing flow (server-side secret only)
- [ ] Add structured error taxonomy:
- [ ] `INVALID_HASH`, `UNSUPPORTED_CHAIN`, `PROVIDER_TIMEOUT`, `PROVIDER_ERROR`, `NORMALIZATION_ERROR`
- [ ] Add idempotency key support
- [ ] Add short-TTL cache for repeated tx lookups

## Phase 3: Provider Cascade and Reliability Layer
- [ ] Implement provider/key cascade manager
- [ ] Add immediate rotate-on-failure behavior
- [ ] Add small inter-attempt delay (~50ms)
- [ ] Add shuffled managed-key order on startup
- [ ] Add bounded per-provider concurrency guard (semaphore style)
- [ ] Add retry budgets and backoff guardrails
- [ ] Add circuit-breaker behavior for repeatedly failing upstreams
- [ ] Ensure optional BYOK never blocks no-key default flow
- [ ] Surface transparent status to UI (degraded mode messaging)

## Phase 4: ZK Circuit and Proof Engine
- [ ] Create `receipt.circom` circuit
- [ ] Implement constraints:
- [ ] Oracle signature validity
- [ ] `realValue >= claimedAmount`
- [ ] `realTimestamp >= minDate`
- [ ] Generate and store proving artifacts (`.wasm`, `.zkey`, verification key)
- [ ] Implement witness input builder in app code
- [ ] Integrate `snarkjs` full prove and verify utilities
- [ ] Add deterministic test vectors (valid/invalid)
- [ ] Add proof serialization format for share links

## Phase 3: Generator UX (Zero Friction)
- [x] Build primary generator form (chain, txHash, claimedAmount, minDate)
- [x] Add inline validation with immediate feedback
- [x] Add progress states:
- [x] Fetching transaction
- [x] Validating oracle data
- [x] Generating proof
- [ ] Packaging receipt
- [x] Add recoverable error messages with one-click retry
- [ ] Add "advanced settings" collapse (off by default)
- [ ] Add copy link + QR creation for proof payload
- [ ] Verify mobile-first flow completes in <= 60s target

## Phase 6: Verify UX and Receipt Rendering
- [ ] Build `/verify` page parser for shared payload
- [ ] Validate proof and public signals
- [ ] Show valid state with amount + date + receipt metadata
- [ ] Show invalid/counterfeit state with safe reason bucket
- [ ] Add redaction visuals for sender/receiver/tx hash
- [ ] Add compact "trust at a glance" summary card
- [ ] Add static export/print-friendly receipt style

## Phase 7: Footer + Static Docs System
- [ ] Implement shared footer component
- [ ] Add social share links + source + creator links
- [ ] Create static docs pages in `public/`:
- [ ] `how-to-use.html`
- [ ] `faq.html`
- [ ] `security.html`
- [ ] `canary.html`
- [ ] `license.html`
- [ ] Wire footer links to static pages
- [ ] Check docs readability on mobile

## Phase 8: Security Hardening
- [ ] Add API rate limiting (IP + fingerprint hints)
- [ ] Add SSRF protections for all remote fetch paths
- [ ] Add anti-replay protection for oracle signatures
- [ ] Add payload expiry checks
- [ ] Add CSP and security headers
- [ ] Add dependency audit checks in CI
- [ ] Verify no sensitive data is logged
- [ ] Run threat-model review and document mitigations
- [ ] Publish a consumer-facing trust assumptions + oracle compromise response document

## Phase 9: Testing and Quality Gates
- [ ] Ensure all tests are in `tests/` only
- [ ] Add unit tests:
- [ ] normalization adapters
- [ ] hash/sign payload
- [ ] cascade manager behavior
- [ ] URL state and QR helpers
- [ ] Add integration tests:
- [ ] oracle endpoint happy/fallback paths
- [ ] proof generation + verification pipeline
- [ ] Add E2E tests:
- [ ] happy path generate + verify
- [ ] invalid tx hash and degraded provider modes
- [ ] mobile viewport flows
- [ ] Add coverage thresholds and enforce in CI

## Phase 10: Performance and UX Polish
- [ ] Profile API p95 and optimize bottlenecks
- [ ] Profile proof generation UX and improve perceived speed
- [ ] Add skeleton/loading polish and microcopy cleanup
- [ ] Validate accessibility basics (keyboard + contrast + ARIA)
- [ ] Tune bundle size and route-level loading
- [ ] Validate installability/PWA behavior (optional)

## Phase 11: Launch Readiness
- [ ] Finalize README and docs links
- [ ] Prepare production env and secret rotation runbook
- [ ] Create release checklist and rollback checklist
- [ ] Smoke test staging end-to-end
- [ ] Publish v1.0.0 release notes
- [ ] Monitor first-week metrics and error budget

## Phase 12: Post-Launch and Expansion
- [ ] Add Monero flow track with separate circuit path
- [ ] Add additional chains as adapters
- [ ] Improve proof compression and share size
- [ ] Add optional account features (still no-login default)
- [ ] Add observability dashboards and SLA alerts
- [ ] Design and prototype multi-oracle attestation/quorum path to reduce single-operator trust
- [ ] Evaluate TLS-notary/light-client approaches for trust-minimized transaction attestation

## Definition of Done (Global)
- [ ] No-credit-card local setup documented and verified
- [ ] No-API-key user journey verified in staging and production
- [ ] Security checks pass and critical issues resolved
- [ ] Tests pass in CI with required thresholds
- [ ] Staff-level review checklist completed
