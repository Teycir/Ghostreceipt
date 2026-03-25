import type { ApiErrorPayload } from '@/lib/generator/types';

export function mapFetchTxApiError(
  responseStatus: number,
  payload: ApiErrorPayload | null
): string {
  if (responseStatus === 429) {
    const retryAfter = payload?.error?.details?.retryAfterSeconds;
    const waitSeconds =
      typeof retryAfter === 'number' && retryAfter > 0
        ? Math.ceil(retryAfter)
        : 60;
    const waitLabel = waitSeconds === 1 ? '1 second' : `${waitSeconds} seconds`;
    return `Rate limit reached. Please wait ${waitLabel} and try again.`;
  }

  const code = payload?.error?.code;
  if (code === 'TRANSACTION_NOT_FOUND') {
    return 'This transaction is not visible yet. If it was just sent, wait for confirmation and retry in about 5 minutes.';
  }
  if (code === 'PROVIDER_TIMEOUT' || code === 'PROVIDER_ERROR') {
    return 'Network providers are temporarily busy. Please retry in 30-60 seconds.';
  }
  if (code === 'INVALID_HASH') {
    return 'The transaction hash format does not match the selected chain. Check the hash/signature and try again.';
  }
  if (code === 'TRANSACTION_REVERTED') {
    return 'This transaction reverted on-chain and cannot be used as payment proof.';
  }
  if (code === 'REPLAY_DETECTED') {
    return 'Duplicate submission detected. Wait a moment and try once with a fresh request.';
  }

  return payload?.error?.message ?? 'Failed to fetch transaction';
}

export function mapWitnessValidationErrors(validationErrors: string[]): string {
  const normalizedErrors = validationErrors.map((error) => error.toLowerCase());
  if (normalizedErrors.some((error) => error.includes('less than claimed amount'))) {
    return 'Claim amount exceeds the transaction value. Lower the claimed amount and try again.';
  }
  if (normalizedErrors.some((error) => error.includes('before minimum date'))) {
    return 'Transaction happened before your selected minimum date. Choose an earlier date and retry.';
  }
  return `Validation failed: ${validationErrors.join(', ')}`;
}

