# Lessons Learned

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
