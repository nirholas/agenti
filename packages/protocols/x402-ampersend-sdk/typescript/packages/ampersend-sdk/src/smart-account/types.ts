import type { Address, Hex } from "viem"

/**
 * ERC-3009 TransferWithAuthorization data structure
 * Used for USDC transfers with smart accounts
 */
export interface ERC3009AuthorizationData {
  /** Address sending the funds */
  from: Address
  /** Address receiving the funds */
  to: Address
  /** Amount to transfer */
  value: bigint
  /** Unix timestamp after which the authorization is valid */
  validAfter: bigint
  /** Unix timestamp before which the authorization is valid */
  validBefore: bigint
  /** Unique nonce for replay protection */
  nonce: Hex
}
