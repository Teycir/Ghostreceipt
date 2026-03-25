#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

import readinessChecks from '../lib/release/readiness-checks.js';

const { formatReleaseReadinessDocReport, runReleaseReadinessDocChecks } = readinessChecks;

const args = new Set(process.argv.slice(2));
const allowedArgs = new Set(['--json', '--docs-only']);

for (const arg of args) {
  if (!allowedArgs.has(arg)) {
    console.error(`Unknown argument: ${arg}`);
    console.error('Usage: npm run check:release-readiness [-- --json] [-- --docs-only]');
    process.exit(1);
  }
}

const commandChecks = args.has('--docs-only')
  ? []
  : [
      Object.freeze({
        command: ['node', 'scripts/check-oracle-transparency-log.mjs'],
        id: 'oracle_transparency_log',
        label: 'oracle transparency log check',
      }),
      Object.freeze({
        command: ['node', 'scripts/check-zk-artifact-checksums.mjs', '--required-only'],
        id: 'zk_artifact_checksums',
        label: 'zk artifact checksum check',
      }),
    ];

function runCommandCheck(commandCheck) {
  const [binary, ...argv] = commandCheck.command;
  const result = spawnSync(binary, argv, {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  const stdout = result.stdout?.trim() ?? '';
  const stderr = result.stderr?.trim() ?? '';
  const ok = result.status === 0;
  return {
    command: commandCheck.command.join(' '),
    id: commandCheck.id,
    label: commandCheck.label,
    status: ok ? 'pass' : 'fail',
    stderr,
    stdout,
  };
}

const docReport = runReleaseReadinessDocChecks();
const commandResults = commandChecks.map(runCommandCheck);
const failedCommandCount = commandResults.filter((result) => result.status === 'fail').length;
const overallPass = docReport.passed && failedCommandCount === 0;

const finalReport = {
  commandChecks: commandResults,
  docs: docReport,
  generatedAt: new Date().toISOString(),
  passed: overallPass,
};

if (args.has('--json')) {
  process.stdout.write(`${JSON.stringify(finalReport, null, 2)}\n`);
} else {
  process.stdout.write(`${formatReleaseReadinessDocReport(docReport)}\n`);
  if (commandResults.length > 0) {
    process.stdout.write('\n# Release Readiness Command Checks\n');
    for (const result of commandResults) {
      const status = result.status === 'pass' ? 'PASS' : 'FAIL';
      process.stdout.write(`- [${status}] ${result.label} (${result.command})\n`);
      if (result.status === 'fail' && result.stderr) {
        process.stdout.write(`  stderr: ${result.stderr}\n`);
      }
    }
  }
}

if (!overallPass) {
  process.exit(1);
}
