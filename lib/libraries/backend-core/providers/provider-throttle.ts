type ProviderThrottleName =
  'etherscan'
  | 'helius'
  | 'mempool.space'
  | 'blockcypher';

export type ProviderThrottleContext = 'reliability' | 'balanced' | 'throughput' | 'off';

export interface ProviderThrottlePolicy {
  provider: ProviderThrottleName;
  scope: string;
  context: ProviderThrottleContext;
  documentedRequestsPerSecond: number;
  configuredRequestsPerSecond: number;
  effectiveRequestsPerSecond: number;
  requestThrottleMs: number;
  keyAttemptDelayMs: number;
}

interface ResolveProviderThrottlePolicyOptions {
  hasApiKey?: boolean;
  env?: NodeJS.ProcessEnv;
}

interface ProviderThrottleSpec {
  scope: string;
  documentedRequestsPerSecond: (hasApiKey: boolean) => number;
  requestThrottleEnvVar: string;
  requestRateEnvVar: string;
  keyAttemptDelayEnvVar?: string;
  contextEnvVar: string;
}

const DEFAULT_PROVIDER_THROTTLE_CONTEXT: ProviderThrottleContext = 'reliability';
const GLOBAL_PROVIDER_THROTTLE_CONTEXT_ENV = 'ORACLE_PROVIDER_THROTTLE_CONTEXT';
const GLOBAL_THROTTLE_SAFETY_BUFFER_MULTIPLIER_ENV =
  'ORACLE_PROVIDER_THROTTLE_SAFETY_BUFFER_MULTIPLIER';
const DEFAULT_THROTTLE_SAFETY_BUFFER_MULTIPLIER = 1.1;
const MIN_KEY_ATTEMPT_DELAY_MS = 100;

const CONTEXT_MULTIPLIER: Record<ProviderThrottleContext, number> = {
  // Prioritize resilience to provider-side burst limits.
  reliability: 0.5,
  balanced: 0.75,
  throughput: 1,
  off: 0,
};

const PROVIDER_THROTTLE_SPECS: Record<ProviderThrottleName, ProviderThrottleSpec> = {
  etherscan: {
    scope: 'provider:etherscan',
    // Docs: https://docs.etherscan.io/resources/rate-limits
    // Free tier: 3 calls/second.
    documentedRequestsPerSecond: () => 3,
    requestThrottleEnvVar: 'ETHERSCAN_REQUEST_THROTTLE_MS',
    requestRateEnvVar: 'ETHERSCAN_RATE_LIMIT_RPS',
    keyAttemptDelayEnvVar: 'ETHERSCAN_KEY_ATTEMPT_DELAY_MS',
    contextEnvVar: 'ETHERSCAN_THROTTLE_CONTEXT',
  },
  helius: {
    scope: 'provider:helius',
    // Docs: https://www.helius.dev/docs/billing/rate-limits
    // Standard RPC free tier: 10 requests/second.
    documentedRequestsPerSecond: () => 10,
    requestThrottleEnvVar: 'HELIUS_REQUEST_THROTTLE_MS',
    requestRateEnvVar: 'HELIUS_RPC_RATE_LIMIT_RPS',
    keyAttemptDelayEnvVar: 'HELIUS_KEY_ATTEMPT_DELAY_MS',
    contextEnvVar: 'HELIUS_THROTTLE_CONTEXT',
  },
  'mempool.space': {
    scope: 'provider:mempool.space',
    // Source: https://raw.githubusercontent.com/mempool/mempool/master/nginx.conf
    // limit_req_zone ... zone=api ... rate=200r/m
    documentedRequestsPerSecond: () => 200 / 60,
    requestThrottleEnvVar: 'MEMPOOL_REQUEST_THROTTLE_MS',
    requestRateEnvVar: 'MEMPOOL_RATE_LIMIT_RPS',
    contextEnvVar: 'MEMPOOL_THROTTLE_CONTEXT',
  },
  blockcypher: {
    scope: 'provider:blockcypher',
    // Source: https://www.blockcypher.com/pricing.html
    // Free tier: 3 requests/second, 100 requests/hour, 1,000 requests/day.
    documentedRequestsPerSecond: () => 3,
    requestThrottleEnvVar: 'BLOCKCYPHER_REQUEST_THROTTLE_MS',
    requestRateEnvVar: 'BLOCKCYPHER_RATE_LIMIT_RPS',
    keyAttemptDelayEnvVar: 'BLOCKCYPHER_KEY_ATTEMPT_DELAY_MS',
    contextEnvVar: 'BLOCKCYPHER_THROTTLE_CONTEXT',
  },
};

interface ThrottleGateState {
  lastRequestAtMs: number;
  queue: Promise<void>;
}

const throttleGateByScope = new Map<string, ThrottleGateState>();

