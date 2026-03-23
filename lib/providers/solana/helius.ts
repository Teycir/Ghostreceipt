import type { ApiKeyConfig, ProviderConfig, SolanaProvider } from '../types';
import type { CanonicalTxData } from '@/lib/validation/schemas';
import { SolanaTxHashSchema } from '@/lib/validation/schemas';
import { validateUrl } from '@/lib/security/ssrf';
import { secureError, secureWarn } from '@/lib/security/secure-logging';
import { ApiKeyCascade } from '@/lib/libraries/backend-core/providers/api-key-cascade';

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

interface HeliusTransactionResult {
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

const HELIUS_RPC_BASE_URL = 'https://mainnet.helius-rpc.com/';

export class HeliusProvider implements SolanaProvider {
  readonly name = 'helius';
  readonly chain = 'solana' as const;
  readonly config: ProviderConfig = {
    name: 'helius',
    priority: 1,
    requiresApiKey: true,
    rateLimit: {
      requestsPerSecond: 10,
      requestsPerDay: 100000,
    },
  };

  private readonly keyCascade: ApiKeyCascade;

  constructor(apiKeyConfig: ApiKeyConfig) {
    this.keyCascade = new ApiKeyCascade(apiKeyConfig);
  }

  async fetchTransaction(txHash: string, signal?: AbortSignal): Promise<CanonicalTxData> {
    const validationResult = SolanaTxHashSchema.safeParse(txHash);
    if (!validationResult.success) {
      throw new Error(`Invalid Solana transaction signature: ${txHash}`);
    }

    if (this.keyCascade.size === 0) {
      throw new Error('No Helius API keys configured');
    }

    try {
      return await this.keyCascade.execute(
        async (apiKey) => this.fetchWithKey(txHash, apiKey, signal),
        {
          isNonRetryableError: (error) => {
            const normalizedMessage = error.message.toLowerCase();
            return (
              normalizedMessage.includes('transaction not found') ||
              normalizedMessage.includes('invalid solana transaction signature') ||
              normalizedMessage.includes('unsupported solana transaction')
            );
          },
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
        const causeMessage =
          normalizedError.cause instanceof Error
            ? normalizedError.cause.message
            : normalizedError.message;
        throw new Error(`All Helius API keys exhausted. Last error: ${causeMessage}`, {
          cause: normalizedError.cause instanceof Error ? normalizedError.cause : normalizedError,
        });
      }
      throw normalizedError;
    }
  }

  private async fetchWithKey(
    txHash: string,
    apiKey: string,
    signal?: AbortSignal
  ): Promise<CanonicalTxData> {
    const txResult = await this.requestRpc<HeliusTransactionResult | null>(
      apiKey,
      'getTransaction',
      [
        txHash,
        {
          commitment: 'confirmed',
          encoding: 'jsonParsed',
          maxSupportedTransactionVersion: 0,
        },
      ],
      signal
    );

    if (!txResult) {
      throw new Error(`Transaction not found: ${txHash}`);
    }

    const confirmations = await this.fetchConfirmations(txHash, apiKey, signal);
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
    apiKey: string,
    signal?: AbortSignal
  ): Promise<number> {
    const statusResult = await this.requestRpc<SignatureStatusesResult>(
      apiKey,
      'getSignatureStatuses',
      [[txHash], { searchTransactionHistory: true }],
      signal
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

  private extractNativeTransferLamports(txResult: HeliusTransactionResult): string {
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
    apiKey: string,
    method: string,
    params: unknown[],
    signal?: AbortSignal
  ): Promise<T> {
    const endpoint = new URL(HELIUS_RPC_BASE_URL);
    endpoint.searchParams.set('api-key', apiKey);

    const endpointString = endpoint.toString();
    const urlValidation = validateUrl(endpointString);
    if (!urlValidation.valid) {
      throw new Error(`Blocked provider URL: ${urlValidation.error ?? 'invalid URL'}`);
    }

    const response = await fetch(endpointString, {
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
      throw new Error('Invalid JSON response from Helius');
    }

    if (payload.error && typeof payload.error === 'object') {
      const errorMessage =
        typeof payload.error.message === 'string' ? payload.error.message : 'Unknown RPC error';
      if (errorMessage.toLowerCase().includes('rate limit')) {
        throw new Error('Rate limit exceeded');
      }
      throw new Error(`Helius RPC error: ${errorMessage}`);
    }

    if (!Object.prototype.hasOwnProperty.call(payload, 'result')) {
      throw new Error('Malformed Helius RPC response');
    }

    return payload.result as T;
  }

  async isHealthy(): Promise<boolean> {
    try {
      const primaryKey = this.keyCascade.keys[0];
      if (!primaryKey) {
        return false;
      }

      await this.requestRpc<string>(
        primaryKey,
        'getHealth',
        []
      );
      return true;
    } catch (error) {
      secureError(`[${this.name}] Health check failed:`, error);
      return false;
    }
  }
}
