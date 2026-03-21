import { MempoolSpaceProvider } from '@/lib/providers/bitcoin/mempool';
import { EtherscanProvider } from '@/lib/providers/ethereum/etherscan';

describe('Provider SSRF enforcement', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('blocks mempool provider requests when base URL resolves to private network', async () => {
    const provider = new MempoolSpaceProvider();
    (provider as unknown as { baseUrl: string }).baseUrl = 'https://127.0.0.1/api';

    const fetchSpy = jest.spyOn(global, 'fetch');

    await expect(provider.fetchTransaction('a'.repeat(64))).rejects.toThrow(
      'Blocked provider URL'
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('blocks etherscan provider requests when base URL resolves to metadata IP', async () => {
    const provider = new EtherscanProvider({
      keys: ['test-key'],
      rotationStrategy: 'round-robin',
      shuffleOnStartup: false,
    });
    (provider as unknown as { baseUrl: string }).baseUrl = 'https://169.254.169.254/api';

    const fetchSpy = jest.spyOn(global, 'fetch');

    await expect(
      provider.fetchTransaction(`0x${'a'.repeat(64)}`)
    ).rejects.toThrow('Blocked provider URL');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
