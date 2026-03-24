import { HeliusProvider } from '@/lib/providers/solana/helius';

const originalHeliusThrottleMs = process.env['HELIUS_REQUEST_THROTTLE_MS'];

const makeProvider = () =>
  new HeliusProvider({
    keys: ['helius-key-1'],
    rotationStrategy: 'round-robin',
    shuffleOnStartup: false,
  });

const sampleSignature = '1111111111111111111111111111111111111111111111111111111111111111';

describe('HeliusProvider', () => {
  beforeEach(() => {
    process.env['HELIUS_REQUEST_THROTTLE_MS'] = '0';
    HeliusProvider.resetRuntimeMetricsForTests();
  });

  afterEach(() => {
    if (originalHeliusThrottleMs === undefined) {
      delete process.env['HELIUS_REQUEST_THROTTLE_MS'];
    } else {
      process.env['HELIUS_REQUEST_THROTTLE_MS'] = originalHeliusThrottleMs;
    }
    HeliusProvider.resetRuntimeMetricsForTests();
    jest.restoreAllMocks();
  });

  it('normalizes native SOL transfer payloads to canonical transaction data', async () => {
    const provider = makeProvider();

    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          result: {
            slot: 319000000,
            blockTime: 1700000000,
            transaction: {
              message: {
                recentBlockhash: 'RecentBlockHash11111111111111111111111111111',
                instructions: [
                  {
                    program: 'system',
                    parsed: {
                      type: 'transfer',
                      info: {
                        lamports: 1000000,
                      },
                    },
                  },
                ],
              },
            },
            meta: {
              innerInstructions: [],
            },
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          result: {
            value: [
              {
                confirmations: 7,
                confirmationStatus: 'confirmed',
              },
            ],
          },
        }),
      } as Response);

    const result = await provider.fetchTransaction(sampleSignature);

    expect(result).toEqual({
      chain: 'solana',
      txHash: sampleSignature,
      valueAtomic: '1000000',
      timestampUnix: 1700000000,
      confirmations: 7,
      blockNumber: 319000000,
      blockHash: 'RecentBlockHash11111111111111111111111111111',
    });

    const firstCallUrl = String(fetchMock.mock.calls[0]?.[0] ?? '');
    expect(firstCallUrl).toContain('https://mainnet.helius-rpc.com/');
    expect(firstCallUrl).toContain('api-key=helius-key-1');
  });

  it('starts from a random key and fails over sequentially across keys', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.4); // index 1 -> key-2

    const provider = new HeliusProvider({
      keys: ['key-1', 'key-2', 'key-3'],
      rotationStrategy: 'random',
      shuffleOnStartup: false,
    });

    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          result: {
            slot: 1,
            blockTime: 1700000000,
            transaction: {
              message: {
                recentBlockhash: 'BlockHash2',
                instructions: [
                  {
                    program: 'system',
                    parsed: {
                      type: 'transfer',
                      info: {
                        lamports: 10,
                      },
                    },
                  },
                ],
              },
            },
            meta: {
              innerInstructions: [],
            },
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          result: {
            value: [{ confirmationStatus: 'finalized', confirmations: null }],
          },
        }),
      } as Response);

    const result = await provider.fetchTransaction(sampleSignature);

    expect(result.valueAtomic).toBe('10');
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const firstCallUrl = String(fetchMock.mock.calls[0]?.[0] ?? '');
    const secondCallUrl = String(fetchMock.mock.calls[1]?.[0] ?? '');
    expect(firstCallUrl).toContain('api-key=key-2');
    expect(secondCallUrl).toContain('api-key=key-3');
  });

  it('exposes runtime failover metrics across attempts', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.4); // index 1 -> key-2

    const provider = new HeliusProvider({
      keys: ['key-1', 'key-2', 'key-3'],
      rotationStrategy: 'random',
      shuffleOnStartup: false,
    });

    jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          result: {
            slot: 2,
            blockTime: 1700000000,
            transaction: {
              message: {
                recentBlockhash: 'BlockHash3',
                instructions: [
                  {
                    program: 'system',
                    parsed: {
                      type: 'transfer',
                      info: {
                        lamports: 11,
                      },
                    },
                  },
                ],
              },
            },
            meta: {
              innerInstructions: [],
            },
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          result: {
            value: [{ confirmationStatus: 'confirmed', confirmations: 2 }],
          },
        }),
      } as Response);

    await provider.fetchTransaction(sampleSignature);

    const metrics = HeliusProvider.getRuntimeMetrics();
    expect(metrics).not.toBeNull();
    expect(metrics?.totalExecutions).toBe(1);
    expect(metrics?.totalAttempts).toBe(2);
    expect(metrics?.totalSuccesses).toBe(1);
    expect(metrics?.totalFailures).toBe(1);
    expect(metrics?.totalExhausted).toBe(0);
    expect(metrics?.totalNonRetryableStops).toBe(0);
    expect(metrics?.keys[1]?.failures).toBe(1); // key-2 first attempt
    expect(metrics?.keys[2]?.successes).toBe(1); // key-3 success after failover
  });
});
