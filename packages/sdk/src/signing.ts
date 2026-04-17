import { privateKeyToAccount } from 'viem/accounts'
import { recoverTypedDataAddress, recoverMessageAddress } from 'viem'

export interface TypedDataDomain {
  name?: string
  version?: string
  chainId?: number
  verifyingContract?: `0x${string}`
}

export async function signEIP712(
  domain: TypedDataDomain,
  types: Record<string, Array<{ name: string; type: string }>>,
  primaryType: string,
  message: Record<string, unknown>,
  privateKey: `0x${string}`
): Promise<`0x${string}`> {
  const account = privateKeyToAccount(privateKey)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return account.signTypedData({ domain, types, primaryType, message } as any)
}

export async function verifyEIP712(
  domain: TypedDataDomain,
  types: Record<string, Array<{ name: string; type: string }>>,
  primaryType: string,
  message: Record<string, unknown>,
  signature: `0x${string}`
): Promise<`0x${string}`> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return recoverTypedDataAddress({ domain, types, primaryType, message, signature } as any)
}

export async function signMessage(
  message: string,
  privateKey: `0x${string}`
): Promise<`0x${string}`> {
  const account = privateKeyToAccount(privateKey)
  return account.signMessage({ message })
}

export async function verifyMessage(
  message: string,
  signature: `0x${string}`
): Promise<`0x${string}`> {
  return recoverMessageAddress({ message, signature })
}
