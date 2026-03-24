type MaybePromise<T> = T | Promise<T>;

export interface SharePointerStorageEntry {
  createdAtMs: number;
  deactivatedAtMs: number | null;
  expiresAtMs: number;
  id: string;
  isActive: boolean;
  lastAccessedAtMs: number;
  payload: string;
}

export interface SharePointerStorageAdapter {
  delete(id: string): MaybePromise<void>;
  get(id: string): MaybePromise<SharePointerStorageEntry | null>;
  list(): MaybePromise<SharePointerStorageEntry[]>;
  set(entry: SharePointerStorageEntry): MaybePromise<void>;
  dispose?(): MaybePromise<void>;
}

export interface D1StatementAllResult<Row> {
  results: Row[];
}

export interface D1PreparedStatementLike {
  all<Row = Record<string, unknown>>(): Promise<D1StatementAllResult<Row>>;
  bind(...values: unknown[]): D1PreparedStatementLike;
  first<Row = Record<string, unknown>>(): Promise<Row | null>;
  run(): Promise<unknown>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatementLike;
}

export class InMemorySharePointerStorageAdapter implements SharePointerStorageAdapter {
  private readonly store = new Map<string, SharePointerStorageEntry>();

  delete(id: string): void {
    this.store.delete(id);
  }

  get(id: string): SharePointerStorageEntry | null {
    return this.store.get(id) ?? null;
  }

  list(): SharePointerStorageEntry[] {
    return Array.from(this.store.values());
  }

  set(entry: SharePointerStorageEntry): void {
    this.store.set(entry.id, entry);
  }

  dispose(): void {
    this.store.clear();
  }
}

interface D1SharePointerStorageRow {
  created_at_ms: number;
  deactivated_at_ms: number | null;
  expires_at_ms: number;
  id: string;
  is_active: number;
  last_accessed_at_ms: number;
  payload: string;
}

export interface D1SharePointerStorageAdapterOptions {
  database: D1DatabaseLike;
  tableName?: string;
}

export class D1SharePointerStorageAdapter implements SharePointerStorageAdapter {
  private readonly database: D1DatabaseLike;
  private readonly tableName: string;

  constructor(options: D1SharePointerStorageAdapterOptions) {
    this.database = options.database;
    this.tableName = options.tableName ?? 'share_pointers';
  }

  async initialize(): Promise<void> {
    await this.database.prepare(
      `CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        created_at_ms INTEGER NOT NULL,
        expires_at_ms INTEGER NOT NULL,
        last_accessed_at_ms INTEGER NOT NULL,
        is_active INTEGER NOT NULL,
        deactivated_at_ms INTEGER
      )`
    ).run();

    await this.database.prepare(
      `CREATE INDEX IF NOT EXISTS ${this.tableName}_active_access_idx
       ON ${this.tableName}(is_active, last_accessed_at_ms, created_at_ms)`
    ).run();

    await this.database.prepare(
      `CREATE INDEX IF NOT EXISTS ${this.tableName}_expires_idx
       ON ${this.tableName}(expires_at_ms)`
    ).run();
  }

  async delete(id: string): Promise<void> {
    await this.database
      .prepare(`DELETE FROM ${this.tableName} WHERE id = ?`)
      .bind(id)
      .run();
  }

  async get(id: string): Promise<SharePointerStorageEntry | null> {
    const row = await this.database
      .prepare(
        `SELECT id, payload, created_at_ms, expires_at_ms, last_accessed_at_ms, is_active, deactivated_at_ms
         FROM ${this.tableName}
         WHERE id = ?`
      )
      .bind(id)
      .first<D1SharePointerStorageRow>();

    return row ? mapD1RowToEntry(row) : null;
  }

  async list(): Promise<SharePointerStorageEntry[]> {
    const result = await this.database
      .prepare(
        `SELECT id, payload, created_at_ms, expires_at_ms, last_accessed_at_ms, is_active, deactivated_at_ms
         FROM ${this.tableName}`
      )
      .all<D1SharePointerStorageRow>();

    return result.results.map(mapD1RowToEntry);
  }

  async set(entry: SharePointerStorageEntry): Promise<void> {
    await this.database
      .prepare(
        `INSERT INTO ${this.tableName}
           (id, payload, created_at_ms, expires_at_ms, last_accessed_at_ms, is_active, deactivated_at_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           payload = excluded.payload,
           created_at_ms = excluded.created_at_ms,
           expires_at_ms = excluded.expires_at_ms,
           last_accessed_at_ms = excluded.last_accessed_at_ms,
           is_active = excluded.is_active,
           deactivated_at_ms = excluded.deactivated_at_ms`
      )
      .bind(
        entry.id,
        entry.payload,
        entry.createdAtMs,
        entry.expiresAtMs,
        entry.lastAccessedAtMs,
        entry.isActive ? 1 : 0,
        entry.deactivatedAtMs
      )
      .run();
  }
}

