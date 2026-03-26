import type {
  ApiKeyConfig,
  EthereumProvider,
  ProviderConfig,
} from '@ghostreceipt/backend-core/providers/types';
import type { CanonicalTxData } from '@/lib/validation/schemas';
import { EthereumTxHashSchema } from '@/lib/validation/schemas';
import type { EthereumAsset } from '@/lib/validation/schemas';
import { validateUrl } from '@/lib/security/ssrf';
import { secureWarn, secureError } from '@/lib/security/secure-logging';
import {
  ApiKeyCascade,
  type ApiKeyCascadeMetricsSnapshot,
} from '@/lib/libraries/backend-core/providers/api-key-cascade';
import {
  resetProviderThrottleStateForTests,
  resolveProviderThrottlePolicy,
  waitForProviderThrottleSlot,
} from '@/lib/libraries/backend-core/providers/provider-throttle';
import {
  ETHEREUM_PROVIDER_API_ENDPOINT_ENV_KEYS,
  ETHEREUM_PROVIDER_API_ENDPOINTS,
  resolveRequiredEndpointUrl,
} from '@/lib/config/public-rpc-endpoints';

/**
 * Etherscan proxy API response types
 */
interface EtherscanRpcError {
  code?: number;
  message?: string;
}

interface EtherscanProxyResponse<T> {
  jsonrpc?: string;
  id?: number | string | null;
  result?: T;
  error?: EtherscanRpcError;
  status?: string;
  message?: string;
}

interface EtherscanProxyTransaction {
  hash?: string;
  value?: string;
  blockNumber?: string | null;
}

interface EtherscanProxyReceipt {
  blockNumber?: string | null;
  status?: string;
  logs?: EtherscanProxyReceiptLog[];
}

interface EtherscanProxyBlock {
  timestamp?: string;
}

interface EtherscanProxyReceiptLog {
  address?: string;
  data?: string;
  topics?: string[];
}

const ETHEREUM_CHAIN_ID = '1';
const HEX_QUANTITY_REGEX = /^0x[0-9a-f]+$/i;
const ETHERSCAN_METRICS_SCOPE = 'provider:etherscan';
const USDC_CONTRACT_ADDRESS = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const ERC20_TRANSFER_TOPIC0 = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const ETHERSCAN_KEY_ROTATION_ERROR_PATTERNS = [
  'rate limit',
  'too many requests',
  '429',
  '401',
  '403',
  'unauthorized',
  'forbidden',
  'invalid api key',
  'missing/invalid api key',
  'api key rate limit',
  'max rate limit reached',
  'quota exceeded',
  'credits exhausted',
];

function shouldContinueEtherscanKeyRotation(error: Error): boolean {
  const normalizedMessage = error.message.toLowerCase();
  return ETHERSCAN_KEY_ROTATION_ERROR_PATTERNS.some((pattern) =>
    normalizedMessage.includes(pattern)
  );
}

/**
 * Etherscan provider with API key cascade
 */
export class EtherscanProvider implements EthereumProvider {
  readonly name = 'etherscan';
  readonly chain = 'ethereum' as const;
  readonly config: ProviderConfig = {
    name: 'etherscan',
    priority: 1,
    requiresApiKey: true,
    rateLimit: {
      requestsPerSecond: 3,
      requestsPerDay: 100000,
    },
  };

  private readonly baseUrl: string;
  private readonly keyCascade: ApiKeyCascade;
  private readonly ethereumAsset: EthereumAsset;
  private readonly throttlePolicy = resolveProviderThrottlePolicy('etherscan', {
    hasApiKey: true,
  });

  constructor(apiKeyConfig: ApiKeyConfig, ethereumAsset: EthereumAsset = 'native') {
    this.keyCascade = new ApiKeyCascade(apiKeyConfig, {
      metricsScope: ETHERSCAN_METRICS_SCOPE,
    });
    this.ethereumAsset = ethereumAsset;
    this.baseUrl = resolveRequiredEndpointUrl(
      ETHEREUM_PROVIDER_API_ENDPOINTS,
      'ETHERSCAN_V2_MAINNET',
      'ETHEREUM_PROVIDER_API_ENDPOINTS.ETHERSCAN_V2_MAINNET',
      ETHEREUM_PROVIDER_API_ENDPOINT_ENV_KEYS
    );

    const urlValidation = validateUrl(this.baseUrl);
    if (!urlValidation.valid) {
      throw new Error(
        `[Config] Invalid Etherscan API endpoint URL: ${this.baseUrl} (${urlValidation.error ?? 'invalid URL'})`
      );
    }
  }

  static getRuntimeMetrics(): ApiKeyCascadeMetricsSnapshot | null {
    return ApiKeyCascade.getMetricsSnapshot(ETHERSCAN_METRICS_SCOPE);
  }

