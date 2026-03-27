import { postOracleJson } from '@/lib/oracle/client';

describe('postOracleJson', () => {
  const originalFetch = global.fetch;
  const originalBackupBase = process.env['NEXT_PUBLIC_ORACLE_EDGE_BACKUP_BASE'];

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    global.fetch = originalFetch;
    if (originalBackupBase === undefined) {
      delete process.env['NEXT_PUBLIC_ORACLE_EDGE_BACKUP_BASE'];
    } else {
      process.env['NEXT_PUBLIC_ORACLE_EDGE_BACKUP_BASE'] = originalBackupBase;
    }
  });

  it('uses primary /api endpoint when request succeeds', async () => {
    delete process.env['NEXT_PUBLIC_ORACLE_EDGE_BACKUP_BASE'];
    const fetchMock = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }));
    global.fetch = fetchMock as typeof fetch;

    const result = await postOracleJson('fetch-tx', {
      chain: 'bitcoin',
      txHash: 'a'.repeat(64),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/oracle/fetch-tx');
    expect(result.usedBackup).toBe(false);
  });

  it('falls back to configured edge backup on primary 503 response', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    process.env['NEXT_PUBLIC_ORACLE_EDGE_BACKUP_BASE'] =
      'https://edge-backup.ghostreceipt.test/api/oracle';
    const fetchMock = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValueOnce(new Response('unavailable', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {} }), { status: 200 }));
    global.fetch = fetchMock as typeof fetch;

    const result = await postOracleJson('fetch-tx', {
      chain: 'bitcoin',
      txHash: 'b'.repeat(64),
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/oracle/fetch-tx');
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      'https://edge-backup.ghostreceipt.test/api/oracle/fetch-tx'
    );
    expect(result.usedBackup).toBe(true);
    expect(result.endpoint).toBe('https://edge-backup.ghostreceipt.test/api/oracle/fetch-tx');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        '[Oracle] Endpoint /api/oracle/fetch-tx returned HTTP 503. Trying backup endpoint.'
      )
    );
    warnSpy.mockRestore();
  });

  it('falls back to configured edge backup on primary network error', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    process.env['NEXT_PUBLIC_ORACLE_EDGE_BACKUP_BASE'] =
      'https://edge-backup.ghostreceipt.test/api/oracle';
    const fetchMock = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockRejectedValueOnce(new TypeError('primary transport error'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ valid: true }), { status: 200 }));
    global.fetch = fetchMock as typeof fetch;

    const result = await postOracleJson('verify-signature', {
      expiresAt: 1,
      messageHash: 'm'.repeat(64),
      nonce: 'n',
      oraclePubKeyId: 'k',
      oracleSignature: 's'.repeat(128),
      signedAt: 1,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/oracle/verify-signature');
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      'https://edge-backup.ghostreceipt.test/api/oracle/verify-signature'
    );
    expect(result.usedBackup).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        '[Oracle] Endpoint /api/oracle/verify-signature failed (primary transport error). Trying backup endpoint.'
      )
    );
    warnSpy.mockRestore();
  });

  it('does not fall back for client-side 429 responses', async () => {
    process.env['NEXT_PUBLIC_ORACLE_EDGE_BACKUP_BASE'] =
      'https://edge-backup.ghostreceipt.test/api/oracle';
    const fetchMock = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: { message: 'rate limited' } }), { status: 429 })
      );
    global.fetch = fetchMock as typeof fetch;

    const result = await postOracleJson('verify-signature', {
      expiresAt: 1,
      messageHash: 'm'.repeat(64),
      nonce: 'n',
      oraclePubKeyId: 'k',
      oracleSignature: 's'.repeat(128),
      signedAt: 1,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/oracle/verify-signature');
    expect(result.response.status).toBe(429);
    expect(result.usedBackup).toBe(false);
  });

  it('fails fast with a plain timeout error when no endpoint responds in time', async () => {
    delete process.env['NEXT_PUBLIC_ORACLE_EDGE_BACKUP_BASE'];
    jest.useFakeTimers();

    const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>((_, init) => (
      new Promise((_, reject) => {
        const signal = init?.signal;
        if (!signal) {
          return;
        }
        signal.addEventListener(
          'abort',
          () => {
            const abortError = new Error('The operation was aborted.');
            abortError.name = 'AbortError';
            reject(abortError);
          },
          { once: true }
        );
      })
    ));
    global.fetch = fetchMock as typeof fetch;

    const requestPromise = postOracleJson(
      'fetch-tx',
      {
        chain: 'solana',
        txHash: '5r4xXAcpFZxbSvX2zjVxgRS4o28ubvF3iPaFCVXdC6TeXiEwFFdZuPYoknsMdWVGFsQybgTf7yNbywQr7Dbj3rXf',
      },
      { timeoutMs: 25 }
    );
    const rejectionExpectation = expect(requestPromise).rejects.toThrow(
      'could not reach the transaction service in time'
    );

    await jest.advanceTimersByTimeAsync(30);

    await rejectionExpectation;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to backup endpoint when primary times out', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    process.env['NEXT_PUBLIC_ORACLE_EDGE_BACKUP_BASE'] =
      'https://edge-backup.ghostreceipt.test/api/oracle';
    jest.useFakeTimers();

    const fetchMock = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockImplementationOnce((_, init) => (
        new Promise((_, reject) => {
          const signal = init?.signal;
          if (!signal) {
            return;
          }
          signal.addEventListener(
            'abort',
            () => {
              const abortError = new Error('The operation was aborted.');
              abortError.name = 'AbortError';
              reject(abortError);
            },
            { once: true }
          );
        })
      ))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {} }), { status: 200 }));
    global.fetch = fetchMock as typeof fetch;

    const requestPromise = postOracleJson(
      'fetch-tx',
      {
        chain: 'bitcoin',
        txHash: 'a'.repeat(64),
      },
      { timeoutMs: 25 }
    );

    await jest.advanceTimersByTimeAsync(30);
    const result = await requestPromise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.usedBackup).toBe(true);
    expect(result.endpoint).toBe('https://edge-backup.ghostreceipt.test/api/oracle/fetch-tx');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('request timed out after 1 second')
    );
    warnSpy.mockRestore();
  });
});
