const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6'

export interface JupiterQuote {
  inputMint: string
  outputMint: string
  inAmount: string
  outAmount: string
  otherAmountThreshold: string
  swapMode: string
  slippageBps: number
  priceImpactPct: string
  routePlan: Array<{
    swapInfo: {
      ammKey: string
      label: string
      inputMint: string
      outputMint: string
      inAmount: string
      outAmount: string
      feeAmount: string
      feeMint: string
    }
    percent: number
  }>
}

export interface JupiterQuoteParams {
  inputMint: string
  outputMint: string
  /** Amount in smallest unit (lamports for SOL, atomic units for SPL tokens) */
  amount: bigint | number
  slippageBps?: number
  /** Restrict to specific AMMs by label */
  dexes?: string[]
  onlyDirectRoutes?: boolean
}

export interface JupiterSwapResult {
  signature: string
  explorerUrl: string
  inputAmount: string
  outputAmount: string
  priceImpactPct: string
}

/**
 * Get a swap quote from Jupiter v6.
 * No wallet needed — read-only price discovery.
 */
export async function getJupiterQuote(params: JupiterQuoteParams): Promise<JupiterQuote> {
  const qs = new URLSearchParams({
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount: params.amount.toString(),
    slippageBps: String(params.slippageBps ?? 50),
  })
  if (params.onlyDirectRoutes) qs.set('onlyDirectRoutes', 'true')
  if (params.dexes?.length) qs.set('dexes', params.dexes.join(','))

  const res = await fetch(`${JUPITER_QUOTE_API}/quote?${qs}`)
  if (!res.ok) throw new Error(`Jupiter quote API ${res.status}: ${await res.text()}`)
  return res.json() as Promise<JupiterQuote>
}

/**
 * Execute a swap via Jupiter v6 using a pre-fetched quote.
 * Signs and sends the transaction with the provided keypair.
 */
export async function executeJupiterSwap(
  quote: JupiterQuote,
  userPublicKey: string,
  signAndSend: (txBase64: string) => Promise<string>
): Promise<JupiterSwapResult> {
  const res = await fetch(`${JUPITER_QUOTE_API}/swap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: 'auto',
    }),
  })

  if (!res.ok) throw new Error(`Jupiter swap API ${res.status}: ${await res.text()}`)
  const { swapTransaction } = (await res.json()) as { swapTransaction: string }

  const signature = await signAndSend(swapTransaction)

  return {
    signature,
    explorerUrl: `https://solscan.io/tx/${signature}`,
    inputAmount: quote.inAmount,
    outputAmount: quote.outAmount,
    priceImpactPct: quote.priceImpactPct,
  }
}

/**
 * Convenience: quote + swap in one call. Uses Keypair to sign.
 */
export async function jupiterSwap(params: {
  inputMint: string
  outputMint: string
  /** Human-readable amount (e.g. 0.1 for 0.1 SOL) */
  amount: number
  /** Decimals of input token (9 for SOL, 6 for USDC) */
  inputDecimals?: number
  slippageBps?: number
  keypair: import('@solana/web3.js').Keypair
  connection: import('@solana/web3.js').Connection
}): Promise<JupiterSwapResult> {
  const { Connection: _C, Transaction, VersionedTransaction } = await import('@solana/web3.js')

  const decimals = params.inputDecimals ?? 9
  const rawAmount = BigInt(Math.round(params.amount * 10 ** decimals))

  const quote = await getJupiterQuote({
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount: rawAmount,
    slippageBps: params.slippageBps ?? 50,
  })

  return executeJupiterSwap(quote, params.keypair.publicKey.toBase58(), async (txBase64) => {
    const txBuf = Buffer.from(txBase64, 'base64')

    // Jupiter v6 returns versioned transactions
    let signature: string
    try {
      const vtx = VersionedTransaction.deserialize(txBuf)
      vtx.sign([params.keypair])
      signature = await params.connection.sendRawTransaction(vtx.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      })
    } catch {
      // fallback to legacy tx
      const tx = Transaction.from(txBuf)
      tx.sign(params.keypair)
      signature = await params.connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      })
    }

    const latest = await params.connection.getLatestBlockhash('confirmed')
    await params.connection.confirmTransaction(
      { signature, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight },
      'confirmed'
    )
    return signature
  })
}