  static resetRuntimeMetricsForTests(): void {
    ApiKeyCascade.resetMetricsForTests(ETHERSCAN_METRICS_SCOPE);
    resetProviderThrottleStateForTests(ETHERSCAN_METRICS_SCOPE);
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

    try {
      return await this.keyCascade.execute(
        async (apiKey) => this.fetchWithKey(txHash, apiKey, signal),
        {
          delayBetweenAttemptsMs: this.throttlePolicy.keyAttemptDelayMs,
          isNonRetryableError: (error) => {
            const normalizedMessage = error.message.toLowerCase();
            return (
              normalizedMessage.includes('transaction not found') ||
              normalizedMessage.includes('transaction reverted') ||
              normalizedMessage.includes('invalid ethereum transaction hash')
            );
          },
          shouldContinueToNextKey: (error) => shouldContinueEtherscanKeyRotation(error),
          onAttemptFailure: (error, context) => {
            secureWarn(
              `[${this.name}] Key ${context.keyIndex + 1} failed (${error.message}), trying next key`
            );
          },
        }
      );
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error('Unknown error');
      if (normalizedError.message.startsWith('All API keys exhausted')) {
        secureError(`[${this.name}] API key pool exhausted`, EtherscanProvider.getRuntimeMetrics());
        const causeMessage =
          normalizedError.cause instanceof Error
            ? normalizedError.cause.message
            : normalizedError.message;
        throw new Error(`All Etherscan API keys exhausted. Last error: ${causeMessage}`, {
          cause: normalizedError.cause instanceof Error ? normalizedError.cause : normalizedError,
        });
      }

      throw normalizedError;
    }
  }

  /**
   * Fetch transaction with specific API key
   */
  private async fetchWithKey(
    txHash: string,
    apiKey: string,
    signal?: AbortSignal
  ): Promise<CanonicalTxData> {
    const tx = await this.requestProxy<EtherscanProxyTransaction | null>(
      'eth_getTransactionByHash',
      apiKey,
      { txhash: txHash },
      signal
    );

    if (!tx) {
      throw new Error(`Transaction not found: ${txHash}`);
    }

    if (
      typeof tx.hash !== 'string' ||
      typeof tx.value !== 'string' ||
      typeof tx.blockNumber !== 'string'
    ) {
      throw new Error('Malformed Etherscan transaction payload');
    }

    const receipt = await this.requestProxy<EtherscanProxyReceipt | null>(
      'eth_getTransactionReceipt',
      apiKey,
      { txhash: txHash },
      signal
    );

    if (!receipt || typeof receipt.blockNumber !== 'string') {
      throw new Error(`Transaction receipt unavailable: ${txHash}`);
    }

    if (receipt.status?.toLowerCase() === '0x0') {
      const revertedError = new Error(`Transaction reverted: ${txHash}`) as Error & {
        provider?: string;
        code?: string;
        retryable?: boolean;
      };
      revertedError.provider = this.name;
      revertedError.code = 'REVERTED';
      revertedError.retryable = false;
      throw revertedError;
    }

    const currentBlockHex = await this.requestProxy<string>(
      'eth_blockNumber',
      apiKey,
      {},
      signal
    );
    const currentBlockNumber = this.hexToNumber(currentBlockHex, 'block number');

    const block = await this.requestProxy<EtherscanProxyBlock | null>(
      'eth_getBlockByNumber',
      apiKey,
      { tag: tx.blockNumber, boolean: 'false' },
      signal
    );

    if (!block || typeof block.timestamp !== 'string') {
      throw new Error(`Block details unavailable for transaction: ${txHash}`);
    }

    return this.normalize({
      txHash: tx.hash,
      valueAtomic: this.resolveValueAtomic(txHash, tx.value, receipt.logs),
      blockNumberHex: tx.blockNumber,
      timestampHex: block.timestamp,
      currentBlockNumber,
    });
  }

  private resolveValueAtomic(
    txHash: string,
    nativeValueHex: string,
    logs: EtherscanProxyReceiptLog[] | undefined
  ): string {
    if (this.ethereumAsset === 'native') {
      return this.hexToBigInt(nativeValueHex, 'transaction value').toString();
    }

    const usdcValue = this.extractUsdcValueAtomic(logs);
    if (usdcValue <= BigInt(0)) {
      throw new Error(`USDC transfer not found in transaction: ${txHash}`);
    }

    return usdcValue.toString();
  }

  private extractUsdcValueAtomic(logs: EtherscanProxyReceiptLog[] | undefined): bigint {
    if (!Array.isArray(logs) || logs.length === 0) {
      return BigInt(0);
    }

    const expectedTopic = ERC20_TRANSFER_TOPIC0;

    return logs.reduce((total, log) => {
      const logAddress = (log.address ?? '').toLowerCase();
      const firstTopic = (log.topics?.[0] ?? '').toLowerCase();
      const valueData = log.data ?? '';

      if (logAddress !== USDC_CONTRACT_ADDRESS) {
        return total;
      }

      if (firstTopic !== expectedTopic) {
        return total;
      }

      if (!HEX_QUANTITY_REGEX.test(valueData)) {
        return total;
      }

      try {
        return total + BigInt(valueData);
      } catch (error) {
        if (error instanceof RangeError || error instanceof SyntaxError) {
          return total;
        }
        throw error;
      }
    }, BigInt(0));
  }

