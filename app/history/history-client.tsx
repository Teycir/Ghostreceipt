'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { UnifiedPageShell } from '@/components/unified-page-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { toHumanAmount } from '@/lib/format/units';
import {
  clearReceiptHistoryEntries,
  deleteReceiptHistoryEntry,
  filterReceiptHistoryEntries,
  getReceiptHistoryStorageStatus,
  importReceiptHistoryJson,
  listReceiptHistoryCategories,
  listReceiptHistoryEntries,
  markReceiptHistoryEntryOpened,
  serializeReceiptHistoryExport,
  type ReceiptHistoryEntry,
} from '@/lib/history/receipt-history';
import type { Chain, EthereumAsset } from '@/lib/generator/types';

interface HistoryFilters {
  query: string;
  chain: Chain | 'all';
  category: string;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return 'n/a';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  const mb = kb / 1024;
  if (mb < 1024) {
    return `${mb.toFixed(1)} MB`;
  }
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

function formatCreatedAt(isoDate: string): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }
  return parsed.toLocaleString();
}

function formatOpenedStatus(openedAt?: string): string {
  if (!openedAt) {
    return 'Not opened';
  }
  return `Opened ${formatCreatedAt(openedAt)}`;
}

function buildVerifyUrl(proof: string): string {
  const params = new URLSearchParams({ proof });
  return `${globalThis.location.origin}/verify?${params.toString()}`;
}

function chainPillLabel(chain: Chain, ethereumAsset?: EthereumAsset): string {
  if (chain === 'bitcoin') {
    return 'Bitcoin';
  }
  if (chain === 'ethereum') {
    return ethereumAsset === 'usdc' ? 'Ethereum (USDC)' : 'Ethereum';
  }
  return 'Solana';
}

