import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { Keypair } from '@solana/web3.js'
import type { EVMWallet, SolanaWallet, AgentiWallet } from './types.js'

export function generateEVMWallet(): EVMWallet {
  const privateKey = generatePrivateKey()
  const account = privateKeyToAccount(privateKey)
  return { address: account.address, privateKey }
}

export function generateSolanaWallet(): SolanaWallet {
  const keypair = Keypair.generate()
  return {
    address: keypair.publicKey.toBase58(),
    privateKey: keypair.secretKey,
  }
}

export function generateWallet(): AgentiWallet {
  return {
    evm: generateEVMWallet(),
    solana: generateSolanaWallet(),
  }
}

export function walletFromKeys(
  evmPrivateKey: `0x${string}`,
  solanaPrivateKey?: Uint8Array
): AgentiWallet {
  const account = privateKeyToAccount(evmPrivateKey)
  const keypair = solanaPrivateKey
    ? Keypair.fromSecretKey(solanaPrivateKey)
    : Keypair.generate()
  return {
    evm: { address: account.address, privateKey: evmPrivateKey },
    solana: { address: keypair.publicKey.toBase58(), privateKey: keypair.secretKey },
  }
}
