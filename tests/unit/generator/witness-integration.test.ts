import { buildWitness, validateWitness } from '@ghostreceipt/zk-core/witness';
import type { OraclePayload } from '@/lib/validation/schemas';

describe('Generator Form Integration', () => {
  const mockOraclePayload: OraclePayload = {
    chain: 'bitcoin',
    txHash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    valueAtomic: '100000000',
    timestampUnix: 1700000000,
    confirmations: 6,
    expiresAt: 1700000400,
    messageHash: '12345678901234567890',
    nullifier: 'e'.repeat(64),
    nonce: 'a'.repeat(32),
    oracleSignature: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    oraclePubKeyId: 'test-key-1',
    signedAt: 1700000100,
  };

  describe('buildWitness', () => {
    it('should build valid witness from oracle payload and user claim', () => {
      const witness = buildWitness(mockOraclePayload, {
        claimedAmount: '50000000',
        minDate: 1699999000,
      });

      expect(witness.claimedAmount).toBe('50000000');
      expect(witness.minDate).toBe('1699999000');
      expect(witness.oracleCommitment).toBe(mockOraclePayload.messageHash);
      expect(witness.realValue).toBe('100000000');
      expect(witness.realTimestamp).toBe('1700000000');
      expect(witness.txHash).toHaveLength(8);
      expect(witness.chainId).toBe('0');
    });

    it('should convert tx hash hex string to decimal chunks', () => {
      const witness = buildWitness(mockOraclePayload, {
        claimedAmount: '1000',
        minDate: 1000000,
      });

      witness.txHash.forEach(chunk => {
        expect(typeof chunk).toBe('string');
        expect(Number.isNaN(Number(chunk))).toBe(false);
      });
    });
  });

  describe('validateWitness', () => {
    it('should validate witness with valid constraints', () => {
      const witness = buildWitness(mockOraclePayload, {
        claimedAmount: '50000000',
        minDate: 1699999000,
      });

      const validation = validateWitness(witness);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject witness when claimed amount exceeds real value', () => {
      const witness = buildWitness(mockOraclePayload, {
        claimedAmount: '200000000',
        minDate: 1699999000,
      });

      const validation = validateWitness(witness);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors[0]).toContain('less than claimed amount');
    });

    it('should reject witness when minDate is after real timestamp', () => {
      const witness = buildWitness(mockOraclePayload, {
        claimedAmount: '50000000',
        minDate: 1800000000,
      });

      const validation = validateWitness(witness);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors[0]).toContain('before minimum date');
    });

    it('should reject witness with non-positive oracle commitment', () => {
      const invalidCommitmentPayload: OraclePayload = {
        ...mockOraclePayload,
        messageHash: '0',
      };

      const witness = buildWitness(invalidCommitmentPayload, {
        claimedAmount: '50000000',
        minDate: 1699999000,
      });

      const validation = validateWitness(witness);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('Oracle commitment must be positive'))).toBe(true);
    });

    it('should validate witness at boundary conditions', () => {
      const witness = buildWitness(mockOraclePayload, {
        claimedAmount: '100000000',
        minDate: 1700000000,
      });

      const validation = validateWitness(witness);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });
});
