import { createHash } from 'crypto';
import { OracleSigner } from '@/lib/oracle/signer';

type MaybePromise<T> = T | Promise<T>;

export interface OracleAuthReplayPayload {
  expiresAt: number;
  messageHash: string;
  nonce: string;
  oraclePubKeyId: string;
  signedAt: number;
}

export interface OracleAuthReplayEntry {
  expiresAt: number;
  firstSeenAtMs: number;
  payloadDigest: string;
}

export interface OracleAuthReplayAdapter {
  cleanup?(nowMs?: number): MaybePromise<void>;
  dispose?(): MaybePromise<void>;
  get(key: string): MaybePromise<OracleAuthReplayEntry | null>;
  set(key: string, entry: OracleAuthReplayEntry): MaybePromise<void>;
}

export interface InMemoryOracleAuthReplayAdapterOptions {
  cleanupIntervalMs?: number;
  maxEntries?: number;
  startCleanupTimer?: boolean;
}

export class InMemoryOracleAuthReplayAdapter implements OracleAuthReplayAdapter {
  private readonly cleanupIntervalMs: number;
  private readonly maxEntries: number;
  private readonly store = new Map<string, OracleAuthReplayEntry>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private lastCleanupAt = Date.now();

  constructor(options: InMemoryOracleAuthReplayAdapterOptions = {}) {
    this.cleanupIntervalMs = options.cleanupIntervalMs ?? 60_000;
    this.maxEntries = options.maxEntries ?? 5_000;
    if (options.startCleanupTimer ?? true) {
      this.startCleanupTimer();
    }
  }

  get(key: string): OracleAuthReplayEntry | null {
    this.maybeCleanup(Date.now());
    return this.store.get(key) ?? null;
  }

  set(key: string, entry: OracleAuthReplayEntry): void {
    this.maybeCleanup(Date.now());
    this.store.set(key, entry);
    this.enforceMaxEntries();
  }

  cleanup(nowMs: number = Date.now()): void {
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt <= Math.floor(nowMs / 1000)) {
        this.store.delete(key);
      }
    }
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
    this.lastCleanupAt = nowMs;
  }

  private enforceMaxEntries(): void {
    if (this.store.size <= this.maxEntries) {
      return;
    }

    const sortedEntries = Array.from(this.store.entries())
      .sort((a, b) => a[1].firstSeenAtMs - b[1].firstSeenAtMs);
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

export interface OracleAuthReplayRegistryOptions {
  adapter: OracleAuthReplayAdapter;
  maxFutureSkewSeconds?: number;
}

export type OracleAuthReplayRejectReason =
  | 'SIGNED_AT_IN_FUTURE'
  | 'SIGNATURE_EXPIRED'
  | 'NONCE_REUSE_CONFLICT';

export type OracleAuthReplayDecision =
  | {
      allowed: true;
      mode: 'first_seen' | 'idempotent';
    }
  | {
      allowed: false;
      message: string;
      reason: OracleAuthReplayRejectReason;
    };

export interface CheckOracleAuthReplayInput {
  nowMs?: number;
  payload: OracleAuthReplayPayload;
  scope: string;
}

export class OracleAuthReplayRegistry {
  private readonly adapter: OracleAuthReplayAdapter;
  private readonly maxFutureSkewSeconds: number;

  constructor(options: OracleAuthReplayRegistryOptions) {
    this.adapter = options.adapter;
    this.maxFutureSkewSeconds = options.maxFutureSkewSeconds ?? 30;
  }

  async check({
    nowMs = Date.now(),
    payload,
    scope,
  }: CheckOracleAuthReplayInput): Promise<OracleAuthReplayDecision> {
    const nowUnix = Math.floor(nowMs / 1000);
    const signedAt = payload.signedAt;
    const expiresAt = payload.expiresAt;

    if (signedAt > nowUnix + this.maxFutureSkewSeconds) {
      return {
        allowed: false,
        message: 'Signature timestamp is too far in the future',
        reason: 'SIGNED_AT_IN_FUTURE',
      };
    }

    if (expiresAt <= nowUnix) {
      return {
        allowed: false,
        message: 'Signature expired',
        reason: 'SIGNATURE_EXPIRED',
      };
    }

    if (typeof this.adapter.cleanup === 'function') {
      await this.adapter.cleanup(nowMs);
    }

    const replayKey = `${scope}:${payload.nonce}`;
    const payloadDigest = digestPayload(payload);
    const existing = await this.adapter.get(replayKey);
    if (!existing) {
      await this.adapter.set(replayKey, {
        expiresAt,
        firstSeenAtMs: nowMs,
        payloadDigest,
      });
      return {
        allowed: true,
        mode: 'first_seen',
      };
    }

    if (existing.payloadDigest === payloadDigest) {
      if (expiresAt > existing.expiresAt) {
        await this.adapter.set(replayKey, {
          ...existing,
          expiresAt,
        });
      }
      return {
        allowed: true,
        mode: 'idempotent',
      };
    }

    return {
      allowed: false,
      message: 'Nonce has already been used for a different payload',
      reason: 'NONCE_REUSE_CONFLICT',
    };
  }

  async dispose(): Promise<void> {
    if (typeof this.adapter.dispose === 'function') {
      await this.adapter.dispose();
    }
  }
}

let sharedOracleAuthReplayRegistry: OracleAuthReplayRegistry | null = null;

export interface SharedOracleAuthReplayRegistryOptions {
  cleanupIntervalMs?: number;
  maxEntries?: number;
  maxFutureSkewSeconds?: number;
}

export function getSharedOracleAuthReplayRegistry(
  options: SharedOracleAuthReplayRegistryOptions = {}
): OracleAuthReplayRegistry {
  if (!sharedOracleAuthReplayRegistry) {
    const adapterOptions: InMemoryOracleAuthReplayAdapterOptions = {
      ...(options.cleanupIntervalMs !== undefined
        ? { cleanupIntervalMs: options.cleanupIntervalMs }
        : {}),
      ...(options.maxEntries !== undefined
        ? { maxEntries: options.maxEntries }
        : {}),
    };
    const registryOptions: OracleAuthReplayRegistryOptions = {
      adapter: new InMemoryOracleAuthReplayAdapter(adapterOptions),
      ...(options.maxFutureSkewSeconds !== undefined
        ? { maxFutureSkewSeconds: options.maxFutureSkewSeconds }
        : {}),
    };

    sharedOracleAuthReplayRegistry = new OracleAuthReplayRegistry({
      ...registryOptions,
    });
  }

  return sharedOracleAuthReplayRegistry;
}

export async function disposeSharedOracleAuthReplayRegistryForTests(): Promise<void> {
  if (!sharedOracleAuthReplayRegistry) {
    return;
  }

  await sharedOracleAuthReplayRegistry.dispose();
  sharedOracleAuthReplayRegistry = null;
}

function digestPayload(payload: OracleAuthReplayPayload): string {
  return createHash('sha256')
    .update(
      OracleSigner.serializeAuthEnvelope({
        expiresAt: payload.expiresAt,
        messageHash: payload.messageHash,
        nonce: payload.nonce,
        oraclePubKeyId: payload.oraclePubKeyId,
        signedAt: payload.signedAt,
      }),
      'utf8'
    )
    .digest('hex');
}
