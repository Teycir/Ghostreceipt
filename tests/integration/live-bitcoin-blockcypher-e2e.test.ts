import { NextRequest } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { groth16 } from 'snarkjs';
import {
  POST as fetchTxPost,
  __disposeOracleFetchRouteForTests,
} from '@/app/api/oracle/fetch-tx/route';
import {
  POST as verifySignaturePost,
  __disposeOracleVerifyRouteForTests,
} from '@/app/api/oracle/verify-signature/route';
import { SuccessResponseSchema } from '@/lib/validation/schemas';
import { BlockCypherProvider } from '@/lib/providers/bitcoin/blockcypher';
import { computeOracleCommitment } from '@/lib/zk/oracle-commitment';
import { buildWitness, validateWitness } from '@ghostreceipt/zk-core/witness';
import { loadEnvLocalForLiveTests } from './helpers/load-env-local';

const describeLive = process.env['LIVE_INTEGRATION'] === '1' ? describe : describe.skip;

loadEnvLocalForLiveTests();

const BTC_TX_FIXTURES: ReadonlyArray<{
  sourceUrl: string;
  txHash: string;
}> = [
  {
    sourceUrl:
      'https://mempool.space/tx/470e55fb000d45c1873a88fe7d3ee1f20208be7d7661c2e29300780a50dd6769',
    txHash: '470e55fb000d45c1873a88fe7d3ee1f20208be7d7661c2e29300780a50dd6769',
  },
  {
    sourceUrl:
      'https://mempool.space/tx/140255d341f3f4b23aff928cbc2c3493ba9ff1cef408d0dffa4507174b50e61e',
    txHash: '140255d341f3f4b23aff928cbc2c3493ba9ff1cef408d0dffa4507174b50e61e',
  },
];

const ZK_WASM_PATH = path.join(process.cwd(), 'public/zk/receipt_js/receipt.wasm');
const ZK_ZKEY_PATH = path.join(process.cwd(), 'public/zk/receipt_final.zkey');
const ZK_VKEY_PATH = path.join(process.cwd(), 'public/zk/verification_key.json');

function hasAnyConfiguredEnvKey(keys: readonly string[]): boolean {
  return keys.some((key) => (process.env[key]?.trim().length ?? 0) > 0);
}

function hasBlockCypherTokensConfigured(): boolean {
  return hasAnyConfiguredEnvKey([
    'BLOCKCYPHER_API_TOKEN',
    'BLOCKCYPHER_API_TOKEN_1',
    'BLOCKCYPHER_API_TOKEN_2',
    'BLOCKCYPHER_API_TOKEN_3',
    'BLOCKCYPHER_API_TOKEN_4',
    'BLOCKCYPHER_API_TOKEN_5',
    'BLOCKCYPHER_API_TOKEN_6',
    // Backward-compatible aliasing accepted by runtime loader.
    'BLOCKCYPHER_API_KEY',
    'BLOCKCYPHER_API_KEY_1',
    'BLOCKCYPHER_API_KEY_2',
    'BLOCKCYPHER_API_KEY_3',
    'BLOCKCYPHER_API_KEY_4',
    'BLOCKCYPHER_API_KEY_5',
    'BLOCKCYPHER_API_KEY_6',
  ]);
}

function createJsonRequest(pathname: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost:3000${pathname}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function isLikelyBitcoinTxHash(txHash: string): boolean {
  return /^[a-f0-9]{64}$/i.test(txHash);
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} when fetching ${url}`);
  }
  return (await response.text()).trim();
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} when fetching ${url}`);
  }
  return (await response.json()) as T;
}

async function getLiveBitcoinTxHash(): Promise<string> {
  const tipHash = await fetchText('https://mempool.space/api/blocks/tip/hash');
  if (!isLikelyBitcoinTxHash(tipHash)) {
    throw new Error(`Unexpected BTC tip hash format: ${tipHash}`);
  }

  const txids = await fetchJson<string[]>(`https://mempool.space/api/block/${tipHash}/txids`);
  if (!Array.isArray(txids) || txids.length === 0) {
    throw new Error(`No BTC txids found for tip block ${tipHash}`);
  }

  const candidate = txids.find((txid) => isLikelyBitcoinTxHash(txid));
  if (!candidate) {
    throw new Error(`No valid BTC txid found for tip block ${tipHash}`);
  }

  return candidate.toLowerCase();
}

async function proveAndVerify(witness: ReturnType<typeof buildWitness>): Promise<void> {
  const { proof, publicSignals } = await groth16.fullProve(
    witness as any,
    ZK_WASM_PATH,
    ZK_ZKEY_PATH
  );

  const vkeyRaw = await readFile(ZK_VKEY_PATH, 'utf8');
  const vkey = JSON.parse(vkeyRaw) as Record<string, unknown>;
  const valid = await groth16.verify(
    vkey,
    publicSignals as any,
    proof as any
  );
  expect(valid).toBe(true);
}

