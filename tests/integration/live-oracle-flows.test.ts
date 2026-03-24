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
import { groth16 } from 'snarkjs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const describeLive = process.env['LIVE_INTEGRATION'] === '1' ? describe : describe.skip;

type JsonRpcEnvelope<T> = {
  jsonrpc: string;
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
  };
};

const ETH_PUBLIC_RPC_URLS = [
  'https://eth.llamarpc.com',
  'https://ethereum.publicnode.com',
];
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

async function rpcCall<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`RPC HTTP ${response.status} from ${url} (${method})`);
  }

  const payload = (await response.json()) as JsonRpcEnvelope<T>;
  if (payload.error) {
    throw new Error(`RPC ${method} error from ${url}: ${payload.error.message}`);
  }
  if (payload.result === undefined) {
    throw new Error(`RPC ${method} returned no result from ${url}`);
  }

  return payload.result;
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

async function getLiveEthereumTxHash(): Promise<string> {
  let lastError: Error | null = null;

  for (const rpcUrl of ETH_PUBLIC_RPC_URLS) {
    try {
      const latestHex = await rpcCall<string>(rpcUrl, 'eth_blockNumber', []);
      const latestBlockNumber = BigInt(latestHex);

      for (let offset = 0n; offset <= 8n; offset += 1n) {
        const blockTag = `0x${(latestBlockNumber - offset).toString(16)}`;
        const block = await rpcCall<{ transactions: Array<{ hash?: string } | string> }>(
          rpcUrl,
          'eth_getBlockByNumber',
          [blockTag, true]
        );

        if (!Array.isArray(block.transactions) || block.transactions.length === 0) {
          continue;
        }

        for (const tx of block.transactions) {
          const txHash = typeof tx === 'string' ? tx : tx.hash;
          if (!txHash || !/^0x[a-f0-9]{64}$/i.test(txHash)) {
            continue;
          }

          const receipt = await rpcCall<{ status?: string } | null>(
            rpcUrl,
            'eth_getTransactionReceipt',
            [txHash]
          );

          if (receipt && receipt.status === '0x1') {
            return txHash.toLowerCase();
          }
        }
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw new Error(
    `Failed to discover a live successful ETH tx hash from public RPCs: ${
      lastError?.message ?? 'unknown error'
    }`
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

describeLive('Live E2E Oracle Flow (BTC + ETH)', () => {
  const originalEnv = {
    oraclePrivateKey: process.env['ORACLE_PRIVATE_KEY'],
    oraclePublicKey: process.env['ORACLE_PUBLIC_KEY'],
    etherscanApiKey: process.env['ETHERSCAN_API_KEY'],
    etherscanApiKey1: process.env['ETHERSCAN_API_KEY_1'],
    etherscanApiKey2: process.env['ETHERSCAN_API_KEY_2'],
    etherscanApiKey3: process.env['ETHERSCAN_API_KEY_3'],
  };

  let btcTxHash = '';
  let ethTxHash = '';

  beforeAll(async () => {
    jest.setTimeout(180000);

    process.env['ORACLE_PRIVATE_KEY'] = '1'.repeat(64);
    delete process.env['ORACLE_PUBLIC_KEY'];

    // Force ETH live path through public RPC for deterministic keyless testing.
    delete process.env['ETHERSCAN_API_KEY'];
    delete process.env['ETHERSCAN_API_KEY_1'];
    delete process.env['ETHERSCAN_API_KEY_2'];
    delete process.env['ETHERSCAN_API_KEY_3'];

    btcTxHash = await getLiveBitcoinTxHash();
    ethTxHash = await getLiveEthereumTxHash();
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
  });

  async function runFlowForChain(
    chain: 'bitcoin' | 'ethereum',
    txHash: string
  ): Promise<void> {
    const fetchResponse = await fetchTxPost(
      createJsonRequest('/api/oracle/fetch-tx', {
        chain,
        txHash,
        idempotencyKey: `live-${chain}-${Date.now()}`,
      })
    );
    const fetchBody = (await fetchResponse.json()) as unknown;

    expect(fetchResponse.status).toBe(200);

    const parsed = SuccessResponseSchema.safeParse(fetchBody);
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }

    const payload = parsed.data.data;

    expect(payload.chain).toBe(chain);
    expect(payload.txHash.toLowerCase()).toBe(txHash.toLowerCase());
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

    const witness = buildWitness(payload, {
      claimedAmount: payload.valueAtomic,
      minDate: payload.timestampUnix,
    });
    const witnessValidation = validateWitness(witness);
    expect(witnessValidation.valid).toBe(true);

    await proveAndVerifyLiveWitness(witness);

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

    expect(verifyResponse.status).toBe(200);
    expect(verifyBody.valid).toBe(true);
  }

  it('completes the full live BTC oracle flow', async () => {
    await runFlowForChain('bitcoin', btcTxHash);
  });

  it('completes the full live ETH oracle flow', async () => {
    await runFlowForChain('ethereum', ethTxHash);
  });
});
