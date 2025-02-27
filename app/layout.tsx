import '@coinbase/onchainkit/styles.css';
import type { Metadata } from 'next';
import { DM_Sans, Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

// Load Inter font with Latin subset
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

// Load DM Sans with Latin subset
const dmSans = DM_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-dm-sans',
});

// Load Space Grotesk for more futuristic headings
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-space',
});

export const metadata: Metadata = {
  title: 'Base ETH Shuffler | Privacy for Your ETH',
  description: 'Protect your ETH privacy with our advanced shuffling mechanism. Create deterministic addresses and shuffle your funds with advanced security.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${dmSans.variable} ${spaceGrotesk.variable}`} data-theme="cryptotheme">
      <body className="font-sans antialiased overflow-x-hidden">
        <div className="min-h-screen px-4 py-8 md:py-12 md:px-8">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  );
}
