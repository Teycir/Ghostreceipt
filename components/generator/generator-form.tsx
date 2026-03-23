'use client';

/**
 * components/generator/generator-form.tsx
 *
 * Pure rendering layer — NO async logic, NO inline state machines.
 * All side-effects live in useProofGenerator().
 */

import { useState, useCallback, useId } from 'react';
import { Button }       from '@/components/ui/button';
import { Input }        from '@/components/ui/input';
import { Select }       from '@/components/ui/select';
import { StatusBanner } from '@/components/ui/status-banner';
import { ReceiptSuccess } from './receipt-success';
import { ProofStepper }   from './proof-stepper';
import { useProofGenerator } from '@/lib/generator/use-proof-generator';
import { formatAtomicAmount, atomicUnitLabel, amountPlaceholder } from '@/lib/format/units';
import type { GeneratorFormValues, Chain } from '@/lib/generator/types';

const DEFAULT_VALUES: GeneratorFormValues = {
  chain:         'bitcoin',
  txHash:        '',
  claimedAmount: '',
  minDate:       '',
};

export function GeneratorForm(): React.JSX.Element {
  const formId = useId();
  const [values, setValues] = useState<GeneratorFormValues>(DEFAULT_VALUES);
  const { state, errors, errorMessage, proofResult, generate, reset } = useProofGenerator();

  const isProcessing = state === 'fetching' || state === 'validating' || state === 'generating';

  // Derived
  const humanAmount = formatAtomicAmount(values.claimedAmount, values.chain);

  // Chain change also clears the tx hash — formats are mutually exclusive
  const handleChainChange = useCallback((chain: Chain) => {
    setValues((prev) => ({ ...prev, chain, txHash: '' }));
  }, []);

  const handleTxHashChange = useCallback((raw: string) => {
    // Auto-lowercase Bitcoin hashes as they are case-insensitive hex
    const normalised = values.chain === 'bitcoin' ? raw.toLowerCase() : raw;
    setValues((prev) => ({ ...prev, txHash: normalised }));
  }, [values.chain]);

  const handlePaste = useCallback(async (field: keyof GeneratorFormValues): Promise<void> => {
    try {
      const text = await globalThis.navigator.clipboard.readText();
      const value = field === 'txHash' && values.chain === 'bitcoin'
        ? text.trim().toLowerCase()
        : text.trim();
      setValues((prev) => ({ ...prev, [field]: value }));
    } catch {
      // Clipboard permission denied — silently ignore; user can type manually
    }
  }, [values.chain]);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    await generate(values);
  }, [generate, values]);

  return (
    <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4" id={`${formId}-form`}>
      {/* ── Chain ── */}
      <Select
        label="Chain"
        value={values.chain}
        onChange={(e) => handleChainChange(e.target.value as Chain)}
        disabled={isProcessing}
        error={errors.chain}
      >
        <option value="bitcoin">Bitcoin</option>
        <option value="ethereum">Ethereum</option>
      </Select>

      {/* ── Transaction hash ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label htmlFor={`${formId}-txhash`} className="text-sm font-medium text-white/70">
            Transaction Hash
          </label>
          <button
            type="button"
            onClick={() => { void handlePaste('txHash'); }}
            disabled={isProcessing}
            className="px-2 py-1 text-xs bg-white/5 border border-white/10 rounded text-white/50 hover:bg-white/10 hover:text-white/80 transition-colors disabled:opacity-40"
            aria-label="Paste transaction hash from clipboard"
          >
            📋 Paste
          </button>
        </div>
        <Input
          id={`${formId}-txhash`}
          type="text"
          placeholder={values.chain === 'bitcoin' ? '64 hex characters' : '0x + 64 hex characters'}
          value={values.txHash}
          onChange={handleTxHashChange}
          disabled={isProcessing}
          error={errors.txHash}
        />
      </div>

      {/* ── Claimed amount with live unit hint ── */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor={`${formId}-amount`} className="text-sm font-medium text-white/70">
            Claimed Amount{' '}
            <span className="text-white/35 font-normal">({atomicUnitLabel(values.chain)})</span>
          </label>
          {humanAmount && (
            <span
              className="text-xs font-mono text-cyan-400/80 tabular-nums transition-all duration-300"
              aria-live="polite"
            >
              {humanAmount}
            </span>
          )}
        </div>
        <Input
          id={`${formId}-amount`}
          type="text"
          placeholder={amountPlaceholder(values.chain)}
          value={values.claimedAmount}
          onChange={(v) => setValues((prev) => ({ ...prev, claimedAmount: v.replaceAll(/\D/g, '') }))}
          disabled={isProcessing}
          error={errors.claimedAmount}
        />
      </div>

      {/* ── Min date ── */}
      <Input
        id={`${formId}-date`}
        label="Minimum Date"
        type="date"
        value={values.minDate}
        onChange={(v) => setValues((prev) => ({ ...prev, minDate: v }))}
        disabled={isProcessing}
        error={errors.minDate}
      />

      {/* ── Animated stepper while processing ── */}
      {isProcessing && <ProofStepper state={state} />}

      {/* ── Error ── */}
      {state === 'error' && (
        <div className="space-y-3">
          <StatusBanner variant="error" message={errorMessage} aria="assertive" />
          <Button type="button" onClick={reset} variant="secondary" className="w-full">
            Try Again
          </Button>
        </div>
      )}

      {/* ── Success receipt ── */}
      {state === 'success' && proofResult && (
        <ReceiptSuccess
          proof={proofResult.proof}
          chain={proofResult.chain}
          claimedAmount={proofResult.claimedAmount}
          minDate={proofResult.minDate}
        />
      )}

      {/* ── Submit ── */}
      {(state === 'idle' || state === 'error') && (
        <Button type="submit" variant="primary" className="w-full">
          Generate Receipt
        </Button>
      )}
    </form>
  );
}