  /**
   * Perform a single Etherscan proxy request with strict response handling.
   */
  private async requestProxy<T>(
    action: string,
    apiKey: string,
    params: Record<string, string>,
    signal?: AbortSignal
  ): Promise<T> {
    const url = new URL(this.baseUrl);
    url.searchParams.set('chainid', ETHEREUM_CHAIN_ID);
    url.searchParams.set('module', 'proxy');
    url.searchParams.set('action', action);

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    url.searchParams.set('apikey', apiKey);

    const urlValue = url.toString();
    const urlValidation = validateUrl(urlValue);
    if (!urlValidation.valid) {
      throw new Error(`Blocked provider URL: ${urlValidation.error ?? 'invalid URL'}`);
    }

    await waitForProviderThrottleSlot(
      this.throttlePolicy.scope,
      this.throttlePolicy.requestThrottleMs
    );

    const response = await fetch(urlValue, {
      method: 'GET',
      signal: signal ?? null,
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error(`Rate limit exceeded (${action})`);
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('Invalid JSON response from Etherscan');
      }
      throw error;
    }

    if (!data || typeof data !== 'object') {
      throw new Error('Malformed Etherscan response');
    }

    const payload = data as EtherscanProxyResponse<T>;
    const statusMessage = typeof payload.message === 'string' ? payload.message : 'Unknown error';
    const statusResult =
      typeof payload.result === 'string' ? payload.result : '';
    const normalizedStatusMessage = statusMessage.toLowerCase();
    const normalizedStatusResult = statusResult.toLowerCase();
    const normalizedStatusSummary = `${normalizedStatusMessage} ${normalizedStatusResult}`;

    if (payload.status === '0') {
      if (
        normalizedStatusSummary.includes('rate limit') ||
        normalizedStatusSummary.includes('too many requests')
      ) {
        throw new Error(`Rate limit exceeded (${action})`);
      }

      const detail = statusResult ? `${statusMessage}: ${statusResult}` : statusMessage;
      throw new Error(`Etherscan error: ${detail}`);
    }

    if (payload.error && typeof payload.error === 'object') {
      const rpcMessage =
        typeof payload.error.message === 'string'
          ? payload.error.message
          : 'Unknown RPC error';
      if (rpcMessage.toLowerCase().includes('rate limit')) {
        throw new Error(`Rate limit exceeded (${action})`);
      }
      throw new Error(`Etherscan RPC error: ${rpcMessage}`);
    }

    if (!('result' in payload)) {
      throw new Error('Malformed Etherscan response: missing result');
    }

    return payload.result as T;
  }

  private hexToBigInt(value: string, fieldName: string): bigint {
    if (!HEX_QUANTITY_REGEX.test(value)) {
      throw new Error(`Malformed ${fieldName} value from Etherscan`);
    }

    try {
      return BigInt(value);
    } catch (error) {
      if (error instanceof RangeError || error instanceof SyntaxError || error instanceof TypeError) {
        throw new Error(`Invalid ${fieldName} value from Etherscan`);
      }
      throw error;
    }
  }

  private hexToNumber(value: string, fieldName: string): number {
    const asBigInt = this.hexToBigInt(value, fieldName);
    if (asBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error(`${fieldName} exceeds safe integer range`);
    }
    return Number(asBigInt);
  }

  /**
   * Normalize Etherscan proxy response to canonical format
   */
  private normalize(data: {
    txHash: string;
    valueAtomic: string;
    blockNumberHex: string;
    timestampHex: string;
    currentBlockNumber: number;
  }): CanonicalTxData {
    const blockNumber = this.hexToNumber(data.blockNumberHex, 'transaction block number');
    const timestampUnix = this.hexToNumber(data.timestampHex, 'block timestamp');
    const confirmations = Math.max(data.currentBlockNumber - blockNumber + 1, 1);

    return {
      chain: 'ethereum',
      txHash: data.txHash,
      valueAtomic: data.valueAtomic,
      timestampUnix,
      confirmations,
      blockNumber,
    };
  }

  async isHealthy(): Promise<boolean> {
    try {
      const apiKey = this.keyCascade.keys[0];
      if (!apiKey) {
        return false;
      }

      const blockNumberHex = await this.requestProxy<string>(
        'eth_blockNumber',
        apiKey,
        {}
      );

      return HEX_QUANTITY_REGEX.test(blockNumberHex);
    } catch (error) {
      secureError(`[${this.name}] Health check failed:`, error);
      return false;
    }
  }
}
