'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { extractVerifiedClaims } from '@/lib/zk/share';
import { EyeCandy } from '@/components/eye-candy';
import { AnimatedTagline } from '@/components/animated-tagline';
import TextPressure from '@/components/text-pressure';

interface VerificationResult {
  valid: boolean;
  claimedAmount: string;
  minDate: string;
  error?: string | undefined;
}

interface OracleSignatureVerificationResult {
  valid: boolean;
  error?: string;
}

interface NullifierVerificationResult {
  valid: boolean;
  error?: string;
}

interface OracleAuthPayload {
  expiresAt: number;
  messageHash: string;
  nullifier: string;
  nonce: string;
  oracleSignature: string;
  oraclePubKeyId: string;
  signedAt: number;
}

async function verifyOracleSignature(oracleAuth: OracleAuthPayload): Promise<OracleSignatureVerificationResult> {
  const { expiresAt, messageHash, nonce, oracleSignature, oraclePubKeyId, signedAt } = oracleAuth;
  const response = await fetch('/api/oracle/verify-signature', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      expiresAt,
      messageHash,
      nonce,
      oracleSignature,
      oraclePubKeyId,
      signedAt,
    }),
  });

  if (!response.ok) {
    try {
      const payload = (await response.json()) as {
        error?: {
          message?: string;
          details?: {
            retryAfterSeconds?: number;
          };
        };
      };
      if (response.status === 429) {
        const retryAfterSeconds = payload.error?.details?.retryAfterSeconds;
        const waitSeconds =
          typeof retryAfterSeconds === 'number' && retryAfterSeconds > 0
            ? Math.ceil(retryAfterSeconds)
            : 60;
        const waitLabel = waitSeconds === 1 ? '1 second' : `${waitSeconds} seconds`;
        return {
          valid: false,
          error: `Rate limit reached. Please wait ${waitLabel} and try again.`,
        };
      }

      return {
        valid: false,
        error: payload.error?.message ?? 'Oracle signature verification failed',
      };
    } catch {
      return {
        valid: false,
        error: 'Oracle signature verification failed',
      };
    }
  }

  const payload = (await response.json()) as {
    message?: string;
    reason?: string;
    valid?: boolean;
  };
  return {
    valid: payload.valid === true,
    ...(payload.valid === true
      ? {}
      : {
          error: payload.message ?? 'Oracle signature verification failed',
        }),
  };
}

async function checkNullifierConflict(input: {
  claimedAmount: string;
  messageHash: string;
  minDateUnix: number;
  nullifier: string;
}): Promise<NullifierVerificationResult> {
  const response = await fetch('/api/oracle/check-nullifier', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    try {
      const payload = (await response.json()) as {
        error?: {
          message?: string;
          details?: {
            retryAfterSeconds?: number;
          };
        };
      };
      if (response.status === 429) {
        const retryAfterSeconds = payload.error?.details?.retryAfterSeconds;
        const waitSeconds =
          typeof retryAfterSeconds === 'number' && retryAfterSeconds > 0
            ? Math.ceil(retryAfterSeconds)
            : 60;
        const waitLabel = waitSeconds === 1 ? '1 second' : `${waitSeconds} seconds`;
        return {
          valid: false,
          error: `Rate limit reached. Please wait ${waitLabel} and try again.`,
        };
      }

      return {
        valid: false,
        error: payload.error?.message ?? 'Nullifier verification failed',
      };
    } catch {
      return {
        valid: false,
        error: 'Nullifier verification failed',
      };
    }
  }

  const payload = (await response.json()) as { valid?: boolean };
  return {
    valid: payload.valid === true,
    ...(payload.valid === true ? {} : { error: 'Nullifier verification failed' }),
  };
}

