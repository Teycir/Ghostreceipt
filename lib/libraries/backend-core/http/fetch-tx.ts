import {
  CanonicalTxDataSchema,
  type Chain,
  type ErrorResponse,
  type OraclePayloadV1,
} from '@/lib/validation/schemas';
import { MempoolSpaceProvider } from '@/lib/providers/bitcoin/mempool';
import { BlockchairProvider } from '@/lib/providers/bitcoin/blockchair';
import { EtherscanProvider } from '@/lib/providers/ethereum/etherscan';
import { EthereumPublicRpcProvider } from '@/lib/providers/ethereum/public-rpc';
import { HeliusProvider } from '@/lib/providers/solana/helius';
import { computeOracleCommitment } from '@/lib/zk/oracle-commitment';
import { getCachedOracleSignerFromEnv } from '@/lib/libraries/backend/oracle-signer-cache';
import { ProviderCascade } from '../providers/cascade';
import type { CascadeConfig, Provider, ProviderError } from '../providers/types';

export interface FetchTxMappedError {
  code: ErrorResponse['error']['code'];
  message: string;
  status: number;
}

export interface OracleFetchOptions {
  blockchairApiKey?: string;
  cascadeConfig?: CascadeConfig;
  etherscanKeys?: string[];
  heliusKeys?: string[];
  nowMs?: number;
}

export interface SignedOracleFetchResult {
  cached: boolean;
  data: OraclePayloadV1;
  fetchedAt: number;
  provider: string;
}

const DEFAULT_CASCADE_CONFIG: CascadeConfig = {
  maxRetries: 3,
  retryDelayMs: 50,
  timeoutMs: 10000,
  concurrencyLimit: 5,
};

export function mapFetchTxErrorToResponse(error: unknown): FetchTxMappedError {
  const code: ErrorResponse['error']['code'] = 'INTERNAL_ERROR';
  let message = 'Internal server error';
  const status = 500;

  if (!(error instanceof Error)) {
    return { code, message, status };
  }

  message = error.message;
  const normalizedMessage = message.toLowerCase();
  const providerCode = (error as Partial<ProviderError>).code;

  if (providerCode === 'NOT_FOUND') {
    return {
      code: 'TRANSACTION_NOT_FOUND',
      message,
      status: 404,
    };
  }

  if (providerCode === 'TIMEOUT') {
    return {
      code: 'PROVIDER_TIMEOUT',
      message,
      status: 504,
    };
  }

  if (providerCode === 'RATE_LIMIT') {
    return {
      code: 'RATE_LIMIT_EXCEEDED',
      message,
      status: 429,
    };
  }

  if (providerCode === 'REVERTED') {
    return {
      code: 'TRANSACTION_REVERTED',
      message,
      status: 422,
    };
  }

  if (providerCode === 'PROVIDER_ERROR') {
    return {
      code: 'PROVIDER_ERROR',
      message,
      status: 502,
    };
  }

  if (
    normalizedMessage.includes('invalid') &&
    (
      normalizedMessage.includes('transaction hash') ||
      normalizedMessage.includes('transaction signature')
    )
  ) {
    return {
      code: 'INVALID_HASH',
      message,
      status: 400,
    };
  }

  if (normalizedMessage.includes('not found')) {
    return {
      code: 'TRANSACTION_NOT_FOUND',
      message,
      status: 404,
    };
  }

  if (normalizedMessage.includes('timeout')) {
    return {
      code: 'PROVIDER_TIMEOUT',
      message,
      status: 504,
    };
  }

  if (
    normalizedMessage.includes('rate limit') ||
    normalizedMessage.includes('too many requests')
  ) {
    return {
      code: 'RATE_LIMIT_EXCEEDED',
      message,
      status: 429,
    };
  }

  if (normalizedMessage.includes('revert')) {
    return {
      code: 'TRANSACTION_REVERTED',
      message,
      status: 422,
    };
  }

  if (normalizedMessage.includes('provider')) {
    return {
      code: 'PROVIDER_ERROR',
      message,
      status: 502,
    };
  }

  return { code, message, status };
}

export function loadEtherscanKeysFromEnv(
  env: NodeJS.ProcessEnv = process.env
): string[] {
  const candidates = [
    env['ETHERSCAN_API_KEY'],
    env['ETHERSCAN_API_KEY_1'],
    env['ETHERSCAN_API_KEY_2'],
    env['ETHERSCAN_API_KEY_3'],
    env['ETHERSCAN_API_KEY_4'],
    env['ETHERSCAN_API_KEY_5'],
    env['ETHERSCAN_API_KEY_6'],
  ]
    .map((value) => value?.trim() ?? '')
    .filter((value) => value.length > 0);

  return Array.from(new Set(candidates));
}

