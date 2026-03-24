import type { Chain } from '@/lib/generator/types';

const RECEIPT_HISTORY_DB_NAME = 'ghostreceipt-db';
const RECEIPT_HISTORY_STORE_NAME = 'receipt-history';
const RECEIPT_HISTORY_DB_VERSION = 1;
const RECEIPT_HISTORY_EXPORT_VERSION = 1;
const RECEIPT_HISTORY_NEAR_FULL_RATIO = 0.9;
const RECEIPT_HISTORY_MAX_ENTRIES = 1500;
const RECEIPT_HISTORY_PRUNE_BATCH_SIZE = 100;
const RECEIPT_HISTORY_QUOTA_RETRY_LIMIT = 5;

let dbPromise: Promise<IDBDatabase> | null = null;

const SUPPORTED_CHAINS: ReadonlySet<Chain> = new Set(['bitcoin', 'ethereum', 'solana']);

export interface ReceiptHistoryEntry {
  id: string;
  proof: string;
  chain: Chain;
  claimedAmount: string;
  minDate: string;
  openedAt?: string;
  receiptLabel?: string;
  receiptCategory?: string;
  createdAt: string;
}

export interface ReceiptHistoryEntryInput {
  proof: string;
  chain: Chain;
  claimedAmount: string;
  minDate: string;
  receiptLabel?: string;
  receiptCategory?: string;
}

export interface ReceiptHistoryFilter {
  query: string;
  chain: Chain | 'all';
  category: string;
}

export interface ReceiptHistoryExport {
  exportedAt: string;
  schemaVersion: number;
  entries: ReceiptHistoryEntry[];
}

export interface ReceiptHistoryStorageStatus {
  nearFull: boolean;
  pressureRatio: number | null;
  quotaBytes: number | null;
  usageBytes: number | null;
}

function getIndexedDbFactory(): IDBFactory | null {
  const maybeIndexedDb = (globalThis as { indexedDB?: IDBFactory }).indexedDB;
  return maybeIndexedDb ?? null;
}

