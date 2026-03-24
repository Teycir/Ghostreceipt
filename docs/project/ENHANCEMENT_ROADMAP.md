# GhostReceipt Roadmap (Single Source of Truth)

**Status**: Active  
**Last Updated**: 2026-03-24  
**Scope**: Consolidated from `tasks/todo.md`, `docs/project/PLAN.md`, and `docs/project/ROADMAP.md`

This is the only planning/tracking document for GhostReceipt.  
Budget rule: roadmap items must remain executable with zero mandatory spend (no paid tiers, no required gas, no extra hosted infra).

---

## Product Guardrails

- No credit card required for local setup, testing, and deployment baseline.
- No forced user API keys; BYOK stays optional.
- Keep default flow local-first and free-tier safe.
- Keep proof UX target as a hard SLO: `p95 < 60s`, `p50 < 25s`.
- Keep all tests in `tests/` only.

---

## Current Snapshot (Completed)

- [x] Unified oracle auth structure to one canonical envelope (removed `v1`/`v2` split naming in runtime path).
- [x] Added nonce + timestamp replay protections and verify-route replay enforcement.
- [x] Added oracle transparency log validation in verification flow (including key validity window checks).
- [x] Added nullifier support and conflict checks, then migrated to zero-cost proof-linked nullifier verification path.
- [x] Lowered default route rate limits for safer free-tier operation.
- [x] Added safe short-TTL canonical tx fetch cache (successful normalized responses only; no error caching).
- [x] Added proof speed improvements: artifact preload, worker proving path, and timing telemetry.
- [x] Kept roadmap constrained to zero-cost deliverables (removed paid/on-chain-required tracks).
- [x] Added dedicated proof-performance regression gate with CI budget enforcement.

---

## Priority Matrix

| Priority | Meaning | Typical Scope |
|----------|---------|---------------|
| **P0** | Security/trust critical | Must ship immediately |
| **P1** | Core reliability/performance | Next milestone |
| **P2** | High-value UX/product | After core gates |
| **P3** | Advanced enhancements | Design then stage |

---

## Active Execution Queue

### Next Up (P1)

- [x] Add dedicated proof-performance regression gate with CI-friendly benchmarks.
- [ ] Publish proof-system decision artifact (`Groth16` stay vs `PLONK/Fflonk` path) with rationale and migration notes.
- [ ] Add explicit per-feature latency budgets and require before/after metric deltas in roadmap review notes.
- [ ] Add regression coverage around payload compatibility and verify path stability.

### Product Slice (P2)

- [ ] Add PDF export with QR + human-readable proof summary.
- [ ] Add receipt labels/categories in generator + verifier.
- [ ] Add local receipt history (`/history`, IndexedDB, JSON export).
- [ ] Add batch verification workflow for compliance/accounting use.

### Shareability and ZK Design (P2-P3)

- [ ] Add proof payload compression/versioning with backward-compatible parsing.
- [ ] Draft selective disclosure public-input contract and phased implementation plan.
- [ ] Draft bounded amount disclosure/range-proof design and rollout plan.

---

## Phase Plan

### Phase 1: Security and Trust Hardening (P0-P1)

- [x] Oracle auth envelope hardening.
- [x] Replay window + nonce checks.
- [x] Transparency log verification.
- [x] Nullifier anti-duplication path aligned to zero-cost architecture.
- [x] Free-tier-safe rate-limit defaults and safe fetch cache.

Exit criteria:
- [x] Cryptographic checks active and tested.
- [x] No mandatory paid infrastructure introduced.

### Phase 2: Reliability and Performance Gates (P1)

- [x] CI-integrated performance budget tests for generator/prover flow.
- [ ] Proof-system decision + technical docs refresh.
- [ ] Maintain `p95 < 60s`, `p50 < 25s` in benchmark environment.
- [ ] Keep UI responsive during proof generation (worker path and fallbacks validated).

Exit criteria:
- [ ] Performance regressions are caught automatically in CI.
- [ ] Proof and verification paths remain stable under stress tests.

### Phase 3: UX and Workflow Expansion (P2)

- [ ] PDF export and receipt metadata UX.
- [ ] Local-first history and filtering workflows.
- [ ] Verification ergonomics for accounting/compliance scenarios.

Exit criteria:
- [ ] Accounting/compliance workflow validated by E2E tests.
- [ ] Features avoid regressions on mobile-first happy path.

### Phase 4: Advanced Share and Privacy Controls (P2-P3)

- [ ] Share payload compression and QR scannability optimization.
- [ ] Selective disclosure design and implementation staging.
- [ ] Range-proof mode design and implementation staging.

Exit criteria:
- [ ] Compressed payloads stay deterministic and verifiable.
- [ ] Advanced privacy modes ship only with benchmark evidence.

---

## Success Metrics

### Security

- Replay attacks rejected within configured validity windows.
- Duplicate/conflict receipt generation detectable by verifier path.
- Transparency log integrity checks pass in CI and runtime validation.

### Speed

- Generator `p95 < 60s`, `p50 < 25s` in defined benchmark environment.
- Verification remains fast and deterministic for shared payloads.

### Product

- Zero-cost setup remains intact for contributors and users.
- Local-first workflows (history/export/verify) remain stable.
- Mobile UX remains first-class for generation and verification.

---

## Risks and Mitigations

- Risk: circuit growth increases proving time.  
  Mitigation: benchmark and gate every circuit-affecting change.

- Risk: payload feature growth harms QR/share usability.  
  Mitigation: versioned payloads + compatibility tests + compression tests.

- Risk: roadmap drift across files.  
  Mitigation: this file is now the single canonical planning/tracking source.

---

## References

- Security runbook: [SECURITY.md](../runbooks/SECURITY.md)
- Threat model: [THREAT_MODEL.md](../runbooks/THREAT_MODEL.md)
- Circuit self-review: [CIRCUIT_SELF_REVIEW.md](../runbooks/CIRCUIT_SELF_REVIEW.md)

---

## Consolidation Record

- 2026-03-24: Consolidated planning into this single roadmap document.
- 2026-03-24: Superseded and removed duplicate trackers:
  - `tasks/todo.md`
  - `docs/project/PLAN.md`
  - `docs/project/ROADMAP.md`
