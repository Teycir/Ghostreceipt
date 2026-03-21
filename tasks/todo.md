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

- [ ] Capture current dependency vulnerability inventory from local tooling.
- [ ] Normalize and prioritize findings by severity and direct/transitive upgrade path.
- [ ] Apply the minimal safe dependency updates in `package.json`/`package-lock.json`.
- [ ] Run verification checks (`lint`, `typecheck`, targeted tests) after upgrades.
- [ ] Summarize resolved findings, remaining risk, and follow-up recommendations.

## Review
- Pending.
