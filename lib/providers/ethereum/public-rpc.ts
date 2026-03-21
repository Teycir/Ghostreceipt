import type { EthereumProvider, ProviderConfig } from '../types';
import type { CanonicalTxData } from '@/lib/validation/schemas';
import { EthereumTxHashSchema } from '@/lib/validation/schemas';
import { createPublicClient, http, type Hash } from 'viem';
import { mainnet } from 'viem/chains';

/**
 * Ethereum public RPC provider (no API key required)
 */
export class EthereumPublicRpcProvider implements EthereumProvider {
  readonly name = 'ethereum-public-rpc';
  readonly chain = 'ethereum' as const;
  readonly config: ProviderConfig = {
    name: 'ethereum-public-rpc',
    priority: 1,
    requiresApiKey: false,
  };

  private readonly client = createPublicClient({
    chain: mainnet,
    transport: http(),
  });

  async fetchTransaction(txHash: string): Promise<CanonicalTxData> {
    // Validate hash format
    const validationResult = EthereumTxHashSchema.safeParse(txHash);
    if (!validationResult.success) {
      throw new Error(`Invalid Ethereum transaction hash: ${txHash}`);
    }

    try {
      // Fetch transaction
      const tx = await this.client.getTransaction({
        hash: txHash as Hash,
      });

      if (!tx) {
        throw new Error(`Transaction not found: ${txHash}`);
      }

      // Fetch transaction receipt for confirmations
      const receipt = await this.client.getTransactionReceipt({
        hash: txHash as Hash,
      });

      // Fetch current block number for confirmations
      const currentBlock = await this.client.getBlockNumber();

      // Fetch block for timestamp
      const block = await this.client.getBlock({
        blockNumber: receipt.blockNumber,
      });

      return this.normalize(tx, receipt, block, currentBlock);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          throw new Error(`Transaction not found: ${txHash}`);
        }
        throw error;
      }
      throw new Error('Unknown error fetching transaction');
    }
  }

  /**
   * Normalize viem response to canonical format
   */
  private normalize(
    tx: { hash: Hash; value: bigint; blockNumber: bigint | null },
    receipt: { blockNumber: bigint; status: 'success' | 'reverted' },
    block: { timestamp: bigint },
    currentBlock: bigint
  ): CanonicalTxData {
    const blockNumber = Number(receipt.blockNumber);
    const confirmations = Number(currentBlock - receipt.blockNumber) + 1;

    return {
      chain: 'ethereum',
      txHash: tx.hash,
      valueAtomic: tx.value.toString(), // Wei as string
      timestampUnix: Number(block.timestamp),
      confirmations,
      blockNumber,
      blockHash: undefined, // Not needed for canonical format
    };
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.client.getBlockNumber();
      return true;
    } catch (error) {
      console.error(`[${this.name}] Health check failed:`, error);
      return false;
    }
  }
}
