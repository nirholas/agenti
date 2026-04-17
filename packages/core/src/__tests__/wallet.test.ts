import { describe, it, expect } from 'vitest'
import { Keypair } from '@solana/web3.js'
import { generateWallet, generateEVMWallet, generateSolanaWallet, walletFromKeys } from '../wallet.js'

describe('generateWallet', () => {
  it('returns a valid EVM address (0x + 40 hex chars)', () => {
    const wallet = generateWallet()
    expect(wallet.evm.address).toMatch(/^0x[0-9a-fA-F]{40}$/)
  })

  it('returns a valid Solana address (base58, 32-44 chars)', () => {
    const wallet = generateWallet()
    expect(wallet.solana.address).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)
  })

  it('generates unique wallets on each call', () => {
    const w1 = generateWallet()
    const w2 = generateWallet()
    expect(w1.evm.address).not.toBe(w2.evm.address)
    expect(w1.solana.address).not.toBe(w2.solana.address)
  })
})

describe('generateEVMWallet', () => {
  it('returns address and privateKey', () => {
    const w = generateEVMWallet()
    expect(w.address).toMatch(/^0x[0-9a-fA-F]{40}$/)
    expect(w.privateKey).toMatch(/^0x[0-9a-fA-F]{64}$/)
  })
})

describe('generateSolanaWallet', () => {
  it('returns base58 address and Uint8Array privateKey', () => {
    const w = generateSolanaWallet()
    expect(w.address).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)
    expect(w.privateKey).toBeInstanceOf(Uint8Array)
    expect(w.privateKey.length).toBe(64)
  })
})

describe('walletFromKeys', () => {
  // Hardhat/Anvil account #0 — safe public test vector
  const TEST_EVM_KEY =
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const
  const EXPECTED_EVM_ADDR = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

  it('recovers the correct EVM address from a private key', () => {
    const wallet = walletFromKeys(TEST_EVM_KEY)
    expect(wallet.evm.address.toLowerCase()).toBe(EXPECTED_EVM_ADDR.toLowerCase())
    expect(wallet.evm.privateKey).toBe(TEST_EVM_KEY)
  })

  it('recovers the correct Solana address from a key', () => {
    const keypair = Keypair.generate()
    const wallet = walletFromKeys(TEST_EVM_KEY, keypair.secretKey)
    expect(wallet.solana.address).toBe(keypair.publicKey.toBase58())
  })

  it('generates a fresh Solana wallet when no Solana key is provided', () => {
    const w1 = walletFromKeys(TEST_EVM_KEY)
    const w2 = walletFromKeys(TEST_EVM_KEY)
    // EVM address is deterministic, Solana is fresh each call
    expect(w1.evm.address).toBe(w2.evm.address)
    expect(w1.solana.address).not.toBe(w2.solana.address)
  })
})
