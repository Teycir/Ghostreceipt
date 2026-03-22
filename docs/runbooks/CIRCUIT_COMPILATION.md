# Circuit Compilation Guide

## Prerequisites

Install required tools:

```bash
# Install circom
git clone https://github.com/iden3/circom.git
cd circom
cargo build --release
cargo install --path circom

# Install snarkjs
npm install -g snarkjs

# Verify installations
circom --version
snarkjs --version
```

## Compile Circuit

Run:

```bash
npm run compile:circuit
```

The script compiles `circuits/receipt.circom`, builds proving artifacts, and exports verification material under `public/zk/`.

## Trusted Setup Notes

The project uses Groth16, so trusted setup material is required.

- Preferred path: use the shared Powers of Tau file `powersOfTau28_hez_final_14.ptau`.
- Fallback path: if download fails, the script generates a local phase-1 transcript (`pot14_*`) and produces `pot14_final.ptau`.
- The script keeps final ptau artifacts for reproducibility and removes only intermediate local ptau files.

## Generated Files

After compilation, the key artifacts are:

- `public/zk/receipt_js/receipt.wasm` - witness calculator used in browser
- `public/zk/receipt_final.zkey` - proving key
- `public/zk/verification_key.json` - verification key
- `public/zk/Verifier.sol` - optional Solidity verifier export

## Circuit Constraints

The receipt circuit enforces:

1. **Value Constraint**: `realValue >= claimedAmount`
2. **Timestamp Constraint**: `realTimestamp >= minDate`
3. **Chain Constraint**: `chainId` must be boolean (`0` bitcoin, `1` ethereum)
4. **Oracle Commitment Constraint**:
   `oracleCommitment == Poseidon(realValue, realTimestamp, Poseidon(txHash[8]), chainId)`

This replaces the previous placeholder `oracleSignature != 0` check.

## Circuit Inputs

- **Public Inputs**:
  - `claimedAmount`
  - `minDate`
  - `oracleCommitment`

- **Private Inputs**:
  - `realValue`
  - `realTimestamp`
  - `txHash[8]`
  - `chainId`

## Testing Circuit Locally

```bash
cat > input.json << 'EOF'
{
  "claimedAmount": "1000000000000000000",
  "minDate": "1234567890",
  "oracleCommitment": "12345678901234567890",
  "realValue": "2000000000000000000",
  "realTimestamp": "1234567900",
  "txHash": ["10", "20", "30", "40", "50", "60", "70", "80"],
  "chainId": "1"
}
EOF

snarkjs wtns calculate public/zk/receipt_js/receipt.wasm input.json witness.wtns
snarkjs groth16 prove public/zk/receipt_final.zkey witness.wtns proof.json public.json
snarkjs groth16 verify public/zk/verification_key.json public.json proof.json
```

## Circuit Stats

```bash
snarkjs r1cs info public/zk/receipt.r1cs
```

## Troubleshooting

### `circom: command not found`

Install circom from source:

```bash
git clone https://github.com/iden3/circom.git
cd circom
cargo build --release
sudo cp target/release/circom /usr/local/bin/
```

### `snarkjs: command not found`

```bash
npm install -g snarkjs
```

### Powers of Tau download fails

Run `npm run compile:circuit` again; the script now auto-falls back to a local ptau generation flow.

### `Constraint not satisfied`

Validate:

- `realValue >= claimedAmount`
- `realTimestamp >= minDate`
- `oracleCommitment > 0`
- `chainId` is `0` or `1`
- `txHash` has exactly 8 chunks

## Production Considerations

1. Prefer a publicly documented multi-party ceremony for final production zkey.
2. Publish artifact provenance:
   - circuit commit hash
   - ptau source or transcript
   - zkey contribution transcript/hash
3. Keep oracle key management documented (rotation cadence, incident response, key custody).
4. Audit circuit logic and API trust boundary together, not in isolation.

## References

- [Circom Documentation](https://docs.circom.io/)
- [snarkjs Documentation](https://github.com/iden3/snarkjs)
- [Groth16 Paper](https://eprint.iacr.org/2016/260.pdf)
- [Powers of Tau Ceremony](https://github.com/iden3/snarkjs#7-prepare-phase-2)
