export interface ZkArtifactChecksumTarget {
  relativePath: string;
  required: boolean;
}

export interface ZkArtifactChecksumEntry extends ZkArtifactChecksumTarget {
  absolutePath: string;
  exists: boolean;
  sha256: string | null;
  sizeBytes: number | null;
}

export interface ZkArtifactChecksumReport {
  generatedAt: string;
  rootDir: string;
  artifacts: ZkArtifactChecksumEntry[];
}

export interface CollectZkArtifactChecksumsOptions {
  includeOptional?: boolean;
  rootDir?: string;
  strict?: boolean;
}

export const ZK_ARTIFACT_CHECKSUM_TARGETS: readonly ZkArtifactChecksumTarget[];

export function collectZkArtifactChecksums(
  options?: CollectZkArtifactChecksumsOptions
): ZkArtifactChecksumReport;

export function formatZkArtifactChecksumReport(report: ZkArtifactChecksumReport): string;
