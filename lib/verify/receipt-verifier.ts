import {
  decodeLegacyReceiptPublicSignals,
  decodeReceiptPublicSignals,
  deriveSelectiveClaimDigest,
  type DecodedReceiptPublicSignals,
  type ReceiptClaimDisclosureState,
  type ReceiptSignalContract,
} from '@/lib/zk/share';
import {
  checkClientNullifierConflict,
  deriveNullifierFromMessageHash,
  type NullifierStorageLike,
} from '@/lib/zk/nullifier';
import type { ShareableProofPayload, ProofGenerator } from '@/lib/zk/prover';
import type { OracleValidationStatus } from '@/lib/generator/types';
import { postOracleJson } from '@/lib/oracle/client';

export interface OracleSignatureVerificationResult {
  valid: boolean;
  error?: string;
}

export interface ReceiptVerificationResult {
  valid: boolean;
  claimedAmount: string;
  claimedAmountDisclosure?: ReceiptClaimDisclosureState;
  minDate: string;
  minDateDisclosure?: ReceiptClaimDisclosureState;
  signalContract?: ReceiptSignalContract;
  oracleValidationLabel?: string;
  oracleValidationStatus?: OracleValidationStatus;
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

function isOracleCommitmentMismatchError(error: unknown): boolean {
  return error instanceof Error && error.message === 'Oracle commitment mismatch detected';
}

function toPlainVerificationError(message: string): string {
  const normalized = message.trim().toLowerCase();

  if (normalized.includes('missing verification parameters')) {
    return 'No receipt data was provided. Open the full verification link and try again.';
  }
  if (normalized.includes('proof verification failed') || normalized.includes('invalid proof format')) {
    return 'We could not verify this receipt.';
  }
  if (normalized.includes('missing oracle authentication data')) {
    return 'This receipt is missing required signature data.';
  }
  if (normalized.includes('missing legacy verification signals')) {
    return 'This receipt is missing required verification data.';
  }
  if (normalized.includes('oracle commitment mismatch detected')) {
    return 'This receipt does not match its verification signature.';
  }
  if (normalized.includes('disclosed amount does not match proven claim')) {
    return 'The shared amount does not match the proven receipt data.';
  }
  if (normalized.includes('disclosed minimum date does not match proven claim')) {
    return 'The shared minimum date does not match the proven receipt data.';
  }
  if (normalized.includes('claim digest mismatch detected')) {
    return 'This receipt data is inconsistent and could not be verified.';
  }
  if (normalized.includes('oracle signature verification failed')) {
    return 'We could not verify the receipt signature. Please try again.';
  }
  if (normalized.includes('oracle nullifier mismatch detected')) {
    return 'This receipt failed an integrity check and cannot be verified.';
  }
  if (normalized.includes('nullifier conflict detected')) {
    return 'This receipt appears to have been reused with different claim details.';
  }
  if (normalized.includes('rate limit reached')) {
    return message;
  }

  return message;
}

export async function verifyOracleSignatureViaApi(
  oracleAuth: NonNullable<ShareableProofPayload['oracleAuth']>
): Promise<OracleSignatureVerificationResult> {
  const { expiresAt, messageHash, nonce, oracleSignature, oraclePubKeyId, signedAt } = oracleAuth;
  const { response } = await postOracleJson('verify-signature', {
    expiresAt,
    messageHash,
    nonce,
    oracleSignature,
    oraclePubKeyId,
    signedAt,
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
        error: toPlainVerificationError(payload.error?.message ?? 'Oracle signature verification failed'),
      };
    } catch {
      return {
        valid: false,
        error: toPlainVerificationError('Oracle signature verification failed'),
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
    error: toPlainVerificationError(payload.message ?? 'Oracle signature verification failed'),
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
        error: toPlainVerificationError('Missing verification parameters'),
      };
    }

    const { createProofGenerator } = await import('@/lib/zk/prover');
    const prover = (options.createProofGenerator ?? createProofGenerator)();

    const proofData = prover.importProof(proof);
    const proofSignalsForVerification = proofData.proofPublicSignals ?? proofData.publicSignals;
    const verification = await prover.verifyProof(proofSignalsForVerification, proofData.proof);

    if (!verification.valid) {
      return {
        valid: false,
        claimedAmount: '',
        minDate: '',
        error: toPlainVerificationError(verification.error ?? 'Proof verification failed'),
      };
    }

    const oracleAuth = proofData.oracleAuth;
    if (!oracleAuth) {
      return {
        valid: false,
        claimedAmount: '',
        minDate: '',
        error: toPlainVerificationError('Missing oracle authentication data in shared receipt'),
      };
    }

    let decodedSignals: DecodedReceiptPublicSignals;
    try {
      decodedSignals = decodeReceiptPublicSignals(
        proofData.publicSignals,
        oracleAuth.messageHash
      );
    } catch (error) {
      const canFallbackToVerificationSignals =
        isOracleCommitmentMismatchError(error) &&
        Array.isArray(proofData.proofPublicSignals) &&
        proofData.proofPublicSignals.length > 0;
      if (!canFallbackToVerificationSignals) {
        throw error;
      }

      decodedSignals = decodeReceiptPublicSignals(
        proofSignalsForVerification,
        oracleAuth.messageHash
      );
    }

    if (decodedSignals.contract === 'selective-disclosure-v1') {
      if (!Array.isArray(proofData.proofPublicSignals) || proofData.proofPublicSignals.length === 0) {
        return {
          valid: false,
          claimedAmount: '',
          minDate: '',
          error: toPlainVerificationError(
            'Invalid proof: missing legacy verification signals for selective-disclosure payload'
          ),
        };
      }
    }

    const provenClaims = decodeLegacyReceiptPublicSignals(proofSignalsForVerification, {
      expectedOracleCommitment: oracleAuth.messageHash,
    });

    if (provenClaims.oracleCommitment !== oracleAuth.messageHash) {
      return {
        valid: false,
        claimedAmount: '',
        minDate: '',
        error: toPlainVerificationError('Oracle commitment mismatch detected'),
      };
    }

    if (decodedSignals.contract === 'selective-disclosure-v1') {
      if (
        decodedSignals.claimedAmountDisclosure === 'disclosed' &&
        decodedSignals.claimedAmount !== provenClaims.claimedAmount
      ) {
        return {
          valid: false,
          claimedAmount: '',
          minDate: '',
          error: toPlainVerificationError(
            'Invalid proof: disclosed amount does not match proven claim'
          ),
        };
      }

      if (
        decodedSignals.minDateDisclosure === 'disclosed' &&
        decodedSignals.minDateUnix !== provenClaims.minDateUnix
      ) {
        return {
          valid: false,
          claimedAmount: '',
          minDate: '',
          error: toPlainVerificationError(
            'Invalid proof: disclosed minimum date does not match proven claim'
          ),
        };
      }

      const expectedClaimDigest = await deriveSelectiveClaimDigest({
        claimedAmount: provenClaims.claimedAmount,
        disclosureMask: decodedSignals.disclosureMask,
        minDateUnix: provenClaims.minDateUnix,
      });
      if (decodedSignals.claimDigest !== expectedClaimDigest) {
        return {
          valid: false,
          claimedAmount: '',
          minDate: '',
          error: toPlainVerificationError('Invalid proof: claim digest mismatch detected'),
        };
      }
    }

    const signatureVerifier = options.signatureVerifier ?? verifyOracleSignatureViaApi;
    const oracleSignatureVerification = await signatureVerifier(oracleAuth);
    if (!oracleSignatureVerification.valid) {
      return {
        valid: false,
        claimedAmount: '',
        minDate: '',
        error: toPlainVerificationError(
          oracleSignatureVerification.error ?? 'Oracle signature verification failed'
        ),
      };
    }

    const derivedNullifier = await deriveNullifierFromMessageHash(oracleAuth.messageHash);
    if (oracleAuth.nullifier.toLowerCase() !== derivedNullifier.toLowerCase()) {
      return {
        valid: false,
        claimedAmount: '',
        minDate: '',
        error: toPlainVerificationError('Oracle nullifier mismatch detected'),
      };
    }

    const storage = options.storage === undefined ? getDefaultStorage() : options.storage;
    const nullifierCheck = checkClientNullifierConflict(
      {
        claim: {
          claimedAmount: provenClaims.claimedAmount,
          minDateUnix: provenClaims.minDateUnix,
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
        error: toPlainVerificationError(nullifierCheck.message ?? 'Nullifier conflict detected'),
      };
    }

    return {
      valid: true,
      claimedAmount: decodedSignals.claimedAmount ?? 'Hidden',
      claimedAmountDisclosure: decodedSignals.claimedAmountDisclosure,
      minDate: decodedSignals.minDateIsoUtc ?? 'Hidden',
      minDateDisclosure: decodedSignals.minDateDisclosure,
      signalContract: decodedSignals.contract,
      ...(proofData.receiptMeta?.oracleValidationStatus
        ? { oracleValidationStatus: proofData.receiptMeta.oracleValidationStatus }
        : {}),
      ...(proofData.receiptMeta?.oracleValidationLabel
        ? { oracleValidationLabel: proofData.receiptMeta.oracleValidationLabel }
        : {}),
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
      error: toPlainVerificationError(error instanceof Error ? error.message : 'Verification failed'),
    };
  }
}
