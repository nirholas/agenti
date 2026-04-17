import { createHash } from 'crypto'
import {
  Connection,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  type AccountMeta,
} from '@solana/web3.js'
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
} from '@solana/spl-token'
import {
  PROGRAM_ID,
  getTokenAgentPaymentsPDA,
  getPaymentInCurrencyPDA,
  getBuybackAuthorityPDA,
  getWithdrawAuthorityPDA,
  getGlobalConfigPDA,
} from './payments.js'

export interface DistributePaymentsParams {
  agentMint: PublicKey
  currencyMint: PublicKey
  authority: PublicKey
  withdrawDestination: PublicKey
}

export interface VaultBalances {
  total: bigint
  buybackPortion: bigint
  withdrawPortion: bigint
}

function discriminator(instruction: string): Buffer {
  return createHash('sha256').update(`global:${instruction}`).digest().slice(0, 8)
}

const DISTRIBUTE_DISCRIMINATOR = discriminator('distribute_payments')
const WITHDRAW_DISCRIMINATOR = discriminator('withdraw')

export async function buildDistributeInstructions(
  params: DistributePaymentsParams,
  connection: Connection,
): Promise<TransactionInstruction[]> {
  const { agentMint, currencyMint, authority, withdrawDestination } = params

  const [tokenAgentPayments] = getTokenAgentPaymentsPDA(agentMint)
  const [globalConfig] = getGlobalConfigPDA()
  const [paymentInCurrency] = getPaymentInCurrencyPDA(agentMint, currencyMint)
  const [buybackAuthority] = getBuybackAuthorityPDA(agentMint)
  const [withdrawAuthority] = getWithdrawAuthorityPDA(agentMint)

  const paymentVault = getAssociatedTokenAddressSync(currencyMint, tokenAgentPayments, true)
  const buybackVault = getAssociatedTokenAddressSync(currencyMint, buybackAuthority, true)
  const withdrawVault = getAssociatedTokenAddressSync(currencyMint, withdrawAuthority, true)
  const withdrawDestAta = getAssociatedTokenAddressSync(currencyMint, withdrawDestination, false)

  const ixs: TransactionInstruction[] = []

  // Ensure buyback and withdraw vaults exist
  for (const [owner, vault] of [
    [buybackAuthority, buybackVault],
    [withdrawAuthority, withdrawVault],
  ] as [PublicKey, PublicKey][]) {
    const info = await connection.getAccountInfo(vault)
    if (!info) {
      ixs.push(
        createAssociatedTokenAccountIdempotentInstruction(authority, vault, owner, currencyMint),
      )
    }
  }

  const accounts: AccountMeta[] = [
    { pubkey: authority, isSigner: true, isWritable: true },
    { pubkey: tokenAgentPayments, isSigner: false, isWritable: true },
    { pubkey: paymentVault, isSigner: false, isWritable: true },
    { pubkey: paymentInCurrency, isSigner: false, isWritable: true },
    { pubkey: buybackAuthority, isSigner: false, isWritable: false },
    { pubkey: buybackVault, isSigner: false, isWritable: true },
    { pubkey: withdrawAuthority, isSigner: false, isWritable: false },
    { pubkey: withdrawVault, isSigner: false, isWritable: true },
    { pubkey: withdrawDestAta, isSigner: false, isWritable: true },
    { pubkey: globalConfig, isSigner: false, isWritable: false },
    { pubkey: currencyMint, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ]

  ixs.push(
    new TransactionInstruction({
      keys: accounts,
      programId: PROGRAM_ID,
      data: DISTRIBUTE_DISCRIMINATOR,
    }),
  )

  return ixs
}

export async function getVaultBalances(
  agentMint: PublicKey,
  currencyMint: PublicKey,
  connection: Connection,
): Promise<VaultBalances> {
  const [tokenAgentPayments] = getTokenAgentPaymentsPDA(agentMint)
  const [buybackAuthority] = getBuybackAuthorityPDA(agentMint)
  const [withdrawAuthority] = getWithdrawAuthorityPDA(agentMint)

  const paymentVault = getAssociatedTokenAddressSync(currencyMint, tokenAgentPayments, true)
  const buybackVault = getAssociatedTokenAddressSync(currencyMint, buybackAuthority, true)
  const withdrawVault = getAssociatedTokenAddressSync(currencyMint, withdrawAuthority, true)

  const [totalInfo, buybackInfo, withdrawInfo] = await Promise.all([
    connection.getTokenAccountBalance(paymentVault).catch(() => null),
    connection.getTokenAccountBalance(buybackVault).catch(() => null),
    connection.getTokenAccountBalance(withdrawVault).catch(() => null),
  ])

  return {
    total: BigInt(totalInfo?.value.amount ?? '0'),
    buybackPortion: BigInt(buybackInfo?.value.amount ?? '0'),
    withdrawPortion: BigInt(withdrawInfo?.value.amount ?? '0'),
  }
}

export async function buildWithdrawInstructions(
  params: {
    agentMint: PublicKey
    currencyMint: PublicKey
    authority: PublicKey
    destination: PublicKey
  },
  connection: Connection,
): Promise<TransactionInstruction[]> {
  const { agentMint, currencyMint, authority, destination } = params

  const [tokenAgentPayments] = getTokenAgentPaymentsPDA(agentMint)
  const [globalConfig] = getGlobalConfigPDA()
  const [withdrawAuthority] = getWithdrawAuthorityPDA(agentMint)

  const withdrawVault = getAssociatedTokenAddressSync(currencyMint, withdrawAuthority, true)
  const destinationAta = getAssociatedTokenAddressSync(currencyMint, destination, false)

  const ixs: TransactionInstruction[] = []

  const destInfo = await connection.getAccountInfo(destinationAta)
  if (!destInfo) {
    ixs.push(
      createAssociatedTokenAccountIdempotentInstruction(authority, destinationAta, destination, currencyMint),
    )
  }

  const accounts: AccountMeta[] = [
    { pubkey: authority, isSigner: true, isWritable: true },
    { pubkey: tokenAgentPayments, isSigner: false, isWritable: true },
    { pubkey: withdrawAuthority, isSigner: false, isWritable: false },
    { pubkey: withdrawVault, isSigner: false, isWritable: true },
    { pubkey: destinationAta, isSigner: false, isWritable: true },
    { pubkey: globalConfig, isSigner: false, isWritable: false },
    { pubkey: currencyMint, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ]

  ixs.push(
    new TransactionInstruction({
      keys: accounts,
      programId: PROGRAM_ID,
      data: WITHDRAW_DISCRIMINATOR,
    }),
  )

  return ixs
}
