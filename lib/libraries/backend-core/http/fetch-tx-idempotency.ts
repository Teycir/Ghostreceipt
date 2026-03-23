import { NextResponse } from 'next/server';
import { replayProtection } from '@/lib/security/replay';

export const FETCH_TX_ANON_IDEMPOTENCY_COOKIE = 'gr_sid';

export interface ReserveFetchTxReplayKeyInput {
  anonymousSessionIdFromCookie: string | null;
  clientId: string | null;
  idempotencyKey?: string;
  nowMs?: number;
}

export interface FetchTxReplayReservation {
  anonymousSessionIdToSet: string | null;
  replayConflictReason: string | null;
  replayKey: string | null;
}

export function createFetchTxAnonymousSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function withFetchTxAnonymousSessionCookie(
  response: NextResponse,
  anonymousSessionId: string | null
): NextResponse {
  if (!anonymousSessionId) {
    return response;
  }

  response.cookies.set({
    name: FETCH_TX_ANON_IDEMPOTENCY_COOKIE,
    value: anonymousSessionId,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env['NODE_ENV'] === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}

export function reserveFetchTxReplayKey({
  anonymousSessionIdFromCookie,
  clientId,
  idempotencyKey,
  nowMs = Date.now(),
}: ReserveFetchTxReplayKeyInput): FetchTxReplayReservation {
  const normalizedIdempotencyKey = idempotencyKey?.trim();
  if (!normalizedIdempotencyKey) {
    return {
      anonymousSessionIdToSet: null,
      replayConflictReason: null,
      replayKey: null,
    };
  }

  const anonymousSessionId =
    anonymousSessionIdFromCookie ?? createFetchTxAnonymousSessionId();
  const idempotencyScope = clientId ?? `sid:${anonymousSessionId}`;
  const anonymousSessionIdToSet =
    !clientId && !anonymousSessionIdFromCookie ? anonymousSessionId : null;
  const replayKey = `${idempotencyScope}:${normalizedIdempotencyKey}`;
  const replayCheck = replayProtection.check(replayKey, nowMs);

  if (!replayCheck.allowed) {
    return {
      anonymousSessionIdToSet,
      replayConflictReason: replayCheck.reason ?? 'Duplicate idempotency key',
      replayKey: null,
    };
  }

  return {
    anonymousSessionIdToSet,
    replayConflictReason: null,
    replayKey,
  };
}

export function releaseFetchTxReplayKey(replayKey: string | null): void {
  if (!replayKey) {
    return;
  }

  replayProtection.release(replayKey);
}

export function disposeFetchTxReplayProtection(): void {
  replayProtection.dispose();
}
