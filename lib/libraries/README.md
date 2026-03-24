# Reusable Libraries (Cross-Project Ready)

This folder packages app code into reusable library slices for future zk applications.

## Structure

- `lib/libraries/ui`
  - `premium-select.ts`: reusable premium select primitives (options parsing, classes, keyboard helpers).
  - `components/premium-select.tsx`: reusable UI component.
  - `index.ts`: UI exports.

- `lib/libraries/backend`
  - `oracle-signer-cache.ts`: process-level cached signer from env private key.
  - `http-errors.ts`: reusable JSON error + rate-limit response builders for API routes.
  - `index.ts`: backend exports.

- `lib/libraries/zk`
  - `share-payload.ts`: share-payload encode/decode + dangerous-key guard.
  - `index.ts`: zk exports.

- `lib/libraries/index.ts`
  - top-level namespace exports (`UiLibrary`, `BackendLibrary`, `ZkLibrary`).

- `lib/libraries/backend-core`
  - package-style backend core surface:
    - provider contracts + cascade orchestrator,
    - shared route rate-limit envelope (global/client checks + reusable limiter pair factory/dispose),
    - shared request-envelope helpers (secure parse + zod validation + standardized error responses),
    - shared oracle route body envelope (rate-limit + parse + validate in one reusable pipeline),
    - fetch-tx HTTP orchestration helpers (provider factory, signer flow, error mapping),
    - fetch-tx idempotency/session helpers (replay reservation/release + cookie response utility),
    - verify-signature HTTP helpers (request schema + key-aware verification flow).
  - import alias support:
    - `@ghostreceipt/backend-core`
    - `@ghostreceipt/backend-core/*`

- `lib/libraries/zk-core`
  - package-style zk core surface (witness build/validate/extract).
  - import alias support:
    - `@ghostreceipt/zk-core`
    - `@ghostreceipt/zk-core/*`

## Import Stability

- Existing app import path `components/ui/select.tsx` is kept as a stable re-export:
  - `Select` now re-exports `PremiumSelect` from `lib/libraries/ui`.
- Existing provider/zk import paths are kept as wrappers:
  - `lib/providers/cascade.ts` and `lib/providers/types.ts` re-export backend-core modules.
  - `lib/zk/witness.ts` re-exports zk-core witness modules.

## Low-Effort Next Extractions (Identified)

These are simple candidates for future extraction as shared backend/zk libraries:

- `app/api/oracle/verify-signature/route.ts`
  - minimal route orchestration using shared oracle route body envelope
  - HTTP response shaping around backend-core verification outcomes

- `app/api/oracle/fetch-tx/route.ts`
  - minimal route orchestration using shared oracle route body envelope
  - HTTP response shaping around backend-core helper outcomes

- `lib/zk/witness.ts`
  - witness validation and public-signal extraction are already modular and can be promoted to a standalone package surface quickly.

- `lib/providers/*`
  - provider interface and cascade orchestrator are strong package candidates for multi-app reuse.

## Reuse Guidance

For new projects, start from:

- UI: `lib/libraries/ui`
- API/Backend primitives: `lib/libraries/backend`
- ZK payload handling: `lib/libraries/zk`

Then progressively lift `lib/providers`, `lib/zk/witness.ts`, and route orchestration helpers into package-grade modules.
