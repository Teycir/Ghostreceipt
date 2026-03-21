import { ProviderCascade } from '@/lib/providers/cascade';
import type { CascadeConfig, Provider } from '@/lib/providers/types';
import type { CanonicalTxData } from '@/lib/validation/schemas';

const sampleTx: CanonicalTxData = {
  chain: 'ethereum',
  txHash: `0x${'a'.repeat(64)}`,
  valueAtomic: '1',
  timestampUnix: 1,
  confirmations: 1,
  blockNumber: 1,
};

const baseConfig: CascadeConfig = {
  maxRetries: 0,
  retryDelayMs: 0,
  timeoutMs: 30,
  concurrencyLimit: 5,
};

function createProvider(
  name: string,
  fetchTransaction: Provider['fetchTransaction']
): Provider {
  return {
    name,
    chain: 'ethereum',
    config: {
      name,
      priority: 1,
      requiresApiKey: false,
    },
    fetchTransaction,
    isHealthy: async () => true,
  };
}

describe('ProviderCascade', () => {
  beforeEach(() => {
    jest.spyOn(Math, 'random').mockReturnValue(0.999999);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('retries retryable provider errors up to maxRetries', async () => {
    const fetchTransaction = jest
      .fn<ReturnType<Provider['fetchTransaction']>, Parameters<Provider['fetchTransaction']>>()
      .mockRejectedValueOnce(new Error('Rate limit exceeded'))
      .mockResolvedValueOnce(sampleTx);

    const cascade = new ProviderCascade(
      [createProvider('p1', fetchTransaction)],
      {
        ...baseConfig,
        maxRetries: 1,
      }
    );

    const result = await cascade.fetchTransaction(sampleTx.txHash);

    expect(result.provider).toBe('p1');
    expect(fetchTransaction).toHaveBeenCalledTimes(2);
  });

  it('continues to next provider when the first provider reports not found', async () => {
    const firstProviderFetch = jest
      .fn<ReturnType<Provider['fetchTransaction']>, Parameters<Provider['fetchTransaction']>>()
      .mockRejectedValue(new Error(`Transaction not found: ${sampleTx.txHash}`));

    const secondProviderFetch = jest
      .fn<ReturnType<Provider['fetchTransaction']>, Parameters<Provider['fetchTransaction']>>()
      .mockResolvedValue(sampleTx);

    const cascade = new ProviderCascade(
      [
        createProvider('p1', firstProviderFetch),
        createProvider('p2', secondProviderFetch),
      ],
      baseConfig
    );

    const result = await cascade.fetchTransaction(sampleTx.txHash);

    expect(result.provider).toBe('p2');
    expect(firstProviderFetch).toHaveBeenCalledTimes(1);
    expect(secondProviderFetch).toHaveBeenCalledTimes(1);
  });

  it('returns NOT_FOUND when every provider reports missing transaction', async () => {
    const fetchNotFound = jest
      .fn<ReturnType<Provider['fetchTransaction']>, Parameters<Provider['fetchTransaction']>>()
      .mockRejectedValue(new Error(`Transaction not found: ${sampleTx.txHash}`));

    const cascade = new ProviderCascade(
      [
        createProvider('p1', fetchNotFound),
        createProvider('p2', fetchNotFound),
      ],
      baseConfig
    );

    await expect(cascade.fetchTransaction(sampleTx.txHash)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      retryable: false,
    });
  });

  it('aborts provider call when timeout elapses', async () => {
    let aborted = false;

    const hangingFetch: Provider['fetchTransaction'] = async (_txHash, signal) => {
      return await new Promise<CanonicalTxData>((_resolve) => {
        signal?.addEventListener('abort', () => {
          aborted = true;
        });
      });
    };

    const cascade = new ProviderCascade(
      [createProvider('slow-provider', hangingFetch)],
      {
        ...baseConfig,
        timeoutMs: 10,
      }
    );

    await expect(cascade.fetchTransaction(sampleTx.txHash)).rejects.toThrow(
      'All providers failed. Last error: Provider slow-provider timeout after 10ms'
    );
    expect(aborted).toBe(true);
  });
});