export function resolveProviderThrottlePolicy(
  provider: ProviderThrottleName,
  options: ResolveProviderThrottlePolicyOptions = {}
): ProviderThrottlePolicy {
  const env = options.env ?? process.env;
  const spec = PROVIDER_THROTTLE_SPECS[provider];
  const hasApiKey = options.hasApiKey ?? false;
  const documentedRequestsPerSecond = spec.documentedRequestsPerSecond(hasApiKey);
  const configuredRequestsPerSecond = resolveConfiguredRequestsPerSecond(
    documentedRequestsPerSecond,
    spec.requestRateEnvVar,
    env
  );
  const context = resolveThrottleContext(spec.contextEnvVar, env);
  const safetyBufferMultiplier = resolveThrottleSafetyBufferMultiplier(env);
  const effectiveRequestsPerSecond =
    configuredRequestsPerSecond * CONTEXT_MULTIPLIER[context];

  const requestThrottleMs = resolveRequestThrottleMs(
    spec.requestThrottleEnvVar,
    effectiveRequestsPerSecond,
    safetyBufferMultiplier,
    env
  );

  const keyAttemptDelayMs = resolveKeyAttemptDelayMs(
    spec.keyAttemptDelayEnvVar,
    requestThrottleMs,
    env
  );

  return {
    provider,
    scope: spec.scope,
    context,
    documentedRequestsPerSecond,
    configuredRequestsPerSecond,
    effectiveRequestsPerSecond,
    requestThrottleMs,
    keyAttemptDelayMs,
  };
}

export async function waitForProviderThrottleSlot(
  scope: string,
  throttleMs: number
): Promise<void> {
  if (!Number.isFinite(throttleMs) || throttleMs <= 0) {
    return;
  }

  const state = getOrCreateThrottleGateState(scope);

  const throttledStep = async () => {
    const now = Date.now();
    const elapsedMs = now - state.lastRequestAtMs;
    if (elapsedMs < throttleMs) {
      await delay(throttleMs - elapsedMs);
    }
    state.lastRequestAtMs = Date.now();
  };

  const scheduled = state.queue.then(throttledStep, throttledStep);
  state.queue = scheduled.catch(() => undefined);
  await scheduled;
}

export function resetProviderThrottleStateForTests(scope?: string): void {
  if (scope) {
    throttleGateByScope.delete(scope);
    return;
  }

  throttleGateByScope.clear();
}

function getOrCreateThrottleGateState(scope: string): ThrottleGateState {
  const existing = throttleGateByScope.get(scope);
  if (existing) {
    return existing;
  }

  const created: ThrottleGateState = {
    lastRequestAtMs: 0,
    queue: Promise.resolve(),
  };
  throttleGateByScope.set(scope, created);
  return created;
}

function resolveThrottleContext(
  providerContextEnvVar: string,
  env: NodeJS.ProcessEnv
): ProviderThrottleContext {
  const rawContext =
    env[providerContextEnvVar] ??
    env[GLOBAL_PROVIDER_THROTTLE_CONTEXT_ENV] ??
    DEFAULT_PROVIDER_THROTTLE_CONTEXT;
  if (!rawContext) {
    return DEFAULT_PROVIDER_THROTTLE_CONTEXT;
  }

  const normalized = rawContext.trim().toLowerCase();
  if (normalized === 'reliability') {
    return 'reliability';
  }
  if (normalized === 'balanced') {
    return 'balanced';
  }
  if (normalized === 'throughput') {
    return 'throughput';
  }
  if (normalized === 'off') {
    return 'off';
  }

  return DEFAULT_PROVIDER_THROTTLE_CONTEXT;
}

function resolveConfiguredRequestsPerSecond(
  documentedRequestsPerSecond: number,
  requestRateEnvVar: string,
  env: NodeJS.ProcessEnv
): number {
  const override = parseNonNegativeNumberEnv(requestRateEnvVar, env);
  if (override === null || override <= 0) {
    return documentedRequestsPerSecond;
  }

  return override;
}

function resolveRequestThrottleMs(
  requestThrottleEnvVar: string,
  effectiveRequestsPerSecond: number,
  safetyBufferMultiplier: number,
  env: NodeJS.ProcessEnv
): number {
  const explicit = parseNonNegativeNumberEnv(requestThrottleEnvVar, env);
  if (explicit !== null) {
    return Math.floor(explicit);
  }

  if (!Number.isFinite(effectiveRequestsPerSecond) || effectiveRequestsPerSecond <= 0) {
    return 0;
  }

  const intervalMs = (1000 / effectiveRequestsPerSecond) * safetyBufferMultiplier;
  // Avoid floating-point epsilon drift (e.g. 220.00000000000003 -> 221).
  return Math.ceil(intervalMs - 1e-9);
}

function resolveThrottleSafetyBufferMultiplier(env: NodeJS.ProcessEnv): number {
  const configured = parseNonNegativeNumberEnv(
    GLOBAL_THROTTLE_SAFETY_BUFFER_MULTIPLIER_ENV,
    env
  );
  if (configured === null || configured < 1) {
    return DEFAULT_THROTTLE_SAFETY_BUFFER_MULTIPLIER;
  }

  return configured;
}

function resolveKeyAttemptDelayMs(
  keyAttemptDelayEnvVar: string | undefined,
  requestThrottleMs: number,
  env: NodeJS.ProcessEnv
): number {
  if (keyAttemptDelayEnvVar) {
    const explicit = parseNonNegativeNumberEnv(keyAttemptDelayEnvVar, env);
    if (explicit !== null) {
      return Math.floor(explicit);
    }
  }

  if (requestThrottleMs <= 0) {
    return 0;
  }

  return Math.max(requestThrottleMs, MIN_KEY_ATTEMPT_DELAY_MS);
}

function parseNonNegativeNumberEnv(
  envVarName: string,
  env: NodeJS.ProcessEnv
): number | null {
  const raw = env[envVarName];
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