export interface SharePointerStorageStatus {
  activeEntries: number;
  inactiveEntries: number;
  maxActiveEntries: number;
  pruneStartPercent: number;
  pruneToPercent: number;
  usedPercent: number;
  warningLabel: string | null;
}

export interface SharePointerStoreResult {
  expiresAtMs: number;
  id: string;
  prunedCount: number;
  status: SharePointerStorageStatus;
}

export type SharePointerResolveResult =
  | {
      payload: string;
      reason: null;
      status: SharePointerStorageStatus;
    }
  | {
      payload: null;
      reason: 'EXPIRED' | 'INVALID_ID' | 'NOT_FOUND';
      status: SharePointerStorageStatus;
    };

export interface SharePointerCleanupResult {
  deactivatedCount: number;
  deletedCount: number;
}

export interface SharePointerStorageManagerOptions {
  adapter: SharePointerStorageAdapter;
  defaultTtlMs?: number;
  hardDeleteAfterMs?: number;
  maxActiveEntries?: number;
  maxPayloadBytes?: number;
  pruneStartPercent?: number;
  pruneToPercent?: number;
}

export interface StoreSharePointerOptions {
  nowMs?: number;
  ttlMs?: number;
}

export interface ResolveSharePointerOptions {
  nowMs?: number;
}

function assertPositiveInt(name: string, value: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function assertPercent(name: string, value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new Error(`${name} must be an integer between 1 and 100`);
  }
  return value;
}

function byteLengthUtf8(value: string): number {
  return new TextEncoder().encode(value).length;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  if (typeof btoa === 'function') {
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
  }

  return Buffer.from(bytes).toString('base64url');
}

function createSharePointerId(): string {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  return `r_${bytesToBase64Url(bytes)}`;
}

function isValidSharePointerId(value: string): boolean {
  return /^r_[A-Za-z0-9_-]{16}$/.test(value);
}

function mapD1RowToEntry(row: D1SharePointerStorageRow): SharePointerStorageEntry {
  return {
    createdAtMs: row.created_at_ms,
    deactivatedAtMs: row.deactivated_at_ms,
    expiresAtMs: row.expires_at_ms,
    id: row.id,
    isActive: row.is_active === 1,
    lastAccessedAtMs: row.last_accessed_at_ms,
    payload: row.payload,
  };
}

/**
 * Sanctum-derived storage lifecycle abstraction:
 * 1) Active records auto-deactivate once expired.
 * 2) Inactive records are hard-deleted after a grace window.
 * 3) When usage reaches a high-water mark, oldest active records are pruned.
 */
export class SharePointerStorageManager {
  private readonly adapter: SharePointerStorageAdapter;
  private readonly defaultTtlMs: number;
  private readonly hardDeleteAfterMs: number;
  private readonly maxActiveEntries: number;
  private readonly maxPayloadBytes: number;
  private readonly pruneStartPercent: number;
  private readonly pruneToPercent: number;

  constructor(options: SharePointerStorageManagerOptions) {
    this.adapter = options.adapter;
    this.defaultTtlMs = assertPositiveInt('defaultTtlMs', options.defaultTtlMs ?? 1000 * 60 * 60 * 24 * 7);
    this.hardDeleteAfterMs = assertPositiveInt('hardDeleteAfterMs', options.hardDeleteAfterMs ?? 1000 * 60 * 60 * 24 * 30);
    this.maxActiveEntries = assertPositiveInt('maxActiveEntries', options.maxActiveEntries ?? 1000);
    this.maxPayloadBytes = assertPositiveInt('maxPayloadBytes', options.maxPayloadBytes ?? 1024 * 100);
    this.pruneStartPercent = assertPercent('pruneStartPercent', options.pruneStartPercent ?? 90);
    this.pruneToPercent = assertPercent('pruneToPercent', options.pruneToPercent ?? 70);

    if (this.pruneToPercent >= this.pruneStartPercent) {
      throw new Error('pruneToPercent must be lower than pruneStartPercent');
    }
  }

  async cleanup(nowMs: number = Date.now()): Promise<SharePointerCleanupResult> {
    const entries = await this.adapter.list();
    let deactivatedCount = 0;
    let deletedCount = 0;

    for (const entry of entries) {
      if (entry.isActive && entry.expiresAtMs <= nowMs) {
        await this.adapter.set({
          ...entry,
          deactivatedAtMs: nowMs,
          isActive: false,
        });
        deactivatedCount += 1;
      }
    }

    const refreshedEntries = await this.adapter.list();
    for (const entry of refreshedEntries) {
      if (entry.isActive) {
        continue;
      }

      const baseTime = entry.deactivatedAtMs ?? entry.expiresAtMs;
      if (baseTime + this.hardDeleteAfterMs <= nowMs) {
        await this.adapter.delete(entry.id);
        deletedCount += 1;
      }
    }

    return {
      deactivatedCount,
      deletedCount,
    };
  }

