'use client';

/**
 * components/generator/generator-form.tsx
 *
 * Generator UI layer with local-only UX effects (draft/history helpers).
 * Proof fetch/validate/generate side-effects live in useProofGenerator().
 */

import { useState, useCallback, useEffect, useId, useMemo } from 'react';
import { Button }       from '@/components/ui/button';
import { Input }        from '@/components/ui/input';
import { Select }       from '@/components/ui/select';
import { StatusBanner } from '@/components/ui/status-banner';
import { ReceiptSuccess } from './receipt-success';
import { ProofStepper }   from './proof-stepper';
import { useProofGenerator } from '@/lib/generator/use-proof-generator';
import { formatAtomicAmount, atomicUnitLabel, amountPlaceholder } from '@/lib/format/units';
import type { GeneratorFormValues } from '@/lib/generator/types';
import {
  listReceiptHistoryEntries,
  type ReceiptHistoryEntry,
} from '@/lib/history/receipt-history';
import { detectChainFromTxHash, isValidTxHashForChain } from '@/lib/generator/tx-hash-detection';
import { loadGeneratorDraft, saveGeneratorDraft } from '@/lib/generator/form-draft';

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

function formatRecentChain(entry: ReceiptHistoryEntry): string {
  if (entry.chain === 'bitcoin') {
    return 'BTC';
  }
  if (entry.chain === 'solana') {
    return 'SOL';
  }
  return entry.ethereumAsset === 'usdc' ? 'ETH-USDC' : 'ETH';
}

function buildVerifyUrl(proof: string): string {
  const params = new URLSearchParams({ proof });
  return `${globalThis.location.origin}/verify?${params.toString()}`;
}

