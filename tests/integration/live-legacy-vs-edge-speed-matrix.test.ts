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
import { SuccessResponseSchema, type EthereumAsset } from '@/lib/validation/schemas';
import { loadEnvLocalForLiveTests } from './helpers/load-env-local';

loadEnvLocalForLiveTests();

const describeLiveMatrix = process.env['SPEED_COMPARE_MATRIX'] === '1' ? describe : describe.skip;

type LiveChain = 'bitcoin' | 'ethereum' | 'solana';
type RuntimeMode = 'legacy' | 'edge';

interface Scenario {
  chain: LiveChain;
  ethereumAsset?: EthereumAsset;
  label: string;
  txHashes: string[];
}

interface RoundMetric {
  chain: LiveChain;
  label: string;
  mode: RuntimeMode;
  totalMs: number;
  txHash: string;
}

interface ScenarioSummary {
  datasets: number;
  edgeMeanTotalMs: number;
  edgeP95TotalMs: number;
  label: string;
  legacyMeanTotalMs: number;
  legacyP95TotalMs: number;
  meanDeltaPctEdgeVsLegacy: number;
}

const BTC_FIXTURE_TXS = [
  '470e55fb000d45c1873a88fe7d3ee1f20208be7d7661c2e29300780a50dd6769',
  '140255d341f3f4b23aff928cbc2c3493ba9ff1cef408d0dffa4507174b50e61e',
] as const;
const ETH_FIXTURE_TXS = [
  '0xb0cf76e4cdb751093ec1fadd8a790fad6331a3e85be33e30e44108dbc71778ef',
  '0x09180a76aed361c4eeecbf510efdc05fa6314d2f1ff35e33e244da0c7ca31755',
] as const;
const SOL_FIXTURE_TXS = [
  '5JrFL9NNVNLV1PvnUbDd9BBCFZBgYACJSZHrKabKd21WR6DppEepK68CNFrM3Hi8FGHeKBXpGVVkUKeQhuvMXGJ1',
  '4FKjki6P3GoC5QX46TBcMz5G25U15Y1Cb3L34nqbhocLqqodMqceyJ6YygMsnrD77bANE5ysBUyP7uDLpEyppeNH',
] as const;

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

function normalizeAndValidateTxHash(chain: LiveChain, txHash: string): string | null {
  const raw = txHash.trim();
  if (!raw) {
    return null;
  }

  if (chain === 'bitcoin') {
    const normalized = raw.toLowerCase();
    return /^[a-f0-9]{64}$/.test(normalized) ? normalized : null;
  }

  if (chain === 'ethereum') {
    const normalized = raw.toLowerCase();
    return /^0x[a-f0-9]{64}$/.test(normalized) ? normalized : null;
  }

  return /^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(raw) ? raw : null;
}

function dedupeValidTxHashes(chain: LiveChain, candidates: Array<string | undefined>): string[] {
  const valid = candidates
    .map((value) => normalizeAndValidateTxHash(chain, value ?? ''))
    .filter((value): value is string => value !== null);
  return Array.from(new Set(valid));
}

function createNextJsonRequest(pathname: string, clientIp: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost:3000${pathname}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': clientIp,
    },
    body: JSON.stringify(body),
  });
}

