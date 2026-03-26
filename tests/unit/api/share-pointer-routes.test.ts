import { NextRequest } from 'next/server';
import { POST as createPointer } from '@/app/api/share-pointer/create/route';
import { POST as resolvePointer } from '@/app/api/share-pointer/resolve/route';
import { __resetSharePointerManagerForTests } from '@/lib/share/share-pointer-service';

describe('Share pointer API routes', () => {
  beforeEach(async () => {
    await __resetSharePointerManagerForTests();
  });

  afterEach(async () => {
    await __resetSharePointerManagerForTests();
  });

  it('creates a pointer and resolves it back to proof payload', async () => {
    const createRequest = new NextRequest('http://localhost:3000/api/share-pointer/create', {
      body: JSON.stringify({
        proof: 'proof-payload-example',
      }),
      method: 'POST',
    });

    const createResponse = await createPointer(createRequest);
    const createPayload = await createResponse.json();

    expect(createResponse.status).toBe(200);
    expect(createPayload.data.id).toMatch(/^r_[A-Za-z0-9_-]{16}$/u);
    expect(createPayload.data.verifyUrl).toContain('/verify?sid=');
    expect(typeof createPayload.data.expiresAt).toBe('string');

    const pointerId = createPayload.data.id as string;
    const resolveRequest = new NextRequest('http://localhost:3000/api/share-pointer/resolve', {
      body: JSON.stringify({
        id: pointerId,
      }),
      method: 'POST',
    });
    const resolveResponse = await resolvePointer(resolveRequest);
    const resolvePayload = await resolveResponse.json();

    expect(resolveResponse.status).toBe(200);
    expect(resolvePayload.data.id).toBe(pointerId);
    expect(resolvePayload.data.proof).toBe('proof-payload-example');
  });

  it('rejects malformed pointer ids', async () => {
    const resolveRequest = new NextRequest('http://localhost:3000/api/share-pointer/resolve', {
      body: JSON.stringify({
        id: 'bad-id',
      }),
      method: 'POST',
    });
    const resolveResponse = await resolvePointer(resolveRequest);
    const payload = await resolveResponse.json();

    expect(resolveResponse.status).toBe(400);
    expect(payload.error.message).toBe('Invalid share pointer resolve request');
  });

  it('returns 404 for unknown pointer id', async () => {
    const unknownId = 'r_AAAAAAAAAAAAAAAA';
    const resolveRequest = new NextRequest('http://localhost:3000/api/share-pointer/resolve', {
      body: JSON.stringify({
        id: unknownId,
      }),
      method: 'POST',
    });
    const resolveResponse = await resolvePointer(resolveRequest);
    const payload = await resolveResponse.json();

    expect(resolveResponse.status).toBe(404);
    expect(payload.error.message).toBe('Share pointer was not found');
  });
});
