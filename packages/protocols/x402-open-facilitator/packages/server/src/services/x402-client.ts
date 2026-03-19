/**
 * x402 Client - Makes x402 payments using Solana and Base wallets
 *
 * This is the client side of x402 - we sign and send payments
 * to access resources behind x402 paywalls.
 */
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  getAccount,
} from '@solana/spl-token';
import bs58 from 'bs58';
import { createWalletClient, http, parseUnits, encodeFunctionData, erc20Abi, createPublicClient } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// USDC mint addresses
const USDC_MINTS: Record<string, string> = {
  solana: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'solana-mainnet': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'solana-devnet': '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
};

// Base USDC contract address
const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;

interface PaymentRequirements {
  scheme: string;
  network: string;
  /** v1 field */
  maxAmountRequired?: string;
  /** v2 field */
  amount?: string;
  asset: string;
  payTo?: string;
  description?: string;
  extra?: Record<string, unknown>;
}

/** Get the amount from payment requirements (v1 or v2 format) */
function getRequiredAmount(requirements: PaymentRequirements): string {
  return requirements.maxAmountRequired ?? requirements.amount ?? '0';
}

interface X402Response {
  success: boolean;
  data?: unknown;
  error?: string;
  insufficientBalance?: boolean;
  required?: string;
  available?: string;
  txHash?: string;
}

/**
 * Get Solana RPC URL
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
 * Parse 402 response to get payment requirements
 */
function parse402Response(body: unknown): PaymentRequirements | null {
  if (!body || typeof body !== 'object') return null;

  const data = body as Record<string, unknown>;

  // Handle different 402 response formats
  // Format 1: Direct requirements object (v1 uses maxAmountRequired, v2 uses amount)
  if (data.network && (data.maxAmountRequired || data.amount)) {
    return data as unknown as PaymentRequirements;
  }

  // Format 2: Nested in paymentRequirements
  if (data.paymentRequirements) {
    return data.paymentRequirements as PaymentRequirements;
  }

  // Format 3: x402 accepts array format
  if (data.accepts && Array.isArray(data.accepts) && data.accepts.length > 0) {
    const first = data.accepts[0] as PaymentRequirements;
    return first;
  }

  return null;
}

interface SignedTransactionResult {
  serializedTransaction: string;
  signature: string;
}

/**
 * Create a signed Solana USDC transfer transaction
 * Returns both the serialized transaction and the signature (tx hash)
 *
 * For x402 flow with gas-free transactions:
 * - feePayer is the facilitator's hot wallet (pays gas fees)
 * - payer (sender) signs to authorize the USDC transfer
 * - facilitator will add their fee payer signature during settlement
 */
