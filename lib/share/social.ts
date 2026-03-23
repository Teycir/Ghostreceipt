/**
 * lib/share/social.ts
 * Pure functions for building social sharing URLs and native share data.
 * No React dependencies — safe to use anywhere.
 */

export type SocialNetwork = 'x' | 'telegram' | 'linkedin' | 'reddit';

export interface SharePayload {
  url: string;
  text: string;
  title: string;
}

/**
 * Builds a SharePayload from a verify URL and an optional chain label.
 */
export function buildSharePayload(verifyUrl: string, chain?: string): SharePayload {
  const chainLabel = chain ? ` ${chain}` : '';
  return {
    url: verifyUrl,
    title: 'GhostReceipt Verification Link',
    text: `I generated a privacy-preserving${chainLabel} receipt with GhostReceipt. Verify it here:`,
  };
}

/**
 * Returns the full social share URL for a given network.
 */
export function socialShareUrl(network: SocialNetwork, payload: SharePayload): string {
  const url   = encodeURIComponent(payload.url);
  const text  = encodeURIComponent(payload.text);
  const title = encodeURIComponent(payload.title);

  const builders: Record<SocialNetwork, string> = {
    x:        `https://x.com/intent/tweet?text=${text}%20${url}`,
    telegram: `https://t.me/share/url?url=${url}&text=${text}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
    reddit:   `https://www.reddit.com/submit?url=${url}&title=${title}`,
  };

  return builders[network];
}

/**
 * Opens a social share window for the given network.
 */
export function openSocialShare(network: SocialNetwork, payload: SharePayload): void {
  globalThis.open(socialShareUrl(network, payload), '_blank', 'noopener,noreferrer');
}

/**
 * Attempts native share (Web Share API), falls back to clipboard copy.
 * Returns a descriptive status string.
 */
export async function nativeShare(payload: SharePayload): Promise<string> {
  const shareData = { title: payload.title, text: payload.text, url: payload.url };

  if (typeof globalThis.navigator !== 'undefined' && typeof globalThis.navigator.share === 'function') {
    try {
      await globalThis.navigator.share(shareData);
      return 'Shared successfully';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return 'Share cancelled';
      }
      // Fall through to clipboard copy
    }
  }

  await globalThis.navigator.clipboard.writeText(payload.url);
  return 'Copied link (native share unavailable)';
}
