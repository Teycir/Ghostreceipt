import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { groth16 } from 'snarkjs';
import { buildWitness } from '@ghostreceipt/zk-core/witness';
import { computeOracleCommitment } from '@/lib/zk/oracle-commitment';
import type { OraclePayload } from '@/lib/validation/schemas';

interface IterationMetric {
  totalMs: number;
  proveMs: number;
  verifyMs: number;
  witnessMs: number;
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

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

describe('Proof performance budget gate', () => {
  const shouldRun = process.env['PROOF_PERF_TEST'] === '1';
  const measuredIterations = envNumber('PROOF_PERF_ITERATIONS', 2);
  const warmupIterations = envNumber('PROOF_PERF_WARMUP_ITERATIONS', 1);
  const totalP95BudgetMs = envNumber('PROOF_PERF_TOTAL_P95_BUDGET_MS', 60_000);
  const proveP95BudgetMs = envNumber('PROOF_PERF_PROVE_P95_BUDGET_MS', 60_000);
  const verifyP95BudgetMs = envNumber('PROOF_PERF_VERIFY_P95_BUDGET_MS', 5_000);
  const witnessP95BudgetMs = envNumber('PROOF_PERF_WITNESS_P95_BUDGET_MS', 500);
  const maybeIt = shouldRun ? it : it.skip;

  maybeIt(
    `keeps proof flow p95 budgets (runs=${measuredIterations}, warmup=${warmupIterations})`,
    async () => {
      const mockOraclePayload: OraclePayload = {
        chain: 'bitcoin',
        txHash: 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd',
        valueAtomic: '100000000',
        timestampUnix: 1700000000,
        confirmations: 6,
        expiresAt: 1700000400,
        messageHash: '12345678901234567890',
        nullifier: 'e'.repeat(64),
        nonce: 'a'.repeat(32),
        oracleSignature:
          'f1e2d3c4b5a69780123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        oraclePubKeyId: 'test-key-1',
        signedAt: 1700000100,
      };

      const commitment = await computeOracleCommitment({
        chain: mockOraclePayload.chain,
        confirmations: mockOraclePayload.confirmations,
        txHash: mockOraclePayload.txHash,
        valueAtomic: mockOraclePayload.valueAtomic,
        timestampUnix: mockOraclePayload.timestampUnix,
      });
      const oraclePayload: OraclePayload = {
        ...mockOraclePayload,
        messageHash: commitment,
      };

      const witness = buildWitness(oraclePayload, {
        claimedAmount: '50000000',
        minDate: 1699999000,
      });

      const wasmPath = resolve(process.cwd(), 'public/zk/receipt_js/receipt.wasm');
      const zkeyPath = resolve(process.cwd(), 'public/zk/receipt_final.zkey');
      const vkeyPath = resolve(process.cwd(), 'public/zk/verification_key.json');
      const verificationKey = JSON.parse(await readFile(vkeyPath, 'utf8'));

      // Warm-up reduces one-time initialization skew in CI runners.
      for (let i = 0; i < warmupIterations; i += 1) {
        await groth16.fullProve(witness as any, wasmPath, zkeyPath);
      }

      const metrics: IterationMetric[] = [];
      for (let i = 0; i < measuredIterations; i += 1) {
        const witnessStart = performance.now();
        const iterationWitness = buildWitness(oraclePayload, {
          claimedAmount: '50000000',
          minDate: 1699999000,
        });
        const witnessMs = performance.now() - witnessStart;

        const proveStart = performance.now();
        const { proof, publicSignals } = await groth16.fullProve(
          iterationWitness as any,
          wasmPath,
          zkeyPath
        );
        const proveMs = performance.now() - proveStart;

        const verifyStart = performance.now();
        const valid = await groth16.verify(verificationKey, publicSignals, proof);
        const verifyMs = performance.now() - verifyStart;
        expect(valid).toBe(true);

        metrics.push({
          totalMs: witnessMs + proveMs + verifyMs,
          proveMs,
          verifyMs,
          witnessMs,
        });
      }

      const totalP95 = percentile(metrics.map(metric => metric.totalMs), 95);
      const proveP95 = percentile(metrics.map(metric => metric.proveMs), 95);
      const verifyP95 = percentile(metrics.map(metric => metric.verifyMs), 95);
      const witnessP95 = percentile(metrics.map(metric => metric.witnessMs), 95);

      const summary = {
        meanProveMs: Math.round(mean(metrics.map(metric => metric.proveMs))),
        meanTotalMs: Math.round(mean(metrics.map(metric => metric.totalMs))),
        measuredIterations,
        proveP95: Math.round(proveP95),
        totalP95: Math.round(totalP95),
        verifyP95: Math.round(verifyP95),
        witnessP95: Math.round(witnessP95),
      };
      console.info('[ghostreceipt][proof_performance_budget]', summary);

      expect(totalP95).toBeLessThanOrEqual(totalP95BudgetMs);
      expect(proveP95).toBeLessThanOrEqual(proveP95BudgetMs);
      expect(verifyP95).toBeLessThanOrEqual(verifyP95BudgetMs);
      expect(witnessP95).toBeLessThanOrEqual(witnessP95BudgetMs);
    },
    300_000
  );
});
