import { Connection, PublicKey, type Logs } from '@solana/web3.js'

const LAMPORTS_PER_SOL = 1_000_000_000

const PUMP_PROGRAM = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P')
const PUMP_AMM_PROGRAM = new PublicKey('pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA')

// Anchor event discriminators derived from pump.fun program IDL
const DISC_CREATE_V2 = 'd6904cec5f8b31b4'
const DISC_CREATE_V1 = '181ec828051c0777'
const DISC_COMPLETE = '5f72619cd42e9808'
const DISC_COMPLETE_AMM = 'bde95db95c94ea94'
const DISC_TRADE = 'bddb7fd34ee661ee'
const DISC_CLAIM = '3212c141edd2eaec'

export type PumpEvent =
  | { type: 'launch'; mint: string; name: string; symbol: string; creator: string; timestamp: number; signature: string }
  | { type: 'graduation'; mint: string; pool: string; timestamp: number; signature: string }
  | { type: 'trade'; mint: string; side: 'buy' | 'sell'; sol: number; tokens: number; wallet: string; timestamp: number; signature: string }
  | { type: 'claim'; mint: string; github?: string; twitter?: string; wallet: string; timestamp: number; signature: string }

export interface EventMonitorOptions {
  connection: Connection
  /** Filter to specific event types. Default: all. */
  eventTypes?: PumpEvent['type'][]
  /** Filter to specific mint addresses. */
  mints?: string[]
  /** Polling interval in ms (used when WebSocket is unavailable). Default: 2000. */
  pollIntervalMs?: number
}

// ── Borsh decode helpers ────────────────────────────────────────────────────

function readPubkey(buf: Buffer, offset: number): string {
  return new PublicKey(buf.subarray(offset, offset + 32)).toBase58()
}

function readBorshString(buf: Buffer, offset: number): { value: string; nextOffset: number } {
  const len = buf.readUInt32LE(offset)
  const value = buf.subarray(offset + 4, offset + 4 + len).toString('utf8')
  return { value, nextOffset: offset + 4 + len }
}

function readU64(buf: Buffer, offset: number): number {
  const view = new DataView(buf.buffer, buf.byteOffset + offset, 8)
  return Number(view.getBigUint64(0, true))
}

function readI64(buf: Buffer, offset: number): number {
  const view = new DataView(buf.buffer, buf.byteOffset + offset, 8)
  return Number(view.getBigInt64(0, true))
}

// ── Log decoding ────────────────────────────────────────────────────────────

/**
 * Decode a raw Solana log line into a PumpEvent, or null if not a pump.fun event.
 * The log line must be a "Program data: <base64>" entry from pump.fun programs.
 */
export function decodePumpLog(log: string, signature: string): PumpEvent | null {
  if (!log.includes('Program data: ')) return null
  const b64 = log.split('Program data: ')[1]?.trim()
  if (!b64) return null

  let bytes: Buffer
  try {
    bytes = Buffer.from(b64, 'base64')
  } catch {
    return null
  }

  if (bytes.length < 8) return null
  const disc = bytes.subarray(0, 8).toString('hex')
  const now = Math.floor(Date.now() / 1000)

  try {
    // Launch event — layout: disc(8), name(borsh str), symbol(borsh str), uri(borsh str),
    //   mint(32), bonding_curve(32), user(32), creator(32), timestamp(8)
    if (disc === DISC_CREATE_V2 || disc === DISC_CREATE_V1) {
      let offset = 8
      const { value: name, nextOffset: o1 } = readBorshString(bytes, offset)
      const { value: symbol, nextOffset: o2 } = readBorshString(bytes, o1)
      const { nextOffset: o3 } = readBorshString(bytes, o2) // uri
      const mint = readPubkey(bytes, o3)
      offset = o3 + 32 + 32 // skip bonding_curve
      const creator = readPubkey(bytes, offset)
      offset += 32 + 32 // skip second creator / user field
      const timestamp = bytes.length >= offset + 8 ? readI64(bytes, offset) : now
      return { type: 'launch', mint, name, symbol, creator, timestamp, signature }
    }

    // Graduation / complete — layout: disc(8), user(32), mint(32), bonding_curve(32), timestamp(8)
    if (disc === DISC_COMPLETE || disc === DISC_COMPLETE_AMM) {
      const mint = readPubkey(bytes, 8 + 32)
      const tsOffset = 8 + 32 + 32 + 32
      const timestamp = bytes.length >= tsOffset + 8 ? readI64(bytes, tsOffset) : now
      // pool address requires a tx lookup; emit empty string — callers can fill via getCoinState
      return { type: 'graduation', mint, pool: '', timestamp, signature }
    }

    // Trade — layout: disc(8), mint(32), sol_amount(8), token_amount(8), is_buy(1), user(32), timestamp(8)
    if (disc === DISC_TRADE) {
      const mint = readPubkey(bytes, 8)
      const sol = readU64(bytes, 8 + 32) / LAMPORTS_PER_SOL
      const tokens = readU64(bytes, 8 + 32 + 8)
      const isBuy = bytes[8 + 32 + 8 + 8] === 1
      const wallet = readPubkey(bytes, 8 + 32 + 8 + 8 + 1)
      const tsOffset = 8 + 32 + 8 + 8 + 1 + 32
      const timestamp = bytes.length >= tsOffset + 8 ? readI64(bytes, tsOffset) : now
      return { type: 'trade', mint, side: isBuy ? 'buy' : 'sell', sol, tokens, wallet, timestamp, signature }
    }

    // Social fee claim — layout: disc(8), timestamp(8), user_id(borsh str), platform(u8),
    //   social_fee_pda(32), recipient(32), social_claim_authority(32), amount(8), ...
    if (disc === DISC_CLAIM) {
      let offset = 8 + 8 // skip disc + timestamp
      const { value: userId, nextOffset: o1 } = readBorshString(bytes, offset)
      const platform = bytes[o1] // 2 = GitHub, 1 = Twitter/X per PumpFee program
      offset = o1 + 1 + 32 // skip platform + social_fee_pda
      const wallet = bytes.length >= offset + 32 ? readPubkey(bytes, offset) : ''
      return {
        type: 'claim',
        mint: '', // resolved via SocialFeeIndex; unavailable from log alone
        github: platform === 2 ? userId : undefined,
        twitter: platform === 1 ? userId : undefined,
        wallet,
        timestamp: now,
        signature,
      }
    }
  } catch {
    // ignore parse errors on malformed log data
  }

  return null
}

