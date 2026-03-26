import 'server-only';
import type { ApiKeyConfig } from '@ghostreceipt/backend-core/providers/types';
import { BlockCypherProvider } from '@/lib/providers/bitcoin/blockcypher';
import { MempoolSpaceProvider } from '@/lib/providers/bitcoin/mempool';
import { EtherscanProvider } from '@/lib/providers/ethereum/etherscan';
import { EthereumPublicRpcProvider } from '@/lib/providers/ethereum/public-rpc';
import { HeliusProvider } from '@/lib/providers/solana/helius';
import { SolanaPublicRpcProvider } from '@/lib/providers/solana/public-rpc';
import { OracleSigner } from '@/lib/oracle/signer';
import { checkOracleKeyTransparencyValidity } from '@/lib/libraries/backend-core/http/oracle-transparency-log';

export interface RuntimeConfigIssue {
  key: string;
  message: string;
}

export class RuntimeConfigValidationError extends Error {
  readonly issues: RuntimeConfigIssue[];

  constructor(context: string, issues: RuntimeConfigIssue[]) {
    const detailLines = issues.map((issue) => `- ${issue.key}: ${issue.message}`).join('\n');
    super(`[Config] Runtime validation failed in ${context}:\n${detailLines}`);
    this.name = 'RuntimeConfigValidationError';
    this.issues = issues;
  }
}

const PROVIDER_PROBE_KEY_CONFIG: ApiKeyConfig = {
  keys: ['config-probe-key'],
  rotationStrategy: 'round-robin',
  shuffleOnStartup: false,
};

let cachedFingerprint: string | null = null;
let cachedError: RuntimeConfigValidationError | null = null;

function parseBoolean(value: string | undefined): boolean | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return null;
}

function shouldValidateRuntimeConfigOnLoad(env: NodeJS.ProcessEnv): boolean {
  if ((env['NODE_ENV'] ?? '').toLowerCase() === 'test') {
    return false;
  }

  const override = parseBoolean(env['ORACLE_VALIDATE_CONFIG_ON_LOAD']);
  if (override !== null) {
    return override;
  }

  return true;
}

function collectOrderedValues(values: Array<string | undefined>): string[] {
  return values
    .map((value) => value?.trim() ?? '')
    .filter((value) => value.length > 0);
}

