# Lessons Learned

## 2026-03-26 - Cloudflare Functions Must Avoid Barrel Imports With Global-Scope Side Effects
- In Cloudflare Pages Functions, importing broad backend barrels can accidentally execute timer/random/network setup at module scope and break deploy with "Disallowed operation called within global scope".
- For functions-facing modules, import only the minimal side-effect-free submodule needed (for example `.../share-pointer-storage`) rather than `.../http` barrel exports.
- Treat "global scope disallowed operation" as a deploy-time architecture issue, not just a runtime bug.

## 2026-03-26 - Next.js 16 Requires `viewport` Export, Not `metadata.viewport`
- In App Router, declaring `viewport` inside `export const metadata` triggers build warnings for every route.
- Define viewport in `export const viewport` (typed as `Viewport`) at layout/page level instead.
- Treat metadata-shape warnings as CI blockers when the goal is a warning-free build output.

## 2026-03-26 - Static Export Rejects New GET App Routes Without Export-Static Compatibility
- With `output: 'export'`, adding a new GET App Router API route can fail build-time page-data collection even if the route is only meant for runtime use.
- Prefer POST endpoints for runtime-only APIs in static-export projects, matching the existing Cloudflare Functions pattern.
- Avoid dynamic App API route segments (`[id]`) for export builds; use non-dynamic route paths plus body/query validation.

## 2026-03-26 - QR Scan Success Requires Compact URL Payloads, Not Only Visual Contrast
- Even with scanner-safe black/white styling, embedding very long query payloads can produce QR density that camera scanners fail to decode silently.
- For shareable verify flows, prefer short pointer-based URLs (for example `sid`) and resolve payload server-side.
- Keep backward compatibility for existing long links during rollout (`proof` query still supported).

## 2026-03-26 - Scanner Reliability Beats Theme Styling For QR Codes
- When a user reports scanner/Lens failures, treat visual theming as secondary and enforce classic QR defaults first (black modules on white background, adequate quiet zone).
- Do not rely on generation success alone as proof of usability; optimize rendered size and contrast for real camera decoding.
- Prefer a readability-first error-correction order for on-screen QR use (`M/L` before higher-density levels), while keeping fallback attempts for hard payload limits.

## 2026-03-25 - Static Export Cannot Use Next Middleware Or next.config headers()
- When `output: 'export'` is enabled, remove `middleware.ts`; it cannot execute in static-export mode and will emit build/runtime warnings.
- Do not rely on `next.config.*` `headers()` for static export; serve security headers from hosting/static config (for this project: `public/_headers`).
- Keep static-export warning cleanup as part of CI hardening so failures are not hidden behind unrelated TypeScript errors.

## 2026-03-25 - Client Failover Paths Must Emit Warning Signals Before Backup Retry
- Do not silently continue to backup endpoint in client failover helpers; emit at least a warning with endpoint and failure reason/status.
- Cover both failover triggers in tests: response-based failover (`404/405/5xx`) and thrown transport errors.
- Keep logs payload-safe: include endpoint/status/error message only, never request body contents.

## 2026-03-25 - Cloudflare Runtime Fixes Should Be Extracted Into Reusable Backend Modules
- When hardening Cloudflare Pages handlers, do not leave complex logic inside `functions/*` entry files; extract runtime logic into reusable backend-core modules.
- Keep `functions/*` as thin route adapters so the same implementation can be reused by other projects and deployment targets.
- For Workers compatibility, avoid global-scope timers/random/network side effects in shared modules; prefer lazy/no-timer in-memory primitives.

## 2026-03-25 - Never Swallow Catch Errors In Security-Critical Paths
- In limiter/replay/security paths, catch blocks must either rethrow with explicit context or log structured details before fallback.
- Empty `catch {}` blocks in backend control-plane logic are not acceptable because they hide operational root causes.
- Validate env-driven endpoints (for example durable backend URLs) at startup/path creation and log invalid config once before falling back.

## 2026-03-25 - Stability Must Gate Infra Upgrades Even When Performance Looks Better
- When deciding between new infra complexity and performance gains, choose the path with the safest rollback and lowest latent risk by default.
- Keep new distributed rate-limit backends deferred until local + staging behavior is proven under failure scenarios.
- Preserve edge-level protections as the permanent outer wall while experimenting with inner backend changes.

## 2026-03-25 - When User Splits A Batch, Ship Only The Chosen Slice
- If the user says "do 1 now, test 2 later," treat that as a hard scope boundary and only implement item 1 end-to-end.
- Explicitly mark item 2 as deferred in roadmap/todo so there is no ambiguity on delivery status.
- Prefer rollback-safe operational changes (runbooks/checklists/toggles) before introducing new runtime complexity.

