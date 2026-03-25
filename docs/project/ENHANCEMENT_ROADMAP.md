# GhostReceipt Roadmap (Single Source of Truth)

**Status**: Active  
**Last Updated**: 2026-03-25  
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
- [x] Published proof-system decision artifact with migration triggers and phased path notes.
- [x] Added regression tests for canonical share-payload parsing and verifier route stability.
- [x] Added compact canonical proof payload format with hard cutover (legacy format removed).
- [x] Enforced API-only oracle provider policy (public RPC paths removed from active cascade; live integration now uses Exa-sourced BTC/ETH/SOL fixtures with API-key gating for ETH/SOL).
- [x] Ported Etherscan v2 throttling/cascade pacing from `smartcontractpatternfinder` and validated full live BTC/ETH/SOL integration pass with API providers only.
- [x] Generalized provider throttling to doc-driven + context-parameterized policy across Etherscan/Helius/mempool.space with validated live BTC/ETH/SOL flow.
- [x] Added Ethereum asset-mode support for stablecoin claims (`ETH` native + `USDC` ERC-20 via Etherscan) with API/schema validation and provider normalization.
- [x] Added deterministic ZK artifact checksum automation command for release-readiness evidence (`npm run check:zk-artifact-checksums`).
- [x] Added automated release-readiness command gate (`npm run check:release-readiness`) with API-only doc consistency checks.
- [x] Switched BTC cascade to BlockCypher token-rotated primary with `mempool.space` as last public fallback, and kept conservative spike handling (no multi-key spray on BlockCypher `429`).
- [x] Added dedicated live BTC BlockCypher E2E integration test (`npm run test:live:btc:blockcypher`) covering oracle fetch/signature + witness + Groth16 proof + verify-signature.

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
- [x] Publish proof-system decision artifact (`Groth16` stay vs `PLONK/Fflonk` path) with rationale and migration notes.
- [x] Add explicit per-feature latency budgets and require before/after metric deltas in roadmap review notes.
- [x] Add regression coverage around canonical payload parsing and verify path stability.

### Product Slice (P2)

- [x] Add PDF export with QR + human-readable proof summary.
- [x] Add receipt labels/categories in generator + verifier.
- [x] Add local receipt history (`/history`, IndexedDB, JSON export).
- [x] Add Ethereum stablecoin selector (`ETH` / `USDC`) in generator with Etherscan-backed canonical fetch path.

### Shareability and ZK Design (P2-P3)

- [x] Add compact canonical proof payload format with hard cutover (legacy format removed).
- [x] Draft selective disclosure public-input contract and phased implementation plan.
- [x] Draft bounded amount disclosure/range-proof design and rollout plan.

## Execution Waves (Actionable)

### Wave A: Core Product Workflow (Now)

`Goal`: ship practical local-first workflow features without changing trust assumptions.

- [x] `R-P2-01` PDF export with QR + human-readable proof summary.
- [x] `R-P2-02` Receipt labels/categories in generator + verifier.
- [x] `R-P2-03` Local receipt history (`/history`, IndexedDB, JSON export).
- [x] `R-P2-04` Ethereum asset selector (`ETH` native + `USDC` ERC-20) with Etherscan normalization.

Scope constraints:
- No new paid services or required hosted dependencies.
- Share payload policy: one canonical format only after cutover.
- Mobile-first layout and interaction parity.

Acceptance criteria:
- User can generate a receipt, export a PDF, and verify from QR end-to-end.
- Labels and categories are persisted locally and rendered in both generator and verifier.
- History list supports filter + export and remains fully local-first.

Verification commands:
```bash
npm run typecheck
npm run test -- tests/unit
npm run test -- tests/integration
npm run test:e2e -- --grep "history|pdf|verify"
```

### Wave B: Share and Privacy Upgrades (Later)

`Goal`: improve payload ergonomics and privacy controls while preserving deterministic verification.

- [x] `R-P3-01` Compact canonical proof payload format with hard cutover.
- [x] `R-P3-02` Selective disclosure public-input contract and phased plan.
- [x] `R-P3-03` Bounded amount disclosure/range-proof design and rollout plan.

Scope constraints:
- Deterministic encoding and decoding for one canonical payload schema.
- No legacy parser retention after cutover; legacy payloads fail with explicit error.
- Privacy upgrades gated behind benchmark and interoperability evidence.

