/* global process */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const ZK_ARTIFACT_CHECKSUM_TARGETS = Object.freeze([
  Object.freeze({ relativePath: 'public/zk/receipt_js/receipt.wasm', required: true }),
  Object.freeze({ relativePath: 'public/zk/receipt_final.zkey', required: true }),
  Object.freeze({ relativePath: 'public/zk/verification_key.json', required: true }),
  Object.freeze({ relativePath: 'public/zk/receipt.r1cs', required: false }),
  Object.freeze({ relativePath: 'public/zk/Verifier.sol', required: false }),
  Object.freeze({ relativePath: 'public/zk/pot14_final.ptau', required: false }),
]);

function sha256Hex(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function collectZkArtifactChecksums(options = {}) {
  const {
    includeOptional = true,
    rootDir = process.cwd(),
    strict = true,
  } = options;

  const selectedTargets = includeOptional
    ? ZK_ARTIFACT_CHECKSUM_TARGETS
    : ZK_ARTIFACT_CHECKSUM_TARGETS.filter((target) => target.required);

  const artifacts = selectedTargets.map((target) => {
    const absolutePath = resolve(rootDir, target.relativePath);
    if (!existsSync(absolutePath)) {
      return {
        absolutePath,
        exists: false,
        required: target.required,
        relativePath: target.relativePath,
        sha256: null,
        sizeBytes: null,
      };
    }

    const fileBuffer = readFileSync(absolutePath);
    return {
      absolutePath,
      exists: true,
      required: target.required,
      relativePath: target.relativePath,
      sha256: sha256Hex(fileBuffer),
      sizeBytes: statSync(absolutePath).size,
    };
  });

  const missingRequired = artifacts.filter((artifact) => artifact.required && !artifact.exists);
  if (strict && missingRequired.length > 0) {
    const paths = missingRequired.map((artifact) => `- ${artifact.relativePath}`).join('\n');
    throw new Error(`Missing required ZK artifacts:\n${paths}`);
  }

  return {
    artifacts,
    generatedAt: new Date().toISOString(),
    rootDir: resolve(rootDir),
  };
}

function formatZkArtifactChecksumReport(report) {
  const lines = [
    '# ZK Artifact Checksums',
    `Generated at: ${report.generatedAt}`,
    `Root directory: ${report.rootDir}`,
    '',
  ];

  for (const artifact of report.artifacts) {
    if (!artifact.exists) {
      lines.push(`- ${artifact.relativePath} [MISSING]`);
      continue;
    }

    lines.push(`- ${artifact.relativePath}`);
    lines.push(`  sha256: ${artifact.sha256}`);
    lines.push(`  sizeBytes: ${artifact.sizeBytes}`);
  }

  return lines.join('\n');
}

export {
  ZK_ARTIFACT_CHECKSUM_TARGETS,
  collectZkArtifactChecksums,
  formatZkArtifactChecksumReport,
};
