export type ValidationStrengthStatus =
  | 'consensus_verified'
  | 'single_source_fallback'
  | 'single_source_only';

interface ValidationStrengthBadgeProps {
  status?: ValidationStrengthStatus | undefined;
  label?: string | undefined;
  showDescription?: boolean;
  className?: string;
}

interface ValidationBadgeTone {
  className: string;
  description: string;
  icon: string;
  title: string;
}

const VALIDATION_BADGE_TONES: Record<ValidationStrengthStatus, ValidationBadgeTone> = {
  consensus_verified: {
    className: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
    description: 'Dual-source confirmed',
    icon: '●',
    title: 'Consensus Verified',
  },
  single_source_fallback: {
    className: 'border-amber-400/35 bg-amber-500/10 text-amber-200',
    description: 'Peer source unavailable',
    icon: '●',
    title: 'Single Source Fallback',
  },
  single_source_only: {
    className: 'border-slate-300/30 bg-slate-400/10 text-slate-200',
    description: 'Consensus mode disabled',
    icon: '●',
    title: 'Single Source Only',
  },
};

interface ResolvedValidationStrength {
  tone: ValidationBadgeTone;
  title: string;
}

function inferStatusFromLabel(label: string): ValidationStrengthStatus | undefined {
  const normalized = label.toLowerCase();
  if (normalized.includes('consensus') || normalized.includes('dual-source')) {
    return 'consensus_verified';
  }
  if (normalized.includes('fallback') || normalized.includes('unavailable')) {
    return 'single_source_fallback';
  }
  if (normalized.includes('single-source')) {
    return 'single_source_only';
  }
  return undefined;
}

function resolveValidationStrength(
  status?: ValidationStrengthStatus,
  label?: string
): ResolvedValidationStrength | null {
  const normalizedLabel = label?.trim();
  const inferredStatus = status ?? (normalizedLabel ? inferStatusFromLabel(normalizedLabel) : undefined);
  if (!inferredStatus) {
    return normalizedLabel
      ? {
          title: normalizedLabel,
          tone: {
            className: 'border-white/20 bg-white/10 text-white/80',
            description: 'Validation metadata',
            icon: '●',
            title: normalizedLabel,
          },
        }
      : null;
  }

  const tone = VALIDATION_BADGE_TONES[inferredStatus];
  return {
    tone,
    title: normalizedLabel || tone.title,
  };
}

export function ValidationStrengthBadge({
  status,
  label,
  showDescription = true,
  className = '',
}: Readonly<ValidationStrengthBadgeProps>): React.JSX.Element | null {
  const resolved = resolveValidationStrength(status, label);
  if (!resolved) {
    return null;
  }

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em] ${resolved.tone.className} ${className}`}
      title={label ?? `${resolved.title}: ${resolved.tone.description}`}
      aria-label={label ?? `${resolved.title}: ${resolved.tone.description}`}
    >
      <span aria-hidden="true" className="text-[8px] leading-none">{resolved.tone.icon}</span>
      <span className="uppercase">{resolved.title}</span>
      {showDescription && (
        <span className="hidden whitespace-nowrap text-[10px] font-medium normal-case tracking-normal opacity-80 sm:inline">
          {resolved.tone.description}
        </span>
      )}
    </span>
  );
}
