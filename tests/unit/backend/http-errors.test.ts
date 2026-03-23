import { createRateLimitErrorResponse } from '@/lib/libraries/backend/http-errors';

describe('createRateLimitErrorResponse', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-23T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('includes retry metadata and standard rate-limit headers', async () => {
    const response = createRateLimitErrorResponse({
      limit: 3,
      message: 'Rate limit reached. Please wait and try again shortly.',
      resetAt: Date.now() + 5500,
    });

    const payload = (await response.json()) as {
      error: {
        code: string;
        message: string;
        details?: {
          limit?: number;
          resetAt?: string;
          retryAfterSeconds?: number;
        };
      };
    };

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('6');
    expect(response.headers.get('X-RateLimit-Limit')).toBe('3');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(response.headers.get('X-RateLimit-Reset')).toBe(
      '2026-03-23T00:00:05.500Z'
    );

    expect(payload.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(payload.error.message).toBe(
      'Rate limit reached. Please wait and try again shortly.'
    );
    expect(payload.error.details?.limit).toBe(3);
    expect(payload.error.details?.retryAfterSeconds).toBe(6);
    expect(payload.error.details?.resetAt).toBe('2026-03-23T00:00:05.500Z');
  });
});
