import { z } from 'zod';
import { OracleCommitmentSchema } from '@/lib/validation/schemas';
import { OracleSigner } from '@/lib/oracle/signer';
import { safeHexEqual } from '@/lib/security/safe-compare';
import { getCachedOracleSignerFromEnv } from '@/lib/libraries/backend/oracle-signer-cache';

export const VerifySignatureRequestSchema = z.object({
  messageHash: OracleCommitmentSchema,
  oracleSignature: z.string().regex(/^[a-f0-9]{128}$/i),
  oraclePubKeyId: z.string().regex(/^[a-f0-9]{16}$/i),
  signedAt: z.number().int().positive(),
});

export type VerifySignatureRequest = z.infer<typeof VerifySignatureRequestSchema>;

export interface VerifySignatureOptions {
  missingKeyMessage?: string;
  oraclePrivateKey?: string;
  oraclePublicKey?: string;
}

export type VerifySignatureOutcome =
  | { kind: 'verified'; valid: boolean }
  | { kind: 'config_error'; message: string };

const DEFAULT_MISSING_KEY_MESSAGE =
  'Oracle key not configured (set ORACLE_PUBLIC_KEY or ORACLE_PRIVATE_KEY)';

export function verifyOracleSignature(
  payload: VerifySignatureRequest,
  options: VerifySignatureOptions = {}
): VerifySignatureOutcome {
  const oraclePublicKey = options.oraclePublicKey ?? process.env['ORACLE_PUBLIC_KEY'];
  if (oraclePublicKey) {
    const expectedPubKeyId = OracleSigner.derivePublicKeyIdFromHex(oraclePublicKey);
    if (!safeHexEqual(expectedPubKeyId, payload.oraclePubKeyId)) {
      return { kind: 'verified', valid: false };
    }

    return {
      kind: 'verified',
      valid: OracleSigner.verifySignatureWithPublicKey(
        payload.messageHash,
        payload.oracleSignature,
        oraclePublicKey
      ),
    };
  }

  const missingKeyMessage = options.missingKeyMessage ?? DEFAULT_MISSING_KEY_MESSAGE;
  const oraclePrivateKey = options.oraclePrivateKey ?? process.env['ORACLE_PRIVATE_KEY'];

  if (!oraclePrivateKey) {
    return {
      kind: 'config_error',
      message: missingKeyMessage,
    };
  }

  if (options.oraclePrivateKey !== undefined) {
    const signer = new OracleSigner(oraclePrivateKey);
    return {
      kind: 'verified',
      valid: signer.verifySignature(
        payload.messageHash,
        payload.oracleSignature,
        payload.oraclePubKeyId
      ),
    };
  }

  const signer = getCachedOracleSignerFromEnv({
    missingKeyMessage,
  });
  return {
    kind: 'verified',
    valid: signer.verifySignature(
      payload.messageHash,
      payload.oracleSignature,
      payload.oraclePubKeyId
    ),
  };
}
