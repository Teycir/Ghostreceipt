'use client';

/**
 * lib/generator/use-receipt-share.ts
 *
 * Encapsulates all sharing / QR / clipboard logic for the receipt success screen.
 * ReceiptSuccess becomes a pure rendering component with no async side-effects.
 */

import { useState, useEffect, useCallback } from 'react';
import { useSecureClipboard } from '@/lib/shared/use-secure-clipboard';
import { toHumanAmount } from '@/lib/format/units';
import { exportReceiptPdf } from '@/lib/generator/pdf-export';
import {
  buildShareBundleText,
  buildSharePayload,
  deriveVerificationCode,
  openSocialShare,
  nativeShare,
} from '@/lib/share/social';
import type { SocialNetwork } from '@/lib/share/social';
import type { Chain, EthereumAsset } from '@/lib/generator/types';

interface UseReceiptShareOptions {
  proof: string;
  chain: Chain;
  ethereumAsset: EthereumAsset;
  claimedAmount: string;
  minDate: string;
  receiptLabel?: string;
  receiptCategory?: string;
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
  /** Identifies the latest clipboard action while copied=true */
  copyFlavor: 'url' | 'bundle' | null;
  /** Short code recipients can use to confirm they opened the intended receipt */
  verificationCode: string;
  /** True when Web Share API is available in current browser */
  nativeShareAvailable: boolean;
  copyLink: () => Promise<void>;
  copyShareBundle: () => Promise<void>;
  shareToNetwork: (network: SocialNetwork) => void;
  shareNatively: () => Promise<void>;
  downloadQR: () => void;
  openReceipt: () => void;
  exportPdf: () => void;
}

/** Builds the verify URL from the current origin */
function buildVerifyUrl(proof: string): string {
  const params = new URLSearchParams({ proof });
  return `${globalThis.location.origin}/verify?${params.toString()}`;
}

type QRErrorCorrectionLevel = 'H' | 'Q' | 'M' | 'L';

interface QRDataUrlOptions {
  color: {
    dark: string;
    light: string;
  };
  errorCorrectionLevel: QRErrorCorrectionLevel;
  margin: number;
  width: number;
}

type QRToDataUrl = (url: string, options: QRDataUrlOptions) => Promise<string>;

const QR_ERROR_CORRECTION_LEVELS: readonly QRErrorCorrectionLevel[] = ['H', 'Q', 'M', 'L'];

function buildQROptions(errorCorrectionLevel: QRErrorCorrectionLevel): QRDataUrlOptions {
  return {
    errorCorrectionLevel,
    width: 256,
    margin: 2,
    color: { dark: '#22d3ee', light: '#080d1a' },
  };
}

export async function generateQRDataUrlWithFallback(url: string, toDataUrl: QRToDataUrl): Promise<string> {
  let lastError: unknown = null;

  for (const level of QR_ERROR_CORRECTION_LEVELS) {
    try {
      return await toDataUrl(url, buildQROptions(level));
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error('QR generation failed');
}

/** Generates a QR code data URL with dark, app-palette colours */
async function generateQRDataUrl(url: string): Promise<string> {
  const QRCode = (await import('qrcode')).default;
  return generateQRDataUrlWithFallback(url, (value, options) => QRCode.toDataURL(value, options));
}

export function useReceiptShare({
  proof,
  chain,
  ethereumAsset,
  claimedAmount,
  minDate,
  receiptLabel,
  receiptCategory,
}: Readonly<UseReceiptShareOptions>): UseReceiptShareReturn {
  const [verifyUrl, setVerifyUrl] = useState('');
  const [qrCode, setQrCode]       = useState('');
  const [qrError, setQrError]     = useState('');
  const [shareStatus, setShareStatus] = useState('');
  const [copyFlavor, setCopyFlavor] = useState<'url' | 'bundle' | null>(null);
  const [nativeShareAvailable, setNativeShareAvailable] = useState(false);
  const { copied, copyToClipboard } = useSecureClipboard();
  const verificationCode = deriveVerificationCode(proof);

  useEffect(() => {
    const canNativeShare =
      typeof globalThis.navigator !== 'undefined' &&
      typeof globalThis.navigator.share === 'function';
    setNativeShareAvailable(canNativeShare);
  }, []);

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
      setCopyFlavor('url');
      setShareStatus('Link copied (auto-clears in 60s)');
    } catch {
      setShareStatus('Copy failed');
    }
  }, [verifyUrl, copyToClipboard]);

  const copyShareBundle = useCallback(async (): Promise<void> => {
    if (!verifyUrl) return;
    try {
      const packet = buildShareBundleText({
        chain,
        proof,
        verifyUrl,
      });
      await copyToClipboard(packet);
      setCopyFlavor('bundle');
      setShareStatus('Share packet copied: link + verification code');
    } catch {
      setShareStatus('Copy failed');
    }
  }, [chain, copyToClipboard, proof, verifyUrl]);

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

  const exportPdf = useCallback((): void => {
    if (!verifyUrl) {
      setShareStatus('Verification link is still preparing. Try again in a moment.');
      return;
    }

    try {
      exportReceiptPdf({
        chain,
        ethereumAsset,
        claimedAmount,
        claimedAmountHuman: toHumanAmount(claimedAmount, chain, ethereumAsset),
        minDate,
        ...(receiptLabel ? { receiptLabel } : {}),
        ...(receiptCategory ? { receiptCategory } : {}),
        proof,
        qrCodeDataUrl: qrCode,
        verifyUrl,
      });
      setShareStatus('Print dialog opened. Choose "Save as PDF" to export.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'PDF export failed';
      setShareStatus(message);
    }
  }, [chain, claimedAmount, ethereumAsset, minDate, proof, qrCode, receiptCategory, receiptLabel, verifyUrl]);

  useEffect(() => {
    if (!copied) {
      setCopyFlavor(null);
    }
  }, [copied]);

  return {
    verifyUrl,
    qrCode,
    qrError,
    shareStatus,
    copied,
    copyFlavor,
    verificationCode,
    nativeShareAvailable,
    copyLink,
    copyShareBundle,
    shareToNetwork,
    shareNatively,
    downloadQR,
    openReceipt,
    exportPdf,
  };
}
