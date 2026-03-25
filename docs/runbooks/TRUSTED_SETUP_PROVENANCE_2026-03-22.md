# Trusted Setup Provenance Record (2026-03-22)

This record is completed from the current local artifact set.

## Metadata

- Date (UTC): `2026-03-25T01:15:00Z`
- Operator: `teycir`
- Environment: local workstation (`<repo-root>/GhostReceipt`)
- Circuit file: `circuits/receipt.circom`
- Circuit git commit: `f3b541101d2a839157bf8ab26b07aff41248634e`
- Circom version: `2.2.3`
- snarkjs version: `0.7.6` (`snarkjs@0.7.6`)

## Circuit Inputs/Shape

- Public signals order: `[claimedAmount, minDate, oracleCommitment]`
- Private witness fields: `[realValue, realTimestamp, txHash[8], chainId]`
- Constraint summary:
  - `realValue >= claimedAmount`
  - `realTimestamp >= minDate`
  - `chainId` enum (`0|1|2`)
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
  - `a25b914a24b0350a232719d2673c01c8eced187f260154436cc8366fb17a68fe`
- Verification key SHA-256:
  - `070e1417683d844eaf6a65aef9436a8d4292f26bc10279a276fcd2fbd6547d09`
- Verification command:
  - `snarkjs zkey verify public/zk/receipt.r1cs public/zk/pot14_final.ptau public/zk/receipt_final.zkey`
- Verification result:
  - `ZKey Ok!`

## Output Artifacts

- `public/zk/receipt.r1cs`
  - `3e996688b8a6e5803e273c626e6c69db5db0a87491e3be679f9cf0ba38cbeb4e`
- `public/zk/receipt_js/receipt.wasm`
  - `6fd786dc9211b3e2f7c1889653b9620b19f90d030d49704adc2b902176acf97b`
- `public/zk/receipt_final.zkey`
  - `a25b914a24b0350a232719d2673c01c8eced187f260154436cc8366fb17a68fe`
- `public/zk/verification_key.json`
  - `070e1417683d844eaf6a65aef9436a8d4292f26bc10279a276fcd2fbd6547d09`
- `public/zk/Verifier.sol`
  - `2b78a0b25d5c6453a01ba303073e17f65d9932dfc5fbbfee7cc2927105c92e21`

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
npm run check:zk-artifact-checksums
```

## Review & Approval

- Security reviewer: pending
- Cryptography reviewer: pending
- Approval date: pending
- Notes:
  - This record documents a local fallback trusted setup path suitable for pre-release/testing.
  - For production release posture, prefer a public multi-party ceremony and published transcript/provenance.
