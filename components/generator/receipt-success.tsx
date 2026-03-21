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
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    generateQR();
  }, [proof]);

  const generateQR = async (): Promise<void> => {
    try {
      const QRCode = (await import('qrcode')).default;
      const verifyUrl = getVerifyUrl();
      
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
    }
  };

  const getVerifyUrl = (): string => {
    const params = new URLSearchParams({
      proof: encodeURIComponent(proof),
      chain,
      amount: claimedAmount,
      date: minDate,
    });
    
    return `${window.location.origin}/verify?${params.toString()}`;
  };

  const copyLink = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(getVerifyUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Copy failed:', error instanceof Error ? error.message : error);
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
      <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-xl">
            ✓
          </div>
          <div>
            <h3 className="text-lg font-bold text-green-500">Receipt Generated</h3>
            <p className="text-xs text-muted-foreground">
              Your zero-knowledge payment proof is ready
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="p-3 bg-background/50 rounded-md">
            <div className="text-xs text-muted-foreground mb-1">Chain</div>
            <div className="text-sm font-semibold capitalize">{chain}</div>
          </div>

          <div className="p-3 bg-background/50 rounded-md">
            <div className="text-xs text-muted-foreground mb-1">
              Claimed Amount {chain === 'bitcoin' ? '(satoshis)' : '(wei)'}
            </div>
            <div className="text-sm font-semibold font-mono">{claimedAmount}</div>
          </div>

          <div className="p-3 bg-background/50 rounded-md">
            <div className="text-xs text-muted-foreground mb-1">Minimum Date</div>
            <div className="text-sm font-semibold">{minDate}</div>
          </div>
        </div>
      </div>

      {qrCode && (
        <div className="rounded-lg border bg-card p-6 text-center">
          <p className="text-sm font-medium mb-4">Scan to verify receipt</p>
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-white rounded-lg">
              <img src={qrCode} alt="Receipt QR Code" className="w-48 h-48" />
            </div>
          </div>
          <Button onClick={downloadQR} variant="secondary" className="w-full">
            📥 Download QR Code
          </Button>
        </div>
      )}

      <div className="space-y-2">
        <Button onClick={copyLink} variant="primary" className="w-full">
          {copied ? '✓ Copied!' : '🔗 Copy Verification Link'}
        </Button>
        
        <Button
          onClick={() => window.location.href = getVerifyUrl()}
          variant="secondary"
          className="w-full"
        >
          👁️ View Receipt
        </Button>
      </div>
    </div>
  );
}
