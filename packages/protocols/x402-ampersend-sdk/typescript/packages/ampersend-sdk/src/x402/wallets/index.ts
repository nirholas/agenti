import type { Address, Hex } from "viem"

import type { X402Wallet } from "../wallet.ts"
import { AccountWallet } from "./account/wallet.ts"
import { SmartAccountWallet } from "./smart-account/wallet.ts"

export { AccountWallet } from "./account/wallet.ts"
export { SmartAccountWallet, type SmartAccountConfig } from "./smart-account/wallet.ts"

/**
 * Configuration for EOA (Externally Owned Account) wallet
 */
export interface EOAWalletConfig {
  type: "eoa"
  privateKey: Hex
}

/**
 * Configuration for Smart Account wallet
 */
export interface SmartAccountWalletConfig {
  type: "smart-account"
  smartAccountAddress: Address
  sessionKeyPrivateKey: Hex
  chainId: number
  validatorAddress: Address
}

/**
 * Union type for wallet configuration
 */
export type WalletConfig = EOAWalletConfig | SmartAccountWalletConfig

/**
 * Creates a wallet from configuration
 * Supports both EOA and Smart Account modes
 *
 * @param config - Wallet configuration
 * @returns An X402Wallet implementation (AccountWallet or SmartAccountWallet)
 */
export function createWalletFromConfig(config: WalletConfig): X402Wallet {
  if (config.type === "eoa") {
    return AccountWallet.fromPrivateKey(config.privateKey)
  }

  return new SmartAccountWallet({
    smartAccountAddress: config.smartAccountAddress,
    sessionKeyPrivateKey: config.sessionKeyPrivateKey,
    chainId: config.chainId,
    validatorAddress: config.validatorAddress,
  })
}
