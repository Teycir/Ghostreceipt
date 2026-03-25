import type { Metadata } from 'next';
import { HomeShell } from '@/components/home-shell';

export const metadata: Metadata = {
  title: 'Generate Privacy-Preserving Payment Proofs',
  description:
    'Generate zero-knowledge payment proofs for Bitcoin, Ethereum, and Solana transactions. Prove payments without revealing wallet addresses. Free, private, browser-based.',
};

export default function HomePage(): React.JSX.Element {
  return <HomeShell />;
}
