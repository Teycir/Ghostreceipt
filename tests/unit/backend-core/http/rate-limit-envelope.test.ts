import {
  checkOracleRouteRateLimits,
  createOracleRouteRateLimiters,
  disposeOracleRouteRateLimiters,
  type OracleRouteRateLimiters,
} from '@ghostreceipt/backend-core/http';

describe('rate-limit-envelope backend modes', () => {
  const originalBackendMode = process.env['ORACLE_RATE_LIMIT_BACKEND'];
  const originalDurableUrl = process.env['ORACLE_RATE_LIMIT_DURABLE_URL'];
  const originalDurableTimeout = process.env['ORACLE_RATE_LIMIT_DURABLE_TIMEOUT_MS'];
  const originalBreakerFails = process.env['ORACLE_RATE_LIMIT_DURABLE_BREAKER_FAILS'];
  const originalBreakerCooldown = process.env['ORACLE_RATE_LIMIT_DURABLE_BREAKER_COOLDOWN_MS'];
  const originalFetch = global.fetch;
  const createdLimiters: OracleRouteRateLimiters[] = [];

  function createLimiters(): OracleRouteRateLimiters {
    const limiters = createOracleRouteRateLimiters({
      backendScope: 'test_rate_limit',
      clientMaxRequests: 10,
      globalMaxRequests: 1,
      windowMs: 60_000,
    });
    createdLimiters.push(limiters);
    return limiters;
  }

  async function checkGlobalOnly(limiters: OracleRouteRateLimiters) {
    return checkOracleRouteRateLimits({
      clientId: null,
      clientMaxRequests: 10,
      globalMaxRequests: 1,
      limiters,
      messages: {
        client: 'client throttled',
        global: 'global throttled',
      },
    });
  }

  beforeEach(() => {
    delete process.env['ORACLE_RATE_LIMIT_BACKEND'];
    delete process.env['ORACLE_RATE_LIMIT_DURABLE_URL'];
    delete process.env['ORACLE_RATE_LIMIT_DURABLE_TIMEOUT_MS'];
    delete process.env['ORACLE_RATE_LIMIT_DURABLE_BREAKER_FAILS'];
    delete process.env['ORACLE_RATE_LIMIT_DURABLE_BREAKER_COOLDOWN_MS'];
  });

  afterEach(() => {
    for (const limiter of createdLimiters.splice(0, createdLimiters.length)) {
      disposeOracleRouteRateLimiters(limiter);
    }
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

    if (originalDurableTimeout === undefined) {
      delete process.env['ORACLE_RATE_LIMIT_DURABLE_TIMEOUT_MS'];
    } else {
      process.env['ORACLE_RATE_LIMIT_DURABLE_TIMEOUT_MS'] = originalDurableTimeout;
    }

    if (originalBreakerFails === undefined) {
      delete process.env['ORACLE_RATE_LIMIT_DURABLE_BREAKER_FAILS'];
    } else {
      process.env['ORACLE_RATE_LIMIT_DURABLE_BREAKER_FAILS'] = originalBreakerFails;
    }

    if (originalBreakerCooldown === undefined) {
      delete process.env['ORACLE_RATE_LIMIT_DURABLE_BREAKER_COOLDOWN_MS'];
    } else {
      process.env['ORACLE_RATE_LIMIT_DURABLE_BREAKER_COOLDOWN_MS'] = originalBreakerCooldown;
    }

    global.fetch = originalFetch;
  });

  it('uses legacy in-memory limiter when mode is legacy', async () => {
    process.env['ORACLE_RATE_LIMIT_BACKEND'] = 'legacy';
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const limiters = createLimiters();
    const first = await checkGlobalOnly(limiters);
    const second = await checkGlobalOnly(limiters);

    expect(first).toBeNull();
    expect(second?.status).toBe(429);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('falls back to legacy on technical durable failures in durable_prefer mode', async () => {
    process.env['ORACLE_RATE_LIMIT_BACKEND'] = 'durable_prefer';
    process.env['ORACLE_RATE_LIMIT_DURABLE_URL'] = 'https://durable.example/check';
    process.env['ORACLE_RATE_LIMIT_DURABLE_BREAKER_FAILS'] = '1';
    process.env['ORACLE_RATE_LIMIT_DURABLE_BREAKER_COOLDOWN_MS'] = '60000';

    const fetchSpy = jest.fn().mockRejectedValue(new Error('upstream timeout'));
    global.fetch = fetchSpy as unknown as typeof fetch;

    const limiters = createLimiters();
    const first = await checkGlobalOnly(limiters);
    const second = await checkGlobalOnly(limiters);

    expect(first).toBeNull();
    expect(second?.status).toBe(429);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('falls back to legacy when durable URL is invalid in durable_prefer mode', async () => {
    process.env['ORACLE_RATE_LIMIT_BACKEND'] = 'durable_prefer';
    process.env['ORACLE_RATE_LIMIT_DURABLE_URL'] = 'not-a-valid-url';

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const limiters = createLimiters();
    const first = await checkGlobalOnly(limiters);
    const second = await checkGlobalOnly(limiters);

    expect(first).toBeNull();
    expect(second?.status).toBe(429);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      '[RateLimit] Invalid ORACLE_RATE_LIMIT_DURABLE_URL configured:',
      'not-a-valid-url'
    );
  });

  it('does not fallback-allow when durable backend explicitly denies', async () => {
    process.env['ORACLE_RATE_LIMIT_BACKEND'] = 'durable_prefer';
    process.env['ORACLE_RATE_LIMIT_DURABLE_URL'] = 'https://durable.example/check';

    const fetchSpy = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          allowed: false,
          remaining: 0,
          resetAt: Date.now() + 10_000,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    global.fetch = fetchSpy as unknown as typeof fetch;

    const limiters = createLimiters();
    const response = await checkGlobalOnly(limiters);
    const body = (await response?.json()) as { error?: { code?: string } };

    expect(response?.status).toBe(429);
    expect(body.error?.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('logs and safely denies when durable 429 payload is non-JSON', async () => {
    process.env['ORACLE_RATE_LIMIT_BACKEND'] = 'durable_prefer';
    process.env['ORACLE_RATE_LIMIT_DURABLE_URL'] = 'https://durable.example/check';

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchSpy = jest.fn().mockResolvedValue(
      new Response('not-json', {
        status: 429,
        headers: { 'content-type': 'text/plain' },
      })
    );
    global.fetch = fetchSpy as unknown as typeof fetch;

    const limiters = createLimiters();
    const response = await checkGlobalOnly(limiters);
    const body = (await response?.json()) as { error?: { code?: string } };

    expect(response?.status).toBe(429);
    expect(body.error?.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      '[RateLimit] Failed to parse durable 429 response:',
      expect.any(String)
    );
  });

  it('fails closed in durable_strict mode when durable backend is unavailable', async () => {
    process.env['ORACLE_RATE_LIMIT_BACKEND'] = 'durable_strict';
    process.env['ORACLE_RATE_LIMIT_DURABLE_URL'] = 'https://durable.example/check';

    const fetchSpy = jest.fn().mockRejectedValue(new Error('network down'));
    global.fetch = fetchSpy as unknown as typeof fetch;

    const limiters = createLimiters();
    await expect(checkGlobalOnly(limiters)).rejects.toThrow(
      'Durable rate-limit request failed'
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
