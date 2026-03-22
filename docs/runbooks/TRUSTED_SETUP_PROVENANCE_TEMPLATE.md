# Trusted Setup Provenance Template

Use this template for each proving-artifact refresh and keep the completed record in version control.

---

## Metadata

- Date (UTC):
- Operator:
- Environment (local/CI/build host):
- Circuit file:
- Circuit git commit:
- Circom version:
- snarkjs version:

## Circuit Inputs/Shape

- Public signals order:
- Private witness fields:
- Constraint summary:

## Phase 1 (Powers of Tau)

- Source type:
  - [ ] Shared ceremony artifact
  - [ ] Locally generated fallback
- Source file name:
- Source URL (if shared):
- SHA-256 checksum:
- Verification command/output note:

## Phase 2 (Circuit-Specific Ceremony)

- `receipt_0000.zkey` generation timestamp:
- Contribution name(s):
- Contribution entropy source note:
- Final zkey file:
- Final zkey checksum (SHA-256):
- Verification key checksum (SHA-256):

## Output Artifacts

- `public/zk/receipt.r1cs` checksum:
- `public/zk/receipt_js/receipt.wasm` checksum:
- `public/zk/receipt_final.zkey` checksum:
- `public/zk/verification_key.json` checksum:
- `public/zk/Verifier.sol` checksum (if generated):

## Reproducibility Commands

```bash
circom --version
snarkjs --version
sha256sum public/zk/receipt.r1cs \
  public/zk/receipt_js/receipt.wasm \
  public/zk/receipt_final.zkey \
  public/zk/verification_key.json
```

## Review & Approval

- Security reviewer:
- Cryptography reviewer:
- Approval date:
- Notes:
