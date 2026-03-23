import { z } from 'zod';
import {
  OracleCommitmentSchema,
  OracleNonceSchema,
  OraclePubKeyIdSchema,
  OracleSignatureHexSchema,
} from '@/lib/validation/schemas';
import { OracleSigner, type OracleAuthEnvelope } from '@/lib/oracle/signer';
import { safeHexEqual } from '@/lib/security/safe-compare';
import { getCachedOracleSignerFromEnv } from '@/lib/libraries/backend/oracle-signer-cache';
import {
  checkOracleKeyTransparencyValidity,
  type OracleTransparencyRejectReason,
} from './oracle-transparency-log';

export const VerifySignatureRequestSchema = z.object({
  messageHash: OracleCommitmentSchema,
  oracleSignature: OracleSignatureHexSchema,
  oraclePubKeyId: OraclePubKeyIdSchema,
  expiresAt: z.number().int().positive(),
  nonce: OracleNonceSchema,
  signedAt: z.number().int().positive(),
})
  .strict()
  .superRefine((data, ctx) => {
    if (data.expiresAt <= data.signedAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['expiresAt'],
        message: 'expiresAt must be greater than signedAt',
      });
    }
  });

export type VerifySignatureRequest = z.infer<typeof VerifySignatureRequestSchema>;

export interface VerifySignatureOptions {
  missingKeyMessage?: string;
  oraclePrivateKey?: string;
  oraclePublicKey?: string;
}

export type VerifySignatureOutcome =
  | {
      kind: 'verified';
      valid: boolean;
      reason?: OracleTransparencyRejectReason;
      message?: string;
    }
  | { kind: 'config_error'; message: string };

const DEFAULT_MISSING_KEY_MESSAGE =
  'Oracle key not configured (set ORACLE_PUBLIC_KEY or ORACLE_PRIVATE_KEY)';

function toAuthEnvelope(payload: VerifySignatureRequest): OracleAuthEnvelope {
  return {
    expiresAt: payload.expiresAt,
    messageHash: payload.messageHash,
    nonce: payload.nonce,
    oraclePubKeyId: payload.oraclePubKeyId,
    signedAt: payload.signedAt,
  };
}

function verifyWithPublicKey(
  payload: VerifySignatureRequest,
  oraclePublicKey: string
): boolean {
  const expectedPubKeyId = OracleSigner.derivePublicKeyIdFromHex(oraclePublicKey);
  if (!safeHexEqual(expectedPubKeyId, payload.oraclePubKeyId)) {
    return false;
  }

  return OracleSigner.verifyAuthEnvelopeWithPublicKey(
    toAuthEnvelope(payload),
    payload.oracleSignature,
    oraclePublicKey
  );
}

function verifyWithSigner(
  payload: VerifySignatureRequest,
  signer: OracleSigner
): boolean {
  return signer.verifyAuthEnvelope(
    toAuthEnvelope(payload),
    payload.oracleSignature
  );
}

export function verifyOracleSignature(
  payload: VerifySignatureRequest,
  options: VerifySignatureOptions = {}
): VerifySignatureOutcome {
  let signatureValid = false;
  const oraclePublicKey = options.oraclePublicKey ?? process.env['ORACLE_PUBLIC_KEY'];
  if (oraclePublicKey) {
    signatureValid = verifyWithPublicKey(payload, oraclePublicKey);
  } else {
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
      signatureValid = verifyWithSigner(payload, signer);
    } else {
      const signer = getCachedOracleSignerFromEnv({
        missingKeyMessage,
      });
      signatureValid = verifyWithSigner(payload, signer);
    }
  }

  if (!signatureValid) {
    return {
      kind: 'verified',
      valid: false,
    };
  }

  const transparencyCheck = checkOracleKeyTransparencyValidity({
    keyId: payload.oraclePubKeyId,
    signedAt: payload.signedAt,
  });
  if (!transparencyCheck.valid) {
    return {
      kind: 'verified',
      message: transparencyCheck.message,
      reason: transparencyCheck.reason,
      valid: false,
    };
  }

  return {
    kind: 'verified',
    valid: true,
  };
}