async function createSignedTransferTransaction(
  privateKey: string,
  recipient: string,
  amount: bigint,
  network: string,
  feePayer?: string // Facilitator's fee payer address from 402 response
): Promise<SignedTransactionResult> {
  const rpcUrl = getSolanaRpcUrl(network);
  const connection = new Connection(rpcUrl, 'confirmed');

  // Decode the private key and create keypair
  const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
  const senderPubkey = keypair.publicKey;
  const recipientPubkey = new PublicKey(recipient);

  // Use facilitator's fee payer if provided, otherwise fall back to sender
  const feePayerPubkey = feePayer ? new PublicKey(feePayer) : senderPubkey;
  const isFacilitatorFeePayer = feePayer && feePayer !== senderPubkey.toBase58();

  console.log('[x402Client] Creating transaction:', {
    sender: senderPubkey.toBase58(),
    recipient,
    feePayer: feePayerPubkey.toBase58(),
    isFacilitatorFeePayer,
  });

  // Get USDC mint
  const usdcMint = USDC_MINTS[network];
  if (!usdcMint) {
    throw new Error(`Unsupported network: ${network}`);
  }
  const mintPubkey = new PublicKey(usdcMint);

  // Get associated token accounts
  const senderATA = await getAssociatedTokenAddress(mintPubkey, senderPubkey);
  const recipientATA = await getAssociatedTokenAddress(mintPubkey, recipientPubkey);

  // Create transfer instruction
  const transferIx = createTransferInstruction(
    senderATA,
    recipientATA,
    senderPubkey,
    amount,
    [],
    TOKEN_PROGRAM_ID
  );

  // Create transaction with compute budget for better landing
  const transaction = new Transaction();

  // Add priority fee for faster confirmation
  transaction.add(
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 50000, // 0.00005 SOL per compute unit
    })
  );

  transaction.add(transferIx);

  // Get recent blockhash
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = feePayerPubkey;

  // Sign the transaction
  // If facilitator is fee payer, use partialSign (facilitator will add their signature)
  // Otherwise, fully sign
  if (isFacilitatorFeePayer) {
    transaction.partialSign(keypair);
    console.log('[x402Client] Partially signed (facilitator will add fee payer signature)');
  } else {
    transaction.sign(keypair);
    console.log('[x402Client] Fully signed (sender is fee payer)');
  }

  // Get the signature from the payer (not the fee payer)
  // For x402, we don't know the final tx hash until facilitator signs
  // But we can use the payer's signature as an identifier
  const payerSignature = transaction.signatures.find(
    sig => sig.publicKey.equals(senderPubkey) && sig.signature
  );

  // Serialize to base64 - allow missing signatures if facilitator is fee payer
  const serialized = transaction.serialize({
    requireAllSignatures: !isFacilitatorFeePayer,
    verifySignatures: false, // Don't verify since facilitator signature is missing
  });

  return {
    serializedTransaction: Buffer.from(serialized).toString('base64'),
    // Use payer signature as identifier - actual tx hash comes from facilitator
    signature: payerSignature?.signature ? bs58.encode(payerSignature.signature) : 'pending',
  };
}

/**
 * Get USDC balance for a wallet
 */
async function getUSDCBalance(address: string, network: string): Promise<bigint> {
  const rpcUrl = getSolanaRpcUrl(network);
  const usdcMint = USDC_MINTS[network];

  if (!usdcMint) {
    throw new Error(`Unsupported network: ${network}`);
  }

  const connection = new Connection(rpcUrl, 'confirmed');
  const publicKey = new PublicKey(address);
  const mintPublicKey = new PublicKey(usdcMint);

  try {
    const tokenAccountAddress = await getAssociatedTokenAddress(mintPublicKey, publicKey);
    const tokenAccount = await getAccount(connection, tokenAccountAddress);
    return BigInt(tokenAccount.amount.toString());
  } catch {
    // Token account doesn't exist = 0 balance
    return BigInt(0);
  }
}

/**
 * Get Base USDC balance for a wallet
 */
async function getBaseUSDCBalance(address: string): Promise<bigint> {
  const publicClient = createPublicClient({
    chain: base,
    transport: http(),
  });

  try {
    const balance = await publicClient.readContract({
      address: BASE_USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [address as `0x${string}`],
    });
    return balance as bigint;
  } catch (error) {
    console.error('[x402Client] Error getting Base USDC balance:', error);
    return BigInt(0);
  }
}

/**
 * Create a signed Base USDC transfer transaction
 * Returns the serialized transaction for x402 payment
 */
async function createBaseUSDCTransfer(
  privateKeyHex: string,
  recipient: string,
  amount: bigint
): Promise<{ serializedTransaction: string; txHash: string }> {
  // Create account from private key
  const account = privateKeyToAccount(privateKeyHex as `0x${string}`);

  // Create wallet client
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(),
  });

  // Encode the ERC-20 transfer function call
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'transfer',
    args: [recipient as `0x${string}`, amount],
  });

  // Get current gas prices
  const publicClient = createPublicClient({
    chain: base,
    transport: http(),
  });

  const gasPrice = await publicClient.getGasPrice();

  // Prepare the transaction
  const txRequest = {
    to: BASE_USDC_ADDRESS,
    data,
    value: BigInt(0),
    gasPrice,
  };

  // Estimate gas
  const gasEstimate = await publicClient.estimateGas({
    ...txRequest,
    account,
  });

  // Sign the transaction
  const signedTx = await walletClient.signTransaction({
    ...txRequest,
    gas: gasEstimate,
  });

  // Calculate transaction hash from signed transaction
  const txHash = await publicClient.request({
    method: 'eth_sendRawTransaction',
    params: [signedTx],
  });

  return {
    serializedTransaction: signedTx,
    txHash,
  };
}

