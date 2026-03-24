# GhostReceipt Proof System Decision

**Status**: Approved  
**Decision Date**: 2026-03-24  
**Owner**: GhostReceipt maintainers

## Decision

GhostReceipt will remain on **Groth16 (Circom 2 + snarkjs)** for the active release train.

PLONK/Fflonk remains a future option, but not part of current delivery scope.

## Why This Decision

### 1) Current system is already production-integrated

- Circuit and proving pipeline are already implemented and validated with Groth16.
- Artifact pipeline (`.wasm`, `.zkey`, verification key) and trusted setup documentation are in place.
- Verification paths and tests already depend on current artifact format.

### 2) Lowest migration risk for current roadmap

- Current roadmap priority is reliability/performance gating and UX expansion.
- Migrating proving systems now would add format, tooling, and regression risk to active milestones.
- A system switch would compete with higher-priority tasks (budget gates, verification stability, product features).

### 3) Fits zero-cost operating constraints

- Existing Groth16 flow runs in the current local/free-tier model.
- No mandatory paid infra changes are required to keep shipping roadmap milestones.

## Trade-Off Acknowledgement

Groth16 requires circuit-specific setup, while PLONK-family systems can reduce ceremony burden in some workflows.

We accept this trade-off now because:
- setup/provenance is already documented and reproducible for the current circuit,
- the immediate value of switching is lower than the near-term delivery risk,
- current proof UX/performance gates can be enforced without changing proving systems.

## Scope and Policy

- **In scope now**:
- Keep Groth16 as canonical proof system.
- Keep trusted setup provenance records current when circuit artifacts change.
- Keep proof-performance budget gate active in CI.

- **Out of scope now**:
- Full proving-system migration.
- Share payload format migration tied only to proving-system changes.
- Dual-system runtime support in production.

## Migration Triggers (Revisit Conditions)

Re-open this decision only if one or more are true:

- Required product capability cannot be delivered cleanly on current Groth16 flow.
- Performance budgets cannot be maintained after validated optimization attempts.
- Operational burden of circuit-specific setup outweighs migration cost.
- Security/audit requirements materially favor another proving system.

## Migration Path (If Triggered)

1. Build a non-production spike branch with a parallel PLONK/Fflonk proof path.
2. Measure prove/verify latency, proof size, and memory against current CI budgets.
3. Define backward-compatible payload/versioning strategy before any cutover.
4. Add dual-verifier support behind a feature flag for transition testing.
5. Cut over only after performance, security, and compatibility gates pass.

## Linked Evidence

- Circuit compilation and Groth16 flow: [CIRCUIT_COMPILATION.md](../runbooks/CIRCUIT_COMPILATION.md)
- Trusted setup provenance record: [TRUSTED_SETUP_PROVENANCE_2026-03-22.md](../runbooks/TRUSTED_SETUP_PROVENANCE_2026-03-22.md)
- Circuit review baseline: [CIRCUIT_SELF_REVIEW.md](../runbooks/CIRCUIT_SELF_REVIEW.md)
- Current roadmap: [ENHANCEMENT_ROADMAP.md](./ENHANCEMENT_ROADMAP.md)

## Review Cadence

- Review this decision at least once per quarter, or earlier if a migration trigger is met.
