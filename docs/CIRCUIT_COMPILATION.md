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

Run the compilation script:

```bash
npm run compile:circuit
```

This will:
1. Compile `circuits/receipt.circom` to R1CS
2. Generate WASM witness calculator
3. Download Powers of Tau ceremony file
4. Generate proving key (zkey)
5. Contribute to phase 2 ceremony
6. Export verification key
7. Generate Solidity verifier

## Generated Files

After compilation, the following files will be in `public/zk/`:

- `receipt.wasm` - Witness calculator (used in browser)
- `receipt_final.zkey` - Proving key (used for proof generation)
- `verification_key.json` - Verification key (used for proof verification)
- `Verifier.sol` - Solidity verifier contract (optional, for on-chain verification)

## Circuit Constraints

The receipt circuit has 3 main constraints:

1. **Value Constraint**: `realValue >= claimedAmount`
   - Proves user didn't claim more than actual transaction value
   
2. **Timestamp Constraint**: `realTimestamp >= minDate`
   - Proves transaction occurred after claimed minimum date
   
3. **Signature Constraint**: `oracleSignature != 0`
   - Proves oracle signed the canonical data

## Circuit Parameters

- **Public Inputs** (visible in proof):
  - `claimedAmount`: Amount user claims
  - `minDate`: Minimum timestamp user claims
  - `oracleSignature[8]`: Oracle's signature (8x32-bit chunks)

- **Private Inputs** (hidden in proof):
  - `realValue`: Actual transaction value
  - `realTimestamp`: Actual transaction timestamp
  - `txHash[8]`: Transaction hash (8x32-bit chunks)

## Testing Circuit

Test with sample inputs:

```bash
# Create input.json
cat > input.json << EOF
{
  "claimedAmount": "1000000000000000000",
  "minDate": "1234567890",
  "oracleSignature": ["1", "2", "3", "4", "5", "6", "7", "8"],
  "realValue": "2000000000000000000",
  "realTimestamp": "1234567900",
  "txHash": ["10", "20", "30", "40", "50", "60", "70", "80"]
}
EOF

# Generate witness
snarkjs wtns calculate public/zk/receipt.wasm input.json witness.wtns

# Generate proof
snarkjs groth16 prove public/zk/receipt_final.zkey witness.wtns proof.json public.json

# Verify proof
snarkjs groth16 verify public/zk/verification_key.json public.json proof.json
```

## Circuit Info

View circuit statistics:

```bash
snarkjs r1cs info public/zk/receipt.r1cs
```

This shows:
- Number of constraints
- Number of private inputs
- Number of public inputs
- Number of wires

## Troubleshooting

### "circom: command not found"

Install circom from source:
```bash
git clone https://github.com/iden3/circom.git
cd circom
cargo build --release
sudo cp target/release/circom /usr/local/bin/
```

### "snarkjs: command not found"

Install snarkjs globally:
```bash
npm install -g snarkjs
```

### "Powers of Tau download failed"

Manually download:
```bash
wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_14.ptau
mv powersOfTau28_hez_final_14.ptau public/zk/
```

### "Constraint not satisfied"

Check input values:
- Ensure `realValue >= claimedAmount`
- Ensure `realTimestamp >= minDate`
- Ensure `oracleSignature` is non-zero

## Production Considerations

1. **Trusted Setup**: For production, use a multi-party ceremony for phase 2
2. **Circuit Auditing**: Have circuit audited by ZK experts
3. **WASM Size**: Optimize circuit to reduce WASM size for browser loading
4. **Proof Time**: Test proof generation time on target devices
5. **Verification Gas**: If using on-chain verification, optimize Solidity verifier

## References

- [Circom Documentation](https://docs.circom.io/)
- [snarkjs Documentation](https://github.com/iden3/snarkjs)
- [Groth16 Paper](https://eprint.iacr.org/2016/260.pdf)
- [Powers of Tau Ceremony](https://github.com/iden3/snarkjs#7-prepare-phase-2)
