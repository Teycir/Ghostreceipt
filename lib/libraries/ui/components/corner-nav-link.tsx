'use client';

interface CornerNavLinkProps {
  ariaLabel: string;
  href: string;
  label: string;
  side?: 'left' | 'right';
}

/**
 * Reusable top-corner navigation link patterned after TimeSeal's quick corner actions.
 * Useful for always-available global routes (dashboard/history/source/home).
 */
export function CornerNavLink({
  ariaLabel,
  href,
  label,
  side = 'left',
}: Readonly<CornerNavLinkProps>): React.JSX.Element {
  return (
    <a
      href={href}
      aria-label={ariaLabel}
      className={`fixed top-4 z-30 inline-flex items-center justify-center rounded-xl border border-cyan-300/40 bg-slate-950/70 px-4 py-2.5 text-sm font-semibold tracking-[0.03em] text-white/95 shadow-[0_8px_24px_rgba(5,10,24,0.5)] backdrop-blur-md transition-all hover:border-cyan-200/80 hover:bg-slate-900/80 hover:text-white ${
        side === 'left' ? 'left-4' : 'right-4'
      }`}
    >
      {label}
    </a>
  );
}

export type { CornerNavLinkProps };
