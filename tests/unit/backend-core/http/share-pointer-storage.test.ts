import {
  InMemorySharePointerStorageAdapter,
  SharePointerStorageManager,
} from '@/lib/libraries/backend-core/http/share-pointer-storage';

describe('SharePointerStorageManager', () => {
  function createManager(overrides: Partial<ConstructorParameters<typeof SharePointerStorageManager>[0]> = {}) {
    return new SharePointerStorageManager({
      adapter: new InMemorySharePointerStorageAdapter(),
      defaultTtlMs: 10_000,
      hardDeleteAfterMs: 2_000,
      maxActiveEntries: 10,
      maxPayloadBytes: 100,
      pruneStartPercent: 90,
      pruneToPercent: 70,
      ...overrides,
    });
  }

  it('stores and resolves pointer payloads', async () => {
    const manager = createManager();
    const stored = await manager.storePointer('proof-payload', { nowMs: 1_000 });

    expect(stored.id).toMatch(/^r_[A-Za-z0-9_-]{16}$/);
    expect(stored.status.activeEntries).toBe(1);

    const resolved = await manager.resolvePointer(stored.id, { nowMs: 1_500 });
    expect(resolved.reason).toBeNull();
    if (resolved.reason === null) {
      expect(resolved.payload).toBe('proof-payload');
      expect(resolved.status.activeEntries).toBe(1);
    }
  });

  it('rejects payloads larger than configured max size', async () => {
    const manager = createManager({ maxPayloadBytes: 5 });

    await expect(manager.storePointer('123456', { nowMs: 1_000 })).rejects.toThrow(
      'Payload too large'
    );
  });

  it('deactivates expired entries and hard deletes after grace period', async () => {
    const manager = createManager({ defaultTtlMs: 1_000, hardDeleteAfterMs: 500 });
    const stored = await manager.storePointer('expiring-payload', { nowMs: 10_000 });

    const expiredResult = await manager.resolvePointer(stored.id, { nowMs: 11_500 });
    expect(expiredResult.reason).toBe('EXPIRED');

    const statusAfterExpiry = await manager.getStatus(11_500);
    expect(statusAfterExpiry.activeEntries).toBe(0);
    expect(statusAfterExpiry.inactiveEntries).toBe(1);

    await manager.cleanup(12_100);
    const statusAfterHardDelete = await manager.getStatus(12_100);
    expect(statusAfterHardDelete.activeEntries).toBe(0);
    expect(statusAfterHardDelete.inactiveEntries).toBe(0);
  });

  it('prunes oldest active entries when usage reaches high-water mark', async () => {
    const manager = createManager({
      maxActiveEntries: 10,
      pruneStartPercent: 90,
      pruneToPercent: 70,
    });

    const ids: string[] = [];
    for (let i = 0; i < 9; i += 1) {
      const stored = await manager.storePointer(`payload-${i}`, { nowMs: 1_000 + i });
      ids.push(stored.id);
    }

    const status = await manager.getStatus(2_000);
    expect(status.activeEntries).toBe(7);
    expect(status.usedPercent).toBe(70);

    const firstPointer = ids[0];
    if (!firstPointer) {
      throw new Error('Expected first pointer id');
    }
    const first = await manager.resolvePointer(firstPointer, { nowMs: 2_100 });
    expect(first.reason).toBe('NOT_FOUND');

    const latestPointer = ids.at(-1);
    if (!latestPointer) {
      throw new Error('Expected latest pointer id');
    }
    const latest = await manager.resolvePointer(latestPointer, { nowMs: 2_100 });
    expect(latest.reason).toBeNull();
    if (latest.reason === null) {
      expect(latest.payload).toBe('payload-8');
    }
  });

  it('returns invalid id for malformed pointers', async () => {
    const manager = createManager();
    const resolved = await manager.resolvePointer('bad-id', { nowMs: 2_000 });
    expect(resolved.reason).toBe('INVALID_ID');
  });
});