## 2026-03-25 - Preserve SEO Metadata By Keeping It In Server Page Wrappers
- If a user requests SEO metadata on App Router pages, do not remove metadata; move it to a server `page.tsx` wrapper when the page needs client interactivity.
- Never export `metadata` from files marked with `'use client'`; split into `*-client.tsx` + server wrapper to keep both SEO and runtime compatibility.
- Validate with `next build` (outside sandbox if needed) because `tsc` alone does not catch this App Router constraint.

## 2026-03-25 - Preserve User-Provided Real Local Test Data Unless Explicitly Asked
- If the user provides real live-test values (for example `ORACLE_PRIVATE_KEY`, live tx hashes/signatures), keep them intact in local runtime files such as `.env.local`.
- Do not remove or redact user-provided real local test data unless the user explicitly requests removal/rotation.
- If redaction is required for tracked docs/CI safety, only redact documentation copies and preserve the real values in local env runtime config.

## 2026-03-25 - Add Endpoint Lists Inside Providers When User Forbids Cascade Refactors
- If user says “do not touch what works” in cascade ordering, keep `ProviderCascade` topology unchanged and add fallback lists inside the public-provider implementation instead.
- Endpoint failover order must be deterministic (env list order), not random, and backward-compatible with existing single-URL env vars.
- For asset-specific Ethereum paths, keep separate endpoint-list controls (`ETHEREUM_USDC_PUBLIC_RPC_URLS`) so USDC reliability tuning does not impact native ETH defaults.

## 2026-03-25 - Strict Signature Verification Depends On Transparency Log, Not Just Private Key
- In live strict flows, setting `ORACLE_PRIVATE_KEY` alone is insufficient; `/api/oracle/verify-signature` also checks key validity windows against `config/oracle/transparency-log.json`.
- When rotating/introducing a signing key for strict validation, register the derived public key/keyId in transparency log with a valid hash-chain entry.
- If tests fail with `KEY_UNKNOWN`, inspect transparency-log membership before debugging signer code.

## 2026-03-25 - ETH Strict Consensus Reliability Depends On Public RPC Capability
- ETH strict consensus can fail even when Etherscan succeeds if the configured public RPC endpoint cannot serve historical tx/block lookups.
- For strict multi-provider parity, verify candidate tx hashes against both providers (primary + consensus peer) before locking test inputs.
- Public RPC consensus provider must match asset mode behavior (`native` and `usdc`) or strict asset-specific tests will fail by design.

## 2026-03-25 - Strict Live Tests Must Enforce Production Parity, Not Convenience
- If the user asks for zero fallback/zero synthetic behavior, live integration tests must not use fixture candidate lists or dynamic fallback discovery.
- Do not inject synthetic `ORACLE_PRIVATE_KEY` in strict live suites; require real env-provided signing keys and fail fast when missing.
- For consensus validation under strict policy, force chain consensus modes to `strict` and assert `oracleValidationStatus === "consensus_verified"` only.

## 2026-03-25 - Jest Must Hydrate Local Provider Keys For Realistic Test Runs
- In `NODE_ENV=test`, local env files may not be loaded as expected, so provider key tests/live-gated tests can fail with misleading missing-key errors.
- Add key-scoped hydration in `jest.setup.js` from local env files, and never overwrite already-set CI/runtime env values.
- Restrict automatic hydration to provider key vars only to avoid broad test-side effects.

## 2026-03-25 - Fixed Env Key-Loader Ceilings Can Masquerade As Rate-Limit Bugs
- Do not hard-code provider key discovery to a fixed suffix window (for example `_1.._6`) when runtime/config scripts support larger pools.
- Load numeric-suffixed keys dynamically (`_1..N`) and sort by numeric suffix for deterministic ordering.
- When users report “keys work elsewhere,” verify both key classification logic and whether the application is silently dropping part of the key pool.

## 2026-03-25 - Fresh Key Exhaustion Often Means Misclassified Errors, Not Real Quota Burn
- Do not rotate through all API keys for generic transport/upstream failures (`fetch failed`, `HTTP 5xx`, unknown provider outage); treat these as key-agnostic failures and stop key spray.
- Reserve key rotation for key-specific signals only: auth/key errors, explicit quota/rate-limit errors (`401/403/429`, invalid key/token, quota exceeded).
- Keep provider logs truthful: only emit "trying next key" when the classifier actually allows moving to the next key.

## 2026-03-25 - UX Transparency Should Be Passive, Not Interactive, When User Requests Zero Friction
- When the user asks for additional trust/validation visibility without friction, surface it as passive data labels in existing UI surfaces.
- Do not add new buttons, toggles, checkboxes, or extra user actions for transparency metadata unless explicitly requested.
- Keep the source-of-truth in backend payload fields first, then render them read-only in existing success/summary components.

