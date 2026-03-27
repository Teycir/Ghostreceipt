import {
  mapFetchTxApiError,
  mapWitnessValidationErrors,
} from '@/lib/generator/error-messages';

describe('generator smart error messages', () => {
  it('maps transaction not found to actionable guidance', () => {
    const message = mapFetchTxApiError(404, {
      error: {
        code: 'TRANSACTION_NOT_FOUND',
        message: 'transaction not found',
      },
    });

    expect(message).toContain('find this transaction yet');
    expect(message).toContain('about 5 minutes');
  });

  it('maps provider failures to retry guidance', () => {
    const message = mapFetchTxApiError(502, {
      error: {
        code: 'PROVIDER_ERROR',
        message: 'provider down',
      },
    });

    expect(message).toContain('Network is busy right now');
  });

  it('maps insufficient confirmations to confirmation wait guidance', () => {
    const message = mapFetchTxApiError(422, {
      error: {
        code: 'INSUFFICIENT_CONFIRMATIONS',
        message: 'not enough confirmations',
      },
    });

    expect(message).toContain('still confirming');
    expect(message).toContain('about 5 minutes');
  });

  it('maps rate limit errors with retry-after timing', () => {
    const message = mapFetchTxApiError(429, {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        details: { retryAfterSeconds: 7 },
      },
    });

    expect(message).toContain('Too many requests right now');
    expect(message).toContain('7 secs');
  });

  it('preserves precise config failures instead of generic network guidance', () => {
    const message = mapFetchTxApiError(502, {
      error: {
        code: 'PROVIDER_ERROR',
        message:
          '[Config] Missing endpoint URL for BITCOIN_PROVIDER_API_ENDPOINTS.BLOCKCYPHER_MAINNET (name="BLOCKCYPHER_MAINNET"). Set env var BITCOIN_PROVIDER_BLOCKCYPHER_MAINNET_URL.',
      },
    });

    expect(message).toContain('Missing endpoint URL');
    expect(message).toContain('BITCOIN_PROVIDER_BLOCKCYPHER_MAINNET_URL');
  });

  it('maps witness amount/date violations to plain-English guidance', () => {
    const amountMessage = mapWitnessValidationErrors([
      'Real value (100) is less than claimed amount (200)',
    ]);
    const dateMessage = mapWitnessValidationErrors([
      'Real timestamp (10) is before minimum date (20)',
    ]);

    expect(amountMessage).toContain('This transaction sent 100');
    expect(amountMessage).toContain('minimum claim is 200');
    expect(amountMessage).toContain('100 or less');
    expect(dateMessage).toContain('This payment happened on 1970-01-01');
    expect(dateMessage).toContain('minimum date of 1970-01-01');
    expect(dateMessage).toContain('Choose an earlier minimum date');
  });

  it('explains zero-value transactions in plain English', () => {
    const amountMessage = mapWitnessValidationErrors([
      'Real value (0) is less than claimed amount (50000000000000000)',
    ]);

    expect(amountMessage).toContain('sent no funds');
    expect(amountMessage).toContain('minimum claim is 50,000,000,000,000,000');
    expect(amountMessage).toContain('actually sent funds');
  });
});
