import { MempoolSpaceProvider } from '@/lib/providers/bitcoin/mempool';

const originalMempoolThrottleMs = process.env['MEMPOOL_REQUEST_THROTTLE_MS'];

describe('MempoolSpaceProvider', () => {
  beforeEach(() => {
    process.env['MEMPOOL_REQUEST_THROTTLE_MS'] = '0';
  });

  afterEach(() => {
    if (originalMempoolThrottleMs === undefined) {
      delete process.env['MEMPOOL_REQUEST_THROTTLE_MS'];
    } else {
      process.env['MEMPOOL_REQUEST_THROTTLE_MS'] = originalMempoolThrottleMs;
    }
    jest.restoreAllMocks();
  });

  it('computes confirmation depth from current tip height for confirmed transactions', async () => {
    const provider = new MempoolSpaceProvider();

    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          txid: 'a'.repeat(64),
          version: 2,
          locktime: 0,
          vin: [],
          vout: [{ value: 1000 }, { value: 2000 }],
          size: 0,
          weight: 0,
          fee: 0,
          status: {
            confirmed: true,
            block_height: 100,
            block_hash: 'b'.repeat(64),
            block_time: 1700000000,
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => '105',
      } as Response);

    const result = await provider.fetchTransaction('a'.repeat(64));

    expect(result.confirmations).toBe(6);
    expect(result.valueAtomic).toBe('3000');
    expect(result.blockNumber).toBe(100);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://mempool.space/api/blocks/tip/height',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('returns zero confirmations for unconfirmed transactions without tip lookup', async () => {
    const provider = new MempoolSpaceProvider();
    jest.spyOn(Date, 'now').mockReturnValue(1700000000000);

    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        txid: 'a'.repeat(64),
        version: 2,
        locktime: 0,
        vin: [],
        vout: [{ value: 42 }],
        size: 0,
        weight: 0,
        fee: 0,
        status: {
          confirmed: false,
        },
      }),
    } as Response);

    const result = await provider.fetchTransaction('a'.repeat(64));

    expect(result.confirmations).toBe(0);
    expect(result.timestampUnix).toBe(1700000000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
