'use client';

import { AnimatedTagline } from '@/components/animated-tagline';
import { EyeCandy } from '@/components/eye-candy';
import { Footer } from '@/components/footer';
import TextPressure from '@/components/text-pressure';
import { CornerNavLink } from '@/lib/libraries/ui';

interface NavLinkConfig {
  ariaLabel: string;
  href: string;
  label: string;
}

interface UnifiedPageShellProps {
  centerContent?: boolean;
  children: React.ReactNode;
  description?: string;
  leftNavLink?: NavLinkConfig;
  mainShellClassName?: string;
  mainShellState?: 'loading' | 'ready';
  mainShellStyle?: React.CSSProperties;
  maxWidthClassName?: string;
  onBackgroundReady?: () => void;
  rightNavLink?: NavLinkConfig;
  srTitle: string;
  tagline: string;
}

export function UnifiedPageShell({
  centerContent = true,
  children,
  description,
  leftNavLink,
  mainShellClassName,
  mainShellState = 'ready',
  mainShellStyle,
  maxWidthClassName = 'max-w-2xl',
  onBackgroundReady,
  rightNavLink,
  srTitle,
  tagline,
}: Readonly<UnifiedPageShellProps>): React.JSX.Element {
  const shellStateClass =
    mainShellState === 'loading' ? 'main-shell--loading' : 'main-shell--ready';

  return (
    <>
      <EyeCandy {...(onBackgroundReady ? { onReady: onBackgroundReady } : {})} />
      <div
        className={`main-shell relative ${shellStateClass}${
          mainShellClassName ? ` ${mainShellClassName}` : ''
        }`}
        style={mainShellStyle}
      >
        {leftNavLink ? (
          <CornerNavLink
            href={leftNavLink.href}
            label={leftNavLink.label}
            ariaLabel={leftNavLink.ariaLabel}
            side="left"
          />
        ) : null}
        {rightNavLink ? (
          <CornerNavLink
            href={rightNavLink.href}
            label={rightNavLink.label}
            ariaLabel={rightNavLink.ariaLabel}
            side="right"
          />
        ) : null}
        <main
          className={`flex min-h-screen flex-col items-center p-4 pb-28 ${
            centerContent ? 'justify-center' : 'justify-start pt-8'
          }`}
        >
          <div className={`w-full ${maxWidthClassName} space-y-6 fade-up`}>
            <div className="text-center space-y-3">
              <h1 className="sr-only">{srTitle}</h1>
              <div aria-hidden="true">
                <TextPressure
                  text="GhostReceipt"
                  textColor="#ffffff"
                  minFontSize={52}
                  className="glow-heading justify-center"
                />
              </div>
              <AnimatedTagline text={tagline} />
              {description ? (
                <p className="text-sm text-white/55">{description}</p>
              ) : null}
            </div>
            {children}
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
