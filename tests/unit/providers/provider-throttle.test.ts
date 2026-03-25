import { resolveProviderThrottlePolicy } from '@/lib/libraries/backend-core/providers/provider-throttle';

describe('provider-throttle policy', () => {
  it('uses documented etherscan free-tier limit with reliability context by default', () => {
    const env = {
      NODE_ENV: 'test',
    } as NodeJS.ProcessEnv;

    const policy = resolveProviderThrottlePolicy('etherscan', {
      hasApiKey: true,
      env,
    });

    expect(policy.documentedRequestsPerSecond).toBe(3);
    expect(policy.context).toBe('reliability');
    expect(policy.effectiveRequestsPerSecond).toBe(1.5);
    expect(policy.requestThrottleMs).toBe(734);
    expect(policy.keyAttemptDelayMs).toBe(734);
  });

  it('supports throughput context and explicit env overrides', () => {
    const env = {
      NODE_ENV: 'test',
      ORACLE_PROVIDER_THROTTLE_CONTEXT: 'throughput',
      ETHERSCAN_RATE_LIMIT_RPS: '6',
    } as NodeJS.ProcessEnv;

    const policy = resolveProviderThrottlePolicy('etherscan', {
      hasApiKey: true,
      env,
    });

    expect(policy.context).toBe('throughput');
    expect(policy.configuredRequestsPerSecond).toBe(6);
    expect(policy.effectiveRequestsPerSecond).toBe(6);
    expect(policy.requestThrottleMs).toBe(184);
  });

  it('allows direct throttle-ms override and key-attempt delay override', () => {
    const env = {
      NODE_ENV: 'test',
      HELIUS_REQUEST_THROTTLE_MS: '0',
      HELIUS_KEY_ATTEMPT_DELAY_MS: '25',
    } as NodeJS.ProcessEnv;

    const policy = resolveProviderThrottlePolicy('helius', {
      hasApiKey: true,
      env,
    });

    expect(policy.requestThrottleMs).toBe(0);
    expect(policy.keyAttemptDelayMs).toBe(25);
  });

  it('uses documented blockcypher free-tier baseline', () => {
    const env = {
      NODE_ENV: 'test',
      ORACLE_PROVIDER_THROTTLE_CONTEXT: 'throughput',
    } as NodeJS.ProcessEnv;

    const policy = resolveProviderThrottlePolicy('blockcypher', {
      env,
    });

    expect(policy.documentedRequestsPerSecond).toBe(3);
    expect(policy.requestThrottleMs).toBe(367);
  });

  it('defaults blockcypher to conservative reliability pacing', () => {
    const env = {
      NODE_ENV: 'test',
    } as NodeJS.ProcessEnv;

    const policy = resolveProviderThrottlePolicy('blockcypher', {
      hasApiKey: true,
      env,
    });

    expect(policy.context).toBe('reliability');
    expect(policy.effectiveRequestsPerSecond).toBe(1.5);
    expect(policy.requestThrottleMs).toBe(734);
  });
});
