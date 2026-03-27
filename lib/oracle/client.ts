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
  timeoutMs?: number;
}

const DEFAULT_ORACLE_TIMEOUT_MS = 120_000;

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

function resolveTimeoutMs(rawTimeoutMs?: number): number {
  if (typeof rawTimeoutMs !== 'number' || !Number.isFinite(rawTimeoutMs) || rawTimeoutMs <= 0) {
    return DEFAULT_ORACLE_TIMEOUT_MS;
  }

  return Math.floor(rawTimeoutMs);
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
    const timeoutMs = resolveTimeoutMs(options.timeoutMs);
    const controller = new AbortController();
    let timeoutTriggered = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const onParentAbort = (): void => {
      controller.abort();
    };

    if (options.signal?.aborted) {
      controller.abort();
    } else if (options.signal) {
      options.signal.addEventListener('abort', onParentAbort, { once: true });
    }

    timeoutHandle = setTimeout(() => {
      timeoutTriggered = true;
      controller.abort();
    }, timeoutMs);

    try {
      const requestInit: RequestInit = {
        body: payload,
        headers: {
          'content-type': 'application/json',
        },
        method: 'POST',
        signal: controller.signal,
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
      if (options.signal?.aborted) {
        throw error;
      }

      if (timeoutTriggered && isLastEndpoint) {
        throw new Error(
          'We could not reach the transaction service in time. Please try again.'
        );
      }

      if (isLastEndpoint) {
        throw error;
      }

      const timeoutSeconds = Math.ceil(timeoutMs / 1000);
      const timeoutLabel = timeoutSeconds === 1 ? '1 second' : `${timeoutSeconds} seconds`;
      const message = timeoutTriggered
        ? `request timed out after ${timeoutLabel}`
        : error instanceof Error
          ? error.message
          : 'unknown error';
      logFailoverWarning(
        `[Oracle] Endpoint ${endpoint} failed (${message}). Trying backup endpoint.`
      );
    } finally {
      if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle);
      }
      if (options.signal) {
        options.signal.removeEventListener('abort', onParentAbort);
      }
    }
  }

  throw new Error('Oracle route failover exhausted all endpoints');
}