## 2026-03-25 - BTC Primary Order And Spike Controls Must Follow User Reliability Policy
- If the user says a provider key pool must be primary (for example BlockCypher), enforce that in cascade priority/order, not just env loading.
- When the same user asks for conservative spike behavior, avoid retry/key-spray amplification on provider `429`; fail over quickly to the public fallback path.
- After reordering providers, immediately realign route/unit tests and documentation so they describe and verify the same runtime topology.

## 2026-03-25 - Do Not Assume Optional Paid BTC Fallback Is Acceptable For Zero-Budget Scope
- If the user states a provider is not truly free-tier or they do not have that API key (for example Blockchair), remove it from the active default runtime path rather than treating it as acceptable fallback capacity.
- Keep Bitcoin fallback topology aligned with real public/free endpoints in the live cascade and keep docs/env templates consistent with that runtime behavior.
- When a user corrects pricing/access assumptions, immediately convert that correction into explicit roadmap and implementation updates (not just narrative acknowledgement).

## 2026-03-25 - Verify Free-Tier Claims Before Replacing Providers
- Do not swap in a provider based on assumption; first gather evidence from source docs (for example via Exa + provider pricing pages) that free-tier access is explicit.
- If the user rejects a candidate as non-free-tier (for example blockstream), pivot immediately and re-align implementation, tests, and docs to the confirmed free-tier provider.
- For provider changes, preserve strict fallback behavior and rerun targeted route/provider tests before sign-off.

## 2026-03-25 - Avoid Hardcoding Default Artifact Version In Tests
- Tests for artifact-version fallback should not assert a literal date/version string that is expected to change during normal circuit artifact refreshes.
- Derive expected fallback behavior dynamically (for example baseline with env unset) so version bumps do not cause false CI failures.

## 2026-03-25 - Cloud Secrets And Local Live Tests Need Separate Env Hydration
- Cloudflare Pages secrets do not automatically populate local Jest `process.env`; local live integration runs must source local env values explicitly.
- In `NODE_ENV=test`, Next excludes `.env.local` by design, so live integration tests should include an explicit `.env.local` loader helper for local runs.
- Keep secret verification output redacted when confirming key presence in tooling/logs.

## 2026-03-25 - Real-Data Chain Requests Need Dedicated Per-Chain E2E Tests
- When the user asks for real-data end-to-end validation on a specific chain (for example Solana), add a dedicated chain-specific live integration test rather than relying only on multi-chain umbrella suites.
- Keep the live test explicitly gated by `LIVE_INTEGRATION=1`, require provider keys up front, and fail fast with a clear missing-key error.
- Ensure the live path asserts full pipeline integrity: fetch/signature, commitment recomputation, witness validity, Groth16 prove/verify, and signature verification route.

## 2026-03-25 - Backend-Ready Chains Must Not Stay UI-Disabled
- If backend fetch/sign support is already shipped for a chain (for example Solana via Helius), do not leave the chain marked "coming soon" in the primary generator dropdown.
- Before marking a chain operational, verify the full path: UI validation, witness mapping, circuit `chainId` constraint, and regenerated proving artifacts.
- Keep chain-ID semantics synchronized across oracle commitment logic, witness builder, and circuit constraints to avoid proof-generation mismatches.

## 2026-03-25 - New Option Discovery Must Be In The Primary Dropdown
- If a user expects a new option in an existing dropdown, avoid hiding it behind a second conditional selector on first rollout.
- Prefer a single explicit primary dropdown entry (for example `Ethereum (USDC)`) when feature discoverability is the user's immediate goal.
- Reset dependent inputs (hash/amount) when chain-asset mode changes to prevent stale values crossing unit contexts.
- If a requested chain is not yet circuit-capable (for example Solana prove path), keep it visible but disabled with a clear "coming soon" label instead of silently omitting it.

## 2026-03-25 - Stablecoin Expansion Should Reuse Existing Stable Provider Track
- When users request stablecoin coverage with free-tier constraints, prefer extending existing stable providers (for example Etherscan ERC-20 on Ethereum) instead of adding new infra-heavy chains.
- Keep chain semantics stable by adding asset-mode selection (for example `native` vs `usdc`) rather than forcing a new chain identifier.
- If Monero/provider stability is uncertain, explicitly defer Monero integration and ship only the proven stable API path.

## 2026-03-25 - Receipt History CTA Must Be In-Flow On Home Screen
- If users report the history action overlapping content or following scroll, remove fixed/corner placement for that page and anchor it directly below the primary generator frame.
- Validate CTA placement on both mobile and desktop in the same pass; avoid breakpoint-specific behavior drift unless explicitly requested.
- Keep enough bottom spacing above fixed footers so in-flow CTAs remain visible and tappable.

