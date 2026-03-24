import {
  EncryptedLinkVault,
  type LinkVaultStorageAdapter,
} from '@/lib/libraries/browser-core';

interface StoredLinkData {
  publicUrl: string;
  type: 'deadman' | 'timed';
}

class MemoryStorageAdapter implements LinkVaultStorageAdapter {
  private readonly map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

class FlakyQuotaStorageAdapter extends MemoryStorageAdapter {
  failNextWrite = false;

  override setItem(key: string, value: string): void {
    if (this.failNextWrite) {
      this.failNextWrite = false;
      const error = new Error('Simulated quota');
      error.name = 'QuotaExceededError';
      throw error;
    }
    super.setItem(key, value);
  }
}

function isStoredLinkData(value: unknown): value is StoredLinkData {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const maybe = value as Partial<StoredLinkData>;
  return (
    typeof maybe.publicUrl === 'string' &&
    (maybe.type === 'timed' || maybe.type === 'deadman')
  );
}

function createVault(storage: LinkVaultStorageAdapter): EncryptedLinkVault<StoredLinkData> {
  return new EncryptedLinkVault<StoredLinkData>({
    key: 'test-links',
    maxEntries: 10,
    pruneBatchSize: 2,
    pruneStartPercent: 90,
    pruneToPercent: 70,
    storage,
    validateRecord: isStoredLinkData,
  });
}

describe('EncryptedLinkVault', () => {
  it('stores and loads encrypted link records', async () => {
    const storage = new MemoryStorageAdapter();
    const vault = createVault(storage);

    await vault.addRecord(
      { publicUrl: 'https://vault.example/a', type: 'timed' },
      { createdAtMs: 1_000, id: 'link-a' }
    );

    const list = await vault.listRecords();
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe('link-a');
    expect(list[0]?.data.publicUrl).toBe('https://vault.example/a');

    const raw = storage.getItem('test-links');
    expect(raw).toBeTruthy();
    expect(raw).not.toContain('vault.example/a');
  });

  it('marks records as opened', async () => {
    const storage = new MemoryStorageAdapter();
    const vault = createVault(storage);

    await vault.addRecord(
      { publicUrl: 'https://vault.example/b', type: 'deadman' },
      { createdAtMs: 2_000, id: 'link-b' }
    );

    const marked = await vault.markRecordOpened('link-b', 9_999);
    expect(marked?.openedAtMs).toBe(9_999);

    const list = await vault.listRecords();
    expect(list[0]?.openedAtMs).toBe(9_999);
  });

  it('prunes oldest records at high-water threshold', async () => {
    const storage = new MemoryStorageAdapter();
    const vault = createVault(storage);

    for (let i = 0; i < 9; i += 1) {
      await vault.addRecord(
        { publicUrl: `https://vault.example/${i}`, type: 'timed' },
        { createdAtMs: 10_000 + i, id: `link-${i}` }
      );
    }

    const list = await vault.listRecords();
    const ids = new Set(list.map((record) => record.id));
    expect(list).toHaveLength(7);
    expect(ids.has('link-0')).toBe(false);
    expect(ids.has('link-1')).toBe(false);
    expect(ids.has('link-8')).toBe(true);
  });

  it('retries on quota errors by pruning oldest records', async () => {
    const storage = new FlakyQuotaStorageAdapter();
    const vault = createVault(storage);

    for (let i = 0; i < 4; i += 1) {
      await vault.addRecord(
        { publicUrl: `https://vault.example/quota-${i}`, type: 'timed' },
        { createdAtMs: 20_000 + i, id: `link-q-${i}` }
      );
    }

    storage.failNextWrite = true;
    const result = await vault.addRecord(
      { publicUrl: 'https://vault.example/quota-new', type: 'deadman' },
      { createdAtMs: 21_000, id: 'link-q-new' }
    );

    expect(result.prunedCount).toBe(2);

    const list = await vault.listRecords();
    const ids = new Set(list.map((record) => record.id));
    expect(list).toHaveLength(3);
    expect(ids.has('link-q-0')).toBe(false);
    expect(ids.has('link-q-1')).toBe(false);
    expect(ids.has('link-q-new')).toBe(true);
  });
});
