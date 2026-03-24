import {
  checkClientNullifierConflict,
  deriveNullifierFromMessageHash,
  type NullifierStorageLike,
} from '@/lib/zk/nullifier';
import { deriveNullifier } from '@/lib/libraries/backend-core/http/oracle-nullifier';

class InMemoryStorage implements NullifierStorageLike {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

describe('zk nullifier helpers', () => {
  it('derives the same nullifier as server-side helper from message hash', async () => {
    const messageHash = '12345678901234567890';

    const clientNullifier = await deriveNullifierFromMessageHash(messageHash);
    const serverNullifier = deriveNullifier(messageHash);

    expect(clientNullifier).toBe(serverNullifier);
  });

  it('marks first seen and idempotent checks as valid', () => {
    const storage = new InMemoryStorage();
    const claim = {
      claimedAmount: '1000',
      minDateUnix: 1700000000,
    };
    const nullifier = 'a'.repeat(64);

    const first = checkClientNullifierConflict({ claim, nullifier }, storage);
    const second = checkClientNullifierConflict({ claim, nullifier }, storage);

    expect(first).toEqual({
      valid: true,
      mode: 'first_seen',
    });
    expect(second).toEqual({
      valid: true,
      mode: 'idempotent',
    });
  });

  it('rejects conflicting claims for the same nullifier', () => {
    const storage = new InMemoryStorage();
    const nullifier = 'b'.repeat(64);

    const first = checkClientNullifierConflict(
      {
        claim: {
          claimedAmount: '1000',
          minDateUnix: 1700000000,
        },
        nullifier,
      },
      storage
    );
    const conflict = checkClientNullifierConflict(
      {
        claim: {
          claimedAmount: '999',
          minDateUnix: 1700000000,
        },
        nullifier,
      },
      storage
    );

    expect(first.valid).toBe(true);
    expect(conflict.valid).toBe(false);
    expect(conflict.mode).toBe('conflict');
    expect(conflict.message).toContain('Nullifier conflict detected');
  });

  it('treats malformed stored payload as empty registry', () => {
    const storage = new InMemoryStorage();
    storage.setItem('gr:verified-nullifiers', '{bad json');

    const result = checkClientNullifierConflict(
      {
        claim: {
          claimedAmount: '1000',
          minDateUnix: 1700000000,
        },
        nullifier: 'c'.repeat(64),
      },
      storage
    );

    expect(result).toEqual({
      valid: true,
      mode: 'first_seen',
    });
  });
});
