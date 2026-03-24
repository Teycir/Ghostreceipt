import { createHash } from 'node:crypto';
import { NextRequest } from 'next/server';
import {
  POST as fetchTxPost,
  __disposeOracleFetchRouteForTests,
} from '@/app/api/oracle/fetch-tx/route';
import {
  POST as verifySignaturePost,
  __disposeOracleVerifyRouteForTests,
} from '@/app/api/oracle/verify-signature/route';
import { SuccessResponseSchema } from '@/lib/validation/schemas';
import { MempoolSpaceProvider } from '@/lib/providers/bitcoin/mempool';
import { EtherscanProvider } from '@/lib/providers/ethereum/etherscan';

const describeStress = process.env['STRESS_TEST'] === '1' ? describe : describe.skip;

const TOTAL_USERS = Number(process.env['STRESS_USERS'] ?? '100');
const CONCURRENCY = Number(process.env['STRESS_CONCURRENCY'] ?? '10');
const BTC_RATIO = Number(process.env['STRESS_BTC_RATIO'] ?? '0.5');

interface RequestMetrics {
  chain: 'bitcoin' | 'ethereum';
  fetchLatencyMs: number;
  verifyLatencyMs: number;
  ok: boolean;
  error?: string;
}

function makeHex64(seed: string): string {
  return createHash('sha256').update(seed).digest('hex');
}

function makeTxHash(chain: 'bitcoin' | 'ethereum', userId: number): string {
  const hex = makeHex64(`${chain}-${userId}`);
  return chain === 'bitcoin' ? hex : `0x${hex}`;
}

function makeClientIp(userId: number): string {
  return `198.51.100.${(userId % 250) + 1}`;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index] ?? 0;
}

async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number
): Promise<T[]> {
  const results = new Array<T>(tasks.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= tasks.length) {
        return;
      }

      const task = tasks[current];
      if (!task) {
        return;
      }

      results[current] = await task();
    }
  }

  const workers = Array.from({ length: Math.max(1, concurrency) }, () => worker());
  await Promise.all(workers);
  return results;
}

function createJsonRequest(
  path: string,
  clientIp: string,
  body: unknown
): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': clientIp,
      'user-agent': 'oracle-stress-test',
    },
    body: JSON.stringify(body),
  });
}

