#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const zkeyPath = path.join(projectRoot, 'public/zk/receipt_final.zkey');
const outputPath = path.join(projectRoot, 'public/zk/Verifier.sol');

if (!existsSync(zkeyPath)) {
  throw new Error(`Missing zkey artifact: ${zkeyPath}`);
}

mkdirSync(path.dirname(outputPath), { recursive: true });

execFileSync(
  'npx',
  ['snarkjs', 'zkey', 'export', 'solidityverifier', zkeyPath, outputPath],
  { stdio: 'inherit' }
);

console.log(`[solidity-verifier] Generated ${path.relative(projectRoot, outputPath)}`);