describeLive('Live BTC BlockCypher E2E (Oracle + ZK)', () => {
  jest.setTimeout(180000);

  const originalOraclePrivateKey = process.env['ORACLE_PRIVATE_KEY'];
  const originalOraclePublicKey = process.env['ORACLE_PUBLIC_KEY'];
  const originalBitcoinConsensusMode = process.env['ORACLE_BTC_CONSENSUS_MODE'];

  beforeAll(() => {
    process.env['ORACLE_PRIVATE_KEY'] = '1'.repeat(64);
    process.env['ORACLE_BTC_CONSENSUS_MODE'] = 'strict';
    delete process.env['ORACLE_PUBLIC_KEY'];

    if (!hasBlockCypherTokensConfigured()) {
      throw new Error(
        'LIVE BTC BlockCypher E2E requires BLOCKCYPHER_API_TOKEN (or BLOCKCYPHER_API_TOKEN_1.._6).'
      );
    }
  });

  afterAll(() => {
    if (originalOraclePrivateKey === undefined) {
      delete process.env['ORACLE_PRIVATE_KEY'];
    } else {
      process.env['ORACLE_PRIVATE_KEY'] = originalOraclePrivateKey;
    }

    if (originalOraclePublicKey === undefined) {
      delete process.env['ORACLE_PUBLIC_KEY'];
    } else {
      process.env['ORACLE_PUBLIC_KEY'] = originalOraclePublicKey;
    }

    if (originalBitcoinConsensusMode === undefined) {
      delete process.env['ORACLE_BTC_CONSENSUS_MODE'];
    } else {
      process.env['ORACLE_BTC_CONSENSUS_MODE'] = originalBitcoinConsensusMode;
    }

    __disposeOracleFetchRouteForTests();
    __disposeOracleVerifyRouteForTests();
  });

  it('completes full live bitcoin flow and records blockcypher runtime usage', async () => {
    const override = process.env['LIVE_BTC_TX_HASH']?.trim();
    const fixtureCandidates = BTC_TX_FIXTURES.map((fixture) => fixture.txHash);
    const candidates = (override ? [override] : fixtureCandidates).filter((txHash) =>
      isLikelyBitcoinTxHash(txHash)
    );
    const failures: string[] = [];

    const fallbackCandidate = await getLiveBitcoinTxHash().catch(() => null);
    if (fallbackCandidate && !candidates.includes(fallbackCandidate)) {
      candidates.push(fallbackCandidate);
    }

    if (candidates.length === 0) {
      throw new Error(
        `No valid BTC transaction candidates. Sources: ${BTC_TX_FIXTURES.map((fixture) => fixture.sourceUrl).join(', ')}`
      );
    }

    for (const txHash of candidates) {
      try {
        BlockCypherProvider.resetRuntimeMetricsForTests();

        const fetchResponse = await fetchTxPost(
          createJsonRequest('/api/oracle/fetch-tx', {
            chain: 'bitcoin',
            txHash,
            idempotencyKey: `live-btc-bc-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
          })
        );
        const fetchBody = (await fetchResponse.json()) as unknown;
        if (fetchResponse.status !== 200) {
          throw new Error(
            `fetch-tx returned HTTP ${fetchResponse.status} body=${JSON.stringify(fetchBody)}`
          );
        }

        const parsed = SuccessResponseSchema.safeParse(fetchBody);
        if (!parsed.success) {
          throw new Error(`fetch-tx schema parse failed: ${JSON.stringify(parsed.error.flatten())}`);
        }

        const payload = parsed.data.data;
        expect(payload.chain).toBe('bitcoin');
        expect(payload.txHash.toLowerCase()).toBe(txHash.toLowerCase());
        expect(payload.confirmations).toBeGreaterThanOrEqual(1);
        expect(payload.valueAtomic).toMatch(/^[0-9]+$/);
        expect(payload.messageHash).toMatch(/^[0-9]{1,78}$/);
        expect(payload.oracleSignature).toMatch(/^[a-f0-9]{128}$/i);

        const recomputedCommitment = await computeOracleCommitment({
          chain: payload.chain,
          txHash: payload.txHash,
          valueAtomic: payload.valueAtomic,
          timestampUnix: payload.timestampUnix,
          confirmations: payload.confirmations,
          blockNumber: payload.blockNumber,
          blockHash: payload.blockHash,
        });
        expect(payload.messageHash).toBe(recomputedCommitment);

        const witness = buildWitness(payload, {
          claimedAmount: payload.valueAtomic,
          minDate: payload.timestampUnix,
        });
        const witnessValidation = validateWitness(witness);
        expect(witnessValidation.valid).toBe(true);

        await proveAndVerify(witness);

        const verifyResponse = await verifySignaturePost(
          createJsonRequest('/api/oracle/verify-signature', {
            expiresAt: payload.expiresAt,
            messageHash: payload.messageHash,
            nonce: payload.nonce,
            oracleSignature: payload.oracleSignature,
            oraclePubKeyId: payload.oraclePubKeyId,
            signedAt: payload.signedAt,
          })
        );
        const verifyBody = (await verifyResponse.json()) as { valid?: boolean };
        if (verifyResponse.status !== 200 || verifyBody.valid !== true) {
          throw new Error(
            `verify-signature failed: status=${verifyResponse.status} body=${JSON.stringify(verifyBody)}`
          );
        }

        const metrics = BlockCypherProvider.getRuntimeMetrics();
        expect(metrics).not.toBeNull();
        expect(metrics?.totalAttempts ?? 0).toBeGreaterThan(0);
        expect(metrics?.totalSuccesses ?? 0).toBeGreaterThan(0);

        return;
      } catch (error) {
        failures.push(`${txHash}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    throw new Error(`All live BTC candidates failed: ${failures.join(' | ')}`);
  });
});
