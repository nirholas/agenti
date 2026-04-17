/**
 * Agenti Solana Payments
 *
 * Adapted from nirholas/agent-payments-sdk (x402 sub-package + core)
 *
 * Exports:
 *   createAgentPaymentInvoice  – build a payment invoice for an AI agent
 *   validatePayment            – verify a payment was made on-chain
 *   getInvoicePDA              – derive the invoice PDA deterministically
 *   acceptPayment              – build the transaction instructions for accepting payment
 *   createX402Fetch            – x402 fetch wrapper that auto-handles HTTP 402 responses
 *
 * On-chain program: AgenTMiC2hvxGebTsgmsD4HHBa8WEcqGFf87iwRRxLo7
 */

import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  type AccountMeta,
} from '@solana/web3.js'
import {
  TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createSyncNativeInstruction,
  createCloseAccountInstruction,
  createTransferCheckedInstruction,
} from '@solana/spl-token'
import BN from 'bn.js'

// ─── Program Constants ───────────────────────────────────────────────────────

/** Pump Agent Payments program ID */
export const PROGRAM_ID = new PublicKey('AgenTMiC2hvxGebTsgmsD4HHBa8WEcqGFf87iwRRxLo7')

/** PDA seeds */
const GLOBAL_CONFIG_SEED = Buffer.from('global-config')
const TOKEN_AGENT_PAYMENTS_SEED = Buffer.from('token-agent-payments')
const PAYMENT_IN_CURRENCY_SEED = Buffer.from('payment-in-currency')
const INVOICE_ID_SEED = Buffer.from('invoice-id')
const BUYBACK_AUTHORITY_SEED = Buffer.from('buyback-authority')
const WITHDRAW_AUTHORITY_SEED = Buffer.from('withdraw-authority')

/** Well-known Solana asset addresses */
export const USDC_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
export const USDC_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'

/** CAIP-2 network identifiers */
export const SOLANA_MAINNET = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'
export const SOLANA_DEVNET = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1'

/** x402 protocol constants */
export const X402_VERSION = 2
export const X402_HEADER_PAYMENT_REQUIRED = 'PAYMENT-REQUIRED'
export const X402_HEADER_PAYMENT_SIGNATURE = 'PAYMENT-SIGNATURE'
export const X402_HEADER_PAYMENT_RESPONSE = 'PAYMENT-RESPONSE'

// ─── PDA Derivation ──────────────────────────────────────────────────────────

/** Derives the GlobalConfig PDA. Seeds: ["global-config"] */
export function getGlobalConfigPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([GLOBAL_CONFIG_SEED], PROGRAM_ID)
}

/** Derives the TokenAgentPayments PDA for a given mint. Seeds: ["token-agent-payments", mint] */
export function getTokenAgentPaymentsPDA(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [TOKEN_AGENT_PAYMENTS_SEED, mint.toBuffer()],
    PROGRAM_ID,
  )
}

/** Derives the TokenAgentPaymentInCurrency PDA. Seeds: ["payment-in-currency", tokenMint, currencyMint] */
export function getPaymentInCurrencyPDA(
  tokenMint: PublicKey,
  currencyMint: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PAYMENT_IN_CURRENCY_SEED, tokenMint.toBuffer(), currencyMint.toBuffer()],
    PROGRAM_ID,
  )
}

/** Derives the Invoice ID PDA. Seeds: ["invoice-id", tokenMint, currencyMint, amount, memo, startTime, endTime] */
export function getInvoiceIdPDA(
  tokenMint: PublicKey,
  currencyMint: PublicKey,
  amount: BN,
  memo: BN,
  startTime: BN,
  endTime: BN,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      INVOICE_ID_SEED,
      tokenMint.toBuffer(),
      currencyMint.toBuffer(),
      amount.toArrayLike(Buffer, 'le', 8),
      memo.toArrayLike(Buffer, 'le', 8),
      startTime.toArrayLike(Buffer, 'le', 8),
      endTime.toArrayLike(Buffer, 'le', 8),
    ],
    PROGRAM_ID,
  )
}

