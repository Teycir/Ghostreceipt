import {
  deriveClaimDigest,
  deriveNullifier,
  InMemoryNullifierRegistryAdapter,
  NullifierRegistry,
} from '@/lib/libraries/backend-core/http/oracle-nullifier';

describe('oracle-nullifier', () => {
  it('derives deterministic nullifier from message hash', () => {
    const hash = '12345678901234567890';
    const n1 = deriveNullifier(hash);
    const n2 = deriveNullifier(hash);

    expect(n1).toBe(n2);
    expect(n1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('derives deterministic claim digest from claim fields', () => {
    const d1 = deriveClaimDigest('1000', 1700000000);
    const d2 = deriveClaimDigest('1000', 1700000000);

    expect(d1).toBe(d2);
    expect(d1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('allows first-seen and idempotent claim on same nullifier', async () => {
    const registry = new NullifierRegistry({
      adapter: new InMemoryNullifierRegistryAdapter(),
    });
    const nullifier = deriveNullifier('12345678901234567890');
    const claimDigest = deriveClaimDigest('1000', 1700000000);

    const first = await registry.check({
      claimDigest,
      nullifier,
    });
    const second = await registry.check({
      claimDigest,
      nullifier,
    });

    expect(first).toEqual({
      allowed: true,
      mode: 'first_seen',
      nullifier,
    });
    expect(second).toEqual({
      allowed: true,
      mode: 'idempotent',
      nullifier,
    });
  });

  it('rejects conflicting claim for same nullifier', async () => {
    const registry = new NullifierRegistry({
      adapter: new InMemoryNullifierRegistryAdapter(),
    });
    const nullifier = deriveNullifier('12345678901234567890');

    await registry.check({
      claimDigest: deriveClaimDigest('1000', 1700000000),
      nullifier,
    });
    const conflict = await registry.check({
      claimDigest: deriveClaimDigest('900', 1700000000),
      nullifier,
    });

    expect(conflict).toEqual({
      allowed: false,
      claimDigest: deriveClaimDigest('1000', 1700000000),
      message: 'Nullifier already exists with a different claim',
      nullifier,
      reason: 'NULLIFIER_CLAIM_CONFLICT',
    });
  });
});
