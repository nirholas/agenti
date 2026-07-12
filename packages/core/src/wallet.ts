import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { Keypair } from '@solana/web3.js'
import {
  generateMnemonic as bip39GenerateMnemonic,
  mnemonicToSeedSync,
  validateMnemonic as bip39ValidateMnemonic,
} from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english'
import { HDKey } from '@scure/bip32'
import { derivePath } from 'ed25519-hd-key'
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

export function generateMnemonic(strength: 128 | 256 = 128): string {
  return bip39GenerateMnemonic(wordlist, strength)
}

export function validateMnemonic(mnemonic: string): boolean {
  return bip39ValidateMnemonic(mnemonic, wordlist)
}

export function evmWalletFromMnemonic(mnemonic: string, accountIndex = 0): EVMWallet {
  const seed = mnemonicToSeedSync(mnemonic)
  const master = HDKey.fromMasterSeed(seed)
  const child = master.derive(`m/44'/60'/0'/0/${accountIndex}`)
  if (!child.privateKey) throw new Error('Failed to derive EVM private key')
  const privateKey = `0x${Buffer.from(child.privateKey).toString('hex')}` as `0x${string}`
  const account = privateKeyToAccount(privateKey)
  return { address: account.address, privateKey }
}

export function solanaWalletFromMnemonic(mnemonic: string, accountIndex = 0): SolanaWallet {
  // Solana uses SLIP-0010 ed25519 derivation (the scheme Phantom, Backpack and the
  // Solana CLI implement) — NOT BIP-32 secp256k1. Deriving with @scure/bip32 here
  // would produce a valid-but-non-standard keypair whose address matches no other
  // wallet, silently stranding any funds. ed25519-hd-key implements SLIP-0010.
  const seed = mnemonicToSeedSync(mnemonic)
  const { key } = derivePath(`m/44'/501'/${accountIndex}'/0'`, Buffer.from(seed).toString('hex'))
  const keypair = Keypair.fromSeed(key)
  return { address: keypair.publicKey.toBase58(), privateKey: keypair.secretKey }
}

export function walletFromMnemonic(mnemonic: string, accountIndex = 0): AgentiWallet {
  return {
    evm: evmWalletFromMnemonic(mnemonic, accountIndex),
    solana: solanaWalletFromMnemonic(mnemonic, accountIndex),
  }
}
