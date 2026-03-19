import { encode1271Signature, getAccount, getOwnableValidatorSignature } from "@rhinestone/module-sdk"
import type { Address, Hex, TypedData, TypedDataDefinition } from "viem"
import { privateKeyToAccount } from "viem/accounts"

import type { ERC3009AuthorizationData } from "./types.ts"

/**
 * Generic smart account typed data signing with OwnableValidator
 *
 * @param sessionKeyPrivateKey - Private key of the session key authorized to sign for the smart account
 * @param smartAccountAddress - Address of the smart account
 * @param params - EIP-712 typed data parameters
 * @param validatorAddress - Address of the OwnableValidator module
 * @returns ERC-1271 compatible signature
 */
export async function signSmartAccountTypedData<
  const typedData extends TypedData | Record<string, unknown>,
  primaryType extends keyof typedData | "EIP712Domain" = keyof typedData,
>(
  sessionKeyPrivateKey: Hex,
  smartAccountAddress: Address,
  params: TypedDataDefinition<typedData, primaryType>,
  validatorAddress: Address,
): Promise<Hex> {
  // Create session key account for signing
  const sessionKeyAccount = privateKeyToAccount(sessionKeyPrivateKey)

  // 1. Sign with the session key (EOA signature)
  const eoaSignature = await sessionKeyAccount.signTypedData(params)

  // 2. Format for OwnableValidator (threshold = 1, so single signature)
  const validatorSignature = getOwnableValidatorSignature({
    signatures: [eoaSignature],
  })

  // 3. Encode for ERC-1271 validation by smart account
  return encode1271Signature({
    account: getAccount({
      address: smartAccountAddress,
      type: "safe",
    }),
    validator: validatorAddress,
    signature: validatorSignature,
  })
}

/**
 * Sign ERC-3009 TransferWithAuthorization for USDC payments
 *
 * This creates a signature that allows a smart account to authorize USDC transfers
 * using the ERC-3009 standard (gasless transfers with authorization).
 *
 * @param sessionKeyPrivateKey - Private key of the session key authorized to sign
 * @param smartAccountAddress - Address of the smart account
 * @param authData - Authorization data (from, to, value, validity period, nonce)
 * @param tokenAddress - USDC token contract address
 * @param chainId - Chain ID for the typed data domain
 * @param validatorAddress - Address of the OwnableValidator module
 * @param domainName - EIP-712 domain name (from requirements.extra.name)
 * @param domainVersion - EIP-712 domain version (from requirements.extra.version)
 * @returns ERC-1271 compatible signature
 */
export async function signERC3009Authorization(
  sessionKeyPrivateKey: Hex,
  smartAccountAddress: Address,
  authData: ERC3009AuthorizationData,
  tokenAddress: Address,
  chainId: number,
  validatorAddress: Address,
  domainName: string,
  domainVersion: string,
): Promise<Hex> {
  // Use the generic signing function with ERC-3009 typed data
  return await signSmartAccountTypedData(
    sessionKeyPrivateKey,
    smartAccountAddress,
    {
      domain: {
        name: domainName,
        version: domainVersion,
        chainId,
        verifyingContract: tokenAddress,
      },
      types: {
        TransferWithAuthorization: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "validAfter", type: "uint256" },
          { name: "validBefore", type: "uint256" },
          { name: "nonce", type: "bytes32" },
        ],
      },
      primaryType: "TransferWithAuthorization",
      message: {
        from: authData.from,
        to: authData.to,
        value: authData.value,
        validAfter: authData.validAfter,
        validBefore: authData.validBefore,
        nonce: authData.nonce,
      },
    },
    validatorAddress,
  )
}