/** Derives the Buyback Authority PDA. Seeds: ["buyback-authority", tokenMint] */
export function getBuybackAuthorityPDA(tokenMint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [BUYBACK_AUTHORITY_SEED, tokenMint.toBuffer()],
    PROGRAM_ID,
  )
}

/** Derives the Withdraw Authority PDA. Seeds: ["withdraw-authority", tokenMint] */
export function getWithdrawAuthorityPDA(tokenMint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [WITHDRAW_AUTHORITY_SEED, tokenMint.toBuffer()],
    PROGRAM_ID,
  )
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface InvoiceParams {
  /** Agent token mint (base58 or PublicKey) */
  agentMint: string | PublicKey
  /** Currency mint to accept (defaults to USDC mainnet) */
  currencyMint?: string | PublicKey
  /** Payment amount in minor currency units (e.g. 1_000_000 = 1 USDC) */
  amount: bigint | number | string
  /** Invoice window in seconds (default: 300) */
  windowSeconds?: number
}

export interface AgentPaymentInvoice {
  /** On-chain invoice PDA address */
  invoicePDA: PublicKey
  /** Agent token mint */
  agentMint: PublicKey
  /** Currency mint */
  currencyMint: PublicKey
  /** Payment amount in minor units */
  amount: BN
  /** Unique numeric memo for this invoice */
  memo: BN
  /** Unix timestamp: invoice valid from */
  startTime: BN
  /** Unix timestamp: invoice valid until */
  endTime: BN
  /** Payment vault (TokenAgentPayments ATA for currency) */
  paymentVault: PublicKey
}

export interface GetInvoicePDAParams {
  agentMint: string | PublicKey
  currencyMint: string | PublicKey
  amount: bigint | number | string
  memo: bigint | number | string
  startTime: bigint | number | string
  endTime: bigint | number | string
}

export interface ValidatePaymentParams {
  connection: Connection
  agentMint: string | PublicKey
  currencyMint: string | PublicKey
  user: string | PublicKey
  amount: bigint | number | string
  memo: bigint | number | string
  startTime: bigint | number | string
  endTime: bigint | number | string
}

export interface AcceptPaymentParams {
  /** Payer / user public key */
  user: PublicKey
  /** Agent token mint */
  agentMint: PublicKey
  /** Currency mint being paid */
  currencyMint: PublicKey
  amount: BN
  memo: BN
  startTime: BN
  endTime: BN
  /** Token program for the currency (defaults to TOKEN_PROGRAM_ID) */
  tokenProgram?: PublicKey
  /** Compute unit limit (default: 130_000) */
  computeUnitLimit?: number
  /** Priority fee in micro lamports per compute unit */
  computeUnitPrice?: number
}

// ─── x402 Types ──────────────────────────────────────────────────────────────

export type TransactionSigner = (txBase64: string) => Promise<string>
export type TransactionSender = (signedTxBase64: string) => Promise<string>

export interface X402ClientConfig {
  /** Payer public key (base58) */
  payer: string
  /** Sign a serialised transaction, return signed base64 */
  signTransaction: TransactionSigner
  /** Send a signed transaction, return tx signature (base58) */
  sendTransaction: TransactionSender
  /** CAIP-2 network identifier (default: SOLANA_MAINNET) */
  network?: string
  /** Max ms to wait for tx confirmation (default: 30_000) */
  confirmationTimeoutMs?: number
}

export interface PumpAgentPaymentRequirementsExtra extends Record<string, unknown> {
  agentMint: string
  memo: string
  startTime: number
  endTime: number
}

export interface PaymentRequirementsBase {
  scheme: string
  network: string
  asset: string
  amount: string
  payTo: string
  maxTimeoutSeconds: number
  extra?: Record<string, unknown>
}

export interface PumpAgentPaymentRequirements extends PaymentRequirementsBase {
  scheme: 'pump-agent'
  extra: PumpAgentPaymentRequirementsExtra
}

export interface ExactPaymentRequirements extends PaymentRequirementsBase {
  scheme: 'exact'
}

export type PaymentRequirements = PumpAgentPaymentRequirements | ExactPaymentRequirements

