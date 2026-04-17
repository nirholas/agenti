import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { agenti, generateWallet } from '@agenti/sdk'

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
    },
    async ({ url, evm_private_key, method, body }) => {
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

      const init: RequestInit = { method }
      if (body) { init.body = body; init.headers = { 'Content-Type': 'application/json' } }
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

  return server
}