/**
 * Make an x402 payment to access a resource
 *
 * @param url - The x402 protected endpoint
 * @param body - The request body to send
 * @param privateKey - The Solana wallet private key (base58)
 * @param walletAddress - The wallet address for balance checks
 */
export async function makeX402Payment(
  url: string,
  body: Record<string, unknown>,
  privateKey: string,
  walletAddress: string
): Promise<X402Response> {
  console.log('[x402Client] Making payment to:', url);

  try {
    // Step 1: Make initial request to get 402 response
    const initialResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    // If not 402, return the response
    if (initialResponse.status !== 402) {
      if (initialResponse.ok) {
        const data = await initialResponse.json();
        return { success: true, data };
      } else {
        const error = await initialResponse.text();
        console.error('[x402Client] Non-402 error:', initialResponse.status, error);
        return { success: false, error: `HTTP ${initialResponse.status}: ${error}` };
      }
    }

    // Step 2: Parse 402 response
    const paymentInfo = await initialResponse.json();
    console.log('[x402Client] Got 402 response:', JSON.stringify(paymentInfo, null, 2));

    const requirements = parse402Response(paymentInfo);
    if (!requirements) {
      console.error('[x402Client] Could not parse payment requirements');
      return { success: false, error: 'Could not parse payment requirements from 402 response' };
    }

    console.log('[x402Client] Payment requirements:', requirements);

    // Step 3: Check balance
    const network = requirements.network || 'solana';
    const requiredAmount = BigInt(getRequiredAmount(requirements));
    const balance = await getUSDCBalance(walletAddress, network);

    console.log('[x402Client] Balance check:', {
      required: requiredAmount.toString(),
      available: balance.toString(),
    });

    if (balance < requiredAmount) {
      return {
        success: false,
        error: 'Insufficient USDC balance',
        insufficientBalance: true,
        required: (Number(requiredAmount) / 1e6).toFixed(2),
        available: (Number(balance) / 1e6).toFixed(2),
      };
    }

    // Step 4: Get recipient address and fee payer
    const recipient = requirements.payTo || (requirements.extra?.payTo as string);
    if (!recipient) {
      console.error('[x402Client] No recipient address in payment requirements');
      return { success: false, error: 'No recipient address in payment requirements' };
    }

    // Get fee payer from extra field (for gas-free transactions)
    const feePayer = requirements.extra?.feePayer as string | undefined;
    console.log('[x402Client] Fee payer from requirements:', feePayer || '(none - sender pays gas)');

    // Step 5: Create and sign the transfer transaction
    console.log('[x402Client] Creating signed transaction...');
    const { serializedTransaction, signature } = await createSignedTransferTransaction(
      privateKey,
      recipient,
      requiredAmount,
      network,
      feePayer
    );

    console.log('[x402Client] Payer signature:', signature);

    // Step 6: Create x402 payment payload
    // For Solana, the payload contains the signed transaction
    const paymentPayload = {
      x402Version: 2,
      payload: {
        transaction: serializedTransaction,
      },
    };

    // Encode as base64
    const encodedPayload = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');

    // Step 7: Retry request with payment
    console.log('[x402Client] Sending payment...');
    const paymentResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PAYMENT': encodedPayload,
      },
      body: JSON.stringify(body),
    });

    if (!paymentResponse.ok) {
      const error = await paymentResponse.text();
      console.error('[x402Client] Payment failed:', paymentResponse.status, error);
      return { success: false, error: `Payment failed: ${error}` };
    }

    const data = await paymentResponse.json();
    console.log('[x402Client] Payment successful:', data);

    // Try to extract transaction hash from response
    // The facilitator should return this after settlement
    const responseData = data as Record<string, unknown>;
    const txHashFromResponse =
      (responseData.transactionHash as string) ||
      (responseData.txHash as string) ||
      (responseData.signature as string) ||
      ((responseData.data as Record<string, unknown>)?.transactionHash as string);

    const finalTxHash = txHashFromResponse || signature;
    console.log('[x402Client] Final transaction hash:', finalTxHash);

    return { success: true, data, txHash: finalTxHash };
  } catch (error) {
    console.error('[x402Client] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Make an x402 payment using Base chain
 *
 * @param url - The x402 protected endpoint
 * @param body - The request body to send
 * @param privateKey - The Base wallet private key (hex format)
 * @param walletAddress - The wallet address for balance checks
 */
export async function makeBaseX402Payment(
  url: string,
  body: Record<string, unknown>,
  privateKey: string,
  walletAddress: string
): Promise<X402Response> {
  console.log('[x402Client] Making Base payment to:', url);

  try {
    // Step 1: Make initial request to get 402 response
    const initialResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    // If not 402, return the response
    if (initialResponse.status !== 402) {
      if (initialResponse.ok) {
        const data = await initialResponse.json();
        return { success: true, data };
      } else {
        const error = await initialResponse.text();
        console.error('[x402Client] Non-402 error:', initialResponse.status, error);
        return { success: false, error: `HTTP ${initialResponse.status}: ${error}` };
      }
    }

    // Step 2: Parse 402 response
    const paymentInfo = await initialResponse.json();
    console.log('[x402Client] Got 402 response:', JSON.stringify(paymentInfo, null, 2));

    const requirements = parse402Response(paymentInfo);
    if (!requirements) {
      console.error('[x402Client] Could not parse payment requirements');
      return { success: false, error: 'Could not parse payment requirements from 402 response' };
    }

    console.log('[x402Client] Payment requirements:', requirements);

    // Verify this is for Base network
    if (requirements.network !== 'base') {
      return { success: false, error: `Expected base network, got ${requirements.network}` };
    }

    // Step 3: Check balance
    const requiredAmount = BigInt(getRequiredAmount(requirements));
    const balance = await getBaseUSDCBalance(walletAddress);

    console.log('[x402Client] Balance check:', {
      required: requiredAmount.toString(),
      available: balance.toString(),
    });

    if (balance < requiredAmount) {
      return {
        success: false,
        error: 'Insufficient USDC balance',
        insufficientBalance: true,
        required: (Number(requiredAmount) / 1e6).toFixed(2),
        available: (Number(balance) / 1e6).toFixed(2),
      };
    }

    // Step 4: Get recipient address
    const recipient = requirements.payTo || (requirements.extra?.payTo as string);
    if (!recipient) {
      console.error('[x402Client] No recipient address in payment requirements');
      return { success: false, error: 'No recipient address in payment requirements' };
    }

    // Step 5: Create and sign the transfer transaction
    console.log('[x402Client] Creating signed Base transaction...');
    const { serializedTransaction, txHash } = await createBaseUSDCTransfer(
      privateKey,
      recipient,
      requiredAmount
    );

    console.log('[x402Client] Transaction hash:', txHash);

    // Step 6: Create x402 payment payload
    const paymentPayload = {
      x402Version: 2,
      payload: {
        transaction: serializedTransaction,
      },
    };

    // Encode as base64
    const encodedPayload = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');

    // Step 7: Retry request with payment
    console.log('[x402Client] Sending payment...');
    const paymentResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PAYMENT': encodedPayload,
      },
      body: JSON.stringify(body),
    });

    if (!paymentResponse.ok) {
      const error = await paymentResponse.text();
      console.error('[x402Client] Payment failed:', paymentResponse.status, error);
      return { success: false, error: `Payment failed: ${error}` };
    }

    const data = await paymentResponse.json();
    console.log('[x402Client] Payment successful:', data);

    // Try to extract transaction hash from response
    const responseData = data as Record<string, unknown>;
    const txHashFromResponse =
      (responseData.transactionHash as string) ||
      (responseData.txHash as string) ||
      (responseData.signature as string) ||
      ((responseData.data as Record<string, unknown>)?.transactionHash as string);

    const finalTxHash = txHashFromResponse || txHash;
    console.log('[x402Client] Final transaction hash:', finalTxHash);

    return { success: true, data, txHash: finalTxHash };
  } catch (error) {
    console.error('[x402Client] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
