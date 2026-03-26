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
    const proofSignalsForVerification = proofData.proofPublicSignals ?? proofData.publicSignals;
    const verification = await prover.verifyProof(proofSignalsForVerification, proofData.proof);

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
          error: 'Invalid proof: missing legacy verification signals for selective-disclosure payload',
        };
      }
    }

    const provenClaims = decodeLegacyReceiptPublicSignals(proofSignalsForVerification);

    if (provenClaims.oracleCommitment !== oracleAuth.messageHash) {
      return {
        valid: false,
        claimedAmount: '',
        minDate: '',
        error: 'Oracle commitment mismatch detected',
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
          error: 'Invalid proof: disclosed amount does not match proven claim',
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
          error: 'Invalid proof: disclosed minimum date does not match proven claim',
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
          error: 'Invalid proof: claim digest mismatch detected',
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
        error: oracleSignatureVerification.error ?? 'Oracle signature verification failed',
      };
    }

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
        error: nullifierCheck.message ?? 'Nullifier conflict detected',
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
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}
