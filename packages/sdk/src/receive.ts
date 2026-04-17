import { randomUUID } from 'crypto'
import type { Invoice, Chain, AgentiWallet } from '@agenti/core'

export function createInvoice(params: {
  amount: number
  token: string
  chain: Chain
  wallet: AgentiWallet
}): Invoice {
  const address =
    params.chain === 'solana' ? params.wallet.solana.address : params.wallet.evm.address

  return {
    id: randomUUID(),
    amount: params.amount.toString(),
    token: params.token,
    chain: params.chain,
    address,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  }
}