describeStress('Oracle stress test (100 users/hour equivalent + concurrency)', () => {
  const originalEnv = {
    oraclePrivateKey: process.env['ORACLE_PRIVATE_KEY'],
    oraclePublicKey: process.env['ORACLE_PUBLIC_KEY'],
    trustProxyHeaders: process.env['TRUST_PROXY_HEADERS'],
    etherscanApiKey: process.env['ETHERSCAN_API_KEY'],
    etherscanApiKey1: process.env['ETHERSCAN_API_KEY_1'],
    etherscanApiKey2: process.env['ETHERSCAN_API_KEY_2'],
    etherscanApiKey3: process.env['ETHERSCAN_API_KEY_3'],
  };

  beforeAll(() => {
    jest.setTimeout(180000);
    jest.spyOn(console, 'info').mockImplementation(() => undefined);

    process.env['ORACLE_PRIVATE_KEY'] = '1'.repeat(64);
    delete process.env['ORACLE_PUBLIC_KEY'];
    process.env['TRUST_PROXY_HEADERS'] = 'true';
    process.env['ETHERSCAN_API_KEY_1'] =
      originalEnv.etherscanApiKey1 ?? originalEnv.etherscanApiKey ?? 'stress-etherscan-key';

    __disposeOracleFetchRouteForTests();
    __disposeOracleVerifyRouteForTests();

    jest.spyOn(MempoolSpaceProvider.prototype, 'fetchTransaction').mockImplementation(async (txHash) => {
      return {
        chain: 'bitcoin',
        txHash,
        valueAtomic: '100000',
        timestampUnix: 1700000000,
        confirmations: 6,
        blockNumber: 850000,
        blockHash: 'b'.repeat(64),
      };
    });

    jest.spyOn(EtherscanProvider.prototype, 'fetchTransaction').mockImplementation(async (txHash) => {
      return {
        chain: 'ethereum',
        txHash,
        valueAtomic: '1000000000000000',
        timestampUnix: 1700000000,
        confirmations: 12,
        blockNumber: 19000000,
        blockHash: 'c'.repeat(64),
      };
    });
  });

  afterAll(() => {
    if (originalEnv.oraclePrivateKey === undefined) {
      delete process.env['ORACLE_PRIVATE_KEY'];
    } else {
      process.env['ORACLE_PRIVATE_KEY'] = originalEnv.oraclePrivateKey;
    }

    if (originalEnv.oraclePublicKey === undefined) {
      delete process.env['ORACLE_PUBLIC_KEY'];
    } else {
      process.env['ORACLE_PUBLIC_KEY'] = originalEnv.oraclePublicKey;
    }

    if (originalEnv.trustProxyHeaders === undefined) {
      delete process.env['TRUST_PROXY_HEADERS'];
    } else {
      process.env['TRUST_PROXY_HEADERS'] = originalEnv.trustProxyHeaders;
    }

    if (originalEnv.etherscanApiKey === undefined) {
      delete process.env['ETHERSCAN_API_KEY'];
    } else {
      process.env['ETHERSCAN_API_KEY'] = originalEnv.etherscanApiKey;
    }

    if (originalEnv.etherscanApiKey1 === undefined) {
      delete process.env['ETHERSCAN_API_KEY_1'];
    } else {
      process.env['ETHERSCAN_API_KEY_1'] = originalEnv.etherscanApiKey1;
    }

    if (originalEnv.etherscanApiKey2 === undefined) {
      delete process.env['ETHERSCAN_API_KEY_2'];
    } else {
      process.env['ETHERSCAN_API_KEY_2'] = originalEnv.etherscanApiKey2;
    }

    if (originalEnv.etherscanApiKey3 === undefined) {
      delete process.env['ETHERSCAN_API_KEY_3'];
    } else {
      process.env['ETHERSCAN_API_KEY_3'] = originalEnv.etherscanApiKey3;
    }

    __disposeOracleFetchRouteForTests();
    __disposeOracleVerifyRouteForTests();
    jest.restoreAllMocks();
  });

  it(`handles ${TOTAL_USERS} users with concurrency=${CONCURRENCY}`, async () => {
    const btcUsers = Math.round(TOTAL_USERS * BTC_RATIO);
    const tasks = Array.from({ length: TOTAL_USERS }, (_, i) => {
      return async (): Promise<RequestMetrics> => {
        const chain: 'bitcoin' | 'ethereum' = i < btcUsers ? 'bitcoin' : 'ethereum';
        const txHash = makeTxHash(chain, i);
        const clientIp = makeClientIp(i);
        const idempotencyKey = `stress-${Date.now()}-${i}`;

        try {
          const fetchStart = Date.now();
          const fetchResponse = await fetchTxPost(
            createJsonRequest('/api/oracle/fetch-tx', clientIp, {
              chain,
              txHash,
              idempotencyKey,
            })
          );
          const fetchLatencyMs = Date.now() - fetchStart;

          if (fetchResponse.status !== 200) {
            const errorData = (await fetchResponse.json()) as { error?: { code?: string } };
            return {
              chain,
              fetchLatencyMs,
              verifyLatencyMs: 0,
              ok: false,
              error: `fetch-${fetchResponse.status}-${errorData.error?.code ?? 'unknown'}`,
            };
          }

          const fetchBody = (await fetchResponse.json()) as unknown;
          const parsed = SuccessResponseSchema.safeParse(fetchBody);
          if (!parsed.success) {
            return {
              chain,
              fetchLatencyMs,
              verifyLatencyMs: 0,
              ok: false,
              error: 'fetch-schema-invalid',
            };
          }

          const payload = parsed.data.data;

          const verifyStart = Date.now();
          const verifyPayload = {
            expiresAt: payload.expiresAt,
            messageHash: payload.messageHash,
            nonce: payload.nonce,
            oracleSignature: payload.oracleSignature,
            oraclePubKeyId: payload.oraclePubKeyId,
            signedAt: payload.signedAt,
          };
          const verifyResponse = await verifySignaturePost(
            createJsonRequest('/api/oracle/verify-signature', clientIp, verifyPayload)
          );
          const verifyLatencyMs = Date.now() - verifyStart;

          if (verifyResponse.status !== 200) {
            return {
              chain,
              fetchLatencyMs,
              verifyLatencyMs,
              ok: false,
              error: `verify-${verifyResponse.status}`,
            };
          }

          const verifyBody = (await verifyResponse.json()) as { valid?: boolean };
          if (verifyBody.valid !== true) {
            return {
              chain,
              fetchLatencyMs,
              verifyLatencyMs,
              ok: false,
              error: 'verify-invalid-false',
            };
          }

          return {
            chain,
            fetchLatencyMs,
            verifyLatencyMs,
            ok: true,
          };
        } catch (error) {
          return {
            chain,
            fetchLatencyMs: 0,
            verifyLatencyMs: 0,
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      };
    });

    const startedAt = Date.now();
    const results = await runWithConcurrency(tasks, CONCURRENCY);
    const totalDurationMs = Date.now() - startedAt;

    const successCount = results.filter((r) => r.ok).length;
    const failures = results.filter((r) => !r.ok);
    const successRate = successCount / TOTAL_USERS;

    const fetchLatencies = results.filter((r) => r.ok).map((r) => r.fetchLatencyMs);
    const verifyLatencies = results.filter((r) => r.ok).map((r) => r.verifyLatencyMs);

    const fetchP95 = percentile(fetchLatencies, 95);
    const verifyP95 = percentile(verifyLatencies, 95);

    // Log metrics for CI visibility.
    // eslint-disable-next-line no-console
    console.log('[StressTest] Summary', {
      totalUsers: TOTAL_USERS,
      concurrency: CONCURRENCY,
      successCount,
      failureCount: failures.length,
      successRate,
      totalDurationMs,
      fetchP95,
      verifyP95,
      sampleFailures: failures.slice(0, 5),
    });

    expect(successRate).toBeGreaterThanOrEqual(0.99);
    expect(fetchP95).toBeLessThan(2000);
    expect(verifyP95).toBeLessThan(1000);
  });
});
