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
import { computeOracleCommitment } from '@/lib/zk/oracle-commitment';
import { buildWitness, validateWitness } from '@ghostreceipt/zk-core/witness';
import { loadEnvLocalForLiveTests } from './helpers/load-env-local';
import { groth16 } from 'snarkjs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const describeLive = process.env['LIVE_INTEGRATION'] === '1' ? describe : describe.skip;

loadEnvLocalForLiveTests();

type LiveChain = 'bitcoin' | 'ethereum' | 'solana';

const EXA_REAL_TX_FIXTURES: Record<
  LiveChain,
  ReadonlyArray<{
    sourceUrl: string;
    txHash: string;
  }>
> = {
  bitcoin: [
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
  ],
  ethereum: [
    {
      sourceUrl:
        'https://etherscan.io/tx/0xb0cf76e4cdb751093ec1fadd8a790fad6331a3e85be33e30e44108dbc71778ef',
      txHash: '0xb0cf76e4cdb751093ec1fadd8a790fad6331a3e85be33e30e44108dbc71778ef',
    },
    {
      sourceUrl:
        'https://etherscan.io/tx/0x09180a76aed361c4eeecbf510efdc05fa6314d2f1ff35e33e244da0c7ca31755',
      txHash: '0x09180a76aed361c4eeecbf510efdc05fa6314d2f1ff35e33e244da0c7ca31755',
    },
  ],
  solana: [
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
  ],
};

const LIVE_TX_ENV_OVERRIDES: Record<LiveChain, string> = {
  bitcoin: 'LIVE_BTC_TX_HASH',
  ethereum: 'LIVE_ETH_TX_HASH',
  solana: 'LIVE_SOL_TX_SIGNATURE',
};

const ZK_WASM_PATH = path.join(process.cwd(), 'public/zk/receipt_js/receipt.wasm');
const ZK_ZKEY_PATH = path.join(process.cwd(), 'public/zk/receipt_final.zkey');
const ZK_VKEY_PATH = path.join(process.cwd(), 'public/zk/verification_key.json');

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
  if (!/^[a-f0-9]{64}$/i.test(tipHash)) {
    throw new Error(`Unexpected BTC tip hash format: ${tipHash}`);
  }

  const txids = await fetchJson<string[]>(
    `https://mempool.space/api/block/${tipHash}/txids`
  );

  if (!Array.isArray(txids) || txids.length === 0) {
    throw new Error(`No BTC txids found for tip block ${tipHash}`);
  }

  const candidate = txids.find((txid) => /^[a-f0-9]{64}$/i.test(txid));
  if (!candidate) {
    throw new Error(`No valid BTC txid format found for tip block ${tipHash}`);
  }

  return candidate.toLowerCase();
}


function isLikelyChainTxHash(chain: LiveChain, txHash: string): boolean {
  if (chain === 'bitcoin') {
    return /^[a-f0-9]{64}$/i.test(txHash);
  }

  if (chain === 'ethereum') {
    return /^0x[a-f0-9]{64}$/i.test(txHash);
  }

  return /^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(txHash);
}

function hasAnyConfiguredEnvKey(keys: readonly string[]): boolean {
  return keys.some((key) => (process.env[key]?.trim().length ?? 0) > 0);
}

