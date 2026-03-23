import {
  __resetZkArtifactCachesForTests,
  fetchVerificationKeyCached,
  getDefaultZkArtifactPaths,
  getZkArtifactVersion,
  preloadZkArtifacts,
} from '@/lib/zk/artifacts';

describe('zk artifact caching', () => {
  const originalArtifactVersion = process.env['NEXT_PUBLIC_ZK_ARTIFACT_VERSION'];

  beforeEach(() => {
    __resetZkArtifactCachesForTests();
    jest.restoreAllMocks();
  });

  afterEach(() => {
    if (originalArtifactVersion === undefined) {
      delete process.env['NEXT_PUBLIC_ZK_ARTIFACT_VERSION'];
    } else {
      process.env['NEXT_PUBLIC_ZK_ARTIFACT_VERSION'] = originalArtifactVersion;
    }
  });

  it('uses configured artifact version when valid', () => {
    process.env['NEXT_PUBLIC_ZK_ARTIFACT_VERSION'] = 'release-2026_03_24';

    expect(getZkArtifactVersion()).toBe('release-2026_03_24');
  });

  it('falls back to default artifact version when invalid', () => {
    process.env['NEXT_PUBLIC_ZK_ARTIFACT_VERSION'] = 'bad version with spaces';

    expect(getZkArtifactVersion()).toBe('2026-03-24');
  });

  it('creates versioned artifact URLs for cache-safe invalidation', () => {
    process.env['NEXT_PUBLIC_ZK_ARTIFACT_VERSION'] = 'v-1';
    const paths = getDefaultZkArtifactPaths();

    expect(paths.wasmPath).toBe('/zk/receipt_js/receipt.wasm?v=v-1');
    expect(paths.zkeyPath).toBe('/zk/receipt_final.zkey?v=v-1');
    expect(paths.vkeyPath).toBe('/zk/verification_key.json?v=v-1');
  });

  it('deduplicates preload fetches per artifact version', async () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    const paths = {
      version: 'dedupe-v1',
      wasmPath: '/zk/receipt_js/receipt.wasm?v=dedupe-v1',
      zkeyPath: '/zk/receipt_final.zkey?v=dedupe-v1',
      vkeyPath: '/zk/verification_key.json?v=dedupe-v1',
    };

    await Promise.all([
      preloadZkArtifacts(paths),
      preloadZkArtifacts(paths),
    ]);

    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('caches verification-key JSON in memory', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ vk_alpha_1: ['1', '2'] }), { status: 200 })
    );

    const a = await fetchVerificationKeyCached('/zk/verification_key.json?v=cache-1');
    const b = await fetchVerificationKeyCached('/zk/verification_key.json?v=cache-1');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
  });
});
