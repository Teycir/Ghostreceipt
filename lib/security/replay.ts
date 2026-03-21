interface ReplayEntry {
  timestamp: number;
}

export class ReplayProtection {
  private store: Map<string, ReplayEntry>;
  private maxAgeMs: number;
  private maxFutureSkewMs: number;
  private cleanupTimer: ReturnType<typeof setInterval> | null;

  constructor(maxAgeMs: number = 300000, maxFutureSkewMs: number = 30000) {
    this.store = new Map();
    this.maxAgeMs = maxAgeMs;
    this.maxFutureSkewMs = maxFutureSkewMs;
    this.cleanupTimer = null;

    this.startCleanup();
  }

  check(signatureId: string, timestamp: number): { allowed: boolean; reason?: string } {
    const now = Date.now();

    if (timestamp > now + this.maxFutureSkewMs) {
      return {
        allowed: false,
        reason: 'Signature timestamp is too far in the future',
      };
    }

    if (now - timestamp > this.maxAgeMs) {
      return {
        allowed: false,
        reason: 'Signature expired',
      };
    }

    if (this.store.has(signatureId)) {
      return {
        allowed: false,
        reason: 'Signature already used',
      };
    }

    this.store.set(signatureId, { timestamp });
    return { allowed: true };
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now - entry.timestamp > this.maxAgeMs) {
        this.store.delete(key);
      }
    }
  }

  release(signatureId: string): void {
    this.store.delete(signatureId);
  }

  startCleanup(intervalMs: number = 60000): void {
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

export const replayProtection = new ReplayProtection(300000);
