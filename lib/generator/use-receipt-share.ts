'use client';

/**
 * lib/generator/use-receipt-share.ts
 *
 * Encapsulates all sharing / QR / clipboard logic for the receipt success screen.
 * ReceiptSuccess becomes a pure rendering component with no async side-effects.
 */

import { useState, useEffect, useCallback } from 'react';
import { useSecureClipboard } from '@/lib/shared/use-secure-clipboard';
import {
  buildSharePayload,
  openSocialShare,
  nativeShare,
} from '@/lib/share/social';
import type { SocialNetwork } from '@/lib/share/social';
import type { Chain } from '@/lib/generator/types';

interface UseReceiptShareOptions {
  proof: string;
  chain: Chain;
}

export interface UseReceiptShareReturn {
  /** Full verify URL — empty string while computing */
  verifyUrl: string;
  /** Base64 data-URL for QR code image — empty while generating */
  qrCode: string;
  /** Non-empty when QR generation fails */
  qrError: string;
  /** Transient status message (copy result, share result…) */
  shareStatus: string;
  /** True for ~2s after successful copy */
  copied: boolean;
  copyLink: () => Promise<void>;
  shareToNetwork: (network: SocialNetwork) => void;
  shareNatively: () => Promise<void>;
  downloadQR: () => void;
  openReceipt: () => void;
}

/** Builds the verify URL from the current origin */
function buildVerifyUrl(proof: string): string {
  const params = new URLSearchParams({ proof });
  return `${globalThis.location.origin}/verify?${params.toString()}`;
}

/** Generates a QR code data URL with dark, app-palette colours */
async function generateQRDataUrl(url: string): Promise<string> {
  const QRCode = (await import('qrcode')).default;
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: 'H',
    width: 256,
    margin: 2,
    color: { dark: '#22d3ee', light: '#080d1a' },
  });
}

export function useReceiptShare({ proof, chain }: Readonly<UseReceiptShareOptions>): UseReceiptShareReturn {
  const [verifyUrl, setVerifyUrl] = useState('');
  const [qrCode, setQrCode]       = useState('');
  const [qrError, setQrError]     = useState('');
  const [shareStatus, setShareStatus] = useState('');
  const { copied, copyToClipboard } = useSecureClipboard();

  // Build URL + QR whenever proof changes
  useEffect(() => {
    const url = buildVerifyUrl(proof);
    setVerifyUrl(url);
    setQrCode('');
    setQrError('');

    void generateQRDataUrl(url)
      .then(setQrCode)
      .catch(() => {
        setQrError('Could not generate QR code. You can still copy the verification link.');
      });
  }, [proof]);

  const copyLink = useCallback(async (): Promise<void> => {
    if (!verifyUrl) return;
    try {
      await copyToClipboard(verifyUrl);
      setShareStatus('Link copied (auto-clears in 60s)');
    } catch {
      setShareStatus('Copy failed');
    }
  }, [verifyUrl, copyToClipboard]);

  const shareToNetwork = useCallback((network: SocialNetwork): void => {
    if (!verifyUrl) return;
    const payload = buildSharePayload(verifyUrl, chain);
    openSocialShare(network, payload);
  }, [verifyUrl, chain]);

  const shareNatively = useCallback(async (): Promise<void> => {
    if (!verifyUrl) return;
    const payload = buildSharePayload(verifyUrl, chain);
    const status  = await nativeShare(payload);
    setShareStatus(status);
  }, [verifyUrl, chain]);

  const downloadQR = useCallback((): void => {
    if (!qrCode) return;
    const link = globalThis.document.createElement('a');
    link.download = `ghostreceipt-${Date.now()}.png`;
    link.href = qrCode;
    link.click();
  }, [qrCode]);

  const openReceipt = useCallback((): void => {
    if (!verifyUrl) return;
    globalThis.location.href = verifyUrl;
  }, [verifyUrl]);

  return {
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
  };
}