function hasEtherscanApiKeysConfigured(): boolean {
  return hasAnyConfiguredEnvKey([
    'ETHERSCAN_API_KEY',
    'ETHERSCAN_API_KEY_1',
    'ETHERSCAN_API_KEY_2',
    'ETHERSCAN_API_KEY_3',
    'ETHERSCAN_API_KEY_4',
    'ETHERSCAN_API_KEY_5',
    'ETHERSCAN_API_KEY_6',
  ]);
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

async function resolveLiveTxCandidatesFromExa(chain: LiveChain): Promise<string[]> {
  const overrideEnv = process.env[LIVE_TX_ENV_OVERRIDES[chain]]?.trim();
  if (overrideEnv) {
    return [overrideEnv];
  }

  const candidates = EXA_REAL_TX_FIXTURES[chain]
    .map((fixture) => fixture.txHash)
    .filter((txHash) => isLikelyChainTxHash(chain, txHash));
  if (candidates.length > 0) {
    return candidates;
  }

  throw new Error(
    `No usable Exa-sourced ${chain} transaction candidate found. Sources: ${EXA_REAL_TX_FIXTURES[
      chain
    ]
      .map((fixture) => fixture.sourceUrl)
      .join(', ')}`
  );
}

async function proveAndVerifyLiveWitness(witness: ReturnType<typeof buildWitness>): Promise<void> {
  const { proof, publicSignals } = await groth16.fullProve(
    witness as any,
    ZK_WASM_PATH,
    ZK_ZKEY_PATH
  );

  const vkeyRaw = await readFile(ZK_VKEY_PATH, 'utf8');
  const vkey = JSON.parse(vkeyRaw) as Record<string, unknown>;
  const proofValid = await groth16.verify(
    vkey,
    publicSignals as any,
    proof as any
  );

  expect(proofValid).toBe(true);
}

function createJsonRequest(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

describeLive('Live E2E Oracle Flow (BTC + ETH + SOL)', () => {
  jest.setTimeout(180000);

  const originalEnv = {
    oraclePrivateKey: process.env['ORACLE_PRIVATE_KEY'],
    oraclePublicKey: process.env['ORACLE_PUBLIC_KEY'],
  };

  let btcTxCandidates: string[] = [];
  let ethTxCandidates: string[] = [];
  let solTxCandidates: string[] = [];

  beforeAll(async () => {
    process.env['ORACLE_PRIVATE_KEY'] = '1'.repeat(64);
    delete process.env['ORACLE_PUBLIC_KEY'];

    if (!hasEtherscanApiKeysConfigured()) {
      throw new Error(
        'LIVE integration requires ETHERSCAN_API_KEY (or ETHERSCAN_API_KEY_1.._6). Public RPC fallback is forbidden.'
      );
    }
    if (!hasHeliusApiKeysConfigured()) {
      throw new Error(
        'LIVE integration requires HELIUS_API_KEY (or HELIUS_API_KEY_1.._6). Public RPC fallback is forbidden.'
      );
    }

    btcTxCandidates = await resolveLiveTxCandidatesFromExa('bitcoin');
    ethTxCandidates = await resolveLiveTxCandidatesFromExa('ethereum');
    solTxCandidates = await resolveLiveTxCandidatesFromExa('solana');
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

    __disposeOracleFetchRouteForTests();
    __disposeOracleVerifyRouteForTests();
  });

  async function runFlowForChain(
    chain: LiveChain,
    txHash: string,
    options: {
      requireZkProof: boolean;
    }
  ): Promise<void> {
    const fetchResponse = await fetchTxPost(
      createJsonRequest('/api/oracle/fetch-tx', {
        chain,
        txHash,
        idempotencyKey: `live-${chain}-${Date.now()}`,
      })
    );
    const fetchBody = (await fetchResponse.json()) as unknown;

    if (fetchResponse.status !== 200) {
      throw new Error(
        `fetch-tx returned HTTP ${fetchResponse.status} for ${chain}:${txHash} body=${JSON.stringify(fetchBody)}`
      );
    }

    const parsed = SuccessResponseSchema.safeParse(fetchBody);
    if (!parsed.success) {
      throw new Error(
        `fetch-tx schema parse failed for ${chain}:${txHash}: ${JSON.stringify(parsed.error.flatten())}`
      );
    }

    const payload = parsed.data.data;

    expect(payload.chain).toBe(chain);
    if (chain === 'solana') {
      expect(payload.txHash).toBe(txHash);
    } else {
      expect(payload.txHash.toLowerCase()).toBe(txHash.toLowerCase());
    }
    expect(payload.confirmations).toBeGreaterThanOrEqual(1);
    expect(payload.valueAtomic).toMatch(/^[0-9]+$/);
    expect(payload.oracleSignature).toMatch(/^[a-f0-9]{128}$/i);
    expect(payload.oraclePubKeyId).toMatch(/^[a-f0-9]{16}$/i);
    expect(payload.messageHash).toMatch(/^[0-9]{1,78}$/);

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

    if (options.requireZkProof) {
      const witness = buildWitness(payload, {
        claimedAmount: payload.valueAtomic,
        minDate: payload.timestampUnix,
      });
      const witnessValidation = validateWitness(witness);
      expect(witnessValidation.valid).toBe(true);

      await proveAndVerifyLiveWitness(witness);
    }

    const verifyPayload = {
      expiresAt: payload.expiresAt,
      messageHash: payload.messageHash,
      nonce: payload.nonce,
      oracleSignature: payload.oracleSignature,
      oraclePubKeyId: payload.oraclePubKeyId,
      signedAt: payload.signedAt,
    };

    const verifyResponse = await verifySignaturePost(
      createJsonRequest('/api/oracle/verify-signature', verifyPayload)
    );
    const verifyBody = (await verifyResponse.json()) as { valid?: boolean };

    if (verifyResponse.status !== 200 || verifyBody.valid !== true) {
      throw new Error(
        `verify-signature failed for ${chain}:${txHash} status=${verifyResponse.status} body=${JSON.stringify(
          verifyBody
        )}`
      );
    }
  }

  async function runFlowAcrossCandidates(
    chain: LiveChain,
    txCandidates: readonly string[],
    options: {
      requireZkProof: boolean;
    },
    fallbackDiscovery?: () => Promise<string>
  ): Promise<void> {
    const failures: string[] = [];

    for (const txHash of txCandidates) {
      try {
        await runFlowForChain(chain, txHash, options);
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`${txHash}: ${message}`);
      }
    }

    if (fallbackDiscovery) {
      const fallbackTxHash = await fallbackDiscovery();
      if (!txCandidates.includes(fallbackTxHash)) {
        try {
          await runFlowForChain(chain, fallbackTxHash, options);
          return;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          failures.push(`${fallbackTxHash}: ${message}`);
        }
      }
    }

    throw new Error(
      `All live ${chain} transaction candidates failed. Attempted ${txCandidates.length} candidate(s). Details: ${failures.join(
        ' | '
      )}`
    );
  }

  it('completes the full live BTC oracle flow', async () => {
    await runFlowAcrossCandidates(
      'bitcoin',
      btcTxCandidates,
      { requireZkProof: true },
      getLiveBitcoinTxHash
    );
  });

  it('completes the full live ETH oracle flow', async () => {
    await runFlowAcrossCandidates('ethereum', ethTxCandidates, { requireZkProof: true });
  });

  it('completes the full live Solana oracle flow using Exa-sourced transaction data', async () => {
    await runFlowAcrossCandidates('solana', solTxCandidates, { requireZkProof: true });
  });
});