function VerifyContent(): React.JSX.Element {
  const searchParams = useSearchParams();
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    verifyReceipt();
  }, [searchParams]);

  const verifyReceipt = async (): Promise<void> => {
    try {
      const proof = searchParams.get('proof');

      if (!proof) {
        setResult({
          valid: false,
          claimedAmount: '',
          minDate: '',
          error: 'Missing verification parameters',
        });
        setLoading(false);
        return;
      }

      // Import proof
      const { createProofGenerator } = await import('@/lib/zk/prover');
      const prover = createProofGenerator();
      const proofData = prover.importProof(proof);

      // Verify proof
      const verification = await prover.verifyProof(
        proofData.publicSignals,
        proofData.proof
      );

      if (!verification.valid) {
        setResult({
          valid: false,
          claimedAmount: '',
          minDate: '',
          error: verification.error,
        });
        return;
      }

      const oracleAuth = proofData.oracleAuth;
      if (!oracleAuth) {
        setResult({
          valid: false,
          claimedAmount: '',
          minDate: '',
          error: 'Missing oracle authentication data in shared receipt',
        });
        return;
      }

      if (proofData.publicSignals.length < 3) {
        setResult({
          valid: false,
          claimedAmount: '',
          minDate: '',
          error: 'Invalid proof: missing oracle commitment signal',
        });
        return;
      }

      const oracleCommitmentSignal = proofData.publicSignals[2];
      if (oracleCommitmentSignal !== oracleAuth.messageHash) {
        setResult({
          valid: false,
          claimedAmount: '',
          minDate: '',
          error: 'Oracle commitment mismatch detected',
        });
        return;
      }

      const oracleSignatureVerification = await verifyOracleSignature(oracleAuth);
      if (!oracleSignatureVerification.valid) {
        setResult({
          valid: false,
          claimedAmount: '',
          minDate: '',
          error:
            oracleSignatureVerification.error ??
            'Oracle signature verification failed',
        });
        return;
      }

      const claims = extractVerifiedClaims(proofData.publicSignals);
      const nullifierVerification = await checkNullifierConflict({
        claimedAmount: claims.claimedAmount,
        messageHash: oracleAuth.messageHash,
        minDateUnix: claims.minDateUnix,
        nullifier: oracleAuth.nullifier,
      });
      if (!nullifierVerification.valid) {
        setResult({
          valid: false,
          claimedAmount: '',
          minDate: '',
          error:
            nullifierVerification.error ??
            'Nullifier verification failed',
        });
        return;
      }

      setResult({
        valid: true,
        claimedAmount: claims.claimedAmount,
        minDate: claims.minDateIsoUtc,
        error: verification.error,
      });
    } catch (error) {
      setResult({
        valid: false,
        claimedAmount: '',
        minDate: '',
        error: error instanceof Error ? error.message : 'Verification failed',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <EyeCandy />
        <main className="flex min-h-screen flex-col items-center justify-center p-4 pb-20">
          <div className="w-full max-w-2xl space-y-8 fade-up">
            <div className="text-center space-y-3">
              <h1 className="sr-only">GhostReceipt</h1>
              <div aria-hidden="true">
                <TextPressure text="GhostReceipt" textColor="#ffffff" minFontSize={52} className="glow-heading justify-center" />
              </div>
              <p className="text-base text-white/50 tracking-wide">Verifying receipt...</p>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <EyeCandy />
      <main className="flex min-h-screen flex-col items-center justify-center p-4 pb-20">
        <div className="w-full max-w-2xl space-y-8 fade-up">
          <div className="text-center space-y-3">
            <h1 className="sr-only">GhostReceipt</h1>
            <div aria-hidden="true">
              <TextPressure text="GhostReceipt" textColor="#ffffff" minFontSize={52} className="glow-heading justify-center" />
            </div>
            <AnimatedTagline text="Payment Receipt Verification" />
          </div>

          <div className="glass-card rounded-xl p-8 shadow-2xl">
          {result && (
            <div
              className={`rounded-lg border p-6 ${
                result.valid
                  ? 'bg-green-500/10 border-green-500/20'
                  : 'bg-red-500/10 border-red-500/20'
              }`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${
                      result.valid ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}
                >
                  {result.valid ? '✓' : '✗'}
                </div>
                <div>
                  <h3
                    className={`text-lg font-bold ${
                      result.valid ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {result.valid ? 'Valid Receipt' : 'Invalid Receipt'}
                  </h3>
                  <p className="text-xs text-white/40">
                    {result.valid
                      ? 'Zero-knowledge proof verified successfully'
                      : 'Proof verification failed'}
                  </p>
                </div>
              </div>

              {result.valid && (
                <div className="space-y-3 mt-6">
                  <div className="p-3 bg-white/5 rounded-lg border border-white/8">
                    <div className="text-xs text-white/40 mb-1">
                      Minimum Amount (atomic units)
                    </div>
                    <div className="text-sm font-semibold font-mono text-white">
                      {result.claimedAmount}
                    </div>
                  </div>

                  <div className="p-3 bg-white/5 rounded-lg border border-white/8">
                    <div className="text-xs text-white/40 mb-1">
                      Minimum Date
                    </div>
                    <div className="text-sm font-semibold text-white">{result.minDate}</div>
                  </div>

                  <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <p className="text-xs text-blue-300/80">
                      <strong className="text-blue-300">Privacy Protected:</strong> This receipt proves the payment
                      meets the claimed criteria without revealing the actual transaction
                      amount, timestamp, sender, or receiver addresses.
                    </p>
                  </div>
                </div>
              )}

              {!result.valid && result.error && (
                <div className="mt-4 p-3 bg-red-500/10 rounded-lg border border-red-500/20 text-sm text-red-400">
                  {result.error}
                </div>
              )}
            </div>
          )}

          <div className="mt-6">
            <Button
              onClick={() => (window.location.href = '/')}
              variant="secondary"
              className="w-full"
            >
              ← Generate New Receipt
            </Button>
          </div>
        </div>
      </div>
    </main>
    </>
  );
}

export default function VerifyPage(): React.JSX.Element {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen flex-col items-center justify-center p-4 pb-20">
          <div className="w-full max-w-2xl space-y-8 fade-up">
            <div className="text-center space-y-3">
              <h1 className="sr-only">GhostReceipt</h1>
              <div aria-hidden="true">
                <TextPressure text="GhostReceipt" textColor="#ffffff" minFontSize={52} className="glow-heading justify-center" />
              </div>
              <p className="text-base text-white/50 tracking-wide">Loading...</p>
            </div>
          </div>
        </main>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}
