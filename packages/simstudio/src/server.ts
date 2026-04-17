import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import {
  agenti,
  getCoinPrice,
  getTrendingCoins,
  getProtocolTvl,
  getCryptoNews,
  getCoinState,
  getWalletTrades,
  isSmartWallet,
  onAgentiEvent,
  buy,
  sell,
} from '@agenti/sdk'
import { Connection, Keypair } from '@solana/web3.js'
import bs58 from 'bs58'

const SOLANA_RPC = process.env['SOLANA_RPC_URL'] ?? 'https://api.mainnet-beta.solana.com'

function solanaKeypair(privateKey: string): Keypair {
  const decoded = bs58.decode(privateKey)
  return Keypair.fromSecretKey(decoded)
}

export function createSimStudioBridge() {
  const app = new Hono()

  app.use('*', cors())
  app.use('*', logger())

  app.get('/health', (c) =>
    c.json({
      status: 'ok',
      service: 'agenti-simstudio-bridge',
      version: '0.1.0',
      tools: [
        'pay', 'balance', 'receive',
        'market/price', 'market/trending', 'market/tvl', 'market/news',
        'solana/token-price', 'solana/buy', 'solana/sell', 'solana/smart-wallet',
      ],
    }),
  )

  // ── Payment tools ────────────────────────────────────────────────────────

  app.post('/tools/pay', async (c) => {
    const { url, method = 'GET', evmPrivateKey, solanaPrivateKey } = await c.req.json()
    if (!url || !evmPrivateKey) {
      return c.json({ success: false, output: {}, error: 'url and evmPrivateKey are required' }, 400)
    }
    try {
      const instance = agenti({
        evm: { privateKey: evmPrivateKey as `0x${string}` },
        ...(solanaPrivateKey ? { solana: { privateKey: solanaPrivateKey } } : {}),
      })
      let paymentMade = false
      let payAmount: string | undefined
      let payNetwork: string | undefined
      const unsubscribe = onAgentiEvent((e) => {
        if (e.type === 'pay') {
          paymentMade = true
          payAmount = String(e.amount)
          payNetwork = e.network
        }
      })
      const response = await instance.pay(url, { method })
      unsubscribe()
      const body = await response.text()
      return c.json({
        success: response.ok,
        output: {
          status: response.status,
          ok: response.ok,
          body,
          paymentMade,
          amount: payAmount,
          network: payNetwork,
        },
      })
    } catch (err) {
      return c.json({ success: false, output: {}, error: String(err) }, 500)
    }
  })

  app.post('/tools/balance', async (c) => {
    const { evmAddress, solanaAddress, heliusApiKey } = await c.req.json()
    if (!evmAddress) {
      return c.json({ success: false, output: {}, error: 'evmAddress is required' }, 400)
    }
    try {
      const { getBalances } = await import('@agenti/sdk')
      const balances = await getBalances(evmAddress, solanaAddress, heliusApiKey)
      const usdc = balances.find((b) => b.token === 'USDC')?.amount ?? '0'
      const sol = balances.find((b) => b.token === 'SOL')?.amount ?? '0'
      const parts = balances.map((b) => `${b.amount} ${b.token} (${b.chain})`)
      return c.json({
        success: true,
        output: {
          balances,
          usdc,
          sol,
          summary: parts.length ? parts.join(', ') : 'No balances found',
        },
      })
    } catch (err) {
      return c.json({ success: false, output: {}, error: String(err) }, 500)
    }
  })

  app.post('/tools/receive', async (c) => {
    const { amount, token, chain, evmAddress, solanaAddress } = await c.req.json()
    if (!amount || !token || !chain) {
      return c.json({ success: false, output: {}, error: 'amount, token, chain are required' }, 400)
    }
    if (!evmAddress && !solanaAddress) {
      return c.json({ success: false, output: {}, error: 'evmAddress or solanaAddress is required' }, 400)
    }
    try {
      const { randomUUID } = await import('crypto')
      const address = chain === 'solana' ? (solanaAddress ?? '') : (evmAddress ?? '')
      const invoice = {
        id: randomUUID(),
        amount: String(amount),
        token: token as string,
        chain: chain as string,
        address,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      }
      return c.json({
        success: true,
        output: {
          id: invoice.id,
          amount: invoice.amount,
          token: invoice.token,
          chain: invoice.chain,
          address: invoice.address,
          expiresAt: invoice.expiresAt.toISOString(),
        },
      })
    } catch (err) {
      return c.json({ success: false, output: {}, error: String(err) }, 500)
    }
  })

  // ── Market data tools ────────────────────────────────────────────────────

  app.post('/tools/market/price', async (c) => {
    const { coinId, currency = 'usd' } = await c.req.json()
    if (!coinId) return c.json({ success: false, output: {}, error: 'coinId is required' }, 400)
    try {
      const data = await getCoinPrice(coinId, currency)
      return c.json({ success: true, output: data })
    } catch (err) {
      return c.json({ success: false, output: {}, error: String(err) }, 500)
    }
  })

  app.post('/tools/market/trending', async (c) => {
    const { limit = 10 } = await c.req.json()
    try {
      const coins = await getTrendingCoins(limit)
      return c.json({ success: true, output: { coins } })
    } catch (err) {
      return c.json({ success: false, output: {}, error: String(err) }, 500)
    }
  })

  app.post('/tools/market/tvl', async (c) => {
    const { protocol } = await c.req.json()
    if (!protocol) return c.json({ success: false, output: {}, error: 'protocol is required' }, 400)
    try {
      const data = await getProtocolTvl(protocol)
      return c.json({ success: true, output: data })
    } catch (err) {
      return c.json({ success: false, output: {}, error: String(err) }, 500)
    }
  })

  app.post('/tools/market/news', async (c) => {
    const { query, limit = 10 } = await c.req.json()
    try {
      const articles = await getCryptoNews(query, limit)
      return c.json({ success: true, output: { articles } })
    } catch (err) {
      return c.json({ success: false, output: {}, error: String(err) }, 500)
    }
  })

  // ── Solana trading tools ─────────────────────────────────────────────────

  app.post('/tools/solana/token-price', async (c) => {
    const { mint } = await c.req.json()
    if (!mint) return c.json({ success: false, output: {}, error: 'mint is required' }, 400)
    try {
      const state = await getCoinState(mint)
      return c.json({
        success: true,
        output: {
          mint,
          phase: state.phase,
          marketCapSol: state.marketCapSol ?? 0,
          complete: state.complete,
          pool: state.pool,
        },
      })
    } catch (err) {
      return c.json({ success: false, output: {}, error: String(err) }, 500)
    }
  })

  app.post('/tools/solana/buy', async (c) => {
    const { mint, solAmount, solanaPrivateKey, slippageBps = 100 } = await c.req.json()
    if (!mint || !solAmount || !solanaPrivateKey) {
      return c.json({ success: false, output: {}, error: 'mint, solAmount, solanaPrivateKey required' }, 400)
    }
    try {
      const keypair = solanaKeypair(solanaPrivateKey)
      const connection = new Connection(SOLANA_RPC, 'confirmed')
      const result = await buy({
        mint,
        solAmount: Number(solAmount),
        slippage: (slippageBps / 100),
        keypair,
        connection,
      })
      return c.json({ success: true, output: result })
    } catch (err) {
      return c.json({ success: false, output: {}, error: String(err) }, 500)
    }
  })

  app.post('/tools/solana/sell', async (c) => {
    const { mint, tokenAmount, solanaPrivateKey, slippageBps = 100 } = await c.req.json()
    if (!mint || !tokenAmount || !solanaPrivateKey) {
      return c.json({ success: false, output: {}, error: 'mint, tokenAmount, solanaPrivateKey required' }, 400)
    }
    try {
      const keypair = solanaKeypair(solanaPrivateKey)
      const connection = new Connection(SOLANA_RPC, 'confirmed')
      const result = await sell({
        mint,
        tokenAmount: Number(tokenAmount),
        slippage: (slippageBps / 100),
        keypair,
        connection,
      })
      return c.json({ success: true, output: result })
    } catch (err) {
      return c.json({ success: false, output: {}, error: String(err) }, 500)
    }
  })

  app.post('/tools/solana/smart-wallet', async (c) => {
    const { walletAddress } = await c.req.json()
    if (!walletAddress) return c.json({ success: false, output: {}, error: 'walletAddress is required' }, 400)
    try {
      const [smartResult, tradesResult] = await Promise.allSettled([
        isSmartWallet(walletAddress),
        getWalletTrades(walletAddress, { limit: 20 }),
      ])
      const smart = smartResult.status === 'fulfilled' ? smartResult.value : { isKol: false }
      const recentTrades = tradesResult.status === 'fulfilled' ? tradesResult.value : []
      return c.json({
        success: true,
        output: {
          address: walletAddress,
          isSmart: smart.isKol,
          winRate: smart.pnl_7d,
          recentTrades,
        },
      })
    } catch (err) {
      return c.json({ success: false, output: {}, error: String(err) }, 500)
    }
  })

  return app
}
