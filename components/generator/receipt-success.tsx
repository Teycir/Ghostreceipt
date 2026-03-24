'use client';

/**
 * components/generator/receipt-success.tsx
 *
 * Pure rendering layer — NO async logic, NO QR generation, NO sharing calls.
 * All side-effects live in useReceiptShare().
 */

import { useState, useEffect } from 'react';
import { Button }       from '@/components/ui/button';
import { useReceiptShare } from '@/lib/generator/use-receipt-share';
import { toHumanAmount } from '@/lib/format/units';
import type { Chain, EthereumAsset, GeneratorTimingTelemetry }   from '@/lib/generator/types';
import type { SocialNetwork } from '@/lib/share/social';

interface ReceiptSuccessProps {
  proof:          string;
  chain:          Chain;
  ethereumAsset:  EthereumAsset;
  claimedAmount:  string;
  minDate:        string;
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
  minDate,
  receiptLabel,
  receiptCategory,
  timings,
}: Readonly<ReceiptSuccessProps>): React.JSX.Element {
  const {
    verifyUrl,
    qrCode,
    qrError,
    shareStatus,
    copied,
    copyLink,
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
        </div>

        {timings && (
          <div className="mt-4 rounded-lg border border-cyan-400/20 bg-cyan-500/5 p-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-cyan-300/80 mb-2">
              Generation Telemetry (ms)
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs text-cyan-100/85 font-mono">
              <span>fetch: {Math.round(timings.fetchMs)}</span>
              <span>witness: {Math.round(timings.witnessMs)}</span>
              <span>prove: {Math.round(timings.proveMs)}</span>
              <span>package: {Math.round(timings.packageMs)}</span>
              <span className="col-span-2">total: {Math.round(timings.totalMs)}</span>
            </div>
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

        <Button type="button" onClick={() => { void copyLink(); }} variant="primary" className="w-full">
          {copied ? '✓ Copied! (Auto-clears in 60s)' : '⎘ Copy Verify URL'}
        </Button>
        <Button type="button" onClick={exportPdf} variant="secondary" className="w-full">
          ↓ Export as PDF
        </Button>
        <Button
          type="button"
          onClick={() => { globalThis.location.href = '/history'; }}
          variant="secondary"
          className="w-full"
        >
          View Local History
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
          <Button
            type="button"
            variant="secondary"
            className="text-xs col-span-2 sm:col-span-4"
            onClick={() => { void shareNatively(); }}
          >
            ↗ Share via…
          </Button>
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
                className="w-48 h-48 block"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" onClick={downloadQR}   variant="secondary" className="text-sm">↓ Download QR</Button>
            <Button type="button" onClick={openReceipt}  variant="secondary" className="text-sm">👁 Open Receipt</Button>
          </div>
        </div>
      )}

      {qrError && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-sm text-amber-400">
          {qrError}
        </div>
      )}

      {shareStatus && (
        <p className="text-xs text-white/55 px-1" aria-live="polite">{shareStatus}</p>
      )}
    </div>
  );
}
