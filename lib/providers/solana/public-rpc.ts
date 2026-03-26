import type { ProviderConfig, SolanaProvider } from '@ghostreceipt/backend-core/providers/types';
import type { CanonicalTxData } from '@/lib/validation/schemas';
import { SolanaTxHashSchema } from '@/lib/validation/schemas';
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

const DEFAULT_SOLANA_PUBLIC_RPC_URLS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-rpc.publicnode.com',
];
const DEFAULT_SOLANA_PUBLIC_RPC_THROTTLE_MS = 500;
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
  private readonly throttleMs: number;

  constructor() {
    this.endpointUrls = this.resolveEndpointUrls();
    this.throttleMs = parseNonNegativeIntEnv(
      'SOLANA_PUBLIC_RPC_REQUEST_THROTTLE_MS',
      DEFAULT_SOLANA_PUBLIC_RPC_THROTTLE_MS
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
      signal
    );

    if (!txResult) {
      throw new Error(`Transaction not found: ${txHash}`);
    }

    const confirmations = await this.fetchConfirmations(txHash, signal);
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
    signal?: AbortSignal
  ): Promise<T> {
    const errors: string[] = [];

    for (const endpointUrl of this.endpointUrls) {
      try {
        return await this.requestRpcOnEndpoint(endpointUrl, method, params, signal);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${endpointUrl} -> ${message}`);
      }
    }

    throw new Error(`Solana public RPC endpoints failed: ${errors.join(' | ')}`);
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
    const listFromEnv = this.parseEndpointListEnv('SOLANA_PUBLIC_RPC_URLS');
    const singleFromEnv = process.env['SOLANA_PUBLIC_RPC_URL']?.trim() ?? '';

    return Array.from(
      new Set([
        ...listFromEnv,
        singleFromEnv,
        ...DEFAULT_SOLANA_PUBLIC_RPC_URLS,
      ].map((value) => value.trim()).filter((value) => value.length > 0))
    );
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
