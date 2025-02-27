import { getAddress, Wallet, keccak256, toUtf8Bytes, concat, zeroPadValue, toBeHex } from 'ethers';
import { config } from 'dotenv';

config();

interface VerificationResult {
  index: number;
  derived: string;
  privateKey: string;
}

async function verifyAddressGeneration(
  rootAddress: string,
  signature: string,
  count: number = 5
): Promise<VerificationResult[]> {
  // Use the signature as entropy for generating addresses
  const baseHash = keccak256(toUtf8Bytes(signature));
  
  // Generate addresses
  const results: VerificationResult[] = [];
  for (let i = 0; i < count; i++) {
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
    
    results.push({
      index: i,
      derived: derivedAddress,
      privateKey
    });
  }

  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const rootAddress = args[0];
  const signature = args[1];
  const count = args[2] ? parseInt(args[2]) : 5;

  if (!rootAddress || !signature) {
    console.error('Usage: ts-node verify-addresses.ts <root-address> <signature> [count]');
    process.exit(1);
  }

  try {
    console.log('\nVerifying deterministic address generation...');
    console.log('Root address:', rootAddress);
    console.log('Generating', count, 'addresses...\n');

    const results = await verifyAddressGeneration(rootAddress, signature, count);

    console.log('Generated Addresses:');
    console.log('==================');
    
    results.forEach((result) => {
      console.log(`\nIndex: ${result.index}`);
      console.log(`Address: ${result.derived}`);
      console.log(`Private Key: ${result.privateKey}`);
    });

  } catch (error) {
    console.error('\nError:', error instanceof Error ? error.message : 'Unknown error occurred');
    process.exit(1);
  }
}

main(); 