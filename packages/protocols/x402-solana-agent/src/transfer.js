/**
 * Solana Agent Kit - Transfer Module
 * Send SOL and SPL tokens
 */

const { 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction
} = require('@solana/web3.js');
const { 
  getAssociatedTokenAddress, 
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} = require('@solana/spl-token');

class Transfer {
  constructor(wallet) {
    this.wallet = wallet;
  }

  /**
   * Send SOL to an address
   */
  async sendSol(toAddress, amountSol) {
    const toPubkey = new PublicKey(toAddress);
    const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.wallet.keypair.publicKey,
        toPubkey: toPubkey,
        lamports: lamports
      })
    );

    const signature = await sendAndConfirmTransaction(
      this.wallet.connection,
      transaction,
      [this.wallet.keypair]
    );

    return {
      signature,
      from: this.wallet.address,
      to: toAddress,
      amount: amountSol,
      unit: 'SOL',
      explorerUrl: `https://solscan.io/tx/${signature}`
    };
  }

  /**
   * Send SPL token to an address
   */
  async sendToken(toAddress, amount, mintAddress) {
    const toPubkey = new PublicKey(toAddress);
    const mintPubkey = new PublicKey(mintAddress);

    // Get source ATA
    const sourceAta = await getAssociatedTokenAddress(
      mintPubkey,
      this.wallet.keypair.publicKey
    );

    // Get destination ATA
    const destAta = await getAssociatedTokenAddress(
      mintPubkey,
      toPubkey
    );

    const transaction = new Transaction();

    // Check if destination ATA exists, create if not
    try {
      await getAccount(this.wallet.connection, destAta);
    } catch (e) {
      if (e.name === 'TokenAccountNotFoundError') {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            this.wallet.keypair.publicKey, // payer
            destAta, // ata
            toPubkey, // owner
            mintPubkey // mint
          )
        );
      } else {
        throw e;
      }
    }

    // Add transfer instruction
    transaction.add(
      createTransferInstruction(
        sourceAta,
        destAta,
        this.wallet.keypair.publicKey,
        BigInt(amount)
      )
    );

    const signature = await sendAndConfirmTransaction(
      this.wallet.connection,
      transaction,
      [this.wallet.keypair]
    );

    return {
      signature,
      from: this.wallet.address,
      to: toAddress,
      amount: amount.toString(),
      mint: mintAddress,
      explorerUrl: `https://solscan.io/tx/${signature}`
    };
  }
}

module.exports = { Transfer };
