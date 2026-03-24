import type {
  EthereumProvider,
  ProviderConfig,
  ProviderError,
} from '@ghostreceipt/backend-core/providers/types';
import type { CanonicalTxData } from '@/lib/validation/schemas';
import { EthereumTxHashSchema } from '@/lib/validation/schemas';
import { createPublicClient, http, type Hash } from 'viem';
import { mainnet } from 'viem/chains';
import { secureError } from '@/lib/security/secure-logging';

/**
 * Ethereum public RPC provider (no API key required)
 */
export class EthereumPublicRpcProvider implements EthereumProvider {
  readonly name = 'ethereum-public-rpc';
  readonly chain = 'ethereum' as const;
  readonly config: ProviderConfig = {
    name: 'ethereum-public-rpc',
    priority: 99,
    requiresApiKey: false,
  };

  private readonly client = createPublicClient({
    chain: mainnet,
    transport: http(),
  });

  private getClient(signal?: AbortSignal) {
    if (!signal) {
      return this.client;
    }

    return createPublicClient({
      chain: mainnet,
      transport: http(undefined, {
        fetchOptions: {
          signal,
        },
      }),
    });
  }

  private createProviderError(
    message: string,
    code: string,
    retryable: boolean
  ): ProviderError {
    const providerError = new Error(message) as ProviderError;
    providerError.provider = this.name;
    providerError.code = code;
    providerError.retryable = retryable;
    return providerError;
  }

  private isProviderError(error: unknown): error is ProviderError {
    return (
      error instanceof Error &&
      'provider' in error &&
      'code' in error &&
      'retryable' in error
    );
  }

  async fetchTransaction(
    txHash: string,
    signal?: AbortSignal
  ): Promise<CanonicalTxData> {
    // Validate hash format
    const validationResult = EthereumTxHashSchema.safeParse(txHash);
    if (!validationResult.success) {
      throw new Error(`Invalid Ethereum transaction hash: ${txHash}`);
    }

    const client = this.getClient(signal);

    try {
      // Fetch transaction
      const tx = await client.getTransaction({
        hash: txHash as Hash,
      });

      if (!tx) {
        throw new Error(`Transaction not found: ${txHash}`);
      }

      // Fetch transaction receipt for confirmations
      const receipt = await client.getTransactionReceipt({
        hash: txHash as Hash,
      });

      if (receipt.status !== 'success') {
        throw this.createProviderError(
          `Transaction reverted: ${txHash}`,
          'REVERTED',
          false
        );
      }

      // Fetch current block number for confirmations
      const currentBlock = await client.getBlockNumber();

      // Fetch block for timestamp
      const block = await client.getBlock({
        blockNumber: receipt.blockNumber,
      });

      return this.normalize(tx, receipt, block, currentBlock);
    } catch (error) {
      if (this.isProviderError(error)) {
        throw error;
      }

      if (error instanceof Error) {
        if (
          error.message.includes('not found') ||
          error.message.includes('could not be found')
        ) {
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
      secureError(`[${this.name}] Health check failed:`, error);
      return false;
    }
  }
}
