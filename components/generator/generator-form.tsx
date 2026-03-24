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
import type { GeneratorFormValues } from '@/lib/generator/types';

const DEFAULT_VALUES: GeneratorFormValues = {
  chain:         'bitcoin',
  ethereumAsset: 'native',
  txHash:        '',
  claimedAmount: '',
  discloseAmount: true,
  discloseMinDate: true,
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
  const humanAmount = formatAtomicAmount(values.claimedAmount, values.chain, values.ethereumAsset);

  type ChainModeValue = 'bitcoin' | 'ethereum' | 'solana' | 'ethereum-usdc';
  const chainModeValue: ChainModeValue =
    values.chain === 'ethereum' && values.ethereumAsset === 'usdc'
      ? 'ethereum-usdc'
      : values.chain;

  // Chain/asset mode changes reset tx hash + claimed amount to avoid stale-format claims.
  const handleChainModeChange = useCallback((mode: ChainModeValue) => {
    setValues((prev) => {
      if (mode === 'bitcoin') {
        return {
          ...prev,
          chain: 'bitcoin',
          ethereumAsset: 'native',
          txHash: '',
          claimedAmount: '',
        };
      }

      if (mode === 'ethereum-usdc') {
        return {
          ...prev,
          chain: 'ethereum',
          ethereumAsset: 'usdc',
          txHash: '',
          claimedAmount: '',
        };
      }

      if (mode === 'solana') {
        return {
          ...prev,
          chain: 'solana',
          ethereumAsset: 'native',
          txHash: '',
          claimedAmount: '',
        };
      }

      return {
        ...prev,
        chain: 'ethereum',
        ethereumAsset: 'native',
        txHash: '',
        claimedAmount: '',
      };
    });
  }, []);

  const handleTxHashChange = useCallback((raw: string) => {
    // Auto-lowercase Bitcoin hashes as they are case-insensitive hex
    const normalised = values.chain === 'bitcoin' ? raw.toLowerCase() : raw;
    setValues((prev) => ({ ...prev, txHash: normalised }));
  }, [values.chain]);

  const handlePaste = useCallback(async (field: 'txHash'): Promise<void> => {
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
      className="space-y-2"
      id={`${formId}-form`}
    >
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {/* ── Chain ── */}
        <Select
          label="Chain"
          value={chainModeValue}
          onChange={(event) => handleChainModeChange(event.target.value as ChainModeValue)}
          disabled={isProcessing}
          error={errors.chain}
          labelClassName="text-xs"
          className="h-8 rounded-lg px-2 py-1 text-[12px]"
        >
          <option value="bitcoin">Bitcoin</option>
          <option value="ethereum">Ethereum (ETH)</option>
          <option value="ethereum-usdc">Ethereum (USDC)</option>
          <option value="solana" disabled>Solana (SOL) — coming soon</option>
        </Select>

        {/* ── Transaction hash ── */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor={`${formId}-txhash`} className="text-xs font-medium text-white/70">
              Transaction Hash
            </label>
            <button
              type="button"
              onClick={() => { void handlePaste('txHash'); }}
              disabled={isProcessing}
              className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/60 transition-colors hover:bg-white/10 hover:text-white/85 disabled:opacity-40"
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
            className="h-8 px-2 py-1 text-[12px]"
          />
        </div>
      </div>

      {/* ── Claimed amount with live unit hint ── */}
      <div className="grid grid-cols-1 gap-2 min-[540px]:grid-cols-2">
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor={`${formId}-amount`} className="text-xs font-medium text-white/70">
            Claimed Amount{' '}
              <span className="font-normal text-white/35">({atomicUnitLabel(values.chain, values.ethereumAsset)})</span>
            </label>
            {humanAmount && (
              <span
                className="tabular-nums text-[10px] font-mono text-cyan-300/85 transition-all duration-300"
                aria-live="polite"
              >
                {humanAmount}
              </span>
            )}
          </div>
          <Input
            id={`${formId}-amount`}
            type="text"
            placeholder={amountPlaceholder(values.chain, values.ethereumAsset)}
            value={values.claimedAmount}
            onChange={(v) => setValues((prev) => ({ ...prev, claimedAmount: v.replaceAll(/\D/g, '') }))}
            disabled={isProcessing}
            error={errors.claimedAmount}
            className="h-8 px-2 py-1 text-[12px]"
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
          className="h-8 px-2 py-1 text-[12px]"
          labelClassName="text-xs"
        />
      </div>

      <div className="rounded-lg border border-white/10 bg-black/10 px-2 py-2">
        <p className="text-xs font-medium text-white/75">Selective disclosure</p>
        <p className="mt-1 text-[11px] text-white/45">
          Choose which claim fields are visible in the shared receipt.
        </p>
        <div className="mt-2 grid grid-cols-1 gap-2 min-[540px]:grid-cols-2">
          <label className="flex items-center justify-between rounded border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white/80">
            <span>Disclose minimum amount</span>
            <input
              type="checkbox"
              checked={values.discloseAmount}
              onChange={(event) => {
                const checked = event.target.checked;
                setValues((prev) => ({ ...prev, discloseAmount: checked }));
              }}
              disabled={isProcessing}
              className="h-3.5 w-3.5 accent-cyan-400"
            />
          </label>
          <label className="flex items-center justify-between rounded border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white/80">
            <span>Disclose minimum date</span>
            <input
              type="checkbox"
              checked={values.discloseMinDate}
              onChange={(event) => {
                const checked = event.target.checked;
                setValues((prev) => ({ ...prev, discloseMinDate: checked }));
              }}
              disabled={isProcessing}
              className="h-3.5 w-3.5 accent-cyan-400"
            />
          </label>
        </div>
      </div>

      {/* ── Optional receipt metadata ── */}
      <div className="rounded-lg border border-white/10 bg-black/10 px-2 py-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-white/75">
            Optional receipt details
          </p>
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => setOptionalExpanded((prev) => !prev)}
            className="rounded border border-white/12 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
            aria-expanded={optionalExpanded}
            aria-controls={`${formId}-optional-fields`}
          >
            {optionalExpanded ? 'Hide' : 'Add'}
            {optionalCount > 0 && ` (${optionalCount})`}
          </button>
        </div>

        {optionalExpanded && (
          <div id={`${formId}-optional-fields`} className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
            <Input
              id={`${formId}-label`}
              label="Receipt Label"
              type="text"
              placeholder="Invoice #428"
              value={values.receiptLabel}
              onChange={(v) => setValues((prev) => ({ ...prev, receiptLabel: v }))}
              disabled={isProcessing}
              error={errors.receiptLabel}
              className="h-8 px-2 py-1 text-[12px]"
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
              className="h-8 px-2 py-1 text-[12px]"
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
          ethereumAsset={proofResult.ethereumAsset}
          claimedAmount={proofResult.claimedAmount}
          minDate={proofResult.minDate}
          {...(proofResult.receiptLabel ? { receiptLabel: proofResult.receiptLabel } : {})}
          {...(proofResult.receiptCategory ? { receiptCategory: proofResult.receiptCategory } : {})}
          {...(proofResult.timings ? { timings: proofResult.timings } : {})}
        />
      )}

      {/* ── Submit ── */}
      {(state === 'idle' || state === 'error') && (
        <Button type="submit" variant="primary" className="w-full py-1.5 text-[12px]">
          Generate Receipt
        </Button>
      )}
    </form>
  );
}
