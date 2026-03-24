import { buildWitness, validateWitness, extractPublicSignals } from '@ghostreceipt/zk-core/witness';
import type { OraclePayload } from '@/lib/validation/schemas';
import type { UserClaim } from '@ghostreceipt/zk-core/witness';

describe('Witness Builder', () => {
  const mockOraclePayload: OraclePayload = {
    chain: 'ethereum',
    txHash: '0x' + 'a'.repeat(64),
    valueAtomic: '1000000000000000000',
    timestampUnix: 1234567890,
    confirmations: 12,
    expiresAt: 1234568190,
    messageHash: '123456789012345678901234567890',
    nullifier: 'e'.repeat(64),
    nonce: 'b'.repeat(32),
    oracleSignature: 'c'.repeat(128),
    oraclePubKeyId: 'd'.repeat(16),
    signedAt: 1234567890,
  };

  describe('buildWitness', () => {
    it('should build valid witness from oracle payload and user claim', () => {
      const userClaim: UserClaim = {
        claimedAmount: '500000000000000000',
        minDate: 1234567800,
      };

      const witness = buildWitness(mockOraclePayload, userClaim);

      expect(witness.claimedAmount).toBe(userClaim.claimedAmount);
      expect(witness.minDate).toBe(userClaim.minDate.toString());
      expect(witness.oracleCommitment).toBe(mockOraclePayload.messageHash);
      expect(witness.realValue).toBe(mockOraclePayload.valueAtomic);
      expect(witness.realTimestamp).toBe(mockOraclePayload.timestampUnix.toString());
      expect(witness.txHash).toHaveLength(8);
      expect(witness.chainId).toBe('1');
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
        expect(BigInt(chunk)).toBeGreaterThanOrEqual(0n);
      });
    });

    it('should reject unsupported chains for current circuit', () => {
      const userClaim: UserClaim = {
        claimedAmount: '1',
        minDate: 1,
      };

      const solanaPayload = {
        ...mockOraclePayload,
        chain: 'solana' as const,
      };

      expect(() => buildWitness(solanaPayload, userClaim)).toThrow(
        'Unsupported chain for current receipt circuit'
      );
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
        claimedAmount: '2000000000000000000',
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
        minDate: 1234567900,
      };

      const witness = buildWitness(mockOraclePayload, userClaim);
      const result = validateWitness(witness);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('Real timestamp')
      );
    });

    it('should reject witness with non-positive oracle commitment', () => {
      const userClaim: UserClaim = {
        claimedAmount: '500000000000000000',
        minDate: 1234567800,
      };

      const witness = buildWitness(mockOraclePayload, userClaim);
      witness.oracleCommitment = '0';

      const result = validateWitness(witness);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Oracle commitment must be positive');
    });

    it('should reject witness with wrong txHash length', () => {
      const userClaim: UserClaim = {
        claimedAmount: '500000000000000000',
        minDate: 1234567800,
      };

      const witness = buildWitness(mockOraclePayload, userClaim);
      witness.txHash = ['1', '2'];

      const result = validateWitness(witness);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('Transaction hash must have 8 chunks')
      );
    });

    it('should reject witness with invalid chain ID', () => {
      const userClaim: UserClaim = {
        claimedAmount: '500000000000000000',
        minDate: 1234567800,
      };

      const witness = buildWitness(mockOraclePayload, userClaim);
      witness.chainId = '3';

      const result = validateWitness(witness);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('Chain ID must be 0 (bitcoin) or 1 (ethereum)')
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

      expect(publicSignals).toHaveLength(3);
      expect(publicSignals[0]).toBe(witness.claimedAmount);
      expect(publicSignals[1]).toBe(witness.minDate);
      expect(publicSignals[2]).toBe(witness.oracleCommitment);
    });
  });
});
