# Task Plan - 2026-03-24

## Objective

Study `Repos/Timeseal` local encrypted-link storage flow and abstract it into a reusable GhostReceipt library module.

## Plan

- [x] Study Timeseal storage flow (`lib/encryptedStorage.ts`, create/dashboard/pulse usage points) and extract reusable primitives.
- [x] Implement a reusable browser-core encrypted link vault library (adapter-driven storage + encryption + deterministic pruning).
- [x] Add unit tests in `tests/` for round-trip encryption, pruning behavior, opened-state updates, and quota retry handling.
- [x] Export/document the new library in `lib/libraries/*` surfaces for cross-project reuse.
- [x] Run verification (`npm run typecheck` + targeted jest suite).

## Review

- Status: Complete
- Notes:
  - Added `lib/libraries/browser-core/encrypted-link-vault.ts`:
    - Timeseal-derived encrypted local storage (AES-GCM),
    - adapter-driven persistence (`LinkVaultStorageAdapter`),
    - CRUD helpers (`addRecord`, `listRecords`, `saveRecords`, `removeRecord`, `markRecordOpened`, `clearRecords`),
    - deterministic oldest-first pruning and quota retry flow,
    - storage pressure/status label support.
  - Added browser-core package surface:
    - `lib/libraries/browser-core/index.ts`
    - `@ghostreceipt/browser-core` + `@ghostreceipt/browser-core/*` aliases in `tsconfig.json`
    - top-level export via `lib/libraries/index.ts`
    - docs update in `lib/libraries/README.md`
  - Added tests in `tests/unit/browser-core/encrypted-link-vault.test.ts`:
    - encrypted round-trip storage
    - opened-state updates
    - high-water pruning
    - quota retry pruning
  - Verification commands run:
    - `npm run typecheck`
    - `npm test -- tests/unit/browser-core/encrypted-link-vault.test.ts tests/unit/backend-core/http/share-pointer-storage.test.ts --runInBand`
