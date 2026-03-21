import { buildWitness, validateWitness } from '@/lib/zk/witness';
import type { OraclePayloadV1 } from '@/lib/validation/schemas';

describe('Generator Form Integration', () => {
  const mockOraclePayload: OraclePayloadV1 = {
    version: '1',
    chain: 'bitcoin',
    txHash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    valueAtomic: '100000000',
    timestampUnix: 1700000000,
    confirmations: 6,
    oracleSignature: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    oraclePublicKeyId: 'test-key-1',
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
      expect(witness.realValue).toBe('100000000');
      expect(witness.realTimestamp).toBe('1700000000');
      expect(witness.oracleSignature).toHaveLength(8);
      expect(witness.txHash).toHaveLength(8);
    });

    it('should convert hex strings to decimal chunks', () => {
      const witness = buildWitness(mockOraclePayload, {
        claimedAmount: '1000',
        minDate: 1000000,
      });

      witness.oracleSignature.forEach(chunk => {
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

    it('should reject witness with zero signature', () => {
      const zeroSigPayload: OraclePayloadV1 = {
        ...mockOraclePayload,
        oracleSignature: '0000000000000000000000000000000000000000000000000000000000000000',
      };

      const witness = buildWitness(zeroSigPayload, {
        claimedAmount: '50000000',
        minDate: 1699999000,
      });

      const validation = validateWitness(witness);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('signature is zero'))).toBe(true);
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
