import { BlockCypherProvider } from '@/lib/providers/bitcoin/blockcypher';

const originalBlockCypherThrottleMs = process.env['BLOCKCYPHER_REQUEST_THROTTLE_MS'];
const originalBlockCypherKeyAttemptDelayMs = process.env['BLOCKCYPHER_KEY_ATTEMPT_DELAY_MS'];

describe('BlockCypherProvider', () => {
  beforeEach(() => {
    process.env['BLOCKCYPHER_REQUEST_THROTTLE_MS'] = '0';
    process.env['BLOCKCYPHER_KEY_ATTEMPT_DELAY_MS'] = '0';
  });

  afterEach(() => {
    if (originalBlockCypherThrottleMs === undefined) {
      delete process.env['BLOCKCYPHER_REQUEST_THROTTLE_MS'];
    } else {
      process.env['BLOCKCYPHER_REQUEST_THROTTLE_MS'] = originalBlockCypherThrottleMs;
    }
    if (originalBlockCypherKeyAttemptDelayMs === undefined) {
      delete process.env['BLOCKCYPHER_KEY_ATTEMPT_DELAY_MS'];
    } else {
      process.env['BLOCKCYPHER_KEY_ATTEMPT_DELAY_MS'] = originalBlockCypherKeyAttemptDelayMs;
    }
    jest.restoreAllMocks();
  });

  it('normalizes confirmed transaction payload', async () => {
    const provider = new BlockCypherProvider();

    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        hash: 'a'.repeat(64),
        total: 3500,
        confirmations: 9,
        confirmed: '2024-01-01T00:00:00Z',
        block_height: 840000,
        block_hash: 'b'.repeat(64),
      }),
    } as Response);

    const result = await provider.fetchTransaction('a'.repeat(64));

    expect(result.confirmations).toBe(9);
    expect(result.valueAtomic).toBe('3500');
    expect(result.timestampUnix).toBe(1704067200);
    expect(result.blockNumber).toBe(840000);
    expect(result.blockHash).toBe('b'.repeat(64));
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.blockcypher.com/v1/btc/main/txs/' + 'a'.repeat(64),
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('falls back to outputs sum and current timestamp when metadata is missing', async () => {
    const provider = new BlockCypherProvider();
    jest.spyOn(Date, 'now').mockReturnValue(1700000000000);

    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        hash: 'a'.repeat(64),
        outputs: [{ value: 12 }, { value: 30 }],
      }),
    } as Response);

    const result = await provider.fetchTransaction('a'.repeat(64));

    expect(result.valueAtomic).toBe('42');
    expect(result.confirmations).toBe(0);
    expect(result.timestampUnix).toBe(1700000000);
    expect(result.blockNumber).toBeUndefined();
  });

  it('does not rotate BlockCypher API tokens on key-agnostic provider outages', async () => {
    const provider = new BlockCypherProvider({
      keys: ['token-1', 'token-2'],
      rotationStrategy: 'round-robin',
      shuffleOnStartup: false,
    });

    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    } as Response);

    await expect(provider.fetchTransaction('a'.repeat(64))).rejects.toThrow(
      'HTTP 503: Service Unavailable'
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.blockcypher.com/v1/btc/main/txs/' + 'a'.repeat(64) + '?token=token-1',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('stops key-rotation on rate limit to reduce spike amplification', async () => {
    const provider = new BlockCypherProvider({
      keys: ['token-1', 'token-2'],
      rotationStrategy: 'round-robin',
      shuffleOnStartup: false,
    });

    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
    } as Response);

    await expect(provider.fetchTransaction('a'.repeat(64))).rejects.toThrow('Rate limit exceeded');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.blockcypher.com/v1/btc/main/txs/' + 'a'.repeat(64) + '?token=token-1',
      expect.objectContaining({ method: 'GET' })
    );
  });
});
