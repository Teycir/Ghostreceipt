import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  createOracleRouteRateLimiters,
  disposeOracleRouteRateLimiters,
  parseRateLimitedOracleRouteBody,
} from '@ghostreceipt/backend-core/http';

describe('oracle-route-envelope strict durable mode behavior', () => {
  const originalBackendMode = process.env['ORACLE_RATE_LIMIT_BACKEND'];
  const originalDurableUrl = process.env['ORACLE_RATE_LIMIT_DURABLE_URL'];
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env['ORACLE_RATE_LIMIT_BACKEND'] = 'durable_strict';
    process.env['ORACLE_RATE_LIMIT_DURABLE_URL'] = 'https://durable.example/check';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    global.fetch = originalFetch;
  });

  afterAll(() => {
    if (originalBackendMode === undefined) {
      delete process.env['ORACLE_RATE_LIMIT_BACKEND'];
    } else {
      process.env['ORACLE_RATE_LIMIT_BACKEND'] = originalBackendMode;
    }

    if (originalDurableUrl === undefined) {
      delete process.env['ORACLE_RATE_LIMIT_DURABLE_URL'];
    } else {
      process.env['ORACLE_RATE_LIMIT_DURABLE_URL'] = originalDurableUrl;
    }

    global.fetch = originalFetch;
  });

  it('returns 503 when strict durable backend is temporarily unavailable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('durable backend timeout')) as unknown as typeof fetch;

    const limiters = createOracleRouteRateLimiters({
      backendScope: 'test_oracle_route',
      clientMaxRequests: 5,
      globalMaxRequests: 5,
      windowMs: 60_000,
    });

    try {
      const request = new NextRequest('http://localhost/api/oracle/test', {
        method: 'POST',
        body: JSON.stringify({ txHash: 'abc123' }),
        headers: {
          'content-type': 'application/json',
        },
      });

      const result = await parseRateLimitedOracleRouteBody({
        invalidRequestMessage: 'Invalid request parameters',
        maxBodySizeBytes: 1024,
        rateLimit: {
          clientMaxRequests: 5,
          globalMaxRequests: 5,
          limiters,
          messages: {
            client: 'client',
            global: 'global',
          },
        },
        request,
        schema: z.object({
          txHash: z.string(),
        }),
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(503);
        const body = (await result.response.json()) as { error?: { code?: string } };
        expect(body.error?.code).toBe('INTERNAL_ERROR');
      }
    } finally {
      disposeOracleRouteRateLimiters(limiters);
    }
  });
});
