import advancedModesManifest from '@/config/privacy/advanced-modes.json';
import { validateAdvancedPrivacyManifest } from '@/lib/policy/advanced-privacy-benchmark-gate';

describe('advanced privacy benchmark gate', () => {
  it('accepts planned modes without benchmark evidence', () => {
    expect(() => validateAdvancedPrivacyManifest({
      schemaVersion: 1,
      updatedAt: '2026-03-24',
      modes: [
        {
          id: 'selective-disclosure',
          name: 'Selective Disclosure',
          status: 'planned',
          benchmarkEvidence: null,
        },
      ],
    })).not.toThrow();
  });

  it('rejects shipping modes without benchmark evidence', () => {
    expect(() => validateAdvancedPrivacyManifest({
      schemaVersion: 1,
      updatedAt: '2026-03-24',
      modes: [
        {
          id: 'range-proof',
          name: 'Range Proof',
          status: 'shipping',
          benchmarkEvidence: null,
        },
      ],
    })).toThrow('benchmarkEvidence is required when status=shipping');
  });

  it('rejects shipping modes when benchmark budgets do not pass', () => {
    expect(() => validateAdvancedPrivacyManifest({
      schemaVersion: 1,
      updatedAt: '2026-03-24',
      modes: [
        {
          id: 'range-proof',
          name: 'Range Proof',
          status: 'shipping',
          benchmarkEvidence: {
            measuredAt: '2026-03-24T10:00:00.000Z',
            command: ['npm run test:perf:proof'],
            environment: 'CI',
            metrics: {
              proveP50Ms: 15000,
              proveP95Ms: 45000,
              totalP50Ms: 17000,
              totalP95Ms: 47000,
            },
            budgetsPass: false,
            reviewNotePath: 'docs/project/sample.md',
          },
        },
      ],
    })).toThrow('budgetsPass must be true for shipping modes');
  });

  it('rejects shipping evidence that does not include proof-performance command', () => {
    expect(() => validateAdvancedPrivacyManifest({
      schemaVersion: 1,
      updatedAt: '2026-03-24',
      modes: [
        {
          id: 'range-proof',
          name: 'Range Proof',
          status: 'shipping',
          benchmarkEvidence: {
            measuredAt: '2026-03-24T10:00:00.000Z',
            command: ['npm run test'],
            environment: 'CI',
            metrics: {
              proveP50Ms: 15000,
              proveP95Ms: 45000,
              totalP50Ms: 17000,
              totalP95Ms: 47000,
            },
            budgetsPass: true,
            reviewNotePath: 'docs/project/sample.md',
          },
        },
      ],
    })).toThrow('command must include test:perf:proof');
  });

  it('keeps the tracked advanced-modes manifest policy-compliant', () => {
    expect(() => validateAdvancedPrivacyManifest(advancedModesManifest)).not.toThrow();
  });
});

