# Oracle Fail-Safe Architecture (Client Primary, Edge Backup)

## Goal

Keep the default user path stable and predictable (`/api/oracle/*`) while preserving an optional edge backup path for outage scenarios.

## Route Policy

- Primary route: `/api/oracle/*`
- Optional backup base: `NEXT_PUBLIC_ORACLE_EDGE_BACKUP_BASE`
  - Example: `https://ghostreceipt-edge-backup.pages.dev/api/oracle`
  - Full backup route for fetch: `${NEXT_PUBLIC_ORACLE_EDGE_BACKUP_BASE}/fetch-tx`

## Fallback Trigger Rules

Fallback is used only when the primary route is unavailable at transport/platform level:

- network/transport errors (request throws),
- `404`,
- `405`,
- `5xx`.

Fallback is not used for normal client responses (`4xx`, including `429`) to avoid bypassing validation and rate-limit protections.

## Performance Implications

- Normal path (primary healthy): single request, no failover overhead.
- During failover events: one failed primary attempt plus one backup retry adds an extra network round-trip for that request.
- If backup should be disabled, set `NEXT_PUBLIC_ORACLE_EDGE_BACKUP_BASE=` (empty) or one of `off/false/none/disabled`.

## Implementation Reference

- Shared client transport helper: `lib/oracle/client.ts`
- Generator call path: `lib/generator/use-proof-generator.ts`
- Verifier call path: `lib/verify/receipt-verifier.ts`

## Configuration

In `.env.local` (or deployed env):

```bash
# Disabled by default
NEXT_PUBLIC_ORACLE_EDGE_BACKUP_BASE=

# Example enabled value
NEXT_PUBLIC_ORACLE_EDGE_BACKUP_BASE=https://ghostreceipt-edge-backup.pages.dev/api/oracle
```

## Verification Checklist

1. Primary healthy:
   - Verify requests succeed via `/api/oracle/*` with backup disabled.
2. Backup availability:
   - Confirm backup deployment answers the same contract under its configured base.
3. Failover drill:
   - Simulate primary `503` or network failure and verify backup handles request.
4. Non-failover guard:
   - Simulate primary `429` and verify no backup retry occurs.

Quick local drill command:

```bash
npm run test:drill:oracle-failover
```

## Test Coverage

- Unit coverage for route failover policy:
  - `tests/unit/oracle/client.test.ts`
- Live runtime comparisons (legacy vs edge):
  - `tests/integration/live-legacy-vs-edge-speed.test.ts`
  - `tests/integration/live-legacy-vs-edge-speed-matrix.test.ts`

## Suggested Observability Signals

- Failover frequency (count of requests that needed backup).
- Rate-limit response frequency (`429` on oracle routes).
- Idempotency replay detections (`REPLAY_DETECTED`).
- Circuit-breaker activation count for durable limiter modes (when enabled).
