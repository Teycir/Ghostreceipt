'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { GeneratorForm } from '@/components/generator/generator-form';
import { Button } from '@/components/ui/button';
import { UnifiedPageShell } from '@/components/unified-page-shell';
import TextPressure from '@/components/text-pressure';

const MIN_LOADING_MS = 1700;
const USE_CASE_ROTATE_MS = 1800;

const LOADER_USE_CASES = [
  {
    title: 'Merchant Dispute Proofs',
    benefit: 'Resolve payment disputes quickly with a verifiable receipt link.',
  },
  {
    title: 'Freelancer Invoice Confirmation',
    benefit: 'Prove BTC or ETH payment delivery for exact amount and date claims.',
  },
  {
    title: 'Audit-Ready Payment Records',
    benefit: 'Keep payment evidence verifiable without exposing sensitive wallet identities.',
  },
  {
    title: 'Escrow & Third-Party Verification',
    benefit: 'Let counterparties verify payment facts without seeing private wallet details.',
  },
] as const;

const FAILSAFE_LOADING_MS = MIN_LOADING_MS + (USE_CASE_ROTATE_MS * LOADER_USE_CASES.length) + 2200;

export function HomeShell(): React.JSX.Element {
  const [backgroundReady, setBackgroundReady] = useState(false);
  const [minimumElapsed, setMinimumElapsed] = useState(false);
  const [useCaseIndex, setUseCaseIndex] = useState(0);
  const [shownAllUseCases, setShownAllUseCases] = useState(LOADER_USE_CASES.length <= 1);
  const shownUseCaseIndicesRef = useRef<Set<number>>(new Set([0]));

  useEffect(() => {
    const minTimer = globalThis.setTimeout(() => setMinimumElapsed(true), MIN_LOADING_MS);
    const failSafeTimer = globalThis.setTimeout(() => {
      setBackgroundReady(true);
      setMinimumElapsed(true);
      setShownAllUseCases(true);
    }, FAILSAFE_LOADING_MS);

    return () => {
      globalThis.clearTimeout(minTimer);
      globalThis.clearTimeout(failSafeTimer);
    };
  }, []);

  const loading = useMemo(
    () => !(backgroundReady && minimumElapsed && shownAllUseCases),
    [backgroundReady, minimumElapsed, shownAllUseCases]
  );

  useEffect(() => {
    if (!loading) {
      return;
    }

    const totalUseCases = LOADER_USE_CASES.length;
    const rotateTimer = globalThis.setInterval(() => {
      setUseCaseIndex((prev) => {
        const next = (prev + 1) % totalUseCases;
        shownUseCaseIndicesRef.current.add(next);
        setShownAllUseCases(
          (alreadyComplete) => alreadyComplete || shownUseCaseIndicesRef.current.size >= totalUseCases
        );
        return next;
      });
    }, USE_CASE_ROTATE_MS);

    return () => globalThis.clearInterval(rotateTimer);
  }, [loading]);

  return (
    <>
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
          <div className="startup-overlay__brand" aria-hidden="true">
            <TextPressure
              text="GhostReceipt"
              textColor="rgba(235,243,255,0.95)"
              minFontSize={34}
              className="justify-center"
            />
          </div>
          <p className="sr-only">GhostReceipt</p>
          <p className="startup-overlay__tag">Prove the payment. Keep the privacy.</p>
          <p className="startup-overlay__status">Initializing secure verification engine...</p>

          <div className="startup-overlay__usecase">
            <ul className="startup-overlay__usecase-list" aria-hidden="true">
              {LOADER_USE_CASES.map((item, index) => (
                <li
                  key={`${item.title}-list`}
                  className={index === useCaseIndex ? 'is-active' : ''}
                >
                  <span className="startup-overlay__usecase-bullet">•</span>
                  <span>
                    <span className="startup-overlay__usecase-title">{item.title}</span>
                    <span className="startup-overlay__usecase-sep"> - </span>
                    <span className="startup-overlay__usecase-text">{item.benefit}</span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="startup-overlay__usecase-dots" aria-hidden="true">
              {LOADER_USE_CASES.map((item, index) => (
                <span
                  key={`${item.title}-dot`}
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

      <UnifiedPageShell
        srTitle="GhostReceipt"
        tagline="Prove the payment.  Keep the privacy."
        leftNavLink={{
          href: '/history',
          label: 'Receipt History',
          ariaLabel: 'Open local receipt history',
        }}
        onBackgroundReady={() => setBackgroundReady(true)}
        mainShellState={loading ? 'loading' : 'ready'}
        mainShellStyle={{
          opacity: loading ? 0 : 1,
          pointerEvents: loading ? 'none' : 'auto',
          transition: 'opacity 620ms ease 120ms',
        }}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-center">
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={() => {
                globalThis.location.href = '/history';
              }}
            >
              View Receipt History
            </Button>
          </div>
          <div className="glass-card rounded-xl p-8 shadow-2xl">
            <GeneratorForm />
          </div>
        </div>
      </UnifiedPageShell>
    </>
  );
}
