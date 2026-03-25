/* global require, process */
/* eslint-disable @typescript-eslint/no-require-imports */
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');

// Next.js intentionally ignores .env.local in NODE_ENV=test.
// Hydrate provider key env vars for local test runs without overriding
// already-injected CI/runtime secrets.
const PROVIDER_KEY_PATTERN =
  /^(ETHERSCAN_API_KEY(?:_[1-9][0-9]*)?|HELIUS_API_KEY(?:_[1-9][0-9]*)?|BLOCKCYPHER_API_TOKEN(?:_[1-9][0-9]*)?|BLOCKCYPHER_API_KEY(?:_[1-9][0-9]*)?)$/;

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
      if (!PROVIDER_KEY_PATTERN.test(key)) {
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
