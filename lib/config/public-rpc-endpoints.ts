function fromEnv(envKey: string): string {
  return process.env[envKey]?.trim() ?? '';
}

export const BITCOIN_PUBLIC_RPC_ENDPOINT_ENV_KEYS = {
  MEMPOOL_EMZY_MAINNET: 'BITCOIN_PUBLIC_RPC_MEMPOOL_EMZY_MAINNET_URL',
  MEMPOOL_NINJA_MAINNET: 'BITCOIN_PUBLIC_RPC_MEMPOOL_NINJA_MAINNET_URL',
  MEMPOOL_SPACE_MAINNET: 'BITCOIN_PUBLIC_RPC_MEMPOOL_SPACE_MAINNET_URL',
} as const;

export const BITCOIN_PROVIDER_API_ENDPOINT_ENV_KEYS = {
  BLOCKCYPHER_MAINNET: 'BITCOIN_PROVIDER_BLOCKCYPHER_MAINNET_URL',
} as const;

export const ETHEREUM_PUBLIC_RPC_ENDPOINT_ENV_KEYS = {
  CLOUDFLARE: 'ETHEREUM_PUBLIC_RPC_CLOUDFLARE_URL',
  FLASHBOTS: 'ETHEREUM_PUBLIC_RPC_FLASHBOTS_URL',
  PUBLICNODE_PRIMARY: 'ETHEREUM_PUBLIC_RPC_PUBLICNODE_PRIMARY_URL',
  PUBLICNODE_SECONDARY: 'ETHEREUM_PUBLIC_RPC_PUBLICNODE_SECONDARY_URL',
} as const;

export const ETHEREUM_PROVIDER_API_ENDPOINT_ENV_KEYS = {
  ETHERSCAN_V2_MAINNET: 'ETHEREUM_PROVIDER_ETHERSCAN_V2_MAINNET_URL',
} as const;

export const SOLANA_PUBLIC_RPC_ENDPOINT_ENV_KEYS = {
  MAINNET_BETA_PRIMARY: 'SOLANA_PUBLIC_RPC_MAINNET_BETA_PRIMARY_URL',
  PUBLICNODE: 'SOLANA_PUBLIC_RPC_PUBLICNODE_URL',
} as const;

export const SOLANA_PROVIDER_API_ENDPOINT_ENV_KEYS = {
  CHAINSTACK_MAINNET: 'SOLANA_PROVIDER_CHAINSTACK_MAINNET_URL',
  HELIUS_MAINNET: 'SOLANA_PROVIDER_HELIUS_MAINNET_URL',
} as const;

export const BITCOIN_PUBLIC_RPC_ENDPOINTS = {
  MEMPOOL_EMZY_MAINNET: fromEnv(BITCOIN_PUBLIC_RPC_ENDPOINT_ENV_KEYS.MEMPOOL_EMZY_MAINNET),
  MEMPOOL_NINJA_MAINNET: fromEnv(BITCOIN_PUBLIC_RPC_ENDPOINT_ENV_KEYS.MEMPOOL_NINJA_MAINNET),
  MEMPOOL_SPACE_MAINNET: fromEnv(BITCOIN_PUBLIC_RPC_ENDPOINT_ENV_KEYS.MEMPOOL_SPACE_MAINNET),
} as const;

export const BITCOIN_PROVIDER_API_ENDPOINTS = {
  BLOCKCYPHER_MAINNET: fromEnv(BITCOIN_PROVIDER_API_ENDPOINT_ENV_KEYS.BLOCKCYPHER_MAINNET),
} as const;

export const ETHEREUM_PUBLIC_RPC_ENDPOINTS = {
  CLOUDFLARE: fromEnv(ETHEREUM_PUBLIC_RPC_ENDPOINT_ENV_KEYS.CLOUDFLARE),
  FLASHBOTS: fromEnv(ETHEREUM_PUBLIC_RPC_ENDPOINT_ENV_KEYS.FLASHBOTS),
  PUBLICNODE_PRIMARY: fromEnv(ETHEREUM_PUBLIC_RPC_ENDPOINT_ENV_KEYS.PUBLICNODE_PRIMARY),
  PUBLICNODE_SECONDARY: fromEnv(ETHEREUM_PUBLIC_RPC_ENDPOINT_ENV_KEYS.PUBLICNODE_SECONDARY),
} as const;

export const ETHEREUM_PROVIDER_API_ENDPOINTS = {
  ETHERSCAN_V2_MAINNET: fromEnv(ETHEREUM_PROVIDER_API_ENDPOINT_ENV_KEYS.ETHERSCAN_V2_MAINNET),
} as const;

