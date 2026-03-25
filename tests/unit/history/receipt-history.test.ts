import {
  addReceiptHistoryEntry,
  filterReceiptHistoryEntries,
  getReceiptHistoryStorageStatus,
  listReceiptHistoryCategories,
  previewReceiptHistoryImport,
  serializeReceiptHistoryExport,
} from '@/lib/history/receipt-history';

describe('receipt history storage', () => {
  it('fails fast when indexeddb is unavailable', async () => {
    await expect(
      addReceiptHistoryEntry(
        {
          proof: 'proof_older',
          chain: 'bitcoin',
          claimedAmount: '100000000',
          minDate: '2026-03-20',
        },
        new Date('2026-03-20T10:00:00.000Z')
      )
    ).rejects.toThrow('IndexedDB is unavailable');
  });

  it('returns no-storage signal when estimate API is unavailable', async () => {
    const status = await getReceiptHistoryStorageStatus();
    expect(status).toEqual({
      nearFull: false,
      pressureRatio: null,
      quotaBytes: null,
      usageBytes: null,
    });
  });

  it('filters history entries by query, chain, and category', async () => {
    const entries = [
      {
        id: 'a',
        proof: 'proof_alpha',
        chain: 'bitcoin' as const,
        claimedAmount: '5000',
        minDate: '2026-03-01',
        receiptLabel: 'Invoice Alpha',
        receiptCategory: 'Operations',
        createdAt: '2026-03-01T10:00:00.000Z',
      },
      {
        id: 'b',
        proof: 'proof_beta',
        chain: 'ethereum' as const,
        claimedAmount: '7000',
        minDate: '2026-03-02',
        receiptLabel: 'Expense Beta',
        receiptCategory: 'Travel',
        createdAt: '2026-03-02T10:00:00.000Z',
      },
    ];

    const queryFiltered = filterReceiptHistoryEntries(entries, {
      query: 'invoice',
      chain: 'all',
      category: 'all',
    });
    expect(queryFiltered).toHaveLength(1);
    expect(queryFiltered[0]?.id).toBe('a');

    const chainFiltered = filterReceiptHistoryEntries(entries, {
      query: '',
      chain: 'ethereum',
      category: 'all',
    });
    expect(chainFiltered).toHaveLength(1);
    expect(chainFiltered[0]?.id).toBe('b');

    const categoryFiltered = filterReceiptHistoryEntries(entries, {
      query: '',
      chain: 'all',
      category: 'travel',
    });
    expect(categoryFiltered).toHaveLength(1);
    expect(categoryFiltered[0]?.id).toBe('b');
  });

  it('returns unique sorted categories', () => {
    const categories = listReceiptHistoryCategories([
      {
        id: 'a',
        proof: 'proof_1',
        chain: 'bitcoin',
        claimedAmount: '1',
        minDate: '2026-03-01',
        receiptCategory: 'Travel',
        createdAt: '2026-03-01T00:00:00.000Z',
      },
      {
        id: 'b',
        proof: 'proof_2',
        chain: 'bitcoin',
        claimedAmount: '2',
        minDate: '2026-03-02',
        receiptCategory: 'Operations',
        createdAt: '2026-03-02T00:00:00.000Z',
      },
      {
        id: 'c',
        proof: 'proof_3',
        chain: 'bitcoin',
        claimedAmount: '3',
        minDate: '2026-03-03',
        receiptCategory: 'Travel',
        createdAt: '2026-03-03T00:00:00.000Z',
      },
    ]);

    expect(categories).toEqual(['Operations', 'Travel']);
  });

  it('serializes deterministic JSON export payload', () => {
    const payload = serializeReceiptHistoryExport(
      [
        {
          id: 'older',
          proof: 'proof_old',
          chain: 'bitcoin',
          claimedAmount: '10',
          minDate: '2026-03-01',
          createdAt: '2026-03-01T00:00:00.000Z',
        },
        {
          id: 'newer',
          proof: 'proof_new',
          chain: 'ethereum',
          claimedAmount: '20',
          minDate: '2026-03-02',
          createdAt: '2026-03-02T00:00:00.000Z',
        },
      ],
      new Date('2026-03-24T15:00:00.000Z')
    );

    const parsed = JSON.parse(payload) as {
      exportedAt: string;
      schemaVersion: number;
      entries: Array<{ id: string }>;
    };

    expect(parsed.exportedAt).toBe('2026-03-24T15:00:00.000Z');
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.entries.map((entry) => entry.id)).toEqual(['newer', 'older']);
  });

  it('reports near-full warning when storage estimate is above 90%', async () => {
    const originalNavigator = globalThis.navigator;
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        storage: {
          estimate: async () => ({ quota: 1000, usage: 950 }),
        },
      },
    });

    const status = await getReceiptHistoryStorageStatus();
    expect(status.nearFull).toBe(true);
    expect(status.pressureRatio).toBeCloseTo(0.95, 4);
    expect(status.quotaBytes).toBe(1000);
    expect(status.usageBytes).toBe(950);

    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: originalNavigator,
    });
  });

  it('previews import payload with duplicate and invalid entry accounting', () => {
    const payload = JSON.stringify({
      exportedAt: '2026-03-25T00:00:00.000Z',
      schemaVersion: 1,
      entries: [
        {
          id: 'first',
          proof: 'proof_new',
          chain: 'bitcoin',
          claimedAmount: '5',
          minDate: '2026-03-03',
          createdAt: '2026-03-03T00:00:00.000Z',
        },
        {
          id: 'existing',
          proof: 'proof_existing',
          chain: 'bitcoin',
          claimedAmount: '6',
          minDate: '2026-03-04',
          createdAt: '2026-03-04T00:00:00.000Z',
        },
        {
          id: 'broken',
          proof: '',
        },
        {
          id: 'duplicate',
          proof: 'proof_new',
          chain: 'ethereum',
          ethereumAsset: 'native',
          claimedAmount: '9',
          minDate: '2026-03-05',
          createdAt: '2026-03-05T00:00:00.000Z',
        },
      ],
    });

    const preview = previewReceiptHistoryImport(payload, new Set(['proof_existing']));
    expect(preview.totalCount).toBe(4);
    expect(preview.entriesToImport).toHaveLength(1);
    expect(preview.entriesToImport[0]?.proof).toBe('proof_new');
    expect(preview.skippedCount).toBe(2);
    expect(preview.invalidCount).toBe(1);
  });

  it('rejects unsupported import schema versions', () => {
    const payload = JSON.stringify({
      exportedAt: '2026-03-25T00:00:00.000Z',
      schemaVersion: 99,
      entries: [],
    });

    expect(() => previewReceiptHistoryImport(payload)).toThrow('is not supported');
  });

  it('rejects malformed import JSON', () => {
    expect(() => previewReceiptHistoryImport('{this is not json]')).toThrow('not valid JSON');
  });
});
