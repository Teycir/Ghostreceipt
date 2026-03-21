import { createHash, createHmac, randomBytes } from 'crypto';
import type { CanonicalTxData, OraclePayloadV1 } from '@/lib/validation/schemas';

/**
 * Oracle signer for canonical transaction data
 */
export class OracleSigner {
  private privateKey: string;
  private pubKeyId: string;

  constructor(privateKey: string) {
    if (!privateKey || privateKey.length !== 64) {
      throw new Error('Invalid oracle private key: must be 64 hex characters');
    }

    this.privateKey = privateKey;
    this.pubKeyId = this.derivePublicKeyId(privateKey);
  }

  /**
   * Derive public key ID from private key (for identification)
   */
  private derivePublicKeyId(privateKey: string): string {
    const hash = createHash('sha256').update(privateKey).digest('hex');
    return hash.substring(0, 16); // First 16 chars as ID
  }

  /**
   * Create deterministic message hash from canonical data
   */
  createMessageHash(data: CanonicalTxData): string {
    // Deterministic serialization
    const message = [
      data.chain,
      data.txHash,
      data.valueAtomic,
      data.timestampUnix.toString(),
      data.confirmations.toString(),
      data.blockNumber?.toString() || '',
      data.blockHash || '',
    ].join('|');

    return createHash('sha256').update(message).digest('hex');
  }

  /**
   * Sign message hash with HMAC-SHA256
   */
  sign(messageHash: string): string {
    const hmac = createHmac('sha256', Buffer.from(this.privateKey, 'hex'));
    hmac.update(messageHash);
    return hmac.digest('hex');
  }

  /**
   * Sign canonical transaction data and create Oracle payload
   */
  signCanonicalData(data: CanonicalTxData): OraclePayloadV1 {
    const messageHash = this.createMessageHash(data);
    const signature = this.sign(messageHash);
    const signedAt = Math.floor(Date.now() / 1000);

    return {
      ...data,
      messageHash,
      oracleSignature: signature,
      oraclePubKeyId: this.pubKeyId,
      schemaVersion: 'v1',
      signedAt,
    };
  }

  /**
   * Verify signature (for testing)
   */
  verify(payload: OraclePayloadV1): boolean {
    const expectedHash = this.createMessageHash(payload);
    const expectedSignature = this.sign(expectedHash);

    return (
      payload.messageHash === expectedHash &&
      payload.oracleSignature === expectedSignature &&
      payload.oraclePubKeyId === this.pubKeyId
    );
  }

  /**
   * Generate new oracle private key (for setup)
   */
  static generatePrivateKey(): string {
    return randomBytes(32).toString('hex');
  }
}