export function GeneratorForm(): React.JSX.Element {
  const formId = useId();
  const [values, setValues] = useState<GeneratorFormValues>(DEFAULT_VALUES);
  const [optionalExpanded, setOptionalExpanded] = useState(false);
  const [draftStatus, setDraftStatus] = useState('');
  const [txHashHint, setTxHashHint] = useState('');
  const [recentReceipts, setRecentReceipts] = useState<ReceiptHistoryEntry[]>([]);
  const [recentStatus, setRecentStatus] = useState('');
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
  const txHashFormatValid = isValidTxHashForChain(values.txHash, values.chain);

  type ChainModeValue = 'bitcoin' | 'ethereum' | 'solana' | 'ethereum-usdc';
  const chainModeValue: ChainModeValue =
    values.chain === 'ethereum' && values.ethereumAsset === 'usdc'
      ? 'ethereum-usdc'
      : values.chain;

  const refreshRecentReceipts = useCallback(async (): Promise<void> => {
    try {
      const entries = await listReceiptHistoryEntries();
      setRecentReceipts(entries.slice(0, 5));
    } catch {
      setRecentReceipts([]);
    }
  }, []);

  useEffect(() => {
    const draft = loadGeneratorDraft();
    if (!draft) {
      return;
    }

    setValues(draft);
    setOptionalExpanded(Boolean(draft.receiptLabel.trim() || draft.receiptCategory.trim()));
    setDraftStatus('Restored your saved draft from this browser.');
    const clearTimer = globalThis.setTimeout(() => {
      setDraftStatus('');
    }, 3500);

    return () => {
      globalThis.clearTimeout(clearTimer);
    };
  }, []);

  useEffect(() => {
    const saveTimer = globalThis.setTimeout(() => {
      saveGeneratorDraft(values);
    }, 250);

    return () => {
      globalThis.clearTimeout(saveTimer);
    };
  }, [values]);

  useEffect(() => {
    void refreshRecentReceipts();
  }, [refreshRecentReceipts]);

  useEffect(() => {
    if (state !== 'success') {
      return;
    }
    const refreshTimer = globalThis.setTimeout(() => {
      void refreshRecentReceipts();
    }, 300);

    return () => {
      globalThis.clearTimeout(refreshTimer);
    };
  }, [state, refreshRecentReceipts]);

  // Chain/asset mode changes reset tx hash + claimed amount to avoid stale-format claims.
  const handleChainModeChange = useCallback((mode: ChainModeValue) => {
    setTxHashHint('');
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
    const trimmed = raw.trim();
    const detected = detectChainFromTxHash(trimmed);
    const chainChanged = detected ? detected.chain !== values.chain : false;

    if (!trimmed) {
      setTxHashHint('');
    } else if (detected && chainChanged) {
      setTxHashHint(`Auto-selected ${detected.label}.`);
    } else if (detected) {
      setTxHashHint('');
    }

    setValues((prev) => {
      const normalizedTxHash =
        (detected?.chain ?? prev.chain) === 'bitcoin'
          ? trimmed.toLowerCase()
          : trimmed;

      if (!detected) {
        return {
          ...prev,
          txHash: normalizedTxHash,
        };
      }

      const nextEthereumAsset =
        detected.chain === 'ethereum'
          ? (prev.chain === 'ethereum' ? prev.ethereumAsset : 'native')
          : 'native';

      return {
        ...prev,
        chain: detected.chain,
        ethereumAsset: nextEthereumAsset,
        txHash: normalizedTxHash,
      };
    });
  }, [values.chain]);

  const handlePaste = useCallback(async (field: 'txHash'): Promise<void> => {
    try {
      const text = await globalThis.navigator.clipboard.readText();
      const value = text.trim();
      if (field === 'txHash') {
        handleTxHashChange(value);
      }
    } catch {
      // Clipboard permission denied — silently ignore; user can type manually
    }
  }, [handleTxHashChange]);

  const handleCopyRecentVerifyUrl = useCallback(async (proof: string): Promise<void> => {
    const verifyUrl = buildVerifyUrl(proof);
    try {
      await globalThis.navigator.clipboard.writeText(verifyUrl);
      setRecentStatus('Copied verify URL from recent receipts.');
    } catch {
      setRecentStatus('Could not copy verify URL.');
    }
  }, []);

  const handleOpenRecentReceipt = useCallback((proof: string): void => {
    globalThis.location.href = buildVerifyUrl(proof);
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    await generate(values);
  }, [generate, values]);

  const optionalCount =
    (values.receiptLabel.trim() ? 1 : 0) + (values.receiptCategory.trim() ? 1 : 0);
  const txHashFeedback = useMemo(() => {
    if (!values.txHash.trim()) {
      return '';
    }
    if (txHashHint) {
      return txHashHint;
    }
    if (txHashFormatValid) {
      return 'Hash format matches the selected chain.';
    }
    if (values.txHash.trim().length >= 24) {
      return 'Hash format does not match the selected chain yet.';
    }
    return '';
  }, [txHashFormatValid, txHashHint, values.txHash]);

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
          <option value="solana">Solana (SOL)</option>
        </Select>

        {/* ── Transaction hash ── */}
        <div>
          <div className="flex items-center justify-between mb-1">
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
            placeholder={
              values.chain === 'bitcoin'
                ? '64 hex characters'
                : values.chain === 'solana'
                  ? 'Base58 signature (64-88 chars)'
                  : '0x + 64 hex characters'
            }
            value={values.txHash}
            onChange={handleTxHashChange}
            disabled={isProcessing}
            error={errors.txHash}
            className="h-8 px-2 py-1 text-[12px]"
          />
          {txHashFeedback && !errors.txHash && (
            <p
              className={`mt-1 text-[11px] ${txHashFormatValid ? 'text-emerald-300/90' : 'text-amber-300/90'}`}
              aria-live="polite"
            >
              {txHashFormatValid ? `✓ ${txHashFeedback}` : txHashFeedback}
            </p>
          )}
        </div>
      </div>

      {/* ── Claimed amount with live unit hint ── */}
      <div className="grid grid-cols-1 gap-2 min-[540px]:grid-cols-2">
        <div>
          <div className="flex items-center justify-between mb-1">
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

      <div className="px-2 py-2 border rounded-lg border-white/10 bg-black/10">
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
          <div id={`${formId}-optional-fields`} className="grid grid-cols-1 gap-2 mt-2 md:grid-cols-2">
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

      {(state === 'idle' || state === 'error') && recentReceipts.length > 0 && (
        <div className="rounded-lg border border-white/10 bg-black/15 p-2.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-white/75">Recent receipts</p>
            <button
              type="button"
              className="text-[11px] text-cyan-300/90 hover:text-cyan-200"
              onClick={() => {
                globalThis.location.href = '/history';
              }}
            >
              View all
            </button>
          </div>
          <div className="space-y-2">
            {recentReceipts.map((entry) => (
              <div
                key={entry.id}
                className="rounded border border-white/10 bg-white/[0.03] px-2 py-1.5"
              >
                <div className="flex items-center justify-between gap-2 text-[11px] text-white/70">
                  <span>
                    {formatRecentChain(entry)} - {entry.receiptLabel || entry.receiptCategory || 'Unlabeled'}
                  </span>
                  <span className="font-mono text-white/55">{entry.claimedAmount}</span>
                </div>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="py-1 text-[11px]"
                    onClick={() => {
                      handleOpenRecentReceipt(entry.proof);
                    }}
                  >
                    Open Verify
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="py-1 text-[11px]"
                    onClick={() => {
                      void handleCopyRecentVerifyUrl(entry.proof);
                    }}
                  >
                    Copy URL
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {recentStatus && (
            <p className="mt-2 text-[11px] text-cyan-300/85" aria-live="polite">
              {recentStatus}
            </p>
          )}
        </div>
      )}

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
          claimedAmountDisclosure={proofResult.claimedAmountDisclosure}
          minDate={proofResult.minDate}
          minDateDisclosure={proofResult.minDateDisclosure}
          {...(proofResult.oracleValidationLabel
            ? { oracleValidationLabel: proofResult.oracleValidationLabel }
            : {})}
          {...(proofResult.receiptLabel ? { receiptLabel: proofResult.receiptLabel } : {})}
          {...(proofResult.receiptCategory ? { receiptCategory: proofResult.receiptCategory } : {})}
          {...(proofResult.timings ? { timings: proofResult.timings } : {})}
        />
      )}

      {draftStatus && (
        <StatusBanner variant="info" message={draftStatus} aria="polite" />
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
