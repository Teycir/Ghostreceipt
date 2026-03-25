import type { EthereumProvider, ProviderConfig } from '@ghostreceipt/backend-core/providers/types';
import type { CanonicalTxData, EthereumAsset } from '@/lib/validation/schemas';
import { EthereumTxHashSchema } from '@/lib/validation/schemas';
import { validateUrl } from '@/lib/security/ssrf';
import { secureError } from '@/lib/security/secure-logging';
import { waitForProviderThrottleSlot } from '@/lib/libraries/backend-core/providers/provider-throttle';

interface JsonRpcError {
  code?: number;
  message?: string;
}

interface JsonRpcResponse<T> {
  jsonrpc?: string;
  id?: number | string | null;
  result?: T;
  error?: JsonRpcError;
}

interface RpcTransaction {
  hash?: string;
  value?: string;
  blockNumber?: string | null;
}

interface RpcReceipt {
  blockNumber?: string | null;
  status?: string;
}

interface RpcBlock {
  timestamp?: string;
  hash?: string;
}

const HEX_QUANTITY_REGEX = /^0x[0-9a-f]+$/i;
const DEFAULT_ETH_PUBLIC_RPC_URL = 'https://cloudflare-eth.com';
const DEFAULT_ETH_PUBLIC_RPC_THROTTLE_MS = 900;
const RPC_SCOPE = 'provider:ethereum-public-rpc';

function parseNonNegativeIntEnv(key: string, fallback: number): number {
  const rawValue = process.env[key];
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function createRevertedError(txHash: string): Error {
  const revertedError = new Error(`Transaction reverted: ${txHash}`) as Error & {
    provider?: string;
    code?: string;
    retryable?: boolean;
  };
  revertedError.provider = 'ethereum-public-rpc';
  revertedError.code = 'REVERTED';
  revertedError.retryable = false;
  return revertedError;
}

export class EthereumPublicRpcProvider implements EthereumProvider {
  readonly name = 'ethereum-public-rpc';
  readonly chain = 'ethereum' as const;
  readonly config: ProviderConfig = {
    name: 'ethereum-public-rpc',
    priority: 2,
    requiresApiKey: false,
    rateLimit: {
      requestsPerSecond: 1,
      requestsPerDay: 86400,
    },
  };

  private readonly ethereumAsset: EthereumAsset;
  private readonly endpointUrl: string;
  private readonly throttleMs: number;

  constructor(ethereumAsset: EthereumAsset = 'native') {
    this.ethereumAsset = ethereumAsset;
    this.endpointUrl = process.env['ETHEREUM_PUBLIC_RPC_URL']?.trim() || DEFAULT_ETH_PUBLIC_RPC_URL;
    this.throttleMs = parseNonNegativeIntEnv(
      'ETHEREUM_PUBLIC_RPC_REQUEST_THROTTLE_MS',
      DEFAULT_ETH_PUBLIC_RPC_THROTTLE_MS
    );
  }

  async fetchTransaction(txHash: string, signal?: AbortSignal): Promise<CanonicalTxData> {
    const validationResult = EthereumTxHashSchema.safeParse(txHash);
    if (!validationResult.success) {
      throw new Error(`Invalid Ethereum transaction hash: ${txHash}`);
    }

    if (this.ethereumAsset !== 'native') {
      throw new Error('Ethereum public RPC consensus currently supports native ETH mode only');
    }

    const tx = await this.requestRpc<RpcTransaction | null>(
      'eth_getTransactionByHash',
      [txHash],
      signal
    );
    if (!tx || typeof tx.hash !== 'string') {
      throw new Error(`Transaction not found: ${txHash}`);
    }
    if (typeof tx.value !== 'string') {
      throw new Error('Malformed Ethereum transaction payload from public RPC');
    }

    const receipt = await this.requestRpc<RpcReceipt | null>(
      'eth_getTransactionReceipt',
      [txHash],
      signal
    );
    if (!receipt || typeof receipt.blockNumber !== 'string') {
      throw new Error(`Transaction receipt unavailable: ${txHash}`);
    }
    if (receipt.status?.toLowerCase() === '0x0') {
      throw createRevertedError(txHash);
    }

    const currentBlockHex = await this.requestRpc<string>('eth_blockNumber', [], signal);
    const currentBlock = this.hexToNumber(currentBlockHex, 'block number');

    const block = await this.requestRpc<RpcBlock | null>(
      'eth_getBlockByNumber',
      [receipt.blockNumber, false],
      signal
    );
    if (!block || typeof block.timestamp !== 'string') {
      throw new Error(`Block details unavailable for transaction: ${txHash}`);
    }

    const blockNumber = this.hexToNumber(receipt.blockNumber, 'transaction block number');
    const timestampUnix = this.hexToNumber(block.timestamp, 'block timestamp');
    const confirmations = Math.max(currentBlock - blockNumber + 1, 1);

    return {
      chain: 'ethereum',
      txHash: tx.hash,
      valueAtomic: this.hexToBigInt(tx.value, 'transaction value').toString(),
      timestampUnix,
      confirmations,
      blockNumber,
      ...(typeof block.hash === 'string' && block.hash.length > 0 ? { blockHash: block.hash } : {}),
    };
  }

  private async requestRpc<T>(
    method: string,
    params: unknown[],
    signal?: AbortSignal
  ): Promise<T> {
    const urlValidation = validateUrl(this.endpointUrl);
    if (!urlValidation.valid) {
      throw new Error(`Blocked provider URL: ${urlValidation.error ?? 'invalid URL'}`);
    }

    await waitForProviderThrottleSlot(RPC_SCOPE, this.throttleMs);

    const response = await fetch(this.endpointUrl, {
      method: 'POST',
      signal: signal ?? null,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method,
        params,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Rate limit exceeded');
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    let payload: JsonRpcResponse<T>;
    try {
      payload = (await response.json()) as JsonRpcResponse<T>;
    } catch {
      throw new Error('Invalid JSON response from Ethereum public RPC');
    }

    if (payload.error && typeof payload.error === 'object') {
      const errorMessage =
        typeof payload.error.message === 'string' ? payload.error.message : 'Unknown RPC error';
      if (errorMessage.toLowerCase().includes('rate limit')) {
        throw new Error('Rate limit exceeded');
      }
      throw new Error(`Ethereum public RPC error: ${errorMessage}`);
    }

    if (!Object.prototype.hasOwnProperty.call(payload, 'result')) {
      throw new Error('Malformed Ethereum public RPC response');
    }

    return payload.result as T;
  }

  private hexToBigInt(value: string, fieldName: string): bigint {
    if (!HEX_QUANTITY_REGEX.test(value)) {
      throw new Error(`Malformed ${fieldName} value from Ethereum public RPC`);
    }

    try {
      return BigInt(value);
    } catch {
      throw new Error(`Invalid ${fieldName} value from Ethereum public RPC`);
    }
  }

  private hexToNumber(value: string, fieldName: string): number {
    const asBigInt = this.hexToBigInt(value, fieldName);
    if (asBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error(`${fieldName} exceeds safe integer range`);
    }

    return Number(asBigInt);
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.requestRpc<string>('eth_blockNumber', []);
      return true;
    } catch (error) {
      secureError(`[${this.name}] Health check failed:`, error);
      return false;
    }
  }
}
