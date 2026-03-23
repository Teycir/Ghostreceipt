import {
  createHash,
  createPrivateKey,
  createPublicKey,
  randomBytes,
  sign,
  verify,
  type KeyObject,
} from 'crypto';
import { safeHexEqual } from '@/lib/security/safe-compare';

const ED25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

export interface OracleAuthEnvelope {
  expiresAt: number;
  messageHash: string;
  nonce: string;
  oraclePubKeyId: string;
  signedAt: number;
}

/**
 * Oracle signer using asymmetric Ed25519 signatures.
 */
export class OracleSigner {
  private privateKey: KeyObject;
  private publicKey: KeyObject;
  private pubKeyId: string;

  constructor(privateKeyHex: string) {
    this.privateKey = OracleSigner.createPrivateKeyFromHex(privateKeyHex);
    this.publicKey = createPublicKey(this.privateKey);
    this.pubKeyId = this.derivePublicKeyId(this.publicKey);
  }

  getPublicKeyId(): string {
    return this.pubKeyId;
  }

  /**
   * Derive stable key ID from the public key material.
   */
  private derivePublicKeyId(publicKey: KeyObject): string {
    const rawPublicKey = OracleSigner.exportRawPublicKey(publicKey);
    const hash = createHash('sha256').update(rawPublicKey).digest('hex');
    return hash.substring(0, 16); // First 16 chars as ID
  }

  /**
   * Export 32-byte Ed25519 public key from SPKI DER.
   */
  private static exportRawPublicKey(publicKey: KeyObject): Buffer {
    const spkiDer = publicKey.export({
      format: 'der',
      type: 'spki',
    }) as Buffer;

    if (spkiDer.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)) {
      return spkiDer.subarray(ED25519_SPKI_PREFIX.length);
    }

    return spkiDer;
  }

  private static createPrivateKeyFromHex(privateKeyHex: string): KeyObject {
    if (!privateKeyHex || privateKeyHex.length !== 64 || !/^[a-f0-9]{64}$/i.test(privateKeyHex)) {
      throw new Error('Invalid oracle private key: must be 64 hex characters');
    }

    const seed = Buffer.from(privateKeyHex, 'hex');
    const privateKeyDer = Buffer.concat([ED25519_PKCS8_PREFIX, seed]);
    return createPrivateKey({
      key: privateKeyDer,
      format: 'der',
      type: 'pkcs8',
    });
  }

  private static createPublicKeyFromHex(publicKeyHex: string): KeyObject {
    if (!publicKeyHex || publicKeyHex.length !== 64 || !/^[a-f0-9]{64}$/i.test(publicKeyHex)) {
      throw new Error('Invalid oracle public key: must be 64 hex characters');
    }

    const publicKeyRaw = Buffer.from(publicKeyHex, 'hex');
    const spkiDer = Buffer.concat([ED25519_SPKI_PREFIX, publicKeyRaw]);
    return createPublicKey({
      key: spkiDer,
      format: 'der',
      type: 'spki',
    });
  }

  static derivePublicKeyHex(privateKeyHex: string): string {
    const privateKey = OracleSigner.createPrivateKeyFromHex(privateKeyHex);
    const publicKey = createPublicKey(privateKey);
    return OracleSigner.exportRawPublicKey(publicKey).toString('hex');
  }

  static derivePublicKeyIdFromHex(publicKeyHex: string): string {
    if (!publicKeyHex || publicKeyHex.length !== 64 || !/^[a-f0-9]{64}$/i.test(publicKeyHex)) {
      throw new Error('Invalid oracle public key: must be 64 hex characters');
    }

    const hash = createHash('sha256').update(Buffer.from(publicKeyHex, 'hex')).digest('hex');
    return hash.substring(0, 16);
  }

  static verifySignatureWithPublicKey(
    message: string,
    signatureHex: string,
    publicKeyHex: string
  ): boolean {
    if (!/^[a-f0-9]{128}$/i.test(signatureHex)) {
      return false;
    }

    try {
      const publicKey = OracleSigner.createPublicKeyFromHex(publicKeyHex);
      return verify(
        null,
        Buffer.from(message, 'utf8'),
        publicKey,
        Buffer.from(signatureHex, 'hex')
      );
    } catch {
      return false;
    }
  }

  /**
   * Sign message hash with Ed25519.
   */
  sign(message: string): string {
    const signature = sign(null, Buffer.from(message, 'utf8'), this.privateKey);
    return signature.toString('hex');
  }

  /**
   * Verify a provided signature over a message hash.
   */
  verifySignature(
    message: string,
    signatureHex: string,
    oraclePubKeyId?: string
  ): boolean {
    if (oraclePubKeyId && !safeHexEqual(oraclePubKeyId, this.pubKeyId)) {
      return false;
    }

    if (!/^[a-f0-9]{128}$/i.test(signatureHex)) {
      return false;
    }

    try {
      return OracleSigner.verifySignatureWithPublicKey(
        message,
        signatureHex,
        OracleSigner.exportRawPublicKey(this.publicKey).toString('hex')
      );
    } catch {
      return false;
    }
  }

  /**
   * Generate new oracle private key (for setup)
   */
  static generatePrivateKey(): string {
    return randomBytes(32).toString('hex');
  }

  static serializeAuthEnvelope(envelope: OracleAuthEnvelope): string {
    return [
      `messageHash=${envelope.messageHash}`,
      `nonce=${envelope.nonce}`,
      `signedAt=${envelope.signedAt}`,
      `expiresAt=${envelope.expiresAt}`,
      `oraclePubKeyId=${envelope.oraclePubKeyId}`,
    ].join('&');
  }

  signAuthEnvelope(
    envelope: Omit<OracleAuthEnvelope, 'oraclePubKeyId'>
  ): { envelope: OracleAuthEnvelope; oracleSignature: string } {
    const fullEnvelope: OracleAuthEnvelope = {
      ...envelope,
      oraclePubKeyId: this.pubKeyId,
    };

    return {
      envelope: fullEnvelope,
      oracleSignature: this.sign(OracleSigner.serializeAuthEnvelope(fullEnvelope)),
    };
  }

  verifyAuthEnvelope(
    envelope: OracleAuthEnvelope,
    signatureHex: string
  ): boolean {
    return this.verifySignature(
      OracleSigner.serializeAuthEnvelope(envelope),
      signatureHex,
      envelope.oraclePubKeyId
    );
  }

  static verifyAuthEnvelopeWithPublicKey(
    envelope: OracleAuthEnvelope,
    signatureHex: string,
    publicKeyHex: string
  ): boolean {
    return OracleSigner.verifySignatureWithPublicKey(
      OracleSigner.serializeAuthEnvelope(envelope),
      signatureHex,
      publicKeyHex
    );
  }
}
