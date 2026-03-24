import { extractOracleCommitment, extractVerifiedClaims } from '@/lib/zk/share';
import {
  checkClientNullifierConflict,
  deriveNullifierFromMessageHash,
  type NullifierStorageLike,
} from '@/lib/zk/nullifier';
import type { ShareableProofPayload, ProofGenerator } from '@/lib/zk/prover';

export interface OracleSignatureVerificationResult {
  valid: boolean;
  error?: string;
}

export interface ReceiptVerificationResult {
  valid: boolean;
  claimedAmount: string;
  minDate: string;
  receiptCategory?: string;
  receiptLabel?: string;
  error?: string;
}

interface OracleVerifyErrorPayload {
  error?: {
    message?: string;
    details?: {
      retryAfterSeconds?: number;
    };
  };
}

type ProofGeneratorLike = Pick<ProofGenerator, 'importProof' | 'verifyProof'>;

export interface VerifySharedReceiptOptions {
  createProofGenerator?: () => ProofGeneratorLike;
  signatureVerifier?: (
    oracleAuth: NonNullable<ShareableProofPayload['oracleAuth']>
  ) => Promise<OracleSignatureVerificationResult>;
  storage?: NullifierStorageLike | null;
}

function getDefaultStorage(): NullifierStorageLike | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage;
}

function rateLimitMessage(retryAfterSeconds?: number): string {
  const waitSeconds =
    typeof retryAfterSeconds === 'number' && retryAfterSeconds > 0
      ? Math.ceil(retryAfterSeconds)
      : 60;
  const waitLabel = waitSeconds === 1 ? '1 second' : `${waitSeconds} seconds`;
  return `Rate limit reached. Please wait ${waitLabel} and try again.`;
}

export async function verifyOracleSignatureViaApi(
  oracleAuth: NonNullable<ShareableProofPayload['oracleAuth']>
): Promise<OracleSignatureVerificationResult> {
  const { expiresAt, messageHash, nonce, oracleSignature, oraclePubKeyId, signedAt } = oracleAuth;
  const response = await fetch('/api/oracle/verify-signature', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      expiresAt,
      messageHash,
      nonce,
      oracleSignature,
      oraclePubKeyId,
      signedAt,
    }),
  });

  if (!response.ok) {
    try {
      const payload = (await response.json()) as OracleVerifyErrorPayload;
      if (response.status === 429) {
        return {
          valid: false,
          error: rateLimitMessage(payload.error?.details?.retryAfterSeconds),
        };
      }

      return {
        valid: false,
        error: payload.error?.message ?? 'Oracle signature verification failed',
      };
    } catch {
      return {
        valid: false,
        error: 'Oracle signature verification failed',
      };
    }
  }

  const payload = (await response.json()) as {
    valid?: boolean;
    message?: string;
  };
  if (payload.valid === true) {
    return { valid: true };
  }
  return {
    valid: false,
    error: payload.message ?? 'Oracle signature verification failed',
  };
}

export async function verifySharedReceiptProof(
  proof: string,
  options: VerifySharedReceiptOptions = {}
): Promise<ReceiptVerificationResult> {
  try {
    if (!proof.trim()) {
      return {
        valid: false,
        claimedAmount: '',
        minDate: '',
        error: 'Missing verification parameters',
      };
    }

    const { createProofGenerator } = await import('@/lib/zk/prover');
    const prover = (options.createProofGenerator ?? createProofGenerator)();

    const proofData = prover.importProof(proof);
    const verification = await prover.verifyProof(proofData.publicSignals, proofData.proof);

    if (!verification.valid) {
      return {
        valid: false,
        claimedAmount: '',
        minDate: '',
        error: verification.error ?? 'Proof verification failed',
      };
    }

    const oracleAuth = proofData.oracleAuth;
    if (!oracleAuth) {
      return {
        valid: false,
        claimedAmount: '',
        minDate: '',
        error: 'Missing oracle authentication data in shared receipt',
      };
    }

    const oracleCommitmentSignal = extractOracleCommitment(proofData.publicSignals);
    if (oracleCommitmentSignal !== oracleAuth.messageHash) {
      return {
        valid: false,
        claimedAmount: '',
        minDate: '',
        error: 'Oracle commitment mismatch detected',
      };
    }

    const signatureVerifier = options.signatureVerifier ?? verifyOracleSignatureViaApi;
    const oracleSignatureVerification = await signatureVerifier(oracleAuth);
    if (!oracleSignatureVerification.valid) {
      return {
        valid: false,
        claimedAmount: '',
        minDate: '',
        error: oracleSignatureVerification.error ?? 'Oracle signature verification failed',
      };
    }

    const claims = extractVerifiedClaims(proofData.publicSignals);
    const derivedNullifier = await deriveNullifierFromMessageHash(oracleAuth.messageHash);
    if (oracleAuth.nullifier.toLowerCase() !== derivedNullifier.toLowerCase()) {
      return {
        valid: false,
        claimedAmount: '',
        minDate: '',
        error: 'Oracle nullifier mismatch detected',
      };
    }

    const storage = options.storage === undefined ? getDefaultStorage() : options.storage;
    const nullifierCheck = checkClientNullifierConflict(
      {
        claim: {
          claimedAmount: claims.claimedAmount,
          minDateUnix: claims.minDateUnix,
        },
        nullifier: derivedNullifier,
      },
      storage
    );
    if (!nullifierCheck.valid) {
      return {
        valid: false,
        claimedAmount: '',
        minDate: '',
        error: nullifierCheck.message ?? 'Nullifier conflict detected',
      };
    }

    return {
      valid: true,
      claimedAmount: claims.claimedAmount,
      minDate: claims.minDateIsoUtc,
      ...(proofData.receiptMeta?.category
        ? { receiptCategory: proofData.receiptMeta.category }
        : {}),
      ...(proofData.receiptMeta?.label ? { receiptLabel: proofData.receiptMeta.label } : {}),
    };
  } catch (error) {
    return {
      valid: false,
      claimedAmount: '',
      minDate: '',
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}
