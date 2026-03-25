#!/usr/bin/env node

import {
  collectZkArtifactChecksums,
  formatZkArtifactChecksumReport,
} from '../lib/zk/artifact-checksums.js';

const args = new Set(process.argv.slice(2));
const allowedArgs = new Set(['--json', '--required-only']);

for (const arg of args) {
  if (!allowedArgs.has(arg)) {
    console.error(`Unknown argument: ${arg}`);
    console.error('Usage: npm run check:zk-artifact-checksums [-- --json] [-- --required-only]');
    process.exit(1);
  }
}

try {
  const report = collectZkArtifactChecksums({
    includeOptional: !args.has('--required-only'),
    strict: true,
  });

  if (args.has('--json')) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`${formatZkArtifactChecksumReport(report)}\n`);
  }
} catch (error) {
  console.error('ZK artifact checksum check failed');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
