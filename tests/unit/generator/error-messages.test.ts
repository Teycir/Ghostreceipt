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

    expect(message).toContain('not visible yet');
    expect(message).toContain('5 minutes');
  });

  it('maps provider failures to retry guidance', () => {
    const message = mapFetchTxApiError(502, {
      error: {
        code: 'PROVIDER_ERROR',
        message: 'provider down',
      },
    });

    expect(message).toContain('temporarily busy');
  });

  it('maps insufficient confirmations to confirmation wait guidance', () => {
    const message = mapFetchTxApiError(422, {
      error: {
        code: 'INSUFFICIENT_CONFIRMATIONS',
        message: 'not enough confirmations',
      },
    });

    expect(message).toContain('still confirming');
    expect(message).toContain('5 minutes');
  });

  it('maps rate limit errors with retry-after timing', () => {
    const message = mapFetchTxApiError(429, {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        details: { retryAfterSeconds: 7 },
      },
    });

    expect(message).toContain('7 seconds');
  });

  it('maps witness amount/date violations to user-readable text', () => {
    const amountMessage = mapWitnessValidationErrors([
      'Real value (100) is less than claimed amount (200)',
    ]);
    const dateMessage = mapWitnessValidationErrors([
      'Real timestamp (10) is before minimum date (20)',
    ]);

    expect(amountMessage).toContain('Claim amount (200) exceeds transaction value (100)');
    expect(amountMessage).toContain('Did you mean 100?');
    expect(dateMessage).toContain('Transaction date (1970-01-01)');
    expect(dateMessage).toContain('minimum date (1970-01-01)');
  });
});
