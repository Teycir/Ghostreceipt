import { POST, mapErrorToResponse } from '@/app/api/oracle/fetch-tx/route';
import type { NextRequest } from 'next/server';

describe('mapErrorToResponse', () => {
  it('maps provider TIMEOUT code to provider timeout response', () => {
    const error = Object.assign(new Error('Provider timed out'), {
      code: 'TIMEOUT',
    });
    const mapped = mapErrorToResponse(error);

    expect(mapped).toEqual({
      code: 'PROVIDER_TIMEOUT',
      message: 'Provider timed out',
      status: 504,
    });
  });

  it('maps case-insensitive rate limit message to RATE_LIMIT_EXCEEDED', () => {
    const mapped = mapErrorToResponse(new Error('Rate Limit Exceeded'));

    expect(mapped).toEqual({
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Rate Limit Exceeded',
      status: 429,
    });
  });

  it('maps provider error code to PROVIDER_ERROR response', () => {
    const error = Object.assign(new Error('HTTP 503: Service Unavailable'), {
      code: 'PROVIDER_ERROR',
    });
    const mapped = mapErrorToResponse(error);

    expect(mapped).toEqual({
      code: 'PROVIDER_ERROR',
      message: 'HTTP 503: Service Unavailable',
      status: 502,
    });
  });
});

describe('POST /api/oracle/fetch-tx', () => {
  it('returns 400 for invalid ethereum tx hash before provider calls', async () => {
    const request = new Request('http://localhost/api/oracle/fetch-tx', {
      method: 'POST',
      body: JSON.stringify({
        chain: 'ethereum',
        txHash: 'invalid-hash',
      }),
      headers: {
        'content-type': 'application/json',
      },
    });

    const response = await POST(request as NextRequest);
    const body = (await response.json()) as {
      error: { code: string; message: string };
    };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('INVALID_HASH');
    expect(body.error.message).toBe('Invalid request parameters');
  });

  it('returns 400 for malformed JSON request bodies', async () => {
    const request = new Request('http://localhost/api/oracle/fetch-tx', {
      method: 'POST',
      body: '{"chain":"ethereum",',
      headers: {
        'content-type': 'application/json',
      },
    });

    const response = await POST(request as NextRequest);
    const body = (await response.json()) as {
      error: { code: string; message: string };
    };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('INVALID_HASH');
    expect(body.error.message).toBe('Invalid JSON request body');
  });
});
