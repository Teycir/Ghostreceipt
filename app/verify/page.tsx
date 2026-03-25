import type { Metadata } from 'next';
import VerifyClientPage from './verify-client';

export const metadata: Metadata = {
  title: 'Verify Payment Proof',
  description:
    'Verify cryptographic payment receipts and validate zero-knowledge proofs instantly. Check payment proof authenticity without revealing wallet addresses.',
};

export default function VerifyPage(): React.JSX.Element {
  return <VerifyClientPage />;
}
