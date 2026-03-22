# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Oracle signature verification endpoint: `POST /api/oracle/verify-signature`.
- Oracle commitment hashing module for deterministic circuit-bound commitments.
- Trusted setup provenance template:
  - `docs/runbooks/TRUSTED_SETUP_PROVENANCE_TEMPLATE.md`
- Release readiness checklist:
  - `docs/project/RELEASE_READINESS_CHECKLIST.md`
- Explicit Oracle Trust Model documentation in `README.md`.

### Changed
- Circuit now enforces oracle commitment binding over canonical tx facts instead of placeholder signature-nonzero logic.
- Witness/public signal layout migrated to `oracleCommitment` + `chainId` model.
- Ethereum providers now classify reverted transactions and map them to deterministic API error handling.
- Anonymous idempotency replay scope now uses server-issued session identity (`gr_sid`).
- Circuit compilation runbook aligned to current artifact paths and constraints.
- Circuit compilation script now supports local ptau fallback when external ptau download fails.

### Security
- Security runbook expanded with oracle key custody, 90-day rotation cadence, and key-compromise incident steps.
- API route error mapping includes explicit reverted transaction class (`TRANSACTION_REVERTED`).

## [0.1.0] - Pending

### Notes
- Initial public release entry placeholder.
- Populate this section when the first tagged release is created.
