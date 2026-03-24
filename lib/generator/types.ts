/**
 * lib/generator/types.ts
 * Single source of truth for all generator-related shared types.
 * Components, hooks, and utilities all import from here.
 */

import type { Chain } from '@/lib/validation/schemas';

export type { Chain };

/** Ordered steps of the proof generation state machine */
export type GeneratorState =
  | 'idle'
  | 'fetching'
  | 'validating'
  | 'generating'
  | 'success'
  | 'error';

/** User-facing form field values */
export interface GeneratorFormValues {
  chain: Chain;
  txHash: string;
  claimedAmount: string;
  minDate: string;
  receiptLabel: string;
  receiptCategory: string;
}

/** Client-side field validation errors */
export type GeneratorFormErrors = Partial<Record<keyof GeneratorFormValues, string>>;

/** The shareable proof output kept in state after success */
export interface GeneratorTimingTelemetry {
  fetchMs: number;
  packageMs: number;
  proveMs: number;
  totalMs: number;
  witnessMs: number;
}

/** The shareable proof output kept in state after success */
export interface ProofResult {
  proof: string;
  chain: Chain;
  claimedAmount: string;
  minDate: string;
  receiptLabel?: string;
  receiptCategory?: string;
  timings?: GeneratorTimingTelemetry;
}

/** Shape of the structured API error payload */
export interface ApiErrorPayload {
  error?: {
    message?: string;
    details?: {
      retryAfterSeconds?: number;
    };
  };
}
