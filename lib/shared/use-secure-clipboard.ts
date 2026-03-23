'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const AUTO_CLEAR_DELAY_MS = 60_000;
const RESET_COPIED_STATE_MS = 2_000;

export function useSecureClipboard(): {
  copied: boolean;
  copyToClipboard: (text: string) => Promise<void>;
} {
  const [copied, setCopied] = useState(false);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copiedStateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copyToClipboard = useCallback(async (text: string): Promise<void> => {
    await navigator.clipboard.writeText(text);
    setCopied(true);

    if (copiedStateTimerRef.current) {
      clearTimeout(copiedStateTimerRef.current);
    }
    copiedStateTimerRef.current = setTimeout(() => {
      setCopied(false);
    }, RESET_COPIED_STATE_MS);

    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current);
    }
    clearTimerRef.current = setTimeout(async () => {
      try {
        await navigator.clipboard.writeText('');
      } catch {
        // Ignore clipboard clear failures.
      }
    }, AUTO_CLEAR_DELAY_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
      }
      if (copiedStateTimerRef.current) {
        clearTimeout(copiedStateTimerRef.current);
      }
    };
  }, []);

  return { copied, copyToClipboard };
}
