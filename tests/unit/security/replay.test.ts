import { ReplayProtection } from '@/lib/security/replay';

describe('ReplayProtection', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should allow first use of signature', () => {
    const protection = new ReplayProtection(300000);
    const now = Date.now();

    const result = protection.check('sig-123', now);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('should block reuse of signature', () => {
    const protection = new ReplayProtection(300000);
    const now = Date.now();

    protection.check('sig-123', now);
    const result = protection.check('sig-123', now);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Signature already used');
  });

  it('should block expired signatures', () => {
    const protection = new ReplayProtection(300000);
    const oldTimestamp = Date.now() - 400000;

    const result = protection.check('sig-123', oldTimestamp);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Signature expired');
  });

  it('should block signatures too far in the future', () => {
    const protection = new ReplayProtection(300000, 30000);
    const futureTimestamp = Date.now() + 60000;

    const result = protection.check('sig-123', futureTimestamp);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Signature timestamp is too far in the future');
  });

  it('should allow different signatures', () => {
    const protection = new ReplayProtection(300000);
    const now = Date.now();

    protection.check('sig-123', now);
    const result = protection.check('sig-456', now);

    expect(result.allowed).toBe(true);
  });

  it('should cleanup expired entries', () => {
    const protection = new ReplayProtection(300000);
    const now = Date.now();

    protection.check('sig-123', now);
    protection.check('sig-456', now);

    jest.advanceTimersByTime(400000);
    protection.cleanup();

    expect(protection['store'].size).toBe(0);
  });

  it('should not cleanup recent entries', () => {
    const protection = new ReplayProtection(300000);
    const now = Date.now();

    protection.check('sig-123', now);

    jest.advanceTimersByTime(100000);
    protection.cleanup();

    expect(protection['store'].size).toBe(1);
  });

  it('should dispose and clear tracked signatures', () => {
    const protection = new ReplayProtection(300000);
    const now = Date.now();

    protection.check('sig-123', now);
    protection.dispose();

    expect(protection['store'].size).toBe(0);
  });

  it('should release tracked signature keys', () => {
    const protection = new ReplayProtection(300000);
    const now = Date.now();

    protection.check('sig-123', now);
    protection.release('sig-123');

    const result = protection.check('sig-123', now + 1);
    expect(result.allowed).toBe(true);
  });

  it('should bound store growth under high-cardinality signatures', () => {
    const protection = new ReplayProtection(300000, 30000, 10, 600000);
    const now = Date.now();

    for (let i = 0; i < 50; i++) {
      protection.check(`sig-${i}`, now + i);
    }

    expect(protection['store'].size).toBeLessThanOrEqual(10);
  });
});
