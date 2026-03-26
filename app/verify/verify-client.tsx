'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { UnifiedPageShell } from '@/components/unified-page-shell';
import { Button } from '@/components/ui/button';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { ValidationStrengthBadge } from '@/components/ui/validation-strength-badge';
import { resolveSharePointerLink } from '@/lib/share/share-pointer-client';
import { verifySharedReceiptProof, type ReceiptVerificationResult } from '@/lib/verify/receipt-verifier';

interface VerifyPageChromeProps {
  children: React.ReactNode;
}

function VerifyPageChrome({ children }: Readonly<VerifyPageChromeProps>): React.JSX.Element {
  return (
    <UnifiedPageShell
      srTitle="GhostReceipt Verification"
      tagline="Payment Receipt Verification"
      leftNavLink={{
        href: '/',
        label: 'Generator',
        ariaLabel: 'Back to receipt generator',
      }}
      rightNavLink={{
        href: '/history',
        label: 'History',
        ariaLabel: 'Open local receipt history',
      }}
    >
      {children}
    </UnifiedPageShell>
  );
}

function VerifyContent(): React.JSX.Element {
  const searchParams = useSearchParams();
  const [result, setResult] = useState<ReceiptVerificationResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void verifyReceipt();
  }, [searchParams]);

  const verifyReceipt = async (): Promise<void> => {
    setLoading(true);
    try {
      const proofQuery = searchParams.get('proof')?.trim() ?? '';
      const sidQuery = searchParams.get('sid')?.trim() ?? '';

      let proofPayload = proofQuery;
      if (!proofPayload && sidQuery) {
        const resolved = await resolveSharePointerLink(sidQuery);
        proofPayload = resolved.proof;
      }

      const verificationResult = await verifySharedReceiptProof(proofPayload);
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

  const disclosureTone = (
    status: ReceiptVerificationResult['claimedAmountDisclosure']
  ): string => {
    return status === 'hidden'
      ? 'bg-amber-500/15 border-amber-400/30 text-amber-200'
      : 'bg-emerald-500/15 border-emerald-400/30 text-emerald-200';
  };

  const disclosureLabel = (
    status: ReceiptVerificationResult['claimedAmountDisclosure']
  ): string => {
    return status === 'hidden' ? 'Hidden' : 'Disclosed';
  };

  if (loading) {
    return (
      <VerifyPageChrome>
        <div className="glass-card rounded-xl p-8 shadow-2xl">
          <p className="text-base text-white/50 tracking-wide text-center">Verifying receipt...</p>
        </div>
      </VerifyPageChrome>
    );
  }

  return (
    <VerifyPageChrome>
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
                {(result.oracleValidationStatus || result.oracleValidationLabel) && (
                  <div className="p-3 bg-white/5 rounded-lg border border-white/8">
                    <div className="text-xs text-white/40 mb-2">
                      Validation Strength
                    </div>
                    <ValidationStrengthBadge
                      status={result.oracleValidationStatus}
                      label={result.oracleValidationLabel}
                    />
                  </div>
                )}

                <div className="p-3 bg-white/5 rounded-lg border border-white/8">
                  <div className="text-xs text-white/40 mb-1 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5">
                      Minimum Amount (atomic units)
                      <InfoTooltip
                        label="What does this prove?"
                        content="This receipt proves the payment met or exceeded the claimed minimum amount."
                      />
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${disclosureTone(
                        result.claimedAmountDisclosure
                      )}`}
                    >
                      {disclosureLabel(result.claimedAmountDisclosure)}
                    </span>
                  </div>
                  <div className="text-sm font-semibold font-mono text-white">
                    {result.claimedAmount}
                  </div>
                </div>

                <div className="p-3 bg-white/5 rounded-lg border border-white/8">
                  <div className="text-xs text-white/40 mb-1 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5">
                      Minimum Date
                      <InfoTooltip
                        label="Why is this hidden?"
                        content="Hidden values still verify cryptographically, without revealing sensitive exact details."
                      />
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${disclosureTone(
                        result.minDateDisclosure
                      )}`}
                    >
                      {disclosureLabel(result.minDateDisclosure)}
                    </span>
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

        <div className="mt-4 rounded-lg border border-cyan-300/20 bg-cyan-500/5 p-4">
          <p className="text-[10px] uppercase tracking-[0.12em] text-cyan-200/70">
            Generated With GhostReceipt
          </p>
          <p className="mt-1 text-xs text-cyan-100/85">
            Share private payment proof links without exposing wallet addresses.
          </p>
          <Button
            onClick={() => (window.location.href = '/')}
            variant="secondary"
            className="mt-3 w-full border-cyan-300/30 bg-cyan-500/10 text-cyan-100 hover:border-cyan-200/50 hover:bg-cyan-500/15"
          >
            Generate Your Own →
          </Button>
        </div>

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
    </VerifyPageChrome>
  );
}

export default function VerifyClientPage(): React.JSX.Element {
  return (
    <Suspense
      fallback={
        <VerifyPageChrome>
          <div className="glass-card rounded-xl p-8 shadow-2xl">
            <p className="text-base text-white/50 tracking-wide text-center">Loading...</p>
          </div>
        </VerifyPageChrome>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}
