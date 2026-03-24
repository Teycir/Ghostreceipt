# Task Plan - 2026-03-24

## Objective

Audit application dead code and remove safe, confirmed-unused paths, including compatibility wrappers no longer needed.

## Plan

- [x] Run static checks (`lint`, `typecheck`) to identify dead/unused candidates.
- [x] Run import-graph scan to detect likely orphaned app/runtime modules.
- [x] Remove confirmed-unused app module(s) and fix lint blockers.
- [x] Migrate wrapper-based imports to package-style aliases and remove obsolete wrapper files.
- [x] Re-run verification checks.

## Review

- Status: Complete
- Notes:
  - Removed unused UI module:
    - `components/ui/skeleton.tsx` (no imports in app/lib/components/tests)
  - Fixed lint blocker in reusable browser-core module:
    - `lib/libraries/browser-core/encrypted-link-vault.ts` (`let` -> `const` where reassignment was not needed)
  - Fixed existing script-level lint warnings that were failing global lint gate:
    - `scripts/check-solidity-verifier.mjs` (`console.log` -> `console.info`)
    - `scripts/export-solidity-verifier.mjs` (`console.log` -> `console.info`)
  - Removed obsolete compatibility wrappers after import migration:
    - `lib/zk/witness.ts`
    - `lib/providers/cascade.ts`
    - `lib/providers/types.ts`
    - `lib/providers/api-key-cascade.ts`
  - Migrated imports to package-style aliases:
    - `@ghostreceipt/zk-core/witness`
    - `@ghostreceipt/backend-core/providers`
    - Provider implementations now type-import from `@ghostreceipt/backend-core/providers/types`
  - Updated integration/unit tests to use canonical import paths and compact payload expectations.
  - Verification commands run:
    - `npm run lint`
    - `npm run typecheck`
    - `npm test -- tests/unit/providers/cascade.test.ts tests/unit/zk/witness.test.ts tests/unit/generator/witness-integration.test.ts tests/integration/proof-generation.test.ts --runInBand`
