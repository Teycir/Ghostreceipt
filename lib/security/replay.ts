interface ReplayEntry {
  timestamp: number;
}

export class ReplayProtection {
  private store: Map<string, ReplayEntry>;
  private maxAgeMs: number;

  constructor(maxAgeMs: number = 300000) {
    this.store = new Map();
    this.maxAgeMs = maxAgeMs;

    setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  check(signatureId: string, timestamp: number): { allowed: boolean; reason?: string } {
    const now = Date.now();

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
}

export const replayProtection = new ReplayProtection(300000);
