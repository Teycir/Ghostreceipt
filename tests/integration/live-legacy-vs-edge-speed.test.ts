import { performance } from 'node:perf_hooks';
import { NextRequest } from 'next/server';
import {
  POST as legacyFetchTxPost,
  __disposeOracleFetchRouteForTests,
} from '@/app/api/oracle/fetch-tx/route';
import {
  POST as legacyVerifySignaturePost,
  __disposeOracleVerifyRouteForTests,
} from '@/app/api/oracle/verify-signature/route';
import { onRequest as edgeFetchTxOnRequest } from '@/functions/api/oracle/fetch-tx';
import { onRequest as edgeVerifySignatureOnRequest } from '@/functions/api/oracle/verify-signature';
import { SuccessResponseSchema } from '@/lib/validation/schemas';
import { loadEnvLocalForLiveTests } from './helpers/load-env-local';

loadEnvLocalForLiveTests();

const describeLiveBenchmark = process.env['SPEED_COMPARE'] === '1' ? describe : describe.skip;
const DEFAULT_BTC_TX_HASH =
  '470e55fb000d45c1873a88fe7d3ee1f20208be7d7661c2e29300780a50dd6769';

interface RoundMetric {
  fetchMs: number;
  totalMs: number;
  verifyMs: number;
}

interface MetricSummary {
  meanFetchMs: number;
  meanTotalMs: number;
  meanVerifyMs: number;
  p50FetchMs: number;
  p50TotalMs: number;
  p50VerifyMs: number;
  p95FetchMs: number;
  p95TotalMs: number;
  p95VerifyMs: number;
}

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function percentile(values: number[], percentileValue: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.ceil((percentileValue / 100) * sorted.length) - 1
  );
  return sorted[Math.max(0, index)] ?? 0;
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function summarizeMetrics(metrics: RoundMetric[]): MetricSummary {
  const fetchValues = metrics.map((metric) => metric.fetchMs);
  const verifyValues = metrics.map((metric) => metric.verifyMs);
  const totalValues = metrics.map((metric) => metric.totalMs);

  return {
    meanFetchMs: Math.round(mean(fetchValues)),
    meanTotalMs: Math.round(mean(totalValues)),
    meanVerifyMs: Math.round(mean(verifyValues)),
    p50FetchMs: Math.round(percentile(fetchValues, 50)),
    p50TotalMs: Math.round(percentile(totalValues, 50)),
    p50VerifyMs: Math.round(percentile(verifyValues, 50)),
    p95FetchMs: Math.round(percentile(fetchValues, 95)),
    p95TotalMs: Math.round(percentile(totalValues, 95)),
    p95VerifyMs: Math.round(percentile(verifyValues, 95)),
  };
}

function createNextJsonRequest(
  pathname: string,
  clientIp: string,
  body: unknown
): NextRequest {
  return new NextRequest(`http://localhost:3000${pathname}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': clientIp,
    },
    body: JSON.stringify(body),
  });
}

function createPagesJsonRequest(
  pathname: string,
  clientIp: string,
  body: unknown
): Request {
  return new Request(`http://localhost:8788${pathname}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': clientIp,
    },
    body: JSON.stringify(body),
  });
}

function mustBeValidBtcHash(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) {
    throw new Error(`Invalid BTC tx hash for speed comparison: ${value}`);
  }
  return normalized;
}

async function runLegacyRound(
  txHash: string,
  idSuffix: string,
  clientIp: string
): Promise<RoundMetric> {
  const totalStart = performance.now();
  const fetchStart = performance.now();
  const fetchResponse = await legacyFetchTxPost(
    createNextJsonRequest('/api/oracle/fetch-tx', clientIp, {
      chain: 'bitcoin',
      idempotencyKey: `legacy-${idSuffix}`,
      txHash,
    })
  );
  const fetchMs = performance.now() - fetchStart;
  const fetchBody = (await fetchResponse.json()) as unknown;

  if (fetchResponse.status !== 200) {
    throw new Error(
      `legacy fetch failed with HTTP ${fetchResponse.status}: ${JSON.stringify(fetchBody)}`
    );
  }

  const parsed = SuccessResponseSchema.safeParse(fetchBody);
  if (!parsed.success) {
    throw new Error(`legacy fetch schema parse failed: ${JSON.stringify(parsed.error.flatten())}`);
  }

  const payload = parsed.data.data;
  const verifyStart = performance.now();
  const verifyResponse = await legacyVerifySignaturePost(
    createNextJsonRequest('/api/oracle/verify-signature', clientIp, {
      expiresAt: payload.expiresAt,
      messageHash: payload.messageHash,
      nonce: payload.nonce,
      oraclePubKeyId: payload.oraclePubKeyId,
      oracleSignature: payload.oracleSignature,
      signedAt: payload.signedAt,
    })
  );
  const verifyMs = performance.now() - verifyStart;
  const verifyBody = (await verifyResponse.json()) as { valid?: boolean };
  if (verifyResponse.status !== 200 || verifyBody.valid !== true) {
    throw new Error(
      `legacy verify failed with HTTP ${verifyResponse.status}: ${JSON.stringify(verifyBody)}`
    );
  }

  return {
    fetchMs,
    totalMs: performance.now() - totalStart,
    verifyMs,
  };
}

