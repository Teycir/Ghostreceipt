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
    description: 'Two sources agree',
    icon: '●',
    title: 'Consensus Check',
  },
  single_source_fallback: {
    className: 'border-amber-400/35 bg-amber-500/10 text-amber-200',
    description: 'Backup source unavailable',
    icon: '●',
    title: 'Fallback Check',
  },
  single_source_only: {
    className: 'border-slate-300/30 bg-slate-400/10 text-slate-200',
    description: 'Consensus check disabled',
    icon: '●',
    title: 'Single Source Check',
  },
};

interface ResolvedValidationStrength {
  details: string;
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
          details: `${normalizedLabel}: validation metadata`,
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
    details: normalizedLabel || `${tone.title}: ${tone.description}`,
    tone,
    title: tone.title,
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
      className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 !text-[9px] font-medium tracking-[0.02em] leading-tight ${resolved.tone.className} ${className}`}
      title={resolved.details}
      aria-label={resolved.details}
    >
      <span aria-hidden="true" className="text-[7px] leading-none">{resolved.tone.icon}</span>
      <span className="truncate normal-case">{resolved.title}</span>
      {showDescription && (
        <span className="hidden whitespace-nowrap !text-[9px] font-normal normal-case tracking-normal opacity-80 md:inline">
          {resolved.tone.description}
        </span>
      )}
    </span>
  );
}
