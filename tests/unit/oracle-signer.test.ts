import { OracleSigner } from '@/lib/oracle/signer';

describe('OracleSigner', () => {
  const testPrivateKey = 'a'.repeat(64);
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

  describe('getPublicKeyId', () => {
    it('should derive deterministic key ID for the same key', () => {
      const signerA = new OracleSigner('1'.repeat(64));
      const signerB = new OracleSigner('1'.repeat(64));

      expect(signerA.getPublicKeyId()).toBe(signerB.getPublicKeyId());
      expect(signerA.getPublicKeyId()).toHaveLength(16);
    });

    it('should derive different key IDs for different keys', () => {
      const signerA = new OracleSigner('1'.repeat(64));
      const signerB = new OracleSigner('2'.repeat(64));

      expect(signerA.getPublicKeyId()).not.toBe(signerB.getPublicKeyId());
    });

    it('should derive same key ID from exported public key', () => {
      const privateKey = '1'.repeat(64);
      const signerInstance = new OracleSigner(privateKey);
      const publicKeyHex = OracleSigner.derivePublicKeyHex(privateKey);

      expect(OracleSigner.derivePublicKeyIdFromHex(publicKeyHex)).toBe(
        signerInstance.getPublicKeyId()
      );
    });
  });

  describe('sign', () => {
    it('should create signature for message hash', () => {
      const messageHash = '12345678901234567890';
      const signature = signer.sign(messageHash);

      expect(signature).toHaveLength(128); // Ed25519 signature hex
      expect(signature).toMatch(/^[a-f0-9]{128}$/i);
    });

    it('should create same signature for same hash', () => {
      const messageHash = '12345678901234567890';
      const sig1 = signer.sign(messageHash);
      const sig2 = signer.sign(messageHash);

      expect(sig1).toBe(sig2);
    });
  });

  describe('verifySignature', () => {
    it('should verify valid signature', () => {
      const messageHash = '12345678901234567890';
      const signature = signer.sign(messageHash);
      const isValid = signer.verifySignature(
        messageHash,
        signature,
        signer.getPublicKeyId()
      );

      expect(isValid).toBe(true);
    });

    it('should reject tampered signature', () => {
      const messageHash = '12345678901234567890';
      const signature = signer.sign(messageHash);
      const tampered = `${signature.slice(0, 127)}${signature[127] === 'a' ? 'b' : 'a'}`;
      const isValid = signer.verifySignature(messageHash, tampered, signer.getPublicKeyId());

      expect(isValid).toBe(false);
    });

    it('should reject tampered message hash', () => {
      const messageHash = '12345678901234567890';
      const signature = signer.sign(messageHash);
      const isValid = signer.verifySignature(
        '99999999999999999999',
        signature,
        signer.getPublicKeyId()
      );

      expect(isValid).toBe(false);
    });

    it('should reject mismatched key IDs', () => {
      const messageHash = '12345678901234567890';
      const signature = signer.sign(messageHash);
      const isValid = signer.verifySignature(messageHash, signature, 'f'.repeat(16));

      expect(isValid).toBe(false);
    });

    it('should verify signatures with public key only', () => {
      const privateKey = '1'.repeat(64);
      const signerInstance = new OracleSigner(privateKey);
      const publicKeyHex = OracleSigner.derivePublicKeyHex(privateKey);
      const messageHash = '12345678901234567890';
      const signature = signerInstance.sign(messageHash);

      expect(
        OracleSigner.verifySignatureWithPublicKey(messageHash, signature, publicKeyHex)
      ).toBe(true);
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
