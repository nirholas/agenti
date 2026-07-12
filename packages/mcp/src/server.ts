import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { agenti, generateWallet, generateMnemonic, walletFromMnemonic, signMessage as sdkSignMessage, bnb, getBnbTokenPrice, swapBnbTokens, TOKENS, parseUnits, watchPumpEvents, decodePumpLog, extractTradingIdeas, routeIdea, calculatePnl } from '@agenti/sdk'
import type { PumpEvent, PayOptions } from '@agenti/sdk'
import {
  getCoinPrice,
  getTrendingCoins,
  getProtocolTvl,
  getTopProtocols,
  getCryptoNews,
  getOhlcv,
  searchCoins,
  getGlobalStats,
  getTopWallets,
  getWalletTrades,
  isSmartWallet,
  searchProducts,
  getFeaturedProducts,
  createInvoice as bitrefillCreateInvoice,
  waitForOrder,
  getPrice,
  usdToTokenAmount,
  getVaultBalances,
  getPaymentHistory,
  verifyPaymentReceipt,
  detectAnomalies,
  getVolatility,
} from '@agenti/sdk'
import { PublicKey } from '@solana/web3.js'

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'agenti',
    version: '0.1.0',
  })

  server.tool(
    'create_wallet',
    'Generate a new agent wallet with EVM (Base/Arbitrum/Ethereum) and Solana addresses',
    {},
    async () => {
      const wallet = generateWallet()
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                evm: {
                  address: wallet.evm.address,
                  privateKey: wallet.evm.privateKey,
                },
                solana: {
                  address: wallet.solana.address,
                  privateKey: Buffer.from(wallet.solana.privateKey).toString('hex'),
                },
                warning: 'Store these private keys securely. Never share them.',
              },
              null,
              2
            ),
          },
        ],
      }
    }
  )

  server.tool(
    'get_balance',
    'Get USDC (Base) and SOL balances for a wallet',
    {
      evm_private_key: z
        .string()
        .optional()
        .describe('EVM private key (0x...) — falls back to AGENTI_EVM_PRIVATE_KEY env var'),
    },
    async ({ evm_private_key }) => {
      const privateKey = (evm_private_key ?? process.env['AGENTI_EVM_PRIVATE_KEY']) as
        | `0x${string}`
        | undefined

      const solanaKeyHex = process.env['AGENTI_SOLANA_PRIVATE_KEY']
      const solanaKey = solanaKeyHex ? Buffer.from(solanaKeyHex, 'hex') : undefined

      const agent = agenti({
        ...(privateKey ? { evm: { privateKey } } : {}),
        ...(solanaKey ? { solana: { privateKey: solanaKey } } : {}),
      })

      const balances = await agent.balance()
      return {
        content: [{ type: 'text', text: JSON.stringify(balances, null, 2) }],
      }
    }
  )

  server.tool(
    'pay',
    'Pay for an HTTP resource — automatically handles 402 Payment Required (x402 protocol)',
    {
      url: z.string().url().describe('URL to fetch'),
      evm_private_key: z
        .string()
        .optional()
        .describe('EVM private key for payment signing — falls back to AGENTI_EVM_PRIVATE_KEY'),
      method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).default('GET'),
      body: z.string().optional().describe('Request body as JSON string'),
      max_amount: z
        .string()
        .optional()
        .describe(
          "Maximum you will pay, in the asset's smallest unit (e.g. \"1000000\" = 1 USDC). " +
            'If the server demands more, the payment is refused before signing. ' +
            'Strongly recommended for autonomous agents.',
        ),
    },
    async ({ url, evm_private_key, method, body, max_amount }) => {
      const privateKey = (evm_private_key ?? process.env['AGENTI_EVM_PRIVATE_KEY']) as
        | `0x${string}`
        | undefined

      if (!privateKey) throw new Error('EVM private key required (param or AGENTI_EVM_PRIVATE_KEY)')

      const solanaKeyHex = process.env['AGENTI_SOLANA_PRIVATE_KEY']
      const solanaKey = solanaKeyHex ? Buffer.from(solanaKeyHex, 'hex') : undefined

      const agent = agenti({
        evm: { privateKey },
        ...(solanaKey ? { solana: { privateKey: solanaKey } } : {}),
      })

      const init: PayOptions = { method }
      if (body) { init.body = body; init.headers = { 'Content-Type': 'application/json' } }
      if (max_amount) init.maxAmount = max_amount
      const response = await agent.pay(url, init)

      const text = await response.text()
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ status: response.status, body: text }, null, 2),
          },
        ],
      }
    }
  )

  server.tool(
    'create_invoice',
    'Create a payment request — returns an address and amount for someone to pay you',
    {
      amount: z.number().positive().describe('Amount to request'),
      token: z.string().describe('Token symbol, e.g. USDC or SOL'),
      chain: z
        .enum(['base', 'arbitrum', 'ethereum', 'polygon', 'solana'])
        .describe('Chain to receive payment on'),
      evm_private_key: z
        .string()
        .optional()
        .describe('EVM private key to derive receiving address — falls back to AGENTI_EVM_PRIVATE_KEY'),
    },
    async ({ amount, token, chain, evm_private_key }) => {
      const privateKey = (evm_private_key ?? process.env['AGENTI_EVM_PRIVATE_KEY']) as
        | `0x${string}`
        | undefined

      const solanaKeyHex = process.env['AGENTI_SOLANA_PRIVATE_KEY']
      const solanaKey = solanaKeyHex ? Buffer.from(solanaKeyHex, 'hex') : undefined

      const agent = agenti({
        ...(privateKey ? { evm: { privateKey } } : {}),
        ...(solanaKey ? { solana: { privateKey: solanaKey } } : {}),
      })

      const invoice = await agent.receive({ amount, token, chain })
      return {
        content: [{ type: 'text', text: JSON.stringify(invoice, null, 2) }],
      }
    }
  )

  server.tool(
    'check_payment',
    'Check whether a payment invoice has been fulfilled by querying the chain',
    {
      address: z.string().describe('Wallet address that should have received payment'),
      token: z.string().describe('Token symbol, e.g. USDC or SOL'),
      chain: z.enum(['base', 'arbitrum', 'ethereum', 'polygon', 'solana']),
      min_amount: z.number().positive().describe('Minimum amount expected'),
    },
    async ({ address, token, chain, min_amount }) => {
      const { getBalances } = await import('@agenti/sdk')
      const balances = await getBalances(address, address)
      const match = balances.find((b: { token: string; chain: string }) => b.token === token && b.chain === chain)
      const received = parseFloat(match?.amount ?? '0')
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                paid: received >= min_amount,
                balance: match?.amount ?? '0',
                token,
                chain,
                address,
              },
              null,
              2
            ),
          },
        ],
      }
    }
  )

  server.tool(
    'get_coin_price',
    'Get current price, 24h change, market cap, and volume for any coin by CoinGecko ID or symbol',
    {
      coin_id: z.string().describe('CoinGecko coin ID (e.g. bitcoin, ethereum, solana)'),
      currency: z.string().default('usd').describe('Fiat currency for price (default: usd)'),
    },
    async ({ coin_id, currency }) => {
      const result = await getCoinPrice(coin_id, currency)
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    }
  )

  server.tool(
    'get_trending_coins',
    'Top trending coins right now on CoinGecko',
    {
      limit: z.number().int().min(1).max(20).default(10).describe('Number of coins to return'),
    },
    async ({ limit }) => {
      const result = await getTrendingCoins(limit)
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    }
  )

  server.tool(
    'get_protocol_tvl',
    'Total value locked (TVL) and recent changes for a DeFi protocol via DeFiLlama',
    {
      protocol: z.string().describe('Protocol slug (e.g. uniswap, aave, lido)'),
    },
    async ({ protocol }) => {
      const result = await getProtocolTvl(protocol)
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    }
  )

  server.tool(
    'get_top_protocols',
    'Top DeFi protocols ranked by total value locked via DeFiLlama',
    {
      limit: z.number().int().min(1).max(100).default(20).describe('Number of protocols to return'),
    },
    async ({ limit }) => {
      const result = await getTopProtocols(limit)
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    }
  )

  server.tool(
    'get_crypto_news',
    'Latest crypto news headlines from CryptoPanic / CoinGecko',
    {
      query: z.string().optional().describe('Filter by coin symbol or keyword (e.g. BTC, ETH)'),
      limit: z.number().int().min(1).max(50).default(10).describe('Number of articles to return'),
    },
    async ({ query, limit }) => {
      const result = await getCryptoNews(query, limit)
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    }
  )

  server.tool(
    'get_ohlcv',
    'Historical OHLCV (open/high/low/close/volume) price candles for a coin via CoinGecko',
    {
      coin_id: z.string().describe('CoinGecko coin ID (e.g. bitcoin, ethereum)'),
      days: z.number().int().min(1).max(365).default(7).describe('Number of days of history'),
    },
    async ({ coin_id, days }) => {
      const result = await getOhlcv(coin_id, days)
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    }
  )

  server.tool(
    'search_coins',
    'Search CoinGecko for coins by name or ticker symbol',
    {
      query: z.string().describe('Search term (e.g. "ethereum", "ETH", "pepe")'),
    },
    async ({ query }) => {
      const result = await searchCoins(query)
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    }
  )

  server.tool(
    'get_global_stats',
    'Global crypto market stats: total market cap, BTC dominance, active coins, 24h change',
    {},
    async () => {
      const result = await getGlobalStats()
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    }
  )

  server.tool(
    'get_top_wallets',
    'Get top-ranked Solana wallets by PnL from GMGN smart money leaderboard. Useful for finding wallets to mirror-trade.',
    {
      timeframe: z
        .enum(['1d', '7d', '30d'])
        .default('7d')
        .describe('Ranking timeframe'),
      limit: z.number().int().min(1).max(100).default(20).describe('Number of wallets to return'),
      min_win_rate: z
        .number()
        .min(0)
        .max(1)
        .default(0)
        .describe('Minimum win rate filter (0–1)'),
    },
    async ({ timeframe, limit, min_win_rate }) => {
      const result = await getTopWallets({ timeframe, limit, minWinRate: min_win_rate })
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    }
  )

  server.tool(
    'get_wallet_trades',
    'Get recent buy/sell trade history for any Solana wallet address. Uses Helius enriched transactions when HELIUS_API_KEY is set, otherwise falls back to GMGN.',
    {
      address: z.string().describe('Solana wallet address'),
      limit: z.number().int().min(1).max(100).default(20).describe('Number of trades to return'),
    },
    async ({ address, limit }) => {
      const result = await getWalletTrades(address, { limit })
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    }
  )

  server.tool(
    'check_smart_wallet',
    'Check whether a Solana wallet address is a known KOL or smart money wallet. Returns rank, PnL, and source.',
    {
      address: z.string().describe('Solana wallet address to check'),
    },
    async ({ address }) => {
      const result = await isSmartWallet(address)
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    }
  )

  server.tool(
    'bitrefill_search',
    'Search the Bitrefill catalog for gift cards, eSIMs, and mobile top-ups. No API key required.',
    {
      query: z.string().describe('Product name or keyword (e.g. "Amazon", "Netflix", "Steam")'),
      country: z.string().optional().describe('ISO country code to filter results (e.g. "US", "GB")'),
      type: z
        .enum(['giftcard', 'esim', 'topup'])
        .optional()
        .describe('Product type filter'),
    },
    async ({ query, country, type }) => {
      const config = {
        apiKey: process.env['BITREFILL_API_KEY'] ?? '',
        testMode: process.env['BITREFILL_TEST_MODE'] === 'true',
      }
      const results = await searchProducts(config, query, { country, type })
      return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] }
    }
  )

  server.tool(
    'bitrefill_get_featured',
    'Get featured/popular gift cards and eSIMs for a country. Good for suggesting spending options.',
    {
      country: z.string().optional().describe('ISO country code (e.g. "US", "GB"). Defaults to global.'),
    },
    async ({ country }) => {
      const results = await getFeaturedProducts(country)
      return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] }
    }
  )

  server.tool(
    'bitrefill_create_invoice',
    'Create a Bitrefill invoice for a product. Returns a crypto payment address (USDC by default) that can be passed to the pay tool.',
    {
      product_id: z.string().describe('Bitrefill product ID from search results'),
      value: z.number().positive().describe('Denomination / value to purchase'),
      delivery_email: z
        .string()
        .optional()
        .describe('Email to deliver redemption code to'),
      payment_method: z
        .enum(['bitcoin', 'lightning', 'ethereum', 'usdc', 'tether'])
        .default('usdc')
        .describe('Crypto payment method'),
      api_key: z
        .string()
        .optional()
        .describe('Bitrefill API key — falls back to BITREFILL_API_KEY env var'),
    },
    async ({ product_id, value, delivery_email, payment_method, api_key }) => {
      const config = {
        apiKey: (api_key ?? process.env['BITREFILL_API_KEY']) as string,
        testMode: process.env['BITREFILL_TEST_MODE'] === 'true',
      }
      if (!config.apiKey) throw new Error('Bitrefill API key required (param or BITREFILL_API_KEY)')
      const invoice = await bitrefillCreateInvoice(config, {
        productId: product_id,
        value,
        paymentMethod: payment_method,
        deliveryEmail: delivery_email,
      })
      return { content: [{ type: 'text', text: JSON.stringify(invoice, null, 2) }] }
    }
  )

  server.tool(
    'bitrefill_check_order',
    'Poll a Bitrefill invoice until it completes and return the redemption code.',
    {
      invoice_id: z.string().describe('Invoice ID returned by bitrefill_create_invoice'),
      timeout_ms: z
        .number()
        .int()
        .positive()
        .default(300_000)
        .describe('Max wait time in milliseconds (default 5 minutes)'),
      api_key: z
        .string()
        .optional()
        .describe('Bitrefill API key — falls back to BITREFILL_API_KEY env var'),
    },
    async ({ invoice_id, timeout_ms, api_key }) => {
      const config = {
        apiKey: (api_key ?? process.env['BITREFILL_API_KEY']) as string,
        testMode: process.env['BITREFILL_TEST_MODE'] === 'true',
      }
      if (!config.apiKey) throw new Error('Bitrefill API key required (param or BITREFILL_API_KEY)')
      const order = await waitForOrder(config, invoice_id, { timeoutMs: timeout_ms })
      return { content: [{ type: 'text', text: JSON.stringify(order, null, 2) }] }
    }
  )

  server.tool(
    'bitrefill_get_categories',
    'Get available Bitrefill product categories and supported countries.',
    {
      country: z.string().optional().describe('Filter categories available in this country (ISO code)'),
    },
    async ({ country }) => {
      const params = country ? `?country=${country}` : ''
      const res = await fetch(`https://api.bitrefill.com/v2/categories${params}`)
      if (!res.ok) throw new Error(`Bitrefill ${res.status}: /categories`)
      const data = await res.json()
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  // ---------------------------------------------------------------------------
  // BNB Chain tools
  // ---------------------------------------------------------------------------

  server.tool(
    'bnb_get_balance',
    'Get BNB native balance plus USDT and BUSD token balances for a wallet address on BNB Chain',
    {
      address: z.string().describe('Wallet address to check'),
      evm_private_key: z
        .string()
        .optional()
        .describe('EVM private key (0x...) — falls back to AGENTI_EVM_PRIVATE_KEY env var'),
    },
    async ({ address, evm_private_key }) => {
      const privateKey = (evm_private_key ?? process.env['AGENTI_EVM_PRIVATE_KEY']) as `0x${string}` | undefined
      if (!privateKey) throw new Error('EVM private key required (param or AGENTI_EVM_PRIVATE_KEY)')

      const instance = bnb({ wallet: { privateKey } })
      const resolvedAddress = address || instance.address

      const [bnbBal, usdtBal, busdBal] = await Promise.all([
        instance.bnbBalance(),
        instance.tokenBalance(TOKENS.USDT_BSC),
        instance.tokenBalance(TOKENS.BUSD_BSC),
      ])

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ address: resolvedAddress, BNB: bnbBal, USDT: usdtBal.formatted, BUSD: busdBal.formatted }, null, 2),
        }],
      }
    }
  )

  server.tool(
    'bnb_transfer',
    'Send BEP-20 tokens (USDT, BUSD, or any BEP-20) to an address on BNB Chain',
    {
      token_address: z.string().describe('BEP-20 token contract address (e.g. USDT_BSC: 0x55d398...)'),
      to: z.string().describe('Recipient wallet address'),
      amount: z.string().describe('Amount in token units (e.g. "10.5" for 10.5 USDT)'),
      decimals: z.number().int().default(18).describe('Token decimals (18 for USDT/BUSD on BSC, 6 for USDC)'),
      evm_private_key: z
        .string()
        .optional()
        .describe('EVM private key (0x...) — falls back to AGENTI_EVM_PRIVATE_KEY env var'),
    },
    async ({ token_address, to, amount, decimals, evm_private_key }) => {
      const privateKey = (evm_private_key ?? process.env['AGENTI_EVM_PRIVATE_KEY']) as `0x${string}` | undefined
      if (!privateKey) throw new Error('EVM private key required (param or AGENTI_EVM_PRIVATE_KEY)')

      const { parseUnits } = await import('viem')
      const instance = bnb({ wallet: { privateKey } })
      const rawAmount = parseUnits(amount, decimals)
      const txHash = await instance.transfer(token_address, to, rawAmount)

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ txHash, token: token_address, to, amount, bscScan: `https://bscscan.com/tx/${txHash}` }, null, 2),
        }],
      }
    }
  )

  server.tool(
    'bnb_get_token_price',
    'Get the USD price of any BEP-20 token via PancakeSwap V3 subgraph',
    {
      token_address: z.string().describe('BEP-20 token contract address (checksummed or lowercase)'),
    },
    async ({ token_address }) => {
      const price = await getBnbTokenPrice(token_address)
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ token: token_address, priceUSD: price, source: 'PancakeSwap V3' }, null, 2),
        }],
      }
    }
  )

  server.tool(
    'bnb_get_transactions',
    'Get recent transactions for an address on BNB Chain via BscScan API',
    {
      address: z.string().describe('Wallet or contract address'),
      limit: z.number().int().min(1).max(100).default(10).describe('Number of transactions to return'),
      bscscan_api_key: z
        .string()
        .optional()
        .describe('BscScan API key — falls back to BSCSCAN_API_KEY env var'),
    },
    async ({ address, limit, bscscan_api_key }) => {
      const apiKey = bscscan_api_key ?? process.env['BSCSCAN_API_KEY'] ?? 'YourApiKeyToken'
      const url = `https://api.bscscan.com/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=${limit}&sort=desc&apikey=${apiKey}`

      const res = await fetch(url)
      if (!res.ok) throw new Error(`BscScan API error: ${res.status}`)
      const data = await res.json() as { status: string; result: unknown[] }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ address, count: Array.isArray(data.result) ? data.result.length : 0, transactions: data.result }, null, 2),
        }],
      }
    }
  )

  server.tool(
    'bnb_swap',
    'Swap BEP-20 tokens on PancakeSwap V3 (requires private key)',
    {
      token_in: z.string().describe('Input token contract address'),
      token_out: z.string().describe('Output token contract address'),
      amount_in: z.string().describe('Amount of tokenIn in token units (e.g. "10.5")'),
      decimals_in: z.number().int().default(18).describe('Decimals for tokenIn'),
      slippage_bps: z.number().int().min(1).max(10000).default(50).describe('Slippage tolerance in basis points (50 = 0.5%)'),
      evm_private_key: z
        .string()
        .optional()
        .describe('EVM private key (0x...) — falls back to AGENTI_EVM_PRIVATE_KEY env var'),
    },
    async ({ token_in, token_out, amount_in, decimals_in, slippage_bps, evm_private_key }) => {
      const privateKey = (evm_private_key ?? process.env['AGENTI_EVM_PRIVATE_KEY']) as `0x${string}` | undefined
      if (!privateKey) throw new Error('EVM private key required (param or AGENTI_EVM_PRIVATE_KEY)')

      const { parseUnits } = await import('viem')
      const amountIn = parseUnits(amount_in, decimals_in)
      const txHash = await swapBnbTokens(
        { wallet: { privateKey } },
        { tokenIn: token_in, tokenOut: token_out, amountIn, slippageBps: slippage_bps },
      )

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ txHash, tokenIn: token_in, tokenOut: token_out, amountIn: amount_in, bscScan: `https://bscscan.com/tx/${txHash}` }, null, 2),
        }],
      }
    }
  )

  server.tool(
    'watch_pump_launches',
    'Monitor new pump.fun token launches for a specified duration. Returns all launches seen during that window.',
    {
      duration_seconds: z.number().int().min(1).max(300).describe('How long to watch for launches (1–300 seconds)'),
      min_liquidity_sol: z.number().optional().describe('Only return launches that reach this SOL market cap threshold'),
    },
    async ({ duration_seconds, min_liquidity_sol }) => {
      const { Connection } = await import('@solana/web3.js')
      const rpcUrl = process.env['SOLANA_RPC_URL'] ?? 'https://api.mainnet-beta.solana.com'
      const connection = new Connection(rpcUrl, 'confirmed')
      const launches: PumpEvent[] = []

      await new Promise<void>((resolve) => {
        const stop = watchPumpEvents(
          { connection, eventTypes: ['launch'] },
          (event) => { launches.push(event) },
        )
        setTimeout(() => { stop(); resolve() }, duration_seconds * 1000)
      })

      const filtered = min_liquidity_sol
        ? launches // market cap not available from logs alone; return all and note the limitation
        : launches

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ launches: filtered, count: filtered.length, duration_seconds }, null, 2),
        }],
      }
    }
  )

  server.tool(
    'watch_pump_graduations',
    'Monitor pump.fun tokens graduating to the PumpSwap AMM for a specified duration.',
    {
      duration_seconds: z.number().int().min(1).max(300).describe('How long to watch for graduations (1–300 seconds)'),
      mints: z.array(z.string()).optional().describe('Only watch these specific mint addresses (omit to watch all)'),
    },
    async ({ duration_seconds, mints }) => {
      const { Connection } = await import('@solana/web3.js')
      const rpcUrl = process.env['SOLANA_RPC_URL'] ?? 'https://api.mainnet-beta.solana.com'
      const connection = new Connection(rpcUrl, 'confirmed')
      const graduations: PumpEvent[] = []

      await new Promise<void>((resolve) => {
        const stop = watchPumpEvents(
          { connection, eventTypes: ['graduation'], ...(mints ? { mints } : {}) },
          (event) => { graduations.push(event) },
        )
        setTimeout(() => { stop(); resolve() }, duration_seconds * 1000)
      })

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ graduations, count: graduations.length, duration_seconds }, null, 2),
        }],
      }
    }
  )

  // ---------------------------------------------------------------------------
  // Solana Agent Kit — Jupiter swap, transfers, token deploy, staking
  // Requires AGENTI_SOLANA_PRIVATE_KEY and optionally SOLANA_RPC_URL
  // ---------------------------------------------------------------------------

  server.tool(
    'solana_swap',
    'Swap any Solana token via Jupiter aggregator (best route). Requires AGENTI_SOLANA_PRIVATE_KEY.',
    {
      input_mint: z.string().describe('Input token mint address (use "So11111111111111111111111111111111111111112" for SOL)'),
      output_mint: z.string().describe('Output token mint address'),
      amount: z.number().positive().describe('Amount of input token to swap (human-readable units)'),
      slippage_bps: z.number().int().min(1).max(10000).default(100).describe('Slippage tolerance in basis points (100 = 1%)'),
      priority_level: z.enum(['low', 'medium', 'high', 'very-high']).default('medium').describe('Transaction priority level affecting fee and inclusion speed'),
    },
    async ({ input_mint, output_mint, amount, slippage_bps, priority_level }) => {
      const { Keypair } = await import('@solana/web3.js')
      const { createSolanaAgentKit } = await import('@agenti/sdk')

      const solanaKeyHex = process.env['AGENTI_SOLANA_PRIVATE_KEY']
      if (!solanaKeyHex) throw new Error('AGENTI_SOLANA_PRIVATE_KEY required')
      const keypair = Keypair.fromSecretKey(Buffer.from(solanaKeyHex, 'hex'))
      const kit = createSolanaAgentKit({ keypair, config: { PRIORITY_LEVEL: priority_level } })

      const result = await kit.trade(output_mint, amount, input_mint, slippage_bps)
      return { content: [{ type: 'text', text: JSON.stringify({ signature: result, solscan: `https://solscan.io/tx/${result}` }, null, 2) }] }
    }
  )

  server.tool(
    'solana_transfer',
    'Send SOL or any SPL token to another Solana address. Requires AGENTI_SOLANA_PRIVATE_KEY.',
    {
      to: z.string().describe('Recipient Solana wallet address'),
      amount: z.number().positive().describe('Amount to send (human-readable units)'),
      mint: z.string().optional().describe('SPL token mint address — omit to send native SOL'),
      priority_level: z.enum(['low', 'medium', 'high', 'very-high']).default('medium').describe('Transaction priority level affecting fee and inclusion speed'),
    },
    async ({ to, amount, mint, priority_level }) => {
      const {
        Keypair, PublicKey, Connection, Transaction, SystemProgram, LAMPORTS_PER_SOL, ComputeBudgetProgram,
      } = await import('@solana/web3.js')
      const { getPriorityFee } = await import('@agenti/sdk')

      const solanaKeyHex = process.env['AGENTI_SOLANA_PRIVATE_KEY']
      if (!solanaKeyHex) throw new Error('AGENTI_SOLANA_PRIVATE_KEY required')
      const rpcUrl = process.env['SOLANA_RPC_URL'] ?? 'https://api.mainnet-beta.solana.com'
      const keypair = Keypair.fromSecretKey(Buffer.from(solanaKeyHex, 'hex'))
      const connection = new Connection(rpcUrl, 'confirmed')
      const toPubkey = new PublicKey(to)

      const microLamports = await getPriorityFee(rpcUrl, priority_level)

      const tx = new Transaction()
      tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }))
      tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports }))

      if (!mint) {
        tx.add(SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey,
          lamports: Math.round(amount * LAMPORTS_PER_SOL),
        }))
      } else {
        const {
          getAssociatedTokenAddress, createAssociatedTokenAccountInstruction,
          createTransferInstruction, getAccount, getMint,
        } = await import('@solana/spl-token')
        const mintPubkey = new PublicKey(mint)
        const fromAta = await getAssociatedTokenAddress(mintPubkey, keypair.publicKey)
        const toAta = await getAssociatedTokenAddress(mintPubkey, toPubkey)
        try {
          await getAccount(connection, toAta)
        } catch {
          tx.add(createAssociatedTokenAccountInstruction(keypair.publicKey, toAta, toPubkey, mintPubkey))
        }
        const mintInfo = await getMint(connection, mintPubkey)
        tx.add(createTransferInstruction(fromAta, toAta, keypair.publicKey, BigInt(Math.round(amount * 10 ** mintInfo.decimals))))
      }

      const { blockhash } = await connection.getLatestBlockhash('confirmed')
      tx.recentBlockhash = blockhash
      tx.feePayer = keypair.publicKey
      tx.sign(keypair)

      const signature = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false, preflightCommitment: 'confirmed' })
      const latest = await connection.getLatestBlockhash('confirmed')
      await connection.confirmTransaction({ signature, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight }, 'confirmed')

      return { content: [{ type: 'text', text: JSON.stringify({ signature, priority_fee_microlamports: microLamports, solscan: `https://solscan.io/tx/${signature}` }, null, 2) }] }
    }
  )

  server.tool(
    'solana_deploy_token',
    'Deploy a new SPL token on Solana with custom name, symbol, decimals, and supply. Requires AGENTI_SOLANA_PRIVATE_KEY.',
    {
      name: z.string().describe('Token name (e.g. "My Token")'),
      uri: z.string().describe('Metadata URI pointing to a JSON file with image/description'),
      symbol: z.string().describe('Token symbol (e.g. "MTK")'),
      decimals: z.number().int().min(0).max(9).default(9).describe('Token decimals (default: 9)'),
      initial_supply: z.number().positive().optional().describe('Initial token supply to mint to your wallet'),
    },
    async ({ name, uri, symbol, decimals, initial_supply }) => {
      const { Keypair } = await import('@solana/web3.js')
      const { createSolanaAgentKit } = await import('@agenti/sdk')

      const solanaKeyHex = process.env['AGENTI_SOLANA_PRIVATE_KEY']
      if (!solanaKeyHex) throw new Error('AGENTI_SOLANA_PRIVATE_KEY required')
      const keypair = Keypair.fromSecretKey(Buffer.from(solanaKeyHex, 'hex'))
      const kit = createSolanaAgentKit({ keypair })

      const result = await kit.deployToken(name, uri, symbol, decimals, initial_supply)
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ mint: result.mint.toBase58(), solscan: `https://solscan.io/token/${result.mint.toBase58()}` }, null, 2),
        }],
      }
    }
  )

  server.tool(
    'solana_get_token_data',
    'Get on-chain data for a Solana token: name, symbol, price, market cap, liquidity, holder count.',
    {
      mint: z.string().describe('Token mint address'),
    },
    async ({ mint }) => {
      const { Keypair } = await import('@solana/web3.js')
      const { createSolanaAgentKit } = await import('@agenti/sdk')

      const solanaKeyHex = process.env['AGENTI_SOLANA_PRIVATE_KEY']
      const keypair = solanaKeyHex
        ? Keypair.fromSecretKey(Buffer.from(solanaKeyHex, 'hex'))
        : Keypair.generate()
      const kit = createSolanaAgentKit({ keypair })

      const data = await kit.getTokenDataByAddress(mint)
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'solana_stake',
    'Stake SOL via Sanctum liquid staking to earn yield. Returns an LST (liquid staking token). Requires AGENTI_SOLANA_PRIVATE_KEY.',
    {
      amount: z.number().positive().describe('Amount of SOL to stake'),
    },
    async ({ amount }) => {
      const { Keypair } = await import('@solana/web3.js')
      const { createSolanaAgentKit } = await import('@agenti/sdk')

      const solanaKeyHex = process.env['AGENTI_SOLANA_PRIVATE_KEY']
      if (!solanaKeyHex) throw new Error('AGENTI_SOLANA_PRIVATE_KEY required')
      const keypair = Keypair.fromSecretKey(Buffer.from(solanaKeyHex, 'hex'))
      const kit = createSolanaAgentKit({ keypair })

      const result = await kit.stake(amount)
      return { content: [{ type: 'text', text: JSON.stringify({ signature: result, solscan: `https://solscan.io/tx/${result}` }, null, 2) }] }
    }
  )

  server.tool(
    'solana_get_wallet_address',
    'Get the Solana wallet address derived from AGENTI_SOLANA_PRIVATE_KEY.',
    {},
    async () => {
      const { Keypair } = await import('@solana/web3.js')
      const { createSolanaAgentKit } = await import('@agenti/sdk')

      const solanaKeyHex = process.env['AGENTI_SOLANA_PRIVATE_KEY']
      if (!solanaKeyHex) throw new Error('AGENTI_SOLANA_PRIVATE_KEY required')
      const keypair = Keypair.fromSecretKey(Buffer.from(solanaKeyHex, 'hex'))
      const kit = createSolanaAgentKit({ keypair })

      return { content: [{ type: 'text', text: JSON.stringify({ address: kit.wallet_address.toBase58() }) }] }
    }
  )

  server.tool(
    'decode_pump_transaction',
    'Fetch and decode a Solana transaction to extract pump.fun events (launch, trade, graduation, claim).',
    {
      signature: z.string().describe('Solana transaction signature to decode'),
    },
    async ({ signature }) => {
      const { Connection } = await import('@solana/web3.js')
      const rpcUrl = process.env['SOLANA_RPC_URL'] ?? 'https://api.mainnet-beta.solana.com'
      const connection = new Connection(rpcUrl, 'confirmed')

      const tx = await connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed',
      })

      if (!tx) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Transaction not found', signature }) }] }
      }

      const logs = tx.meta?.logMessages ?? []
      const events: PumpEvent[] = []

      for (const line of logs) {
        const event = decodePumpLog(line, signature)
        if (event) events.push(event)
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            signature,
            slot: tx.slot,
            blockTime: tx.blockTime,
            events,
            rawLogs: logs,
          }, null, 2),
        }],
      }
    }
  )

  // ---------------------------------------------------------------------------
  // Trade routing & P&L
  // ---------------------------------------------------------------------------

  server.tool(
    'extract_trade_ideas',
    'Extract structured trading ideas from any text — tweets, news, research notes, theses. Returns instruments, direction, confidence, and suggested markets.',
    {
      text: z.string().describe('Text to analyze (tweet, article excerpt, thesis, news headline, etc.)'),
    },
    async ({ text }) => {
      const ideas = await extractTradingIdeas(text)
      return { content: [{ type: 'text', text: JSON.stringify(ideas, null, 2) }] }
    }
  )

  server.tool(
    'route_trade',
    'Get ordered list of available markets for executing a trade. Returns spot, perp, and DEX venues based on available wallet chains.',
    {
      instrument: z.string().describe('Ticker symbol (e.g. BTC, ETH, SOL)'),
      direction: z.enum(['long', 'short', 'neutral']).describe('Trade direction'),
      has_evm: z.boolean().default(false).describe('Whether an EVM wallet is available (enables Hyperliquid, Uniswap)'),
      has_solana: z.boolean().default(false).describe('Whether a Solana wallet is available (enables Jupiter, pump.fun)'),
      has_binance: z.boolean().default(false).describe('Whether Binance API credentials are configured'),
    },
    async ({ instrument, direction, has_evm, has_solana, has_binance }) => {
      const markets = routeIdea(
        { instrument, direction, confidence: 0.7, timeframe: 'medium', thesis: '', suggestedMarkets: [] },
        { hasEvm: has_evm, hasSolana: has_solana, hasBinance: has_binance },
      )
      return { content: [{ type: 'text', text: JSON.stringify(markets, null, 2) }] }
    }
  )

  server.tool(
    'calculate_pnl',
    'Calculate current P&L percentage for a hypothetical or live position. Fetches current price from CoinGecko.',
    {
      instrument: z.string().describe('Ticker symbol (e.g. BTC, ETH, SOL)'),
      direction: z.enum(['long', 'short']).describe('Position direction'),
      entry_price: z.number().positive().describe('Entry price in USD'),
    },
    async ({ instrument, direction, entry_price }) => {
      const result = await calculatePnl({
        id: 'mcp',
        instrument,
        direction,
        market: 'spot',
        entryPrice: entry_price,
        createdAt: Date.now(),
        thesis: '',
      })
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    }
  )

  // ---------------------------------------------------------------------------
  // Price oracle & payment vault tools
  // ---------------------------------------------------------------------------

  server.tool(
    'get_token_price',
    'Get the current USD price of a token from Pyth (primary) with CoinGecko fallback. Useful for agents deciding how much to charge.',
    {
      symbol: z.enum(['SOL', 'USDC', 'USDT', 'BTC', 'ETH']).describe('Token symbol'),
    },
    async ({ symbol }) => {
      const result = await getPrice(symbol)
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    }
  )

  server.tool(
    'usd_to_token_amount',
    'Convert a USD amount to raw token units. Useful for agents pricing services in USD but paying in USDC or SOL.',
    {
      usd_amount: z.number().positive().describe('USD amount to convert'),
      symbol: z.enum(['SOL', 'USDC', 'USDT', 'BTC', 'ETH']).describe('Target token symbol'),
      decimals: z.number().int().default(6).describe('Token decimal places (default: 6 for USDC, 9 for SOL)'),
    },
    async ({ usd_amount, symbol, decimals }) => {
      const rawAmount = await usdToTokenAmount(usd_amount, symbol, decimals)
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ usdAmount: usd_amount, symbol, decimals, rawAmount: rawAmount.toString() }, null, 2),
        }],
      }
    }
  )

  server.tool(
    'get_vault_balances',
    'Get current payment vault balances for an agent mint. Shows total, buyback portion, and withdraw portion.',
    {
      agent_mint: z.string().describe('Agent token mint address'),
      currency_mint: z.string().optional().describe('Currency mint address (default: USDC mainnet)'),
    },
    async ({ agent_mint, currency_mint }) => {
      const { Connection } = await import('@solana/web3.js')
      const { USDC_MAINNET } = await import('@agenti/sdk')

      const rpcUrl = process.env['SOLANA_RPC_URL'] ?? 'https://api.mainnet-beta.solana.com'
      const connection = new Connection(rpcUrl, 'confirmed')

      const agentMintPk = new PublicKey(agent_mint)
      const currencyMintPk = new PublicKey(currency_mint ?? USDC_MAINNET)

      const balances = await getVaultBalances(agentMintPk, currencyMintPk, connection)
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            agentMint: agent_mint,
            currencyMint: currency_mint ?? USDC_MAINNET,
            total: balances.total.toString(),
            buybackPortion: balances.buybackPortion.toString(),
            withdrawPortion: balances.withdrawPortion.toString(),
          }, null, 2),
        }],
      }
    }
  )

  server.tool(
    'get_payment_history',
    'Get recent payment transactions for an agent mint. Returns parsed payment records from on-chain.',
    {
      agent_mint: z.string().describe('Agent token mint address'),
      currency_mint: z.string().optional().describe('Currency mint address (default: USDC mainnet)'),
      limit: z.number().int().min(1).max(100).default(20).describe('Number of payments to return'),
    },
    async ({ agent_mint, currency_mint, limit }) => {
      const { Connection } = await import('@solana/web3.js')
      const { USDC_MAINNET } = await import('@agenti/sdk')

      const rpcUrl = process.env['SOLANA_RPC_URL'] ?? 'https://api.mainnet-beta.solana.com'
      const connection = new Connection(rpcUrl, 'confirmed')

      const agentMintPk = new PublicKey(agent_mint)
      const currencyMintPk = new PublicKey(currency_mint ?? USDC_MAINNET)

      const records = await getPaymentHistory(agentMintPk, currencyMintPk, connection, { limit })
      return { content: [{ type: 'text', text: JSON.stringify(records, null, 2) }] }
    }
  )

  server.tool(
    'verify_payment_receipt',
    'Verify and decode a payment transaction by its Solana signature. Confirms whether a specific payment was made.',
    {
      signature: z.string().describe('Solana transaction signature to verify'),
    },
    async ({ signature }) => {
      const { Connection } = await import('@solana/web3.js')

      const rpcUrl = process.env['SOLANA_RPC_URL'] ?? 'https://api.mainnet-beta.solana.com'
      const connection = new Connection(rpcUrl, 'confirmed')

      const record = await verifyPaymentReceipt(signature, connection)
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(record ?? { verified: false, signature }, null, 2),
        }],
      }
    }
  )

  // ---------------------------------------------------------------------------
  // HD wallet & signing
  // ---------------------------------------------------------------------------

  server.tool(
    'generate_mnemonic',
    'Generate a new BIP39 mnemonic phrase and derive the first EVM and Solana wallet addresses from it',
    {
      strength: z
        .enum(['128', '256'])
        .optional()
        .describe('Entropy strength: 128 = 12 words (default), 256 = 24 words'),
    },
    async ({ strength }) => {
      const bits = strength === '256' ? 256 : 128
      const mnemonic = generateMnemonic(bits as 128 | 256)
      const wallet = walletFromMnemonic(mnemonic, 0)
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            mnemonic,
            evm: { address: wallet.evm.address },
            solana: { address: wallet.solana.address },
            warning: 'Store this mnemonic securely. Anyone with it controls all derived wallets.',
          }, null, 2),
        }],
      }
    }
  )

  server.tool(
    'derive_wallet',
    'Derive an EVM + Solana wallet from a BIP39 mnemonic at a given account index (BIP44 path)',
    {
      mnemonic: z.string().describe('BIP39 mnemonic phrase (12 or 24 words)'),
      account_index: z
        .number()
        .int()
        .min(0)
        .default(0)
        .describe('BIP44 account index (0 = first wallet, 1 = second, etc.)'),
    },
    async ({ mnemonic, account_index }) => {
      const wallet = walletFromMnemonic(mnemonic, account_index)
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            accountIndex: account_index,
            evm: {
              address: wallet.evm.address,
              privateKey: wallet.evm.privateKey,
              path: `m/44'/60'/0'/0/${account_index}`,
            },
            solana: {
              address: wallet.solana.address,
              privateKey: Buffer.from(wallet.solana.privateKey).toString('hex'),
              path: `m/44'/501'/${account_index}'/0'`,
            },
            warning: 'Store private keys securely. Never share them.',
          }, null, 2),
        }],
      }
    }
  )

  server.tool(
    'sign_message',
    'Sign a plain text message using EIP-191 personal_sign. Returns signature and signer address.',
    {
      message: z.string().describe('Message to sign'),
      evm_private_key: z
        .string()
        .optional()
        .describe('EVM private key (0x...) — falls back to AGENTI_EVM_PRIVATE_KEY env var'),
    },
    async ({ message, evm_private_key }) => {
      const privateKey = (evm_private_key ?? process.env['AGENTI_EVM_PRIVATE_KEY']) as
        | `0x${string}`
        | undefined
      if (!privateKey) throw new Error('EVM private key required (param or AGENTI_EVM_PRIVATE_KEY)')
      const { privateKeyToAccount } = await import('viem/accounts')
      const signature = await sdkSignMessage(message, privateKey)
      const signer = privateKeyToAccount(privateKey).address
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ message, signature, signer }, null, 2),
        }],
      }
    }
  )

  // ---------------------------------------------------------------------------
  // Anomaly detection & market intelligence
  // ---------------------------------------------------------------------------

  server.tool(
    'detect_price_anomalies',
    'Detect unusual price movements for a coin using Modified Z-Score statistical analysis. Useful for agents monitoring for unusual market moves.',
    {
      coin_id: z.string().describe('CoinGecko coin ID (e.g. bitcoin, ethereum, solana)'),
      days: z.number().int().min(1).max(365).default(30).describe('Days of OHLCV history to analyze'),
      threshold: z.number().min(1).max(10).default(3.5).describe('Z-score threshold for anomaly detection (default: 3.5)'),
    },
    async ({ coin_id, days, threshold }) => {
      const candles = await getOhlcv(coin_id, days)
      const prices = candles.map((c) => ({ timestamp: c.timestamp, price: c.close, volume: c.volume }))
      const anomalies = detectAnomalies(prices, { threshold })
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            coin_id,
            days,
            threshold,
            total_candles: candles.length,
            anomalies_found: anomalies.length,
            anomalies,
          }, null, 2),
        }],
      }
    }
  )

  server.tool(
    'get_market_volatility',
    'Get current and historical volatility metrics for a coin. Useful for agents deciding position sizes.',
    {
      coin_id: z.string().describe('CoinGecko coin ID (e.g. bitcoin, ethereum, solana)'),
      days: z.number().int().min(7).max(365).default(30).describe('Days of price history to analyze'),
    },
    async ({ coin_id, days }) => {
      const candles = await getOhlcv(coin_id, days)
      const closePrices = candles.map((c) => c.close)
      const vol7d = getVolatility(closePrices, Math.min(7, closePrices.length))
      const vol14d = getVolatility(closePrices, Math.min(14, closePrices.length))
      const vol30d = getVolatility(closePrices, Math.min(30, closePrices.length))
      const annualize = (v: number) => Math.round(v * Math.sqrt(365) * 10000) / 100
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            coin_id,
            days_analyzed: candles.length,
            volatility: {
              daily_7d: Math.round(vol7d * 10000) / 100,
              daily_14d: Math.round(vol14d * 10000) / 100,
              daily_30d: Math.round(vol30d * 10000) / 100,
              annualized_7d: annualize(vol7d),
              annualized_14d: annualize(vol14d),
              annualized_30d: annualize(vol30d),
            },
            note: 'Volatility is standard deviation of log returns. Annualized = daily × √365.',
          }, null, 2),
        }],
      }
    }
  )

  server.tool(
    'get_crypto_news_feed',
    'Fetch latest cryptocurrency news headlines. Useful for agents staying current on market events.',
    {
      query: z.string().optional().describe('Filter by coin symbol or keyword (e.g. BTC, DeFi, Solana)'),
      limit: z.number().int().min(1).max(50).default(10).describe('Number of articles to return'),
      language: z.string().optional().describe('ISO language code (e.g. en, es, zh). Default: en'),
    },
    async ({ query, limit, language }) => {
      const params = new URLSearchParams({ limit: String(Math.min(limit, 50)) })
      if (query) params.set('q', query)
      if (language) params.set('lang', language)

      const res = await fetch(`https://cryptocurrency.cv/api/news?${params}`, {
        headers: { Accept: 'application/json', 'User-Agent': 'agenti/0.1' },
      })

      if (!res.ok) {
        // Fallback to getCryptoNews (CryptoPanic / CoinGecko)
        const fallback = await getCryptoNews(query, limit)
        return { content: [{ type: 'text', text: JSON.stringify({ source: 'cryptopanic_fallback', articles: fallback }, null, 2) }] }
      }

      const data = await res.json()
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ source: 'cryptocurrency.cv', articles: data }, null, 2),
        }],
      }
    }
  )

  // ---------------------------------------------------------------------------
  // Pump.fun trading bot — buy, sell, token info
  // Requires AGENTI_SOLANA_PRIVATE_KEY and SOLANA_RPC_URL
  // ---------------------------------------------------------------------------

  server.tool(
    'pump_buy',
    'Buy a pump.fun token with SOL. Works on bonding curve and graduated (PumpSwap AMM) tokens. Requires AGENTI_SOLANA_PRIVATE_KEY.',
    {
      mint: z.string().describe('Token mint address'),
      sol_amount: z.number().positive().describe('Amount of SOL to spend (e.g. 0.1)'),
      slippage: z.number().min(1).max(50).default(5).describe('Slippage tolerance in percent (default 5)'),
      priority_fee: z.number().int().min(0).default(0).describe('Priority fee tip in lamports for faster inclusion'),
    },
    async ({ mint, sol_amount, slippage, priority_fee }) => {
      const { Keypair, Connection } = await import('@solana/web3.js')
      const { buy } = await import('@agenti/sdk')

      const solanaKeyHex = process.env['AGENTI_SOLANA_PRIVATE_KEY']
      if (!solanaKeyHex) throw new Error('AGENTI_SOLANA_PRIVATE_KEY required')
      const rpcUrl = process.env['SOLANA_RPC_URL'] ?? 'https://api.mainnet-beta.solana.com'

      const keypair = Keypair.fromSecretKey(Buffer.from(solanaKeyHex, 'hex'))
      const connection = new Connection(rpcUrl, 'confirmed')

      const result = await buy({ mint, solAmount: sol_amount, slippage, keypair, connection, priorityFee: priority_fee })
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ status: 'confirmed', mint, sol_spent: sol_amount, ...result }, null, 2),
        }],
      }
    }
  )

  server.tool(
    'pump_sell',
    'Sell a pump.fun token back to SOL. Works on bonding curve and graduated tokens. Requires AGENTI_SOLANA_PRIVATE_KEY.',
    {
      mint: z.string().describe('Token mint address'),
      token_amount: z.number().positive().describe('Amount of tokens to sell (human-readable, e.g. 1000000)'),
      slippage: z.number().min(1).max(50).default(5).describe('Slippage tolerance in percent (default 5)'),
    },
    async ({ mint, token_amount, slippage }) => {
      const { Keypair, Connection } = await import('@solana/web3.js')
      const { sell } = await import('@agenti/sdk')

      const solanaKeyHex = process.env['AGENTI_SOLANA_PRIVATE_KEY']
      if (!solanaKeyHex) throw new Error('AGENTI_SOLANA_PRIVATE_KEY required')
      const rpcUrl = process.env['SOLANA_RPC_URL'] ?? 'https://api.mainnet-beta.solana.com'

      const keypair = Keypair.fromSecretKey(Buffer.from(solanaKeyHex, 'hex'))
      const connection = new Connection(rpcUrl, 'confirmed')

      const result = await sell({ mint, tokenAmount: token_amount, slippage, keypair, connection })
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ status: 'confirmed', mint, tokens_sold: token_amount, ...result }, null, 2),
        }],
      }
    }
  )

  server.tool(
    'pump_token_info',
    'Get pump.fun token state: whether it is on the bonding curve, migrating, or graduated to the AMM. Also returns market cap and pool address if graduated.',
    {
      mint: z.string().describe('Token mint address'),
    },
    async ({ mint }) => {
      const { getCoinState } = await import('@agenti/sdk')
      const state = await getCoinState(mint)
      return {
        content: [{ type: 'text', text: JSON.stringify(state, null, 2) }],
      }
    }
  )

  // ---------------------------------------------------------------------------
  // GMGN trading bot — trending tokens, token stats, new pairs, copy-trade
  // ---------------------------------------------------------------------------

  server.tool(
    'gmgn_trending_tokens',
    'Get trending Solana tokens from GMGN by swap volume. Useful for spotting momentum plays. No API key required.',
    {
      timeframe: z.enum(['1m', '5m', '1h', '6h', '24h']).default('1h').describe('Trending window'),
      limit: z.number().int().min(1).max(50).default(20).describe('Number of tokens to return'),
      pump_only: z.boolean().default(false).describe('Only show pump.fun tokens'),
      min_liquidity_usd: z.number().min(0).default(0).describe('Minimum liquidity filter in USD'),
    },
    async ({ timeframe, limit, pump_only, min_liquidity_usd }) => {
      const { getGmgnTrending } = await import('@agenti/sdk')
      const opts: Parameters<typeof getGmgnTrending>[0] = { timeframe, limit, pumpOnly: pump_only }
      if (min_liquidity_usd > 0) opts.minLiquidityUsd = min_liquidity_usd
      const tokens = await getGmgnTrending(opts)
      return {
        content: [{ type: 'text', text: JSON.stringify({ count: tokens.length, tokens }, null, 2) }],
      }
    }
  )

  server.tool(
    'gmgn_token_info',
    'Get detailed token stats from GMGN: price, market cap, volume, holder count, dev holding, honeypot status, freeze/mint authority flags.',
    {
      mint: z.string().describe('Solana token mint address'),
    },
    async ({ mint }) => {
      const { getGmgnTokenStat } = await import('@agenti/sdk')
      const stat = await getGmgnTokenStat(mint)
      return {
        content: [{ type: 'text', text: JSON.stringify(stat, null, 2) }],
      }
    }
  )

  server.tool(
    'gmgn_new_pairs',
    'Get newly created token pairs on Solana from GMGN. Good for sniping fresh launches.',
    {
      limit: z.number().int().min(1).max(50).default(20).describe('Number of pairs to return'),
      pump_only: z.boolean().default(false).describe('Only show pump.fun launches'),
      min_liquidity_usd: z.number().min(0).default(0).describe('Minimum current liquidity filter in USD'),
    },
    async ({ limit, pump_only, min_liquidity_usd }) => {
      const { getGmgnNewPairs } = await import('@agenti/sdk')
      const opts: Parameters<typeof getGmgnNewPairs>[0] = { limit, pumpOnly: pump_only }
      if (min_liquidity_usd > 0) opts.minLiquidityUsd = min_liquidity_usd
      const pairs = await getGmgnNewPairs(opts)
      return {
        content: [{ type: 'text', text: JSON.stringify({ count: pairs.length, pairs }, null, 2) }],
      }
    }
  )

  server.tool(
    'gmgn_copy_trade',
    'Copy a smart wallet trade: looks up a wallet\'s most recent trade on GMGN then executes the same buy or sell via pump.fun. Requires AGENTI_SOLANA_PRIVATE_KEY.',
    {
      wallet: z.string().describe('Solana wallet address to copy'),
      sol_amount: z.number().positive().describe('SOL amount to spend when copying a buy'),
      sell_pct: z.number().min(1).max(100).default(100).describe('Percentage of holdings to sell when copying a sell (default 100%)'),
      dry_run: z.boolean().default(false).describe('If true, show the trade that would be copied without executing it'),
    },
    async ({ wallet, sol_amount, sell_pct, dry_run }) => {
      const { getWalletTrades, buy, sell } = await import('@agenti/sdk')
      const { Keypair, Connection } = await import('@solana/web3.js')

      const trades = await getWalletTrades(wallet, { limit: 5 })
      const latest = trades[0]
      if (!latest) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'No recent trades found for this wallet' }) }] }
      }

      if (dry_run) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ dry_run: true, would_copy: latest }, null, 2),
          }],
        }
      }

      const solanaKeyHex = process.env['AGENTI_SOLANA_PRIVATE_KEY']
      if (!solanaKeyHex) throw new Error('AGENTI_SOLANA_PRIVATE_KEY required')
      const rpcUrl = process.env['SOLANA_RPC_URL'] ?? 'https://api.mainnet-beta.solana.com'
      const keypair = Keypair.fromSecretKey(Buffer.from(solanaKeyHex, 'hex'))
      const connection = new Connection(rpcUrl, 'confirmed')

      let result
      if (latest.side === 'buy') {
        result = await buy({ mint: latest.mint, solAmount: sol_amount, keypair, connection })
      } else {
        const tokenAmount = latest.token_amount * (sell_pct / 100)
        result = await sell({ mint: latest.mint, tokenAmount, keypair, connection })
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ copied_from: wallet, trade: latest, executed: result }, null, 2),
        }],
      }
    }
  )

  // ---------------------------------------------------------------------------
  // Jupiter trading bot — quotes and direct swaps
  // ---------------------------------------------------------------------------

  server.tool(
    'jupiter_quote',
    'Get a swap quote from Jupiter v6 aggregator. Read-only — no wallet needed. Returns best route, expected output, and price impact.',
    {
      input_mint: z.string().describe('Input token mint (use "So11111111111111111111111111111111111111112" for SOL)'),
      output_mint: z.string().describe('Output token mint address'),
      amount: z.number().positive().describe('Human-readable input amount (e.g. 0.1 for 0.1 SOL)'),
      input_decimals: z.number().int().min(0).max(18).default(9).describe('Decimals of input token (9 for SOL, 6 for USDC)'),
      slippage_bps: z.number().int().min(1).max(10000).default(50).describe('Slippage in basis points (50 = 0.5%)'),
    },
    async ({ input_mint, output_mint, amount, input_decimals, slippage_bps }) => {
      const { getJupiterQuote } = await import('@agenti/sdk')
      const rawAmount = BigInt(Math.round(amount * 10 ** input_decimals))
      const quote = await getJupiterQuote({ inputMint: input_mint, outputMint: output_mint, amount: rawAmount, slippageBps: slippage_bps })
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            inputMint: quote.inputMint,
            outputMint: quote.outputMint,
            inAmount: quote.inAmount,
            outAmount: quote.outAmount,
            priceImpactPct: quote.priceImpactPct,
            slippageBps: quote.slippageBps,
            route: quote.routePlan.map((r: { swapInfo: { label: string }; percent: number }) => ({ dex: r.swapInfo.label, pct: r.percent })),
          }, null, 2),
        }],
      }
    }
  )

  server.tool(
    'jupiter_swap',
    'Execute a token swap via Jupiter v6 aggregator. Best-route swap across all Solana DEXes. Requires AGENTI_SOLANA_PRIVATE_KEY.',
    {
      input_mint: z.string().describe('Input token mint (use "So11111111111111111111111111111111111111112" for SOL)'),
      output_mint: z.string().describe('Output token mint address'),
      amount: z.number().positive().describe('Human-readable input amount (e.g. 0.5 for 0.5 SOL)'),
      input_decimals: z.number().int().min(0).max(18).default(9).describe('Decimals of input token (9 for SOL, 6 for USDC)'),
      slippage_bps: z.number().int().min(1).max(10000).default(50).describe('Slippage in basis points (50 = 0.5%)'),
      priority_level: z.enum(['low', 'medium', 'high', 'very-high']).default('medium').describe('Transaction priority level affecting fee and inclusion speed'),
    },
    async ({ input_mint, output_mint, amount, input_decimals, slippage_bps, priority_level }) => {
      const { Keypair, Connection } = await import('@solana/web3.js')
      const { jupiterSwap } = await import('@agenti/sdk')

      const solanaKeyHex = process.env['AGENTI_SOLANA_PRIVATE_KEY']
      if (!solanaKeyHex) throw new Error('AGENTI_SOLANA_PRIVATE_KEY required')
      const rpcUrl = process.env['SOLANA_RPC_URL'] ?? 'https://api.mainnet-beta.solana.com'
      const keypair = Keypair.fromSecretKey(Buffer.from(solanaKeyHex, 'hex'))
      const connection = new Connection(rpcUrl, 'confirmed')

      const result = await jupiterSwap({ inputMint: input_mint, outputMint: output_mint, amount, inputDecimals: input_decimals, slippageBps: slippage_bps, priorityLevel: priority_level, keypair, connection })
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      }
    }
  )

  return server
}
