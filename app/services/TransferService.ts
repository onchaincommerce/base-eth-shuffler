import { ethers, JsonRpcProvider, parseEther, Wallet } from 'ethers';
import { networkConfig } from '../config/network';

export class TransferService {
  private provider: JsonRpcProvider;
  private mainnetProvider: JsonRpcProvider;
  private userAddress: string;
  private multiNetworkEnabled: boolean;

  constructor(rpcUrl: string, userAddress: string, enableMultiNetwork: boolean = true) {
    this.provider = new JsonRpcProvider(rpcUrl);
    this.mainnetProvider = new JsonRpcProvider(networkConfig[8453].rpcUrl);
    this.userAddress = userAddress;
    this.multiNetworkEnabled = enableMultiNetwork;
  }

  async executeTransfer(
    fromPrivateKey: string,
    toAddress: string,
    amountEth: number,
    gasPrice?: bigint
  ): Promise<string> {
    try {
      // Create wallet instance for the source address
      const wallet = new Wallet(fromPrivateKey, this.provider);

      // Convert ETH amount to Wei
      const amountWei = parseEther(amountEth.toString());

      // Get the current nonce for the wallet
      const nonce = await this.provider.getTransactionCount(wallet.address);

      // Get current gas price if not provided
      const currentGasPrice = gasPrice || await this.provider.getFeeData().then(fees => fees.gasPrice || BigInt(0));

      // Prepare the transaction
      const tx = {
        to: toAddress,
        value: amountWei,
        gasPrice: currentGasPrice,
        nonce: nonce,
      };

      // Estimate gas limit
      const gasLimit = await wallet.estimateGas(tx);

      // Send the transaction
      const transaction = await wallet.sendTransaction({
        ...tx,
        gasLimit: gasLimit,
      });

      // Wait for the transaction to be mined
      const receipt = await transaction.wait();

      return receipt?.hash || transaction.hash;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Transfer failed: ${errorMessage}`);
    }
  }

  async getBalance(address: string): Promise<string> {
    try {
      const balance = await this.provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to get balance: ${errorMessage}`);
    }
  }

  // New method to get balance from both networks
  async getBalanceMultiNetwork(address: string): Promise<{ testnet: string; mainnet: string }> {
    try {
      const [testnetBalance, mainnetBalance] = await Promise.all([
        this.provider.getBalance(address),
        this.mainnetProvider.getBalance(address),
      ]);
      
      return {
        testnet: ethers.formatEther(testnetBalance),
        mainnet: ethers.formatEther(mainnetBalance),
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to get multi-network balance: ${errorMessage}`);
    }
  }

  // Method to watch balance changes on both networks
  async watchBalanceChanges(
    address: string, 
    callback: (network: 'testnet' | 'mainnet', balance: string) => void,
    interval: number = 5000
  ): Promise<() => void> {
    let lastTestnetBalance = BigInt(0);
    let lastMainnetBalance = BigInt(0);
    
    const checkBalances = async () => {
      try {
        // Always check testnet
        const testnetBalance = await this.provider.getBalance(address);
        
        if (testnetBalance !== lastTestnetBalance) {
          lastTestnetBalance = testnetBalance;
          callback('testnet', ethers.formatEther(testnetBalance));
        }
        
        // Check mainnet if multi-network is enabled
        if (this.multiNetworkEnabled) {
          const mainnetBalance = await this.mainnetProvider.getBalance(address);
          
          if (mainnetBalance !== lastMainnetBalance) {
            lastMainnetBalance = mainnetBalance;
            callback('mainnet', ethers.formatEther(mainnetBalance));
          }
        }
      } catch (error) {
        console.error('Error watching balance changes:', error);
      }
    };
    
    // Initial check
    await checkBalances();
    
    // Setup interval
    const intervalId = setInterval(checkBalances, interval);
    
    // Return cleanup function
    return () => clearInterval(intervalId);
  }

  async waitForConfirmations(
    txHash: string,
    confirmations: number = 1
  ): Promise<void> {
    try {
      const receipt = await this.provider.getTransactionReceipt(txHash);
      if (!receipt) {
        throw new Error('Transaction not found');
      }

      const currentBlock = await this.provider.getBlockNumber();
      const confirmationBlocks = currentBlock - receipt.blockNumber;

      if (confirmationBlocks < confirmations) {
        await new Promise((resolve) => setTimeout(resolve, 15000)); // Wait 15 seconds
        await this.waitForConfirmations(txHash, confirmations);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to wait for confirmations: ${errorMessage}`);
    }
  }
} 