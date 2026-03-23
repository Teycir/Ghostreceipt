'use client';

import { useEffect, useMemo, useState } from 'react';
import { GeneratorForm } from '@/components/generator/generator-form';
import { Footer } from '@/components/footer';
import { EyeCandy } from '@/components/eye-candy';
import { AnimatedTagline } from '@/components/animated-tagline';
import TextPressure from '@/components/text-pressure';

const MIN_LOADING_MS = 1100;
const FAILSAFE_LOADING_MS = 2800;

export function HomeShell(): React.JSX.Element {
  const [backgroundReady, setBackgroundReady] = useState(false);
  const [minimumElapsed, setMinimumElapsed] = useState(false);

  useEffect(() => {
    const minTimer = window.setTimeout(() => setMinimumElapsed(true), MIN_LOADING_MS);
    const failSafeTimer = window.setTimeout(() => {
      setBackgroundReady(true);
      setMinimumElapsed(true);
    }, FAILSAFE_LOADING_MS);

    return () => {
      window.clearTimeout(minTimer);
      window.clearTimeout(failSafeTimer);
    };
  }, []);

  const loading = useMemo(
    () => !(backgroundReady && minimumElapsed),
    [backgroundReady, minimumElapsed]
  );

  return (
    <>
      <EyeCandy onReady={() => setBackgroundReady(true)} />

      <div className={`startup-overlay ${loading ? 'startup-overlay--visible' : 'startup-overlay--hidden'}`}>
        <div className="startup-overlay__blob startup-overlay__blob--a" />
        <div className="startup-overlay__blob startup-overlay__blob--b" />
        <div className="startup-overlay__blob startup-overlay__blob--c" />
        <div className="startup-overlay__grain" />
        <div className="startup-overlay__content">
          <p className="startup-overlay__brand">GhostReceipt</p>
          <p className="startup-overlay__tag">Prove the payment. Keep the privacy.</p>
          <div className="startup-overlay__bar">
            <span />
          </div>
        </div>
      </div>

      <div className={`main-shell ${loading ? 'main-shell--loading' : 'main-shell--ready'}`}>
        <main className="flex min-h-screen flex-col items-center justify-center p-4 pb-20">
          <div className="w-full max-w-2xl space-y-8 fade-up">
            <div className="text-center space-y-3">
              <h1 className="sr-only">GhostReceipt</h1>
              <div aria-hidden="true">
                <TextPressure
                  text="GhostReceipt"
                  textColor="#ffffff"
                  minFontSize={52}
                  className="glow-heading justify-center"
                />
              </div>
              <AnimatedTagline text="Prove the payment.  Keep the privacy." />
            </div>

            <div className="glass-card rounded-xl p-8 shadow-2xl">
              <GeneratorForm />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
