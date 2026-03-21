import { RateLimiter, getClientIdentifier } from '@/lib/security/rate-limit';

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
});

describe('getClientIdentifier', () => {
  it('should extract IP from x-forwarded-for header', () => {
    const request = new Request('http://localhost', {
      headers: {
        'x-forwarded-for': '192.168.1.1, 10.0.0.1',
      },
    });

    const identifier = getClientIdentifier(request);
    expect(identifier).toBe('192.168.1.1');
  });

  it('should extract IP from x-real-ip header', () => {
    const request = new Request('http://localhost', {
      headers: {
        'x-real-ip': '192.168.1.2',
      },
    });

    const identifier = getClientIdentifier(request);
    expect(identifier).toBe('192.168.1.2');
  });

  it('should return unknown if no IP headers present', () => {
    const request = new Request('http://localhost');

    const identifier = getClientIdentifier(request);
    expect(identifier).toBe('unknown');
  });

  it('should prefer x-forwarded-for over x-real-ip', () => {
    const request = new Request('http://localhost', {
      headers: {
        'x-forwarded-for': '192.168.1.1',
        'x-real-ip': '192.168.1.2',
      },
    });

    const identifier = getClientIdentifier(request);
    expect(identifier).toBe('192.168.1.1');
  });
});