## 2026-03-24 - Wrangler Secret Sync Must Cover Full Provider Key Pools
- Cloudflare Pages secret sync must include both Etherscan and Helius cascades (`PRIMARY + _1.._6`) so runtime provider failover works in production.
- Keep deployment scripts/docs aligned with loader expectations (`ETHERSCAN_API_KEY`, `ETHERSCAN_API_KEY_1..6`, `HELIUS_API_KEY`, `HELIUS_API_KEY_1..6`).
- Verify with `wrangler pages secret list --project-name=<project>` after upload to confirm keys exist without exposing values.

## 2026-03-24 - Conservative Safety Buffer Should Be Default For API Throttling
- When balancing user experience vs provider bans, prefer a small default safety buffer on computed throttle intervals so users wait slightly longer instead of triggering API blocking.
- Apply the safety margin in shared throttle policy (not per-provider ad hoc) so all providers get consistent protective behavior.
- Keep explicit throttle env overrides available for controlled tuning, but make the default conservative.

## 2026-03-24 - Provider Throttling Must Be Doc-Driven And Context-Parameterized
- When the user asks to parameterize throttling by API docs, do not keep provider-specific hardcoded delays; move policy to a shared resolver keyed by provider/context/env overrides.
- Encode documented baseline limits per provider (or explicit upstream config when public docs are absent) and apply context multipliers for reliability vs throughput.
- Validate both targeted unit tests and real live-chain integration after throttle-policy changes because burst behavior can differ from mocked/unit flows.

## 2026-03-24 - Follow Referenced Sibling Repo Patterns Before Inventing New Throttling
- When the user points to `smartcontractpatternfinder` for Etherscan/cascade behavior, treat that implementation as the starting blueprint and port its pacing strategy first.
- For Etherscan v2 integration, combine API-key cascade with explicit inter-request throttling to avoid burst-triggered rate-limit exhaustion during multi-call transaction normalization.
- Validate the port immediately with real live-chain integration tests (BTC/ETH/SOL) using API keys, not only unit tests.

## 2026-03-24 - Real-Data Integration Requests Must Exclude Mock Validation
- When the user requests full integration proof with real transactions, do not use mock-based test evidence for sign-off in that slice.
- Keep validation focused on live API-backed flows and explicitly state missing API-key prerequisites instead of substituting public RPC or mocked providers.
- Treat "no public RPC" as an architecture constraint that must be enforced in provider cascade selection, not only in test commands.

## 2026-03-24 - Shell Alignment Overrides Can Cancel Intended Centering
- If a screen should be centered, check for per-page `mainClassName` overrides like `justify-start` that silently defeat shell-level centering.
- Use responsive alignment intentionally: top-first on mobile, centered on desktop, instead of one global alignment for all breakpoints.
- Keep top/bottom shell padding balanced on centered screens; heavy bottom-only padding biases the frame upward.

## 2026-03-24 - Shader Visual Comfort Needs Peak-Brightness Guards
- If users report occasional over-bright flashes in animated backgrounds, reduce specular highlight strength first before changing motion.
- Add explicit shader uniforms for brightness/highlight tuning so visual comfort can be adjusted without rewriting the shader.
- Keep the same palette family but darken the brightest accent color to avoid momentary glare.

## 2026-03-24 - Route-Level Limiters Must Be Reset In Unit API Tests
- API route unit suites that reuse module-scoped rate limiters/replay registries can fail intermittently with `429` unless state is reset between tests.
- For `fetch-tx` route tests, call `__disposeOracleFetchRouteForTests()` in both `beforeEach` and `afterEach` to ensure deterministic isolation.
- Keep Jest coverage thresholds aligned with current file paths after refactors; stale threshold paths can fail CI even when tests pass.

## 2026-03-24 - Desktop Fit Must Be Tested At Short Laptop Heights
- A pass at `1366x768` is not sufficient; include a shorter desktop viewport gate (for example `1280x680`) to catch real-world browser chrome overhead.
- If corner navigation already exposes a route, avoid duplicating the same CTA inside the main content on desktop when vertical space is constrained.
- Height-aware compaction (header spacing + footer padding + control density together) is more reliable than only shrinking inputs.

## 2026-03-24 - Mobile Fixes Must Be Verified Against Desktop Height Too
- If a form-density fix is requested for mobile, also check desktop/laptop viewport fit before closing.
- Centered `min-h-screen` shells can still force vertical scroll on laptop heights even when controls are compact; adjust shell/header spacing and container width together.
- Add an explicit desktop no-overflow e2e assertion to prevent regression.

## 2026-03-24 - Mobile Form Height Must Be Treated As A Blocking UX Defect
- If users report excessive scroll friction on mobile forms, prioritize vertical-density fixes immediately (spacing, font size, control height) before adding new features.
- Optional fields should be collapsed by default behind an explicit toggle so the primary flow fits in one screen as much as possible.
- For optional metadata inputs, prefer compact two-column layouts when safe to reduce total scroll distance.

