import {
  createProviderCascadeForChain,
  loadEtherscanKeysFromEnv,
  loadHeliusKeysFromEnv,
} from '@/lib/libraries/backend-core/http/fetch-tx';

describe('provider key env loaders', () => {
  it('loads and deduplicates etherscan keys', () => {
    const keys = loadEtherscanKeysFromEnv({
      ETHERSCAN_API_KEY: 'alpha',
      ETHERSCAN_API_KEY_1: 'alpha',
      ETHERSCAN_API_KEY_2: '  beta  ',
      ETHERSCAN_API_KEY_3: '',
      ETHERSCAN_API_KEY_4: 'gamma',
    } as unknown as NodeJS.ProcessEnv);

    expect(keys).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('loads and deduplicates helius keys', () => {
    const keys = loadHeliusKeysFromEnv({
      HELIUS_API_KEY: 'h-1',
      HELIUS_API_KEY_1: 'h-1',
      HELIUS_API_KEY_2: ' h-2 ',
      HELIUS_API_KEY_3: '',
      HELIUS_API_KEY_6: 'h-6',
    } as unknown as NodeJS.ProcessEnv);

    expect(keys).toEqual(['h-1', 'h-2', 'h-6']);
  });

  it('enforces api-only provider selection for ethereum and solana', () => {
    expect(() =>
      createProviderCascadeForChain('ethereum', { etherscanKeys: [] })
    ).toThrow('No Etherscan API keys configured for Ethereum requests');
    expect(() =>
      createProviderCascadeForChain('solana', { heliusKeys: [] })
    ).toThrow('No Helius API keys configured for Solana requests');

    const ethereumCascade = createProviderCascadeForChain('ethereum', {
      etherscanKeys: ['etherscan-test-key'],
    });
    const ethereumProviders = Object.keys(ethereumCascade.getStats());
    expect(ethereumProviders).toContain('etherscan');
    expect(ethereumProviders).not.toContain('ethereum-public-rpc');

    const solanaCascade = createProviderCascadeForChain('solana', {
      heliusKeys: ['helius-test-key'],
    });
    const solanaProviders = Object.keys(solanaCascade.getStats());
    expect(solanaProviders).toContain('helius');
    expect(solanaProviders).not.toContain('solana-public-rpc');
  });

  it('uses free-tier public provider cascade for bitcoin', () => {
    const bitcoinCascade = createProviderCascadeForChain('bitcoin');
    const bitcoinProviders = Object.keys(bitcoinCascade.getStats());

    expect(bitcoinProviders).toContain('mempool.space');
    expect(bitcoinProviders).toContain('blockstream.info');
    expect(bitcoinProviders).not.toContain('blockchair');
  });
});
