interface InfoTooltipProps {
  label: string;
  content: string;
  className?: string;
}

export function InfoTooltip({
  label,
  content,
  className = '',
}: Readonly<InfoTooltipProps>): React.JSX.Element {
  return (
    <span className={`group relative inline-flex items-center ${className}`}>
      <button
        type="button"
        aria-label={label}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-cyan-300/35 bg-cyan-400/10 text-[10px] font-semibold text-cyan-100/90 transition-colors hover:border-cyan-200/60 hover:bg-cyan-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
      >
        ?
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-56 -translate-x-1/2 rounded-md border border-white/15 bg-slate-950/95 px-2.5 py-2 text-[11px] leading-relaxed text-white/80 opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {content}
      </span>
    </span>
  );
}
