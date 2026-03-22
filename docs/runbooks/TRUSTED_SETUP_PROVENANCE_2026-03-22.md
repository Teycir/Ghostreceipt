# Trusted Setup Provenance Record (2026-03-22)

This record is completed from the current local artifact set.

## Metadata

- Date (UTC): `2026-03-22T00:36:50Z`
- Operator: `teycir`
- Environment: local workstation (`/home/teycir/Repos/GhostReceipt`)
- Circuit file: `circuits/receipt.circom`
- Circuit git commit: `524e27eef4d87aec19890d4d47a3c43979a4dde4`
- Circom version: `2.2.3`
- snarkjs version: `0.7.6`

## Circuit Inputs/Shape

- Public signals order: `[claimedAmount, minDate, oracleCommitment]`
- Private witness fields: `[realValue, realTimestamp, txHash[8], chainId]`
- Constraint summary:
  - `realValue >= claimedAmount`
  - `realTimestamp >= minDate`
  - `chainId` boolean (`0|1`)
  - `oracleCommitment == Poseidon(realValue, realTimestamp, Poseidon(txHash[8]), chainId)`

## Phase 1 (Powers of Tau)

- Source type: locally generated fallback
- Source file: `public/zk/pot14_final.ptau`
- Source URL: N/A (local generation path)
- SHA-256:
  - `c7affc029088a0cb230559d6080713645ba9cb9ad5381f62305e2c700d30bc90`
- Verification command:
  - `snarkjs powersoftau verify public/zk/pot14_final.ptau`
- Verification result:
  - `Powers Of tau file OK!`
  - `Powers of Tau Ok!`

## Phase 2 (Circuit-Specific Ceremony)

- Initial zkey: `public/zk/receipt_0000.zkey` (intermediate, removed after contribution)
- Final zkey: `public/zk/receipt_final.zkey`
- Final zkey SHA-256:
  - `17dd9b629f0e36e559ec881c17130087d6cb246b06c70b67c6c80969d462766b`
- Verification key SHA-256:
  - `badfb18626058cd9878bf9a9bc185340eac98427807de3c7749b093e1f4496c8`
- Verification command:
  - `snarkjs zkey verify public/zk/receipt.r1cs public/zk/pot14_final.ptau public/zk/receipt_final.zkey`
- Verification result:
  - `ZKey Ok!`

## Output Artifacts

- `public/zk/receipt.r1cs`
  - `7683535cc05491854fb1be32055d7540318e2f141c3c3282c9e5e4f40d301b63`
- `public/zk/receipt_js/receipt.wasm`
  - `e82ffea4a215866540949e30b4b602684267a06b6a3985dd35f1a4102571176a`
- `public/zk/receipt_final.zkey`
  - `17dd9b629f0e36e559ec881c17130087d6cb246b06c70b67c6c80969d462766b`
- `public/zk/verification_key.json`
  - `badfb18626058cd9878bf9a9bc185340eac98427807de3c7749b093e1f4496c8`
- `public/zk/Verifier.sol`
  - Not present in current tracked artifact set (optional output).

## Reproducibility Commands

```bash
circom --version
snarkjs --version
sha256sum public/zk/receipt.r1cs \
  public/zk/receipt_js/receipt.wasm \
  public/zk/receipt_final.zkey \
  public/zk/verification_key.json \
  public/zk/pot14_final.ptau
snarkjs powersoftau verify public/zk/pot14_final.ptau
snarkjs zkey verify public/zk/receipt.r1cs public/zk/pot14_final.ptau public/zk/receipt_final.zkey
```

## Review & Approval

- Security reviewer: pending
- Cryptography reviewer: pending
- Approval date: pending
- Notes:
  - This record documents a local fallback trusted setup path suitable for pre-release/testing.
  - For production release posture, prefer a public multi-party ceremony and published transcript/provenance.
