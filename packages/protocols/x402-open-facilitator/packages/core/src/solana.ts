/**
 * Solana SPL Token settlement implementation
 * 
 * For Solana, the x402 payment flow uses pre-signed transactions:
 * 1. Payer creates and signs a transaction transferring USDC
 * 2. Facilitator receives the signed transaction and submits it
 * 
 * This is different from EVM's ERC-3009 where the facilitator calls
 * receiveWithAuthorization with the payer's signature.
 */
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
  sendAndConfirmTransaction,
  SendTransactionError,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  createTransferInstruction,
  getAccount,
} from '@solana/spl-token';
import bs58 from 'bs58';
import { validateSolanaTransaction } from './solana-validation.js';

/**
 * Get Solana RPC URL for a network
 * Uses environment variables with fallback to public RPCs
 */
function getSolanaRpcUrl(network: string): string {
  if (network === 'solana' || network === 'solana-mainnet') {
    return process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  }
  if (network === 'solana-devnet') {
    return process.env.SOLANA_DEVNET_RPC_URL || 'https://api.devnet.solana.com';
  }
  return 'https://api.mainnet-beta.solana.com';
}

/**
 * Known USDC mint addresses
 */
export const USDC_MINTS: Record<string, string> = {
  'solana': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'solana-devnet': '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
};

export interface SolanaSettlementParams {
  network: 'solana' | 'solana-devnet';
  /** Base64 or base58 encoded signed transaction from the payer */
  signedTransaction: string;
  /** Facilitator's private key (base58 encoded) - used as fee payer if needed */
  facilitatorPrivateKey: string;
}

export interface SolanaSettlementResult {
  success: boolean;
  transactionHash?: string;
  errorMessage?: string;
}

/**
 * Submit a pre-signed Solana transaction
 * 
 * The transaction should already be signed by the payer.
 * The facilitator may need to co-sign as fee payer.
 */
