export interface ReleaseReadinessDocCheckDefinition {
  id: string;
  description: string;
  relativePath: string;
  requiredPatterns?: readonly RegExp[];
  forbiddenPatterns?: readonly RegExp[];
}

export interface ReleaseReadinessDocCheckResult {
  id: string;
  description: string;
  relativePath: string;
  status: 'pass' | 'fail';
  details: string[];
}

export interface ReleaseReadinessDocReport {
  rootDir: string;
  generatedAt: string;
  checks: ReleaseReadinessDocCheckResult[];
  passed: boolean;
  passedCount: number;
  failedCount: number;
}

export interface RunReleaseReadinessDocChecksOptions {
  checks?: readonly ReleaseReadinessDocCheckDefinition[];
  rootDir?: string;
}

export const RELEASE_READINESS_DOC_CHECKS: readonly ReleaseReadinessDocCheckDefinition[];

export function runReleaseReadinessDocChecks(
  options?: RunReleaseReadinessDocChecksOptions
): ReleaseReadinessDocReport;

export function formatReleaseReadinessDocReport(report: ReleaseReadinessDocReport): string;
