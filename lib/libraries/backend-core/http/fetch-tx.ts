import { randomBytes } from 'crypto';
import {
  type CanonicalTxData,
  CanonicalTxDataSchema,
  type Chain,
  type EthereumAsset,
  type ErrorResponse,
  type OraclePayload,
} from '@/lib/validation/schemas';
import { MempoolSpaceProvider } from '@/lib/providers/bitcoin/mempool';
import { BlockCypherProvider } from '@/lib/providers/bitcoin/blockcypher';
import { EtherscanProvider } from '@/lib/providers/ethereum/etherscan';
import { HeliusProvider } from '@/lib/providers/solana/helius';
import { computeOracleCommitment } from '@/lib/zk/oracle-commitment';
import { getCachedOracleSignerFromEnv } from '@/lib/libraries/backend/oracle-signer-cache';
import { ProviderCascade } from '../providers/cascade';
import type { CascadeConfig, Provider, ProviderError } from '../providers/types';
import { deriveNullifier } from './oracle-nullifier';

export interface FetchTxMappedError {
  code: ErrorResponse['error']['code'];
  message: string;
  status: number;
}

export interface OracleFetchOptions {
  authTtlSeconds?: number;
  blockCypherKeys?: string[];
  canonicalCacheTtlMs?: number;
  cascadeConfig?: CascadeConfig;
  ethereumAsset?: EthereumAsset;
  etherscanKeys?: string[];
  heliusKeys?: string[];
  nonceHex?: string;
  nowMs?: number;
}

export interface SignedOracleFetchResult {
  cached: boolean;
  data: OraclePayload;
  fetchedAt: number;
  provider: string;
}

const DEFAULT_CASCADE_CONFIG: CascadeConfig = {
  maxRetries: 3,
  retryDelayMs: 50,
  timeoutMs: 10000,
  concurrencyLimit: 5,
};

const DEFAULT_ORACLE_AUTH_TTL_SECONDS = 5 * 60;
const DEFAULT_CANONICAL_TX_CACHE_TTL_MS = 15_000;
const MAX_CANONICAL_TX_CACHE_ENTRIES = 1_000;

interface CanonicalTxCacheEntry {
  data: CanonicalTxData;
  expiresAtMs: number;
  fetchedAt: number;
  provider: string;
}

interface CanonicalTxFetchResult {
  cached: boolean;
  data: CanonicalTxData;
  fetchedAt: number;
  provider: string;
}

const canonicalTxCache = new Map<string, CanonicalTxCacheEntry>();
const inFlightCanonicalTxFetches = new Map<string, Promise<CanonicalTxFetchResult>>();

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

function resolveCanonicalCacheTtlMs(options: OracleFetchOptions): number {
  const requested = options.canonicalCacheTtlMs;
  if (requested !== undefined) {
    if (!Number.isFinite(requested) || requested <= 0) {
      return 0;
    }

    return Math.floor(requested);
  }

  return parseNonNegativeIntEnv(
    'ORACLE_FETCH_TX_CANONICAL_CACHE_TTL_MS',
    DEFAULT_CANONICAL_TX_CACHE_TTL_MS
  );
}

function buildCanonicalTxCacheKey(
  chain: Chain,
  txHash: string,
  ethereumAsset: EthereumAsset
): string {
  const normalizedHash = chain === 'solana' ? txHash : txHash.toLowerCase();
  const assetKey = chain === 'ethereum' ? `:${ethereumAsset}` : '';
  return `${chain}:${normalizedHash}${assetKey}`;
}

function readCanonicalTxCache(
  cacheKey: string,
  nowMs: number
): CanonicalTxFetchResult | null {
  const entry = canonicalTxCache.get(cacheKey);
  if (!entry) {
    return null;
  }

  if (entry.expiresAtMs <= nowMs) {
    canonicalTxCache.delete(cacheKey);
    return null;
  }

  return {
    cached: true,
    data: entry.data,
    fetchedAt: entry.fetchedAt,
    provider: entry.provider,
  };
}

