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
import { SuccessResponseSchema, type EthereumAsset } from '@/lib/validation/schemas';
import { computeOracleCommitment } from '@/lib/zk/oracle-commitment';
import { buildWitness, validateWitness } from '@ghostreceipt/zk-core/witness';
import { loadEnvLocalForLiveTests } from './helpers/load-env-local';

const describeLive = process.env['LIVE_INTEGRATION'] === '1' ? describe : describe.skip;

loadEnvLocalForLiveTests();

type LiveChain = 'bitcoin' | 'ethereum' | 'solana';
type LiveEthereumMode = 'native' | 'usdc';

const LIVE_BTC_TX_HASH_ENV = 'LIVE_BTC_TX_HASH';
const LIVE_ETH_TX_HASH_ENV = 'LIVE_ETH_TX_HASH';
const LIVE_ETH_USDC_TX_HASH_ENV = 'LIVE_ETH_USDC_TX_HASH';
const LIVE_SOL_TX_SIGNATURE_ENV = 'LIVE_SOL_TX_SIGNATURE';

const ZK_WASM_PATH = path.join(process.cwd(), 'public/zk/receipt_js/receipt.wasm');
const ZK_ZKEY_PATH = path.join(process.cwd(), 'public/zk/receipt_final.zkey');
const ZK_VKEY_PATH = path.join(process.cwd(), 'public/zk/verification_key.json');

function isLikelyChainTxHash(chain: LiveChain, txHash: string): boolean {
  if (chain === 'bitcoin') {
    return /^[a-f0-9]{64}$/i.test(txHash);
  }

  if (chain === 'ethereum') {
    return /^0x[a-f0-9]{64}$/i.test(txHash);
  }

  return /^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(txHash);
}

function collectApiKeysFromEnv(baseKey: string, numberedPrefix: string): string[] {
  const numbered = Object.keys(process.env)
    .map((key) => {
      if (!key.startsWith(numberedPrefix)) {
        return null;
      }
      const suffix = key.slice(numberedPrefix.length);
      if (!/^[1-9][0-9]*$/.test(suffix)) {
        return null;
      }
      return {
        key,
        index: Number.parseInt(suffix, 10),
      };
    })
    .filter((entry): entry is { key: string; index: number } => entry !== null)
    .sort((a, b) => a.index - b.index)
    .map((entry) => process.env[entry.key]?.trim() ?? '')
    .filter((value) => value.length > 0);

  const primary = (process.env[baseKey] ?? '').trim();
  const ordered = primary.length > 0 ? [primary, ...numbered] : numbered;
  return Array.from(new Set(ordered));
}

function hasEtherscanApiKeysConfigured(): boolean {
  return collectApiKeysFromEnv('ETHERSCAN_API_KEY', 'ETHERSCAN_API_KEY_').length > 0;
}

function hasHeliusApiKeysConfigured(): boolean {
  return collectApiKeysFromEnv('HELIUS_API_KEY', 'HELIUS_API_KEY_').length > 0;
}

function requireEnvValue(envKey: string): string {
  const value = process.env[envKey]?.trim();
  if (!value) {
    throw new Error(
      `Missing required env ${envKey}. This strict live suite forbids fixtures/fallbacks/synthetic inputs.`
    );
  }
  return value;
}

function requireLiveTxFromEnv(envKey: string, chain: LiveChain): string {
  const raw = requireEnvValue(envKey);
  if (!isLikelyChainTxHash(chain, raw)) {
    throw new Error(`Invalid ${chain} value in ${envKey}: ${raw}`);
  }
  if (chain === 'bitcoin' || chain === 'ethereum') {
    return raw.toLowerCase();
  }
  return raw;
}