export const SOLANA_PUBLIC_RPC_ENDPOINTS = {
  MAINNET_BETA_PRIMARY: fromEnv(SOLANA_PUBLIC_RPC_ENDPOINT_ENV_KEYS.MAINNET_BETA_PRIMARY),
  PUBLICNODE: fromEnv(SOLANA_PUBLIC_RPC_ENDPOINT_ENV_KEYS.PUBLICNODE),
} as const;

export const SOLANA_PROVIDER_API_ENDPOINTS = {
  CHAINSTACK_MAINNET: fromEnv(SOLANA_PROVIDER_API_ENDPOINT_ENV_KEYS.CHAINSTACK_MAINNET),
  HELIUS_MAINNET: fromEnv(SOLANA_PROVIDER_API_ENDPOINT_ENV_KEYS.HELIUS_MAINNET),
} as const;

export const DEFAULT_BITCOIN_PUBLIC_RPC_ENDPOINT_NAMES = [
  'MEMPOOL_SPACE_MAINNET',
  'MEMPOOL_EMZY_MAINNET',
  'MEMPOOL_NINJA_MAINNET',
] as const;

export const DEFAULT_ETHEREUM_PUBLIC_RPC_ENDPOINT_NAMES = [
  'PUBLICNODE_PRIMARY',
  'PUBLICNODE_SECONDARY',
  'FLASHBOTS',
  'CLOUDFLARE',
] as const;

export const DEFAULT_ETHEREUM_USDC_PUBLIC_RPC_ENDPOINT_NAMES = [
  'PUBLICNODE_PRIMARY',
  'PUBLICNODE_SECONDARY',
  'FLASHBOTS',
  'CLOUDFLARE',
] as const;

export const DEFAULT_SOLANA_PUBLIC_RPC_ENDPOINT_NAMES = [
  'MAINNET_BETA_PRIMARY',
  'PUBLICNODE',
] as const;

export function resolveEndpointUrlsFromNames(
  endpointMap: Record<string, string>,
  endpointNames: readonly string[]
): string[] {
  return Array.from(
    new Set(
      endpointNames
        .map((name) => endpointMap[name]?.trim() ?? '')
        .filter((value) => value.length > 0)
    )
  );
}

export function resolveRequiredEndpointUrl(
  endpointMap: Record<string, string>,
  endpointName: string,
  contextLabel: string,
  endpointEnvKeyMap?: Record<string, string>
): string {
  const rawValue = endpointMap[endpointName];
  const resolved = typeof rawValue === 'string' ? rawValue.trim() : '';
  if (!resolved) {
    const knownNames = Object.keys(endpointMap);
    const knownSuffix =
      knownNames.length > 0 ? ` Available names: ${knownNames.join(', ')}` : '';
    const envKeyHint = endpointEnvKeyMap?.[endpointName]
      ? ` Set env var ${endpointEnvKeyMap[endpointName]}.`
      : '';
    throw new Error(
      `[Config] Missing endpoint URL for ${contextLabel} (name="${endpointName}").${envKeyHint}${knownSuffix}`
    );
  }

  return resolved;
}

export function resolveRequiredEndpointUrlsFromNames(
  endpointMap: Record<string, string>,
  endpointNames: readonly string[],
  contextLabel: string,
  endpointEnvKeyMap?: Record<string, string>
): string[] {
  const normalizedNames = endpointNames
    .map((name) => name.trim())
    .filter((name) => name.length > 0);

  if (normalizedNames.length === 0) {
    throw new Error(`[Config] No endpoint names configured for ${contextLabel}.`);
  }

  const unknownNames = normalizedNames.filter(
    (name) => !Object.prototype.hasOwnProperty.call(endpointMap, name)
  );
  if (unknownNames.length > 0) {
    throw new Error(
      `[Config] Unknown endpoint name(s) for ${contextLabel}: ${unknownNames.join(', ')}. ` +
      `Allowed names: ${Object.keys(endpointMap).join(', ')}`
    );
  }

  const resolvedUrls = Array.from(
    new Set(
      normalizedNames
        .map((name) => resolveRequiredEndpointUrl(
          endpointMap,
          name,
          contextLabel,
          endpointEnvKeyMap
        ))
        .filter((value) => value.length > 0)
    )
  );

  if (resolvedUrls.length === 0) {
    throw new Error(`[Config] No endpoint URLs resolved for ${contextLabel}.`);
  }

  return resolvedUrls;
}
