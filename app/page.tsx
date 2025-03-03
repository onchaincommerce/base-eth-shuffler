'use client';

import { ConnectWallet, Wallet } from '@coinbase/onchainkit/wallet';
import { Identity, Name } from '@coinbase/onchainkit/identity';
import { motion } from 'framer-motion';
import PrivacyShuffler from './components/PrivacyShuffler';
import { FaEthereum } from 'react-icons/fa';
import { useAccount, useDisconnect } from 'wagmi';

const App: React.FC = () => {
  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect();

  return (
    <div className="grid-background min-h-screen">
      {/* Animated Background Gradient */}
      <div className="fixed inset-0 bg-gradient-to-b from-crypto-dark/80 to-crypto-dark pointer-events-none" />

      {/* Header with Wallet Connection */}
      <header className="fixed w-full top-0 z-50 glass-panel">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center space-x-3"
          >
            <div className="p-2 rounded-full bg-gradient-to-r from-crypto-primary to-crypto-secondary">
              <FaEthereum className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold cosmic-title">
              Base ETH Shuffler
            </h1>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="wallet-container"
          >
            {isConnected ? (
              <div className="flex items-center gap-4">
                <span className="text-sm opacity-75">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                <button 
                  onClick={() => disconnect()} 
                  className="btn btn-sm btn-outline"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <Wallet>
                <ConnectWallet>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-4 py-2 rounded-lg font-medium transition-all duration-200 
                             bg-crypto-dark-600 border border-crypto-primary/30 text-crypto-secondary
                             hover:bg-crypto-cosmic/40 hover:text-white hover:border-crypto-secondary/50"
                  >
                    Connect Wallet
                  </motion.button>
                </ConnectWallet>
              </Wallet>
            )}
          </motion.div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-24 pb-20 relative z-10">
        <div className="max-w-7xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-gradient">
              Enhance Your Onchain Privacy
            </h2>
            <p className="text-gray-300 text-lg max-w-2xl mx-auto">
              Protect your ETH privacy on Base with our advanced shuffling mechanism. 
              Create deterministic addresses and shuffle your funds with strong cryptographic privacy.
            </p>
          </motion.div>

          <div className="flex justify-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="crypto-card w-full max-w-2xl"
            >
              <PrivacyShuffler />
            </motion.div>
          </div>

          {/* How It Works Section */}
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="mt-20 mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center cosmic-title">
              How Your Privacy is Protected
            </h2>

            <div className="grid md:grid-cols-2 gap-12">
              {/* Escape Hatch Explanation */}
              <div className="glass-panel p-8">
                <h3 className="text-xl font-semibold mb-4 text-gradient flex items-center">
                  <span className="w-8 h-8 rounded-full bg-crypto-primary/20 flex items-center justify-center mr-3 text-sm border border-crypto-primary/30">
                    1
                  </span>
                  Your Escape Hatch Address
                </h3>
                <div className="space-y-4 text-gray-300">
                  <p>
                    Your escape hatch address is created using two sources of randomness combined together:
                  </p>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>
                      <strong className="text-crypto-secondary">Your Recovery Key:</strong> A secret phrase you choose that only you know
                    </li>
                    <li>
                      <strong className="text-crypto-secondary">True Random Numbers:</strong> Generated by your device for extra security
                    </li>
                  </ul>
                  <p>
                    These are mathematically mixed together (like shuffling two decks of cards) to create your unique seed phrase. 
                    This dual-source approach ensures that even if someone guesses your recovery key, they still can&apos;t access your funds 
                    without the random numbers (which are safely stored in your browser).
                  </p>
                </div>
              </div>

              {/* One-Off Address Explanation */}
              <div className="glass-panel p-8">
                <h3 className="text-xl font-semibold mb-4 text-gradient flex items-center">
                  <span className="w-8 h-8 rounded-full bg-crypto-primary/20 flex items-center justify-center mr-3 text-sm border border-crypto-primary/30">
                    2
                  </span>
                  Your One-Off Addresses
                </h3>
                <div className="space-y-4 text-gray-300">
                  <p>
                    One-off addresses are temporary addresses that automatically forward funds to your escape hatch. They&apos;re created using:
                  </p>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>
                      <strong className="text-crypto-secondary">Your Wallet Signature:</strong> A unique digital fingerprint that only your wallet can create
                    </li>
                    <li>
                      <strong className="text-crypto-secondary">Current Timestamp:</strong> Makes each address unique, even if created by the same wallet
                    </li>
                    <li>
                      <strong className="text-crypto-secondary">Decorrelated Paths:</strong> Uses special derivation paths that can&apos;t be linked to your wallet&apos;s original seed
                    </li>
                  </ul>
                  <p>
                    When funds arrive at a one-off address, they&apos;re automatically forwarded to your escape hatch. The one-off address 
                    is then discarded, leaving no permanent connection between your main wallet and your escape hatch.
                  </p>
                </div>
              </div>
            </div>

            {/* Technical Details */}
            <div className="mt-8 glass-panel p-6 border-crypto-primary/30">
              <h4 className="text-lg font-semibold mb-3 text-crypto-secondary">
                🔒 Advanced Privacy Details
              </h4>
              <p className="text-gray-300">
                Our system uses advanced HD (Hierarchical Deterministic) path generation that breaks the mathematical relationship 
                with your wallet&apos;s original derivation path. This means even if someone knows your public key or other addresses, 
                they cannot link these privacy-enhanced addresses back to your main wallet. Each address uses a unique derivation 
                path based on random entropy, making it computationally impossible to correlate with your original wallet&apos;s HD tree.
              </p>
            </div>

            {/* Security Note */}
            <div className="mt-8 glass-panel p-6 border-crypto-secondary/30">
              <h4 className="text-lg font-semibold mb-3 text-crypto-secondary">
                🛡️ Security Guarantee
              </h4>
              <p className="text-gray-300">
                All cryptographic operations happen in your browser - we never see your keys, signatures, or recovery phrases. 
                The system uses the same battle-tested cryptography that secures billions in cryptocurrency transactions daily.
              </p>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-crypto-dark-600">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <p className="text-center text-gray-400">
            Built for ETH privacy on Base. Use at your own risk. This is experimental software.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
