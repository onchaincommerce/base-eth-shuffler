declare module '@coinbase/onchainkit/wallet' {
  export const ConnectWallet: React.FC<any>;
  export const Wallet: React.FC<any>;
}

declare module '@coinbase/onchainkit/identity' {
  export const Identity: React.FC<any>;
  export const Name: React.FC<any>;
}

declare module 'framer-motion' {
  export const motion: any;
}

declare module 'react-icons/fa' {
  export const FaEthereum: React.FC<any>;
}

declare module 'wagmi' {
  export const useAccount: () => {
    isConnected: boolean;
    address?: string;
  };
  export const useConnect: () => any;
  export const useDisconnect: () => {
    disconnect: () => void;
  };
  export const useSignMessage: () => any;
  export const usePublicClient: () => any;
} 