function collectNumericSuffixValues(env: NodeJS.ProcessEnv, prefix: string): string[] {
  return Object.keys(env)
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
    .map((entry) => env[entry.key] ?? '')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function collectEtherscanKeys(env: NodeJS.ProcessEnv): string[] {
  return Array.from(
    new Set(
      collectOrderedValues([
        env['ETHERSCAN_API_KEY'],
        ...collectNumericSuffixValues(env, 'ETHERSCAN_API_KEY_'),
      ])
    )
  );
}

function collectHeliusKeys(env: NodeJS.ProcessEnv): string[] {
  return Array.from(
    new Set(
      collectOrderedValues([
        env['HELIUS_API_KEY'],
        ...collectNumericSuffixValues(env, 'HELIUS_API_KEY_'),
      ])
    )
  );
}

function collectBlockCypherKeys(env: NodeJS.ProcessEnv): string[] {
  return Array.from(
    new Set(
      collectOrderedValues([
        env['BLOCKCYPHER_API_TOKEN'],
        ...collectNumericSuffixValues(env, 'BLOCKCYPHER_API_TOKEN_'),
        env['BLOCKCYPHER_API_KEY'],
        ...collectNumericSuffixValues(env, 'BLOCKCYPHER_API_KEY_'),
      ])
    )
  );
}

function createConfigFingerprint(env: NodeJS.ProcessEnv): string {
  const fingerprintKeys = [
    'ORACLE_PRIVATE_KEY',
    'ORACLE_PUBLIC_KEY',
    'ORACLE_VALIDATE_CONFIG_ON_LOAD',
    'ETHERSCAN_API_KEY',
    'HELIUS_API_KEY',
    'BLOCKCYPHER_API_TOKEN',
  ];

  const dynamicPrefixes = [
    'ETHERSCAN_API_KEY_',
    'HELIUS_API_KEY_',
    'BLOCKCYPHER_API_TOKEN_',
    'BLOCKCYPHER_API_KEY_',
    'BITCOIN_PROVIDER_',
    'BITCOIN_PUBLIC_RPC_',
    'ETHEREUM_PROVIDER_',
    'ETHEREUM_PUBLIC_RPC_',
    'ETHEREUM_USDC_PUBLIC_RPC_',
    'SOLANA_PROVIDER_',
    'SOLANA_PUBLIC_RPC_',
  ];

  const dynamicKeys = Object.keys(env)
    .filter((key) => dynamicPrefixes.some((prefix) => key.startsWith(prefix)))
    .sort();

  const allKeys = Array.from(new Set([...fingerprintKeys, ...dynamicKeys])).sort();
  return allKeys.map((key) => `${key}=${env[key] ?? ''}`).join('|');
}

function pushIssue(issues: RuntimeConfigIssue[], key: string, message: string): void {
  issues.push({ key, message });
}

function validateOracleSigningConfig(env: NodeJS.ProcessEnv, issues: RuntimeConfigIssue[]): void {
  const oraclePrivateKey = env['ORACLE_PRIVATE_KEY']?.trim() ?? '';
  const oraclePublicKey = env['ORACLE_PUBLIC_KEY']?.trim() ?? '';
  if (!oraclePrivateKey) {
    pushIssue(
      issues,
      'ORACLE_PRIVATE_KEY',
      'Missing. Required for /api/oracle/fetch-tx signing.'
    );
    return;
  }

  let configuredKeyId: string;
  try {
    const derivedPublicKeyHex = OracleSigner.derivePublicKeyHex(oraclePrivateKey);
    configuredKeyId = OracleSigner.derivePublicKeyIdFromHex(derivedPublicKeyHex);
  } catch (error) {
    pushIssue(
      issues,
      'ORACLE_PRIVATE_KEY',
      error instanceof Error ? error.message : 'Invalid ORACLE_PRIVATE_KEY format'
    );
    return;
  }

  if (oraclePublicKey) {
    try {
      const providedPublicKeyId = OracleSigner.derivePublicKeyIdFromHex(oraclePublicKey);
      if (providedPublicKeyId !== configuredKeyId) {
        pushIssue(
          issues,
          'ORACLE_PUBLIC_KEY',
          `Does not match ORACLE_PRIVATE_KEY-derived key ID (expected ${configuredKeyId}, got ${providedPublicKeyId}).`
        );
      }
    } catch (error) {
      pushIssue(
        issues,
        'ORACLE_PUBLIC_KEY',
        error instanceof Error ? error.message : 'Invalid ORACLE_PUBLIC_KEY format'
      );
    }
  }

  const transparencyDecision = checkOracleKeyTransparencyValidity({
    keyId: configuredKeyId,
    signedAt: Math.floor(Date.now() / 1000),
  });
  if (!transparencyDecision.valid) {
    pushIssue(
      issues,
      'config/oracle/transparency-log.json',
      `Configured oracle keyId ${configuredKeyId} rejected: ${transparencyDecision.message}`
    );
  }
}

function validateProviderKeyPools(env: NodeJS.ProcessEnv, issues: RuntimeConfigIssue[]): void {
  if (collectEtherscanKeys(env).length === 0) {
    pushIssue(
      issues,
      'ETHERSCAN_API_KEY(+_N)',
      'No keys configured for Ethereum primary provider.'
    );
  }

  if (collectHeliusKeys(env).length === 0) {
    pushIssue(
      issues,
      'HELIUS_API_KEY(+_N)',
      'No keys configured for Solana primary provider.'
    );
  }

  if (collectBlockCypherKeys(env).length === 0) {
    pushIssue(
      issues,
      'BLOCKCYPHER_API_TOKEN(+_N)',
      'No keys/tokens configured for Bitcoin BlockCypher consensus source.'
    );
  }
}

function validateProviderEndpointConfig(issues: RuntimeConfigIssue[]): void {
  const providerConstructors: Array<{ key: string; build: () => void }> = [
    {
      key: 'BITCOIN_PUBLIC_RPC_*',
      build: () => {
        void new MempoolSpaceProvider();
      },
    },
    {
      key: 'ETHEREUM_PUBLIC_RPC_*',
      build: () => {
        void new EthereumPublicRpcProvider('native');
      },
    },
    {
      key: 'ETHEREUM_USDC_PUBLIC_RPC_*',
      build: () => {
        void new EthereumPublicRpcProvider('usdc');
      },
    },
    {
      key: 'SOLANA_PUBLIC_RPC_*',
      build: () => {
        void new SolanaPublicRpcProvider();
      },
    },
    {
      key: 'BITCOIN_PROVIDER_API_ENDPOINTS',
      build: () => {
        void new BlockCypherProvider(PROVIDER_PROBE_KEY_CONFIG);
      },
    },
    {
      key: 'ETHEREUM_PROVIDER_API_ENDPOINTS',
      build: () => {
        void new EtherscanProvider(PROVIDER_PROBE_KEY_CONFIG);
      },
    },
    {
      key: 'SOLANA_PROVIDER_API_ENDPOINTS',
      build: () => {
        void new HeliusProvider(PROVIDER_PROBE_KEY_CONFIG);
      },
    },
  ];

  for (const { key, build } of providerConstructors) {
    try {
      build();
    } catch (error) {
      pushIssue(
        issues,
        key,
        error instanceof Error ? error.message : 'Invalid provider endpoint configuration'
      );
    }
  }
}

export function validateRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env
): RuntimeConfigIssue[] {
  const issues: RuntimeConfigIssue[] = [];
  validateOracleSigningConfig(env, issues);
  validateProviderKeyPools(env, issues);
  validateProviderEndpointConfig(issues);
  return issues;
}

export function assertRuntimeConfigOnLoad(
  context: string,
  env: NodeJS.ProcessEnv = process.env
): void {
  if (!shouldValidateRuntimeConfigOnLoad(env)) {
    return;
  }

  const fingerprint = createConfigFingerprint(env);
  if (cachedFingerprint === fingerprint) {
    if (cachedError) {
      throw cachedError;
    }
    return;
  }

  const issues = validateRuntimeConfig(env);
  if (issues.length > 0) {
    const error = new RuntimeConfigValidationError(context, issues);
    cachedFingerprint = fingerprint;
    cachedError = error;
    throw error;
  }

  cachedFingerprint = fingerprint;
  cachedError = null;
}

export function __resetRuntimeConfigValidationForTests(): void {
  cachedFingerprint = null;
  cachedError = null;
}
