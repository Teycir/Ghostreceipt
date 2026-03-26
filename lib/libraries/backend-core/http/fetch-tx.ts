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
import { EthereumPublicRpcProvider } from '@/lib/providers/ethereum/public-rpc';
import { HeliusProvider } from '@/lib/providers/solana/helius';
import { SolanaPublicRpcProvider } from '@/lib/providers/solana/public-rpc';
import { computeOracleCommitment } from '@/lib/zk/oracle-commitment';
import { getCachedOracleSignerFromEnv } from '@/lib/libraries/backend/oracle-signer-cache';
import { checkOracleKeyTransparencyValidity } from './oracle-transparency-log';
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
  maxAuthTtlSeconds?: number;
  bitcoinConsensusMode?: ConsensusMode;
  ethereumConsensusMode?: ConsensusMode;
  solanaConsensusMode?: ConsensusMode;
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
const DEFAULT_ORACLE_AUTH_MAX_TTL_SECONDS = 10 * 60;
const DEFAULT_CANONICAL_TX_CACHE_TTL_MS = 15_000;
const MAX_CANONICAL_TX_CACHE_ENTRIES = 1_000;
const DEFAULT_PRODUCTION_CONSENSUS_MODE: ConsensusMode = 'best_effort';

type ConsensusMode = 'strict' | 'best_effort' | 'off';
type OracleValidationStatus = NonNullable<OraclePayload['oracleValidationStatus']>;

interface ConsensusValidationResult {
  status: OracleValidationStatus;
  label: string;
}

interface CanonicalTxCacheEntry {
  data: CanonicalTxData;
  expiresAtMs: number;
  fetchedAt: number;
  provider: string;
  validationLabel: string;
  validationStatus: OracleValidationStatus;
}

