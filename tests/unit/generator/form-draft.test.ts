import {
  clearGeneratorDraft,
  loadGeneratorDraft,
  saveGeneratorDraft,
} from '@/lib/generator/form-draft';
import type { GeneratorFormValues } from '@/lib/generator/types';

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    clear: () => {
      map.clear();
    },
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

describe('generator form draft storage', () => {
  const sampleDraft: GeneratorFormValues = {
    chain: 'ethereum',
    ethereumAsset: 'usdc',
    txHash: `0x${'a'.repeat(64)}`,
    claimedAmount: '1500000',
    discloseAmount: true,
    discloseMinDate: false,
    minDate: '2026-03-25',
    receiptLabel: 'March invoice',
    receiptCategory: 'Operations',
  };

  it('saves and loads valid draft values', () => {
    const storage = createMemoryStorage();
    saveGeneratorDraft(sampleDraft, storage);

    const loaded = loadGeneratorDraft(storage);
    expect(loaded).toEqual(sampleDraft);
  });

  it('returns null for malformed draft JSON', () => {
    const storage = createMemoryStorage();
    storage.setItem('ghostreceipt-generator-draft-v1', '{invalid-json}');

    const loaded = loadGeneratorDraft(storage);
    expect(loaded).toBeNull();
  });

  it('returns null for unsupported chain in draft payload', () => {
    const storage = createMemoryStorage();
    storage.setItem(
      'ghostreceipt-generator-draft-v1',
      JSON.stringify({
        ...sampleDraft,
        chain: 'monero',
      })
    );

    const loaded = loadGeneratorDraft(storage);
    expect(loaded).toBeNull();
  });

  it('clears saved draft values', () => {
    const storage = createMemoryStorage();
    saveGeneratorDraft(sampleDraft, storage);
    clearGeneratorDraft(storage);

    const loaded = loadGeneratorDraft(storage);
    expect(loaded).toBeNull();
  });
});

