import type { GeneratorFormValues } from '@/lib/generator/types';

const GENERATOR_DRAFT_STORAGE_KEY = 'ghostreceipt-generator-draft-v1';

const SUPPORTED_CHAINS = new Set(['bitcoin', 'ethereum', 'solana']);
const SUPPORTED_ETHEREUM_ASSETS = new Set(['native', 'usdc']);

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value !== 'boolean') {
    return fallback;
  }
  return value;
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function sanitizeDraftInput(raw: unknown): GeneratorFormValues | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null;
  }

  const maybe = raw as Partial<GeneratorFormValues>;
  if (!SUPPORTED_CHAINS.has(maybe.chain ?? '')) {
    return null;
  }
  if (!SUPPORTED_ETHEREUM_ASSETS.has(maybe.ethereumAsset ?? '')) {
    return null;
  }

  const chain = maybe.chain as GeneratorFormValues['chain'];
  const ethereumAsset = maybe.ethereumAsset as GeneratorFormValues['ethereumAsset'];

  return {
    chain,
    ethereumAsset,
    txHash: normalizeString(maybe.txHash),
    claimedAmount: normalizeString(maybe.claimedAmount),
    minDate: normalizeString(maybe.minDate),
    receiptLabel: normalizeString(maybe.receiptLabel),
    receiptCategory: normalizeString(maybe.receiptCategory),
    discloseAmount: normalizeBoolean(maybe.discloseAmount, true),
    discloseMinDate: normalizeBoolean(maybe.discloseMinDate, true),
  };
}

function getStorage(): KeyValueStorage | null {
  if (typeof globalThis.localStorage === 'undefined') {
    return null;
  }
  return globalThis.localStorage;
}

export function loadGeneratorDraft(storage: KeyValueStorage | null = getStorage()): GeneratorFormValues | null {
  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(GENERATOR_DRAFT_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return sanitizeDraftInput(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveGeneratorDraft(
  values: GeneratorFormValues,
  storage: KeyValueStorage | null = getStorage()
): void {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(GENERATOR_DRAFT_STORAGE_KEY, JSON.stringify(values));
  } catch {
    // Ignore quota/private mode errors; draft persistence is best-effort.
  }
}

export function clearGeneratorDraft(storage: KeyValueStorage | null = getStorage()): void {
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(GENERATOR_DRAFT_STORAGE_KEY);
  } catch {
    // Ignore storage errors.
  }
}

