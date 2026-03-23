import {
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
});