function writeCanonicalTxCache(
  cacheKey: string,
  entry: CanonicalTxCacheEntry
): void {
  canonicalTxCache.set(cacheKey, entry);

  while (canonicalTxCache.size > MAX_CANONICAL_TX_CACHE_ENTRIES) {
    const oldestKey = canonicalTxCache.keys().next().value;
    if (!oldestKey) {
      break;
    }

    canonicalTxCache.delete(oldestKey);
  }
}

async function fetchCanonicalTxData(
  chain: Chain,
  txHash: string,
  options: Pick<
    OracleFetchOptions,
    | 'blockCypherKeys'
    | 'canonicalCacheTtlMs'
    | 'cascadeConfig'
    | 'ethereumAsset'
    | 'etherscanKeys'
    | 'heliusKeys'
  >
): Promise<CanonicalTxFetchResult> {
  const cacheTtlMs = resolveCanonicalCacheTtlMs(options);
  const ethereumAsset = options.ethereumAsset ?? 'native';
  const cacheKey = buildCanonicalTxCacheKey(chain, txHash, ethereumAsset);

  if (cacheTtlMs > 0) {
    const cachedResult = readCanonicalTxCache(cacheKey, Date.now());
    if (cachedResult) {
      return cachedResult;
    }
  }

  const inFlight = inFlightCanonicalTxFetches.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const fetchPromise = (async (): Promise<CanonicalTxFetchResult> => {
    const cascade = createProviderCascadeForChain(chain, options);
    const result = await cascade.fetchTransaction(txHash);
    const canonicalDataResult = CanonicalTxDataSchema.safeParse(result.data);
    if (!canonicalDataResult.success) {
      throw new Error('Provider returned invalid canonical data');
    }

    const parsedCanonicalData = canonicalDataResult.data;
    const canonicalResult: CanonicalTxFetchResult = {
      cached: result.cached,
      data: parsedCanonicalData,
      fetchedAt: result.fetchedAt,
      provider: result.provider,
    };

    if (cacheTtlMs > 0) {
      writeCanonicalTxCache(cacheKey, {
        data: parsedCanonicalData,
        expiresAtMs: Date.now() + cacheTtlMs,
        fetchedAt: result.fetchedAt,
        provider: result.provider,
      });
    }

    return canonicalResult;
  })();

  inFlightCanonicalTxFetches.set(cacheKey, fetchPromise);

  try {
    return await fetchPromise;
  } finally {
    inFlightCanonicalTxFetches.delete(cacheKey);
  }
}

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

export function loadBlockCypherKeysFromEnv(
  env: NodeJS.ProcessEnv = process.env
): string[] {
  const candidates = [
    env['BLOCKCYPHER_API_TOKEN'],
    env['BLOCKCYPHER_API_TOKEN_1'],
    env['BLOCKCYPHER_API_TOKEN_2'],
    env['BLOCKCYPHER_API_TOKEN_3'],
    env['BLOCKCYPHER_API_TOKEN_4'],
    env['BLOCKCYPHER_API_TOKEN_5'],
    env['BLOCKCYPHER_API_TOKEN_6'],
    // Backward-compatible aliasing for teams that already use *_API_KEY naming.
    env['BLOCKCYPHER_API_KEY'],
    env['BLOCKCYPHER_API_KEY_1'],
    env['BLOCKCYPHER_API_KEY_2'],
    env['BLOCKCYPHER_API_KEY_3'],
    env['BLOCKCYPHER_API_KEY_4'],
    env['BLOCKCYPHER_API_KEY_5'],
    env['BLOCKCYPHER_API_KEY_6'],
  ]
    .map((value) => value?.trim() ?? '')
    .filter((value) => value.length > 0);

  return Array.from(new Set(candidates));
}

