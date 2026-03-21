import { createHash } from 'crypto';
import { isIP } from 'node:net';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
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

  constructor(config: RateLimitConfig) {
    this.store = new Map();
    this.config = config;
    this.cleanupTimer = null;
  }

  check(identifier: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
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

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.resetAt) {
        this.store.delete(key);
      }
    }
  }

  startCleanup(intervalMs: number = this.config.windowMs): void {
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

function buildHeaderFingerprint(request: Request): string | null {
  const parts = [
    request.headers.get('user-agent') ?? '',
    request.headers.get('accept-language') ?? '',
    request.headers.get('sec-ch-ua') ?? '',
    request.headers.get('host') ?? '',
  ].filter(Boolean);

  if (parts.length === 0) {
    return null;
  }

  const digest = createHash('sha256').update(parts.join('|')).digest('hex');
  return digest.slice(0, 24);
}

export function getClientIdentifier(
  request: Request,
  options: ClientIdentifierOptions = {}
): string {
  const trustProxyHeaders =
    options.trustProxyHeaders ?? parseBooleanEnv(process.env['TRUST_PROXY_HEADERS']);

  if (trustProxyHeaders) {
    const trustedIp = extractTrustedProxyIp(request);
    if (trustedIp) {
      return `ip:${trustedIp}`;
    }
  }

  const fingerprint = buildHeaderFingerprint(request);
  if (fingerprint) {
    return `fp:${fingerprint}`;
  }

  return 'anon';
}
