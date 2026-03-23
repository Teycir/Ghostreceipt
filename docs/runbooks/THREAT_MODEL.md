# GhostReceipt Threat Model (Pre-v0.1.0)

This document explains what GhostReceipt receipts prove today, what they do not prove, and which trust assumptions users must accept in the current architecture.

## Scope

GhostReceipt provides privacy-preserving payment evidence:
- Proves claim constraints (amount/date lower bounds) with Groth16 zk-SNARKs.
- Redacts sender/receiver/tx hash from shared payloads.
- Verifies oracle signature integrity over canonical transaction commitments.

## Current Trust Boundary

The oracle API (`POST /api/oracle/fetch-tx`) is the primary trust boundary.

Current model:
- Single first-party oracle signing key (centralized trust anchor).
- Upstream provider dependency (for example mempool.space, Blockchair, Etherscan, public RPC).
- Browser-local proof generation and verification.

## What A Verified Receipt Proves

- The proof satisfies circuit constraints.
- Public claims are bound to oracle-signed canonical data.
- The payload has not been modified without invalidating the signature/proof.

## What A Verified Receipt Does Not Prove

- Trustless full chain-state validation independent of the oracle/provider pipeline.
- Recipient-specific BTC net-received value in multi-output transactions (current BTC value is tx-level `sum(vout)` / `output_total`).
- Safety against a malicious oracle operator with signing-key control.

## Key Threats And Mitigations

1. Oracle key compromise
- Risk: attacker can issue valid signatures over malicious canonical payloads.
- Current mitigations: server-side key custody, rotation runbook, verify endpoint checks.
- Required operator action: immediate key rotation + incident disclosure (see `SECURITY.md`).

2. Oracle outage or degraded provider availability
- Risk: new receipt generation can fail or degrade.
- Current mitigations: provider cascade and fallback strategy.

3. Upstream provider integrity failure
- Risk: oracle signs incorrect upstream data.
- Current mitigations: multi-provider fallback and normalization checks.
- Residual risk: still trusted-data model, not trustless validation.

4. Client-side compromise (XSS, malicious extensions, hostile runtime)
- Risk: witness/proof inputs can be tampered before generation.
- Current mitigations: CSP, secure headers, route validation, strict schemas.

## Incident Expectations (User-Facing)

If oracle compromise is suspected:
1. New receipts should be treated as untrusted until key rotation is complete.
2. Operator should publish the incident window and rotation completion time.
3. Verifiers should prefer receipts issued outside affected windows.

## Trust-Minimization Roadmap Direction

Planned direction after pre-release hardening:
- Multi-oracle attestation/quorum model.
- Independent oracle operators.
- Research track for TLS-notary/light-client verification to reduce single-operator trust.

