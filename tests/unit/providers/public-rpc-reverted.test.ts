import { EthereumPublicRpcProvider } from '@/lib/providers/ethereum/public-rpc';

describe('EthereumPublicRpcProvider reverted transaction handling', () => {
  it('rejects reverted transactions with non-retryable REVERTED provider error', async () => {
    const provider = new EthereumPublicRpcProvider() as unknown as {
      fetchTransaction: (txHash: string) => Promise<unknown>;
      getClient: () => {
        getTransaction: (input: { hash: string }) => Promise<{ hash: `0x${string}`; value: bigint; blockNumber: bigint | null }>;
        getTransactionReceipt: (input: { hash: string }) => Promise<{ blockNumber: bigint; status: 'success' | 'reverted' }>;
        getBlockNumber: () => Promise<bigint>;
        getBlock: (input: { blockNumber: bigint }) => Promise<{ timestamp: bigint }>;
      };
    };

    provider.getClient = () => ({
      getTransaction: async ({ hash }) => ({
        hash: hash as `0x${string}`,
        value: 1000n,
        blockNumber: 1n,
      }),
      getTransactionReceipt: async () => ({
        blockNumber: 1n,
        status: 'reverted',
      }),
      getBlockNumber: async () => 2n,
      getBlock: async () => ({ timestamp: 1700000000n }),
    });

    await expect(
      provider.fetchTransaction(`0x${'a'.repeat(64)}`)
    ).rejects.toMatchObject({
      code: 'REVERTED',
      provider: 'ethereum-public-rpc',
      retryable: false,
    });
  });
});
