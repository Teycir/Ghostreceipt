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
