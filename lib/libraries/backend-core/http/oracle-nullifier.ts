import { createHash } from 'crypto';
import { z } from 'zod';
import {
  OracleCommitmentSchema,
  OracleNullifierSchema,
} from '@/lib/validation/schemas';

type MaybePromise<T> = T | Promise<T>;

export const NullifierClaimAmountSchema = z
  .string()
  .regex(/^[0-9]{1,78}$/, 'Invalid claimed amount format');

export const NullifierClaimMinDateUnixSchema = z
  .number()
  .int()
  .positive('Invalid minimum date');

export const CheckNullifierRequestSchema = z.object({
  claimedAmount: NullifierClaimAmountSchema,
  messageHash: OracleCommitmentSchema,
  minDateUnix: NullifierClaimMinDateUnixSchema,
  nullifier: OracleNullifierSchema.optional(),
}).strict();

export type CheckNullifierRequest = z.infer<typeof CheckNullifierRequestSchema>;

export interface NullifierRegistryEntry {
  claimDigest: string;
  firstSeenAtMs: number;
  lastSeenAtMs: number;
}

export interface NullifierRegistryAdapter {
  cleanup?(nowMs?: number): MaybePromise<void>;
  dispose?(): MaybePromise<void>;
  get(nullifier: string): MaybePromise<NullifierRegistryEntry | null>;
  set(nullifier: string, entry: NullifierRegistryEntry): MaybePromise<void>;
}

export interface InMemoryNullifierRegistryAdapterOptions {
  cleanupIntervalMs?: number;
  maxEntries?: number;
}

export class InMemoryNullifierRegistryAdapter implements NullifierRegistryAdapter {
  private readonly cleanupIntervalMs: number;
  private readonly maxEntries: number;
  private readonly store = new Map<string, NullifierRegistryEntry>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private lastCleanupAt = Date.now();

  constructor(options: InMemoryNullifierRegistryAdapterOptions = {}) {
    this.cleanupIntervalMs = options.cleanupIntervalMs ?? 60_000;
    this.maxEntries = options.maxEntries ?? 10_000;
    this.startCleanupTimer();
  }

  get(nullifier: string): NullifierRegistryEntry | null {
    this.maybeCleanup(Date.now());
    return this.store.get(nullifier) ?? null;
  }

  set(nullifier: string, entry: NullifierRegistryEntry): void {
    this.maybeCleanup(Date.now());
    this.store.set(nullifier, entry);
    this.enforceMaxEntries();
  }

  cleanup(nowMs: number = Date.now()): void {
    // The in-memory adapter has no time-based expiry policy for nullifiers.
    // Cleanup only serves as bounded-memory maintenance through max-size eviction.
    this.lastCleanupAt = nowMs;
    this.enforceMaxEntries();
  }

  dispose(): void {
    if (this.cleanupTimer !== null) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.store.clear();
  }

  private maybeCleanup(nowMs: number): void {
    if (nowMs - this.lastCleanupAt < this.cleanupIntervalMs) {
      return;
    }
    this.cleanup(nowMs);
  }

  private enforceMaxEntries(): void {
    if (this.store.size <= this.maxEntries) {
      return;
    }

    const sortedEntries = Array.from(this.store.entries())
      .sort((a, b) => a[1].lastSeenAtMs - b[1].lastSeenAtMs);
    const overflowCount = this.store.size - this.maxEntries;
    const evictionCount = Math.max(overflowCount, Math.floor(this.maxEntries * 0.2));

    for (const [key] of sortedEntries.slice(0, evictionCount)) {
      this.store.delete(key);
    }
  }

  private startCleanupTimer(): void {
    if (this.cleanupTimer !== null) {
      return;
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupIntervalMs);

    const timer = this.cleanupTimer as unknown as { unref?: () => void };
    if (typeof timer.unref === 'function') {
      timer.unref();
    }
  }
}

export type NullifierRegistryDecision =
  | {
      allowed: true;
      mode: 'first_seen' | 'idempotent';
      nullifier: string;
    }
  | {
      allowed: false;
      claimDigest: string;
      message: string;
      nullifier: string;
      reason: 'NULLIFIER_CLAIM_CONFLICT';
    };

export interface NullifierRegistryCheckInput {
  claimDigest: string;
  nowMs?: number;
  nullifier: string;
}

export interface NullifierRegistryOptions {
  adapter: NullifierRegistryAdapter;
}

export class NullifierRegistry {
  private readonly adapter: NullifierRegistryAdapter;

  constructor(options: NullifierRegistryOptions) {
    this.adapter = options.adapter;
  }

  async check({
    claimDigest,
    nowMs = Date.now(),
    nullifier,
  }: NullifierRegistryCheckInput): Promise<NullifierRegistryDecision> {
    if (typeof this.adapter.cleanup === 'function') {
      await this.adapter.cleanup(nowMs);
    }

    const existing = await this.adapter.get(nullifier);
    if (!existing) {
      await this.adapter.set(nullifier, {
        claimDigest,
        firstSeenAtMs: nowMs,
        lastSeenAtMs: nowMs,
      });
      return {
        allowed: true,
        mode: 'first_seen',
        nullifier,
      };
    }

    if (existing.claimDigest === claimDigest) {
      await this.adapter.set(nullifier, {
        ...existing,
        lastSeenAtMs: nowMs,
      });
      return {
        allowed: true,
        mode: 'idempotent',
        nullifier,
      };
    }

    return {
      allowed: false,
      claimDigest: existing.claimDigest,
      message: 'Nullifier already exists with a different claim',
      nullifier,
      reason: 'NULLIFIER_CLAIM_CONFLICT',
    };
  }

  async dispose(): Promise<void> {
    if (typeof this.adapter.dispose === 'function') {
      await this.adapter.dispose();
    }
  }
}

let sharedNullifierRegistry: NullifierRegistry | null = null;

export interface SharedNullifierRegistryOptions {
  cleanupIntervalMs?: number;
  maxEntries?: number;
}

export function getSharedNullifierRegistry(
  options: SharedNullifierRegistryOptions = {}
): NullifierRegistry {
  if (!sharedNullifierRegistry) {
    const adapterOptions: InMemoryNullifierRegistryAdapterOptions = {
      ...(options.cleanupIntervalMs !== undefined
        ? { cleanupIntervalMs: options.cleanupIntervalMs }
        : {}),
      ...(options.maxEntries !== undefined
        ? { maxEntries: options.maxEntries }
        : {}),
    };
    sharedNullifierRegistry = new NullifierRegistry({
      adapter: new InMemoryNullifierRegistryAdapter(adapterOptions),
    });
  }

  return sharedNullifierRegistry;
}

export async function disposeSharedNullifierRegistryForTests(): Promise<void> {
  if (!sharedNullifierRegistry) {
    return;
  }
  await sharedNullifierRegistry.dispose();
  sharedNullifierRegistry = null;
}

/**
 * Nullifier derivation rationale:
 * - We bind nullifier to oracle commitment (`messageHash`) so the same canonical tx facts
 *   always map to one nullifier without revealing tx hash or addresses.
 * - Prefixing with a domain/version tag prevents accidental cross-feature collisions.
 */
export function deriveNullifier(messageHash: string): string {
  return createHash('sha256')
    .update(`gr:nullifier:message-hash:v1:${messageHash}`, 'utf8')
    .digest('hex');
}

export function deriveClaimDigest(claimedAmount: string, minDateUnix: number): string {
  return createHash('sha256')
    .update(`claimedAmount=${claimedAmount}&minDateUnix=${minDateUnix}`, 'utf8')
    .digest('hex');
}
