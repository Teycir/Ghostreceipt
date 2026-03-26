'use client';

/**
 * components/generator/receipt-success.tsx
 *
 * Pure rendering layer — NO async logic, NO QR generation, NO sharing calls.
 * All side-effects live in useReceiptShare().
 */

import { useState, useEffect } from 'react';
import { Button }       from '@/components/ui/button';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { ValidationStrengthBadge } from '@/components/ui/validation-strength-badge';
import { useReceiptShare } from '@/lib/generator/use-receipt-share';
import { toHumanAmount } from '@/lib/format/units';
import type {
  Chain,
  EthereumAsset,
  GeneratorTimingTelemetry,
  OracleValidationStatus,
  ProofRuntimeTelemetry,
} from '@/lib/generator/types';
import type { SocialNetwork } from '@/lib/share/social';

interface ReceiptSuccessProps {
  proof:          string;
  chain:          Chain;
  ethereumAsset:  EthereumAsset;
  claimedAmount:  string;
  claimedAmountDisclosure: 'disclosed' | 'hidden';
  minDate:        string;
  minDateDisclosure: 'disclosed' | 'hidden';
  oracleValidationStatus?: OracleValidationStatus;
  oracleValidationLabel?: string;
  proofRuntime?: ProofRuntimeTelemetry;
  receiptLabel?:  string;
  receiptCategory?: string;
  timings?:       GeneratorTimingTelemetry;
}

function formatChainLabel(chain: Chain, ethereumAsset: EthereumAsset): string {
  const LABELS: Record<Chain, string> = {
    bitcoin:  '₿ Bitcoin',
    ethereum: ethereumAsset === 'usdc' ? 'Ξ Ethereum (USDC)' : 'Ξ Ethereum',
    solana:   '◎ Solana',
  };
  return LABELS[chain] ?? chain;
}

const SOCIAL_BUTTONS: { label: string; network: SocialNetwork }[] = [
  { label: '𝕏 Post',       network: 'x'        },
  { label: '✈ Telegram',   network: 'telegram'  },
  { label: 'in LinkedIn',  network: 'linkedin'  },
  { label: '↗ Reddit',     network: 'reddit'    },
];