## 2026-03-24 - Visibility Beats Subtlety For Primary Navigation Actions
- If the user says they cannot see a key action (for example receipt history access), treat it as a UX bug even if the action technically exists.
- Add an explicit, high-visibility CTA in the primary flow, not only a subtle corner utility link.
- For cross-page corner navigation, prefer stronger contrast/size defaults so actions remain obvious on animated backgrounds.

## 2026-03-24 - Avoid Frankenstein Payload Logic (No Dual Legacy Branches)
- For payload/schema upgrades, keep exactly one runtime decoder path after cutover.
- Do not keep old-format compatibility code in production runtime (tests may assert rejection only).
- If a legacy format must be referenced, confine it to negative tests that prove strict rejection.

## 2026-03-24 - Timeseal Reuse Requests Should Extract Storage Core, Not App UI
- When asked to reuse Timeseal logic, first isolate `lib/encryptedStorage.ts` behavior (encrypted local pointer storage lifecycle) as a standalone library API.
- Keep app pages/components out of the abstraction layer; expose adapter-driven primitives that other projects can adopt without design coupling.
- Include quota-aware pruning and opened-state metadata in the reusable core so downstream apps do not re-implement lifecycle edge cases.

## 2026-03-24 - Sanctum Parity Requires DB-Backed Storage, Not Memory-Only
- When matching Sanctum architecture, include a Wrangler/D1 adapter and schema path in the extraction step.
- Keep in-memory storage only as a test/dev adapter, not the primary durability model.
- Capture deployment-ready SQL alongside the abstraction so integration does not stall on infra gaps.

## 2026-03-24 - Sanctum-First Pattern Requests Should Start With Reusable Storage Core
- When the user asks to reuse Sanctum’s approach, implement the storage lifecycle core (pointer IDs, expiry deactivation, hard-delete grace, capacity pruning) as a standalone backend abstraction before touching UI flow.
- Keep the abstraction API-neutral and adapter-driven so route integration can happen incrementally without redesigning storage semantics.
- Add focused unit tests for lifecycle transitions and pruning behavior first, then wire routes/hooks.

## 2026-03-24 - Share Payload Upgrades Must Use Hard Cutover When Requested
- When the user requests no dual-system support, do not keep legacy payload parser branches for compatibility.
- Use one canonical payload schema and remove old-format support in roadmap and implementation scope.
- Treat unknown or legacy payloads as explicit errors after cutover instead of fallback parsing.

## 2026-03-24 - De-Scoped Features Must Be Purged From Canonical Docs
- When the user asks to remove a feature for capacity reasons, remove its roadmap/docs tracks entirely (not only mark deferred) if requested.
- After doc cleanup, run a zero-match search against `docs/project` for the removed feature terms before closing.

## 2026-03-24 - Free-Tier Capacity Must Gate High-Volume Verify Features
- Batch verification that performs per-item server verification can amplify API call volume; treat this as a hard capacity check before shipping.
- If capacity is constrained, de-scope/remove the feature immediately instead of leaving a partial rollout.
- Prefer future batch designs that avoid linear API amplification (for example local-only prechecks or explicit throttled server-side jobs).

## 2026-03-24 - History Storage Must Prefer Deterministic Pruning Over Fallback Stores
- For receipt history, avoid alternate persistence fallbacks (for example in-memory/localStorage) when user policy requires strict IndexedDB behavior.
- When storage pressure is high, prune oldest history records first instead of switching storage backends.
- Surface storage pressure to users explicitly (for example 90% full warning with automatic pruning notice) so retention behavior is transparent.

## 2026-03-24 - Roadmap Must Respect Zero-Budget Constraints
- When the user states there is no budget, remove roadmap items that can require spending (for example on-chain gas/deployment, paid-tier provider expansion, or additional hosted-operator infrastructure).
- Keep active milestones local-first and off-chain, and rewrite sequence/acceptance criteria so they do not implicitly depend on paid services.
- Apply the same constraint consistently in the single roadmap document (`docs/project/ENHANCEMENT_ROADMAP.md`) to avoid plan drift.

## 2026-03-24 - Nullifier Conflict Checks Should Avoid Paid State Dependencies
- If free-tier constraints block managed KV/Redis options, prefer proof-linked/client-side nullifier validation paths over server-side registries.
- Derive nullifier deterministically from signed/public proof-linked data (for example `messageHash`) so verification can run without paid infrastructure.
- Keep conflict semantics local-first (`first_seen`/`idempotent`/`conflict`) and treat shared server state as optional, not required.

## 2026-03-23 - File Patch Edits Must Use apply_patch Tool Directly
- When a change requires patch-style edits, call the dedicated `apply_patch` tool directly instead of invoking it through `exec_command`.
- Keep `exec_command` for read/inspect commands and non-patch shell actions (for example test runs), to avoid tool-policy violations.