export function loadHeliusKeysFromEnv(
  env: NodeJS.ProcessEnv = process.env
): string[] {
  const candidates = [
    env['HELIUS_API_KEY'],
    env['HELIUS_API_KEY_1'],
    env['HELIUS_API_KEY_2'],
    env['HELIUS_API_KEY_3'],
    env['HELIUS_API_KEY_4'],
    env['HELIUS_API_KEY_5'],
    env['HELIUS_API_KEY_6'],
  ]
    .map((value) => value?.trim() ?? '')
    .filter((value) => value.length > 0);

  return Array.from(new Set(candidates));
}

export function createProviderCascadeForChain(
  chain: Chain,
  options: Pick<
    OracleFetchOptions,
    'blockchairApiKey' | 'cascadeConfig' | 'etherscanKeys' | 'heliusKeys'
  > = {}
): ProviderCascade {
  const cascadeConfig = options.cascadeConfig ?? DEFAULT_CASCADE_CONFIG;
  if (chain === 'bitcoin') {
    const providers: Provider[] = [
      new MempoolSpaceProvider(),
      new BlockchairProvider(
        options.blockchairApiKey
          ? { apiKey: options.blockchairApiKey }
          : undefined
      ),
    ];

    return new ProviderCascade(providers, cascadeConfig);
  }

  if (chain === 'solana') {
    const heliusKeys = options.heliusKeys ?? loadHeliusKeysFromEnv();
    if (heliusKeys.length === 0) {
      throw new Error('No Helius API keys configured for Solana requests');
    }

    const providers: Provider[] = [
      new HeliusProvider({
        keys: heliusKeys,
        rotationStrategy: 'random',
        shuffleOnStartup: true,
      }),
    ];

    return new ProviderCascade(providers, cascadeConfig);
  }

  const providers: Provider[] = [];
  const etherscanKeys = options.etherscanKeys ?? loadEtherscanKeysFromEnv();

  // API-first strategy for multi-user reliability under RPC instability.
  if (etherscanKeys.length > 0) {
    providers.push(
      new EtherscanProvider({
        keys: etherscanKeys,
        rotationStrategy: 'random',
        shuffleOnStartup: true,
      })
    );
  }

  // RPC is intentionally the final fallback attempt.
  providers.push(new EthereumPublicRpcProvider());

  return new ProviderCascade(providers, cascadeConfig);
}

export async function fetchAndSignOracleTransaction(
  chain: Chain,
  txHash: string,
  options: OracleFetchOptions = {}
): Promise<SignedOracleFetchResult> {
  const cascadeOptions: Pick<
    OracleFetchOptions,
    'blockchairApiKey' | 'cascadeConfig' | 'etherscanKeys' | 'heliusKeys'
  > = {};
  if (options.blockchairApiKey !== undefined) {
    cascadeOptions.blockchairApiKey = options.blockchairApiKey;
  }
  if (options.cascadeConfig !== undefined) {
    cascadeOptions.cascadeConfig = options.cascadeConfig;
  }
  if (options.etherscanKeys !== undefined) {
    cascadeOptions.etherscanKeys = options.etherscanKeys;
  }
  if (options.heliusKeys !== undefined) {
    cascadeOptions.heliusKeys = options.heliusKeys;
  }

  const cascade = createProviderCascadeForChain(chain, cascadeOptions);
  const result = await cascade.fetchTransaction(txHash);
  const canonicalDataResult = CanonicalTxDataSchema.safeParse(result.data);
  if (!canonicalDataResult.success) {
    throw new Error('Provider returned invalid canonical data');
  }

  const signer = getCachedOracleSignerFromEnv();
  const messageHash = await computeOracleCommitment(canonicalDataResult.data);
  const signedAtMs = options.nowMs ?? Date.now();

  return {
    cached: result.cached,
    data: {
      ...canonicalDataResult.data,
      messageHash,
      oracleSignature: signer.sign(messageHash),
      oraclePubKeyId: signer.getPublicKeyId(),
      schemaVersion: 'v1',
      signedAt: Math.floor(signedAtMs / 1000),
    },
    fetchedAt: result.fetchedAt,
    provider: result.provider,
  };
}
