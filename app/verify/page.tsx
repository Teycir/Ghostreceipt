'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { verifySharedReceiptProof, type ReceiptVerificationResult } from '@/lib/verify/receipt-verifier';
import { EyeCandy } from '@/components/eye-candy';
import { AnimatedTagline } from '@/components/animated-tagline';
import TextPressure from '@/components/text-pressure';

function VerifyContent(): React.JSX.Element {
  const searchParams = useSearchParams();
  const [result, setResult] = useState<ReceiptVerificationResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    verifyReceipt();
  }, [searchParams]);

  const verifyReceipt = async (): Promise<void> => {
    try {
      const proof = searchParams.get('proof');
      const verificationResult = await verifySharedReceiptProof(proof ?? '');
      setResult(verificationResult);
    } catch (error) {
      setResult({
        valid: false,
        claimedAmount: '',
        minDate: '',
        receiptCategory: '',
        receiptLabel: '',
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

                  {result.receiptLabel && (
                    <div className="p-3 bg-white/5 rounded-lg border border-white/8">
                      <div className="text-xs text-white/40 mb-1">
                        Label
                      </div>
                      <div className="text-sm font-semibold text-white break-words">{result.receiptLabel}</div>
                    </div>
                  )}

                  {result.receiptCategory && (
                    <div className="p-3 bg-white/5 rounded-lg border border-white/8">
                      <div className="text-xs text-white/40 mb-1">
                        Category
                      </div>
                      <div className="text-sm font-semibold text-white break-words">{result.receiptCategory}</div>
                    </div>
                  )}

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
