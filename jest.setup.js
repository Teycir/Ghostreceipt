/* global require, process */
/* eslint-disable @typescript-eslint/no-require-imports */
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');

// Next.js intentionally ignores .env.local in NODE_ENV=test.
// Hydrate provider key + provider endpoint env vars for local test runs without overriding
// already-injected CI/runtime secrets.
const HYDRATED_ENV_PATTERN =
  /^(ETHERSCAN_API_KEY(?:_[1-9][0-9]*)?|HELIUS_API_KEY(?:_[1-9][0-9]*)?|BLOCKCYPHER_API_TOKEN(?:_[1-9][0-9]*)?|BLOCKCYPHER_API_KEY(?:_[1-9][0-9]*)?|(?:BITCOIN|ETHEREUM|SOLANA)_(?:PUBLIC_RPC|PROVIDER)_[A-Z0-9_]+_URL)$/;

const TEST_ENDPOINT_DEFAULTS = {
  BITCOIN_PUBLIC_RPC_MEMPOOL_SPACE_MAINNET_URL: 'https://mempool.space/api',
  BITCOIN_PUBLIC_RPC_MEMPOOL_EMZY_MAINNET_URL: 'https://mempool.emzy.de/api',
  BITCOIN_PUBLIC_RPC_MEMPOOL_NINJA_MAINNET_URL: 'https://mempool.ninja/api',
  BITCOIN_PROVIDER_BLOCKCYPHER_MAINNET_URL: 'https://api.blockcypher.com/v1/btc/main',
  ETHEREUM_PUBLIC_RPC_PUBLICNODE_PRIMARY_URL: 'https://ethereum-rpc.publicnode.com',
  ETHEREUM_PUBLIC_RPC_PUBLICNODE_SECONDARY_URL: 'https://ethereum.publicnode.com',
  ETHEREUM_PUBLIC_RPC_FLASHBOTS_URL: 'https://rpc.flashbots.net',
  ETHEREUM_PUBLIC_RPC_CLOUDFLARE_URL: 'https://cloudflare-eth.com',
  ETHEREUM_PROVIDER_ETHERSCAN_V2_MAINNET_URL: 'https://api.etherscan.io/v2/api',
  SOLANA_PUBLIC_RPC_MAINNET_BETA_PRIMARY_URL: 'https://api.mainnet-beta.solana.com',
  SOLANA_PUBLIC_RPC_PUBLICNODE_URL: 'https://solana-rpc.publicnode.com',
  SOLANA_PROVIDER_HELIUS_MAINNET_URL: 'https://mainnet.helius-rpc.com/',
};

function hydrateProviderKeysFromLocalEnv() {
  const envPaths = [
    path.join(process.cwd(), '.env.test.local'),
    path.join(process.cwd(), '.env.local'),
    path.join(process.cwd(), '.env.test'),
    path.join(process.cwd(), '.env'),
  ];

  for (const envPath of envPaths) {
    if (!existsSync(envPath)) {
      continue;
    }

    const contents = readFileSync(envPath, 'utf8');
    for (const rawLine of contents.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) {
        continue;
      }

      const normalizedLine = line.startsWith('export ') ? line.slice(7) : line;
      const separator = normalizedLine.indexOf('=');
      if (separator <= 0) {
        continue;
      }

      const key = normalizedLine.slice(0, separator).trim();
      if (!HYDRATED_ENV_PATTERN.test(key)) {
        continue;
      }

      if ((process.env[key] || '').trim().length > 0) {
        continue;
      }

      let value = normalizedLine.slice(separator + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (value.length > 0) {
        process.env[key] = value;
      }
    }
  }
}

hydrateProviderKeysFromLocalEnv();

for (const [key, value] of Object.entries(TEST_ENDPOINT_DEFAULTS)) {
  if ((process.env[key] || '').trim().length === 0) {
    process.env[key] = value;
  }
}
