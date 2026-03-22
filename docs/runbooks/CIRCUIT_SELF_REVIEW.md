# Circuit Self-Review (Plain Language)

## Scope

This review maps GhostReceipt product claims to concrete constraints in `circuits/receipt.circom` and related verifier flow.

## What Is Proved

The proof enforces all of the following:

1. The hidden transaction value is at least the claimed value.
2. The hidden transaction timestamp is at least the claimed minimum date.
3. The hidden tx facts are bound to a public oracle commitment value.
4. The hidden chain selector is constrained to `bitcoin` or `ethereum` (`0|1`).

## Constraint-to-Claim Mapping

- Claim: "I paid at least X"
  - Enforced by `GreaterEqThan` on `realValue >= claimedAmount`.

- Claim: "Payment occurred after date Y"
  - Enforced by `GreaterEqThan` on `realTimestamp >= minDate`.

- Claim: "These hidden tx facts were oracle-attested"
  - Enforced by:
    - `txHashPoseidon = Poseidon(txHash[8])`
    - `oracleCommitmentPoseidon = Poseidon(realValue, realTimestamp, txHashPoseidon, chainId)`
    - `oracleCommitmentPoseidon == oracleCommitment` (public signal).
  - Verifier flow also requires `publicSignals[2] === oracleAuth.messageHash` and server-side signature verification.

## Soundness Notes (Current Model)

- The circuit does not prove provider correctness by itself; it proves consistency with the committed oracle payload.
- Security therefore depends on both:
  - circuit constraints being correct, and
  - oracle key/process integrity.
- The chain boolean check prevents malformed cross-chain encoding in witness inputs.

## Non-Goals / Known Limitations

- Does not provide decentralized oracle consensus; trust anchor is currently centralized.
- Does not reveal sender/receiver/tx hash to verifier (privacy goal), so those are not publicly auditable from the proof output.
- Does not include anti-replay semantics inside the circuit; replay protection is handled at API level.

## Recommended External Review Focus

1. Validate field encoding assumptions for `txHash[8]` chunking and Poseidon input domain.
2. Validate no mismatch between server-side commitment computation and circuit-side commitment construction.
3. Confirm proof verification flow rejects payloads if oracle-auth binding is missing or mismatched.
4. Confirm no unsafe witness coercion paths in client serialization.
