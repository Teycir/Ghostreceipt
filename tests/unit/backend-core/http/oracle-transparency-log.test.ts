import {
  __resetOracleTransparencyLogCacheForTests,
  __setOracleTransparencyLogForTests,
  checkOracleKeyTransparencyValidity,
  createOracleTransparencyEntryHash,
  getOracleTransparencyLog,
  type OracleTransparencyEntry,
} from '@ghostreceipt/backend-core/http';

describe('oracle transparency log', () => {
  afterEach(() => {
    __resetOracleTransparencyLogCacheForTests();
  });

  function buildLog(
    entries: Array<{
      keyId: string;
      publicKey: string;
      status: 'active' | 'retired' | 'revoked';
      validFrom: number;
      validUntil: number | null;
    }>
  ): {
    entries: OracleTransparencyEntry[];
    generatedAt: string;
    schemaVersion: 1;
  } {
    let previousHash: string | null = null;
    const builtEntries = entries.map((entry, index) => {
      const withChain = {
        index,
        keyId: entry.keyId,
        prevEntryHash: previousHash,
        publicKey: entry.publicKey,
        status: entry.status,
        validFrom: entry.validFrom,
        validUntil: entry.validUntil,
      } as const;
      const entryHash = createOracleTransparencyEntryHash(withChain);
      previousHash = entryHash;
      return {
        ...withChain,
        entryHash,
      };
    });

    return {
      entries: builtEntries,
      generatedAt: '2026-03-23T00:00:00.000Z',
      schemaVersion: 1,
    };
  }

  it('loads the bundled transparency log', () => {
    const log = getOracleTransparencyLog();

    expect(log.schemaVersion).toBe(1);
    expect(log.entries.length).toBeGreaterThan(0);
  });

  it('returns valid=true for known active key at signedAt', () => {
    const decision = checkOracleKeyTransparencyValidity({
      keyId: '10ba682c8ad13513',
      signedAt: 1_800_000_000,
    });

    expect(decision.valid).toBe(true);
  });

  it('returns KEY_UNKNOWN when key is missing from log', () => {
    const decision = checkOracleKeyTransparencyValidity({
      keyId: 'ffffffffffffffff',
      signedAt: 1_800_000_000,
    });

    expect(decision.valid).toBe(false);
    if (decision.valid) {
      throw new Error('Expected KEY_UNKNOWN decision');
    }
    expect(decision.reason).toBe('KEY_UNKNOWN');
  });

  it('returns KEY_NOT_YET_VALID when signedAt is before key activation', () => {
    const keyLog = buildLog([
      {
        keyId: '10ba682c8ad13513',
        publicKey: 'd04ab232742bb4ab3a1368bd4615e4e6d0224ab71a016baf8520a332c9778737',
        status: 'active',
        validFrom: 2_000_000_000,
        validUntil: null,
      },
    ]);
    __setOracleTransparencyLogForTests(keyLog);

    const decision = checkOracleKeyTransparencyValidity({
      keyId: '10ba682c8ad13513',
      signedAt: 1_900_000_000,
    });

    expect(decision.valid).toBe(false);
    if (decision.valid) {
      throw new Error('Expected KEY_NOT_YET_VALID decision');
    }
    expect(decision.reason).toBe('KEY_NOT_YET_VALID');
  });

  it('returns KEY_EXPIRED when signedAt is outside ended window', () => {
    const keyLog = buildLog([
      {
        keyId: '10ba682c8ad13513',
        publicKey: 'd04ab232742bb4ab3a1368bd4615e4e6d0224ab71a016baf8520a332c9778737',
        status: 'retired',
        validFrom: 1_700_000_000,
        validUntil: 1_700_000_100,
      },
    ]);
    __setOracleTransparencyLogForTests(keyLog);

    const decision = checkOracleKeyTransparencyValidity({
      keyId: '10ba682c8ad13513',
      signedAt: 1_700_000_200,
    });

    expect(decision.valid).toBe(false);
    if (decision.valid) {
      throw new Error('Expected KEY_EXPIRED decision');
    }
    expect(decision.reason).toBe('KEY_EXPIRED');
  });

  it('returns KEY_REVOKED when key window is revoked', () => {
    const keyLog = buildLog([
      {
        keyId: '10ba682c8ad13513',
        publicKey: 'd04ab232742bb4ab3a1368bd4615e4e6d0224ab71a016baf8520a332c9778737',
        status: 'revoked',
        validFrom: 1_700_000_000,
        validUntil: 1_900_000_000,
      },
    ]);
    __setOracleTransparencyLogForTests(keyLog);

    const decision = checkOracleKeyTransparencyValidity({
      keyId: '10ba682c8ad13513',
      signedAt: 1_800_000_000,
    });

    expect(decision.valid).toBe(false);
    if (decision.valid) {
      throw new Error('Expected KEY_REVOKED decision');
    }
    expect(decision.reason).toBe('KEY_REVOKED');
  });

  it('returns LOG_INVALID for hash-chain tampering', () => {
    const keyLog = buildLog([
      {
        keyId: '10ba682c8ad13513',
        publicKey: 'd04ab232742bb4ab3a1368bd4615e4e6d0224ab71a016baf8520a332c9778737',
        status: 'active',
        validFrom: 1_700_000_000,
        validUntil: null,
      },
    ]);
    const firstEntry = keyLog.entries[0];
    if (!firstEntry) {
      throw new Error('Expected at least one log entry');
    }
    keyLog.entries[0] = {
      ...firstEntry,
      entryHash: '0'.repeat(64),
    };
    __setOracleTransparencyLogForTests(keyLog);

    const decision = checkOracleKeyTransparencyValidity({
      keyId: '10ba682c8ad13513',
      signedAt: 1_800_000_000,
    });

    expect(decision.valid).toBe(false);
    if (decision.valid) {
      throw new Error('Expected LOG_INVALID decision');
    }
    expect(decision.reason).toBe('LOG_INVALID');
  });
});
