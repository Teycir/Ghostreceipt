# Lessons Learned

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
