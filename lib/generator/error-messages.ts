import type { ApiErrorPayload } from '@/lib/generator/types';

function formatAtomicInteger(value: string): string {
  if (!/^\d+$/.test(value)) {
    return value;
  }
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

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
  const rawMessage = payload?.error?.message;
  const normalizedRawMessage = rawMessage?.toLowerCase() ?? '';

  if (responseStatus === 429) {
    const retryAfter = payload?.error?.details?.retryAfterSeconds;
    const waitSeconds =
      typeof retryAfter === 'number' && retryAfter > 0
        ? Math.ceil(retryAfter)
        : 60;
    const waitLabel = waitSeconds === 1 ? '1 sec' : `${waitSeconds} secs`;
    return `Too many requests right now. Please wait ${waitLabel} and try again.`;
  }

  if (
    normalizedRawMessage.includes('[config]') ||
    normalizedRawMessage.includes('runtime validation failed') ||
    normalizedRawMessage.includes('set env var')
  ) {
    return rawMessage ?? 'Server configuration error. Check runtime environment variables.';
  }

  const code = payload?.error?.code;
  if (code === 'TRANSACTION_NOT_FOUND') {
    return 'We can\'t find this transaction yet. If you just sent it, wait about 5 minutes and try again.';
  }
  if (code === 'PROVIDER_TIMEOUT' || code === 'PROVIDER_ERROR') {
    return 'Network is busy right now. Please try again in 30 to 60 seconds.';
  }
  if (code === 'INVALID_HASH') {
    return 'This transaction hash does not match the selected chain. Check it and try again.';
  }
  if (code === 'TRANSACTION_REVERTED') {
    return 'This transaction failed on-chain, so it cannot be used for a receipt.';
  }
  if (code === 'INSUFFICIENT_CONFIRMATIONS') {
    return 'This transaction is still confirming. Wait about 5 minutes and try again.';
  }
  if (code === 'REPLAY_DETECTED') {
    return 'This request was already submitted. Wait a moment and try again.';
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
      if (realValue === '0') {
        return `This transaction sent no funds (value is 0). Your minimum claim is ${formatAtomicInteger(claimedAmount)}. Use a transaction hash that actually sent funds.`;
      }
      return `This transaction sent ${formatAtomicInteger(realValue)}, but your minimum claim is ${formatAtomicInteger(claimedAmount)}. Set your minimum claim to ${formatAtomicInteger(realValue)} or less, then try again.`;
    }
    return 'Your claimed amount is higher than what this transaction sent. Lower the claim and retry.';
  }

  if (normalizedFirstError.includes('before minimum date')) {
    const match = firstError.match(
      /Real timestamp \((\d+)\) is before minimum date \((\d+)\)/i
    );
    if (match) {
      const realTimestamp = match[1] ?? '0';
      const minDate = match[2] ?? '0';
      return `This payment happened on ${formatUnixDate(realTimestamp)}, which is before your minimum date of ${formatUnixDate(minDate)}. Choose an earlier minimum date and try again.`;
    }
    return 'This payment happened before your minimum date. Choose an earlier minimum date and try again.';
  }
  return 'We could not validate this claim. Check the transaction hash, amount, and minimum date, then try again.';
}
