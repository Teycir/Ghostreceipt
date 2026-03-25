import type { ApiErrorPayload } from '@/lib/generator/types';

function formatUnixDate(value: string): string {
  const unix = Number(value);
  if (!Number.isFinite(unix) || unix <= 0) {
    return value;
  }
  return new Date(unix * 1000).toISOString().slice(0, 10);
}

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
  if (code === 'INSUFFICIENT_CONFIRMATIONS') {
    return 'This transaction is still confirming. Wait for additional confirmations, then retry in about 5 minutes.';
  }
  if (code === 'REPLAY_DETECTED') {
    return 'Duplicate submission detected. Wait a moment and try once with a fresh request.';
  }

  return payload?.error?.message ?? 'Failed to fetch transaction';
}

export function mapWitnessValidationErrors(validationErrors: string[]): string {
  const firstError = validationErrors[0] ?? '';
  const normalizedFirstError = firstError.toLowerCase();

  if (normalizedFirstError.includes('less than claimed amount')) {
    const match = firstError.match(
      /Real value \((\d+)\) is less than claimed amount \((\d+)\)/i
    );
    if (match) {
      const realValue = match[1] ?? '0';
      const claimedAmount = match[2] ?? '0';
      return `Claim amount (${claimedAmount}) exceeds transaction value (${realValue}). Did you mean ${realValue}?`;
    }
    return 'Claim amount exceeds the transaction value. Lower the claimed amount and try again.';
  }

  if (normalizedFirstError.includes('before minimum date')) {
    const match = firstError.match(
      /Real timestamp \((\d+)\) is before minimum date \((\d+)\)/i
    );
    if (match) {
      const realTimestamp = match[1] ?? '0';
      const minDate = match[2] ?? '0';
      return `Transaction date (${formatUnixDate(realTimestamp)}) is earlier than your minimum date (${formatUnixDate(minDate)}). Choose an earlier minimum date.`;
    }
    return 'Transaction happened before your selected minimum date. Choose an earlier date and retry.';
  }
  return `Validation failed: ${validationErrors.join(', ')}`;
}