export interface PaymentRequired {
  x402Version: 2
  resource: { url: string; description?: string }
  accepts: PaymentRequirements[]
}

export interface PaymentPayload {
  x402Version: 2
  resource?: string
  accepted: PaymentRequirements
  payload: Record<string, unknown>
}

// ─── Memo Counter ─────────────────────────────────────────────────────────────

let _memoCounter = 0

function generateMemo(): BN {
  const ts = Date.now()
  _memoCounter = (_memoCounter + 1) % 1_000_000
  const memoStr = `${ts}${String(_memoCounter).padStart(6, '0')}`
  return new BN(memoStr)
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function toBN(value: bigint | number | string): BN {
  return new BN(value.toString())
}

function toPubkey(value: string | PublicKey): PublicKey {
  return typeof value === 'string' ? new PublicKey(value) : value
}

// ─── Core Exports ─────────────────────────────────────────────────────────────

/**
 * Build a payment invoice for an AI agent to accept payments.
 *
 * Creates all the invoice parameters needed for a payer to call
 * `acceptPayment` on-chain, including a unique memo and time window.
 *
 * @example
 * ```ts
 * const invoice = createAgentPaymentInvoice({
 *   agentMint: 'YourMintAddress...',
 *   amount: 1_000_000, // 1 USDC
 * })
 * ```
 */
export function createAgentPaymentInvoice(params: InvoiceParams): AgentPaymentInvoice {
  const agentMint = toPubkey(params.agentMint)
  const currencyMint = toPubkey(params.currencyMint ?? USDC_MAINNET)
  const amount = toBN(params.amount)
  const memo = generateMemo()
  const now = Math.floor(Date.now() / 1000)
  const windowSec = params.windowSeconds ?? 300
  const startTime = new BN(now)
  const endTime = new BN(now + windowSec)

  const [invoicePDA] = getInvoiceIdPDA(agentMint, currencyMint, amount, memo, startTime, endTime)
  const [tokenAgentPayments] = getTokenAgentPaymentsPDA(agentMint)
  const paymentVault = getAssociatedTokenAddressSync(
    currencyMint,
    tokenAgentPayments,
    true,
    TOKEN_PROGRAM_ID,
  )

  return {
    invoicePDA,
    agentMint,
    currencyMint,
    amount,
    memo,
    startTime,
    endTime,
    paymentVault,
  }
}

/**
 * Derive the Invoice PDA deterministically from invoice parameters.
 *
 * Use this to check on-chain whether a specific invoice has been settled.
 */
export function getInvoicePDA(params: GetInvoicePDAParams): PublicKey {
  const agentMint = toPubkey(params.agentMint)
  const currencyMint = toPubkey(params.currencyMint)
  const amount = toBN(params.amount)
  const memo = toBN(params.memo)
  const startTime = toBN(params.startTime)
  const endTime = toBN(params.endTime)

  const [pda] = getInvoiceIdPDA(agentMint, currencyMint, amount, memo, startTime, endTime)
  return pda
}

/**
 * Verify that a payment was made on-chain by checking whether the invoice
 * PDA account exists (it is created by the `agent_accept_payment` instruction).
 *
 * Falls back to scanning transaction logs if the PDA account is unavailable.
 */
export async function validatePayment(params: ValidatePaymentParams): Promise<boolean> {
  const { connection } = params
  const agentMint = toPubkey(params.agentMint)
  const currencyMint = toPubkey(params.currencyMint)
  const user = toPubkey(params.user)
  const amount = toBN(params.amount)
  const memo = toBN(params.memo)
  const startTime = toBN(params.startTime)
  const endTime = toBN(params.endTime)

  const [invoiceId] = getInvoiceIdPDA(agentMint, currencyMint, amount, memo, startTime, endTime)

  // Primary: check if the InvoiceId PDA account exists on-chain
  // (the program creates this account when the payment is accepted)
  try {
    const info = await connection.getAccountInfo(invoiceId)
    if (info !== null) return true
  } catch {
    // fall through to log scan
  }

  // Fallback: scan transaction logs on the invoiceId PDA
  try {
    const signatures = await connection.getSignaturesForAddress(invoiceId)
    for (const sig of signatures) {
      if (sig.err) continue
      const tx = await connection.getTransaction(sig.signature, {
        maxSupportedTransactionVersion: 0,
      })
      if (!tx?.meta?.logMessages) continue

      // Look for the accept payment event in logs
      const logs = tx.meta.logMessages
      const hasPaymentLog = logs.some(
        (l) => l.includes('AgentAcceptPaymentEvent') || l.includes('agent_accept_payment'),
      )
      if (!hasPaymentLog) continue

      // Verify user and mint match by checking accounts in the transaction
      const accountKeys =
        tx.transaction.message.staticAccountKeys ??
        // @ts-expect-error – legacy message
        tx.transaction.message.accountKeys ??
        []

      const userKey = user.toBase58()
      const mintKey = agentMint.toBase58()
      const hasUser = accountKeys.some((k: PublicKey) => k.toBase58() === userKey)
      const hasMint = accountKeys.some((k: PublicKey) => k.toBase58() === mintKey)

      if (hasUser && hasMint) return true
    }
  } catch {
    // ignore
  }

  return false
}

/**
 * Build the transaction instructions for accepting a payment on-chain.
 *
 * Returns an array of `TransactionInstruction`s that the payer must sign
 * and submit. Includes compute budget setup and native SOL wrapping if needed.
 *
 * @example
 * ```ts
 * const invoice = createAgentPaymentInvoice({ agentMint, amount: 1_000_000 })
 * const ixs = await acceptPayment({
 *   user: payer.publicKey,
 *   agentMint: invoice.agentMint,
 *   currencyMint: invoice.currencyMint,
 *   amount: invoice.amount,
 *   memo: invoice.memo,
 *   startTime: invoice.startTime,
 *   endTime: invoice.endTime,
 * })
 * ```
 */
export async function acceptPayment(
  params: AcceptPaymentParams,
): Promise<TransactionInstruction[]> {
  const { user, agentMint, currencyMint, amount, memo, startTime, endTime } = params
  const tp = params.tokenProgram ?? TOKEN_PROGRAM_ID
  const computeUnitLimit = params.computeUnitLimit ?? 130_000

  const [tokenAgentPayments] = getTokenAgentPaymentsPDA(agentMint)
  const [globalConfig] = getGlobalConfigPDA()
  const [paymentInCurrency] = getPaymentInCurrencyPDA(agentMint, currencyMint)
  const [invoiceId] = getInvoiceIdPDA(agentMint, currencyMint, amount, memo, startTime, endTime)

  const userTokenAccount = getAssociatedTokenAddressSync(currencyMint, user, false, tp)
  const tokenAgentAssociatedAccount = getAssociatedTokenAddressSync(
    currencyMint,
    tokenAgentPayments,
    true,
    tp,
  )

  // Build the accept_payment instruction data manually using Anchor discriminator
  // discriminator = first 8 bytes of sha256("global:agent_accept_payment")
  // Precomputed: [229, 230, 129, 49, 64, 75, 191, 194]
  const ACCEPT_PAYMENT_DISCRIMINATOR = Buffer.from([229, 230, 129, 49, 64, 75, 191, 194])

  const amountBuf = amount.toArrayLike(Buffer, 'le', 8)
  const memoBuf = memo.toArrayLike(Buffer, 'le', 8)
  const startBuf = startTime.toArrayLike(Buffer, 'le', 8)
  const endBuf = endTime.toArrayLike(Buffer, 'le', 8)
  const data = Buffer.concat([ACCEPT_PAYMENT_DISCRIMINATOR, amountBuf, memoBuf, startBuf, endBuf])

  const accounts: AccountMeta[] = [
    { pubkey: user, isSigner: true, isWritable: true },
    { pubkey: userTokenAccount, isSigner: false, isWritable: true },
    { pubkey: tokenAgentPayments, isSigner: false, isWritable: true },
    { pubkey: tokenAgentAssociatedAccount, isSigner: false, isWritable: true },
    { pubkey: paymentInCurrency, isSigner: false, isWritable: true },
    { pubkey: globalConfig, isSigner: false, isWritable: false },
    { pubkey: invoiceId, isSigner: false, isWritable: true },
    { pubkey: currencyMint, isSigner: false, isWritable: false },
    { pubkey: tp, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ]

  const acceptIx = new TransactionInstruction({ keys: accounts, programId: PROGRAM_ID, data })

  const ixs: TransactionInstruction[] = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnitLimit }),
  ]

  if (params.computeUnitPrice != null) {
    ixs.push(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: params.computeUnitPrice }))
  }

  // Native SOL requires wrapping
  if (currencyMint.equals(NATIVE_MINT)) {
    return [
      ...ixs,
      createAssociatedTokenAccountIdempotentInstruction(user, userTokenAccount, user, NATIVE_MINT),
      SystemProgram.transfer({
        fromPubkey: user,
        toPubkey: userTokenAccount,
        lamports: BigInt(amount.toString()),
      }),
      createSyncNativeInstruction(userTokenAccount),
      acceptIx,
      createCloseAccountInstruction(userTokenAccount, user, user),
    ]
  }

  return [...ixs, acceptIx]
}