## 2026-03-23 - Versioned Schema Branches Should Be Removed Once Migration Window Closes
- When the user decides to stop migration support, collapse `v1`/`v2` branches into one canonical structure immediately instead of keeping compatibility code.
- Remove version-labelled naming (`*V1`, `*V2`, `schemaVersion`, `signatureVersion`) from runtime paths to keep maintenance low and reduce branching bugs.
- Apply the same simplification consistently across schema types, signer helpers, API validation, client payload handling, and tests.

## 2026-03-23 - Shared Infra Requirements Should Trigger Immediate Core Abstraction
- When the user asks for cross-project reuse of a subsystem (for example API key cascade), avoid provider-specific duplication and extract a provider-agnostic core utility immediately.
- Ensure existing integrations are migrated to the shared abstraction in the same change so behavior stays consistent and reusable by default.

## 2026-03-23 - Provider Rollout Must Respect User-Stated Technical Constraints
- When the user provides provider keys for one integration (for example Helius) and defers others (for example Alchemy/Monero), execute only the approved provider track and explicitly park the rest in `docs/project/ENHANCEMENT_ROADMAP.md`.
- Treat secrets provided in-chat as sensitive; never commit them to tracked files and prefer local/deployment secret stores.

## 2026-03-23 - Infrastructure Constraints Must Drive Provider Design
- If the user states there is no VPS/self-hosting capacity, avoid proposing self-hosted node requirements as part of the primary implementation path.
- Default to managed/freemium provider cascades, and treat self-hosted options as optional future upgrades only.

## 2026-03-23 - Roadmap References Must Match User-Declared Source
- When the user says the active roadmap is `docs/project/ENHANCEMENT_ROADMAP.md`, treat it as the primary execution plan for implementation sequencing.
- Do not split planning across separate `PLAN`/`ROADMAP`/`TODO` trackers once consolidation is requested.

## 2026-03-23 - Unexpected Files Should Respect Explicit User Scope
- If an unexpected file appears during active work, pause and ask before touching it.
- When the user explicitly says to ignore it for now, leave it untouched and continue the requested implementation scope.

## 2026-03-23 - Loader Cleanup Requests Must Remove Residual Animated Copy
- When the user asks to remove loader animated text, remove the animated UI block itself (not only restyle it) and delete any now-unused loader animation classes/imports.
- Keep the requested static sentence in place (`Prove the payment. Keep the privacy.`) while simplifying loader content.

## 2026-03-23 - Premium Dropdowns Need Contrast Before Effects
- For glass dropdowns on animated backgrounds, prioritize darker, higher-opacity panel surfaces so option text remains readable over background motion.
- Keep premium styling in borders/shadows/gradients, but ensure dropdown item contrast clears readability first.

## 2026-03-23 - Phase-2 Reuse Should Use Package-Style Aliases With Compatibility Wrappers
- For multi-app reuse, create package-style module roots (`backend-core`, `zk-core`) with dedicated import aliases instead of relying only on deep app-relative paths.
- Preserve existing app/test imports during migration via thin wrapper files (`lib/providers/*`, `lib/zk/witness.ts`) so refactors stay low-risk.
- Prove new package surfaces in real runtime imports early (for example route + prover imports) before expanding migration breadth.

## 2026-03-23 - Cross-App Reuse Requests Should Become Concrete Library Boundaries
- When the user asks for future-project reuse, extract concrete primitives/components into explicit `lib/libraries/{ui,backend,zk}` namespaces instead of keeping logic inside app routes/components.
- Keep existing app imports stable with thin compatibility wrappers while moving implementation into library modules.
- For backend reuse, prioritize low-risk extractions first (response helpers, signer cache, payload utilities) before deeper architectural rewrites.

## 2026-03-23 - Footer Social Icons Should Be Self-Explanatory
- If social icons are obvious, avoid redundant labels like `Share:` unless explicitly requested.
- For fixed bottom footers, prioritize small-screen wrapping and larger icon tap areas so mobile users can use links without crowding.

## 2026-03-23 - Loader Animation Placement Must Follow The Requested Hierarchy
- If the user asks for animated copy to appear under a specific line, place it exactly there and avoid duplicating it elsewhere.
- Keep loader cards minimal when asked: remove redundant headers and keep only essential list content.

## 2026-03-23 - Docs Page Requests Should Keep Exact Static-Docs Style Parity
- When the user asks to keep the "same design as other HTML pages", reuse the exact docs page style baseline (body, typography, spacing, footer structure) rather than introducing a variant visual system.
- If a footer-link addition is requested, apply it consistently to both the runtime app footer and all static docs footers to avoid split navigation behavior.

