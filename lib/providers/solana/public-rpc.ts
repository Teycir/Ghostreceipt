import type { ProviderConfig, SolanaProvider } from '@ghostreceipt/backend-core/providers/types';
import type { CanonicalTxData } from '@/lib/validation/schemas';
import { SolanaTxHashSchema } from '@/lib/validation/schemas';
import { validateUrl } from '@/lib/security/ssrf';
import { secureError } from '@/lib/security/secure-logging';
import { waitForProviderThrottleSlot } from '@/lib/libraries/backend-core/providers/provider-throttle';
import {
  DEFAULT_SOLANA_PUBLIC_RPC_ENDPOINT_NAMES,
  SOLANA_PUBLIC_RPC_ENDPOINT_ENV_KEYS,
  SOLANA_PUBLIC_RPC_ENDPOINTS,
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

interface SolanaInstruction {
  program?: string;
  parsed?: {
    type?: string;
    info?: {
      lamports?: number | string;
    };
  };
}

interface SolanaTransactionResult {
  slot?: number;
  blockTime?: number | null;
  transaction?: {
    signatures?: string[];
    message?: {
      recentBlockhash?: string;
      instructions?: SolanaInstruction[];
    };
  };
  meta?: {
    innerInstructions?: Array<{
      instructions?: SolanaInstruction[];
    }>;
  };
}

interface SignatureStatusValue {
  confirmations?: number | null;
  confirmationStatus?: 'processed' | 'confirmed' | 'finalized' | string | null;
}

interface SignatureStatusesResult {
  value?: Array<SignatureStatusValue | null>;
}

const DEFAULT_SOLANA_PUBLIC_RPC_THROTTLE_MS = 500;
const DEFAULT_SOLANA_PUBLIC_RPC_ENDPOINT_RETRIES = 2;
const DEFAULT_SOLANA_PUBLIC_RPC_ENDPOINT_RETRY_DELAY_MS = 250;
const DEFAULT_SOLANA_PUBLIC_RPC_PASS_RETRIES = 2;
const DEFAULT_SOLANA_PUBLIC_RPC_PASS_RETRY_DELAY_MS = 800;
const RPC_SCOPE = 'provider:solana-public-rpc';

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

export class SolanaPublicRpcProvider implements SolanaProvider {
  readonly name = 'solana-public-rpc';
  readonly chain = 'solana' as const;
  readonly config: ProviderConfig = {
    name: 'solana-public-rpc',
    priority: 2,
    requiresApiKey: false,
    rateLimit: {
      requestsPerSecond: 2,
      requestsPerDay: 172800,
    },
  };

  private readonly endpointUrls: string[];
  private readonly endpointPassRetries: number;
  private readonly endpointPassRetryDelayMs: number;
  private readonly endpointRetryDelayMs: number;
  private readonly endpointRetries: number;
  private readonly throttleMs: number;

  constructor() {
    this.endpointUrls = this.resolveEndpointUrls();
    this.assertConfiguredEndpointUrls(this.endpointUrls, 'resolved Solana public RPC endpoint list');
    this.throttleMs = parseNonNegativeIntEnv(
      'SOLANA_PUBLIC_RPC_REQUEST_THROTTLE_MS',
      DEFAULT_SOLANA_PUBLIC_RPC_THROTTLE_MS
    );
    this.endpointRetries = parseNonNegativeIntEnv(
      'SOLANA_PUBLIC_RPC_ENDPOINT_RETRIES',
      DEFAULT_SOLANA_PUBLIC_RPC_ENDPOINT_RETRIES
    );
    this.endpointRetryDelayMs = parseNonNegativeIntEnv(
      'SOLANA_PUBLIC_RPC_ENDPOINT_RETRY_DELAY_MS',
      DEFAULT_SOLANA_PUBLIC_RPC_ENDPOINT_RETRY_DELAY_MS
    );
    this.endpointPassRetries = parseNonNegativeIntEnv(
      'SOLANA_PUBLIC_RPC_ENDPOINT_PASS_RETRIES',
      DEFAULT_SOLANA_PUBLIC_RPC_PASS_RETRIES
    );
    this.endpointPassRetryDelayMs = parseNonNegativeIntEnv(
      'SOLANA_PUBLIC_RPC_ENDPOINT_PASS_RETRY_DELAY_MS',
      DEFAULT_SOLANA_PUBLIC_RPC_PASS_RETRY_DELAY_MS
    );
  }

  async fetchTransaction(txHash: string, signal?: AbortSignal): Promise<CanonicalTxData> {
    const validationResult = SolanaTxHashSchema.safeParse(txHash);
    if (!validationResult.success) {
      throw new Error(`Invalid Solana transaction signature: ${txHash}`);
    }

    const txResult = await this.requestRpc<SolanaTransactionResult | null>(
      'getTransaction',
      [
        txHash,
        {
          commitment: 'confirmed',
          encoding: 'jsonParsed',
          maxSupportedTransactionVersion: 0,
        },
      ],
      signal,
      {
        isResultUsable: (result) => result !== null,
        unusableResultMessage: 'transaction not found on endpoint',
      }
    );

    if (!txResult) {
      throw new Error(`Transaction not found: ${txHash}`);
    }

    let confirmations = 0;
    try {
      confirmations = await this.fetchConfirmations(txHash, signal);
    } catch (error) {
      // Confirmation depth should not invalidate an otherwise canonical tx fetch.
      secureError(`[${this.name}] Confirmation lookup failed; defaulting to 0`, error);
    }
    const valueAtomic = this.extractNativeTransferLamports(txResult);
    const timestampUnix =
      typeof txResult.blockTime === 'number' && txResult.blockTime > 0
        ? Math.floor(txResult.blockTime)
        : Math.floor(Date.now() / 1000);

    const canonical: CanonicalTxData = {
      chain: 'solana',
      txHash,
      valueAtomic,
      timestampUnix,
      confirmations,
    };

    if (typeof txResult.slot === 'number' && Number.isFinite(txResult.slot) && txResult.slot > 0) {
      canonical.blockNumber = Math.floor(txResult.slot);
    }

    const recentBlockhash = txResult.transaction?.message?.recentBlockhash;
    if (typeof recentBlockhash === 'string' && recentBlockhash.length > 0) {
      canonical.blockHash = recentBlockhash;
    }

    return canonical;
  }

  private async fetchConfirmations(
    txHash: string,
    signal?: AbortSignal
  ): Promise<number> {
    const statusResult = await this.requestRpc<SignatureStatusesResult>(
      'getSignatureStatuses',
      [[txHash], { searchTransactionHistory: true }],
      signal,
      {
        isResultUsable: (result) => {
          const firstStatus = result.value?.[0];
          return firstStatus !== null && firstStatus !== undefined;
        },
        unusableResultMessage: 'signature status unavailable on endpoint',
      }
    );

    const status = statusResult.value?.[0];
    if (!status) {
      return 0;
    }

    if (
      typeof status.confirmations === 'number' &&
      Number.isFinite(status.confirmations) &&
      status.confirmations >= 0
    ) {
      return Math.floor(status.confirmations);
    }

    if (status.confirmationStatus === 'finalized') {
      return 32;
    }

    if (status.confirmationStatus === 'confirmed') {
      return 1;
    }

    return 0;
  }

  private extractNativeTransferLamports(txResult: SolanaTransactionResult): string {
    let totalLamports = 0n;
    const topLevel = txResult.transaction?.message?.instructions ?? [];
    const inner = txResult.meta?.innerInstructions ?? [];
    const allInstructions: SolanaInstruction[] = [...topLevel];

    for (const group of inner) {
      if (group.instructions) {
        allInstructions.push(...group.instructions);
      }
    }

    for (const instruction of allInstructions) {
      if (instruction.program !== 'system') {
        continue;
      }

      if (instruction.parsed?.type !== 'transfer') {
        continue;
      }

      const lamportsRaw = instruction.parsed.info?.lamports;
      if (typeof lamportsRaw === 'number' && Number.isFinite(lamportsRaw) && lamportsRaw > 0) {
        totalLamports += BigInt(Math.floor(lamportsRaw));
        continue;
      }

      if (typeof lamportsRaw === 'string' && /^[0-9]+$/.test(lamportsRaw)) {
        totalLamports += BigInt(lamportsRaw);
      }
    }

    if (totalLamports <= 0n) {
      throw new Error('Unsupported Solana transaction: no native SOL transfer found');
    }

    return totalLamports.toString();
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
    let passEndpoints = [...this.endpointUrls];
    const allPassErrors: string[] = [];

    for (let pass = 0; pass <= this.endpointPassRetries; pass += 1) {
      if (passEndpoints.length === 0) {
        break;
      }

      const passErrors: string[] = [];
      const retryableEndpoints = new Set<string>();
      const unusableResults: string[] = [];

      for (const endpointUrl of passEndpoints) {
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
          const normalizedError = error instanceof Error ? error : new Error(String(error));
          passErrors.push(`${endpointUrl} -> ${normalizedError.message}`);
          if (this.isRetryableEndpointError(normalizedError)) {
            retryableEndpoints.add(endpointUrl);
          }
        }
      }

      allPassErrors.push(...passErrors, ...unusableResults);

      if (pass >= this.endpointPassRetries || retryableEndpoints.size === 0) {
        break;
      }

      passEndpoints = Array.from(retryableEndpoints);
      await this.waitBeforeRetry(this.endpointPassRetryDelayMs * (pass + 1), signal);
    }

    if (allPassErrors.length === 0) {
      throw new Error('Solana public RPC endpoints failed: no endpoints configured');
    }

    throw new Error(`Solana public RPC endpoints failed: ${allPassErrors.join(' | ')}`);
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
        throw new Error('Invalid JSON response from Solana public RPC');
      }
      throw error;
    }

    if (payload.error && typeof payload.error === 'object') {
      const errorMessage =
        typeof payload.error.message === 'string' ? payload.error.message : 'Unknown RPC error';
      if (errorMessage.toLowerCase().includes('rate limit')) {
        throw new Error('Rate limit exceeded');
      }
      throw new Error(`Solana public RPC error: ${errorMessage}`);
    }

    if (!Object.prototype.hasOwnProperty.call(payload, 'result')) {
      throw new Error('Malformed Solana public RPC response');
    }

    return payload.result as T;
  }

  private resolveEndpointUrls(): string[] {
    const numberedFromEnv = this.parseNumberedEnvValues('SOLANA_PUBLIC_RPC_URL_');
    const listFromEnv = this.parseEndpointListEnv('SOLANA_PUBLIC_RPC_URLS');
    const directConfiguredUrls = [
      ...numberedFromEnv,
      ...listFromEnv,
    ].map((value) => value.trim()).filter((value) => value.length > 0);

    if (directConfiguredUrls.length > 0) {
      const deduped = Array.from(new Set(directConfiguredUrls));
      this.assertConfiguredEndpointUrls(deduped, 'SOLANA_PUBLIC_RPC_URL/URLS');
      return deduped;
    }

    const configuredNames = [
      ...this.parseNumberedEnvValues('SOLANA_PUBLIC_RPC_NAME_'),
      ...this.parseEndpointListEnv('SOLANA_PUBLIC_RPC_NAMES'),
      process.env['SOLANA_PUBLIC_RPC_NAME']?.trim() ?? '',
    ].map((value) => value.trim()).filter((value) => value.length > 0);

    if (configuredNames.length > 0) {
      return resolveRequiredEndpointUrlsFromNames(
        SOLANA_PUBLIC_RPC_ENDPOINTS,
        configuredNames,
        'SOLANA_PUBLIC_RPC_NAME/NAMES',
        SOLANA_PUBLIC_RPC_ENDPOINT_ENV_KEYS
      );
    }

    const singleFromEnv = process.env['SOLANA_PUBLIC_RPC_URL']?.trim() ?? '';
    if (singleFromEnv.length > 0) {
      const deduped = Array.from(new Set([singleFromEnv]));
      this.assertConfiguredEndpointUrls(deduped, 'SOLANA_PUBLIC_RPC_URL');
      return deduped;
    }

    return resolveRequiredEndpointUrlsFromNames(
      SOLANA_PUBLIC_RPC_ENDPOINTS,
      DEFAULT_SOLANA_PUBLIC_RPC_ENDPOINT_NAMES,
      'DEFAULT_SOLANA_PUBLIC_RPC_ENDPOINT_NAMES',
      SOLANA_PUBLIC_RPC_ENDPOINT_ENV_KEYS
    );
  }

  private assertConfiguredEndpointUrls(endpointUrls: string[], configSource: string): void {
    if (endpointUrls.length === 0) {
      throw new Error(`[Config] Missing Solana public RPC endpoints from ${configSource}.`);
    }

    for (const endpointUrl of endpointUrls) {
      const urlValidation = validateUrl(endpointUrl);
      if (!urlValidation.valid) {
        throw new Error(
          `[Config] Invalid Solana public RPC URL in ${configSource}: ${endpointUrl} (${urlValidation.error ?? 'invalid URL'})`
        );
      }
    }
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

  async isHealthy(): Promise<boolean> {
    try {
      await this.requestRpc<string>('getHealth', []);
      return true;
    } catch (error) {
      secureError(`[${this.name}] Health check failed:`, error);
      return false;
    }
  }
}
