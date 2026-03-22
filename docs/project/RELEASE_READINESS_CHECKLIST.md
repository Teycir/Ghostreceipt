# Release Readiness Checklist (v0.1.0 + First Live Demo)

Use this checklist before cutting the first public tag and announcing the live demo.

## 1) Product & UX

- [ ] Generator flow works end-to-end on desktop and mobile.
- [ ] Verifier flow rejects tampered payloads and displays clear errors.
- [ ] QR export and share-link flows are validated on at least two browsers.
- [ ] No critical accessibility regressions (`tests/unit/accessibility.test.ts` passing).

## 2) Security & Trust Boundary

- [ ] `ORACLE_PRIVATE_KEY` is set only in secret stores, never in repo.
- [ ] Oracle key rotation status checked (last rotation date documented).
- [ ] `POST /api/oracle/verify-signature` returns valid/invalid results as expected.
- [ ] Replay protection and rate-limit behavior validated in API route tests.
- [ ] Secret scanning run and clean (`npm run check:secrets`).

## 3) ZK Integrity

- [ ] Circuit constraints reviewed against current product claims.
- [ ] Trusted setup provenance record completed from template:
  - `docs/runbooks/TRUSTED_SETUP_PROVENANCE_TEMPLATE.md`
- [ ] Artifact checksums captured for `receipt.wasm`, `receipt_final.zkey`, and `verification_key.json`.
- [ ] Proof generation/verification tests passing with current artifacts.

## 4) Reliability

- [ ] Provider cascade fallback behavior confirmed for BTC and ETH paths.
- [ ] Reverted ETH transaction mapping returns `TRANSACTION_REVERTED` (HTTP 422).
- [ ] Anonymous idempotency session isolation behavior validated.
- [ ] Build passes in production mode.

## 5) Documentation & Transparency

- [ ] README contains current Oracle Trust Model section.
- [ ] Security runbook reflects current key custody and rotation policy.
- [ ] Circuit compilation runbook matches current circuit inputs/outputs.
- [ ] Changelog/release notes drafted with known limitations and future work.

## 6) Release Operations

- [ ] Create release branch/tag name (example: `v0.1.0`).
- [ ] Run final validation:
  - [ ] `npm run lint`
  - [ ] `npm run typecheck`
  - [ ] `npm run test:coverage -- --ci --runInBand`
  - [ ] `npm run build`
- [ ] Publish GitHub release with:
  - [ ] version summary
  - [ ] trust assumptions
  - [ ] deployment target
  - [ ] demo URL
- [ ] Post-release smoke test on live environment.

## Sign-Off

- [ ] Engineering sign-off
- [ ] Security sign-off
- [ ] Product/demo sign-off
