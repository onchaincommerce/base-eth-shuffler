import { useState, useEffect, useCallback } from 'react';
import { useAccount, useConnect, useDisconnect, useSignMessage, usePublicClient } from 'wagmi';
import { getAddress, Wallet, keccak256, toUtf8Bytes, Mnemonic, HDNodeWallet, formatEther, JsonRpcProvider } from 'ethers';
import { createPublicClient, http } from 'viem';
import { TransferService } from '../services/TransferService';

type Step = 'init' | 'generateSeed' | 'confirmSeed' | 'generateOneOff' | 'waitFunding' | 'forwarding' | 'complete';

type ShuffleState = {
  escapeHatch: {
    address: string;
    mnemonic: string;
    nonce: string;
  } | null;
  oneOff: {
    address: string;
    privateKey: string;
  } | null;
  pendingTransfer: {
    status: 'pending' | 'completed' | 'failed';
    amount: string;
  } | null;
};

type LogEntry = {
  type: 'error' | 'warning' | 'info' | 'success';
  message: string;
};

const FORWARD_DELAY = 30000; // 30 seconds for testing, change to 60000 for production
const POLLING_INTERVAL = 5000; // Check balance every 5 seconds

const PrivacyShuffler: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const wagmiPublicClient = usePublicClient();
  const { disconnect } = useDisconnect();
  
  const [step, setStep] = useState<Step>('init');
  const [seedConfirmed, setSeedConfirmed] = useState<boolean>(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [shuffleState, setShuffleState] = useState<ShuffleState>({
    escapeHatch: null,
    oneOff: null,
    pendingTransfer: null
  });
  const [nonce, setNonce] = useState<string>('');

  // Clear one-off address on unmount
  useEffect(() => {
    return () => {
      setShuffleState(prev => ({
        ...prev,
        oneOff: null
      }));
    };
  }, []);

  const generateEscapeHatch = async () => {
    if (!nonce) return null;

    try {
      // Generate a truly random entropy
      const randomEntropy = crypto.getRandomValues(new Uint8Array(16));
      
      // Generate deterministic entropy from user nonce
      const nonceHash = keccak256(toUtf8Bytes(nonce));
      
      // Combine the two entropy sources (XOR operation)
      const combinedEntropy = new Uint8Array(16);
      for (let i = 0; i < 16; i++) {
        // Convert hex characters from nonceHash to bytes and XOR with random bytes
        combinedEntropy[i] = randomEntropy[i] ^ 
          parseInt(nonceHash.slice(2 + i*2, 4 + i*2), 16);
      }
      
      // Generate mnemonic from the combined entropy
      // Note: We need to convert the Uint8Array to a Buffer that ethers can use
      const entropyBuffer = Buffer.from(combinedEntropy);
      const mnemonic = Mnemonic.fromEntropy(entropyBuffer);
      const wallet = HDNodeWallet.fromPhrase(mnemonic.phrase);
      
      setShuffleState(prev => ({
        ...prev,
        escapeHatch: {
          address: wallet.address,
          mnemonic: mnemonic.phrase,
          nonce: nonce
        }
      }));

      setLogs(prev => [...prev, {
        type: 'warning',
        message: 'IMPORTANT: Save your recovery key and seed phrase. You need both to recover funds!'
      }]);
      
      // Save the random entropy in localStorage for recovery
      localStorage.setItem(`entropy_${nonce}`, Array.from(randomEntropy).map(b => b.toString(16).padStart(2, '0')).join(''));

      setLogs(prev => [...prev, {
        type: 'info',
        message: 'Your recovery key has been saved in this browser for recovery. Use same browser or export.'
      }]);

      return wallet;
    } catch (error) {
      console.error('Failed to generate escape hatch:', error);
      return null;
    }
  };

  const generateOneOffAddress = async () => {
    if (!address) return null;

    try {
      const timestamp = Date.now();
      const message = `Generate one-off privacy address for ${address} at ${timestamp}`;
      const signature = await signMessageAsync({ message });
      
      // Generate one-off address
      const oneOffHash = keccak256(toUtf8Bytes(signature));
      const privateKey = oneOffHash.slice(2);
      const wallet = new Wallet(privateKey);
      
      setShuffleState(prev => ({
        ...prev,
        oneOff: {
          address: wallet.address,
          privateKey: privateKey
        }
      }));

      return wallet;
    } catch (error) {
      console.error('Failed to generate one-off address:', error);
      return null;
    }
  };

  const monitorAndForward = useCallback(async (oneOffAddress: string, privateKey: string, escapeHatchAddress: string) => {
    if (!wagmiPublicClient) return;

    try {
      const chainId = wagmiPublicClient.chain.id;
      const isTestnet = wagmiPublicClient.chain.name.toLowerCase().includes('sepolia') || 
                       wagmiPublicClient.chain.name.toLowerCase().includes('testnet') ||
                       wagmiPublicClient.chain.testnet === true;

      setLogs(prev => [...prev, {
        type: 'info',
        message: `Monitoring for funds on ${wagmiPublicClient.chain.name} (Chain ID: ${chainId})`
      }]);

      const providerUrl = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://sepolia.base.org';
      const transferService = new TransferService(providerUrl, oneOffAddress, true);
      
      let cleanupFunction: (() => void) | undefined;
      
      try {
        cleanupFunction = await transferService.watchBalanceChanges(
          oneOffAddress,
          async (network: 'testnet' | 'mainnet', balance: string) => {
            if (parseFloat(balance) > 0) {
              setLogs(prev => [...prev, {
                type: 'info',
                message: `Detected ${balance} ETH on ${network === 'testnet' ? 'Base Sepolia' : 'Base Mainnet'}. Preparing to forward...`
              }]);
              
              if (cleanupFunction) {
                cleanupFunction();
              }
              
              setStep('forwarding');

              await new Promise(resolve => setTimeout(resolve, FORWARD_DELAY));

              try {
                const targetRpcUrl = network === 'testnet' 
                  ? (process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://sepolia.base.org') 
                  : 'https://mainnet.base.org';
                const provider = new JsonRpcProvider(targetRpcUrl);
                const wallet = new Wallet(privateKey, provider);
                
                // Get current balance
                const currentBalance = await provider.getBalance(oneOffAddress);
                
                if (currentBalance <= BigInt(0)) {
                  throw new Error('Balance no longer available');
                }

                // Use fixed conservative values that we know work on Base
                const gasLimit = BigInt(21000);
                const gasPrice = BigInt(1000000000); // 1 gwei
                
                // Leave extra room for gas (0.0001 ETH = 100000000000000 wei)
                const reservedForGas = BigInt(100000000000000);
                
                // Send all balance minus reserved amount
                const amountToSend = currentBalance - reservedForGas;
                
                if (amountToSend <= BigInt(0)) {
                  throw new Error('Balance too low to cover gas costs');
                }

                console.log('Current balance:', formatEther(currentBalance), 'ETH');
                console.log('Reserved for gas:', formatEther(reservedForGas), 'ETH');
                console.log('Amount to send:', formatEther(amountToSend), 'ETH');

                // Simple legacy transaction with fixed gas price
                const tx = await wallet.sendTransaction({
                  to: escapeHatchAddress,
                  value: amountToSend,
                  gasLimit: gasLimit,
                  gasPrice: gasPrice,
                  type: 0
                });
                
                setLogs(prev => [...prev, {
                  type: 'info',
                  message: `Transaction sent: ${tx.hash}. Waiting for confirmation...`
                }]);
                
                // Wait for receipt with timeout
                const receiptPromise = tx.wait(1);
                const timeoutPromise = new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Transaction confirmation timeout')), 60000)
                );
                
                try {
                  const receipt = await Promise.race([receiptPromise, timeoutPromise]) as { hash: string };
                  setLogs(prev => [...prev, {
                    type: 'success',
                    message: `Transaction confirmed! Hash: ${receipt.hash}`
                  }]);
                  setStep('complete');
                } catch (waitError: any) {
                  // If it's a timeout, the transaction might still confirm later
                  if (waitError?.message === 'Transaction confirmation timeout') {
                    setLogs(prev => [...prev, {
                      type: 'warning',
                      message: `Transaction submitted but confirmation taking longer than expected. Hash: ${tx.hash}`
                    }]);
                    setStep('complete');
                  } else {
                    throw waitError;
                  }
                }
              } catch (error: any) {
                console.error("Forwarding error:", error);
                setLogs(prev => [...prev, {
                  type: 'error',
                  message: `Error forwarding funds: ${error?.message || 'Unknown error'}`
                }]);
                setStep('waitFunding');
              }
            }
          }
        );
        
        return cleanupFunction;
      } catch (error: any) {
        console.error("Monitoring error:", error);
        setLogs(prev => [...prev, {
          type: 'error',
          message: `Error setting up monitoring: ${error?.message || 'Unknown error'}`
        }]);
        setStep('waitFunding');
      }
    } catch (error: any) {
      console.error("Setup error:", error);
      setLogs(prev => [...prev, {
        type: 'error',
        message: `Setup error: ${error?.message || 'Unknown error'}`
      }]);
      setStep('waitFunding');
    }
  }, [wagmiPublicClient]);

  // Start monitoring when one-off address is funded
  useEffect(() => {
    if (step === 'waitFunding' && shuffleState.oneOff && shuffleState.escapeHatch) {
      monitorAndForward(
        shuffleState.oneOff.address,
        shuffleState.oneOff.privateKey,
        shuffleState.escapeHatch.address
      );
    }
  }, [step, shuffleState.oneOff, shuffleState.escapeHatch, monitorAndForward]);

  // Replace exportDeviceInfo with exportRecoveryInfo
  const exportRecoveryInfo = () => {
    if (!nonce) return;
    
    // Get the stored entropy for this nonce
    const entropyHex = localStorage.getItem(`entropy_${nonce}`);
    
    if (!entropyHex) {
      setLogs(prev => [...prev, {
        type: 'error',
        message: 'Recovery information not found. This must be exported from the original device.'
      }]);
      return;
    }
    
    const recoveryInfo = {
      nonce,
      entropy: entropyHex,
      created: new Date().toISOString()
    };
    
    // Convert to downloadable format
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(recoveryInfo));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "privacy_shuffler_recovery.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    
    setLogs(prev => [...prev, {
      type: 'success',
      message: 'Recovery information exported. Keep this file secure!'
    }]);
  };

  // Add recovery function for future use
  const recoverFromNonce = (userNonce: string, entropyHex: string) => {
    try {
      // Convert hex entropy back to Uint8Array
      const storedEntropy = new Uint8Array(16);
      for (let i = 0; i < 16; i++) {
        storedEntropy[i] = parseInt(entropyHex.slice(i*2, (i+1)*2), 16);
      }
      
      // Regenerate using same process
      const nonceHash = keccak256(toUtf8Bytes(userNonce));
      const combinedEntropy = new Uint8Array(16);
      for (let i = 0; i < 16; i++) {
        combinedEntropy[i] = storedEntropy[i] ^ 
          parseInt(nonceHash.slice(2 + i*2, 4 + i*2), 16);
      }
      
      // Create mnemonic and wallet
      const entropyBuffer = Buffer.from(combinedEntropy);
      const mnemonic = Mnemonic.fromEntropy(entropyBuffer);
      return HDNodeWallet.fromPhrase(mnemonic.phrase);
    } catch (error) {
      console.error("Recovery failed:", error);
      return null;
    }
  };

  // Add a new function for manual forwarding
  const manualForward = async () => {
    if (!shuffleState.oneOff || !shuffleState.escapeHatch || !wagmiPublicClient) return;

    try {
      setStep('forwarding');
      setLogs(prev => [...prev, {
        type: 'info',
        message: 'Manually triggering forwarding...'
      }]);

      // Create TransferService to check both networks
      const providerUrl = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://sepolia.base.org';
      const transferService = new TransferService(providerUrl, shuffleState.oneOff.address, true);
      
      // Get balances from both networks
      const balances = await transferService.getBalanceMultiNetwork(shuffleState.oneOff.address);
      
      // Log balances from both networks
      setLogs(prev => [...prev, {
        type: 'info',
        message: `Testnet balance: ${balances.testnet} ETH, Mainnet balance: ${balances.mainnet} ETH`
      }]);
      
      // Determine which network to use based on balances
      let networkToUse: 'testnet' | 'mainnet' = 'testnet';
      let balanceToUse = parseFloat(balances.testnet);
      
      // If mainnet has a balance and testnet doesn't, use mainnet
      if (parseFloat(balances.mainnet) > 0 && parseFloat(balances.testnet) === 0) {
        networkToUse = 'mainnet';
        balanceToUse = parseFloat(balances.mainnet);
      }
      // If both have balances, use the one with higher balance
      else if (parseFloat(balances.mainnet) > 0 && parseFloat(balances.testnet) > 0) {
        if (parseFloat(balances.mainnet) > parseFloat(balances.testnet)) {
          networkToUse = 'mainnet';
          balanceToUse = parseFloat(balances.mainnet);
        }
        
        setLogs(prev => [...prev, {
          type: 'warning',
          message: `Detected balances on both networks. Using ${networkToUse === 'testnet' ? 'Base Sepolia' : 'Base Mainnet'} which has the higher balance.`
        }]);
      }
      
      if (balanceToUse <= 0) {
        setLogs(prev => [...prev, {
          type: 'error',
          message: 'No funds detected on either network. Please send funds first.'
        }]);
        setStep('waitFunding');
        return;
      }

      setLogs(prev => [...prev, {
        type: 'info',
        message: `Found ${balanceToUse} ETH on ${networkToUse === 'testnet' ? 'Base Sepolia' : 'Base Mainnet'}. Preparing to forward...`
      }]);

      // Get the appropriate RPC URL for the network
      const targetRpcUrl = networkToUse === 'testnet' 
        ? (process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://sepolia.base.org') 
        : 'https://mainnet.base.org';
      
      // Create provider for the selected network
      const provider = new JsonRpcProvider(targetRpcUrl);
      
      // Create wallet
      const wallet = new Wallet(shuffleState.oneOff.privateKey).connect(provider);
      
      // Get current balance again to be sure
      const oneOffBalance = await provider.getBalance(shuffleState.oneOff.address);
      
      // Determine if this is a testnet
      const isTestnet = networkToUse === 'testnet';
      
      // Get current gas price with a buffer for testnets
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice || BigInt(0);
      const adjustedGasPrice = isTestnet 
        ? gasPrice + (gasPrice / BigInt(4)) // Add 25% buffer on testnets for manual forwarding
        : gasPrice;
      
      // Use slightly higher gas limit for reliability, especially on testnets
      const gasLimit = BigInt(25000);
      
      // Calculate gas costs
      const gasCost = adjustedGasPrice * gasLimit;
      
      // Add an additional safety buffer (especially important for testnets)
      const gasCostWithSafetyBuffer = gasCost + (gasCost / BigInt(10)); // 10% extra buffer
      
      // Log the actual values for debugging
      console.log(`One-off balance on ${networkToUse}:`, formatEther(oneOffBalance), 'ETH');
      console.log('Gas cost for manual forward:', formatEther(gasCostWithSafetyBuffer), 'ETH');

      // Ensure we have enough balance to cover gas
      if (oneOffBalance <= gasCostWithSafetyBuffer) {
        setLogs(prev => [...prev, {
          type: 'error',
          message: `Balance (${formatEther(oneOffBalance)} ETH) too low to cover gas (estimated ${formatEther(gasCostWithSafetyBuffer)} ETH). Send more funds.`
        }]);
        setStep('waitFunding');
        return;
      }
      
      // Calculate amount to send (full balance minus gas)
      const amountToSend = oneOffBalance - gasCostWithSafetyBuffer;
      
      setLogs(prev => [...prev, {
        type: 'info',
        message: `Manual forwarding ${formatEther(amountToSend)} ETH to escape hatch from ${networkToUse === 'testnet' ? 'Base Sepolia' : 'Base Mainnet'}...`
      }]);

      try {
        // Build the transaction 
        const txRequest = {
          to: shuffleState.escapeHatch.address,
          value: amountToSend,
          gasLimit: BigInt(gasLimit), // Use BigInt for consistency
          gasPrice: adjustedGasPrice
        };
        
        console.log('Sending manual transaction:', txRequest);
        
        const tx = await wallet.sendTransaction(txRequest).catch((err) => {
          // Specifically catch and log transaction submission errors
          console.error("Manual transaction submission error:", err);
          throw new Error(err.message || "Failed to submit transaction");
        });

        setLogs(prev => [...prev, {
          type: 'info',
          message: `Forwarding transaction sent: ${tx.hash}`
        }]);

        // On testnets, we might not need to wait for confirmation
        if (!isTestnet) {
          const receipt = await tx.wait(1); // Only wait for 1 confirmation to be faster
          if (receipt) {
            setLogs(prev => [...prev, {
              type: 'success',
              message: `Transaction confirmed: ${receipt.hash}`
            }]);
          }
        } else {
          // For testnets, set a timeout to move to complete
          setTimeout(() => {
            setLogs(prev => [...prev, {
              type: 'warning',
              message: 'Testnet transaction may take longer to confirm. Proceeding without waiting.'
            }]);
            setStep('complete');
          }, 30000);
        }
        
        setStep('complete');
        setLogs(prev => [...prev, {
          type: 'success',
          message: 'Funds successfully forwarded to escape hatch!'
        }]);
        
        // Check final escape hatch balance after a delay to allow network propagation
        setTimeout(async () => {
          try {
            if (shuffleState.escapeHatch) {
              const finalBalance = await provider.getBalance(shuffleState.escapeHatch.address);
              
              setLogs(prev => [...prev, {
                type: 'info',
                message: `Escape hatch final balance: ${formatEther(finalBalance)} ETH`
              }]);
            }
          } catch (e) {
            // Ignore balance check errors
            console.error('Error checking final balance:', e);
          }
        }, 15000);
      } catch (error) {
        console.error('Manual transaction error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        
        setLogs(prev => [...prev, {
          type: 'error',
          message: errorMessage
        }]);
        
        // Stay in forwarding state to allow retry
      }
    } catch (error) {
      console.error('Manual forwarding setup failed:', error);
      setLogs(prev => [...prev, {
        type: 'error',
        message: `Manual forwarding failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }]);
      setStep('waitFunding'); // Go back to waiting stage
    }
  };

  // Add a function to check balances
  const checkBalances = async () => {
    if (!wagmiPublicClient || !shuffleState.oneOff || !shuffleState.escapeHatch) return;

    try {
      setLogs(prev => [...prev, {
        type: 'info',
        message: 'Checking balances on both networks...'
      }]);

      // Create TransferService to check both networks
      const providerUrl = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://sepolia.base.org';
      const transferService = new TransferService(providerUrl, shuffleState.oneOff.address, true);
      
      // Get balances from both networks for one-off address
      const oneOffBalances = await transferService.getBalanceMultiNetwork(shuffleState.oneOff.address);
      
      // Get balances from both networks for escape hatch
      const escapeHatchBalances = await transferService.getBalanceMultiNetwork(shuffleState.escapeHatch.address);

      setLogs(prev => [...prev, {
        type: 'info',
        message: `One-off address balances: ${oneOffBalances.testnet} ETH (Sepolia), ${oneOffBalances.mainnet} ETH (Mainnet)`
      }]);

      setLogs(prev => [...prev, {
        type: 'info',
        message: `Escape hatch balances: ${escapeHatchBalances.testnet} ETH (Sepolia), ${escapeHatchBalances.mainnet} ETH (Mainnet)`
      }]);

      // If one-off has balance on either network but forwarding hasn't started
      if ((parseFloat(oneOffBalances.testnet) > 0 || parseFloat(oneOffBalances.mainnet) > 0) && step === 'waitFunding') {
        setLogs(prev => [...prev, {
          type: 'warning',
          message: `Funds detected in one-off address (${parseFloat(oneOffBalances.testnet) > 0 ? 'Sepolia' : 'Mainnet'}) but forwarding hasn\'t started. Consider using Manual Forward.`
        }]);
      }

      return { 
        oneOff: oneOffBalances, 
        escapeHatch: escapeHatchBalances 
      };
    } catch (error) {
      console.error('Balance check error:', error);
      setLogs(prev => [...prev, {
        type: 'error',
        message: `Balance check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }]);
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 'init':
        return (
          <div className="space-y-8">
            <div>
              <h3 className="cosmic-title text-3xl py-4 font-space">Base ETH Shuffler</h3>
              <div className="prose max-w-none mb-6">
                <p>
                  Don&apos;t let others track your onchain activity. Use this tool to break the link between your addresses.
                </p>
              </div>
            </div>
            
            {isConnected && (
              <div className="flex flex-col space-y-4 mt-4">
                <input
                  type="text"
                  placeholder="Enter a recovery key (optional)"
                  className="crypto-input w-full"
                  onChange={(e) => setNonce(e.target.value)}
                  value={nonce}
                />
                <button
                  onClick={async () => {
                    const wallet = await generateEscapeHatch();
                    if (wallet) setStep('generateSeed');
                  }}
                  className="crypto-button w-full"
                >
                  Generate Escape Hatch
                </button>
              </div>
            )}
          </div>
        );

      case 'generateSeed':
        return (
          <div className="space-y-6">
            <h3 className="cosmic-title text-3xl py-4 font-space">Save Your Recovery Phrase</h3>
            <div className="crypto-card shadow-nebula">
              <p className="text-sm text-gray-300 mb-4">
                Write down this 12-word seed phrase. You'll need it to recover your cosmic funds:
              </p>
              <p className="font-mono text-crypto-secondary break-words p-4 bg-crypto-dark/80 rounded-lg border border-crypto-primary/20">
                {shuffleState.escapeHatch?.mnemonic}
              </p>
            </div>
            <div className="flex flex-col space-y-4">
              <button
                onClick={() => {
                  setSeedConfirmed(true);
                  setStep('generateOneOff');
                }}
                className="crypto-button w-full"
              >
                I've Saved My Seed Phrase
              </button>
              <button
                onClick={() => exportRecoveryInfo()}
                className="px-6 py-3 rounded-lg font-medium transition-all duration-300 
                         border border-crypto-primary/30 text-crypto-primary hover:bg-crypto-primary/10
                         hover:text-white"
              >
                Export Recovery Info
              </button>
            </div>
          </div>
        );

      case 'generateOneOff':
        return (
          <div className="space-y-6">
            <h3 className="cosmic-title text-3xl py-4 font-space">Generate One-Off Address</h3>
            <p className="text-gray-300">
              Generate a one-time use address to receive initial funds.
              These funds will be automatically forwarded to your cosmic escape hatch.
            </p>
            <div className="flex flex-col space-y-4">
              <button
                onClick={async () => {
                  const wallet = await generateOneOffAddress();
                  if (wallet) setStep('waitFunding');
                }}
                className="crypto-button w-full"
              >
                Generate One-Off Address
              </button>
            </div>
          </div>
        );

      case 'waitFunding':
        return (
          <div className="space-y-6">
            <h3 className="cosmic-title text-3xl py-4 font-space">Waiting for Funds</h3>
            
            <div className="crypto-card">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-300 mb-2">Send funds to this one-off address:</p>
                  <p className="font-mono text-crypto-secondary break-words">
                    {shuffleState.oneOff?.address}
                  </p>
                </div>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(shuffleState.oneOff?.address || '');
                    setLogs(prev => [...prev, {
                      type: 'info',
                      message: 'Address copied to clipboard'
                    }]);
                  }}
                  className="p-2 rounded-lg bg-crypto-dark hover:bg-crypto-dark-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-crypto-secondary" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                    <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="crypto-card">
              <p className="text-gray-300 mb-4">
                Funds sent to this address will be automatically forwarded to your escape hatch address:
              </p>
              <div className="flex justify-between items-start mb-4">
                <p className="font-mono text-xs text-crypto-secondary break-words">
                  {shuffleState.escapeHatch?.address}
                </p>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(shuffleState.escapeHatch?.address || '');
                    setLogs(prev => [...prev, {
                      type: 'info',
                      message: 'Escape hatch address copied to clipboard'
                    }]);
                  }}
                  className="p-2 rounded-lg bg-crypto-dark hover:bg-crypto-dark-600 ml-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-crypto-secondary" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                    <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="animate-cosmic p-4 bg-crypto-dark-600/40 rounded-lg border border-crypto-primary/20">
                <p className="text-center text-crypto-secondary">
                  Monitoring for incoming transactions...
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={checkBalances}
                  className="py-3 px-4 rounded-lg bg-crypto-dark-600/40 text-crypto-secondary border border-crypto-secondary/30 hover:bg-crypto-secondary/10 transition-colors"
                >
                  Check Balances
                </button>
                
                <button
                  onClick={manualForward}
                  className="py-3 px-4 rounded-lg bg-crypto-dark-600/40 border border-crypto-primary/30 text-crypto-primary hover:bg-crypto-primary/10 transition-colors"
                >
                  Manual Forward
                </button>
              </div>
            </div>
          </div>
        );

      case 'forwarding':
        return (
          <div className="space-y-6">
            <h3 className="cosmic-title text-3xl py-4 font-space">Forwarding Funds</h3>
            <div className="animate-cosmic p-6 crypto-card">
              <div className="flex items-center justify-center space-x-3">
                <div className="animate-spin w-5 h-5 border-2 border-crypto-secondary border-t-transparent rounded-full"></div>
                <p className="text-center text-crypto-secondary">
                  Forwarding funds to escape hatch...
                </p>
              </div>
            </div>
          </div>
        );

      case 'complete':
        return (
          <div className="space-y-6">
            <h3 className="cosmic-title text-3xl py-4 font-space">Transfer Complete</h3>
            <div className="crypto-card border-crypto-secondary/30">
              <p className="text-gray-300">
                Funds have been successfully forwarded to your escape hatch address:
              </p>
              <div className="flex items-center justify-between mt-2">
                <p className="font-mono text-crypto-secondary break-words">
                  {shuffleState.escapeHatch?.address}
                </p>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(shuffleState.escapeHatch?.address || '');
                    setLogs(prev => [...prev, {
                      type: 'info',
                      message: 'Address copied to clipboard'
                    }]);
                  }}
                  className="ml-2 p-2 rounded-lg bg-crypto-dark hover:bg-crypto-dark-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-crypto-secondary" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                    <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="crypto-card">
              <details>
                <summary className="text-crypto-primary cursor-pointer">View Recovery Information</summary>
                <div className="mt-3 space-y-3">
                  <div>
                    <p className="text-sm text-gray-300 mb-1">Recovery Key:</p>
                    <p className="font-mono text-xs bg-crypto-dark/80 p-2 rounded border border-crypto-primary/20">{shuffleState.escapeHatch?.nonce}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-300 mb-1">Seed Phrase (keep secure):</p>
                    <p className="font-mono text-xs bg-crypto-dark/80 p-2 rounded border border-crypto-primary/20">{shuffleState.escapeHatch?.mnemonic}</p>
                  </div>
                </div>
              </details>
            </div>
            
            <button
              onClick={() => {
                setStep('init');
                setShuffleState({
                  escapeHatch: null,
                  oneOff: null,
                  pendingTransfer: null
                });
              }}
              className="crypto-button w-full"
            >
              Start New Transfer
            </button>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      {renderStepContent()}

      <div className="mt-6">
        <div className="space-y-2">
          {logs.map((log, index) => (
            <div
              key={index}
              className={`p-3 rounded ${
                log.type === 'error'
                  ? 'bg-error/20 text-error'
                  : log.type === 'warning'
                  ? 'bg-warning/20 text-warning'
                  : 'bg-info/20 text-info'
              }`}
            >
              {log.message}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PrivacyShuffler; 