'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import type { Chain } from '@/lib/validation/schemas';

interface ReceiptSuccessProps {
  proof: string;
  chain: Chain;
  claimedAmount: string;
  minDate: string;
}

export function ReceiptSuccess({
  proof,
  chain,
  claimedAmount,
  minDate,
}: ReceiptSuccessProps): React.JSX.Element {
  const [qrCode, setQrCode] = useState<string>('');
  const [qrError, setQrError] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [shareStatus, setShareStatus] = useState<string>('');

  useEffect(() => {
    void generateQR();
  }, [proof]);

  const generateQR = async (): Promise<void> => {
    try {
      const QRCode = (await import('qrcode')).default;
      const verifyUrl = getVerifyUrl();
      setQrError('');
      
      const qr = await QRCode.toDataURL(verifyUrl, {
        errorCorrectionLevel: 'H',
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
      
      setQrCode(qr);
    } catch (error) {
      console.error('QR generation failed:', error instanceof Error ? error.message : error);
      setQrError('Could not generate QR code. You can still copy the verification link.');
    }
  };

  const getVerifyUrl = (): string => {
    const params = new URLSearchParams({
      proof,
    });
    
    return `${window.location.origin}/verify?${params.toString()}`;
  };

  const copyLink = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(getVerifyUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      setShareStatus('Link copied');
    } catch (error) {
      console.error('Copy failed:', error instanceof Error ? error.message : error);
      setShareStatus('Copy failed');
    }
  };

  const getShareText = (): string => {
    return `I generated a privacy-preserving ${chain} receipt with GhostReceipt. Verify it here:`;
  };

  const shareToNetwork = (network: 'x' | 'telegram' | 'linkedin' | 'reddit'): void => {
    const url = encodeURIComponent(getVerifyUrl());
    const text = encodeURIComponent(getShareText());
    const title = encodeURIComponent('GhostReceipt verification link');

    const shareUrls: Record<typeof network, string> = {
      x: `https://x.com/intent/tweet?text=${text}%20${url}`,
      telegram: `https://t.me/share/url?url=${url}&text=${text}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
      reddit: `https://www.reddit.com/submit?url=${url}&title=${title}`,
    };

    window.open(shareUrls[network], '_blank', 'noopener,noreferrer');
  };

  const shareNatively = async (): Promise<void> => {
    const shareData = {
      title: 'GhostReceipt Verification Link',
      text: getShareText(),
      url: getVerifyUrl(),
    };

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share(shareData);
        setShareStatus('Shared successfully');
        return;
      }
      await navigator.clipboard.writeText(shareData.url);
      setShareStatus('Copied link (native share unavailable)');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setShareStatus('Share cancelled');
        return;
      }
      console.error('Native share failed:', error instanceof Error ? error.message : error);
      setShareStatus('Share failed');
    }
  };

  const downloadQR = (): void => {
    if (!qrCode) return;
    
    const link = document.createElement('a');
    link.download = `ghostreceipt-${Date.now()}.png`;
    link.href = qrCode;
    link.click();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-xl text-green-400">
            ✓
          </div>
          <div>
            <h3 className="text-lg font-bold text-green-400">Receipt Generated</h3>
            <p className="text-xs text-white/40">
              Your zero-knowledge payment proof is ready
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="p-3 bg-white/5 rounded-lg border border-white/8">
            <div className="text-xs text-white/40 mb-1">Chain</div>
            <div className="text-sm font-semibold capitalize text-white">{chain}</div>
          </div>

          <div className="p-3 bg-white/5 rounded-lg border border-white/8">
            <div className="text-xs text-white/40 mb-1">
              Claimed Amount {chain === 'bitcoin' ? '(satoshis)' : '(wei)'}
            </div>
            <div className="text-sm font-semibold font-mono text-white">{claimedAmount}</div>
          </div>

          <div className="p-3 bg-white/5 rounded-lg border border-white/8">
            <div className="text-xs text-white/40 mb-1">Minimum Date</div>
            <div className="text-sm font-semibold text-white">{minDate}</div>
          </div>
        </div>
      </div>

      {qrCode && (
        <div className="glass-card rounded-xl p-6 text-center">
          <p className="text-sm font-medium mb-4 text-white/70">Scan to verify receipt</p>
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-white rounded-xl">
              <img src={qrCode} alt="Receipt QR Code" className="w-48 h-48" />
            </div>
          </div>
          <Button type="button" onClick={downloadQR} variant="secondary" className="w-full">
            📥 Download QR Code
          </Button>
        </div>
      )}

      {qrError && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-sm text-amber-400">
          {qrError}
        </div>
      )}

      <div className="space-y-2">
        <Button type="button" onClick={copyLink} variant="primary" className="w-full">
          {copied ? '✓ Copied!' : '🔗 Copy Verification Link'}
        </Button>
        
        <Button
          type="button"
          onClick={() => window.location.href = getVerifyUrl()}
          variant="secondary"
          className="w-full"
        >
          👁️ View Receipt
        </Button>
      </div>

      <div className="glass-card rounded-xl p-4">
        <p className="text-xs uppercase tracking-[0.14em] text-white/50 mb-3">Share to Social</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Button
            type="button"
            variant="secondary"
            className="text-xs sm:text-sm"
            onClick={() => {
              void shareNatively();
            }}
          >
            Share
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="text-xs sm:text-sm"
            onClick={() => shareToNetwork('x')}
          >
            X
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="text-xs sm:text-sm"
            onClick={() => shareToNetwork('telegram')}
          >
            Telegram
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="text-xs sm:text-sm"
            onClick={() => shareToNetwork('linkedin')}
          >
            LinkedIn
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="text-xs sm:text-sm"
            onClick={() => shareToNetwork('reddit')}
          >
            Reddit
          </Button>
        </div>
        {shareStatus && (
          <p className="mt-3 text-xs text-white/55">{shareStatus}</p>
        )}
      </div>
    </div>
  );
}
