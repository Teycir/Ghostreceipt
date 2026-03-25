import {
  InMemoryOracleAuthReplayAdapter,
  OracleAuthReplayRegistry,
} from '@/lib/libraries/backend-core/http/oracle-auth-replay';

describe('OracleAuthReplayRegistry', () => {
  function createPayload(overrides: Partial<{
    expiresAt: number;
    messageHash: string;
    nonce: string;
    oraclePubKeyId: string;
    signedAt: number;
  }> = {}) {
    return {
      expiresAt: overrides.expiresAt ?? 1700000300,
      messageHash: overrides.messageHash ?? '12345678901234567890',
      nonce: overrides.nonce ?? 'a'.repeat(32),
      oraclePubKeyId: overrides.oraclePubKeyId ?? 'b'.repeat(16),
      signedAt: overrides.signedAt ?? 1700000000,
    };
  }

  it('allows first-seen nonce payload', async () => {
    const registry = new OracleAuthReplayRegistry({
      adapter: new InMemoryOracleAuthReplayAdapter(),
    });
    const result = await registry.check({
      nowMs: 1700000000 * 1000,
      payload: createPayload(),
      scope: 'oracle:b'.repeat(16),
    });

    expect(result).toEqual({
      allowed: true,
      mode: 'first_seen',
    });
  });

  it('allows idempotent re-verification of the same payload', async () => {
    const registry = new OracleAuthReplayRegistry({
      adapter: new InMemoryOracleAuthReplayAdapter(),
    });
    const payload = createPayload();

    const first = await registry.check({
      nowMs: 1700000000 * 1000,
      payload,
      scope: 'oracle',
    });
    const second = await registry.check({
      nowMs: 1700000001 * 1000,
      payload,
      scope: 'oracle',
    });

    expect(first).toEqual({
      allowed: true,
      mode: 'first_seen',
    });
    expect(second).toEqual({
      allowed: true,
      mode: 'idempotent',
    });
  });

  it('rejects nonce reuse when payload differs', async () => {
    const registry = new OracleAuthReplayRegistry({
      adapter: new InMemoryOracleAuthReplayAdapter(),
    });
    const nonce = 'c'.repeat(32);

    await registry.check({
      nowMs: 1700000000 * 1000,
      payload: createPayload({ messageHash: '1234567890', nonce }),
      scope: 'oracle',
    });
    const rejected = await registry.check({
      nowMs: 1700000001 * 1000,
      payload: createPayload({ messageHash: '2234567890', nonce }),
      scope: 'oracle',
    });

    expect(rejected).toEqual({
      allowed: false,
      message: 'Nonce has already been used for a different payload',
      reason: 'NONCE_REUSE_CONFLICT',
    });
  });

  it('rejects signatures that are too far in the future', async () => {
    const registry = new OracleAuthReplayRegistry({
      adapter: new InMemoryOracleAuthReplayAdapter(),
      maxFutureSkewSeconds: 30,
    });
    const result = await registry.check({
      nowMs: 1700000000 * 1000,
      payload: createPayload({
        signedAt: 1700000040,
        expiresAt: 1700000500,
      }),
      scope: 'oracle',
    });

    expect(result).toEqual({
      allowed: false,
      message: 'Signature timestamp is too far in the future',
      reason: 'SIGNED_AT_IN_FUTURE',
    });
  });

  it('rejects expired signatures', async () => {
    const registry = new OracleAuthReplayRegistry({
      adapter: new InMemoryOracleAuthReplayAdapter(),
    });
    const result = await registry.check({
      nowMs: 1700000400 * 1000,
      payload: createPayload({
        signedAt: 1700000000,
        expiresAt: 1700000300,
      }),
      scope: 'oracle',
    });

    expect(result).toEqual({
      allowed: false,
      message: 'Signature expired',
      reason: 'SIGNATURE_EXPIRED',
    });
  });

  it('allows nonce reuse after prior entry expires and is cleaned up', async () => {
    const registry = new OracleAuthReplayRegistry({
      adapter: new InMemoryOracleAuthReplayAdapter(),
    });
    const nonce = 'd'.repeat(32);

    const firstPayload = createPayload({
      messageHash: '1234567890',
      nonce,
      signedAt: 1700000000,
      expiresAt: 1700000001,
    });
    const secondPayload = createPayload({
      messageHash: '2234567890',
      nonce,
      signedAt: 1700000002,
      expiresAt: 1700000500,
    });

    const first = await registry.check({
      nowMs: 1700000000 * 1000,
      payload: firstPayload,
      scope: 'oracle',
    });
    const second = await registry.check({
      nowMs: 1700000002 * 1000,
      payload: secondPayload,
      scope: 'oracle',
    });

    expect(first).toEqual({
      allowed: true,
      mode: 'first_seen',
    });
    expect(second).toEqual({
      allowed: true,
      mode: 'first_seen',
    });
  });

  it('supports no-timer adapter mode for runtime-safe reuse', () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const adapter = new InMemoryOracleAuthReplayAdapter({
      startCleanupTimer: false,
    });

    expect(setIntervalSpy).not.toHaveBeenCalled();
    adapter.dispose();
    setIntervalSpy.mockRestore();
  });
});