Acceptance criteria:
- Compression reduces typical QR payload size with no verification regressions.
- Selective disclosure plan includes cutover checklist and migration trigger points.
- Range-proof plan includes proving-time budget projections and rollout safety gating.

Verification commands:
```bash
npm run typecheck
npm run test -- tests/unit/lib/zk
npm run test -- tests/integration
npm run test:perf:proof
```

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
- [x] Proof-system decision + technical docs refresh.
- [x] Maintain `p95 < 60s`, `p50 < 25s` in benchmark environment.
- [x] Keep UI responsive during proof generation (worker path and fallbacks validated).

Exit criteria:
- [x] Performance regressions are caught automatically in CI.
- [x] Proof and verification paths remain stable under stress tests.

### Phase 3: UX and Workflow Expansion (P2)

- [x] PDF export and receipt metadata UX.
- [x] Local-first history and filtering workflows.

Exit criteria:
- [x] Features avoid regressions on mobile-first happy path.

### Phase 4: Advanced Share and Privacy Controls (P2-P3)

- [x] Canonical compact share payload and QR scannability optimization (hard cutover).
- [x] Selective disclosure design and implementation staging.
- [x] Range-proof mode design and implementation staging.

Exit criteria:
- [x] Compressed payloads stay deterministic and verifiable.
- [x] Advanced privacy modes ship only with benchmark evidence.

---

## Latency Budget Contract (Authoritative)

All roadmap features that touch generator, verifier, oracle routes, or proof runtime must report before/after metrics and deltas using the review-note template.

| Surface | Metric | p50 Budget | p95 Budget | Measurement Path |
|---------|--------|------------|------------|------------------|
| Generator end-to-end | `total_ms` | `<= 25,000` | `<= 60,000` | generator timing telemetry + proof budget test |
| Witness build | `witness_ms` | `<= 250` | `<= 500` | generator timing telemetry / `test:perf:proof` |
| Proof generation | `prove_ms` | `<= 25,000` | `<= 60,000` | generator timing telemetry / `test:perf:proof` |
| Share payload packaging | `package_ms` | `<= 500` | `<= 1,000` | generator timing telemetry |
| Oracle fetch route | `fetch_p95_ms` | `<= 1,000` | `<= 2,000` | stress oracle test metrics |
| Oracle verify route | `verify_p95_ms` | `<= 500` | `<= 1,000` | stress oracle test metrics |

Notes:
- Budgets are guardrails; any intentional exception requires explicit rationale and follow-up mitigation in the same review note.
- No roadmap item is considered complete without a metric delta entry for impacted surfaces.

---

## Roadmap Review Notes (Required)

Use [ROADMAP_REVIEW_NOTES_TEMPLATE.md](./ROADMAP_REVIEW_NOTES_TEMPLATE.md) for any roadmap-linked implementation.

Minimum required fields:
- Roadmap item id/title.
- Commands used for measurement.
- Before/after values for each impacted metric.
- Delta (`after - before`) and budget pass/fail result.
- If a budget fails: mitigation and rollout safety plan.

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
  Mitigation: canonical payload contract + strict parser stability tests + compression tests.

- Risk: roadmap drift across files.  
  Mitigation: this file is now the single canonical planning/tracking source.

---

## References

