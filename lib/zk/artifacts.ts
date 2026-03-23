const DEFAULT_ZK_ARTIFACT_VERSION = '2026-03-24';
const VERSION_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const PRELOAD_CACHE_KEY_PREFIX = 'zk-artifacts-preload:';

export interface ZkArtifactPaths {
  version: string;
  vkeyPath: string;
  wasmPath: string;
  zkeyPath: string;
}

const verificationKeyMemoryCache = new Map<string, Promise<unknown>>();
const preloadPromiseCache = new Map<string, Promise<void>>();
let preloadScheduled = false;

function sanitizeVersion(rawVersion: string | undefined): string {
  if (!rawVersion) {
    return DEFAULT_ZK_ARTIFACT_VERSION;
  }

  const trimmed = rawVersion.trim();
  if (!trimmed || !VERSION_PATTERN.test(trimmed)) {
    return DEFAULT_ZK_ARTIFACT_VERSION;
  }

  return trimmed;
}

function withVersion(path: string, version: string): string {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}v=${encodeURIComponent(version)}`;
}

export function getZkArtifactVersion(): string {
  return sanitizeVersion(process.env['NEXT_PUBLIC_ZK_ARTIFACT_VERSION']);
}

export function getDefaultZkArtifactPaths(): ZkArtifactPaths {
  const version = getZkArtifactVersion();
  return {
    version,
    vkeyPath: withVersion('/zk/verification_key.json', version),
    wasmPath: withVersion('/zk/receipt_js/receipt.wasm', version),
    zkeyPath: withVersion('/zk/receipt_final.zkey', version),
  };
}

async function fetchAndCacheArtifact(path: string): Promise<void> {
  const response = await fetch(path, {
    cache: 'force-cache',
    credentials: 'same-origin',
    method: 'GET',
  });
  if (!response.ok) {
    throw new Error(`Failed to preload artifact (${response.status}): ${path}`);
  }

  await response.arrayBuffer();
}

export async function preloadZkArtifacts(paths: ZkArtifactPaths = getDefaultZkArtifactPaths()): Promise<void> {
  if (typeof fetch !== 'function') {
    return;
  }

  const cacheKey = `${PRELOAD_CACHE_KEY_PREFIX}${paths.version}`;
  const existing = preloadPromiseCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const preloadPromise = Promise.all([
    fetchAndCacheArtifact(paths.wasmPath),
    fetchAndCacheArtifact(paths.zkeyPath),
    fetchAndCacheArtifact(paths.vkeyPath),
  ]).then(() => undefined);

  preloadPromiseCache.set(cacheKey, preloadPromise);

  try {
    await preloadPromise;
  } catch (error) {
    preloadPromiseCache.delete(cacheKey);
    throw error;
  }
}

function scheduleIdleTask(task: () => void): void {
  type IdleCallback = (
    callback: () => void,
    options?: { timeout: number }
  ) => number;

  const globalScope = globalThis as unknown as {
    requestIdleCallback?: IdleCallback;
    setTimeout: (handler: () => void, timeout: number) => number;
  };
  if (typeof globalScope.requestIdleCallback === 'function') {
    globalScope.requestIdleCallback(task, { timeout: 2000 });
    return;
  }
  globalScope.setTimeout(task, 0);
}

export function scheduleZkArtifactPreload(paths: ZkArtifactPaths = getDefaultZkArtifactPaths()): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (preloadScheduled) {
    return;
  }
  preloadScheduled = true;

  scheduleIdleTask(() => {
    void preloadZkArtifacts(paths).finally(() => {
      preloadScheduled = false;
    });
  });
}

export async function fetchVerificationKeyCached(vkeyPath: string): Promise<unknown> {
  const existing = verificationKeyMemoryCache.get(vkeyPath);
  if (existing) {
    return existing;
  }

  const request = fetch(vkeyPath, {
    cache: 'force-cache',
    credentials: 'same-origin',
    method: 'GET',
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Failed to load verification key: ${response.statusText}`);
    }
    return response.json();
  });

  verificationKeyMemoryCache.set(vkeyPath, request);
  try {
    return await request;
  } catch (error) {
    verificationKeyMemoryCache.delete(vkeyPath);
    throw error;
  }
}

export function __resetZkArtifactCachesForTests(): void {
  verificationKeyMemoryCache.clear();
  preloadPromiseCache.clear();
  preloadScheduled = false;
}