## 2026-03-23 - Static Docs Requests Should Ship Both Content And Simple Entry URL
- When the user asks to add a docs HTML page, do not stop at confirming an old file exists; refresh content quality and make the page easy to reach.
- For static docs in `public/docs`, add a lightweight alias route in `public/` when helpful (for example `/how-to-use.html` -> `/docs/how-to-use.html`) to reduce path friction.

## 2026-03-23 - Footer Social Requests Should Mirror Timeseal Links Exactly
- When the user asks to "copy from Timeseal", port the exact social destinations (X, Reddit, LinkedIn) and icon interaction model from `Timeseal/app/components/Footer.tsx`.
- Keep GhostReceipt-specific message + URL content, but preserve the visible `Share:` block placement in the footer for discoverability.

## 2026-03-23 - Timeseal Loader Requests Need The Same Text-List Interaction
- When the user asks for "like Timeseal below the title", copy the interaction pattern (rotating character-animated messaging under the heading), not only visual styling.
- Include both use case and user benefit in each loader message line, and keep a visible list context so value is readable at a glance.
- Verify sibling repository paths with exact casing (for example `Timeseal`, not `timeseal`) before concluding a reference is missing.

## 2026-03-23 - Cross-Repo UX Requests Need Feature-Exact Mapping
- When the user says “use X from repo Y”, first confirm the exact implementation pattern in that repo and mirror the visibility/interaction model, not just the underlying capability.
- For share features, prioritize prominent success-state action blocks (URL preview + clear copy CTA + quick actions) over subtle/secondary placement.

## 2026-03-23 - Dropdown Premium Style Must Keep Transparency
- For glassmorphism forms, default select controls should stay transparent in resting state; opaque gray fills read as low quality against animated dark backgrounds.
- Keep hover/focus polish in border/shadow layers, not in heavy background fills.

## 2026-03-23 - Loader Should Communicate Value, Not Only Progress
- When the user asks for inspiration from sibling repos (for example `xmrproof`), carry over the UX principle (informational onboarding) instead of only visual animation.
- Startup loaders should teach at least 2-4 concrete use cases so first-time visitors understand the product before interacting with forms.

## 2026-03-23 - Startup UX Should Wait For Visual Engine Readiness
- For shader-heavy hero backgrounds, gate first-screen reveal on an explicit renderer-ready signal to avoid showing an old/static screen flash.
- Pair renderer readiness with a short minimum loader duration so transition feels intentional rather than abrupt.

## 2026-03-23 - Unit Tests Must Not Depend on Live Provider Network Paths
- For route unit tests, mock provider calls for "valid request" cases instead of allowing real network cascade retries/timeouts.
- Any unit test importing oracle route modules should call route dispose hooks in `afterAll` to avoid lingering interval/timer handles.

## 2026-03-23 - Full-Term Purge Means Case-Insensitive Repo Sweep
- When the user requests a full platform-term purge, do a case-insensitive repo-wide search and remove all residual docs references, not only runtime config.
- After documentation cleanups, always run a final zero-match verification command before closing.

## 2026-03-23 - Pages Deploy Needs Worker Config Isolation
- When a repo has a Worker-focused `wrangler.toml` with incomplete KV bindings, `wrangler whoami` can fail from project root even though Pages commands still work.
- For reliable CI/CLI deploys, run auth checks with `--cwd /tmp` (or another clean directory) and keep Pages deploy/secret commands explicit (`wrangler pages ...`).
- Keep secret sync scripts resilient to local env naming variants (for example provider-suffixed Etherscan keys) and map them to runtime-expected keys (`ETHERSCAN_API_KEY`, `_1.._6`).

## 2026-03-23 - Volume Validation Requires Explicit Load Signals
- When the user asks for throughput/concurrency confidence, add a dedicated stress suite with explicit volume + concurrency controls instead of relying on functional integration tests.
- Keep stress tests deterministic for CI by mocking unstable upstream providers while still exercising real route/business logic and signature verification paths.

## 2026-03-23 - Scope Realignment On User Correction
- When the user explicitly redirects priority (for example from security follow-up to UI fix), stop expanding scope and execute the requested change immediately.
- Keep optional follow-ups as suggestions only; do not continue them once the user says "no need."

## 2026-03-23 - Trust Assumptions Need Front-Page Visibility
- For privacy/security products, keep trust-boundary disclosures (for example centralized oracle assumptions) prominent in top-level docs, not only in deep runbooks.
- Keep user-facing docs technically synchronized with implementation details (for example signature scheme changes such as HMAC -> Ed25519).
- Avoid leaking local workstation paths in public/reference sections; prefer repository URLs or relative project paths.

## 2026-03-22 - Cross-Repo Deprecation Parity
- When the user points to an already-fixed issue in a sibling repo (for example `smartcontractpatternfinder`), pull that implementation pattern first instead of re-deriving from scratch.
- For provider/API hardening, validate against live endpoint behavior (not assumptions) before closing review findings, especially around versioned API migrations like Etherscan v1 -> v2.

