export type Chain = 'base' | 'arbitrum' | 'ethereum' | 'polygon' | 'solana'

export interface EVMWallet {
  address: `0x${string}`
  privateKey: `0x${string}`
}

export interface SolanaWallet {
  address: string
  privateKey: Uint8Array
}

export interface AgentiWallet {
  evm: EVMWallet
  solana: SolanaWallet
}

export interface Balance {
  token: string
  amount: string
  chain: Chain
}

export interface Invoice {
  id: string
  amount: string
  token: string
  chain: Chain
  address: string
  expiresAt: Date
}
