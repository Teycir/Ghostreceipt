'use client';

import type { Chain, EthereumAsset } from '@/lib/generator/types';

export interface ReceiptPdfExportData {
  chain: Chain;
  ethereumAsset: EthereumAsset;
  claimedAmount: string;
  claimedAmountHuman: string;
  minDate: string;
  receiptLabel?: string;
  receiptCategory?: string;
  proof: string;
  qrCodeDataUrl: string;
  verifyUrl: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatChainLabel(chain: Chain, ethereumAsset: EthereumAsset): string {
  const labels: Record<Chain, string> = {
    bitcoin: 'Bitcoin',
    ethereum: ethereumAsset === 'usdc' ? 'Ethereum (USDC)' : 'Ethereum',
    solana: 'Solana',
  };
  return labels[chain] ?? chain;
}

function summarizeProof(proof: string): string {
  const maxVisibleChars = 120;
  if (proof.length <= maxVisibleChars) {
    return proof;
  }
  const head = proof.slice(0, 64);
  const tail = proof.slice(-32);
  return `${head}...${tail}`;
}

export function buildReceiptPdfHtml(data: ReceiptPdfExportData, generatedAt: Date = new Date()): string {
  const generatedAtLabel = generatedAt.toISOString();
  const proofSummary = summarizeProof(data.proof);
  const qrMarkup = data.qrCodeDataUrl
    ? `<img class="qr-image" src="${escapeHtml(data.qrCodeDataUrl)}" alt="Receipt verification QR code" />`
    : '<p class="qr-fallback">QR code unavailable. Use the verification URL below.</p>';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>GhostReceipt Proof Receipt</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root {
      color-scheme: light;
    }
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 24px;
      background: #f4f7fb;
      color: #0f172a;
      font-family: "Arial", "Helvetica", sans-serif;
    }
    .sheet {
      max-width: 820px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #d7e1ef;
      border-radius: 14px;
      padding: 24px;
      box-shadow: 0 12px 38px rgba(15, 23, 42, 0.12);
    }
    .header {
      margin-bottom: 16px;
    }
    .title {
      margin: 0;
      font-size: 28px;
      letter-spacing: 0.02em;
      color: #0f3d88;
    }
    .subtitle {
      margin-top: 6px;
      font-size: 14px;
      color: #334155;
    }
    .grid {
      display: grid;
      grid-template-columns: 1.4fr 1fr;
      gap: 18px;
      margin-top: 16px;
    }
    .card {
      border: 1px solid #dbe7f8;
      border-radius: 10px;
      padding: 14px;
      background: #f8fbff;
    }
    .card h2 {
      margin: 0 0 10px 0;
      font-size: 16px;
      color: #0f3d88;
    }
    .summary-list {
      display: grid;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .summary-item {
      display: grid;
      gap: 2px;
      border-bottom: 1px dashed #d7e4f8;
      padding-bottom: 6px;
    }
    .summary-item:last-child {
      border-bottom: 0;
      padding-bottom: 0;
    }
    .label {
      font-size: 11px;
      color: #4b5563;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .value {
      font-size: 13px;
      color: #0f172a;
      word-break: break-word;
    }
    .mono {
      font-family: "Courier New", monospace;
      font-size: 12px;
    }
    .proof-box {
      margin-top: 14px;
      border: 1px solid #dce8f8;
      border-radius: 8px;
      background: #eef5ff;
      padding: 10px;
      font-family: "Courier New", monospace;
      font-size: 11px;
      line-height: 1.45;
      word-break: break-all;
    }
    .qr-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 260px;
      background: #ffffff;
      border: 1px solid #d7e4f8;
      border-radius: 8px;
      padding: 12px;
    }
    .qr-image {
      width: 230px;
      height: 230px;
      object-fit: contain;
    }
    .qr-fallback {
      margin: 0;
      text-align: center;
      color: #64748b;
      font-size: 13px;
    }
    .footer {
      margin-top: 18px;
      font-size: 11px;
      color: #475569;
      border-top: 1px solid #dbe7f8;
      padding-top: 10px;
    }
    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }
      .sheet {
        border: 0;
        border-radius: 0;
        padding: 0;
        box-shadow: none;
      }
    }
  </style>
</head>
<body>
  <main class="sheet">
    <header class="header">
      <h1 class="title">GhostReceipt Proof Receipt</h1>
      <p class="subtitle">Human-readable summary of a zero-knowledge payment proof.</p>
    </header>
    <section class="grid">
      <article class="card">
        <h2>Receipt Summary</h2>
        <ul class="summary-list">
          <li class="summary-item">
            <span class="label">Chain</span>
            <span class="value">${escapeHtml(formatChainLabel(data.chain, data.ethereumAsset))}</span>
          </li>
          <li class="summary-item">
            <span class="label">Claimed Amount</span>
            <span class="value mono">${escapeHtml(data.claimedAmount)} (${escapeHtml(data.claimedAmountHuman)})</span>
          </li>
          <li class="summary-item">
            <span class="label">Minimum Date</span>
            <span class="value">${escapeHtml(data.minDate)}</span>
          </li>
          ${
            data.receiptLabel
              ? `<li class="summary-item">
            <span class="label">Label</span>
            <span class="value">${escapeHtml(data.receiptLabel)}</span>
          </li>`
              : ''
          }
          ${
            data.receiptCategory
              ? `<li class="summary-item">
            <span class="label">Category</span>
            <span class="value">${escapeHtml(data.receiptCategory)}</span>
          </li>`
              : ''
          }
          <li class="summary-item">
            <span class="label">Verification URL</span>
            <span class="value mono">${escapeHtml(data.verifyUrl)}</span>
          </li>
          <li class="summary-item">
            <span class="label">Exported At</span>
            <span class="value">${escapeHtml(generatedAtLabel)}</span>
          </li>
          <li class="summary-item">
            <span class="label">Proof Length</span>
            <span class="value">${data.proof.length} characters</span>
          </li>
        </ul>
        <div class="proof-box">${escapeHtml(proofSummary)}</div>
      </article>
      <article class="card">
        <h2>Verification QR</h2>
        <div class="qr-wrap">
          ${qrMarkup}
        </div>
      </article>
    </section>
    <footer class="footer">
      Verify this receipt by opening the URL above or scanning the QR code.
    </footer>
  </main>
</body>
</html>`;
}

export function exportReceiptPdf(data: ReceiptPdfExportData): void {
  if (!data.verifyUrl) {
    throw new Error('Verification link is not ready yet.');
  }
  if (typeof globalThis.window === 'undefined') {
    throw new Error('PDF export is only available in the browser.');
  }

  const printWindow = globalThis.window.open(
    '',
    '_blank',
    'popup=yes,width=980,height=760'
  );
  if (!printWindow) {
    throw new Error('Unable to open print window. Please allow pop-ups and try again.');
  }
  if (typeof printWindow.print !== 'function') {
    printWindow.close();
    throw new Error('This browser cannot open the print dialog from a new window.');
  }

  const html = buildReceiptPdfHtml(data);
  try {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  } catch {
    printWindow.close();
    throw new Error('Failed to render the printable receipt document.');
  }

  let printTriggered = false;
  const triggerPrint = (): void => {
    if (printTriggered) {
      return;
    }
    printTriggered = true;
    printWindow.focus();
    printWindow.print();
  };

  // Prefer event-driven print (keeps behavior reliable across browsers),
  // with a short fallback timer for engines that skip load events.
  printWindow.addEventListener('load', triggerPrint, { once: true });
  globalThis.setTimeout(triggerPrint, 320);
}
