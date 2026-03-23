# Lessons Learned

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
