import { OracleSigner } from '@/lib/oracle/signer';
import type { CanonicalTxData } from '@/lib/validation/schemas';

describe('OracleSigner', () => {
  const testPrivateKey = 'a'.repeat(64); // Valid 64 hex char key
  let signer: OracleSigner;

  beforeEach(() => {
    signer = new OracleSigner(testPrivateKey);
  });

  describe('constructor', () => {
    it('should create signer with valid private key', () => {
      expect(signer).toBeInstanceOf(OracleSigner);
    });

    it('should throw error for invalid private key length', () => {
      expect(() => new OracleSigner('short')).toThrow('Invalid oracle private key');
    });

    it('should throw error for empty private key', () => {
      expect(() => new OracleSigner('')).toThrow('Invalid oracle private key');
    });
  });

  describe('createMessageHash', () => {
    it('should create deterministic hash for same data', () => {
      const data: CanonicalTxData = {
        chain: 'bitcoin',
        txHash: 'abc123',
        valueAtomic: '100000000',
        timestampUnix: 1234567890,
        confirmations: 6,
      };

      const hash1 = signer.createMessageHash(data);
      const hash2 = signer.createMessageHash(data);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA256 hex
    });

    it('should create different hashes for different data', () => {
      const data1: CanonicalTxData = {
        chain: 'bitcoin',
        txHash: 'abc123',
        valueAtomic: '100000000',
        timestampUnix: 1234567890,
        confirmations: 6,
      };

      const data2: CanonicalTxData = {
        ...data1,
        valueAtomic: '200000000',
      };

      const hash1 = signer.createMessageHash(data1);
      const hash2 = signer.createMessageHash(data2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('sign', () => {
    it('should create signature for message hash', () => {
      const messageHash = 'a'.repeat(64);
      const signature = signer.sign(messageHash);

      expect(signature).toHaveLength(64); // HMAC-SHA256 hex
    });

    it('should create same signature for same hash', () => {
      const messageHash = 'a'.repeat(64);
      const sig1 = signer.sign(messageHash);
      const sig2 = signer.sign(messageHash);

      expect(sig1).toBe(sig2);
    });
  });

  describe('signCanonicalData', () => {
    it('should create valid signed payload', () => {
      const data: CanonicalTxData = {
        chain: 'ethereum',
        txHash: '0x' + 'a'.repeat(64),
        valueAtomic: '1000000000000000000',
        timestampUnix: 1234567890,
        confirmations: 12,
        blockNumber: 12345,
      };

      const payload = signer.signCanonicalData(data);

      expect(payload).toMatchObject(data);
      expect(payload.messageHash).toHaveLength(64);
      expect(payload.oracleSignature).toHaveLength(64);
      expect(payload.oraclePubKeyId).toHaveLength(16);
      expect(payload.schemaVersion).toBe('v1');
      expect(payload.signedAt).toBeGreaterThan(0);
    });
  });

  describe('verify', () => {
    it('should verify valid signature', () => {
      const data: CanonicalTxData = {
        chain: 'bitcoin',
        txHash: 'abc123',
        valueAtomic: '100000000',
        timestampUnix: 1234567890,
        confirmations: 6,
      };

      const payload = signer.signCanonicalData(data);
      const isValid = signer.verify(payload);

      expect(isValid).toBe(true);
    });

    it('should reject tampered signature', () => {
      const data: CanonicalTxData = {
        chain: 'bitcoin',
        txHash: 'abc123',
        valueAtomic: '100000000',
        timestampUnix: 1234567890,
        confirmations: 6,
      };

      const payload = signer.signCanonicalData(data);
      payload.oracleSignature = 'b'.repeat(64); // Tamper

      const isValid = signer.verify(payload);

      expect(isValid).toBe(false);
    });

    it('should reject tampered data', () => {
      const data: CanonicalTxData = {
        chain: 'bitcoin',
        txHash: 'abc123',
        valueAtomic: '100000000',
        timestampUnix: 1234567890,
        confirmations: 6,
      };

      const payload = signer.signCanonicalData(data);
      payload.valueAtomic = '200000000'; // Tamper

      const isValid = signer.verify(payload);

      expect(isValid).toBe(false);
    });
  });

  describe('generatePrivateKey', () => {
    it('should generate valid private key', () => {
      const key = OracleSigner.generatePrivateKey();

      expect(key).toHaveLength(64);
      expect(key).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate unique keys', () => {
      const key1 = OracleSigner.generatePrivateKey();
      const key2 = OracleSigner.generatePrivateKey();

      expect(key1).not.toBe(key2);
    });
  });
});
