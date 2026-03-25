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
import { computeOracleCommitment } from '@/lib/zk/oracle-commitment';
import { buildWitness, validateWitness } from '@ghostreceipt/zk-core/witness';
import { loadEnvLocalForLiveTests } from './helpers/load-env-local';

const describeLive = process.env['LIVE_INTEGRATION'] === '1' ? describe : describe.skip;

loadEnvLocalForLiveTests();

const SOLANA_TX_FIXTURES: ReadonlyArray<{
  sourceUrl: string;
  txHash: string;
}> = [
  {
    sourceUrl:
      'https://solscan.io/tx/5JrFL9NNVNLV1PvnUbDd9BBCFZBgYACJSZHrKabKd21WR6DppEepK68CNFrM3Hi8FGHeKBXpGVVkUKeQhuvMXGJ1?cluster=mainnet-beta',
    txHash: '5JrFL9NNVNLV1PvnUbDd9BBCFZBgYACJSZHrKabKd21WR6DppEepK68CNFrM3Hi8FGHeKBXpGVVkUKeQhuvMXGJ1',
  },
  {
    sourceUrl:
      'https://solscan.io/tx/4FKjki6P3GoC5QX46TBcMz5G25U15Y1Cb3L34nqbhocLqqodMqceyJ6YygMsnrD77bANE5ysBUyP7uDLpEyppeNH?cluster=mainnet-beta',
    txHash: '4FKjki6P3GoC5QX46TBcMz5G25U15Y1Cb3L34nqbhocLqqodMqceyJ6YygMsnrD77bANE5ysBUyP7uDLpEyppeNH',
  },
];

const ZK_WASM_PATH = path.join(process.cwd(), 'public/zk/receipt_js/receipt.wasm');
const ZK_ZKEY_PATH = path.join(process.cwd(), 'public/zk/receipt_final.zkey');
const ZK_VKEY_PATH = path.join(process.cwd(), 'public/zk/verification_key.json');

function hasAnyConfiguredEnvKey(keys: readonly string[]): boolean {
  return keys.some((key) => (process.env[key]?.trim().length ?? 0) > 0);
}

function hasHeliusApiKeysConfigured(): boolean {
  return hasAnyConfiguredEnvKey([
    'HELIUS_API_KEY',
    'HELIUS_API_KEY_1',
    'HELIUS_API_KEY_2',
    'HELIUS_API_KEY_3',
    'HELIUS_API_KEY_4',
    'HELIUS_API_KEY_5',
    'HELIUS_API_KEY_6',
  ]);
}

function isLikelySolanaTxHash(txHash: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(txHash);
}

function createJsonRequest(pathname: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost:3000${pathname}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
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

describeLive('Live Solana E2E (Oracle + ZK)', () => {
  jest.setTimeout(180000);

  const originalOraclePrivateKey = process.env['ORACLE_PRIVATE_KEY'];
  const originalOraclePublicKey = process.env['ORACLE_PUBLIC_KEY'];

  beforeAll(() => {
    process.env['ORACLE_PRIVATE_KEY'] = '1'.repeat(64);
    delete process.env['ORACLE_PUBLIC_KEY'];

    if (!hasHeliusApiKeysConfigured()) {
      throw new Error(
        'LIVE Solana E2E requires HELIUS_API_KEY (or HELIUS_API_KEY_1.._6).'
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

    __disposeOracleFetchRouteForTests();
    __disposeOracleVerifyRouteForTests();
  });

  it('completes full live Solana flow with real tx data and proof verification', async () => {
    const override = process.env['LIVE_SOL_TX_SIGNATURE']?.trim();
    const candidates = (
      override
        ? [override]
        : SOLANA_TX_FIXTURES.map((fixture) => fixture.txHash)
    ).filter((txHash) => isLikelySolanaTxHash(txHash));

    if (candidates.length === 0) {
      throw new Error(
        `No valid Solana transaction candidates. Sources: ${SOLANA_TX_FIXTURES.map((fixture) => fixture.sourceUrl).join(', ')}`
      );
    }

    const failures: string[] = [];

    for (const txHash of candidates) {
      try {
        const fetchResponse = await fetchTxPost(
          createJsonRequest('/api/oracle/fetch-tx', {
            chain: 'solana',
            txHash,
            idempotencyKey: `live-solana-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
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
        expect(payload.chain).toBe('solana');
        expect(payload.txHash).toBe(txHash);
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
        expect(witness.chainId).toBe('2');

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

        return;
      } catch (error) {
        failures.push(`${txHash}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    throw new Error(`All live Solana candidates failed: ${failures.join(' | ')}`);
  });
});
