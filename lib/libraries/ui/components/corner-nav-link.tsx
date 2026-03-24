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
      className={`absolute top-4 z-20 inline-flex items-center justify-center rounded-xl border border-white/20 bg-black/45 px-3 py-2 text-xs font-medium uppercase tracking-[0.08em] text-white/80 backdrop-blur-sm transition-all hover:border-cyan-300/60 hover:text-white ${
        side === 'left' ? 'left-4' : 'right-4'
      }`}
    >
      {label}
    </a>
  );
}

export type { CornerNavLinkProps };