- Security runbook: [SECURITY.md](../runbooks/SECURITY.md)
- Threat model: [THREAT_MODEL.md](../runbooks/THREAT_MODEL.md)
- Circuit self-review: [CIRCUIT_SELF_REVIEW.md](../runbooks/CIRCUIT_SELF_REVIEW.md)
- Proof system decision: [PROOF_SYSTEM_DECISION.md](./PROOF_SYSTEM_DECISION.md)
- Selective disclosure contract: [SELECTIVE_DISCLOSURE_PUBLIC_INPUT_CONTRACT.md](./SELECTIVE_DISCLOSURE_PUBLIC_INPUT_CONTRACT.md)
- Bounded amount/range-proof plan: [BOUNDED_AMOUNT_RANGE_PROOF_PLAN.md](./BOUNDED_AMOUNT_RANGE_PROOF_PLAN.md)
- Phase 2 gate review note: [ROADMAP_REVIEW_NOTES_PHASE2_GATES_2026-03-24.md](./ROADMAP_REVIEW_NOTES_PHASE2_GATES_2026-03-24.md)
- Phase 3 mobile gate review note: [ROADMAP_REVIEW_NOTES_PHASE3_MOBILE_GATES_2026-03-24.md](./ROADMAP_REVIEW_NOTES_PHASE3_MOBILE_GATES_2026-03-24.md)
- Phase 4 compressed payload determinism review note: [ROADMAP_REVIEW_NOTES_PHASE4_COMPRESSED_DETERMINISM_2026-03-24.md](./ROADMAP_REVIEW_NOTES_PHASE4_COMPRESSED_DETERMINISM_2026-03-24.md)
- Phase 4 advanced privacy benchmark gate review note: [ROADMAP_REVIEW_NOTES_PHASE4_ADVANCED_PRIVACY_BENCHMARK_GATE_2026-03-24.md](./ROADMAP_REVIEW_NOTES_PHASE4_ADVANCED_PRIVACY_BENCHMARK_GATE_2026-03-24.md)
- Release-readiness checksum automation review note: [ROADMAP_REVIEW_NOTES_RELEASE_READINESS_CHECKSUM_AUTOMATION_2026-03-25.md](./ROADMAP_REVIEW_NOTES_RELEASE_READINESS_CHECKSUM_AUTOMATION_2026-03-25.md)
- Release-readiness command gate review note: [ROADMAP_REVIEW_NOTES_RELEASE_READINESS_COMMAND_GATE_2026-03-25.md](./ROADMAP_REVIEW_NOTES_RELEASE_READINESS_COMMAND_GATE_2026-03-25.md)
- Roadmap review-note template: [ROADMAP_REVIEW_NOTES_TEMPLATE.md](./ROADMAP_REVIEW_NOTES_TEMPLATE.md)

---

## Consolidation Record

- 2026-03-24: Consolidated planning into this single roadmap document.
- 2026-03-24: Added actionable execution waves (`Now`/`Next`/`Later`) with acceptance criteria and verification command sets for remaining P2/P3 items.
- 2026-03-24: Completed `R-P3-02` by publishing the selective-disclosure public-input contract and phased hard-cutover plan.
- 2026-03-24: Completed `R-P3-03` by publishing bounded amount/range-proof design with rollout safety gating and proving-time budget projections.
- 2026-03-24: Closed remaining Phase-2 reliability/performance gates with p50+p95 proof budgets, worker-fallback validation, and stress-suite evidence.
- 2026-03-24: Closed Phase-3 mobile-first regression gate with dedicated e2e coverage and review-note evidence.
- 2026-03-24: Closed Phase-4 compressed payload determinism gate with explicit repeatability and import/export idempotency tests.
- 2026-03-24: Closed Phase-4 advanced privacy shipping gate with enforced benchmark-evidence manifest validation and CI policy tests.
- 2026-03-24: Began selective-disclosure runtime prep by centralizing legacy public-signal decode helpers and routing verifier oracle-commitment extraction through shared decoding logic.
- 2026-03-24: Extended verifier/runtime decoding to support both legacy and selective-disclosure public-signal contracts with disclosure-state output and digest-backed nullifier idempotency checks.
- 2026-03-24: Completed selective packaging bridge for generator/export flow with disclosure toggles (`disclosureMask`, gated claim fields, `claimDigest`) and selective-contract export/import test enforcement while preserving legacy proof verification signals.
- 2026-03-24: Superseded and removed duplicate trackers:
  - `docs/project/PLAN.md`
  - `docs/project/ROADMAP.md`
- 2026-03-24: Reintroduced `tasks/todo.md` as lightweight session execution tracking; roadmap remains canonical for planning and prioritization.
- 2026-03-25: Completed `R-P2-04` by adding Ethereum asset-mode selection (`native` / `usdc`) in generator flow, routing `ethereumAsset` through oracle fetch validation, and normalizing USDC transfer values from Etherscan ERC-20 receipt logs.
- 2026-03-25: Continued roadmap execution into release-readiness by adding deterministic ZK artifact checksum automation (`npm run check:zk-artifact-checksums`) and wiring it into release checklist guidance.
- 2026-03-25: Continued release-readiness execution by adding `npm run check:release-readiness` (doc consistency + transparency log + zk checksum checks) and removing stale public-RPC fallback wording from README trust/API sections.
