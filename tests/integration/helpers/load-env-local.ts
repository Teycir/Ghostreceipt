import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Jest runs with NODE_ENV=test, and Next intentionally ignores .env.local in that mode.
 * For explicit LIVE_INTEGRATION runs on local machines, we hydrate process.env from .env.local.
 */
export function loadEnvLocalForLiveTests(): void {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!existsSync(envPath)) {
    return;
  }

  const contents = readFileSync(envPath, 'utf8');
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separator = line.indexOf('=');
    if (separator <= 0) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    if (!key) {
      continue;
    }

    if ((process.env[key]?.length ?? 0) > 0) {
      continue;
    }

    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}
