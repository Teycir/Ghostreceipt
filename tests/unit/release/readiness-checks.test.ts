import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import {
  formatReleaseReadinessDocReport,
  runReleaseReadinessDocChecks,
  type ReleaseReadinessDocCheckDefinition,
} from '@/lib/release/readiness-checks';

function writeFixtureFile(rootDir: string, relativePath: string, content: string): void {
  const absolutePath = join(rootDir, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content, 'utf8');
}

describe('release readiness document checks', () => {
  let tempRootDir = '';

  beforeEach(() => {
    tempRootDir = mkdtempSync(join(tmpdir(), 'ghostreceipt-release-readiness-'));
  });

  afterEach(() => {
    if (tempRootDir) {
      rmSync(tempRootDir, { force: true, recursive: true });
    }
  });

  it('passes when required patterns are present and forbidden patterns are absent', () => {
    writeFixtureFile(tempRootDir, 'README.md', '## Oracle Trust Model\nAPI-only provider wording');
    writeFixtureFile(tempRootDir, 'docs/runbooks/SECURITY.md', '### Rotation Cadence\nORACLE_PRIVATE_KEY');

    const checks: ReleaseReadinessDocCheckDefinition[] = [
      {
        description: 'readme oracle trust model',
        id: 'readme_oracle',
        relativePath: 'README.md',
        requiredPatterns: [/^## Oracle Trust Model$/m],
      },
      {
        description: 'security runbook rotation',
        id: 'security_rotation',
        relativePath: 'docs/runbooks/SECURITY.md',
        requiredPatterns: [/### Rotation Cadence/, /ORACLE_PRIVATE_KEY/],
      },
    ];

    const report = runReleaseReadinessDocChecks({
      checks,
      rootDir: tempRootDir,
    });

    expect(report.passed).toBe(true);
    expect(report.failedCount).toBe(0);
    expect(report.passedCount).toBe(2);
  });

  it('fails when required patterns are missing or forbidden patterns appear', () => {
    writeFixtureFile(tempRootDir, 'README.md', 'ETH public RPC fallback mention');

    const checks: ReleaseReadinessDocCheckDefinition[] = [
      {
        description: 'readme must be api only',
        forbiddenPatterns: [/public RPC fallback/i],
        id: 'readme_api_only',
        relativePath: 'README.md',
      },
      {
        description: 'must contain trust model section',
        id: 'readme_trust_model',
        relativePath: 'README.md',
        requiredPatterns: [/^## Oracle Trust Model$/m],
      },
      {
        description: 'missing file check',
        id: 'missing_doc',
        relativePath: 'docs/runbooks/CIRCUIT_COMPILATION.md',
      },
    ];

    const report = runReleaseReadinessDocChecks({
      checks,
      rootDir: tempRootDir,
    });

    expect(report.passed).toBe(false);
    expect(report.failedCount).toBe(3);
    expect(report.checks.every((check) => check.status === 'fail')).toBe(true);
    expect(report.checks[0]?.details.join(' ')).toContain('forbidden pattern');
    expect(report.checks[1]?.details.join(' ')).toContain('required pattern');
    expect(report.checks[2]?.details.join(' ')).toContain('Missing file');
  });

  it('formats a readable report summary', () => {
    writeFixtureFile(tempRootDir, 'README.md', '## Oracle Trust Model');

    const report = runReleaseReadinessDocChecks({
      checks: [
        {
          description: 'readme oracle trust model',
          id: 'readme_oracle',
          relativePath: 'README.md',
          requiredPatterns: [/^## Oracle Trust Model$/m],
        },
      ],
      rootDir: tempRootDir,
    });

    const output = formatReleaseReadinessDocReport(report);
    expect(output).toContain('# Release Readiness Document Checks');
    expect(output).toContain('[PASS]');
    expect(output).toContain('1/1 passed');
  });
});
