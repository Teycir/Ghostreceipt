'use client';

/**
 * lib/generator/use-proof-generator.ts
 *
 * Encapsulates the entire proof generation state machine:
 *   idle → fetching → validating → generating → success | error
 *
 * The form component becomes a thin rendering layer with no async logic.
 */

import { useState, useCallback } from 'react';
import { announceToScreenReader } from '@/lib/accessibility';
import type {
  GeneratorState,
  GeneratorFormValues,
  GeneratorFormErrors,
  ProofResult,
  ApiErrorPayload,
} from '@/lib/generator/types';
import type { OraclePayload } from '@/lib/validation/schemas';

// ── Field-level validation ───────────────────────────────────────────────────
function validateFields(values: GeneratorFormValues): GeneratorFormErrors {
  const errors: GeneratorFormErrors = {};

  if (!values.txHash.trim()) {
    errors.txHash = 'Transaction hash is required';
  } else if (values.chain === 'bitcoin' && !/^[a-f0-9]{64}$/i.test(values.txHash)) {
    errors.txHash = 'Invalid Bitcoin transaction hash (64 hex characters)';
  } else if (values.chain === 'ethereum' && !/^0x[a-f0-9]{64}$/i.test(values.txHash)) {
    errors.txHash = 'Invalid Ethereum transaction hash (0x + 64 hex characters)';
  }

  if (!values.claimedAmount.trim()) {
    errors.claimedAmount = 'Claimed amount is required';
  } else if (Number.isNaN(Number(values.claimedAmount)) || Number(values.claimedAmount) <= 0) {
    errors.claimedAmount = 'Amount must be a positive number';
  }

  if (!values.minDate) {
    errors.minDate = 'Minimum date is required';
  }

  return errors;
}

// ── Rate-limit message helper ────────────────────────────────────────────────
function rateLimitMessage(retryAfterSeconds?: number): string {
  const waitSeconds =
    typeof retryAfterSeconds === 'number' && retryAfterSeconds > 0
      ? Math.ceil(retryAfterSeconds)
      : 60;
  const waitLabel = waitSeconds === 1 ? '1 second' : `${waitSeconds} seconds`;
  return `Rate limit reached. Please wait ${waitLabel} and try again.`;
}

// ── Hook return type ─────────────────────────────────────────────────────────
export interface UseProofGeneratorReturn {
  /** Current machine state */
  state: GeneratorState;
  /** Client-side validation errors */
  errors: GeneratorFormErrors;
  /** Human-readable error message when state === 'error' */
  errorMessage: string;
  /** Populated when state === 'success' */
  proofResult: ProofResult | null;
  /** Call on form submit */
  generate: (values: GeneratorFormValues) => Promise<void>;
  /** Reset to idle after an error */
  reset: () => void;
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useProofGenerator(): UseProofGeneratorReturn {
  const [state, setState] = useState<GeneratorState>('idle');
  const [errors, setErrors] = useState<GeneratorFormErrors>({});
  const [errorMessage, setErrorMessage] = useState('');
  const [proofResult, setProofResult] = useState<ProofResult | null>(null);

  const reset = useCallback((): void => {
    setState('idle');
    setErrorMessage('');
  }, []);

  const generate = useCallback(async (values: GeneratorFormValues): Promise<void> => {
    // 1. Validate fields first
    const fieldErrors = validateFields(values);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    try {
      // 2. Fetch oracle data
      setState('fetching');
      setErrorMessage('');
      announceToScreenReader('Fetching transaction data');

      const response = await fetch('/api/oracle/fetch-tx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chain: values.chain, txHash: values.txHash }),
      });

      const data = (await response.json()) as { data?: OraclePayload } & ApiErrorPayload;

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error(rateLimitMessage(data.error?.details?.retryAfterSeconds));
        }
        throw new Error(data.error?.message ?? 'Failed to fetch transaction');
      }

      if (!data.data) throw new Error('Invalid response: missing oracle payload');

      // 3. Build & validate witness
      setState('validating');
      announceToScreenReader('Validating transaction data');

      const { buildWitness, validateWitness } = await import('@/lib/zk/witness');
      const witness = buildWitness(data.data, {
        claimedAmount: values.claimedAmount,
        minDate: Math.floor(new Date(values.minDate).getTime() / 1000),
      });

      const validation = validateWitness(witness);
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // 4. Generate ZK proof
      setState('generating');
      announceToScreenReader('Generating zero-knowledge proof');

      const { createProofGenerator } = await import('@/lib/zk/prover');
      const prover = createProofGenerator();
      const proofOutput = await prover.generateProof(witness);

      const shareableProof = prover.exportProof(proofOutput, {
        expiresAt:       data.data.expiresAt,
        messageHash:     data.data.messageHash,
        nullifier:       data.data.nullifier,
        nonce:           data.data.nonce,
        oracleSignature: data.data.oracleSignature,
        oraclePubKeyId:  data.data.oraclePubKeyId,
        signedAt:        data.data.signedAt,
      });

      setProofResult({
        proof:          shareableProof,
        chain:          values.chain,
        claimedAmount:  values.claimedAmount,
        minDate:        values.minDate,
      });

      setState('success');
      announceToScreenReader('Receipt generated successfully');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred';
      setState('error');
      setErrorMessage(msg);
      announceToScreenReader(`Error: ${msg}`);
    }
  }, []);

  return { state, errors, errorMessage, proofResult, generate, reset };
}