// ── Event monitor ───────────────────────────────────────────────────────────

/**
 * Subscribe to real-time pump.fun on-chain events.
 * Uses Connection.onLogs (WebSocket) with poll fallback.
 * Returns a cleanup function.
 */
export function watchPumpEvents(
  options: EventMonitorOptions,
  onEvent: (event: PumpEvent) => void | Promise<void>,
): () => void {
  const { connection, eventTypes, mints, pollIntervalMs = 2000 } = options

  const passes = (event: PumpEvent): boolean => {
    if (eventTypes && !eventTypes.includes(event.type)) return false
    if (mints && 'mint' in event && event.mint && !mints.includes(event.mint)) return false
    return true
  }

  const seen = new Set<string>()
  let running = true
  let wsSubIds: number[] = []
  let pollTimer: ReturnType<typeof setInterval> | undefined

  const trimSeen = () => {
    if (seen.size > 10_000) {
      const arr = [...seen]
      seen.clear()
      arr.slice(-5_000).forEach((s) => seen.add(s))
    }
  }

  const processLogs = async (logs: Logs) => {
    const { signature, logs: lines, err } = logs
    if (err || seen.has(signature)) return
    seen.add(signature)
    trimSeen()

    for (const line of lines) {
      const event = decodePumpLog(line, signature)
      if (event && passes(event)) {
        try { await onEvent(event) } catch { /* don't crash the subscription */ }
      }
    }
  }

  const startPolling = () => {
    let lastSigMain: string | undefined
    let lastSigAmm: string | undefined

    const pollProgram = async (
      program: PublicKey,
      lastSig: string | undefined,
      setLastSig: (s: string) => void,
    ) => {
      const sigs = await connection.getSignaturesForAddress(program, { limit: 20, until: lastSig })
      if (!sigs.length) return
      setLastSig(sigs[0]!.signature)

      for (const sigInfo of [...sigs].reverse()) {
        if (sigInfo.err || seen.has(sigInfo.signature)) continue
        seen.add(sigInfo.signature)
        trimSeen()

        const tx = await connection.getTransaction(sigInfo.signature, {
          maxSupportedTransactionVersion: 0,
          commitment: 'confirmed',
        })
        if (!tx?.meta?.logMessages) continue

        for (const line of tx.meta.logMessages) {
          const event = decodePumpLog(line, sigInfo.signature)
          if (event && passes(event)) {
            try { await onEvent(event) } catch { /* don't crash the poll loop */ }
          }
        }
      }
    }

    pollTimer = setInterval(async () => {
      if (!running) return
      try {
        await pollProgram(PUMP_PROGRAM, lastSigMain, (s) => { lastSigMain = s })
        await pollProgram(PUMP_AMM_PROGRAM, lastSigAmm, (s) => { lastSigAmm = s })
      } catch { /* ignore transient RPC errors */ }
    }, pollIntervalMs)
  }

  // Attempt WebSocket subscriptions; fall back to polling on failure
  try {
    wsSubIds.push(connection.onLogs(PUMP_PROGRAM, processLogs, 'confirmed'))
    wsSubIds.push(connection.onLogs(PUMP_AMM_PROGRAM, processLogs, 'confirmed'))
  } catch {
    wsSubIds = []
    startPolling()
  }

  return () => {
    running = false
    for (const id of wsSubIds) {
      connection.removeOnLogsListener(id).catch(() => {})
    }
    if (pollTimer) clearInterval(pollTimer)
  }
}
