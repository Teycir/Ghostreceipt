/* global process */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const RELEASE_READINESS_DOC_CHECKS = Object.freeze([
  Object.freeze({
    description: 'README includes Oracle Trust Model section',
    id: 'readme_oracle_trust_model',
    relativePath: 'README.md',
    requiredPatterns: Object.freeze([
      /^## Oracle Trust Model$/m,
    ]),
  }),
  Object.freeze({
    description: 'README keeps ETH provider wording API-only (no public-RPC fallback claim)',
    forbiddenPatterns: Object.freeze([
      /ETH prefers managed Etherscan API key cascade, with public RPC as final fallback\./i,
      /ETH: Etherscan API first \(rolling managed key cascade\), public RPC last fallback/i,
      /ETH provider path is API-first \(Etherscan key cascade\) with RPC as the last fallback attempt\./i,
    ]),
    id: 'readme_eth_api_only_wording',
    relativePath: 'README.md',
  }),
  Object.freeze({
    description: 'Security runbook documents key custody and rotation cadence',
    id: 'security_runbook_key_custody_rotation',
    relativePath: 'docs/runbooks/SECURITY.md',
    requiredPatterns: Object.freeze([
      /### Key Custody/,
      /### Rotation Cadence/,
      /ORACLE_PRIVATE_KEY/,
    ]),
  }),
  Object.freeze({
    description: 'Circuit compilation runbook documents current chainId constraints',
    id: 'circuit_runbook_chain_constraints',
    relativePath: 'docs/runbooks/CIRCUIT_COMPILATION.md',
    requiredPatterns: Object.freeze([
      /chainId` must be one of `0` \(bitcoin\), `1` \(ethereum\), `2` \(solana\)/,
      /Public Inputs/,
      /Private Inputs/,
    ]),
  }),
]);

function checkSingleDocument(check, rootDir) {
  const absolutePath = resolve(rootDir, check.relativePath);
  const details = [];

  if (!existsSync(absolutePath)) {
    details.push(`Missing file: ${check.relativePath}`);
    return {
      details,
      id: check.id,
      relativePath: check.relativePath,
      status: 'fail',
    };
  }

  const content = readFileSync(absolutePath, 'utf8');

  for (const pattern of check.requiredPatterns ?? []) {
    if (!pattern.test(content)) {
      details.push(`Missing required pattern: ${pattern}`);
    }
  }

  for (const pattern of check.forbiddenPatterns ?? []) {
    if (pattern.test(content)) {
      details.push(`Found forbidden pattern: ${pattern}`);
    }
  }

  return {
    details,
    id: check.id,
    relativePath: check.relativePath,
    status: details.length > 0 ? 'fail' : 'pass',
  };
}

function runReleaseReadinessDocChecks(options = {}) {
  const {
    checks = RELEASE_READINESS_DOC_CHECKS,
    rootDir = process.cwd(),
  } = options;

  const normalizedRoot = resolve(rootDir);
  const results = checks.map((check) => ({
    description: check.description,
    ...checkSingleDocument(check, normalizedRoot),
  }));

  const failedCount = results.filter((result) => result.status === 'fail').length;

  return {
    checks: results,
    failedCount,
    generatedAt: new Date().toISOString(),
    passed: failedCount === 0,
    passedCount: results.length - failedCount,
    rootDir: normalizedRoot,
  };
}

function formatReleaseReadinessDocReport(report) {
  const lines = [
    '# Release Readiness Document Checks',
    `Generated at: ${report.generatedAt}`,
    `Root directory: ${report.rootDir}`,
    `Result: ${report.passedCount}/${report.checks.length} passed`,
    '',
  ];

  for (const check of report.checks) {
    const status = check.status === 'pass' ? 'PASS' : 'FAIL';
    lines.push(`- [${status}] ${check.description} (${check.relativePath})`);
    for (const detail of check.details) {
      lines.push(`  - ${detail}`);
    }
  }

  return lines.join('\n');
}

export {
  RELEASE_READINESS_DOC_CHECKS,
  formatReleaseReadinessDocReport,
  runReleaseReadinessDocChecks,
};
