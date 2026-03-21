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
