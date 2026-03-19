/**
 * Solana Agent Kit - Token Swaps via Jupiter
 * Allows AI agents to swap tokens using Jupiter aggregator
 */

const { Connection, VersionedTransaction, PublicKey } = require('@solana/web3.js');

const JUPITER_API = 'https://quote-api.jup.ag/v6';

// Common token mints
const TOKENS = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  WIF: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  PYTH: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3'
};

class Swapper {
  constructor(wallet) {
    this.wallet = wallet;
  }

  /**
   * Resolve token symbol or mint address to mint address
   */
  resolveMint(tokenOrMint) {
    if (TOKENS[tokenOrMint.toUpperCase()]) {
      return TOKENS[tokenOrMint.toUpperCase()];
    }
    // Assume it's already a mint address
    return tokenOrMint;
  }

  /**
   * Get a quote for a swap
   */
  async getQuote(inputMint, outputMint, amount, slippageBps = 50) {
    const inputMintAddr = this.resolveMint(inputMint);
    const outputMintAddr = this.resolveMint(outputMint);

    const params = new URLSearchParams({
      inputMint: inputMintAddr,
      outputMint: outputMintAddr,
      amount: amount.toString(),
      slippageBps: slippageBps.toString()
    });

    const response = await fetch(`${JUPITER_API}/quote?${params}`);
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Quote failed: ${error}`);
    }

    const quote = await response.json();
    return {
      inputMint: inputMintAddr,
      outputMint: outputMintAddr,
      inAmount: quote.inAmount,
      outAmount: quote.outAmount,
      priceImpactPct: quote.priceImpactPct,
      routePlan: quote.routePlan,
      raw: quote
    };
  }

  /**
   * Execute a swap
   */
  async swap(inputMint, outputMint, amount, slippageBps = 50) {
    // Get quote first
    const quote = await this.getQuote(inputMint, outputMint, amount, slippageBps);

    // Get swap transaction
    const swapResponse = await fetch(`${JUPITER_API}/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: quote.raw,
        userPublicKey: this.wallet.address,
        wrapAndUnwrapSol: true
      })
    });

    if (!swapResponse.ok) {
      const error = await swapResponse.text();
      throw new Error(`Swap transaction failed: ${error}`);
    }

    const { swapTransaction } = await swapResponse.json();

    // Deserialize and sign
    const txBuffer = Buffer.from(swapTransaction, 'base64');
    const transaction = VersionedTransaction.deserialize(txBuffer);
    transaction.sign([this.wallet.keypair]);

    // Send transaction
    const signature = await this.wallet.connection.sendTransaction(transaction, {
      maxRetries: 3,
      skipPreflight: false
    });

    // Confirm
    const confirmation = await this.wallet.connection.confirmTransaction(signature, 'confirmed');
    
    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    return {
      signature,
      inputMint: quote.inputMint,
      outputMint: quote.outputMint,
      inAmount: quote.inAmount,
      outAmount: quote.outAmount,
      explorerUrl: `https://solscan.io/tx/${signature}`
    };
  }

  /**
   * Get price of a token in USDC
   */
  async getPrice(tokenMint) {
    const mint = this.resolveMint(tokenMint);
    
    // Get quote for 1 token worth to USDC
    const decimals = mint === TOKENS.SOL ? 9 : 6; // Assume 6 for most tokens
    const amount = Math.pow(10, decimals);
    
    try {
      const quote = await this.getQuote(mint, 'USDC', amount.toString());
      const price = Number(quote.outAmount) / 1e6; // USDC has 6 decimals
      return price;
    } catch (e) {
      throw new Error(`Could not get price for ${tokenMint}: ${e.message}`);
    }
  }
}

module.exports = { Swapper, TOKENS };
