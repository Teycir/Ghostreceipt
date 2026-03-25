import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import {
  collectZkArtifactChecksums,
  formatZkArtifactChecksumReport,
} from '@/lib/zk/artifact-checksums';

function writeFileInTemp(rootDir: string, relativePath: string, content: string): void {
  const absolutePath = join(rootDir, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content);
}

describe('zk artifact checksums', () => {
  let tempRootDir = '';

  beforeEach(() => {
    tempRootDir = mkdtempSync(join(tmpdir(), 'ghostreceipt-zk-checksums-'));
  });

  afterEach(() => {
    if (tempRootDir) {
      rmSync(tempRootDir, { force: true, recursive: true });
    }
  });

  it('collects deterministic checksums for required artifacts', () => {
    writeFileInTemp(tempRootDir, 'public/zk/receipt_js/receipt.wasm', 'wasm-contents');
    writeFileInTemp(tempRootDir, 'public/zk/receipt_final.zkey', 'zkey-contents');
    writeFileInTemp(tempRootDir, 'public/zk/verification_key.json', '{"vk":"data"}');

    const report = collectZkArtifactChecksums({
      includeOptional: false,
      rootDir: tempRootDir,
      strict: true,
    });

    expect(report.artifacts).toHaveLength(3);
    expect(report.artifacts.map((artifact) => artifact.relativePath)).toEqual([
      'public/zk/receipt_js/receipt.wasm',
      'public/zk/receipt_final.zkey',
      'public/zk/verification_key.json',
    ]);

    const expectedWasmHash = createHash('sha256')
      .update(Buffer.from('wasm-contents'))
      .digest('hex');
    expect(report.artifacts[0]).toMatchObject({
      exists: true,
      relativePath: 'public/zk/receipt_js/receipt.wasm',
      sha256: expectedWasmHash,
    });
  });

  it('throws when required artifacts are missing in strict mode', () => {
    writeFileInTemp(tempRootDir, 'public/zk/receipt_js/receipt.wasm', 'wasm-contents');

    expect(() => {
      collectZkArtifactChecksums({
        includeOptional: false,
        rootDir: tempRootDir,
        strict: true,
      });
    }).toThrow('Missing required ZK artifacts');
  });

  it('marks optional artifacts as missing in non-strict mode', () => {
    writeFileInTemp(tempRootDir, 'public/zk/receipt_js/receipt.wasm', 'wasm-contents');
    writeFileInTemp(tempRootDir, 'public/zk/receipt_final.zkey', 'zkey-contents');
    writeFileInTemp(tempRootDir, 'public/zk/verification_key.json', '{"vk":"data"}');

    const report = collectZkArtifactChecksums({
      includeOptional: true,
      rootDir: tempRootDir,
      strict: false,
    });
    const optionalMissing = report.artifacts.filter(
      (artifact) => !artifact.required && !artifact.exists
    );

    expect(optionalMissing.length).toBeGreaterThan(0);

    const output = formatZkArtifactChecksumReport(report);
    expect(output).toContain('# ZK Artifact Checksums');
    expect(output).toContain('[MISSING]');
  });
});
