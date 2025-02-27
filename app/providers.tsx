'use client';

import { baseSepolia } from 'wagmi/chains';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import type { ReactNode } from 'react';

export function Providers(props: { children: ReactNode }) {
  return (
    <OnchainKitProvider
      apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
      chain={baseSepolia}
      config={{ 
        appearance: { 
          mode: 'dark',
          theme: '#6E00FF'
        }
      }}
    >
      {props.children}
    </OnchainKitProvider>
  );
}

