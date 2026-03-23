import { ApiKeyCascade } from '@/lib/libraries/backend-core/providers/api-key-cascade';

describe('ApiKeyCascade', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses round-robin start index across executions', async () => {
    const cascade = new ApiKeyCascade({
      keys: ['key-1', 'key-2'],
      rotationStrategy: 'round-robin',
      shuffleOnStartup: false,
    });
    const usedKeys: string[] = [];

    await cascade.execute(async (apiKey) => {
      usedKeys.push(apiKey);
      return 'ok-1';
    });

    await cascade.execute(async (apiKey) => {
      usedKeys.push(apiKey);
      return 'ok-2';
    });

    expect(usedKeys).toEqual(['key-1', 'key-2']);
  });

  it('starts from a random key and fails over sequentially', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.4); // start at index 1 for 3 keys

    const cascade = new ApiKeyCascade({
      keys: ['key-1', 'key-2', 'key-3'],
      rotationStrategy: 'random',
      shuffleOnStartup: false,
    });
    const usedKeys: string[] = [];

    const result = await cascade.execute(
      async (apiKey) => {
        usedKeys.push(apiKey);
        if (usedKeys.length === 1) {
          throw new Error('Rate limit exceeded');
        }
        return 'success';
      },
      { delayBetweenAttemptsMs: 0 }
    );

    expect(result).toBe('success');
    expect(usedKeys).toEqual(['key-2', 'key-3']);
  });

  it('stops failover when non-retryable error predicate matches', async () => {
    const cascade = new ApiKeyCascade({
      keys: ['key-1', 'key-2', 'key-3'],
      rotationStrategy: 'random',
      shuffleOnStartup: false,
    });
    const usedKeys: string[] = [];

    await expect(
      cascade.execute(
        async (apiKey) => {
          usedKeys.push(apiKey);
          throw new Error('Transaction not found');
        },
        {
          delayBetweenAttemptsMs: 0,
          isNonRetryableError: (error) =>
            error.message.toLowerCase().includes('transaction not found'),
        }
      )
    ).rejects.toThrow('Transaction not found');

    expect(usedKeys).toHaveLength(1);
  });

  it('throws an exhausted error with the last failure as cause', async () => {
    const cascade = new ApiKeyCascade({
      keys: ['key-1', 'key-2'],
      rotationStrategy: 'round-robin',
      shuffleOnStartup: false,
    });

    try {
      await cascade.execute(
        async () => {
          throw new Error('HTTP 503: Service unavailable');
        },
        { delayBetweenAttemptsMs: 0 }
      );
      throw new Error('Expected execute() to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      const cast = error as Error;
      expect(cast.message).toContain('All API keys exhausted');
      expect(cast.cause).toBeInstanceOf(Error);
      expect((cast.cause as Error).message).toBe('HTTP 503: Service unavailable');
    }
  });
});