// ─── x402 Fetch Wrapper ──────────────────────────────────────────────────────

/**
 * Create a fetch function that automatically handles HTTP 402 responses
 * by building a Pump Agent payment transaction, signing, sending, and
 * retrying the original request with proof in the PAYMENT-SIGNATURE header.
 *
 * Supports both "pump-agent" (on-chain invoice) and "exact" (SPL TransferChecked) schemes.
 *
 * @example
 * ```ts
 * // With a raw keypair (simplest form – signs and sends internally)
 * const x402fetch = createX402Fetch(wallet, connection)
 * const res = await x402fetch('https://api.agent.example/inference', {
 *   method: 'POST',
 *   body: JSON.stringify({ prompt: 'Hello' }),
 * })
 *
 * // With custom sign/send callbacks
 * const x402fetch = createX402Fetch({
 *   payer: wallet.publicKey.toBase58(),
 *   signTransaction: async (txBase64) => { ... },
 *   sendTransaction: async (signedBase64) => { ... },
 * }, connection)
 * ```
 */
export function createX402Fetch(
  configOrKeypair: X402ClientConfig | Keypair,
  connection: Connection,
): (input: string | URL | Request, init?: RequestInit) => Promise<Response> {
  let config: X402ClientConfig & { connection: Connection }

  if (configOrKeypair instanceof Keypair) {
    const keypair = configOrKeypair
    config = {
      payer: keypair.publicKey.toBase58(),
      connection,
      signTransaction: async (txBase64: string) => {
        const tx = Transaction.from(Buffer.from(txBase64, 'base64'))
        tx.sign(keypair)
        return Buffer.from(tx.serialize()).toString('base64')
      },
      sendTransaction: async (signedTxBase64: string) => {
        const raw = Buffer.from(signedTxBase64, 'base64')
        const sig = await connection.sendRawTransaction(raw)
        await connection.confirmTransaction(sig, 'confirmed')
        return sig
      },
    }
  } else {
    config = { ...configOrKeypair, connection }
  }

  const { payer, signTransaction, sendTransaction, network = SOLANA_MAINNET, confirmationTimeoutMs = 30_000 } = config

  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await fetch(input as any, init)
    if (response.status !== 402) return response

    // Decode the PAYMENT-REQUIRED header
    const raw = response.headers.get(X402_HEADER_PAYMENT_REQUIRED)
    if (!raw) return response

    let paymentRequired: PaymentRequired
    try {
      paymentRequired = JSON.parse(Buffer.from(raw, 'base64').toString()) as PaymentRequired
    } catch {
      return response
    }

    // Find a compatible requirement
    const accepted =
      paymentRequired.accepts.find((r) => r.scheme === 'pump-agent' && r.network === network) ??
      paymentRequired.accepts.find((r) => r.scheme === 'exact' && r.network === network) ??
      null

    if (!accepted) return response

    // Build, sign, and send the payment
    let proof: Record<string, unknown>

    if (accepted.scheme === 'pump-agent') {
      const req = accepted as PumpAgentPaymentRequirements
      const { extra } = req

      const agentMint = toPubkey(extra.agentMint)
      const currencyMint = toPubkey(req.asset)
      const amount = toBN(req.amount)
      const memo = toBN(extra.memo)
      const startTime = new BN(extra.startTime)
      const endTime = new BN(extra.endTime)

      const ixs = await acceptPayment({
        user: toPubkey(payer),
        agentMint,
        currencyMint,
        amount,
        memo,
        startTime,
        endTime,
      })

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
      const tx = new Transaction()
      tx.recentBlockhash = blockhash
      tx.lastValidBlockHeight = lastValidBlockHeight
      tx.feePayer = toPubkey(payer)
      tx.add(...ixs)

      const txBase64 = Buffer.from(tx.serialize({ requireAllSignatures: false })).toString('base64')
      const signedTxBase64 = await signTransaction(txBase64)
      const signature = await sendTransaction(signedTxBase64)

      await _waitForConfirmation(connection, signature, lastValidBlockHeight, confirmationTimeoutMs)

      proof = { signature, payer, agentMint: extra.agentMint, asset: req.asset, amount: req.amount, memo: extra.memo, startTime: extra.startTime, endTime: extra.endTime }
    } else {
      // exact scheme – SPL TransferChecked
      const req = accepted as ExactPaymentRequirements
      const mintPubkey = toPubkey(req.asset)
      const payerPubkey = toPubkey(payer)
      const recipientPubkey = toPubkey(req.payTo)

      // Decimal lookup for well-known tokens
      const KNOWN_DECIMALS: Record<string, number> = {
        [USDC_MAINNET]: 6,
        So11111111111111111111111111111111111111112: 9,
      }
      const decimals = KNOWN_DECIMALS[req.asset]
      if (decimals === undefined) {
        throw new Error(`Unknown token decimals for asset ${req.asset}. Only USDC and wSOL are supported for exact scheme.`)
      }

      const senderAta = getAssociatedTokenAddressSync(mintPubkey, payerPubkey)
      const recipientAta = getAssociatedTokenAddressSync(mintPubkey, recipientPubkey)

      const transferIx = createTransferCheckedInstruction(
        senderAta,
        mintPubkey,
        recipientAta,
        payerPubkey,
        BigInt(req.amount),
        decimals,
      )

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
      const tx = new Transaction()
      tx.recentBlockhash = blockhash
      tx.lastValidBlockHeight = lastValidBlockHeight
      tx.feePayer = payerPubkey
      tx.add(transferIx)

      const txBase64 = Buffer.from(tx.serialize({ requireAllSignatures: false })).toString('base64')
      const signedTxBase64 = await signTransaction(txBase64)
      const signature = await sendTransaction(signedTxBase64)

      await _waitForConfirmation(connection, signature, lastValidBlockHeight, confirmationTimeoutMs)

      proof = { signature, payer, asset: req.asset, amount: req.amount, payTo: req.payTo }
    }

    // Build PaymentPayload and retry
    const paymentPayload: PaymentPayload = {
      x402Version: X402_VERSION,
      resource: typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url,
      accepted,
      payload: proof,
    }

    const retryInit: RequestInit = { ...init }
    const headers = new Headers(retryInit.headers)
    headers.set(X402_HEADER_PAYMENT_SIGNATURE, Buffer.from(JSON.stringify(paymentPayload)).toString('base64'))
    retryInit.headers = headers

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return fetch(input as any, retryInit)
  }
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

async function _waitForConfirmation(
  connection: Connection,
  signature: string,
  lastValidBlockHeight: number,
  timeoutMs: number,
): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const status = await connection.getSignatureStatus(signature)
    const value = status?.value
    if (value?.confirmationStatus === 'confirmed' || value?.confirmationStatus === 'finalized') {
      if (value.err) throw new Error(`Transaction failed: ${JSON.stringify(value.err)}`)
      return
    }
    const blockHeight = await connection.getBlockHeight()
    if (blockHeight > lastValidBlockHeight) {
      throw new Error('Transaction expired (blockhash no longer valid)')
    }
    await new Promise((r) => setTimeout(r, 2_000))
  }
  throw new Error('Transaction confirmation timed out')
}
