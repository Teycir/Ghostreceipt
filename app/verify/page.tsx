'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { extractVerifiedClaims } from '@/lib/zk/share';

interface VerificationResult {
  valid: boolean;
  claimedAmount: string;
  minDate: string;
  error?: string | undefined;
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

      const claims = verification.valid
        ? extractVerifiedClaims(proofData.publicSignals)
        : null;

      setResult({
        valid: verification.valid,
        claimedAmount: claims?.claimedAmount ?? '',
        minDate: claims?.minDateIsoUtc ?? '',
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
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="w-full max-w-2xl space-y-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl mb-4">
              GhostReceipt
            </h1>
            <p className="text-lg text-muted-foreground">Verifying receipt...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            GhostReceipt
          </h1>
          <p className="text-lg text-muted-foreground">
            Payment Receipt Verification
          </p>
        </div>

        <div className="rounded-lg border bg-card p-8 shadow-sm">
          {result && (
            <div
              className={`rounded-lg border p-6 ${
                result.valid
                  ? 'bg-green-500/10 border-green-500/30'
                  : 'bg-red-500/10 border-red-500/30'
              }`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${
                    result.valid ? 'bg-green-500/20' : 'bg-red-500/20'
                  }`}
                >
                  {result.valid ? '✓' : '✗'}
                </div>
                <div>
                  <h3
                    className={`text-lg font-bold ${
                      result.valid ? 'text-green-500' : 'text-red-500'
                    }`}
                  >
                    {result.valid ? 'Valid Receipt' : 'Invalid Receipt'}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {result.valid
                      ? 'Zero-knowledge proof verified successfully'
                      : 'Proof verification failed'}
                  </p>
                </div>
              </div>

              {result.valid && (
                <div className="space-y-3 mt-6">
                  <div className="p-3 bg-background/50 rounded-md">
                    <div className="text-xs text-muted-foreground mb-1">
                      Minimum Amount (atomic units)
                    </div>
                    <div className="text-sm font-semibold font-mono">
                      {result.claimedAmount}
                    </div>
                  </div>

                  <div className="p-3 bg-background/50 rounded-md">
                    <div className="text-xs text-muted-foreground mb-1">
                      Minimum Date
                    </div>
                    <div className="text-sm font-semibold">{result.minDate}</div>
                  </div>

                  <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-md">
                    <p className="text-xs text-blue-500">
                      <strong>Privacy Protected:</strong> This receipt proves the payment
                      meets the claimed criteria without revealing the actual transaction
                      amount, timestamp, sender, or receiver addresses.
                    </p>
                  </div>
                </div>
              )}

              {!result.valid && result.error && (
                <div className="mt-4 p-3 bg-red-500/10 rounded-md text-sm text-red-500">
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
  );
}

export default function VerifyPage(): React.JSX.Element {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen flex-col items-center justify-center p-4">
          <div className="w-full max-w-2xl space-y-8">
            <div className="text-center">
              <h1 className="text-4xl font-bold tracking-tight sm:text-6xl mb-4">
                GhostReceipt
              </h1>
              <p className="text-lg text-muted-foreground">Loading...</p>
            </div>
          </div>
        </main>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}
