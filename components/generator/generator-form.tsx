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
  receiptLabel: '',
  receiptCategory: '',
};

export function GeneratorForm(): React.JSX.Element {
  const formId = useId();
  const [values, setValues] = useState<GeneratorFormValues>(DEFAULT_VALUES);
  const [optionalExpanded, setOptionalExpanded] = useState(false);
  const {
    state,
    errors,
    errorMessage,
    processingHint,
    proofResult,
    generate,
    reset,
  } = useProofGenerator();

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

  const optionalCount =
    (values.receiptLabel.trim() ? 1 : 0) + (values.receiptCategory.trim() ? 1 : 0);

  return (
    <form
      onSubmit={(e) => { void handleSubmit(e); }}
      className="space-y-2.5 sm:space-y-3"
      id={`${formId}-form`}
    >
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        {/* ── Chain ── */}
        <Select
          label="Chain"
          value={values.chain}
          onChange={(e) => handleChainChange(e.target.value as Chain)}
          disabled={isProcessing}
          error={errors.chain}
          labelClassName="text-xs"
          className="h-9 rounded-lg px-2.5 py-1.5 text-[13px]"
        >
          <option value="bitcoin">Bitcoin</option>
          <option value="ethereum">Ethereum</option>
        </Select>

        {/* ── Transaction hash ── */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor={`${formId}-txhash`} className="text-xs font-medium text-white/70">
              Transaction Hash
            </label>
            <button
              type="button"
              onClick={() => { void handlePaste('txHash'); }}
              disabled={isProcessing}
              className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/60 transition-colors hover:bg-white/10 hover:text-white/85 disabled:opacity-40"
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
            className="h-9 px-2.5 py-1.5 text-[13px]"
          />
        </div>
      </div>

      {/* ── Claimed amount with live unit hint ── */}
      <div className="grid grid-cols-1 gap-2.5 min-[540px]:grid-cols-2">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor={`${formId}-amount`} className="text-xs font-medium text-white/70">
            Claimed Amount{' '}
              <span className="font-normal text-white/35">({atomicUnitLabel(values.chain)})</span>
            </label>
            {humanAmount && (
              <span
                className="tabular-nums text-[11px] font-mono text-cyan-300/85 transition-all duration-300"
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
            className="h-9 px-2.5 py-1.5 text-[13px]"
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
          className="h-9 px-2.5 py-1.5 text-[13px]"
          labelClassName="text-xs"
        />
      </div>

      {/* ── Optional receipt metadata ── */}
      <div className="rounded-lg border border-white/10 bg-black/10 px-2.5 py-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-white/75">
            Optional receipt details
          </p>
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => setOptionalExpanded((prev) => !prev)}
            className="rounded border border-white/12 bg-white/5 px-2 py-0.5 text-[11px] text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
            aria-expanded={optionalExpanded}
            aria-controls={`${formId}-optional-fields`}
          >
            {optionalExpanded ? 'Hide' : 'Add'}
            {optionalCount > 0 && ` (${optionalCount})`}
          </button>
        </div>

        {optionalExpanded && (
          <div id={`${formId}-optional-fields`} className="mt-2.5 grid grid-cols-2 gap-2.5">
            <Input
              id={`${formId}-label`}
              label="Receipt Label"
              type="text"
              placeholder="Invoice #428"
              value={values.receiptLabel}
              onChange={(v) => setValues((prev) => ({ ...prev, receiptLabel: v }))}
              disabled={isProcessing}
              error={errors.receiptLabel}
              className="h-9 px-2.5 py-1.5 text-[13px]"
              labelClassName="text-xs"
            />

            <Input
              id={`${formId}-category`}
              label="Category"
              type="text"
              placeholder="Operations"
              value={values.receiptCategory}
              onChange={(v) => setValues((prev) => ({ ...prev, receiptCategory: v }))}
              disabled={isProcessing}
              error={errors.receiptCategory}
              className="h-9 px-2.5 py-1.5 text-[13px]"
              labelClassName="text-xs"
            />
          </div>
        )}
      </div>

      {/* ── Animated stepper while processing ── */}
      {isProcessing && (
        <>
          <ProofStepper state={state} />
          {state === 'generating' && processingHint && (
            <StatusBanner variant="warning" message={processingHint} aria="polite" />
          )}
        </>
      )}

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
          {...(proofResult.receiptLabel ? { receiptLabel: proofResult.receiptLabel } : {})}
          {...(proofResult.receiptCategory ? { receiptCategory: proofResult.receiptCategory } : {})}
          {...(proofResult.timings ? { timings: proofResult.timings } : {})}
        />
      )}

      {/* ── Submit ── */}
      {(state === 'idle' || state === 'error') && (
        <Button type="submit" variant="primary" className="w-full py-2 text-[13px]">
          Generate Receipt
        </Button>
      )}
    </form>
  );
}
