import { MempoolSpaceProvider } from '@/lib/providers/bitcoin/mempool';
import { BlockCypherProvider } from '@/lib/providers/bitcoin/blockcypher';
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

  it('blocks blockcypher provider requests when base URL resolves to localhost', async () => {
    const provider = new BlockCypherProvider();
    (provider as unknown as { baseUrl: string }).baseUrl = 'https://localhost:8443/api';

    const fetchSpy = jest.spyOn(global, 'fetch');

    await expect(provider.fetchTransaction('a'.repeat(64))).rejects.toThrow(
      'Blocked provider URL'
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
