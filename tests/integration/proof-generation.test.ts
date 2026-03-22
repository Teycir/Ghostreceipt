import { buildWitness, validateWitness } from '@/lib/zk/witness';
import { ProofGenerator } from '@/lib/zk/prover';
import type { OraclePayloadV1 } from '@/lib/validation/schemas';

describe('End-to-End Proof Generation', () => {
  const mockOraclePayload: OraclePayloadV1 = {
    chain: 'bitcoin',
    txHash: 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd',
    valueAtomic: '100000000',
    timestampUnix: 1700000000,
    confirmations: 6,
    messageHash: '12345678901234567890',
    oracleSignature: 'f1e2d3c4b5a69780123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    oraclePubKeyId: 'test-key-1',
    schemaVersion: 'v1',
    signedAt: 1700000100,
  };

  describe('Proof Generation Flow', () => {
    it('should build and validate witness successfully', () => {
      const witness = buildWitness(mockOraclePayload, {
        claimedAmount: '50000000',
        minDate: 1699999000,
      });

      const validation = validateWitness(witness);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should export and import proof format', () => {
      const prover = new ProofGenerator(
        '/zk/receipt_js/receipt.wasm',
        '/zk/receipt_final.zkey',
        '/zk/verification_key.json'
      );

      const mockProof = {
        proof: {
          pi_a: ['1', '2', '3'],
          pi_b: [['4', '5'], ['6', '7']],
          pi_c: ['8', '9', '10'],
          protocol: 'groth16',
          curve: 'bn128',
        },
        publicSignals: ['100', '200', '300'],
      };

      const exported = prover.exportProof(mockProof);
      expect(typeof exported).toBe('string');

      const imported = prover.importProof(exported);
      expect(imported).toEqual(mockProof);
    });

    it('should reject invalid proof format on import', () => {
      const prover = new ProofGenerator(
        '/zk/receipt_js/receipt.wasm',
        '/zk/receipt_final.zkey',
        '/zk/verification_key.json'
      );

      expect(() => {
        prover.importProof('invalid json');
      }).toThrow('Failed to import proof');

      expect(() => {
        prover.importProof('{"invalid": "format"}');
      }).toThrow('Invalid proof format');
    });
  });

  describe('Witness Validation Edge Cases', () => {
    it('should handle maximum safe integer values', () => {
      const largeValuePayload: OraclePayloadV1 = {
        ...mockOraclePayload,
        valueAtomic: '9007199254740991',
        timestampUnix: 2147483647,
      };

      const witness = buildWitness(largeValuePayload, {
        claimedAmount: '9007199254740990',
        minDate: 2147483646,
      });

      const validation = validateWitness(witness);
      expect(validation.valid).toBe(true);
    });

    it('should handle minimum values', () => {
      const minValuePayload: OraclePayloadV1 = {
        ...mockOraclePayload,
        valueAtomic: '1',
        timestampUnix: 1,
      };

      const witness = buildWitness(minValuePayload, {
        claimedAmount: '1',
        minDate: 1,
      });

      const validation = validateWitness(witness);
      expect(validation.valid).toBe(true);
    });

    it('should detect array length mismatches', () => {
      const witness = buildWitness(mockOraclePayload, {
        claimedAmount: '50000000',
        minDate: 1699999000,
      });

      witness.txHash = ['1', '2', '3'];

      const validation = validateWitness(witness);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('must have 8 chunks'))).toBe(true);
    });
  });
});