## 2026-03-22 - Defense-In-Depth For Sensitive Endpoints
- Bound untrusted string inputs (length + charset/format) for security-critical routes to reduce abuse and memory pressure risk.
- When caching signer/key state, avoid retaining duplicated raw secret material; prefer deterministic fingerprints for cache change detection.

## 2026-03-22 - Route Symmetry For Security-Critical Paths
- When we harden one oracle route (for example signer lifecycle caching in `fetch-tx`), immediately mirror the same pattern in sibling security-critical routes (for example `verify-signature`) unless there is a deliberate documented reason not to.
- Add regression tests that cover runtime key-change behavior whenever signer/key caches are introduced.

## 2026-03-22 - Stale Re-Review Validation
- When a re-review report claims regressions, validate each claim against the live branch before planning remediation to avoid duplicate/redundant work.
- Prioritize only true deltas after validation, and document which review items were already fixed so future passes stay aligned.

## 2026-03-22 - External Pattern Parity for Provider Strategy
- When the user references an existing internal repo pattern (for example `smartcontractpatternfinder`, `honeypotscan`), treat it as an implementation source of truth and align behavior before finalizing.
- Preserve explicit provider ordering requirements from user guidance (for example API-first and RPC-last) and avoid randomization that can violate that order.
- For multi-user stress scenarios, include high-cardinality limiter safeguards (bounded in-memory store and throttled cleanup), not just per-window counters.

## 2026-03-22 - Scanner Exception Policy
- Do not add vulnerability scanner exception files by default when the user asks for clean scanning posture.
- For dependency CVEs, first attempt latest stable upgrades and verify with scanner output without exceptions.
- Only add suppressions if the user explicitly approves an exception path.

## 2026-03-21 - Verification Claim Source Integrity
- Never display verification claims from URL metadata if equivalent values are present in proof public signals.
- Treat URL params as transport only; treat verified proof signals as source of truth for user-visible claim fields.

## 2026-03-21 - Share Payload Decoding
- When reading query params via `URLSearchParams`, avoid extra `decodeURIComponent` unless there is a proven double-encoding path.
- Keep share format parsing backward-compatible when introducing a new encoded format.

## 2026-03-21 - Test Fixture Schema Drift
- Keep test fixtures synced with schema field renames (`schemaVersion`, `oraclePubKeyId`, `messageHash`) when typed contracts evolve.
- Run `npm run typecheck` as a mandatory gate after schema changes before marking implementation as controlled.

## 2026-03-22 - Multi-Item Fix Confirmation
- When the user responds with numbered decisions, treat each item as pending until explicitly confirmed as fixed or skipped.
- If priorities change mid-stream (for example, "item 1 also needs fix"), immediately include that item in implementation and verification scope before closing the plan.

## 2026-03-22 - Prototype-Pollution Guard Precision
- Do not use broad inherited-property checks (`in` on plain objects) to detect malicious keys in parsed JSON payloads; this creates false positives (`constructor` on `Object.prototype`).
- For deserialization hardening, scan own enumerable keys recursively and block only explicit dangerous keys present in the payload shape.

## 2026-03-26 - Compact QR Links Need Durable Pointer Storage
- Never ship compact `sid` share links in Cloudflare Pages memory-only mode; they can resolve as "not found" across devices/requests.
- For share-pointer endpoints, fail fast with an explicit configuration error when `SHARE_POINTERS_DB` (D1) is missing instead of silently issuing non-durable pointers.
- Keep deployment docs explicit about D1 binding + schema setup for compact QR links so runtime behavior matches user expectations.

## 2026-03-26 - Do Not Render Long-Proof QR As A Silent Fallback
- If compact pointer links are unavailable in production, do not generate QR from full `proof=` URLs; scanner corruption risk is high and leads to confusing verification errors (for example oracle commitment mismatch).
- Prefer explicit UX fallback: show a clear status/error and guide users to copy/open the verify URL directly until durable compact-link storage is configured.

## 2026-03-26 - Keep History Surface Scoped To History Page
- If the user asks to keep history on the dedicated page, remove history widgets/buttons from main generator/success surfaces rather than only hiding one entry point.
- Preserve `/history` functionality while decluttering main flow to avoid mixed responsibilities.

## 2026-03-26 - 503 Share-Pointer Often Means Missing D1 Provision, Not Bad Rows
- When `/api/share-pointer/create` returns memory-backend/missing-binding errors, verify D1 actually exists (`wrangler d1 list`) before investigating table contents.
- Fix order should be: create DB -> bind as `SHARE_POINTERS_DB` -> apply schema -> redeploy -> validate create+resolve endpoints.
