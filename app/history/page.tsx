import type { Metadata } from 'next';
import HistoryClientPage from './history-client';

export const metadata: Metadata = {
  title: 'Receipt History',
  description:
    'View and manage your generated payment proof history. Access previously created zero-knowledge receipts for Bitcoin, Ethereum, and Solana transactions.',
};

export default function HistoryPage(): React.JSX.Element {
  return <HistoryClientPage />;
}
