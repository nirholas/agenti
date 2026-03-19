/**
 * Reward Transfer Service
 *
 * Executes SPL token transfers from the rewards wallet to user claim wallets.
 * The rewards wallet holds $OPEN tokens and pays for transaction fees.
 *
 * Required environment variables:
 * - REWARDS_WALLET_PRIVATE_KEY: Base58 encoded private key
 * - OPEN_TOKEN_MINT: $OPEN SPL token mint address on Solana
 * - SOLANA_RPC_URL: Solana RPC endpoint (defaults to mainnet-beta)
 */

export interface RewardTransferResult {
  success: boolean;
  signature?: string;
  error?: string;
}

/**
 * Execute SPL token transfer from rewards wallet to recipient
 *
 * The rewards wallet is both the token holder AND the fee payer.
 * This is different from gasless refunds where facilitator pays fees.
 *
 * @param params.recipientAddress - User's claim wallet (Solana address)
 * @param params.amount - Token amount in atomic units (9 decimals for $OPEN)
 * @returns Result with signature on success or error message on failure
 */
export async function executeRewardTransfer(params: {
  recipientAddress: string;
  amount: string;
}): Promise<RewardTransferResult> {
  // 1. Load and validate environment variables
  const privateKey = process.env.REWARDS_WALLET_PRIVATE_KEY;
  const tokenMint = process.env.OPEN_TOKEN_MINT;
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

  if (!privateKey) {
    console.error('[RewardTransfer] Missing REWARDS_WALLET_PRIVATE_KEY');
    return {
      success: false,
      error: 'Rewards wallet not configured (missing REWARDS_WALLET_PRIVATE_KEY)',
    };
  }

  if (!tokenMint) {
    console.error('[RewardTransfer] Missing OPEN_TOKEN_MINT');
    return {
      success: false,
      error: 'Token mint not configured (missing OPEN_TOKEN_MINT)',
    };
  }

  // 2. Import Solana libraries (dynamic import for tree-shaking)
  const {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
  } = await import('@solana/web3.js');
  const {
    getAssociatedTokenAddress,
    createTransferInstruction,
    getAccount,
    createAssociatedTokenAccountInstruction,
  } = await import('@solana/spl-token');
  const bs58 = await import('bs58');

  // 3. Create connection and keypairs
  const connection = new Connection(rpcUrl, 'confirmed');

  let rewardsKeypair: InstanceType<typeof Keypair>;
  try {
    rewardsKeypair = Keypair.fromSecretKey(bs58.default.decode(privateKey));
  } catch (error) {
    console.error('[RewardTransfer] Invalid private key format:', error);
    return {
      success: false,
      error: 'Invalid rewards wallet private key format',
    };
  }

  let recipientPubkey: InstanceType<typeof PublicKey>;
  try {
    recipientPubkey = new PublicKey(params.recipientAddress);
  } catch (error) {
    console.error('[RewardTransfer] Invalid recipient address:', error);
    return {
      success: false,
      error: 'Invalid recipient address format',
    };
  }

  const mintPubkey = new PublicKey(tokenMint);

  console.log('[RewardTransfer] Creating transfer:', {
    from: rewardsKeypair.publicKey.toBase58(),
    to: params.recipientAddress,
    amount: params.amount,
    token: tokenMint,
  });

  try {
    // 4. Get Associated Token Accounts (ATAs)
    const senderAta = await getAssociatedTokenAddress(mintPubkey, rewardsKeypair.publicKey);
    const recipientAta = await getAssociatedTokenAddress(mintPubkey, recipientPubkey);

    // 5. Build transaction
    const transaction = new Transaction();

    // Check if recipient ATA exists, create if not (rewards wallet pays for creation)
    try {
      await getAccount(connection, recipientAta);
      console.log('[RewardTransfer] Recipient ATA exists');
    } catch {
      // ATA doesn't exist, add instruction to create it
      // Rewards wallet pays for the account creation (~0.002 SOL)
      console.log('[RewardTransfer] Creating recipient ATA...');
      transaction.add(
        createAssociatedTokenAccountInstruction(
          rewardsKeypair.publicKey, // Payer for account creation
          recipientAta,
          recipientPubkey,
          mintPubkey
        )
      );
    }

    // Add transfer instruction
    // Note: $OPEN uses 9 decimals, amount should already be in atomic units
    transaction.add(
      createTransferInstruction(
        senderAta,
        recipientAta,
        rewardsKeypair.publicKey, // Authority is the rewards wallet
        BigInt(params.amount)
      )
    );

    // 6. Get recent blockhash and set fee payer
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = rewardsKeypair.publicKey;

    // Sign with rewards wallet (single signer - both token holder and fee payer)
    transaction.sign(rewardsKeypair);

    console.log('[RewardTransfer] Sending transaction...');

    // 7. Send and confirm
    const signature = await connection.sendRawTransaction(transaction.serialize());
    await connection.confirmTransaction(signature, 'confirmed');

    console.log('[RewardTransfer] Success! TX:', signature);
    return {
      success: true,
      signature,
    };
  } catch (error) {
    console.error('[RewardTransfer] Error:', error);

    // Provide specific error messages for common issues
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('insufficient funds') || errorMessage.includes('0x1')) {
      return {
        success: false,
        error: 'Rewards wallet has insufficient SOL for transaction fees',
      };
    }

    if (errorMessage.includes('insufficient lamports') || errorMessage.includes('InsufficientFunds')) {
      return {
        success: false,
        error: 'Rewards wallet has insufficient $OPEN token balance',
      };
    }

    if (errorMessage.includes('TokenAccountNotFoundError')) {
      return {
        success: false,
        error: 'Rewards wallet token account not found - ensure wallet has $OPEN tokens',
      };
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}
