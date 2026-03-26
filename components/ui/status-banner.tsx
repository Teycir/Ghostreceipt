'use client';

/**
 * components/ui/status-banner.tsx
 *
 * A reusable alert/status banner used across the generator, verifier, and
 * any future page that needs to communicate a transient UI state.
 *
 * Variants map to semantic intent, not raw colours, so theming is centralised here.
 */

export type BannerVariant = 'info' | 'success' | 'error' | 'warning';

interface StatusBannerProps {
  variant: BannerVariant;
  message: string;
  /** Optional ARIA live region politeness. Defaults to 'polite'. */
  aria?: 'polite' | 'assertive';
}

const VARIANT_STYLES: Record<BannerVariant, string> = {
  info:    'bg-blue-500/10 border-blue-500/20 text-blue-300',
  success: 'bg-green-500/10 border-green-500/20 text-green-400',
  error:   'bg-red-500/10  border-red-500/20  text-red-400',
  warning: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
};

export function StatusBanner({
  variant,
  message,
  aria = 'polite',
}: Readonly<StatusBannerProps>): React.JSX.Element {
  return (
    <div
      role="status"
      aria-live={aria}
      className={`rounded-lg border px-2.5 py-2 text-xs leading-snug sm:px-4 sm:py-3 sm:text-sm ${VARIANT_STYLES[variant]}`}
    >
      {message}
    </div>
  );
}