async function runEdgeRound(
  txHash: string,
  idSuffix: string,
  clientIp: string
): Promise<RoundMetric> {
  const totalStart = performance.now();
  const fetchStart = performance.now();
  const fetchResponse = await edgeFetchTxOnRequest({
    request: createPagesJsonRequest('/api/oracle/fetch-tx', clientIp, {
      chain: 'bitcoin',
      idempotencyKey: `edge-${idSuffix}`,
      txHash,
    }),
  });
  const fetchMs = performance.now() - fetchStart;
  const fetchBody = (await fetchResponse.json()) as unknown;

  if (fetchResponse.status !== 200) {
    throw new Error(
      `edge fetch failed with HTTP ${fetchResponse.status}: ${JSON.stringify(fetchBody)}`
    );
  }

  const parsed = SuccessResponseSchema.safeParse(fetchBody);
  if (!parsed.success) {
    throw new Error(`edge fetch schema parse failed: ${JSON.stringify(parsed.error.flatten())}`);
  }

  const payload = parsed.data.data;
  const verifyStart = performance.now();
  const verifyResponse = await edgeVerifySignatureOnRequest({
    request: createPagesJsonRequest('/api/oracle/verify-signature', clientIp, {
      expiresAt: payload.expiresAt,
      messageHash: payload.messageHash,
      nonce: payload.nonce,
      oraclePubKeyId: payload.oraclePubKeyId,
      oracleSignature: payload.oracleSignature,
      signedAt: payload.signedAt,
    }),
  });
  const verifyMs = performance.now() - verifyStart;
  const verifyBody = (await verifyResponse.json()) as { valid?: boolean };
  if (verifyResponse.status !== 200 || verifyBody.valid !== true) {
    throw new Error(
      `edge verify failed with HTTP ${verifyResponse.status}: ${JSON.stringify(verifyBody)}`
    );
  }

  return {
    fetchMs,
    totalMs: performance.now() - totalStart,
    verifyMs,
  };
}

describeLiveBenchmark('Live speed comparison: legacy app route vs edge pages function', () => {
  const measuredIterations = envNumber('SPEED_COMPARE_ITERATIONS', 4);
  const warmupIterations = envNumber('SPEED_COMPARE_WARMUP_ITERATIONS', 1);
  const txHash = mustBeValidBtcHash(process.env['SPEED_COMPARE_BTC_TX_HASH'] ?? DEFAULT_BTC_TX_HASH);
  const originalEnv = {
    btcConsensusMode: process.env['ORACLE_BTC_CONSENSUS_MODE'],
    fetchCacheTtlMs: process.env['ORACLE_FETCH_TX_CANONICAL_CACHE_TTL_MS'],
  };

  beforeAll(() => {
    jest.setTimeout(300000);
    process.env['ORACLE_BTC_CONSENSUS_MODE'] = 'best_effort';
    process.env['ORACLE_FETCH_TX_CANONICAL_CACHE_TTL_MS'] = '0';
  });

  afterAll(() => {
    if (originalEnv.btcConsensusMode === undefined) {
      delete process.env['ORACLE_BTC_CONSENSUS_MODE'];
    } else {
      process.env['ORACLE_BTC_CONSENSUS_MODE'] = originalEnv.btcConsensusMode;
    }

    if (originalEnv.fetchCacheTtlMs === undefined) {
      delete process.env['ORACLE_FETCH_TX_CANONICAL_CACHE_TTL_MS'];
    } else {
      process.env['ORACLE_FETCH_TX_CANONICAL_CACHE_TTL_MS'] = originalEnv.fetchCacheTtlMs;
    }

    __disposeOracleFetchRouteForTests();
    __disposeOracleVerifyRouteForTests();
  });

  it(
    `compares latency on same BTC tx (warmup=${warmupIterations}, runs=${measuredIterations})`,
    async () => {
      const legacyMetrics: RoundMetric[] = [];
      const edgeMetrics: RoundMetric[] = [];

      for (let i = 0; i < warmupIterations; i += 1) {
        const legacyIp = `198.51.100.${10 + i}`;
        const edgeIp = `198.51.100.${110 + i}`;
        await runLegacyRound(txHash, `warmup-${i}`, legacyIp);
        await runEdgeRound(txHash, `warmup-${i}`, edgeIp);
      }

      for (let i = 0; i < measuredIterations; i += 1) {
        const runTag = `run-${i}`;
        const firstIsLegacy = i % 2 === 0;

        if (firstIsLegacy) {
          legacyMetrics.push(await runLegacyRound(txHash, `${runTag}-legacy`, `198.51.100.${20 + i}`));
          edgeMetrics.push(await runEdgeRound(txHash, `${runTag}-edge`, `198.51.100.${120 + i}`));
        } else {
          edgeMetrics.push(await runEdgeRound(txHash, `${runTag}-edge`, `198.51.100.${120 + i}`));
          legacyMetrics.push(await runLegacyRound(txHash, `${runTag}-legacy`, `198.51.100.${20 + i}`));
        }
      }

      const legacySummary = summarizeMetrics(legacyMetrics);
      const edgeSummary = summarizeMetrics(edgeMetrics);
      const percentDeltaTotalMean =
        legacySummary.meanTotalMs > 0
          ? Number(
              (((edgeSummary.meanTotalMs - legacySummary.meanTotalMs) / legacySummary.meanTotalMs) * 100).toFixed(2)
            )
          : 0;

      console.info('[ghostreceipt][speed_compare_legacy_vs_edge]', {
        edge: edgeSummary,
        legacy: legacySummary,
        measuredIterations,
        percentDeltaTotalMean,
        txHash,
        warmupIterations,
      });

      expect(legacyMetrics.length).toBe(measuredIterations);
      expect(edgeMetrics.length).toBe(measuredIterations);
    }
  );
});