export function createProviderCascadeForChain(
  chain: Chain,
  options: Pick<
    OracleFetchOptions,
    | 'blockCypherKeys'
    | 'cascadeConfig'
    | 'ethereumAsset'
    | 'etherscanKeys'
    | 'heliusKeys'
  > = {}
): ProviderCascade {
  const cascadeConfig = options.cascadeConfig ?? DEFAULT_CASCADE_CONFIG;
  if (chain === 'bitcoin') {
    const blockCypherKeys = options.blockCypherKeys ?? loadBlockCypherKeysFromEnv();
    const blockCypherProvider =
      blockCypherKeys.length > 0
        ? new BlockCypherProvider({
            keys: blockCypherKeys,
            rotationStrategy: 'random',
            shuffleOnStartup: true,
          })
        : new BlockCypherProvider();
    const providers: Provider[] = [
      blockCypherProvider,
      new MempoolSpaceProvider(),
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

  const etherscanKeys = options.etherscanKeys ?? loadEtherscanKeysFromEnv();
  if (etherscanKeys.length === 0) {
    throw new Error('No Etherscan API keys configured for Ethereum requests');
  }

  const providers: Provider[] = [
    new EtherscanProvider({
      keys: etherscanKeys,
      rotationStrategy: 'random',
      shuffleOnStartup: true,
    }, options.ethereumAsset ?? 'native'),
  ];

  return new ProviderCascade(providers, cascadeConfig);
}

export async function fetchAndSignOracleTransaction(
  chain: Chain,
  txHash: string,
  options: OracleFetchOptions = {}
): Promise<SignedOracleFetchResult> {
  const cascadeOptions: Pick<
    OracleFetchOptions,
    | 'blockCypherKeys'
    | 'canonicalCacheTtlMs'
    | 'cascadeConfig'
    | 'ethereumAsset'
    | 'etherscanKeys'
    | 'heliusKeys'
  > = {};
  if (options.canonicalCacheTtlMs !== undefined) {
    cascadeOptions.canonicalCacheTtlMs = options.canonicalCacheTtlMs;
  }
  if (options.cascadeConfig !== undefined) {
    cascadeOptions.cascadeConfig = options.cascadeConfig;
  }
  if (options.ethereumAsset !== undefined) {
    cascadeOptions.ethereumAsset = options.ethereumAsset;
  }
  if (options.etherscanKeys !== undefined) {
    cascadeOptions.etherscanKeys = options.etherscanKeys;
  }
  if (options.heliusKeys !== undefined) {
    cascadeOptions.heliusKeys = options.heliusKeys;
  }
  if (options.blockCypherKeys !== undefined) {
    cascadeOptions.blockCypherKeys = options.blockCypherKeys;
  }

  const canonicalResult = await fetchCanonicalTxData(chain, txHash, cascadeOptions);

  const signer = getCachedOracleSignerFromEnv();
  const messageHash = await computeOracleCommitment(canonicalResult.data);
  const nullifier = deriveNullifier(messageHash);
  const signedAtMs = options.nowMs ?? Date.now();
  const signedAt = Math.floor(signedAtMs / 1000);
  const requestedTtlSeconds =
    options.authTtlSeconds ?? DEFAULT_ORACLE_AUTH_TTL_SECONDS;
  const authTtlSeconds =
    Number.isFinite(requestedTtlSeconds) && requestedTtlSeconds > 0
      ? Math.floor(requestedTtlSeconds)
      : DEFAULT_ORACLE_AUTH_TTL_SECONDS;
  const expiresAt = signedAt + authTtlSeconds;
  const nonce =
    options.nonceHex ??
    randomBytes(16).toString('hex');
  const authSignature = signer.signAuthEnvelope({
    expiresAt,
    messageHash,
    nonce,
    signedAt,
  });

  return {
    cached: canonicalResult.cached,
    data: {
      ...canonicalResult.data,
      ...authSignature.envelope,
      nullifier,
      oracleSignature: authSignature.oracleSignature,
    },
    fetchedAt: canonicalResult.fetchedAt,
    provider: canonicalResult.provider,
  };
}

export function __resetFetchTxCanonicalCacheForTests(): void {
  canonicalTxCache.clear();
  inFlightCanonicalTxFetches.clear();
}