function createJsonRequest(pathname: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost:3000${pathname}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function proveAndVerifyLiveWitness(witness: ReturnType<typeof buildWitness>): Promise<void> {
  const { proof, publicSignals } = await groth16.fullProve(
    witness as any,
    ZK_WASM_PATH,
    ZK_ZKEY_PATH
  );

  const vkeyRaw = await readFile(ZK_VKEY_PATH, 'utf8');
  const vkey = JSON.parse(vkeyRaw) as Record<string, unknown>;
  const proofValid = await groth16.verify(vkey, publicSignals as any, proof as any);
  expect(proofValid).toBe(true);
}

describeLive('Live Consensus Validation (Strict Real-Only BTC + ETH(native+USDC) + SOL)', () => {
  jest.setTimeout(240000);

  const originalEnv = {
    btcConsensusMode: process.env['ORACLE_BTC_CONSENSUS_MODE'],
    ethConsensusMode: process.env['ORACLE_ETH_CONSENSUS_MODE'],
    solConsensusMode: process.env['ORACLE_SOL_CONSENSUS_MODE'],
  };

  let btcTxHash = '';
  let ethNativeTxHash = '';
  let ethUsdcTxHash = '';
  let solTxSignature = '';

  beforeAll(() => {
    if (!(process.env['ORACLE_PRIVATE_KEY']?.trim().length ?? 0)) {
      throw new Error(
        'LIVE consensus integration requires ORACLE_PRIVATE_KEY from real env; synthetic key injection is disabled.'
      );
    }

    if (!hasEtherscanApiKeysConfigured()) {
      throw new Error(
        'LIVE consensus integration requires ETHERSCAN_API_KEY (or ETHERSCAN_API_KEY_1.._N).'
      );
    }
    if (!hasHeliusApiKeysConfigured()) {
      throw new Error(
        'LIVE consensus integration requires HELIUS_API_KEY (or HELIUS_API_KEY_1.._N).'
      );
    }

    process.env['ORACLE_BTC_CONSENSUS_MODE'] = 'strict';
    process.env['ORACLE_ETH_CONSENSUS_MODE'] = 'strict';
    process.env['ORACLE_SOL_CONSENSUS_MODE'] = 'strict';

    btcTxHash = requireLiveTxFromEnv(LIVE_BTC_TX_HASH_ENV, 'bitcoin');
    ethNativeTxHash = requireLiveTxFromEnv(LIVE_ETH_TX_HASH_ENV, 'ethereum');
    ethUsdcTxHash = requireLiveTxFromEnv(LIVE_ETH_USDC_TX_HASH_ENV, 'ethereum');
    solTxSignature = requireLiveTxFromEnv(LIVE_SOL_TX_SIGNATURE_ENV, 'solana');
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

    __disposeOracleFetchRouteForTests();
    __disposeOracleVerifyRouteForTests();
  });

  async function runFlowForChain(
    chain: LiveChain,
    txHash: string,
    ethereumMode: LiveEthereumMode = 'native'
  ): Promise<void> {
    const requestBody: {
      chain: LiveChain;
      txHash: string;
      ethereumAsset?: EthereumAsset;
    } = {
      chain,
      txHash,
    };
    if (chain === 'ethereum' && ethereumMode === 'usdc') {
      requestBody.ethereumAsset = 'usdc';
    }

    const fetchResponse = await fetchTxPost(createJsonRequest('/api/oracle/fetch-tx', requestBody));
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
    if (chain === 'ethereum' && ethereumMode === 'usdc') {
      expect(payload.valueAtomic).not.toBe('0');
    }
    expect(payload.oracleValidationStatus).toBe('consensus_verified');
    expect(payload.oracleValidationLabel ?? '').toMatch(/^Dual-source consensus verified/);

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
        `verify-signature failed for ${chain}:${txHash} status=${verifyResponse.status} body=${JSON.stringify(
          verifyBody
        )}`
      );
    }
  }

  it('validates live BTC consensus behavior (strict)', async () => {
    await runFlowForChain('bitcoin', btcTxHash);
  });

  it('validates live ETH (native) consensus behavior (strict)', async () => {
    await runFlowForChain('ethereum', ethNativeTxHash, 'native');
  });

  it('validates live ETH (USDC) consensus behavior (strict)', async () => {
    await runFlowForChain('ethereum', ethUsdcTxHash, 'usdc');
  });

  it('validates live Solana consensus behavior (strict)', async () => {
    await runFlowForChain('solana', solTxSignature);
  });
});
