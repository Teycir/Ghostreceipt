'use client';

import { useEffect, useMemo, useState } from 'react';
import { GeneratorForm } from '@/components/generator/generator-form';
import { Footer } from '@/components/footer';
import { EyeCandy } from '@/components/eye-candy';
import { AnimatedTagline } from '@/components/animated-tagline';
import TextPressure from '@/components/text-pressure';

const MIN_LOADING_MS = 1100;
const FAILSAFE_LOADING_MS = 2800;
const USE_CASE_ROTATE_MS = 1700;

const LOADER_USE_CASES = [
  {
    title: 'Merchant Dispute Proofs',
    description: 'Share a verifiable receipt link when a customer disputes a crypto payment.',
  },
  {
    title: 'Freelancer Invoice Confirmation',
    description: 'Prove that a BTC or ETH payment landed for a specific amount and date.',
  },
  {
    title: 'Audit-Ready Payment Records',
    description: 'Keep private yet verifiable receipts for accounting and compliance workflows.',
  },
  {
    title: 'Escrow & Third-Party Verification',
    description: 'Let counterparties validate payment evidence without exposing private wallet details.',
  },
] as const;

export function HomeShell(): React.JSX.Element {
  const [backgroundReady, setBackgroundReady] = useState(false);
  const [minimumElapsed, setMinimumElapsed] = useState(false);
  const [useCaseIndex, setUseCaseIndex] = useState(0);

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

  useEffect(() => {
    if (!loading) {
      return;
    }

    const rotateTimer = window.setInterval(() => {
      setUseCaseIndex((prev) => (prev + 1) % LOADER_USE_CASES.length);
    }, USE_CASE_ROTATE_MS);

    return () => window.clearInterval(rotateTimer);
  }, [loading]);

  const activeUseCase = LOADER_USE_CASES[useCaseIndex] ?? LOADER_USE_CASES[0];

  return (
    <>
      <EyeCandy onReady={() => setBackgroundReady(true)} />

      <div
        className={`startup-overlay ${loading ? 'startup-overlay--visible' : 'startup-overlay--hidden'}`}
        style={{
          opacity: loading ? 1 : 0,
          visibility: loading ? 'visible' : 'hidden',
          pointerEvents: loading ? 'auto' : 'none',
        }}
      >
        <div className="startup-overlay__blob startup-overlay__blob--a" />
        <div className="startup-overlay__blob startup-overlay__blob--b" />
        <div className="startup-overlay__blob startup-overlay__blob--c" />
        <div className="startup-overlay__grain" />
        <div className="startup-overlay__content">
          <p className="startup-overlay__brand">GhostReceipt</p>
          <p className="startup-overlay__tag">Prove the payment. Keep the privacy.</p>
          <p className="startup-overlay__status">Initializing secure verification engine...</p>

          <div key={useCaseIndex} className="startup-overlay__usecase">
            <p className="startup-overlay__usecase-label">Use Case</p>
            <p className="startup-overlay__usecase-title">{activeUseCase.title}</p>
            <p className="startup-overlay__usecase-text">{activeUseCase.description}</p>
            <div className="startup-overlay__usecase-dots" aria-hidden="true">
              {LOADER_USE_CASES.map((item, index) => (
                <span
                  key={item.title}
                  className={index === useCaseIndex ? 'is-active' : ''}
                />
              ))}
            </div>
          </div>

          <div className="startup-overlay__bar">
            <span />
          </div>
        </div>
      </div>

      <div
        className={`main-shell ${loading ? 'main-shell--loading' : 'main-shell--ready'}`}
        style={{
          opacity: loading ? 0 : 1,
          pointerEvents: loading ? 'none' : 'auto',
          transition: 'opacity 620ms ease 120ms',
        }}
      >
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