interface CanonicalTxFetchResult {
  cached: boolean;
  data: CanonicalTxData;
  fetchedAt: number;
  provider: string;
  validationLabel: string;
  validationStatus: OracleValidationStatus;
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

function parsePositiveIntEnv(key: string, fallback: number): number {
  const rawValue = process.env[key];
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function shouldEnforceSigningKeyTransparency(env: NodeJS.ProcessEnv = process.env): boolean {
  const rawToggle = env['ORACLE_ENFORCE_SIGNING_KEY_TRANSPARENCY'];
  if (rawToggle) {
    const normalized = rawToggle.trim().toLowerCase();
    if (normalized === '0' || normalized === 'false' || normalized === 'off') {
      return false;
    }
    if (normalized === '1' || normalized === 'true' || normalized === 'on') {
      return true;
    }
  }

  return env['NODE_ENV'] !== 'test';
}

function resolveMaxOracleAuthTtlSeconds(options: OracleFetchOptions): number {
  const requestedMax = options.maxAuthTtlSeconds;
  if (requestedMax !== undefined) {
    if (!Number.isFinite(requestedMax) || requestedMax <= 0) {
      return DEFAULT_ORACLE_AUTH_MAX_TTL_SECONDS;
    }

    return Math.floor(requestedMax);
  }

  return parsePositiveIntEnv(
    'ORACLE_VERIFY_MAX_SIGNATURE_LIFETIME_SECONDS',
    DEFAULT_ORACLE_AUTH_MAX_TTL_SECONDS
  );
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

function normalizeConsensusMode(rawMode: string | undefined): ConsensusMode | null {
  if (!rawMode) {
    return null;
  }

  const normalized = rawMode.trim().toLowerCase();
  if (normalized === 'strict') {
    return 'strict';
  }
  if (normalized === 'off') {
    return 'off';
  }
  if (normalized === 'best_effort' || normalized === 'best-effort') {
    return 'best_effort';
  }

  return null;
}

function resolveConsensusModeForChain(
  chain: Chain,
  options: Pick<
    OracleFetchOptions,
    'bitcoinConsensusMode' | 'ethereumConsensusMode' | 'solanaConsensusMode'
  >,
  env: NodeJS.ProcessEnv = process.env
): ConsensusMode {
  const optionMode =
    chain === 'bitcoin'
      ? options.bitcoinConsensusMode
      : chain === 'ethereum'
        ? options.ethereumConsensusMode
        : options.solanaConsensusMode;
  if (optionMode) {
    return optionMode;
  }

  const chainEnvVar =
    chain === 'bitcoin'
      ? 'ORACLE_BTC_CONSENSUS_MODE'
      : chain === 'ethereum'
        ? 'ORACLE_ETH_CONSENSUS_MODE'
        : 'ORACLE_SOL_CONSENSUS_MODE';

  const chainSpecificMode = normalizeConsensusMode(env[chainEnvVar]);
  if (chainSpecificMode) {
    return chainSpecificMode;
  }

  const globalMode = normalizeConsensusMode(env['ORACLE_CONSENSUS_MODE']);
  if (globalMode) {
    return globalMode;
  }

  // Keep unit tests fast by default while enabling reliability-first behavior in non-test runtimes.
  return env['NODE_ENV'] === 'test' ? 'off' : DEFAULT_PRODUCTION_CONSENSUS_MODE;
}

function buildCanonicalTxCacheKey(
  chain: Chain,
  txHash: string,
  ethereumAsset: EthereumAsset,
  consensusMode: ConsensusMode
): string {
  const normalizedHash = chain === 'solana' ? txHash : txHash.toLowerCase();
  const assetKey = chain === 'ethereum' ? `:${ethereumAsset}` : '';
  const consensusKey = `:consensus=${consensusMode}`;
  return `${chain}:${normalizedHash}${assetKey}${consensusKey}`;
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
    validationLabel: entry.validationLabel,
    validationStatus: entry.validationStatus,
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
    | 'bitcoinConsensusMode'
    | 'ethereumConsensusMode'
    | 'solanaConsensusMode'
    | 'blockCypherKeys'
    | 'canonicalCacheTtlMs'
    | 'cascadeConfig'
    | 'ethereumAsset'
    | 'etherscanKeys'
    | 'heliusKeys'
  >
): Promise<CanonicalTxFetchResult> {
  const cacheTtlMs = resolveCanonicalCacheTtlMs(options);
  const consensusMode = resolveConsensusModeForChain(chain, options);
  const ethereumAsset = options.ethereumAsset ?? 'native';
  const cacheKey = buildCanonicalTxCacheKey(
    chain,
    txHash,
    ethereumAsset,
    consensusMode
  );

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
    const consensusValidation = await validateConsensusForCanonicalData(
      chain,
      txHash,
      parsedCanonicalData,
      result.provider,
      consensusMode,
      options
    );

    const canonicalResult: CanonicalTxFetchResult = {
      cached: result.cached,
      data: parsedCanonicalData,
      fetchedAt: result.fetchedAt,
      provider: result.provider,
      validationLabel: consensusValidation.label,
      validationStatus: consensusValidation.status,
    };

    if (cacheTtlMs > 0) {
      writeCanonicalTxCache(cacheKey, {
        data: parsedCanonicalData,
        expiresAtMs: Date.now() + cacheTtlMs,
        fetchedAt: result.fetchedAt,
        provider: result.provider,
        validationLabel: consensusValidation.label,
        validationStatus: consensusValidation.status,
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

function createBlockCypherProvider(options: Pick<OracleFetchOptions, 'blockCypherKeys'>): BlockCypherProvider {
  const blockCypherKeys = options.blockCypherKeys ?? loadBlockCypherKeysFromEnv();
  if (blockCypherKeys.length === 0) {
    return new BlockCypherProvider();
  }

  return new BlockCypherProvider({
    keys: blockCypherKeys,
    rotationStrategy: 'random',
    shuffleOnStartup: true,
  });
}

function createEtherscanProvider(
  options: Pick<OracleFetchOptions, 'etherscanKeys' | 'ethereumAsset'>
): EtherscanProvider {
  const etherscanKeys = options.etherscanKeys ?? loadEtherscanKeysFromEnv();
  if (etherscanKeys.length === 0) {
    throw new Error('No Etherscan API keys configured for Ethereum requests');
  }

  return new EtherscanProvider({
    keys: etherscanKeys,
    rotationStrategy: 'random',
    shuffleOnStartup: true,
  }, options.ethereumAsset ?? 'native');
}

function createHeliusProvider(options: Pick<OracleFetchOptions, 'heliusKeys'>): HeliusProvider {
  const heliusKeys = options.heliusKeys ?? loadHeliusKeysFromEnv();
  if (heliusKeys.length === 0) {
    throw new Error('No Helius API keys configured for Solana requests');
  }

  return new HeliusProvider({
    keys: heliusKeys,
    rotationStrategy: 'random',
    shuffleOnStartup: true,
  });
}

function createConsensusVerificationProvider(
  chain: Chain,
  primaryProvider: string,
  options: Pick<
    OracleFetchOptions,
    'blockCypherKeys' | 'etherscanKeys' | 'heliusKeys' | 'ethereumAsset'
  >
): Provider {
  if (chain === 'bitcoin') {
    return primaryProvider === 'blockcypher'
      ? new MempoolSpaceProvider()
      : createBlockCypherProvider(options);
  }

  if (chain === 'ethereum') {
    return primaryProvider === 'etherscan'
      ? new EthereumPublicRpcProvider(options.ethereumAsset ?? 'native')
      : createEtherscanProvider(options);
  }

  return primaryProvider === 'helius'
    ? new SolanaPublicRpcProvider()
    : createHeliusProvider(options);
}

function formatChainConsensusPrefix(chain: Chain): string {
  if (chain === 'bitcoin') {
    return 'Bitcoin';
  }
  if (chain === 'ethereum') {
    return 'Ethereum';
  }
  return 'Solana';
}

function normalizeChainHash(chain: Chain, txHash: string): string {
  return chain === 'solana' ? txHash : txHash.toLowerCase();
}

function normalizeChainBlockHash(chain: Chain, blockHash: string): string {
  return chain === 'solana' ? blockHash : blockHash.toLowerCase();
}

function findCanonicalConsensusMismatch(
  primary: CanonicalTxData,
  verification: CanonicalTxData
): string | null {
  if (primary.chain !== verification.chain) {
    return `chain differs (${primary.chain} vs ${verification.chain})`;
  }

  if (
    normalizeChainHash(primary.chain, primary.txHash) !==
      normalizeChainHash(verification.chain, verification.txHash)
  ) {
    return 'txHash differs';
  }

  if (primary.valueAtomic !== verification.valueAtomic) {
    return `valueAtomic differs (${primary.valueAtomic} vs ${verification.valueAtomic})`;
  }

  if (
    primary.blockHash &&
    verification.blockHash &&
    normalizeChainBlockHash(primary.chain, primary.blockHash) !==
      normalizeChainBlockHash(verification.chain, verification.blockHash)
  ) {
    return 'blockHash differs';
  }

  if (
    typeof primary.blockNumber === 'number' &&
    typeof verification.blockNumber === 'number' &&
    primary.blockNumber !== verification.blockNumber
  ) {
    return `blockNumber differs (${primary.blockNumber} vs ${verification.blockNumber})`;
  }

  return null;
}

async function validateConsensusForCanonicalData(
  chain: Chain,
  txHash: string,
  primaryData: CanonicalTxData,
  primaryProvider: string,
  consensusMode: ConsensusMode,
  options: Pick<
    OracleFetchOptions,
    'blockCypherKeys' | 'etherscanKeys' | 'heliusKeys' | 'ethereumAsset'
  >
): Promise<ConsensusValidationResult> {
  if (consensusMode === 'off') {
    return {
      status: 'single_source_only',
      label: `Single-source validation (${primaryProvider})`,
    };
  }

  if (primaryData.chain !== chain) {
    throw new Error(
      `${formatChainConsensusPrefix(chain)} consensus validation received mismatched canonical chain`
    );
  }

  const chainPrefix = formatChainConsensusPrefix(chain);
  const verificationProvider = createConsensusVerificationProvider(
    chain,
    primaryProvider,
    options
  );

  let verificationData: CanonicalTxData;
  try {
    verificationData = await verificationProvider.fetchTransaction(txHash);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (consensusMode === 'strict') {
      throw new Error(
        `${chainPrefix} consensus unavailable: ${verificationProvider.name} verification failed (${reason})`
      );
    }
    return {
      status: 'single_source_fallback',
      label:
        `Single-source fallback (${primaryProvider}); ` +
        `consensus source unavailable (${verificationProvider.name})`,
    };
  }

  const parsedVerification = CanonicalTxDataSchema.safeParse(verificationData);
  if (!parsedVerification.success) {
    if (consensusMode === 'strict') {
      throw new Error(
        `${chainPrefix} consensus unavailable: ${verificationProvider.name} returned invalid canonical data`
      );
    }
    return {
      status: 'single_source_fallback',
      label:
        `Single-source fallback (${primaryProvider}); ` +
        `consensus source returned invalid data (${verificationProvider.name})`,
    };
  }

  const mismatchReason = findCanonicalConsensusMismatch(primaryData, parsedVerification.data);
  if (mismatchReason) {
    throw new Error(
      `${chainPrefix} consensus mismatch between ${primaryProvider} and ${verificationProvider.name}: ${mismatchReason}`
    );
  }

  return {
    status: 'consensus_verified',
    label: `Dual-source consensus verified (${primaryProvider} + ${verificationProvider.name})`,
  };
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

  if (
    normalizedMessage.includes('consensus mismatch') ||
    normalizedMessage.includes('consensus unavailable')
  ) {
    return {
      code: 'PROVIDER_ERROR',
      message,
      status: 502,
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
  const candidates = collectOrderedEnvValuesFromKeys(env, [
    'ETHERSCAN_API_KEY',
    ...collectNumericSuffixEnvKeys(env, 'ETHERSCAN_API_KEY_'),
  ]);

  return Array.from(new Set(candidates));
}

export function loadHeliusKeysFromEnv(
  env: NodeJS.ProcessEnv = process.env
): string[] {
  const candidates = collectOrderedEnvValuesFromKeys(env, [
    'HELIUS_API_KEY',
    ...collectNumericSuffixEnvKeys(env, 'HELIUS_API_KEY_'),
  ]);

  return Array.from(new Set(candidates));
}

export function loadBlockCypherKeysFromEnv(
  env: NodeJS.ProcessEnv = process.env
): string[] {
  const candidates = collectOrderedEnvValues([
    env['BLOCKCYPHER_API_TOKEN'],
    ...collectNumericSuffixEnvValues(env, 'BLOCKCYPHER_API_TOKEN_'),
    // Backward-compatible aliasing for teams that already use *_API_KEY naming.
    env['BLOCKCYPHER_API_KEY'],
    ...collectNumericSuffixEnvValues(env, 'BLOCKCYPHER_API_KEY_'),
  ]);

  return Array.from(new Set(candidates));
}

function collectOrderedEnvValues(
  values: Array<string | undefined>
): string[] {
  return values
    .map((value) => value?.trim() ?? '')
    .filter((value) => value.length > 0);
}

function collectOrderedEnvValuesFromKeys(
  env: NodeJS.ProcessEnv,
  keys: string[]
): string[] {
  return collectOrderedEnvValues(keys.map((key) => env[key]));
}

function collectNumericSuffixEnvKeys(
  env: NodeJS.ProcessEnv,
  prefix: string
): string[] {
  return Object.keys(env)
    .map((key) => {
      if (!key.startsWith(prefix)) {
        return null;
      }
      const suffix = key.slice(prefix.length);
      if (!/^[1-9][0-9]*$/.test(suffix)) {
        return null;
      }
      return { key, index: Number.parseInt(suffix, 10) };
    })
    .filter(
      (
        value
      ): value is {
        key: string;
        index: number;
      } => value !== null
    )
    .sort((a, b) => a.index - b.index)
    .map((value) => value.key);
}

function collectNumericSuffixEnvValues(
  env: NodeJS.ProcessEnv,
  prefix: string
): Array<string | undefined> {
  return collectNumericSuffixEnvKeys(env, prefix).map((key) => env[key]);
}

export function createProviderCascadeForChain(
  chain: Chain,
  options: Pick<
    OracleFetchOptions,
    | 'bitcoinConsensusMode'
    | 'ethereumConsensusMode'
    | 'solanaConsensusMode'
    | 'blockCypherKeys'
    | 'cascadeConfig'
    | 'ethereumAsset'
    | 'etherscanKeys'
    | 'heliusKeys'
  > = {}
): ProviderCascade {
  const cascadeConfig = options.cascadeConfig ?? DEFAULT_CASCADE_CONFIG;
  if (chain === 'bitcoin') {
    const blockCypherProvider = createBlockCypherProvider(options);
    const providers: Provider[] = [
      blockCypherProvider,
      new MempoolSpaceProvider(),
    ];

    return new ProviderCascade(providers, cascadeConfig);
  }

  if (chain === 'solana') {
    const providers: Provider[] = [
      createHeliusProvider(options),
    ];

    return new ProviderCascade(providers, cascadeConfig);
  }

  const providers: Provider[] = [
    createEtherscanProvider(options),
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
    | 'bitcoinConsensusMode'
    | 'ethereumConsensusMode'
    | 'solanaConsensusMode'
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
  if (options.bitcoinConsensusMode !== undefined) {
    cascadeOptions.bitcoinConsensusMode = options.bitcoinConsensusMode;
  }
  if (options.ethereumConsensusMode !== undefined) {
    cascadeOptions.ethereumConsensusMode = options.ethereumConsensusMode;
  }
  if (options.solanaConsensusMode !== undefined) {
    cascadeOptions.solanaConsensusMode = options.solanaConsensusMode;
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
  const requestedTtlNormalized =
    Number.isFinite(requestedTtlSeconds) && requestedTtlSeconds > 0
      ? Math.floor(requestedTtlSeconds)
      : DEFAULT_ORACLE_AUTH_TTL_SECONDS;
  const authTtlSeconds = Math.min(
    requestedTtlNormalized,
    resolveMaxOracleAuthTtlSeconds(options)
  );
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

  if (shouldEnforceSigningKeyTransparency()) {
    const transparencyCheck = checkOracleKeyTransparencyValidity({
      keyId: authSignature.envelope.oraclePubKeyId,
      signedAt,
    });

    if (!transparencyCheck.valid) {
      throw new Error(`Oracle signing key rejected by transparency log: ${transparencyCheck.message}`);
    }
  }

  return {
    cached: canonicalResult.cached,
    data: {
      ...canonicalResult.data,
      ...authSignature.envelope,
      nullifier,
      oracleSignature: authSignature.oracleSignature,
      oracleValidationStatus: canonicalResult.validationStatus,
      oracleValidationLabel: canonicalResult.validationLabel,
    },
    fetchedAt: canonicalResult.fetchedAt,
    provider: canonicalResult.provider,
  };
}

export function __resetFetchTxCanonicalCacheForTests(): void {
  canonicalTxCache.clear();
  inFlightCanonicalTxFetches.clear();
}
