import { buildWitness, validateWitness, extractPublicSignals } from '@/lib/zk/witness';
import type { OraclePayloadV1 } from '@/lib/validation/schemas';
import type { UserClaim } from '@/lib/zk/witness';

describe('Witness Builder', () => {
  const mockOraclePayload: OraclePayloadV1 = {
    chain: 'ethereum',
    txHash: '0x' + 'a'.repeat(64),
    valueAtomic: '1000000000000000000', // 1 ETH in wei
    timestampUnix: 1234567890,
    confirmations: 12,
    messageHash: 'b'.repeat(64),
    oracleSignature: 'c'.repeat(64),
    oraclePubKeyId: 'd'.repeat(16),
    schemaVersion: 'v1',
    signedAt: 1234567890,
  };

  describe('buildWitness', () => {
    it('should build valid witness from oracle payload and user claim', () => {
      const userClaim: UserClaim = {
        claimedAmount: '500000000000000000', // 0.5 ETH
        minDate: 1234567800,
      };

      const witness = buildWitness(mockOraclePayload, userClaim);

      expect(witness.claimedAmount).toBe(userClaim.claimedAmount);
      expect(witness.minDate).toBe(userClaim.minDate.toString());
      expect(witness.realValue).toBe(mockOraclePayload.valueAtomic);
      expect(witness.realTimestamp).toBe(mockOraclePayload.timestampUnix.toString());
      expect(witness.oracleSignature).toHaveLength(8);
      expect(witness.txHash).toHaveLength(8);
    });

    it('should convert hex signature to 8 chunks', () => {
      const userClaim: UserClaim = {
        claimedAmount: '1',
        minDate: 1,
      };

      const witness = buildWitness(mockOraclePayload, userClaim);

      expect(witness.oracleSignature).toHaveLength(8);
      witness.oracleSignature.forEach((chunk) => {
        expect(typeof chunk).toBe('string');
        expect(BigInt(chunk)).toBeGreaterThanOrEqual(0);
      });
    });

    it('should convert hex txHash to 8 chunks', () => {
      const userClaim: UserClaim = {
        claimedAmount: '1',
        minDate: 1,
      };

      const witness = buildWitness(mockOraclePayload, userClaim);

      expect(witness.txHash).toHaveLength(8);
      witness.txHash.forEach((chunk) => {
        expect(typeof chunk).toBe('string');
        expect(BigInt(chunk)).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('validateWitness', () => {
    it('should validate correct witness', () => {
      const userClaim: UserClaim = {
        claimedAmount: '500000000000000000',
        minDate: 1234567800,
      };

      const witness = buildWitness(mockOraclePayload, userClaim);
      const result = validateWitness(witness);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject witness with claimedAmount > realValue', () => {
      const userClaim: UserClaim = {
        claimedAmount: '2000000000000000000', // 2 ETH (more than real)
        minDate: 1234567800,
      };

      const witness = buildWitness(mockOraclePayload, userClaim);
      const result = validateWitness(witness);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('Real value')
      );
    });

    it('should reject witness with minDate > realTimestamp', () => {
      const userClaim: UserClaim = {
        claimedAmount: '500000000000000000',
        minDate: 1234567900, // After real timestamp
      };

      const witness = buildWitness(mockOraclePayload, userClaim);
      const result = validateWitness(witness);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('Real timestamp')
      );
    });

    it('should reject witness with zero signature', () => {
      const userClaim: UserClaim = {
        claimedAmount: '500000000000000000',
        minDate: 1234567800,
      };

      const witness = buildWitness(mockOraclePayload, userClaim);
      witness.oracleSignature = ['0', '0', '0', '0', '0', '0', '0', '0'];

      const result = validateWitness(witness);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Oracle signature is zero');
    });

    it('should reject witness with wrong signature length', () => {
      const userClaim: UserClaim = {
        claimedAmount: '500000000000000000',
        minDate: 1234567800,
      };

      const witness = buildWitness(mockOraclePayload, userClaim);
      witness.oracleSignature = ['1', '2', '3']; // Wrong length

      const result = validateWitness(witness);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('Oracle signature must have 8 chunks')
      );
    });

    it('should reject witness with wrong txHash length', () => {
      const userClaim: UserClaim = {
        claimedAmount: '500000000000000000',
        minDate: 1234567800,
      };

      const witness = buildWitness(mockOraclePayload, userClaim);
      witness.txHash = ['1', '2']; // Wrong length

      const result = validateWitness(witness);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('Transaction hash must have 8 chunks')
      );
    });
  });

  describe('extractPublicSignals', () => {
    it('should extract public signals in correct order', () => {
      const userClaim: UserClaim = {
        claimedAmount: '500000000000000000',
        minDate: 1234567800,
      };

      const witness = buildWitness(mockOraclePayload, userClaim);
      const publicSignals = extractPublicSignals(witness);

      expect(publicSignals).toHaveLength(10); // claimedAmount + minDate + 8 signature chunks
      expect(publicSignals[0]).toBe(witness.claimedAmount);
      expect(publicSignals[1]).toBe(witness.minDate);
      expect(publicSignals.slice(2)).toEqual(witness.oracleSignature);
    });
  });
});
