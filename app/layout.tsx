import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';

export const metadata: Metadata = {
  title: 'GhostReceipt - Privacy-First Payment Proofs',
  description: 'Generate cryptographic payment receipts without exposing sensitive on-chain identity data.',
  keywords: ['zero-knowledge', 'payment proof', 'privacy', 'blockchain', 'receipt'],
  authors: [{ name: 'Teycir Ben Soltane', url: 'https://teycirbensoltane.tn' }],
  creator: 'Teycir Ben Soltane',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://ghostreceipt.com',
    title: 'GhostReceipt - Privacy-First Payment Proofs',
    description: 'Generate cryptographic payment receipts without exposing sensitive on-chain identity data.',
    siteName: 'GhostReceipt',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GhostReceipt - Privacy-First Payment Proofs',
    description: 'Generate cryptographic payment receipts without exposing sensitive on-chain identity data.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