export async function executeSolanaSettlement(
  params: SolanaSettlementParams
): Promise<SolanaSettlementResult> {
  const { network, signedTransaction, facilitatorPrivateKey } = params;

  console.log('[SolanaSettlement] Starting settlement:', { 
    network, 
    txLength: signedTransaction?.length,
    hasPrivateKey: !!facilitatorPrivateKey 
  });

  const rpcUrl = getSolanaRpcUrl(network);
  if (!rpcUrl) {
    console.error('[SolanaSettlement] No RPC URL for network:', network);
    return {
      success: false,
      errorMessage: `Unsupported Solana network: ${network}`,
    };
  }

  console.log('[SolanaSettlement] Using RPC:', rpcUrl.substring(0, 50) + '...');

  try {
    const connection = new Connection(rpcUrl, 'confirmed');

    // Decode the facilitator's keypair
    const facilitatorKeypair = Keypair.fromSecretKey(
      bs58.decode(facilitatorPrivateKey)
    );

    // Try to decode the transaction
    let transaction: Transaction | VersionedTransaction;
    
    try {
      // First try base64 (common for serialized transactions)
      const txBuffer = Buffer.from(signedTransaction, 'base64');
      
      // Try to deserialize as VersionedTransaction first
      try {
        transaction = VersionedTransaction.deserialize(txBuffer);
      } catch {
        // Fall back to legacy Transaction
        transaction = Transaction.from(txBuffer);
      }
    } catch {
      // Try base58 encoding
      try {
        const txBuffer = bs58.decode(signedTransaction);
        try {
          transaction = VersionedTransaction.deserialize(txBuffer);
        } catch {
          transaction = Transaction.from(txBuffer);
        }
      } catch (e) {
        return {
          success: false,
          errorMessage: `Failed to decode transaction: ${e instanceof Error ? e.message : 'Unknown error'}`,
        };
      }
    }

    // Defense-in-depth: validate transaction instructions before signing
    const validationResult = validateSolanaTransaction(transaction, facilitatorKeypair.publicKey);
    if (!validationResult.valid) {
      console.error('[SolanaSettlement] Transaction validation FAILED:', validationResult.error);
      return {
        success: false,
        errorMessage: `Transaction validation failed: ${validationResult.error}`,
      };
    }
    console.log('[SolanaSettlement] Transaction validation passed');

    // Send the transaction
    let signature: string;
    
    console.log('[SolanaSettlement] Transaction type:', transaction instanceof VersionedTransaction ? 'VersionedTransaction' : 'LegacyTransaction');
    
    if (transaction instanceof VersionedTransaction) {
      // For versioned transactions, the facilitator may need to co-sign as fee payer
      // Check if the facilitator is the fee payer (first static account key)
      const message = transaction.message;
      const staticAccountKeys = message.staticAccountKeys;
      
      console.log('[SolanaSettlement] Static account keys:', staticAccountKeys.length);
      console.log('[SolanaSettlement] Existing signatures:', transaction.signatures.length);
      
      // The fee payer is always the first account in the transaction
      if (staticAccountKeys.length > 0) {
        const feePayerPubkey = staticAccountKeys[0];
        console.log('[SolanaSettlement] Fee payer in tx:', feePayerPubkey.toBase58());
        console.log('[SolanaSettlement] Facilitator pubkey:', facilitatorKeypair.publicKey.toBase58());
        
        // If facilitator is the fee payer, we need to sign
        if (feePayerPubkey.equals(facilitatorKeypair.publicKey)) {
          console.log('[SolanaSettlement] Facilitator IS fee payer, adding signature...');
          // Add facilitator's signature
          transaction.sign([facilitatorKeypair]);
          console.log('[SolanaSettlement] Signatures after signing:', transaction.signatures.length);
        } else {
          console.log('[SolanaSettlement] WARNING: Fee payer mismatch! Facilitator is NOT the fee payer.');
          console.log('[SolanaSettlement] Expected:', feePayerPubkey.toBase58());
          console.log('[SolanaSettlement] Got:', facilitatorKeypair.publicKey.toBase58());
          // Try to sign anyway - the fee payer might be different but still needs facilitator signature
        }
      }
      
      // Check if the transaction's blockhash is still valid before sending
      const txBlockhash = message.recentBlockhash;
      console.log('[SolanaSettlement] Transaction blockhash:', txBlockhash);
      const isValid = await connection.isBlockhashValid(txBlockhash, { commitment: 'confirmed' });
      if (!isValid.value) {
        console.error('[SolanaSettlement] Transaction blockhash is EXPIRED, skipping send');
        return {
          success: false,
          errorMessage: 'Transaction blockhash expired before facilitator could submit. The payer should retry.',
        };
      }
      console.log('[SolanaSettlement] Blockhash is valid, proceeding to send');

      // Send the transaction - skip preflight to avoid simulation issues
      try {
        console.log('[SolanaSettlement] Sending versioned transaction (skipPreflight=true, maxRetries=3)...');
        // Always skip preflight for x402 transactions to avoid timing issues
        // maxRetries tells the RPC to re-forward to subsequent leaders if the first misses it
        signature = await connection.sendTransaction(transaction, {
          skipPreflight: true,
          preflightCommitment: 'confirmed',
          maxRetries: 3,
        });
        console.log('[SolanaSettlement] Transaction sent! Signature:', signature);
      } catch (e) {
        console.error('[SolanaSettlement] Transaction send failed:', e);
        const error = e as Error & { signature?: string; transactionMessage?: string };
        if (error.signature) {
          // Sometimes the transaction is sent but we get an error anyway
          console.log('[SolanaSettlement] Error has signature:', error.signature);
          signature = error.signature;
        } else {
          throw e; // Re-throw if no signature
        }
      }
    } else {
      // For legacy transactions, we might need to add the facilitator as fee payer
      // Check if the transaction needs a fee payer signature
      if (!transaction.feePayer) {
        transaction.feePayer = facilitatorKeypair.publicKey;
      }
      
      // Get recent blockhash if not present
      if (!transaction.recentBlockhash) {
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
      }
      
      // Sign with facilitator if they're the fee payer
      if (transaction.feePayer?.equals(facilitatorKeypair.publicKey)) {
        transaction.partialSign(facilitatorKeypair);
      }
      
      // Use sendRawTransaction for pre-signed transactions
      const rawTransaction = transaction.serialize();
      signature = await connection.sendRawTransaction(rawTransaction, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
    }

    // Poll for confirmation with a tight loop instead of blocking on confirmTransaction
    // This avoids the 60-90s blockheight timeout that cascades into upstream HTTP timeouts
    console.log('[SolanaSettlement] Waiting for confirmation...');
    const maxPollTime = 30_000; // 30 seconds max
    const pollInterval = 2_000; // Check every 2 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxPollTime) {
      try {
        const status = await connection.getSignatureStatus(signature);

        if (status.value !== null) {
          // Transaction found on-chain
          if (status.value.err) {
            console.error('[SolanaSettlement] Transaction failed on-chain:', status.value.err);
            return {
              success: false,
              transactionHash: signature,
              errorMessage: `Transaction failed: ${JSON.stringify(status.value.err)}`,
            };
          }

          if (status.value.confirmationStatus === 'confirmed' || status.value.confirmationStatus === 'finalized') {
            console.log('[SolanaSettlement] SUCCESS! Transaction confirmed:', signature, 'status:', status.value.confirmationStatus);
            return {
              success: true,
              transactionHash: signature,
            };
          }

          console.log('[SolanaSettlement] Transaction status:', status.value.confirmationStatus, '- waiting...');
        }
      } catch (pollError) {
        console.warn('[SolanaSettlement] Status poll error (will retry):', pollError instanceof Error ? pollError.message : pollError);
      }

      // Check if the blockhash is still valid — if not, the tx will never land
      try {
        const txBlockhash = (transaction instanceof VersionedTransaction)
          ? transaction.message.recentBlockhash
          : transaction.recentBlockhash;
        if (txBlockhash) {
          const stillValid = await connection.isBlockhashValid(txBlockhash, { commitment: 'confirmed' });
          if (!stillValid.value) {
            console.warn('[SolanaSettlement] Blockhash expired during confirmation wait. Transaction will not land.');
            return {
              success: false,
              transactionHash: signature,
              errorMessage: 'Transaction blockhash expired before confirmation. The payer should retry.',
            };
          }
        }
      } catch {
        // Ignore blockhash check errors, continue polling
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    // Final check after timeout
    try {
      const finalStatus = await connection.getSignatureStatus(signature);
      if (finalStatus.value?.confirmationStatus === 'confirmed' || finalStatus.value?.confirmationStatus === 'finalized') {
        console.log('[SolanaSettlement] Transaction confirmed on final check:', signature);
        return {
          success: true,
          transactionHash: signature,
        };
      }
    } catch {
      // Ignore final check errors
    }

    console.warn('[SolanaSettlement] Confirmation timeout after 30s, tx was sent:', signature);
    return {
      success: false,
      transactionHash: signature,
      errorMessage: 'Transaction sent but not confirmed within 30s. It may still land — check the signature on-chain.',
    };
  } catch (error) {
    console.error('[SolanaSettlement] ERROR:', error);
    
    let errorMessage = 'Unknown error during Solana settlement';
    if (error instanceof SendTransactionError) {
      errorMessage = `Transaction failed: ${error.message}`;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return {
      success: false,
      errorMessage,
    };
  }
}

/**
 * Generate a Solana keypair
 */
export function generateSolanaKeypair(): { publicKey: string; privateKey: string } {
  const keypair = Keypair.generate();
  return {
    publicKey: keypair.publicKey.toBase58(),
    privateKey: bs58.encode(keypair.secretKey),
  };
}

/**
 * Get public key from private key
 */
export function getSolanaPublicKey(privateKey: string): string {
  const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
  return keypair.publicKey.toBase58();
}

/**
 * Get SOL balance for a wallet
 */
export async function getSolanaBalance(
  network: 'solana' | 'solana-devnet',
  address: string
): Promise<{ balance: bigint; formatted: string }> {
  const rpcUrl = getSolanaRpcUrl(network);

  const connection = new Connection(rpcUrl, 'confirmed');
  const publicKey = new PublicKey(address);
  const balance = await connection.getBalance(publicKey);
  
  // SOL has 9 decimals
  const formatted = (balance / 1e9).toFixed(6);
  
  return {
    balance: BigInt(balance),
    formatted,
  };
}

/**
 * Get USDC balance for a wallet
 */
export async function getSolanaUSDCBalance(
  network: 'solana' | 'solana-devnet',
  address: string
): Promise<{ balance: bigint; formatted: string }> {
  const rpcUrl = getSolanaRpcUrl(network);
  const usdcMint = USDC_MINTS[network];
  
  if (!usdcMint) {
    throw new Error(`Unsupported Solana network: ${network}`);
  }

  const connection = new Connection(rpcUrl, 'confirmed');
  const publicKey = new PublicKey(address);
  const mintPublicKey = new PublicKey(usdcMint);
  
  try {
    const tokenAccountAddress = await getAssociatedTokenAddress(
      mintPublicKey,
      publicKey
    );
    
    const tokenAccount = await getAccount(connection, tokenAccountAddress);
    const balance = tokenAccount.amount;
    
    // USDC has 6 decimals
    const formatted = (Number(balance) / 1e6).toFixed(2);
    
    return {
      balance: BigInt(balance.toString()),
      formatted,
    };
  } catch {
    // Token account doesn't exist = 0 balance
    return {
      balance: BigInt(0),
      formatted: '0.00',
    };
  }
}

/**
 * Validate a Solana address
 */
export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate a Solana private key
 */
export function isValidSolanaPrivateKey(privateKey: string): boolean {
  try {
    const decoded = bs58.decode(privateKey);
    // Solana secret keys are 64 bytes (32 bytes private + 32 bytes public)
    return decoded.length === 64;
  } catch {
    return false;
  }
}