export function ReceiptSuccess({
  proof,
  chain,
  ethereumAsset,
  claimedAmount,
  claimedAmountDisclosure,
  minDate,
  minDateDisclosure,
  oracleValidationStatus,
  oracleValidationLabel,
  proofRuntime,
  receiptLabel,
  receiptCategory,
  timings,
}: Readonly<ReceiptSuccessProps>): React.JSX.Element {
  const {
    verifyUrl,
    verificationCode,
    qrCode,
    qrError,
    shareStatus,
    copied,
    copyFlavor,
    nativeShareAvailable,
    copyLink,
    copyShareBundle,
    shareToNetwork,
    shareNatively,
    downloadQR,
    openReceipt,
    exportPdf,
  } = useReceiptShare({
    proof,
    chain,
    ethereumAsset,
    claimedAmount,
    minDate,
    ...(receiptLabel ? { receiptLabel } : {}),
    ...(receiptCategory ? { receiptCategory } : {}),
  });

  // Stagger-reveal the card on mount
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const t = globalThis.setTimeout(() => setRevealed(true), 60);
    return () => globalThis.clearTimeout(t);
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent): void => {
      const withModifier = event.metaKey || event.ctrlKey;
      if (!withModifier || event.key.toLowerCase() !== 'c') {
        return;
      }

      const selectedText = globalThis.getSelection?.()?.toString().trim();
      if (selectedText) {
        return;
      }

      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName.toLowerCase();
        const isEditableTag = tag === 'input' || tag === 'textarea' || tag === 'select';
        if (isEditableTag || target.isContentEditable) {
          return;
        }
      }

      event.preventDefault();
      void copyLink();
    };

    globalThis.addEventListener('keydown', handleShortcut);
    return () => {
      globalThis.removeEventListener('keydown', handleShortcut);
    };
  }, [copyLink]);

  const receiptFields = [
    { label: 'Chain',    value: formatChainLabel(chain, ethereumAsset),                                 delay: '0.15s' },
    { label: 'Amount',   value: `${claimedAmount} (${toHumanAmount(claimedAmount, chain, ethereumAsset)})`, delay: '0.25s' },
    { label: 'Min Date', value: minDate,                                                  delay: '0.35s' },
    ...(receiptLabel ? [{ label: 'Label', value: receiptLabel, delay: '0.45s' }] : []),
    ...(receiptCategory ? [{ label: 'Category', value: receiptCategory, delay: '0.55s' }] : []),
  ] as const;

  return (
    <div
      className={`receipt-reveal space-y-4 ${revealed ? 'receipt-reveal--in' : ''}`}
      aria-live="polite"
      aria-label="Receipt generated"
    >
      {/* ── Hero success card ── */}
      <div className="receipt-card receipt-card--success">
        <div className="receipt-card__burst" aria-hidden="true" />

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="receipt-checkmark" aria-hidden="true">
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="20" cy="20" r="19" stroke="#34d399" strokeWidth="1.5" opacity="0.4" />
              <circle
                cx="20" cy="20" r="19"
                stroke="#34d399" strokeWidth="1.5"
                strokeDasharray="120" strokeDashoffset="120"
                className="receipt-checkmark__ring"
              />
              <polyline
                points="12,21 18,27 29,14"
                stroke="#34d399" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray="30" strokeDashoffset="30"
                className="receipt-checkmark__tick"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-emerald-400 leading-tight">Receipt Generated</h3>
            <p className="text-xs text-white/40 mt-0.5">Zero-knowledge proof ready to share</p>
          </div>
        </div>

        {/* Fields */}
        <div className="space-y-2.5">
          {receiptFields.map(({ label, value, delay }) => (
            <div key={label} className="receipt-field" style={{ animationDelay: delay }}>
              <span className="receipt-field__label">{label}</span>
              <span className="receipt-field__value font-mono">{value}</span>
            </div>
          ))}
          {(oracleValidationStatus || oracleValidationLabel) && (
            <div className="receipt-field" style={{ animationDelay: '0.45s' }}>
              <span className="receipt-field__label">Validation</span>
              <ValidationStrengthBadge
                status={oracleValidationStatus}
                label={oracleValidationLabel}
                className="receipt-field__value"
              />
            </div>
          )}
        </div>

        {(timings || proofRuntime) && (
          <div className="mt-4 rounded-lg border border-cyan-400/20 bg-cyan-500/5 p-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-cyan-300/80 mb-2">
              Generation Telemetry (ms)
            </p>
            {timings && (
              <div className="grid grid-cols-2 gap-2 text-xs text-cyan-100/85 font-mono">
                <span>fetch: {Math.round(timings.fetchMs)}</span>
                <span>witness: {Math.round(timings.witnessMs)}</span>
                <span>prove: {Math.round(timings.proveMs)}</span>
                <span>package: {Math.round(timings.packageMs)}</span>
                <span className="col-span-2">total: {Math.round(timings.totalMs)}</span>
              </div>
            )}
            {proofRuntime && (
              <p className={`text-xs text-cyan-100/85 ${timings ? 'mt-2' : ''}`}>
                Runtime: <span className="font-mono">
                  {proofRuntime.backend} / {proofRuntime.executionMode} / v{proofRuntime.artifactVersion}
                </span>
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Share card ── */}
      <div className="glass-card rounded-xl p-5 space-y-3">
        <p className="text-xs uppercase tracking-[0.14em] text-white/50">Share Receipt</p>
        <p className="text-xs text-white/55">Verification URL</p>
        <code className="block w-full max-h-24 overflow-auto break-all rounded-lg border border-white/12 bg-black/35 px-3 py-2 text-[11px] text-white/85">
          {verifyUrl || 'Preparing link…'}
        </code>
        <div className="rounded-lg border border-cyan-300/20 bg-cyan-500/5 px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.12em] text-cyan-200/70">
            Verification Code
          </p>
          <p className="mt-1 font-mono text-sm text-cyan-100">{verificationCode}</p>
        </div>

        <Button
          type="button"
          onClick={() => { void copyShareBundle(); }}
          variant="primary"
          className="w-full"
        >
          {copied && copyFlavor === 'bundle'
            ? '✓ Copied Share Packet'
            : '⎘ Copy Link + Code (All)'}
        </Button>
        <Button type="button" onClick={() => { void copyLink(); }} variant="primary" className="w-full">
          {copied && copyFlavor === 'url'
            ? '✓ Copied Verify URL'
            : '⎘ Copy Verify URL'}
        </Button>
        <Button
          type="button"
          onClick={() => { void shareNatively(); }}
          variant={nativeShareAvailable ? 'primary' : 'secondary'}
          className="w-full"
        >
          {nativeShareAvailable ? '↗ Share via Apps (Recommended)' : '↗ Share Link'}
        </Button>
        <Button type="button" onClick={exportPdf} variant="secondary" className="w-full">
          ↓ Export as PDF
        </Button>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SOCIAL_BUTTONS.map(({ label, network }) => (
            <Button
              key={network}
              type="button"
              variant="secondary"
              className="text-xs"
              onClick={() => shareToNetwork(network)}
            >
              {label}
            </Button>
          ))}
        </div>

        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.12em] text-white/45">
            Keyboard Shortcuts
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-white/70">
            <span className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono">Cmd/Ctrl + C</span>
            <span>copy verify URL</span>
            <span className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono">Cmd/Ctrl + Enter</span>
            <span>generate</span>
            <span className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono">Cmd/Ctrl + V</span>
            <span>paste tx hash</span>
          </div>
        </div>
      </div>

      {/* ── Recipient preview ── */}
      <div className="glass-card rounded-xl p-5 space-y-3">
        <p className="text-xs uppercase tracking-[0.14em] text-white/50">Recipient Preview</p>
        <p className="text-xs text-white/55">
          This is what someone sees on the verification page after opening your shared link.
        </p>
        <div className="space-y-2 text-sm">
          <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
            <span className="flex items-center gap-1.5 text-white/50">
              Amount
              <InfoTooltip
                label="What does this prove?"
                content="The verifier can confirm your payment met this minimum amount without exposing wallet addresses."
              />
            </span>
            <p className="mt-0.5 font-mono text-white/90">
              {claimedAmountDisclosure === 'disclosed'
                ? `${claimedAmount} (${toHumanAmount(claimedAmount, chain, ethereumAsset)})`
                : 'Hidden'}
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
            <span className="flex items-center gap-1.5 text-white/50">
              Minimum Date
              <InfoTooltip
                label="Why is this hidden?"
                content="Hidden fields protect privacy while the proof still verifies your claim thresholds."
              />
            </span>
            <p className="mt-0.5 font-mono text-white/90">
              {minDateDisclosure === 'disclosed' ? minDate : 'Hidden'}
            </p>
          </div>
          {(receiptLabel || receiptCategory) && (
            <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
              <span className="text-white/50">Metadata</span>
              <p className="mt-0.5 text-white/90">
                {receiptLabel ? `Label: ${receiptLabel}` : 'Label: n/a'}
                <br />
                {receiptCategory ? `Category: ${receiptCategory}` : 'Category: n/a'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── QR code ── */}
      {qrCode && (
        <div className="glass-card rounded-xl p-6 text-center space-y-4">
          <p className="text-sm font-medium text-white/70">Scan to verify receipt</p>
          <div className="flex justify-center">
            <div className="qr-frame">
              <img
                src={qrCode}
                alt="Receipt QR Code — scan to open the verify page"
                className="h-72 w-72 block sm:h-80 sm:w-80"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" onClick={downloadQR}   variant="secondary" className="text-sm">↓ Download QR</Button>
            <Button type="button" onClick={openReceipt}  variant="secondary" className="text-sm">👁 Open Receipt</Button>
          </div>
        </div>
      )}

      {(shareStatus || qrError) && (
        <div className="glass-card rounded-xl border border-cyan-300/15 bg-cyan-500/5 px-4 py-3">
          {shareStatus && (
            <p className="text-xs text-cyan-200/85" aria-live="polite">
              {shareStatus}
            </p>
          )}
          {qrError && (
            <p className="mt-1 text-xs text-amber-300/85" aria-live="polite">
              {qrError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
