import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { Keypair } from '@solana/web3.js'
import {
  generateMnemonic as bip39GenerateMnemonic,
  mnemonicToSeedSync,
  validateMnemonic as bip39ValidateMnemonic,
} from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english'
import { HDKey } from '@scure/bip32'
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
  const seed = mnemonicToSeedSync(mnemonic)
  const master = HDKey.fromMasterSeed(seed)
  const child = master.derive(`m/44'/501'/${accountIndex}'/0'`)
  if (!child.privateKey) throw new Error('Failed to derive Solana private key')
  const keypair = Keypair.fromSeed(child.privateKey)
  return { address: keypair.publicKey.toBase58(), privateKey: keypair.secretKey }
}

export function walletFromMnemonic(mnemonic: string, accountIndex = 0): AgentiWallet {
  return {
    evm: evmWalletFromMnemonic(mnemonic, accountIndex),
    solana: solanaWalletFromMnemonic(mnemonic, accountIndex),
  }
}
