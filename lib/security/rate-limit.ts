import { isIP } from 'node:net';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  cleanupIntervalMs?: number;
  maxStoreSize?: number;
}

interface ClientIdentifierOptions {
  trustProxyHeaders?: boolean;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private store: Map<string, RateLimitEntry>;
  private config: RateLimitConfig;
  private cleanupTimer: ReturnType<typeof setInterval> | null;
  private readonly cleanupIntervalMs: number;
  private readonly maxStoreSize: number;
  private lastCleanupAt: number;

  constructor(config: RateLimitConfig) {
    this.store = new Map();
    this.config = config;
    this.cleanupTimer = null;
    this.cleanupIntervalMs = config.cleanupIntervalMs ?? config.windowMs;
    this.maxStoreSize = config.maxStoreSize ?? 5000;
    this.lastCleanupAt = Date.now();
  }

  check(identifier: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    this.maybeCleanup(now);
    const entry = this.store.get(identifier);

    if (!entry || now >= entry.resetAt) {
      const resetAt = now + this.config.windowMs;
      this.store.set(identifier, { count: 1, resetAt });
      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetAt,
      };
    }

    if (entry.count >= this.config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.resetAt,
      };
    }

    entry.count++;
    return {
      allowed: true,
      remaining: this.config.maxRequests - entry.count,
      resetAt: entry.resetAt,
    };
  }

  cleanup(now: number = Date.now()): void {
    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.resetAt) {
        this.store.delete(key);
      }
    }
  }

  private maybeCleanup(now: number): void {
    const shouldRunIntervalCleanup = now - this.lastCleanupAt >= this.cleanupIntervalMs;
    const shouldRunSizeCleanup = this.store.size >= this.maxStoreSize;

    if (!shouldRunIntervalCleanup && !shouldRunSizeCleanup) {
      return;
    }

    this.cleanup(now);
    this.lastCleanupAt = now;

    if (this.store.size <= this.maxStoreSize) {
      return;
    }

    const sortedByReset = Array.from(this.store.entries())
      .sort((a, b) => a[1].resetAt - b[1].resetAt);
    const overflowCount = this.store.size - this.maxStoreSize;
    const evictionCount = Math.max(overflowCount, Math.floor(this.maxStoreSize * 0.2));

    for (const [key] of sortedByReset.slice(0, evictionCount)) {
      this.store.delete(key);
    }
  }

  startCleanup(intervalMs: number = this.cleanupIntervalMs): void {
    if (this.cleanupTimer !== null) {
      return;
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, intervalMs);

    const timer = this.cleanupTimer as unknown as { unref?: () => void };
    if (typeof timer.unref === 'function') {
      timer.unref();
    }
  }

  stopCleanup(): void {
    if (this.cleanupTimer === null) {
      return;
    }

    clearInterval(this.cleanupTimer);
    this.cleanupTimer = null;
  }

  dispose(): void {
    this.stopCleanup();
    this.store.clear();
  }
}

export function createRateLimiter(config: RateLimitConfig): RateLimiter {
  const limiter = new RateLimiter(config);
  limiter.startCleanup(config.windowMs);

  return limiter;
}

function parseBooleanEnv(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function extractTrustedProxyIp(request: Request): string | null {
  const candidates = [
    request.headers.get('cf-connecting-ip'),
    request.headers.get('true-client-ip'),
    request.headers.get('x-real-ip'),
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    if (isIP(candidate) !== 0) {
      return candidate;
    }
  }

  return null;
}

export function getClientIdentifier(
  request: Request,
  options: ClientIdentifierOptions = {}
): string | null {
  const trustProxyHeaders =
    options.trustProxyHeaders ?? parseBooleanEnv(process.env['TRUST_PROXY_HEADERS']);

  if (trustProxyHeaders) {
    const trustedIp = extractTrustedProxyIp(request);
    if (trustedIp) {
      return `ip:${trustedIp}`;
    }
  }

  return null;
}
