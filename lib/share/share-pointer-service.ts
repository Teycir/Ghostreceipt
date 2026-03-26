import {
  D1SharePointerStorageAdapter,
  InMemorySharePointerStorageAdapter,
  SharePointerStorageManager,
  type D1DatabaseLike,
  type SharePointerResolveResult,
  type SharePointerStoreResult,
} from '@/lib/libraries/backend-core/http/share-pointer-storage';

type SharePointerEnvBindings = Record<string, unknown> | undefined;
export type SharePointerStorageBackend = 'd1' | 'memory';

const DEFAULT_SHARE_POINTER_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const DEFAULT_SHARE_POINTER_HARD_DELETE_AFTER_MS = 1000 * 60 * 60 * 24 * 30;
const DEFAULT_SHARE_POINTER_MAX_ACTIVE_ENTRIES = 10_000;
const DEFAULT_SHARE_POINTER_MAX_PAYLOAD_BYTES = 100_000;
const DEFAULT_SHARE_POINTER_PRUNE_START_PERCENT = 90;
const DEFAULT_SHARE_POINTER_PRUNE_TO_PERCENT = 70;

let inMemoryManager: SharePointerStorageManager | null = null;
let d1Manager: SharePointerStorageManager | null = null;
let d1ManagerDb: D1DatabaseLike | null = null;
let d1ManagerInitPromise: Promise<SharePointerStorageManager> | null = null;

function isD1DatabaseLike(value: unknown): value is D1DatabaseLike {
  return typeof value === 'object' && value !== null && 'prepare' in value &&
    typeof (value as { prepare?: unknown }).prepare === 'function';
}

function readEnvString(bindings: SharePointerEnvBindings, key: string): string | null {
  const bindingValue = bindings?.[key];
  if (typeof bindingValue === 'string') {
    const trimmed = bindingValue.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  const processValue = process.env[key];
  if (typeof processValue === 'string') {
    const trimmed = processValue.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  return null;
}

function readPositiveIntEnv(
  bindings: SharePointerEnvBindings,
  key: string,
  fallback: number
): number {
  const raw = readEnvString(bindings, key);
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function resolveSharePointerManagerOptions(bindings: SharePointerEnvBindings) {
  return {
    defaultTtlMs: readPositiveIntEnv(
      bindings,
      'SHARE_POINTER_TTL_MS',
      DEFAULT_SHARE_POINTER_TTL_MS
    ),
    hardDeleteAfterMs: readPositiveIntEnv(
      bindings,
      'SHARE_POINTER_HARD_DELETE_AFTER_MS',
      DEFAULT_SHARE_POINTER_HARD_DELETE_AFTER_MS
    ),
    maxActiveEntries: readPositiveIntEnv(
      bindings,
      'SHARE_POINTER_MAX_ACTIVE_ENTRIES',
      DEFAULT_SHARE_POINTER_MAX_ACTIVE_ENTRIES
    ),
    maxPayloadBytes: readPositiveIntEnv(
      bindings,
      'SHARE_POINTER_MAX_PAYLOAD_BYTES',
      DEFAULT_SHARE_POINTER_MAX_PAYLOAD_BYTES
    ),
    pruneStartPercent: readPositiveIntEnv(
      bindings,
      'SHARE_POINTER_PRUNE_START_PERCENT',
      DEFAULT_SHARE_POINTER_PRUNE_START_PERCENT
    ),
    pruneToPercent: readPositiveIntEnv(
      bindings,
      'SHARE_POINTER_PRUNE_TO_PERCENT',
      DEFAULT_SHARE_POINTER_PRUNE_TO_PERCENT
    ),
  } as const;
}

async function getInMemoryManager(bindings: SharePointerEnvBindings): Promise<SharePointerStorageManager> {
  if (!inMemoryManager) {
    inMemoryManager = new SharePointerStorageManager({
      adapter: new InMemorySharePointerStorageAdapter(),
      ...resolveSharePointerManagerOptions(bindings),
    });
  }

  return inMemoryManager;
}

async function getD1Manager(
  database: D1DatabaseLike,
  bindings: SharePointerEnvBindings
): Promise<SharePointerStorageManager> {
  if (d1Manager && d1ManagerDb === database) {
    return d1Manager;
  }

  if (d1ManagerInitPromise && d1ManagerDb === database) {
    return d1ManagerInitPromise;
  }

  d1ManagerDb = database;
  d1ManagerInitPromise = (async () => {
    const tableName = readEnvString(bindings, 'SHARE_POINTER_TABLE_NAME') ?? 'share_pointers';
    const adapter = new D1SharePointerStorageAdapter({
      database,
      tableName,
    });
    await adapter.initialize();

    const manager = new SharePointerStorageManager({
      adapter,
      ...resolveSharePointerManagerOptions(bindings),
    });

    d1Manager = manager;
    return manager;
  })();

  return d1ManagerInitPromise;
}

async function getSharePointerStorageManager(
  bindings: SharePointerEnvBindings
): Promise<SharePointerStorageManager> {
  const databaseBinding = bindings?.['SHARE_POINTERS_DB'];
  if (isD1DatabaseLike(databaseBinding)) {
    return getD1Manager(databaseBinding, bindings);
  }

  return getInMemoryManager(bindings);
}

export function resolveSharePointerStorageBackend(
  bindings?: SharePointerEnvBindings
): SharePointerStorageBackend {
  return isD1DatabaseLike(bindings?.['SHARE_POINTERS_DB']) ? 'd1' : 'memory';
}

export function hasDurableSharePointerStorage(
  bindings?: SharePointerEnvBindings
): boolean {
  return resolveSharePointerStorageBackend(bindings) === 'd1';
}

export async function storeSharePointerPayload(
  payload: string,
  bindings?: SharePointerEnvBindings
): Promise<SharePointerStoreResult> {
  const manager = await getSharePointerStorageManager(bindings);
  return manager.storePointer(payload);
}

export async function resolveSharePointerPayload(
  id: string,
  bindings?: SharePointerEnvBindings
): Promise<SharePointerResolveResult> {
  const manager = await getSharePointerStorageManager(bindings);
  return manager.resolvePointer(id);
}

export function buildVerifySidUrl(requestUrl: string, pointerId: string): string {
  const verifyUrl = new URL('/verify', requestUrl);
  verifyUrl.searchParams.set('sid', pointerId);
  return verifyUrl.toString();
}

export function isLikelySharePointerId(value: string): boolean {
  return /^r_[A-Za-z0-9_-]{16}$/u.test(value);
}

export async function __resetSharePointerManagerForTests(): Promise<void> {
  if (inMemoryManager) {
    await inMemoryManager.dispose();
  }
  if (d1Manager) {
    await d1Manager.dispose();
  }

  inMemoryManager = null;
  d1Manager = null;
  d1ManagerDb = null;
  d1ManagerInitPromise = null;
}