function createPagesJsonRequest(pathname: string, clientIp: string, body: unknown): Request {
  return new Request(`http://localhost:8788${pathname}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': clientIp,
    },
    body: JSON.stringify(body),
  });
}

async function runRound(
  mode: RuntimeMode,
  scenario: Scenario,
  txHash: string,
  runId: string,
  clientIp: string
): Promise<RoundMetric> {
  const requestBody: {
    chain: LiveChain;
    ethereumAsset?: EthereumAsset;
    idempotencyKey: string;
    txHash: string;
  } = {
    chain: scenario.chain,
    idempotencyKey: `${mode}-${scenario.label}-${runId}`,
    txHash,
  };
  if (scenario.chain === 'ethereum' && scenario.ethereumAsset) {
    requestBody.ethereumAsset = scenario.ethereumAsset;
  }

  const totalStart = performance.now();
  const fetchResponse =
    mode === 'legacy'
      ? await legacyFetchTxPost(createNextJsonRequest('/api/oracle/fetch-tx', clientIp, requestBody))
      : await edgeFetchTxOnRequest({
          request: createPagesJsonRequest('/api/oracle/fetch-tx', clientIp, requestBody),
        });

  const fetchBody = (await fetchResponse.json()) as unknown;
  if (fetchResponse.status !== 200) {
    throw new Error(
      `${mode} ${scenario.label} fetch failed ${fetchResponse.status}: ${JSON.stringify(fetchBody)}`
    );
  }

  const parsed = SuccessResponseSchema.safeParse(fetchBody);
  if (!parsed.success) {
    throw new Error(
      `${mode} ${scenario.label} fetch schema parse failed: ${JSON.stringify(parsed.error.flatten())}`
    );
  }

  const payload = parsed.data.data;
  const verifyBody = {
    expiresAt: payload.expiresAt,
    messageHash: payload.messageHash,
    nonce: payload.nonce,
    oraclePubKeyId: payload.oraclePubKeyId,
    oracleSignature: payload.oracleSignature,
    signedAt: payload.signedAt,
  };

  const verifyResponse =
    mode === 'legacy'
      ? await legacyVerifySignaturePost(
          createNextJsonRequest('/api/oracle/verify-signature', clientIp, verifyBody)
        )
      : await edgeVerifySignatureOnRequest({
          request: createPagesJsonRequest('/api/oracle/verify-signature', clientIp, verifyBody),
        });
  const verifyResult = (await verifyResponse.json()) as { valid?: boolean };
  if (verifyResponse.status !== 200 || verifyResult.valid !== true) {
    throw new Error(
      `${mode} ${scenario.label} verify failed ${verifyResponse.status}: ${JSON.stringify(verifyResult)}`
    );
  }

  return {
    chain: scenario.chain,
    label: scenario.label,
    mode,
    totalMs: performance.now() - totalStart,
    txHash,
  };
}

function buildScenarioSummaries(metrics: RoundMetric[]): ScenarioSummary[] {
  const scenarioMap = new Map<string, RoundMetric[]>();
  for (const metric of metrics) {
    const key = metric.label;
    const list = scenarioMap.get(key);
    if (list) {
      list.push(metric);
    } else {
      scenarioMap.set(key, [metric]);
    }
  }

  return Array.from(scenarioMap.entries())
    .map(([label, rows]) => {
      const legacy = rows.filter((row) => row.mode === 'legacy').map((row) => row.totalMs);
      const edge = rows.filter((row) => row.mode === 'edge').map((row) => row.totalMs);

      const legacyMean = mean(legacy);
      const edgeMean = mean(edge);

      return {
        datasets: Math.min(legacy.length, edge.length),
        edgeMeanTotalMs: Math.round(edgeMean),
        edgeP95TotalMs: Math.round(percentile(edge, 95)),
        label,
        legacyMeanTotalMs: Math.round(legacyMean),
        legacyP95TotalMs: Math.round(percentile(legacy, 95)),
        meanDeltaPctEdgeVsLegacy:
          legacyMean > 0
            ? Number((((edgeMean - legacyMean) / legacyMean) * 100).toFixed(2))
            : 0,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

describeLiveMatrix('Live speed matrix: legacy vs edge across cryptos and datasets', () => {
  const timeoutMs = envNumber('SPEED_COMPARE_MATRIX_TEST_TIMEOUT_MS', 420_000);
  const originalEnv = {
    btcConsensusMode: process.env['ORACLE_BTC_CONSENSUS_MODE'],
    ethConsensusMode: process.env['ORACLE_ETH_CONSENSUS_MODE'],
    fetchCacheTtlMs: process.env['ORACLE_FETCH_TX_CANONICAL_CACHE_TTL_MS'],
    solConsensusMode: process.env['ORACLE_SOL_CONSENSUS_MODE'],
    trustProxyHeaders: process.env['TRUST_PROXY_HEADERS'],
  };

  beforeAll(() => {
    jest.setTimeout(timeoutMs);
    process.env['ORACLE_BTC_CONSENSUS_MODE'] = 'best_effort';
    process.env['ORACLE_ETH_CONSENSUS_MODE'] = 'best_effort';
    process.env['ORACLE_SOL_CONSENSUS_MODE'] = 'best_effort';
    process.env['ORACLE_FETCH_TX_CANONICAL_CACHE_TTL_MS'] = '0';
    process.env['TRUST_PROXY_HEADERS'] = 'true';
  });

  afterAll(() => {
    if (originalEnv.btcConsensusMode === undefined) {
      delete process.env['ORACLE_BTC_CONSENSUS_MODE'];
    } else {
      process.env['ORACLE_BTC_CONSENSUS_MODE'] = originalEnv.btcConsensusMode;
    }
    if (originalEnv.ethConsensusMode === undefined) {
      delete process.env['ORACLE_ETH_CONSENSUS_MODE'];
    } else {
      process.env['ORACLE_ETH_CONSENSUS_MODE'] = originalEnv.ethConsensusMode;
    }
    if (originalEnv.solConsensusMode === undefined) {
      delete process.env['ORACLE_SOL_CONSENSUS_MODE'];
    } else {
      process.env['ORACLE_SOL_CONSENSUS_MODE'] = originalEnv.solConsensusMode;
    }
    if (originalEnv.fetchCacheTtlMs === undefined) {
      delete process.env['ORACLE_FETCH_TX_CANONICAL_CACHE_TTL_MS'];
    } else {
      process.env['ORACLE_FETCH_TX_CANONICAL_CACHE_TTL_MS'] = originalEnv.fetchCacheTtlMs;
    }
    if (originalEnv.trustProxyHeaders === undefined) {
      delete process.env['TRUST_PROXY_HEADERS'];
    } else {
      process.env['TRUST_PROXY_HEADERS'] = originalEnv.trustProxyHeaders;
    }

    __disposeOracleFetchRouteForTests();
    __disposeOracleVerifyRouteForTests();
  });

  it('compares legacy and edge timings for multiple chains and tx datasets', async () => {
    const repeatsPerTx = envNumber('SPEED_COMPARE_MATRIX_REPEATS_PER_TX', 1);
    const configuredScenarios: Scenario[] = [
      {
        chain: 'bitcoin',
        label: 'bitcoin-native',
        txHashes: dedupeValidTxHashes('bitcoin', [
          process.env['LIVE_BTC_TX_HASH'],
          ...BTC_FIXTURE_TXS,
        ]),
      },
      {
        chain: 'ethereum',
        label: 'ethereum-native',
        txHashes: dedupeValidTxHashes('ethereum', [
          process.env['LIVE_ETH_TX_HASH'],
          ...ETH_FIXTURE_TXS,
        ]),
      },
      {
        chain: 'ethereum',
        ethereumAsset: 'usdc',
        label: 'ethereum-usdc',
        txHashes: dedupeValidTxHashes('ethereum', [process.env['LIVE_ETH_USDC_TX_HASH']]),
      },
      {
        chain: 'solana',
        label: 'solana-native',
        txHashes: dedupeValidTxHashes('solana', [
          process.env['LIVE_SOL_TX_SIGNATURE'],
          ...SOL_FIXTURE_TXS,
        ]),
      },
    ];
    const scenarios = configuredScenarios.filter((scenario) => scenario.txHashes.length > 0);

    expect(scenarios.length).toBeGreaterThanOrEqual(3);

    const metrics: RoundMetric[] = [];
    const skippedDatasets: Array<{
      label: string;
      reason: string;
      txHash: string;
    }> = [];
    const loggedSkipDatasetKeys = new Set<string>();
    const permanentlySkippedDatasetKeys = new Set<string>();
    let runIndex = 0;

    for (const scenario of scenarios) {
      for (let i = 0; i < scenario.txHashes.length; i += 1) {
        const txHash = scenario.txHashes[i] as string;
        const datasetKey = `${scenario.label}:${txHash}`;
        if (permanentlySkippedDatasetKeys.has(datasetKey)) {
          continue;
        }

        for (let repeat = 0; repeat < repeatsPerTx; repeat += 1) {
          const runId = `${runIndex}-${scenario.label}-${i}-${repeat}`;
          const legacyIp = `198.51.100.${(10 + runIndex) % 240}`;
          const edgeIp = `198.51.100.${(130 + runIndex) % 240}`;
          const runEdgeFirst = runIndex % 2 === 1;
          try {
            if (runEdgeFirst) {
              metrics.push(await runRound('edge', scenario, txHash, `${runId}-edge`, edgeIp));
              metrics.push(await runRound('legacy', scenario, txHash, `${runId}-legacy`, legacyIp));
            } else {
              metrics.push(await runRound('legacy', scenario, txHash, `${runId}-legacy`, legacyIp));
              metrics.push(await runRound('edge', scenario, txHash, `${runId}-edge`, edgeIp));
            }
          } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            if (!loggedSkipDatasetKeys.has(datasetKey)) {
              skippedDatasets.push({
                label: scenario.label,
                reason,
                txHash,
              });
              console.warn(
                `[ghostreceipt][speed_compare_matrix][skip] ${scenario.label} ${txHash}: ${reason}`
              );
              loggedSkipDatasetKeys.add(datasetKey);
            }

            if (reason.includes('Unsupported Solana transaction: no native SOL transfer found')) {
              permanentlySkippedDatasetKeys.add(datasetKey);
              break;
            }
          }

          runIndex += 1;
        }
      }
    }

    const summaries = buildScenarioSummaries(metrics);
    const globalLegacyMean = Math.round(
      mean(metrics.filter((metric) => metric.mode === 'legacy').map((metric) => metric.totalMs))
    );
    const globalEdgeMean = Math.round(
      mean(metrics.filter((metric) => metric.mode === 'edge').map((metric) => metric.totalMs))
    );
    const globalDeltaPct =
      globalLegacyMean > 0
        ? Number((((globalEdgeMean - globalLegacyMean) / globalLegacyMean) * 100).toFixed(2))
        : 0;

    console.info('[ghostreceipt][speed_compare_matrix_legacy_vs_edge]', {
      global: {
        edgeMeanTotalMs: globalEdgeMean,
        legacyMeanTotalMs: globalLegacyMean,
        meanDeltaPctEdgeVsLegacy: globalDeltaPct,
      },
      repeatsPerTx,
      skippedDatasets,
      samplesPerMode: metrics.length / 2,
      summaries,
    });

    expect(metrics.length).toBeGreaterThanOrEqual(8);
  });
});
