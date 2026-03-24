#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const projectRoot = process.cwd();
const zkeyPath = path.join(projectRoot, 'public/zk/receipt_final.zkey');
const verifierPath = path.join(projectRoot, 'public/zk/Verifier.sol');

if (!existsSync(zkeyPath)) {
  throw new Error(`Missing zkey artifact: ${zkeyPath}`);
}

if (!existsSync(verifierPath)) {
  throw new Error(
    `Missing Solidity verifier artifact: ${verifierPath}\n` +
    'Run `npm run export:solidity-verifier` to generate it.'
  );
}

const tempDir = mkdtempSync(path.join(tmpdir(), 'ghostreceipt-verifier-'));
const generatedPath = path.join(tempDir, 'Verifier.generated.sol');

try {
  execFileSync(
    'npx',
    ['snarkjs', 'zkey', 'export', 'solidityverifier', zkeyPath, generatedPath],
    { stdio: 'pipe' }
  );

  const normalize = (content) => content.replace(/\r\n/g, '\n').trim();
  const expected = normalize(readFileSync(verifierPath, 'utf8'));
  const generated = normalize(readFileSync(generatedPath, 'utf8'));

  if (expected !== generated) {
    throw new Error(
      'public/zk/Verifier.sol is out of sync with public/zk/receipt_final.zkey.\n' +
      'Run `npm run export:solidity-verifier` and commit the updated artifact.'
    );
  }

  console.info('[solidity-verifier] Artifact is synchronized with receipt_final.zkey');
} finally {
  rmSync(tempDir, { force: true, recursive: true });
}
