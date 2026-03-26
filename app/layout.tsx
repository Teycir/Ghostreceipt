import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { ErrorBoundary } from '@/components/error-boundary';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://ghostreceipt.pages.dev'),
  title: {
    default: 'GhostReceipt - Zero-Knowledge Crypto Payment Proofs',
    template: '%s | GhostReceipt',
  },
  description: 'Prove cryptocurrency payments without revealing wallet addresses. Generate zero-knowledge proofs for Bitcoin, Ethereum, and Solana transactions. Free, private, browser-based.',
  keywords: [
    'zero-knowledge proof',
    'crypto payment proof',
    'bitcoin receipt',
    'ethereum receipt',
    'solana receipt',
    'blockchain privacy',
    'zk-SNARK',
    'anonymous payment',
    'cryptocurrency receipt',
    'wallet privacy',
    'payment verification',
    'crypto privacy',
    'private payment proof',
    'anonymous crypto receipt',
    'payment proof',
    'privacy',
  ],
  authors: [{ name: 'Teycir Ben Soltane', url: 'https://teycirbensoltane.tn' }],
  creator: 'Teycir Ben Soltane',
  manifest: '/manifest.json',
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://ghostreceipt.pages.dev',
    title: 'GhostReceipt - Zero-Knowledge Crypto Payment Proofs',
    description: 'Prove cryptocurrency payments without revealing wallet addresses. Free, private, browser-based zero-knowledge proofs.',
    siteName: 'GhostReceipt',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GhostReceipt - Zero-Knowledge Crypto Payment Proofs',
    description: 'Prove cryptocurrency payments without revealing wallet addresses',
  },
  alternates: {
    canonical: 'https://ghostreceipt.pages.dev',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'GhostReceipt',
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web Browser',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    description:
      'Generate cryptographic payment receipts without exposing sensitive on-chain identity data using zero-knowledge proofs',
    featureList: [
      'Bitcoin payment proofs',
      'Ethereum payment proofs',
      'Solana payment proofs',
      'Zero-knowledge proofs',
      'Privacy-preserving receipts',
    ],
  };

  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body className="min-h-screen antialiased">
        <div className="premium-grain" aria-hidden="true" />
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
