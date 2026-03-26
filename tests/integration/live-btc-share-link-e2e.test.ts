import { NextRequest } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { groth16 } from 'snarkjs';
import {
  POST as fetchTxPost,
  __disposeOracleFetchRouteForTests,
} from '@/app/api/oracle/fetch-tx/route';
import { POST as createSharePointerPost } from '@/app/api/share-pointer/create/route';
import { POST as resolveSharePointerPost } from '@/app/api/share-pointer/resolve/route';
import { SuccessResponseSchema } from '@/lib/validation/schemas';
import { ProofGenerator } from '@/lib/zk/prover';
import { verifySharedReceiptProof } from '@/lib/verify/receipt-verifier';
import { __resetSharePointerManagerForTests } from '@/lib/share/share-pointer-service';
import { buildWitness, validateWitness } from '@ghostreceipt/zk-core/witness';
import { loadEnvLocalForLiveTests } from './helpers/load-env-local';

const describeLive = process.env['LIVE_INTEGRATION'] === '1' ? describe : describe.skip;

loadEnvLocalForLiveTests();

const LIVE_BTC_TX_HASH = (
  process.env['LIVE_BTC_TX_HASH']?.trim() ??
  'e35832f21a165077c3e8e94a97e57916558d7e3a66e56febbfa15eb8a6f638e1'
).toLowerCase();

const ZK_WASM_PATH = path.join(process.cwd(), 'public/zk/receipt_js/receipt.wasm');
const ZK_ZKEY_PATH = path.join(process.cwd(), 'public/zk/receipt_final.zkey');
const ZK_VKEY_PATH = path.join(process.cwd(), 'public/zk/verification_key.json');

function createJsonRequest(pathname: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost:3000${pathname}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describeLive('Live BTC -> Share Pointer -> Verify Link E2E', () => {
  jest.setTimeout(240000);

  const originalOraclePrivateKey = process.env['ORACLE_PRIVATE_KEY'];

  beforeAll(async () => {
    process.env['ORACLE_PRIVATE_KEY'] = (process.env['ORACLE_PRIVATE_KEY']?.trim() || '1'.repeat(64));
    await __resetSharePointerManagerForTests();
  });

  afterAll(async () => {
    if (originalOraclePrivateKey === undefined) {
      delete process.env['ORACLE_PRIVATE_KEY'];
    } else {
      process.env['ORACLE_PRIVATE_KEY'] = originalOraclePrivateKey;
    }

    __disposeOracleFetchRouteForTests();
    await __resetSharePointerManagerForTests();
  });

  it('creates a share link from live BTC tx and verifies resolved payload as valid', async () => {
    expect(LIVE_BTC_TX_HASH).toMatch(/^[a-f0-9]{64}$/u);

    const fetchTxResponse = await fetchTxPost(
      createJsonRequest('/api/oracle/fetch-tx', {
        chain: 'bitcoin',
        txHash: LIVE_BTC_TX_HASH,
      })
    );
    const fetchTxBody = (await fetchTxResponse.json()) as unknown;
    expect(fetchTxResponse.status).toBe(200);

    const parsed = SuccessResponseSchema.safeParse(fetchTxBody);
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }

    const oraclePayload = parsed.data.data;
    const claimedAmount = '1';
    const minDateUnix = Math.floor(new Date('2020-01-01T00:00:00.000Z').getTime() / 1000);

    const witness = buildWitness(oraclePayload, {
      claimedAmount,
      minDate: minDateUnix,
    });
    const witnessValidation = validateWitness(witness);
    expect(witnessValidation.valid).toBe(true);

    const proveResult = await groth16.fullProve(
      witness as any,
      ZK_WASM_PATH,
      ZK_ZKEY_PATH
    );
    const vkeyRaw = await readFile(ZK_VKEY_PATH, 'utf8');
    const vkey = JSON.parse(vkeyRaw) as Record<string, unknown>;
    const proofIsValid = await groth16.verify(
      vkey,
      proveResult.publicSignals as any,
      proveResult.proof as any
    );
    expect(proofIsValid).toBe(true);

    const proofGenerator = new ProofGenerator(
      ZK_WASM_PATH,
      ZK_ZKEY_PATH,
      ZK_VKEY_PATH
    );

    const shareableProof = await proofGenerator.exportProof(
      {
        proof: proveResult.proof as any,
        publicSignals: proveResult.publicSignals as string[],
      },
      {
        expiresAt: oraclePayload.expiresAt,
        messageHash: oraclePayload.messageHash,
        nullifier: oraclePayload.nullifier,
        nonce: oraclePayload.nonce,
        oracleSignature: oraclePayload.oracleSignature,
        oraclePubKeyId: oraclePayload.oraclePubKeyId,
        signedAt: oraclePayload.signedAt,
      },
      {
        ...(oraclePayload.oracleValidationLabel
          ? { oracleValidationLabel: oraclePayload.oracleValidationLabel }
          : {}),
        ...(oraclePayload.oracleValidationStatus
          ? { oracleValidationStatus: oraclePayload.oracleValidationStatus }
          : {}),
      },
      {
        claimedAmount,
        discloseAmount: true,
        discloseMinDate: true,
        minDateUnix,
      }
    );

    const createPointerResponse = await createSharePointerPost(
      createJsonRequest('/api/share-pointer/create', { proof: shareableProof })
    );
    const createPointerBody = (await createPointerResponse.json()) as {
      data: { id: string; verifyUrl: string };
    };
    expect(createPointerResponse.status).toBe(200);
    expect(createPointerBody.data.id).toMatch(/^r_[A-Za-z0-9_-]{16}$/u);
    expect(createPointerBody.data.verifyUrl).toContain('/verify?sid=');

    const verifyUrl = new URL(createPointerBody.data.verifyUrl);
    const sid = verifyUrl.searchParams.get('sid');
    expect(sid).toBeTruthy();
    if (!sid) {
      return;
    }

    const resolvePointerResponse = await resolveSharePointerPost(
      createJsonRequest('/api/share-pointer/resolve', { id: sid })
    );
    const resolvePointerBody = (await resolvePointerResponse.json()) as {
      data: { proof: string };
    };
    expect(resolvePointerResponse.status).toBe(200);
    expect(resolvePointerBody.data.proof).toBe(shareableProof);

    const verificationResult = await verifySharedReceiptProof(resolvePointerBody.data.proof, {
      createProofGenerator: () => ({
        importProof: (payload: string) => proofGenerator.importProof(payload),
        verifyProof: async (publicSignals, proof) => ({
          valid: await groth16.verify(vkey, publicSignals as any, proof as any),
        }),
      }),
      signatureVerifier: async () => ({ valid: true }),
      storage: null,
    });

    expect(verificationResult.valid).toBe(true);
  });
});
