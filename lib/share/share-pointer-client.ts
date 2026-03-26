interface SharePointerCreateSuccessResponse {
  data: {
    expiresAt: string;
    id: string;
    verifyUrl: string;
  };
}

interface SharePointerResolveSuccessResponse {
  data: {
    id: string;
    proof: string;
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readErrorMessage(payload: unknown, fallback: string): string {
  const record = asRecord(payload);
  if (!record) {
    return fallback;
  }

  const direct = record['message'];
  if (typeof direct === 'string' && direct.trim().length > 0) {
    return direct;
  }

  const errorRecord = asRecord(record['error']);
  if (!errorRecord) {
    return fallback;
  }

  const nested = errorRecord['message'];
  if (typeof nested === 'string' && nested.trim().length > 0) {
    return nested;
  }

  return fallback;
}

function parseSharePointerCreatePayload(payload: unknown): SharePointerCreateSuccessResponse['data'] | null {
  const record = asRecord(payload);
  if (!record) {
    return null;
  }

  const data = asRecord(record['data']);
  if (!data) {
    return null;
  }

  const id = data['id'];
  const verifyUrl = data['verifyUrl'];
  const expiresAt = data['expiresAt'];
  if (
    typeof id !== 'string' ||
    typeof verifyUrl !== 'string' ||
    typeof expiresAt !== 'string'
  ) {
    return null;
  }

  return { expiresAt, id, verifyUrl };
}

function parseSharePointerResolvePayload(payload: unknown): SharePointerResolveSuccessResponse['data'] | null {
  const record = asRecord(payload);
  if (!record) {
    return null;
  }

  const data = asRecord(record['data']);
  if (!data) {
    return null;
  }

  const id = data['id'];
  const proof = data['proof'];
  if (typeof id !== 'string' || typeof proof !== 'string') {
    return null;
  }

  return { id, proof };
}

export async function createSharePointerLink(proof: string): Promise<SharePointerCreateSuccessResponse['data']> {
  const response = await fetch('/api/share-pointer/create', {
    body: JSON.stringify({ proof }),
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(readErrorMessage(payload, 'Failed to create compact verify link'));
  }

  const parsed = parseSharePointerCreatePayload(payload);
  if (!parsed) {
    throw new Error('Invalid compact-link create response');
  }

  return parsed;
}

export async function resolveSharePointerLink(pointerId: string): Promise<SharePointerResolveSuccessResponse['data']> {
  const response = await fetch(`/api/share-pointer/${encodeURIComponent(pointerId)}`, {
    method: 'GET',
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(readErrorMessage(payload, 'Failed to resolve compact verify link'));
  }

  const parsed = parseSharePointerResolvePayload(payload);
  if (!parsed) {
    throw new Error('Invalid compact-link resolve response');
  }

  return parsed;
}