  async getStatus(nowMs: number = Date.now()): Promise<SharePointerStorageStatus> {
    await this.cleanup(nowMs);
    const entries = await this.adapter.list();
    const activeEntries = entries.filter((entry) => entry.isActive).length;
    const inactiveEntries = entries.length - activeEntries;
    const usedPercent = Math.min(100, Math.round((activeEntries / this.maxActiveEntries) * 100));

    return {
      activeEntries,
      inactiveEntries,
      maxActiveEntries: this.maxActiveEntries,
      pruneStartPercent: this.pruneStartPercent,
      pruneToPercent: this.pruneToPercent,
      usedPercent,
      warningLabel:
        usedPercent >= this.pruneStartPercent
          ? `Storage ${usedPercent}% full, pruning oldest records`
          : null,
    };
  }

  async resolvePointer(
    id: string,
    options: ResolveSharePointerOptions = {}
  ): Promise<SharePointerResolveResult> {
    const nowMs = options.nowMs ?? Date.now();
    await this.cleanup(nowMs);

    if (!isValidSharePointerId(id)) {
      return {
        payload: null,
        reason: 'INVALID_ID',
        status: await this.getStatus(nowMs),
      };
    }

    const entry = await this.adapter.get(id);
    if (!entry) {
      return {
        payload: null,
        reason: 'NOT_FOUND',
        status: await this.getStatus(nowMs),
      };
    }

    if (!entry.isActive) {
      return {
        payload: null,
        reason: entry.expiresAtMs <= nowMs ? 'EXPIRED' : 'NOT_FOUND',
        status: await this.getStatus(nowMs),
      };
    }

    if (entry.expiresAtMs <= nowMs) {
      await this.adapter.set({
        ...entry,
        deactivatedAtMs: nowMs,
        isActive: false,
      });
      return {
        payload: null,
        reason: 'EXPIRED',
        status: await this.getStatus(nowMs),
      };
    }

    await this.adapter.set({
      ...entry,
      lastAccessedAtMs: nowMs,
    });
    return {
      payload: entry.payload,
      reason: null,
      status: await this.getStatus(nowMs),
    };
  }

  async storePointer(
    payload: string,
    options: StoreSharePointerOptions = {}
  ): Promise<SharePointerStoreResult> {
    const nowMs = options.nowMs ?? Date.now();
    await this.cleanup(nowMs);

    if (!payload.trim()) {
      throw new Error('Cannot store empty payload');
    }

    const payloadBytes = byteLengthUtf8(payload);
    if (payloadBytes > this.maxPayloadBytes) {
      throw new Error(`Payload too large: ${payloadBytes} bytes (max: ${this.maxPayloadBytes})`);
    }

    const prunedCount = await this.pruneOldestIfNeeded();
    const ttlMs = options.ttlMs ?? this.defaultTtlMs;
    const expiresAtMs = nowMs + assertPositiveInt('ttlMs', ttlMs);

    let id = createSharePointerId();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const existing = await this.adapter.get(id);
      if (!existing) {
        break;
      }
      id = createSharePointerId();
    }

    await this.adapter.set({
      createdAtMs: nowMs,
      deactivatedAtMs: null,
      expiresAtMs,
      id,
      isActive: true,
      lastAccessedAtMs: nowMs,
      payload,
    });

    return {
      expiresAtMs,
      id,
      prunedCount,
      status: await this.getStatus(nowMs),
    };
  }

  async dispose(): Promise<void> {
    if (typeof this.adapter.dispose === 'function') {
      await this.adapter.dispose();
    }
  }

  private async pruneOldestIfNeeded(): Promise<number> {
    const entries = await this.adapter.list();
    const activeEntries = entries.filter((entry) => entry.isActive);
    const projectedActive = activeEntries.length + 1;
    const pruneStartCount = Math.ceil((this.maxActiveEntries * this.pruneStartPercent) / 100);
    if (projectedActive < pruneStartCount) {
      return 0;
    }

    const pruneTargetCount = Math.floor((this.maxActiveEntries * this.pruneToPercent) / 100);
    const activeTargetBeforeInsert = Math.max(0, pruneTargetCount - 1);
    const sortedOldest = [...activeEntries].sort((a, b) => {
      if (a.lastAccessedAtMs !== b.lastAccessedAtMs) {
        return a.lastAccessedAtMs - b.lastAccessedAtMs;
      }
      return a.createdAtMs - b.createdAtMs;
    });

    let prunedCount = 0;
    while (sortedOldest.length > activeTargetBeforeInsert) {
      const oldest = sortedOldest.shift();
      if (!oldest) {
        break;
      }
      await this.adapter.delete(oldest.id);
      prunedCount += 1;
    }

    return prunedCount;
  }
}
