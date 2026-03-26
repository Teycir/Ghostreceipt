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
} from '@/lib/share/social';
import { createSharePointerLink } from '@/lib/share/share-pointer-client';
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
  /** True while the verify link is being prepared */
  isPreparingVerifyUrl: boolean;
  /** True when current verifyUrl uses compact sid pointer mode */
  usesCompactVerifyUrl: boolean;
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
  copyLink: () => Promise<void>;
  copyShareBundle: () => Promise<void>;
  shareToNetwork: (network: SocialNetwork) => void;
  downloadQR: () => void;
  openReceipt: () => void;
  exportPdf: () => void;
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

function isCompactShareLinkUnavailableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('compact share links are unavailable') ||
    message.includes('missing share_pointers_db')
  );
}

/**
 * Prefer medium/low correction first for on-screen scanning readability,
 * then escalate if encoding constraints require it.
 */
const QR_ERROR_CORRECTION_LEVELS: readonly QRErrorCorrectionLevel[] = ['M', 'L', 'Q', 'H'];

function buildQROptions(errorCorrectionLevel: QRErrorCorrectionLevel): QRDataUrlOptions {
  return {
    errorCorrectionLevel,
    width: 384,
    margin: 8,
    color: { dark: '#000000', light: '#ffffff' },
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

/** Generates a scanner-friendly black/white QR code data URL. */
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
  const [isPreparingVerifyUrl, setIsPreparingVerifyUrl] = useState(false);
  const [qrCode, setQrCode]       = useState('');
  const [qrError, setQrError]     = useState('');
  const [shareStatus, setShareStatus] = useState('');
  const [copyFlavor, setCopyFlavor] = useState<'url' | 'bundle' | null>(null);
  const { copied, copyToClipboard } = useSecureClipboard();
  const verificationCode = deriveVerificationCode(proof);

  // Build URL + QR whenever proof changes
  useEffect(() => {
    let cancelled = false;
    setIsPreparingVerifyUrl(true);
    setVerifyUrl('');
    setQrCode('');
    setQrError('');
    setShareStatus('');

    void (async () => {
      let preferredUrl = '';
      try {
        const pointer = await createSharePointerLink(proof);
        preferredUrl = pointer.verifyUrl;
      } catch (error) {
        preferredUrl = '';
        if (isCompactShareLinkUnavailableError(error)) {
          setShareStatus('Compact QR links are disabled on this deployment because SHARE_POINTERS_DB is not configured.');
          setQrError('Share link is unavailable on this deployment.');
        } else {
          setShareStatus('Could not create secure verification link. Please regenerate and try again.');
          setQrError('Share link generation failed.');
        }
      }

      if (cancelled) {
        return;
      }
      setVerifyUrl(preferredUrl);
      if (!preferredUrl) {
        setQrCode('');
        setIsPreparingVerifyUrl(false);
        return;
      }

      try {
        const generatedQrCode = await generateQRDataUrl(preferredUrl);
        if (!cancelled) {
          setQrCode(generatedQrCode);
          setIsPreparingVerifyUrl(false);
        }
      } catch {
        if (!cancelled) {
          setQrError('Could not generate QR code. You can still copy the verification link.');
          setIsPreparingVerifyUrl(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [proof]);

  const copyLink = useCallback(async (): Promise<void> => {
    if (isPreparingVerifyUrl || !verifyUrl) {
      setShareStatus('Verification link is unavailable right now. Please regenerate receipt.');
      return;
    }
    try {
      await copyToClipboard(verifyUrl);
      setCopyFlavor('url');
      setShareStatus('Link copied (auto-clears in 60s)');
    } catch {
      setShareStatus('Copy failed');
    }
  }, [copyToClipboard, isPreparingVerifyUrl, verifyUrl]);

  const copyShareBundle = useCallback(async (): Promise<void> => {
    if (isPreparingVerifyUrl || !verifyUrl) {
      setShareStatus('Verification link is unavailable right now. Please regenerate receipt.');
      return;
    }
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
  }, [chain, copyToClipboard, isPreparingVerifyUrl, proof, verifyUrl]);

  const shareToNetwork = useCallback((network: SocialNetwork): void => {
    if (isPreparingVerifyUrl || !verifyUrl) {
      setShareStatus('Verification link is unavailable right now. Please regenerate receipt.');
      return;
    }
    const payload = buildSharePayload(verifyUrl, chain);
    openSocialShare(network, payload);
  }, [chain, isPreparingVerifyUrl, verifyUrl]);

  const downloadQR = useCallback((): void => {
    if (!qrCode) return;
    const link = globalThis.document.createElement('a');
    link.download = `ghostreceipt-${Date.now()}.png`;
    link.href = qrCode;
    link.click();
  }, [qrCode]);

  const openReceipt = useCallback((): void => {
    if (isPreparingVerifyUrl || !verifyUrl) {
      setShareStatus('Verification link is unavailable right now. Please regenerate receipt.');
      return;
    }
    globalThis.location.href = verifyUrl;
  }, [isPreparingVerifyUrl, verifyUrl]);

  const exportPdf = useCallback((): void => {
    if (isPreparingVerifyUrl || !verifyUrl) {
      setShareStatus('Verification link is unavailable right now. Please regenerate receipt.');
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
      setShareStatus('Printable receipt opened. If print dialog does not appear, press Cmd/Ctrl + P in that tab.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'PDF export failed';
      setShareStatus(message);
    }
  }, [chain, claimedAmount, ethereumAsset, isPreparingVerifyUrl, minDate, proof, qrCode, receiptCategory, receiptLabel, verifyUrl]);

  useEffect(() => {
    if (!copied) {
      setCopyFlavor(null);
    }
  }, [copied]);

  return {
    verifyUrl,
    isPreparingVerifyUrl,
    usesCompactVerifyUrl: verifyUrl.includes('sid='),
    qrCode,
    qrError,
    shareStatus,
    copied,
    copyFlavor,
    verificationCode,
    copyLink,
    copyShareBundle,
    shareToNetwork,
    downloadQR,
    openReceipt,
    exportPdf,
  };
}
