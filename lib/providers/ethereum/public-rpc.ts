import type { EthereumProvider, ProviderConfig } from '@ghostreceipt/backend-core/providers/types';
import type { CanonicalTxData, EthereumAsset } from '@/lib/validation/schemas';
import { EthereumTxHashSchema } from '@/lib/validation/schemas';
import { validateUrl } from '@/lib/security/ssrf';
import { secureError } from '@/lib/security/secure-logging';
import { waitForProviderThrottleSlot } from '@/lib/libraries/backend-core/providers/provider-throttle';
import {
  DEFAULT_ETHEREUM_PUBLIC_RPC_ENDPOINT_NAMES,
  DEFAULT_ETHEREUM_USDC_PUBLIC_RPC_ENDPOINT_NAMES,
  ETHEREUM_PUBLIC_RPC_ENDPOINT_ENV_KEYS,
  ETHEREUM_PUBLIC_RPC_ENDPOINTS,
  resolveRequiredEndpointUrlsFromNames,
} from '@/lib/config/public-rpc-endpoints';

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
  logs?: RpcReceiptLog[];
}

interface RpcBlock {
  timestamp?: string;
  hash?: string;
}

interface RpcReceiptLog {
  address?: string;
  data?: string;
  topics?: string[];
}

const HEX_QUANTITY_REGEX = /^0x[0-9a-f]+$/i;
const DEFAULT_ETH_PUBLIC_RPC_THROTTLE_MS = 900;
const DEFAULT_ETH_PUBLIC_RPC_ENDPOINT_RETRIES = 1;
const DEFAULT_ETH_PUBLIC_RPC_ENDPOINT_RETRY_DELAY_MS = 250;
const RPC_SCOPE = 'provider:ethereum-public-rpc';
const USDC_CONTRACT_ADDRESS = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const ERC20_TRANSFER_TOPIC0 = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

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
  private readonly endpointUrls: string[];
  private readonly endpointRetryDelayMs: number;
  private readonly endpointRetries: number;
  private readonly throttleMs: number;

  constructor(ethereumAsset: EthereumAsset = 'native') {
    this.ethereumAsset = ethereumAsset;
    this.endpointUrls = this.resolveEndpointUrls();
    this.assertConfiguredEndpointUrls(this.endpointUrls, 'resolved Ethereum public RPC endpoint list');
    this.throttleMs = parseNonNegativeIntEnv(
      'ETHEREUM_PUBLIC_RPC_REQUEST_THROTTLE_MS',
      DEFAULT_ETH_PUBLIC_RPC_THROTTLE_MS
    );
    this.endpointRetries = parseNonNegativeIntEnv(
      'ETHEREUM_PUBLIC_RPC_ENDPOINT_RETRIES',
      DEFAULT_ETH_PUBLIC_RPC_ENDPOINT_RETRIES
    );
    this.endpointRetryDelayMs = parseNonNegativeIntEnv(
      'ETHEREUM_PUBLIC_RPC_ENDPOINT_RETRY_DELAY_MS',
      DEFAULT_ETH_PUBLIC_RPC_ENDPOINT_RETRY_DELAY_MS
    );
  }

  async fetchTransaction(txHash: string, signal?: AbortSignal): Promise<CanonicalTxData> {
    const validationResult = EthereumTxHashSchema.safeParse(txHash);
    if (!validationResult.success) {
      throw new Error(`Invalid Ethereum transaction hash: ${txHash}`);
    }

    const tx = await this.requestRpc<RpcTransaction | null>(
      'eth_getTransactionByHash',
      [txHash],
      signal,
      {
        isResultUsable: (result) => result !== null && typeof result.hash === 'string',
        unusableResultMessage: 'transaction not found on endpoint',
      }
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
      signal,
      {
        isResultUsable: (result) => result !== null && typeof result.blockNumber === 'string',
        unusableResultMessage: 'transaction receipt unavailable on endpoint',
      }
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
      signal,
      {
        isResultUsable: (result) => result !== null && typeof result.timestamp === 'string',
        unusableResultMessage: 'block details unavailable on endpoint',
      }
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
      valueAtomic: this.resolveValueAtomic(txHash, tx.value, receipt.logs),
      timestampUnix,
      confirmations,
      blockNumber,
      ...(typeof block.hash === 'string' && block.hash.length > 0 ? { blockHash: block.hash } : {}),
    };
  }

  private resolveValueAtomic(
    txHash: string,
    nativeValueHex: string,
    logs: RpcReceiptLog[] | undefined
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

  private extractUsdcValueAtomic(logs: RpcReceiptLog[] | undefined): bigint {
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

  private async requestRpc<T>(
    method: string,
    params: unknown[],
    signal?: AbortSignal,
    options: {
      isResultUsable?: (result: T) => boolean;
      unusableResultMessage?: string;
    } = {}
  ): Promise<T> {
    const endpointFailures: string[] = [];
    const unusableResults: string[] = [];

    for (const endpointUrl of this.endpointUrls) {
      try {
        const result = await this.requestRpcOnEndpointWithRetries<T>(
          endpointUrl,
          method,
          params,
          signal
        );
        if (options.isResultUsable && !options.isResultUsable(result)) {
          unusableResults.push(
            `${endpointUrl} -> ${options.unusableResultMessage ?? 'unusable RPC result'}`
          );
          continue;
        }
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        endpointFailures.push(`${endpointUrl} -> ${message}`);
      }
    }

    const errors = [...endpointFailures, ...unusableResults];
    if (errors.length === 0) {
      throw new Error('Ethereum public RPC endpoints failed: no endpoints configured');
    }

    throw new Error(`Ethereum public RPC endpoints failed: ${errors.join(' | ')}`);
  }

  private async requestRpcOnEndpointWithRetries<T>(
    endpointUrl: string,
    method: string,
    params: unknown[],
    signal?: AbortSignal
  ): Promise<T> {
    let attempt = 0;

    while (true) {
      try {
        return await this.requestRpcOnEndpoint<T>(endpointUrl, method, params, signal);
      } catch (error) {
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        if (
          attempt >= this.endpointRetries ||
          !this.isRetryableEndpointError(normalizedError)
        ) {
          throw normalizedError;
        }

        attempt += 1;
        await this.waitBeforeRetry(this.endpointRetryDelayMs * attempt, signal);
      }
    }
  }

  private async requestRpcOnEndpoint<T>(
    endpointUrl: string,
    method: string,
    params: unknown[],
    signal?: AbortSignal
  ): Promise<T> {
    const urlValidation = validateUrl(endpointUrl);
    if (!urlValidation.valid) {
      throw new Error(`Blocked provider URL: ${urlValidation.error ?? 'invalid URL'}`);
    }

    await waitForProviderThrottleSlot(`${RPC_SCOPE}:${endpointUrl}`, this.throttleMs);

    const response = await fetch(endpointUrl, {
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
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('Invalid JSON response from Ethereum public RPC');
      }
      throw error;
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

  private isRetryableEndpointError(error: Error): boolean {
    const normalizedMessage = error.message.toLowerCase();
    return (
      normalizedMessage.includes('rate limit') ||
      normalizedMessage.includes('too many requests') ||
      normalizedMessage.includes('failed to fetch') ||
      normalizedMessage.includes('network') ||
      normalizedMessage.includes('timeout') ||
      normalizedMessage.startsWith('http 5')
    );
  }

  private async waitBeforeRetry(ms: number, signal?: AbortSignal): Promise<void> {
    if (ms <= 0) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      let settled = false;

      const finish = (callback: () => void) => {
        if (settled) {
          return;
        }
        settled = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (signal) {
          signal.removeEventListener('abort', onAbort);
        }
        callback();
      };

      const onAbort = () => finish(() => reject(new Error('Request aborted')));
      const timeoutId = setTimeout(() => finish(resolve), ms);

      if (!signal) {
        return;
      }

      if (signal.aborted) {
        onAbort();
        return;
      }

      signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  private resolveEndpointUrls(): string[] {
    const usdcNumbered =
      this.ethereumAsset === 'usdc'
        ? this.parseNumberedEnvValues('ETHEREUM_USDC_PUBLIC_RPC_URL_')
        : [];
    const sharedNumbered = this.parseNumberedEnvValues('ETHEREUM_PUBLIC_RPC_URL_');
    const usdcPreferred = this.ethereumAsset === 'usdc'
      ? this.parseEndpointListEnv('ETHEREUM_USDC_PUBLIC_RPC_URLS')
      : [];
    const sharedList = this.parseEndpointListEnv('ETHEREUM_PUBLIC_RPC_URLS');

    const directConfiguredUrls = [
      ...usdcNumbered,
      ...usdcPreferred,
      ...sharedNumbered,
      ...sharedList,
    ].map((value) => value.trim()).filter((value) => value.length > 0);

    if (directConfiguredUrls.length > 0) {
      const deduped = Array.from(new Set(directConfiguredUrls));
      this.assertConfiguredEndpointUrls(
        deduped,
        this.ethereumAsset === 'usdc'
          ? 'ETHEREUM_USDC_PUBLIC_RPC_URL/URLS (+ shared ETHEREUM_PUBLIC_RPC_URL/URLS)'
          : 'ETHEREUM_PUBLIC_RPC_URL/URLS'
      );
      return deduped;
    }

    const configuredNames = [
      ...(this.ethereumAsset === 'usdc'
        ? this.parseNumberedEnvValues('ETHEREUM_USDC_PUBLIC_RPC_NAME_')
        : []),
      ...(this.ethereumAsset === 'usdc'
        ? this.parseEndpointListEnv('ETHEREUM_USDC_PUBLIC_RPC_NAMES')
        : []),
      (this.ethereumAsset === 'usdc'
        ? process.env['ETHEREUM_USDC_PUBLIC_RPC_NAME']?.trim() ?? ''
        : ''),
      ...this.parseNumberedEnvValues('ETHEREUM_PUBLIC_RPC_NAME_'),
      ...this.parseEndpointListEnv('ETHEREUM_PUBLIC_RPC_NAMES'),
      process.env['ETHEREUM_PUBLIC_RPC_NAME']?.trim() ?? '',
    ].map((value) => value.trim()).filter((value) => value.length > 0);

    if (configuredNames.length > 0) {
      return resolveRequiredEndpointUrlsFromNames(
        ETHEREUM_PUBLIC_RPC_ENDPOINTS,
        configuredNames,
        this.ethereumAsset === 'usdc'
          ? 'ETHEREUM_USDC_PUBLIC_RPC_NAME/NAMES (+ shared ETHEREUM_PUBLIC_RPC_NAME/NAMES)'
          : 'ETHEREUM_PUBLIC_RPC_NAME/NAMES',
        ETHEREUM_PUBLIC_RPC_ENDPOINT_ENV_KEYS
      );
    }

    const usdcSingle =
      this.ethereumAsset === 'usdc' ? process.env['ETHEREUM_USDC_PUBLIC_RPC_URL']?.trim() ?? '' : '';
    if (usdcSingle.length > 0) {
      const deduped = Array.from(new Set([usdcSingle]));
      this.assertConfiguredEndpointUrls(deduped, 'ETHEREUM_USDC_PUBLIC_RPC_URL');
      return deduped;
    }

    const sharedSingle = process.env['ETHEREUM_PUBLIC_RPC_URL']?.trim() ?? '';
    if (sharedSingle.length > 0) {
      const deduped = Array.from(new Set([sharedSingle]));
      this.assertConfiguredEndpointUrls(deduped, 'ETHEREUM_PUBLIC_RPC_URL');
      return deduped;
    }

    return resolveRequiredEndpointUrlsFromNames(
      ETHEREUM_PUBLIC_RPC_ENDPOINTS,
      this.ethereumAsset === 'usdc'
        ? DEFAULT_ETHEREUM_USDC_PUBLIC_RPC_ENDPOINT_NAMES
        : DEFAULT_ETHEREUM_PUBLIC_RPC_ENDPOINT_NAMES,
      this.ethereumAsset === 'usdc'
        ? 'DEFAULT_ETHEREUM_USDC_PUBLIC_RPC_ENDPOINT_NAMES'
        : 'DEFAULT_ETHEREUM_PUBLIC_RPC_ENDPOINT_NAMES',
      ETHEREUM_PUBLIC_RPC_ENDPOINT_ENV_KEYS
    );
  }

  private assertConfiguredEndpointUrls(endpointUrls: string[], configSource: string): void {
    if (endpointUrls.length === 0) {
      throw new Error(`[Config] Missing Ethereum public RPC endpoints from ${configSource}.`);
    }

    for (const endpointUrl of endpointUrls) {
      const urlValidation = validateUrl(endpointUrl);
      if (!urlValidation.valid) {
        throw new Error(
          `[Config] Invalid Ethereum public RPC URL in ${configSource}: ${endpointUrl} (${urlValidation.error ?? 'invalid URL'})`
        );
      }
    }
  }

  private parseEndpointListEnv(envKey: string): string[] {
    const raw = process.env[envKey]?.trim() ?? '';
    if (!raw) {
      return [];
    }

    return raw
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }

  private parseNumberedEnvValues(prefix: string): string[] {
    return Object.keys(process.env)
      .map((key) => {
        if (!key.startsWith(prefix)) {
          return null;
        }

        const suffix = key.slice(prefix.length);
        if (!/^[1-9][0-9]*$/.test(suffix)) {
          return null;
        }

        return {
          key,
          index: Number.parseInt(suffix, 10),
        };
      })
      .filter((value): value is { key: string; index: number } => value !== null)
      .sort((a, b) => a.index - b.index)
      .map((entry) => process.env[entry.key]?.trim() ?? '')
      .filter((value) => value.length > 0);
  }

  private hexToBigInt(value: string, fieldName: string): bigint {
    if (!HEX_QUANTITY_REGEX.test(value)) {
      throw new Error(`Malformed ${fieldName} value from Ethereum public RPC`);
    }

    try {
      return BigInt(value);
    } catch (error) {
      if (error instanceof RangeError || error instanceof SyntaxError || error instanceof TypeError) {
        throw new Error(`Invalid ${fieldName} value from Ethereum public RPC`);
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
