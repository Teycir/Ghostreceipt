'use client';

type GeneratorState = 'idle' | 'fetching' | 'validating' | 'generating' | 'success' | 'error';

interface Step {
  id: GeneratorState;
  label: string;
  icon: string;
  desc: string;
}

const STEPS: Step[] = [
  { id: 'fetching',   label: 'Find Transaction', icon: '⬡', desc: 'Looking up your transaction on the blockchain…' },
  { id: 'validating', label: 'Check Details',    icon: '◈', desc: 'Checking that the transaction matches your claim…' },
  { id: 'generating', label: 'Create Proof',     icon: '⬟', desc: 'Creating your private cryptographic proof…' },
];

const STATE_INDEX: Partial<Record<GeneratorState, number>> = {
  fetching:   0,
  validating: 1,
  generating: 2,
  success:    3,
};

interface ProofStepperProps {
  state: GeneratorState;
}

export function ProofStepper({ state }: Readonly<ProofStepperProps>): React.JSX.Element | null {
  const activeIdx = STATE_INDEX[state] ?? -1;
  if (activeIdx < 0) return null;

  return (
    <div className="proof-stepper" aria-live="polite" aria-label="Proof generation progress">
      {/* Track line behind steps */}
      <div className="proof-stepper__track">
        <div
          className="proof-stepper__track-fill"
          style={{ width: `${Math.min((activeIdx / (STEPS.length - 1)) * 100, 100)}%` }}
        />
      </div>

      {STEPS.map((step, i) => {
        const done    = activeIdx > i;
        const active  = activeIdx === i;
        const pending = activeIdx < i;

        return (
          <div key={step.id} className={`proof-stepper__step ${done ? 'is-done' : ''} ${active ? 'is-active' : ''} ${pending ? 'is-pending' : ''}`}>
            {/* Connector filled segment */}
            <div className="proof-stepper__node">
              {done && <span className="proof-stepper__check">✓</span>}
              {active && <span className="proof-stepper__spinner" />}
              {pending && <span className="proof-stepper__icon">{step.icon}</span>}
            </div>
            <div className="proof-stepper__meta">
              <span className="proof-stepper__label">{step.label}</span>
              {active && (
                <span className="proof-stepper__desc">{step.desc}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