export default function HistoryClientPage(): React.JSX.Element {
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [entries, setEntries] = useState<ReceiptHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [storageWarning, setStorageWarning] = useState('');
  const [storageSummary, setStorageSummary] = useState('');
  const [filters, setFilters] = useState<HistoryFilters>({
    query: '',
    chain: 'all',
    category: 'all',
  });

  const loadEntries = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError('');
    try {
      const allEntries = await listReceiptHistoryEntries();
      setEntries(allEntries);
      const storageStatus = await getReceiptHistoryStorageStatus();
      if (
        typeof storageStatus.pressureRatio === 'number' &&
        typeof storageStatus.usageBytes === 'number' &&
        typeof storageStatus.quotaBytes === 'number'
      ) {
        const percent = Math.round(storageStatus.pressureRatio * 100);
        setStorageSummary(
          `Storage usage: ${percent}% (${formatBytes(storageStatus.usageBytes)} / ${formatBytes(storageStatus.quotaBytes)}).`
        );
      } else {
        setStorageSummary(
          `Storage usage: unavailable on this browser. Local history still enforces oldest-first pruning.`
        );
      }
      if (storageStatus.nearFull && typeof storageStatus.pressureRatio === 'number') {
        const percent = Math.round(storageStatus.pressureRatio * 100);
        setStorageWarning(
          `Storage ${percent}% full, pruning oldest records.`
        );
      } else {
        setStorageWarning('');
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Failed to load local history';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const categories = useMemo(() => listReceiptHistoryCategories(entries), [entries]);

  const filteredEntries = useMemo(
    () => filterReceiptHistoryEntries(entries, filters),
    [entries, filters]
  );

  const handleExport = useCallback((): void => {
    if (entries.length === 0) {
      setStatusMessage('No local receipts to export yet.');
      return;
    }

    const payload = serializeReceiptHistoryExport(entries);
    const blob = new Blob([payload], { type: 'application/json' });
    const blobUrl = globalThis.URL.createObjectURL(blob);
    const link = globalThis.document.createElement('a');
    link.href = blobUrl;
    link.download = `ghostreceipt-history-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    globalThis.URL.revokeObjectURL(blobUrl);
    setStatusMessage(`Exported ${entries.length} receipt${entries.length === 1 ? '' : 's'} to JSON.`);
  }, [entries]);

  const handleOpenImportPicker = useCallback((): void => {
    importInputRef.current?.click();
  }, []);

  const handleImportFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    try {
      const payload = await file.text();
      const result = await importReceiptHistoryJson(payload);
      await loadEntries();

      const statusParts = [
        `Imported ${result.importedCount} receipt${result.importedCount === 1 ? '' : 's'}.`,
      ];
      if (result.skippedCount > 0) {
        statusParts.push(`Skipped ${result.skippedCount} duplicate${result.skippedCount === 1 ? '' : 's'}.`);
      }
      if (result.invalidCount > 0) {
        statusParts.push(`Ignored ${result.invalidCount} invalid entr${result.invalidCount === 1 ? 'y' : 'ies'}.`);
      }
      setStatusMessage(statusParts.join(' '));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Failed to import local history JSON.';
      setStatusMessage(message);
    }
  }, [loadEntries]);

  const handleCopyVerifyUrl = useCallback(async (proof: string): Promise<void> => {
    const verifyUrl = buildVerifyUrl(proof);
    try {
      await globalThis.navigator.clipboard.writeText(verifyUrl);
      setStatusMessage('Verification URL copied.');
    } catch {
      setStatusMessage('Clipboard copy failed.');
    }
  }, []);

  const handleDeleteEntry = useCallback(async (id: string): Promise<void> => {
    try {
      await deleteReceiptHistoryEntry(id);
      setEntries((prev) => prev.filter((entry) => entry.id !== id));
      setStatusMessage('Receipt removed from local history.');
    } catch {
      setStatusMessage('Could not remove receipt from local history.');
    }
  }, []);

  const handleOpenVerify = useCallback(async (entry: ReceiptHistoryEntry): Promise<void> => {
    try {
      const updatedEntry = await markReceiptHistoryEntryOpened(entry.id);
      setEntries((prev) => prev.map((current) => (
        current.id === entry.id ? updatedEntry : current
      )));
    } catch {
      // Continue to verification even if opened-status update fails.
    } finally {
      globalThis.location.href = buildVerifyUrl(entry.proof);
    }
  }, []);

  const handleClearAll = useCallback(async (): Promise<void> => {
    try {
      await clearReceiptHistoryEntries();
      setEntries([]);
      setStatusMessage('Local history cleared.');
    } catch {
      setStatusMessage('Failed to clear local history.');
    }
  }, []);

  return (
    <UnifiedPageShell
      centerContent={false}
      srTitle="GhostReceipt History"
      tagline="Local Receipt History"
      description="Stored entirely on this device. No external sync."
      maxWidthClassName="max-w-4xl"
    >
      <div className="mb-4">
        <a href="/" className="inline-flex items-center text-sm text-white/60 hover:text-white/90 transition-colors">
          ← Back to GhostReceipt
        </a>
      </div>
      <section className="glass-card rounded-xl p-5 space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Input
                label="Search"
                value={filters.query}
                onChange={(query) => setFilters((prev) => ({ ...prev, query }))}
                placeholder="Label, category, amount, or proof..."
              />
              <Select
                label="Chain"
                value={filters.chain}
                onChange={(event) => {
                  const chain = event.target.value as Chain | 'all';
                  setFilters((prev) => ({ ...prev, chain }));
                }}
              >
                <option value="all">All chains</option>
                <option value="bitcoin">Bitcoin</option>
                <option value="ethereum">Ethereum</option>
                <option value="solana">Solana</option>
              </Select>
              <Select
                label="Category"
                value={filters.category}
                onChange={(event) => {
                  setFilters((prev) => ({ ...prev, category: event.target.value }));
                }}
              >
                <option value="all">All categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={(event) => {
                  void handleImportFile(event);
                }}
              />
              <Button type="button" variant="secondary" onClick={handleOpenImportPicker}>
                Import JSON
              </Button>
              <Button type="button" variant="secondary" onClick={handleExport}>
                Export JSON
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  void handleClearAll();
                }}
                disabled={entries.length === 0}
              >
                Clear Local History
              </Button>
              <Button type="button" variant="secondary" onClick={() => { void loadEntries(); }}>
                Refresh
              </Button>
            </div>

            {statusMessage && (
              <p className="text-xs text-cyan-300/80" aria-live="polite">{statusMessage}</p>
            )}

            {storageSummary && (
              <p className="rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100/90">
                {storageSummary}
              </p>
            )}

            {storageWarning && (
              <p className="rounded-lg border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-200/90">
                {storageWarning}
              </p>
            )}
          </section>

          <section className="space-y-3">
            {loading && (
              <div className="glass-card rounded-xl p-5 text-sm text-white/65">
                Loading local history...
              </div>
            )}

            {!loading && error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                {error}
              </div>
            )}

            {!loading && !error && entries.length === 0 && (
              <div className="glass-card rounded-xl p-6 text-sm text-white/60">
                No receipts saved yet. Generate one on the home page and it will appear here automatically.
              </div>
            )}

            {!loading && !error && entries.length > 0 && filteredEntries.length === 0 && (
              <div className="glass-card rounded-xl p-6 text-sm text-white/60">
                No history items match the current filters.
              </div>
            )}

            {!loading && !error && filteredEntries.map((entry) => (
              <article key={entry.id} className="glass-card rounded-xl p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-2">
                    <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-200">
                      {chainPillLabel(entry.chain, entry.ethereumAsset)}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        entry.openedAt
                          ? 'border border-emerald-400/35 bg-emerald-500/10 text-emerald-200'
                          : 'border border-white/20 bg-white/5 text-white/70'
                      }`}
                    >
                      {formatOpenedStatus(entry.openedAt)}
                    </span>
                    <span className="text-xs text-white/45">
                      {formatCreatedAt(entry.createdAt)}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-white/70">
                    {entry.claimedAmount} ({toHumanAmount(entry.claimedAmount, entry.chain, entry.ethereumAsset ?? 'native')})
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-white/45">Minimum Date</p>
                    <p className="mt-1 text-sm text-white/90">{entry.minDate}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-white/45">Metadata</p>
                    <p className="mt-1 text-sm text-white/90 break-words">
                      {entry.receiptLabel ? `Label: ${entry.receiptLabel}` : 'Label: n/a'}
                      <br />
                      {entry.receiptCategory ? `Category: ${entry.receiptCategory}` : 'Category: n/a'}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-white/10 bg-black/25 p-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-white/45 mb-1">Proof Payload</p>
                  <code className="block max-h-28 overflow-auto break-all text-[11px] text-white/78">
                    {entry.proof}
                  </code>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => { void handleOpenVerify(entry); }}
                  >
                    Open Verify
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => { void handleCopyVerifyUrl(entry.proof); }}
                  >
                    Copy Verify URL
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => { void handleDeleteEntry(entry.id); }}
                  >
                    Delete
                  </Button>
                </div>
              </article>
            ))}
      </section>
    </UnifiedPageShell>
  );
}
