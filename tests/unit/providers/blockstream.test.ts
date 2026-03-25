import { BlockstreamProvider } from '@/lib/providers/bitcoin/blockstream';

const originalBlockstreamThrottleMs = process.env['BLOCKSTREAM_REQUEST_THROTTLE_MS'];

describe('BlockstreamProvider', () => {
  beforeEach(() => {
    process.env['BLOCKSTREAM_REQUEST_THROTTLE_MS'] = '0';
  });

  afterEach(() => {
    if (originalBlockstreamThrottleMs === undefined) {
      delete process.env['BLOCKSTREAM_REQUEST_THROTTLE_MS'];
    } else {
      process.env['BLOCKSTREAM_REQUEST_THROTTLE_MS'] = originalBlockstreamThrottleMs;
    }
    jest.restoreAllMocks();
  });

  it('computes confirmation depth from current tip height for confirmed transactions', async () => {
    const provider = new BlockstreamProvider();

    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          txid: 'a'.repeat(64),
          vout: [{ value: 1000 }, { value: 2500 }],
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
        text: async () => '108',
      } as Response);

    const result = await provider.fetchTransaction('a'.repeat(64));

    expect(result.confirmations).toBe(9);
    expect(result.valueAtomic).toBe('3500');
    expect(result.blockNumber).toBe(100);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://blockstream.info/api/blocks/tip/height',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('returns zero confirmations for unconfirmed transactions without tip lookup', async () => {
    const provider = new BlockstreamProvider();
    jest.spyOn(Date, 'now').mockReturnValue(1700000000000);

    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        txid: 'a'.repeat(64),
        vout: [{ value: 42 }],
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
