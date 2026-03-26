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
    const waitLabel = waitSeconds === 1 ? '1 sec' : `${waitSeconds} secs`;
    return `Rate limit. Wait ${waitLabel} and retry.`;
  }

  const code = payload?.error?.code;
  if (code === 'TRANSACTION_NOT_FOUND') {
    return 'Transaction not visible yet. If just sent, wait ~5 min for confirmation.';
  }
  if (code === 'PROVIDER_TIMEOUT' || code === 'PROVIDER_ERROR') {
    return 'Network busy. Retry in 30-60 seconds.';
  }
  if (code === 'INVALID_HASH') {
    return 'Hash format doesn\'t match selected chain. Check and retry.';
  }
  if (code === 'TRANSACTION_REVERTED') {
    return 'Transaction reverted on-chain. Cannot be used as proof.';
  }
  if (code === 'INSUFFICIENT_CONFIRMATIONS') {
    return 'Still confirming. Wait ~5 min and retry.';
  }
  if (code === 'REPLAY_DETECTED') {
    return 'Duplicate detected. Wait a moment and retry.';
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
      return `Claim (${claimedAmount}) > tx value (${realValue}). Try ${realValue}?`;
    }
    return 'Claim exceeds tx value. Lower amount and retry.';
  }

  if (normalizedFirstError.includes('before minimum date')) {
    const match = firstError.match(
      /Real timestamp \((\d+)\) is before minimum date \((\d+)\)/i
    );
    if (match) {
      const realTimestamp = match[1] ?? '0';
      const minDate = match[2] ?? '0';
      return `Tx date (${formatUnixDate(realTimestamp)}) < min date (${formatUnixDate(minDate)}). Choose earlier date.`;
    }
    return 'Tx before min date. Choose earlier date and retry.';
  }
  return `Validation failed: ${validationErrors.join(', ')}`;
}