function generateEntryId(): string {
  const maybeCrypto = globalThis.crypto as Crypto | undefined;
  if (maybeCrypto && typeof maybeCrypto.randomUUID === 'function') {
    return maybeCrypto.randomUUID();
  }
  return `receipt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function toRequestPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function toTransactionPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
  });
}

async function openHistoryDb(): Promise<IDBDatabase> {
  const indexedDb = getIndexedDbFactory();
  if (!indexedDb) {
    throw new Error('IndexedDB is unavailable');
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDb.open(RECEIPT_HISTORY_DB_NAME, RECEIPT_HISTORY_DB_VERSION);

    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
    request.onblocked = () => reject(new Error('IndexedDB open blocked by another tab'));
    request.onupgradeneeded = () => {
      const db = request.result;
      const store = db.objectStoreNames.contains(RECEIPT_HISTORY_STORE_NAME)
        ? request.transaction?.objectStore(RECEIPT_HISTORY_STORE_NAME) ?? null
        : db.createObjectStore(RECEIPT_HISTORY_STORE_NAME, { keyPath: 'id' });

      if (store && !store.indexNames.contains('createdAt')) {
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (store && !store.indexNames.contains('chain')) {
        store.createIndex('chain', 'chain', { unique: false });
      }
      if (store && !store.indexNames.contains('receiptCategory')) {
        store.createIndex('receiptCategory', 'receiptCategory', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });

  return dbPromise;
}

function normalizeOptionalField(value: string | undefined, maxLength: number): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) {
    return undefined;
  }
  return trimmed;
}

function normalizeInput(input: ReceiptHistoryEntryInput): Omit<ReceiptHistoryEntry, 'id' | 'createdAt'> {
  const proof = input.proof.trim();
  const claimedAmount = input.claimedAmount.trim();
  const minDate = input.minDate.trim();

  if (!proof) {
    throw new Error('Cannot store receipt history without proof payload');
  }
  if (!SUPPORTED_CHAINS.has(input.chain)) {
    throw new Error('Cannot store receipt history with unsupported chain');
  }
  if (!claimedAmount) {
    throw new Error('Cannot store receipt history without claimed amount');
  }
  if (!minDate) {
    throw new Error('Cannot store receipt history without minimum date');
  }

  const receiptLabel = normalizeOptionalField(input.receiptLabel, 80);
  const receiptCategory = normalizeOptionalField(input.receiptCategory, 40);

  return {
    proof,
    chain: input.chain,
    claimedAmount,
    minDate,
    ...(receiptLabel ? { receiptLabel } : {}),
    ...(receiptCategory ? { receiptCategory } : {}),
  };
}

function parseEntry(value: unknown): ReceiptHistoryEntry | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const maybe = value as Partial<ReceiptHistoryEntry>;

  if (
    typeof maybe.id !== 'string' ||
    typeof maybe.proof !== 'string' ||
    typeof maybe.chain !== 'string' ||
    !SUPPORTED_CHAINS.has(maybe.chain as Chain) ||
    typeof maybe.claimedAmount !== 'string' ||
    typeof maybe.minDate !== 'string' ||
    typeof maybe.createdAt !== 'string'
  ) {
    return null;
  }

  const parsedLabel = normalizeOptionalField(maybe.receiptLabel, 80);
  const parsedCategory = normalizeOptionalField(maybe.receiptCategory, 40);
  const openedAt =
    typeof maybe.openedAt === 'string' && maybe.openedAt.trim().length > 0
      ? maybe.openedAt
      : undefined;

  return {
    id: maybe.id,
    proof: maybe.proof,
    chain: maybe.chain as Chain,
    claimedAmount: maybe.claimedAmount,
    minDate: maybe.minDate,
    createdAt: maybe.createdAt,
    ...(openedAt ? { openedAt } : {}),
    ...(parsedLabel ? { receiptLabel: parsedLabel } : {}),
    ...(parsedCategory ? { receiptCategory: parsedCategory } : {}),
  };
}

function sortEntriesByNewest(entries: ReceiptHistoryEntry[]): ReceiptHistoryEntry[] {
  return [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function sortEntriesByOldest(entries: ReceiptHistoryEntry[]): ReceiptHistoryEntry[] {
  return [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
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

interface NormalizedStorageEstimate {
  pressureRatio: number;
  quotaBytes: number;
  usageBytes: number;
}

async function readStorageEstimate(): Promise<NormalizedStorageEstimate | null> {
  const maybeNavigator = globalThis.navigator as Navigator | undefined;
  const maybeStorage = maybeNavigator?.storage;

  if (!maybeStorage || typeof maybeStorage.estimate !== 'function') {
    return null;
  }

  try {
    const estimate = await maybeStorage.estimate();
    if (
      typeof estimate.quota !== 'number' ||
      typeof estimate.usage !== 'number' ||
      estimate.quota <= 0
    ) {
      return null;
    }
    return {
      pressureRatio: estimate.usage / estimate.quota,
      quotaBytes: estimate.quota,
      usageBytes: estimate.usage,
    };
  } catch {
    return null;
  }
}

async function pruneOldestEntries(count: number): Promise<number> {
  if (count <= 0) {
    return 0;
  }

  const entries = await listEntriesIndexedDb();
  const oldestEntries = sortEntriesByOldest(entries).slice(0, count);

  if (oldestEntries.length === 0) {
    return 0;
  }

  const db = await openHistoryDb();
  const transaction = db.transaction(RECEIPT_HISTORY_STORE_NAME, 'readwrite');
  const store = transaction.objectStore(RECEIPT_HISTORY_STORE_NAME);
  oldestEntries.forEach((entry) => {
    store.delete(entry.id);
  });
  await toTransactionPromise(transaction);

  return oldestEntries.length;
}

async function pruneIfNearStorageLimit(): Promise<void> {
  const allEntries = await listEntriesIndexedDb();
  const overflow = allEntries.length - RECEIPT_HISTORY_MAX_ENTRIES + 1;
  if (overflow > 0) {
    await pruneOldestEntries(Math.max(overflow, RECEIPT_HISTORY_PRUNE_BATCH_SIZE));
    return;
  }

  const storageEstimate = await readStorageEstimate();
  if (!storageEstimate || storageEstimate.pressureRatio < RECEIPT_HISTORY_NEAR_FULL_RATIO) {
    return;
  }

  await pruneOldestEntries(RECEIPT_HISTORY_PRUNE_BATCH_SIZE);
}

async function putEntryIndexedDb(entry: ReceiptHistoryEntry): Promise<void> {
  await pruneIfNearStorageLimit();

  for (let attempt = 0; attempt <= RECEIPT_HISTORY_QUOTA_RETRY_LIMIT; attempt += 1) {
    try {
      const db = await openHistoryDb();
      const transaction = db.transaction(RECEIPT_HISTORY_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(RECEIPT_HISTORY_STORE_NAME);
      store.put(entry);
      await toTransactionPromise(transaction);
      return;
    } catch (error) {
      if (!isQuotaExceededError(error) || attempt === RECEIPT_HISTORY_QUOTA_RETRY_LIMIT) {
        throw error;
      }
      const pruned = await pruneOldestEntries(RECEIPT_HISTORY_PRUNE_BATCH_SIZE);
      if (pruned === 0) {
        throw new Error('Receipt history storage is full and cannot be pruned further');
      }
    }
  }
}

async function listEntriesIndexedDb(): Promise<ReceiptHistoryEntry[]> {
  const db = await openHistoryDb();
  const transaction = db.transaction(RECEIPT_HISTORY_STORE_NAME, 'readonly');
  const store = transaction.objectStore(RECEIPT_HISTORY_STORE_NAME);
  const rawEntries = await toRequestPromise(store.getAll());
  const parsedEntries = rawEntries
    .map(parseEntry)
    .filter((entry): entry is ReceiptHistoryEntry => entry !== null);
  return sortEntriesByNewest(parsedEntries);
}

async function deleteEntryIndexedDb(id: string): Promise<void> {
  const db = await openHistoryDb();
  const transaction = db.transaction(RECEIPT_HISTORY_STORE_NAME, 'readwrite');
  const store = transaction.objectStore(RECEIPT_HISTORY_STORE_NAME);
  store.delete(id);
  await toTransactionPromise(transaction);
}

async function clearEntriesIndexedDb(): Promise<void> {
  const db = await openHistoryDb();
  const transaction = db.transaction(RECEIPT_HISTORY_STORE_NAME, 'readwrite');
  const store = transaction.objectStore(RECEIPT_HISTORY_STORE_NAME);
  store.clear();
  await toTransactionPromise(transaction);
}

export async function addReceiptHistoryEntry(
  input: ReceiptHistoryEntryInput,
  now: Date = new Date()
): Promise<ReceiptHistoryEntry> {
  const normalized = normalizeInput(input);
  const entry: ReceiptHistoryEntry = {
    id: generateEntryId(),
    createdAt: now.toISOString(),
    ...normalized,
  };

  await putEntryIndexedDb(entry);

  return entry;
}

export async function listReceiptHistoryEntries(): Promise<ReceiptHistoryEntry[]> {
  return await listEntriesIndexedDb();
}

export async function deleteReceiptHistoryEntry(id: string): Promise<void> {
  await deleteEntryIndexedDb(id);
}

export async function markReceiptHistoryEntryOpened(
  id: string,
  openedAt: Date = new Date()
): Promise<ReceiptHistoryEntry> {
  const db = await openHistoryDb();
  const transaction = db.transaction(RECEIPT_HISTORY_STORE_NAME, 'readwrite');
  const store = transaction.objectStore(RECEIPT_HISTORY_STORE_NAME);
  const existingRaw = await toRequestPromise(store.get(id));
  const existingEntry = parseEntry(existingRaw);

  if (!existingEntry) {
    throw new Error('History entry not found');
  }

  const updatedEntry: ReceiptHistoryEntry = {
    ...existingEntry,
    openedAt: openedAt.toISOString(),
  };
  store.put(updatedEntry);
  await toTransactionPromise(transaction);
  return updatedEntry;
}

export async function clearReceiptHistoryEntries(): Promise<void> {
  await clearEntriesIndexedDb();
}

export function filterReceiptHistoryEntries(
  entries: ReceiptHistoryEntry[],
  filter: ReceiptHistoryFilter
): ReceiptHistoryEntry[] {
  const query = filter.query.trim().toLowerCase();
  const category = filter.category.trim().toLowerCase();

  return entries.filter((entry) => {
    if (filter.chain !== 'all' && entry.chain !== filter.chain) {
      return false;
    }

    if (category && category !== 'all') {
      const entryCategory = entry.receiptCategory?.trim().toLowerCase() ?? '';
      if (entryCategory !== category) {
        return false;
      }
    }

    if (!query) {
      return true;
    }

    const searchIndex = [
      entry.chain,
      entry.claimedAmount,
      entry.minDate,
      entry.receiptLabel ?? '',
      entry.receiptCategory ?? '',
      entry.proof,
    ]
      .join(' ')
      .toLowerCase();

    return searchIndex.includes(query);
  });
}

export function listReceiptHistoryCategories(entries: ReceiptHistoryEntry[]): string[] {
  return [...new Set(
    entries
      .map((entry) => entry.receiptCategory?.trim())
      .filter((category): category is string => Boolean(category))
  )].sort((a, b) => a.localeCompare(b));
}

export function toReceiptHistoryExport(
  entries: ReceiptHistoryEntry[],
  exportedAt: Date = new Date()
): ReceiptHistoryExport {
  return {
    exportedAt: exportedAt.toISOString(),
    schemaVersion: RECEIPT_HISTORY_EXPORT_VERSION,
    entries: sortEntriesByNewest(entries),
  };
}

export function serializeReceiptHistoryExport(
  entries: ReceiptHistoryEntry[],
  exportedAt: Date = new Date()
): string {
  return JSON.stringify(toReceiptHistoryExport(entries, exportedAt), null, 2);
}

export async function exportReceiptHistoryJson(exportedAt: Date = new Date()): Promise<string> {
  const entries = await listReceiptHistoryEntries();
  return serializeReceiptHistoryExport(entries, exportedAt);
}

export async function getReceiptHistoryStorageStatus(): Promise<ReceiptHistoryStorageStatus> {
  const estimate = await readStorageEstimate();
  if (!estimate) {
    return {
      nearFull: false,
      pressureRatio: null,
      quotaBytes: null,
      usageBytes: null,
    };
  }

  return {
    nearFull: estimate.pressureRatio >= RECEIPT_HISTORY_NEAR_FULL_RATIO,
    pressureRatio: estimate.pressureRatio,
    quotaBytes: estimate.quotaBytes,
    usageBytes: estimate.usageBytes,
  };
}
