type MaybePromise<T> = T | Promise<T>;

export interface LinkVaultStorageAdapter {
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

export interface LinkVaultUsageEstimate {
  quotaBytes: number;
  usageBytes: number;
}

export interface EncryptedLinkVaultRecord<TData extends object> {
  createdAtMs: number;
  data: TData;
  id: string;
  openedAtMs: number | null;
}

export interface EncryptedLinkVaultStatus {
  entryCount: number;
  maxEntries: number;
  pressureRatio: number | null;
  pruneStartPercent: number;
  pruneToPercent: number;
  quotaBytes: number | null;
  usageBytes: number | null;
  usedPercent: number;
  warningLabel: string | null;
}

export interface SaveEncryptedLinkVaultResult {
  prunedCount: number;
  status: EncryptedLinkVaultStatus;
}

export interface AddEncryptedLinkVaultRecordOptions {
  createdAtMs?: number;
  id?: string;
  openedAtMs?: number | null;
}

export interface AddEncryptedLinkVaultRecordResult<TData extends object> extends SaveEncryptedLinkVaultResult {
  record: EncryptedLinkVaultRecord<TData>;
}

export interface EncryptedLinkVaultOptions<TData extends object> {
  encryptionKeyName?: string;
  estimateUsage?: () => MaybePromise<LinkVaultUsageEstimate | null>;
  idPrefix?: string;
  key: string;
  maxEntries?: number;
  now?: () => number;
  pruneBatchSize?: number;
  pruneStartPercent?: number;
  pruneToPercent?: number;
  quotaRetryLimit?: number;
  storage: LinkVaultStorageAdapter;
  validateRecord?: (data: unknown) => data is TData;
}

function assertPositiveInteger(name: string, value: number): number {
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

function isQuotaExceededError(error: unknown): boolean {
  if (!error) {
    return false;
  }
  if (error instanceof DOMException && error.name === 'QuotaExceededError') {
    return true;
  }
  if (error instanceof Error) {
    return error.name === 'QuotaExceededError' || /quota/i.test(error.message);
  }
  return false;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  if (typeof btoa === 'function') {
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
  }

  const maybeBuffer = (globalThis as { Buffer?: typeof Buffer }).Buffer;
  if (!maybeBuffer) {
    throw new Error('No base64 encoder available in this runtime');
  }
  return maybeBuffer.from(bytes).toString('base64url');
}

function fromBase64Url(value: string): Uint8Array {
  if (typeof atob === 'function') {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
    const binary = atob(`${normalized}${padding}`);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  const maybeBuffer = (globalThis as { Buffer?: typeof Buffer }).Buffer;
  if (!maybeBuffer) {
    throw new Error('No base64 decoder available in this runtime');
  }
  return new Uint8Array(maybeBuffer.from(value, 'base64url'));
}

function createRecordId(prefix: string): string {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  return `${prefix}${toBase64Url(bytes)}`;
}

function sortByNewest<TData extends object>(
  records: ReadonlyArray<EncryptedLinkVaultRecord<TData>>
): EncryptedLinkVaultRecord<TData>[] {
  return [...records].sort((a, b) => b.createdAtMs - a.createdAtMs);
}

function sortByOldest<TData extends object>(
  records: ReadonlyArray<EncryptedLinkVaultRecord<TData>>
): EncryptedLinkVaultRecord<TData>[] {
  return [...records].sort((a, b) => a.createdAtMs - b.createdAtMs);
}

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function createStorageUsagePercent(
  usageBytes: number | null,
  quotaBytes: number | null
): number | null {
  if (
    typeof usageBytes !== 'number' ||
    typeof quotaBytes !== 'number' ||
    !Number.isFinite(usageBytes) ||
    !Number.isFinite(quotaBytes) ||
    quotaBytes <= 0
  ) {
    return null;
  }
  return Math.max(0, Math.min(100, Math.round((usageBytes / quotaBytes) * 100)));
}

export class EncryptedLinkVault<TData extends object> {
  private readonly encryptionKeyName: string;
  private readonly estimateUsage: (() => MaybePromise<LinkVaultUsageEstimate | null>) | undefined;
  private readonly idPrefix: string;
  private readonly key: string;
  private readonly maxEntries: number;
  private readonly now: () => number;
  private readonly pruneBatchSize: number;
  private readonly pruneStartPercent: number;
  private readonly pruneToPercent: number;
  private readonly quotaRetryLimit: number;
  private readonly storage: LinkVaultStorageAdapter;
  private readonly validateRecord: (data: unknown) => data is TData;

  constructor(options: EncryptedLinkVaultOptions<TData>) {
    this.storage = options.storage;
    this.key = options.key;
    this.encryptionKeyName = options.encryptionKeyName ?? `${options.key}:enc_key`;
    this.idPrefix = options.idPrefix ?? 'l_';
    this.maxEntries = assertPositiveInteger('maxEntries', options.maxEntries ?? 1500);
    this.pruneBatchSize = assertPositiveInteger('pruneBatchSize', options.pruneBatchSize ?? 100);
    this.pruneStartPercent = assertPercent('pruneStartPercent', options.pruneStartPercent ?? 90);
    this.pruneToPercent = assertPercent('pruneToPercent', options.pruneToPercent ?? 70);
    this.quotaRetryLimit = assertPositiveInteger('quotaRetryLimit', options.quotaRetryLimit ?? 5);
    this.now = options.now ?? (() => Date.now());
    this.estimateUsage = options.estimateUsage;
    this.validateRecord =
      options.validateRecord ??
      ((data: unknown): data is TData => isRecordObject(data));

    if (this.pruneToPercent >= this.pruneStartPercent) {
      throw new Error('pruneToPercent must be lower than pruneStartPercent');
    }
    if (!this.key.trim()) {
      throw new Error('key must be a non-empty storage key');
    }
  }

  async listRecords(): Promise<EncryptedLinkVaultRecord<TData>[]> {
    return sortByNewest(await this.loadRecordsInternal());
  }

  async clearRecords(): Promise<void> {
    this.storage.removeItem(this.key);
  }

  async removeRecord(id: string): Promise<boolean> {
    const records = await this.loadRecordsInternal();
    const next = records.filter((record) => record.id !== id);
    if (next.length === records.length) {
      return false;
    }
    await this.persistRecords(next);
    return true;
  }

  async saveRecords(records: ReadonlyArray<EncryptedLinkVaultRecord<TData>>): Promise<SaveEncryptedLinkVaultResult> {
    const normalized = this.normalizeRecords(records);
    const { records: saved, prunedCount } = await this.persistWithQuotaRetry(normalized);
    const status = await this.getStatusFromRecords(saved);
    return {
      prunedCount,
      status,
    };
  }

  async addRecord(
    data: TData,
    options: AddEncryptedLinkVaultRecordOptions = {}
  ): Promise<AddEncryptedLinkVaultRecordResult<TData>> {
    const nowMs = options.createdAtMs ?? this.now();
    const record: EncryptedLinkVaultRecord<TData> = {
      createdAtMs: assertPositiveInteger('createdAtMs', nowMs),
      data,
      id: options.id?.trim() || createRecordId(this.idPrefix),
      openedAtMs: options.openedAtMs ?? null,
    };

    const records = await this.loadRecordsInternal();
    const deduped = records.filter((entry) => entry.id !== record.id);
    const prePruned = this.pruneForProjectedCapacity(deduped, deduped.length + 1);
    const toPersist = [...prePruned.records, record];
    const { records: saved, prunedCount } = await this.persistWithQuotaRetry(toPersist);
    const status = await this.getStatusFromRecords(saved);

    return {
      record,
      prunedCount: prePruned.prunedCount + prunedCount,
      status,
    };
  }

  async markRecordOpened(id: string, openedAtMs: number = this.now()): Promise<EncryptedLinkVaultRecord<TData> | null> {
    const records = await this.loadRecordsInternal();
    let updated: EncryptedLinkVaultRecord<TData> | null = null;
    const next = records.map((record) => {
      if (record.id !== id) {
        return record;
      }
      updated = {
        ...record,
        openedAtMs,
      };
      return updated;
    });

    if (!updated) {
      return null;
    }
    await this.persistRecords(next);
    return updated;
  }

  async getStatus(): Promise<EncryptedLinkVaultStatus> {
    const records = await this.loadRecordsInternal();
    return this.getStatusFromRecords(records);
  }

  private async getStatusFromRecords(
    records: ReadonlyArray<EncryptedLinkVaultRecord<TData>>
  ): Promise<EncryptedLinkVaultStatus> {
    const entryPercent = Math.min(100, Math.round((records.length / this.maxEntries) * 100));
    const estimate = await this.readUsageEstimate();
    const storagePercent = createStorageUsagePercent(estimate?.usageBytes ?? null, estimate?.quotaBytes ?? null);
    const usedPercent = storagePercent ?? entryPercent;
    const warningLabel =
      usedPercent >= this.pruneStartPercent
        ? `Storage ${usedPercent}% full, pruning oldest records`
        : null;

    return {
      entryCount: records.length,
      maxEntries: this.maxEntries,
      pressureRatio:
        typeof estimate?.usageBytes === 'number' && typeof estimate.quotaBytes === 'number'
          ? estimate.usageBytes / estimate.quotaBytes
          : null,
      pruneStartPercent: this.pruneStartPercent,
      pruneToPercent: this.pruneToPercent,
      quotaBytes: estimate?.quotaBytes ?? null,
      usageBytes: estimate?.usageBytes ?? null,
      usedPercent,
      warningLabel,
    };
  }

  private async readUsageEstimate(): Promise<LinkVaultUsageEstimate | null> {
    if (!this.estimateUsage) {
      return null;
    }
    try {
      const estimate = await this.estimateUsage();
      if (!estimate) {
        return null;
      }
      const usageBytes = Number(estimate.usageBytes);
      const quotaBytes = Number(estimate.quotaBytes);
      if (!Number.isFinite(usageBytes) || !Number.isFinite(quotaBytes) || quotaBytes <= 0) {
        return null;
      }
      return {
        usageBytes,
        quotaBytes,
      };
    } catch {
      return null;
    }
  }

  private async persistRecords(records: ReadonlyArray<EncryptedLinkVaultRecord<TData>>): Promise<void> {
    const payload = JSON.stringify(this.normalizeRecords(records));
    const encrypted = await this.encrypt(payload);
    this.storage.setItem(this.key, encrypted);
  }

  private async persistWithQuotaRetry(
    records: ReadonlyArray<EncryptedLinkVaultRecord<TData>>
  ): Promise<{ prunedCount: number; records: EncryptedLinkVaultRecord<TData>[] }> {
    let working = this.normalizeRecords(records);
    let prunedCount = 0;

    for (let attempt = 0; attempt <= this.quotaRetryLimit; attempt += 1) {
      try {
        await this.persistRecords(working);
        return {
          prunedCount,
          records: working,
        };
      } catch (error) {
        if (!isQuotaExceededError(error) || attempt === this.quotaRetryLimit) {
          throw error;
        }

        const sorted = sortByOldest(working);
        const toDrop = Math.min(this.pruneBatchSize, sorted.length);
        if (toDrop <= 0) {
          throw new Error('Encrypted link vault is full and cannot be pruned further');
        }
        working = sorted.slice(toDrop);
        prunedCount += toDrop;
      }
    }

    throw new Error('Encrypted link vault could not persist data');
  }

  private pruneForProjectedCapacity(
    records: ReadonlyArray<EncryptedLinkVaultRecord<TData>>,
    projectedCount: number
  ): { prunedCount: number; records: EncryptedLinkVaultRecord<TData>[] } {
    const sorted = sortByOldest(records);
    const pruneStartCount = Math.ceil((this.maxEntries * this.pruneStartPercent) / 100);
    const pruneTargetCount = Math.floor((this.maxEntries * this.pruneToPercent) / 100);
    const targetBeforeInsert = Math.max(0, pruneTargetCount - 1);

    const working = [...sorted];
    let prunedCount = 0;

    if (projectedCount >= pruneStartCount) {
      while (working.length > targetBeforeInsert) {
        working.shift();
        prunedCount += 1;
      }
    }

    while (working.length >= this.maxEntries) {
      working.shift();
      prunedCount += 1;
    }

    return {
      prunedCount,
      records: working,
    };
  }

  private normalizeRecords(
    records: ReadonlyArray<EncryptedLinkVaultRecord<TData>>
  ): EncryptedLinkVaultRecord<TData>[] {
    const byId = new Map<string, EncryptedLinkVaultRecord<TData>>();

    for (const record of records) {
      if (!record.id || !record.id.trim()) {
        continue;
      }
      const createdAtMs = Number(record.createdAtMs);
      if (!Number.isFinite(createdAtMs) || createdAtMs <= 0) {
        continue;
      }

      byId.set(record.id.trim(), {
        createdAtMs,
        data: record.data,
        id: record.id.trim(),
        openedAtMs:
          typeof record.openedAtMs === 'number' && Number.isFinite(record.openedAtMs)
            ? record.openedAtMs
            : null,
      });
    }

    return sortByNewest(Array.from(byId.values()));
  }

  private parseRecord(value: unknown): EncryptedLinkVaultRecord<TData> | null {
    if (!isRecordObject(value)) {
      return null;
    }
    const idValue = value['id'];
    const createdAtValue = value['createdAtMs'];
    const openedAtRaw = value['openedAtMs'];
    const dataValue = value['data'];
    const id = typeof idValue === 'string' ? idValue.trim() : '';
    const createdAtMs = Number(createdAtValue);
    const openedAtMs =
      typeof openedAtRaw === 'number' && Number.isFinite(openedAtRaw) ? openedAtRaw : null;

    if (!id || !Number.isFinite(createdAtMs) || createdAtMs <= 0 || !this.validateRecord(dataValue)) {
      return null;
    }

    return {
      createdAtMs,
      data: dataValue,
      id,
      openedAtMs,
    };
  }

  private async loadRecordsInternal(): Promise<EncryptedLinkVaultRecord<TData>[]> {
    const encrypted = this.storage.getItem(this.key);
    if (!encrypted) {
      return [];
    }

    try {
      const decrypted = await this.decrypt(encrypted);
      const parsed = JSON.parse(decrypted);
      if (!Array.isArray(parsed)) {
        return [];
      }
      const records = parsed
        .map((entry) => this.parseRecord(entry))
        .filter((entry): entry is EncryptedLinkVaultRecord<TData> => entry !== null);
      return this.normalizeRecords(records);
    } catch {
      return [];
    }
  }

  private async getEncryptionKey(): Promise<CryptoKey> {
    const storedKey = this.storage.getItem(this.encryptionKeyName);
    if (storedKey) {
      const raw = fromBase64Url(storedKey);
      const rawBuffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer;
      return globalThis.crypto.subtle.importKey(
        'raw',
        rawBuffer,
        { name: 'AES-GCM' },
        true,
        ['encrypt', 'decrypt']
      );
    }

    const generated = await globalThis.crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    const exported = await globalThis.crypto.subtle.exportKey('raw', generated);
    this.storage.setItem(this.encryptionKeyName, toBase64Url(new Uint8Array(exported)));
    return generated;
  }

  private async encrypt(plaintext: string): Promise<string> {
    const key = await this.getEncryptionKey();
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const payload = new TextEncoder().encode(plaintext);
    const ciphertext = await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, payload);

    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);
    return toBase64Url(combined);
  }

  private async decrypt(encrypted: string): Promise<string> {
    const key = await this.getEncryptionKey();
    const combined = fromBase64Url(encrypted);
    if (combined.byteLength <= 12) {
      throw new Error('Encrypted payload is invalid');
    }

    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const plaintext = await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return new TextDecoder().decode(plaintext);
  }
}

export function createWebStorageAdapter(storage: Storage): LinkVaultStorageAdapter {
  return {
    getItem(key: string): string | null {
      return storage.getItem(key);
    },
    removeItem(key: string): void {
      storage.removeItem(key);
    },
    setItem(key: string, value: string): void {
      storage.setItem(key, value);
    },
  };
}
