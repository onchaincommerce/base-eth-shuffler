export const networkConfig = {
  // Base Sepolia Testnet
  84532: {
    name: 'Base Sepolia',
    rpcUrl: process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://sepolia.base.org',
    chainId: 84532,
    blockExplorer: 'https://sepolia.basescan.org',
  },
  // Base Mainnet
  8453: {
    name: 'Base',
    rpcUrl: 'https://mainnet.base.org',
    chainId: 8453,
    blockExplorer: 'https://basescan.org',
  },
} as const;

export type NetworkConfigKey = keyof typeof networkConfig;

export const defaultNetwork: NetworkConfigKey = 84532; // Default to Base Sepolia

export const getNetworkConfig = (chainId: NetworkConfigKey) => {
  return networkConfig[chainId];
}; 