# Lessons Learned

## 2026-03-21 - Verification Claim Source Integrity
- Never display verification claims from URL metadata if equivalent values are present in proof public signals.
- Treat URL params as transport only; treat verified proof signals as source of truth for user-visible claim fields.

## 2026-03-21 - Share Payload Decoding
- When reading query params via `URLSearchParams`, avoid extra `decodeURIComponent` unless there is a proven double-encoding path.
- Keep share format parsing backward-compatible when introducing a new encoded format.

## 2026-03-21 - Test Fixture Schema Drift
- Keep test fixtures synced with schema field renames (`schemaVersion`, `oraclePubKeyId`, `messageHash`) when typed contracts evolve.
- Run `npm run typecheck` as a mandatory gate after schema changes before marking implementation as controlled.
