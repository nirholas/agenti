import { generateWallet, walletFromKeys } from '@agenti/core'
import type { AgentiWallet, Balance, Invoice, Chain } from '@agenti/core'
import { pay } from './pay.js'
import type { PayOptions } from './pay.js'
import { getBalances } from './balance.js'
import { createInvoice } from './receive.js'

export interface AgentiConfig {
  evm?: { privateKey: `0x${string}` }
  solana?: { privateKey: Uint8Array }
  wallet?: AgentiWallet
  heliusApiKey?: string
}

export interface AgentiInstance {
  wallet: AgentiWallet
  pay(url: string, options?: PayOptions): Promise<Response>
  balance(): Promise<Balance[]>
  receive(params: { amount: number; token: string; chain: Chain }): Promise<Invoice>
}

export function agenti(config: AgentiConfig = {}): AgentiInstance {
  const wallet =
    config.wallet ??
    (config.evm?.privateKey
      ? walletFromKeys(config.evm.privateKey, config.solana?.privateKey)
      : generateWallet())

  return {
    wallet,

    pay(url, options) {
      return pay(url, wallet.evm, wallet.solana, options)
    },

    balance() {
      return getBalances(wallet.evm.address, wallet.solana.address, config.heliusApiKey)
    },

    receive(params) {
      return Promise.resolve(createInvoice({ ...params, wallet }))
    },
  }
}
