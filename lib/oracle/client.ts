const PRIMARY_ORACLE_BASE = '/api/oracle';

const FALLBACK_DISABLE_VALUES = new Set([
  '',
  '0',
  'false',
  'off',
  'none',
  'disabled',
]);

export type OracleRoutePath = 'check-nullifier' | 'fetch-tx' | 'verify-signature';

export interface OraclePostJsonResult {
  attemptedEndpoints: string[];
  endpoint: string;
  response: Response;
  usedBackup: boolean;
}

interface OraclePostJsonOptions {
  signal?: AbortSignal;
}

function normalizeRoutePath(route: OracleRoutePath): string {
  return route.replace(/^\/+/, '');
}

function normalizeOracleBase(base: string): string {
  const trimmed = base.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/+$/, '');
  }

  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, '');
}

function resolveBackupOracleBase(): string | null {
  const rawBackupBase = process.env['NEXT_PUBLIC_ORACLE_EDGE_BACKUP_BASE']?.trim() ?? '';
  if (FALLBACK_DISABLE_VALUES.has(rawBackupBase.toLowerCase())) {
    return null;
  }

  const normalized = normalizeOracleBase(rawBackupBase);
  if (normalized === PRIMARY_ORACLE_BASE) {
    return null;
  }

  return normalized;
}

function shouldFailoverForResponse(status: number): boolean {
  return status === 404 || status === 405 || status >= 500;
}

function buildEndpoint(base: string, route: OracleRoutePath): string {
  return `${base}/${normalizeRoutePath(route)}`;
}

function logFailoverWarning(message: string): void {
  if (typeof console === 'undefined' || typeof console.warn !== 'function') {
    return;
  }

  console.warn(message);
}

export async function postOracleJson(
  route: OracleRoutePath,
  body: unknown,
  options: OraclePostJsonOptions = {}
): Promise<OraclePostJsonResult> {
  const endpoints = [buildEndpoint(PRIMARY_ORACLE_BASE, route)];
  const backupBase = resolveBackupOracleBase();
  if (backupBase) {
    endpoints.push(buildEndpoint(backupBase, route));
  }

  const attemptedEndpoints: string[] = [];
  const payload = JSON.stringify(body);

  for (const endpoint of endpoints) {
    attemptedEndpoints.push(endpoint);
    const isLastEndpoint = attemptedEndpoints.length === endpoints.length;

    try {
      const requestInit: RequestInit = {
        body: payload,
        headers: {
          'content-type': 'application/json',
        },
        method: 'POST',
        ...(options.signal !== undefined ? { signal: options.signal } : {}),
      };
      const response = await fetch(endpoint, requestInit);

      if (isLastEndpoint || !shouldFailoverForResponse(response.status)) {
        return {
          attemptedEndpoints,
          endpoint,
          response,
          usedBackup: attemptedEndpoints.length > 1 && endpoint !== endpoints[0],
        };
      }

      logFailoverWarning(
        `[Oracle] Endpoint ${endpoint} returned HTTP ${response.status}. Trying backup endpoint.`
      );
    } catch (error) {
      if (isLastEndpoint) {
        throw error;
      }

      const message = error instanceof Error ? error.message : 'unknown error';
      logFailoverWarning(
        `[Oracle] Endpoint ${endpoint} failed (${message}). Trying backup endpoint.`
      );
    }
  }

  throw new Error('Oracle route failover exhausted all endpoints');
}
