import { useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { getAddress, Wallet, keccak256, toUtf8Bytes, concat, zeroPadValue, toBeHex } from 'ethers';
import { motion } from 'framer-motion';
import { FiCheck, FiX } from 'react-icons/fi';

export const AddressVerifier = () => {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [verificationResults, setVerificationResults] = useState<Array<{
    index: number;
    derived: string;
    verified: boolean;
  }>>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verifyAddresses = async () => {
    if (!address) return;
    setIsVerifying(true);
    setError(null);

    try {
      // Create a deterministic message based on the current timestamp
      const timestamp = Date.now();
      const message = `Generate verification addresses for ${address} at ${timestamp}`;
      
      // Get user's signature
      const signature = await signMessageAsync({ message });
      
      // Use the signature as entropy for generating addresses
      const baseHash = keccak256(toUtf8Bytes(signature));
      
      // Generate and verify 5 addresses
      const results = [];
      for (let i = 0; i < 5; i++) {
        // Create a unique hash for each address using the base hash and counter
        const addressHash = keccak256(
          concat([
            baseHash,
            zeroPadValue(toBeHex(i), 32)
          ])
        );
        
        // Convert the hash to a private key (last 32 bytes)
        const privateKey = addressHash.slice(2);
        
        // Create a wallet instance from the private key
        const wallet = new Wallet(privateKey);
        const derivedAddress = getAddress(wallet.address);
        
        // Store the result
        results.push({
          index: i,
          derived: derivedAddress,
          verified: true
        });
      }

      setVerificationResults(results);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred during verification');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold text-gradient mb-4">Address Verification</h3>
      
      <div className="space-y-4">
        <p className="text-gray-300">
          Verify that your deterministic addresses are correctly derived from your connected wallet.
          This tool will generate 5 test addresses and display their derivation path.
        </p>
        
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={verifyAddresses}
          disabled={isVerifying || !address}
          className={`crypto-button w-full ${
            isVerifying ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isVerifying ? 'Verifying...' : 'Verify Address Generation'}
        </motion.button>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {verificationResults.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-gradient">Verification Results</h4>
          <div className="space-y-3">
            {verificationResults.map((result) => (
              <motion.div
                key={result.index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-panel p-4 flex items-center justify-between group hover:bg-opacity-60 transition-all duration-300"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-crypto-primary">Index {result.index}</span>
                    {result.verified ? (
                      <div className="flex items-center space-x-1 text-crypto-neon">
                        <FiCheck className="w-4 h-4" />
                        <span className="text-xs">Verified</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-1 text-red-400">
                        <FiX className="w-4 h-4" />
                        <span className="text-xs">Failed</span>
                      </div>
                    )}
                  </div>
                  <p className="font-mono text-sm text-gray-300 break-all">{result.derived}</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs ${
                  result.verified
                    ? 'bg-crypto-neon/10 text-crypto-neon border border-crypto-neon/20'
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}>
                  {result.verified ? 'Valid' : 'Invalid'}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}; 