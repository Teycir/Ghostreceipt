export type AdvancedPrivacyModeStatus = 'planned' | 'experimental' | 'shipping';

export interface AdvancedPrivacyBenchmarkEvidence {
  measuredAt: string;
  command: string[];
  environment: string;
  metrics: {
    proveP50Ms: number;
    proveP95Ms: number;
    totalP50Ms: number;
    totalP95Ms: number;
  };
  budgetsPass: boolean;
  reviewNotePath: string;
}

export interface AdvancedPrivacyModeDescriptor {
  id: string;
  name: string;
  status: AdvancedPrivacyModeStatus;
  benchmarkEvidence: AdvancedPrivacyBenchmarkEvidence | null;
}

export interface AdvancedPrivacyManifest {
  schemaVersion: number;
  updatedAt: string;
  modes: AdvancedPrivacyModeDescriptor[];
}

const ADVANCED_PRIVACY_STATUSES: AdvancedPrivacyModeStatus[] = ['planned', 'experimental', 'shipping'];

function assertObjectRecord(value: unknown, context: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${context} must be an object`);
  }
}

function assertNonEmptyString(value: unknown, context: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${context} must be a non-empty string`);
  }
}

function assertFiniteNumber(value: unknown, context: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${context} must be a finite number`);
  }
}

function assertCommandIncludesPerfGate(command: string[], context: string): void {
  const hasProofPerf = command.some((item) => item.includes('test:perf:proof'));
  if (!hasProofPerf) {
    throw new Error(`${context}.command must include test:perf:proof`);
  }
}

function assertBenchmarkEvidence(
  evidence: unknown,
  context: string
): asserts evidence is AdvancedPrivacyBenchmarkEvidence {
  assertObjectRecord(evidence, context);

  assertNonEmptyString(evidence['measuredAt'], `${context}.measuredAt`);
  assertNonEmptyString(evidence['environment'], `${context}.environment`);
  assertNonEmptyString(evidence['reviewNotePath'], `${context}.reviewNotePath`);

  const command = evidence['command'];
  if (!Array.isArray(command) || command.length === 0 || command.some((item) => typeof item !== 'string')) {
    throw new Error(`${context}.command must be a non-empty string array`);
  }
  assertCommandIncludesPerfGate(command, context);

  const budgetsPass = evidence['budgetsPass'];
  if (budgetsPass !== true) {
    throw new Error(`${context}.budgetsPass must be true for shipping modes`);
  }

  const metrics = evidence['metrics'];
  assertObjectRecord(metrics, `${context}.metrics`);
  assertFiniteNumber(metrics['proveP50Ms'], `${context}.metrics.proveP50Ms`);
  assertFiniteNumber(metrics['proveP95Ms'], `${context}.metrics.proveP95Ms`);
  assertFiniteNumber(metrics['totalP50Ms'], `${context}.metrics.totalP50Ms`);
  assertFiniteNumber(metrics['totalP95Ms'], `${context}.metrics.totalP95Ms`);
}

function assertModeDescriptor(
  mode: unknown,
  index: number
): asserts mode is AdvancedPrivacyModeDescriptor {
  const context = `manifest.modes[${index}]`;
  assertObjectRecord(mode, context);
  assertNonEmptyString(mode['id'], `${context}.id`);
  assertNonEmptyString(mode['name'], `${context}.name`);

  const status = mode['status'];
  if (typeof status !== 'string' || !ADVANCED_PRIVACY_STATUSES.includes(status as AdvancedPrivacyModeStatus)) {
    throw new Error(`${context}.status must be one of ${ADVANCED_PRIVACY_STATUSES.join(', ')}`);
  }

  const evidence = mode['benchmarkEvidence'];
  if (status === 'shipping') {
    if (evidence === null || evidence === undefined) {
      throw new Error(`${context}.benchmarkEvidence is required when status=shipping`);
    }
    assertBenchmarkEvidence(evidence, `${context}.benchmarkEvidence`);
    return;
  }

  if (evidence !== null && evidence !== undefined) {
    assertBenchmarkEvidence(evidence, `${context}.benchmarkEvidence`);
  }
}

export function validateAdvancedPrivacyManifest(
  manifest: unknown
): asserts manifest is AdvancedPrivacyManifest {
  assertObjectRecord(manifest, 'manifest');

  const schemaVersion = manifest['schemaVersion'];
  if (schemaVersion !== 1) {
    throw new Error('manifest.schemaVersion must be 1');
  }

  assertNonEmptyString(manifest['updatedAt'], 'manifest.updatedAt');

  const modes = manifest['modes'];
  if (!Array.isArray(modes) || modes.length === 0) {
    throw new Error('manifest.modes must be a non-empty array');
  }

  modes.forEach((mode, index) => {
    assertModeDescriptor(mode, index);
  });
}

