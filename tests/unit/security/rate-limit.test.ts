import { RateLimiter, createRateLimiter, getClientIdentifier } from '@/lib/security/rate-limit';

describe('RateLimiter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should allow requests within limit', () => {
    const limiter = new RateLimiter({ windowMs: 60000, maxRequests: 3 });

    const result1 = limiter.check('client1');
    expect(result1.allowed).toBe(true);
    expect(result1.remaining).toBe(2);

    const result2 = limiter.check('client1');
    expect(result2.allowed).toBe(true);
    expect(result2.remaining).toBe(1);

    const result3 = limiter.check('client1');
    expect(result3.allowed).toBe(true);
    expect(result3.remaining).toBe(0);
  });

  it('should block requests exceeding limit', () => {
    const limiter = new RateLimiter({ windowMs: 60000, maxRequests: 2 });

    limiter.check('client1');
    limiter.check('client1');

    const result = limiter.check('client1');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should reset after window expires', () => {
    const limiter = new RateLimiter({ windowMs: 60000, maxRequests: 2 });

    limiter.check('client1');
    limiter.check('client1');

    jest.advanceTimersByTime(60001);

    const result = limiter.check('client1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it('should track different clients separately', () => {
    const limiter = new RateLimiter({ windowMs: 60000, maxRequests: 2 });

    limiter.check('client1');
    limiter.check('client1');

    const result = limiter.check('client2');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it('should cleanup expired entries', () => {
    const limiter = new RateLimiter({ windowMs: 60000, maxRequests: 2 });

    limiter.check('client1');
    limiter.check('client2');

    jest.advanceTimersByTime(60001);

    limiter.cleanup();

    expect(limiter['store'].size).toBe(0);
  });

  it('should dispose and clear tracked clients', () => {
    const limiter = createRateLimiter({ windowMs: 60000, maxRequests: 2 });
    limiter.check('client1');
    limiter.check('client2');

    limiter.dispose();

    expect(limiter['store'].size).toBe(0);
  });
});

describe('getClientIdentifier', () => {
  it('should use trusted proxy headers when explicitly enabled', () => {
    const request = new Request('http://localhost', {
      headers: {
        'x-forwarded-for': '192.168.1.1, 10.0.0.1',
      },
    });

    const identifier = getClientIdentifier(request, { trustProxyHeaders: true });
    expect(identifier).toBe('ip:192.168.1.1');
  });

  it('should prefer cf-connecting-ip when trusted proxy headers are enabled', () => {
    const request = new Request('http://localhost', {
      headers: {
        'cf-connecting-ip': '203.0.113.10',
        'x-forwarded-for': '198.51.100.11',
      },
    });

    const identifier = getClientIdentifier(request, { trustProxyHeaders: true });
    expect(identifier).toBe('ip:203.0.113.10');
  });

  it('should ignore spoofable forwarding headers by default', () => {
    const request = new Request('http://localhost', {
      headers: {
        'x-forwarded-for': '203.0.113.20',
        'user-agent': 'unit-test-agent',
      },
    });

    const identifier = getClientIdentifier(request);
    expect(identifier).toBeNull();
  });

  it('should return null when proxy headers are not trusted', () => {
    const requestA = new Request('http://localhost', {
      headers: {
        'user-agent': 'unit-test-agent',
        'accept-language': 'en-US',
      },
    });
    const requestB = new Request('http://localhost', {
      headers: {
        'user-agent': 'unit-test-agent',
        'accept-language': 'en-US',
      },
    });

    const identifierA = getClientIdentifier(requestA);
    const identifierB = getClientIdentifier(requestB);

    expect(identifierA).toBe(identifierB);
    expect(identifierA).toBeNull();
  });

  it('should return null when no identifying headers are present', () => {
    const request = new Request('http://localhost');

    const identifier = getClientIdentifier(request);
    expect(identifier).toBeNull();
  });

  it('should return null when trusted headers are invalid', () => {
    const request = new Request('http://localhost', {
      headers: {
        'x-forwarded-for': 'not-an-ip',
        'user-agent': 'unit-test-agent',
      },
    });

    const identifier = getClientIdentifier(request, { trustProxyHeaders: true });
    expect(identifier).toBeNull();
  });
});
