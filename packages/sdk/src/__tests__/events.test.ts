import { describe, it, expect } from 'vitest'
import { BorshCoder, BN } from '@coral-xyz/anchor'
import { PublicKey } from '@solana/web3.js'
import { PUMP_SDK, pumpIdl } from '@pump-fun/pump-sdk'
import { decodePumpLog } from '../solana/events.js'

// The pump.fun IDL shipped with @pump-fun/pump-sdk 2.x is the source of truth: every
// event below is encoded with its borsh coder, then checked against both the SDK's
// own decoder and decodePumpLog.
const coder = new BorshCoder(pumpIdl as never)

// $THREE, the only real mint used here. Every other key is synthetic.
const MINT = new PublicKey('FeMbDoX7R1Psc4GEcvJdsbNbZA3bfztcyDCatJVJpump')
const key = (fill: number) => new PublicKey(new Uint8Array(32).fill(fill))
const USER = key(1)
const CREATOR = key(2)
const BONDING_CURVE = key(3)
const POOL = key(4)
const TOKEN_PROGRAM = key(5)
const SIG = 'synthetic-signature'
const TS = 1_780_000_000

function discriminator(eventName: string): Buffer {
  const event = pumpIdl.events?.find((e: { name: string }) => e.name === eventName)
  if (!event) throw new Error(`event ${eventName} missing from the pump IDL`)
  return Buffer.from(event.discriminator)
}

function encode(typeName: string, value: Record<string, unknown>): Buffer {
  return coder.types.encode(typeName, value)
}

function logLine(eventName: string, body: Buffer): string {
  return `Program data: ${Buffer.concat([discriminator(eventName), body]).toString('base64')}`
}

function createEventBody(overrides: Record<string, unknown> = {}): Buffer {
  return encode('CreateEvent', {
    name: 'Three',
    symbol: 'THREE',
    uri: 'https://three.ws/metadata.json',
    mint: MINT,
    bonding_curve: BONDING_CURVE,
    user: USER,
    creator: CREATOR,
    timestamp: new BN(TS),
    virtual_token_reserves: new BN('1073000000000000'),
    virtual_sol_reserves: new BN('30000000000'),
    real_token_reserves: new BN('793100000000000'),
    token_total_supply: new BN('1000000000000000'),
    token_program: TOKEN_PROGRAM,
    is_mayhem_mode: true,
    is_cashback_enabled: true,
    quote_mint: PublicKey.default,
    virtual_quote_reserves: new BN(0),
    creator_fee_bps: new BN(75),
    is_holder_reward: true,
    ...overrides,
  })
}

describe('decodePumpLog: CreateEvent', () => {
  it('uses the IDL CreateEvent discriminator, not the create instruction discriminators', () => {
    expect(discriminator('CreateEvent').toString('hex')).toBe('1b72a94ddeeb6376')
    const body = createEventBody()
    for (const ixDisc of ['d6904cec5f8b31b4', '181ec828051c0777']) {
      const line = `Program data: ${Buffer.concat([Buffer.from(ixDisc, 'hex'), body]).toString('base64')}`
      expect(decodePumpLog(line, SIG)).toBeNull()
    }
  })

  it('agrees with PUMP_SDK.decodeCreateEventBc on the full 2.0 layout', () => {
    const body = createEventBody()
    const sdk = PUMP_SDK.decodeCreateEventBc(body)
    const event = decodePumpLog(logLine('CreateEvent', body), SIG)

    expect(event).toEqual({
      type: 'launch',
      mint: sdk.mint.toBase58(),
      name: sdk.name,
      symbol: sdk.symbol,
      creator: sdk.creator.toBase58(),
      user: sdk.user.toBase58(),
      mayhemMode: sdk.isMayhemMode,
      cashback: sdk.isCashbackEnabled,
      holderReward: sdk.isHolderReward,
      creatorFeeBps: sdk.creatorFeeBps.toNumber(),
      timestamp: sdk.timestamp.toNumber(),
      signature: SIG,
    })
    // The creator and the signer are different wallets and must not be swapped.
    expect(event).toMatchObject({ creator: CREATOR.toBase58(), user: USER.toBase58() })
  })

  it('agrees with the SDK on events from deployments before creator_fee_bps and is_holder_reward', () => {
    const full = createEventBody({ creator_fee_bps: new BN(0), is_holder_reward: false })
    for (const missing of [1, 9]) {
      const body = full.subarray(0, full.length - missing)
      const sdk = PUMP_SDK.decodeCreateEventBc(body)
      const event = decodePumpLog(logLine('CreateEvent', body), SIG)
      expect(event).toMatchObject({
        type: 'launch',
        mint: sdk.mint.toBase58(),
        creator: sdk.creator.toBase58(),
        user: sdk.user.toBase58(),
        mayhemMode: sdk.isMayhemMode,
        cashback: sdk.isCashbackEnabled,
        holderReward: sdk.isHolderReward,
        creatorFeeBps: sdk.creatorFeeBps.toNumber(),
        timestamp: sdk.timestamp.toNumber(),
      })
      expect(event).toMatchObject({ holderReward: false, creatorFeeBps: 0 })
    }
  })

  it('decodes a truncated legacy CreateEvent that ends at the timestamp, with the new fields at their defaults', () => {
    const full = createEventBody()
    // Legacy layout: name, symbol, uri, mint, bonding_curve, user, creator, timestamp.
    const legacyLength = 8 + 4 + 5 + 4 + 5 + 4 + 'https://three.ws/metadata.json'.length + 4 * 32 + 8
    const body = full.subarray(0, legacyLength)
    const event = decodePumpLog(logLine('CreateEvent', body), SIG)

    expect(event).toEqual({
      type: 'launch',
      mint: MINT.toBase58(),
      name: 'Three',
      symbol: 'THREE',
      creator: CREATOR.toBase58(),
      user: USER.toBase58(),
      mayhemMode: false,
      cashback: false,
      holderReward: false,
      creatorFeeBps: 0,
      timestamp: TS,
      signature: SIG,
    })
  })
})

describe('decodePumpLog: graduation events', () => {
  it('agrees with PUMP_SDK.decodeCompleteEventBc for CompleteEvent', () => {
    const body = encode('CompleteEvent', {
      user: USER,
      mint: MINT,
      bonding_curve: BONDING_CURVE,
      timestamp: new BN(TS),
      quote_mint: PublicKey.default,
    })
    const sdk = PUMP_SDK.decodeCompleteEventBc(body)
    expect(decodePumpLog(logLine('CompleteEvent', body), SIG)).toEqual({
      type: 'graduation',
      mint: sdk.mint.toBase58(),
      pool: '',
      timestamp: sdk.timestamp.toNumber(),
      signature: SIG,
    })
  })

  it('reports the pool and the real timestamp for CompletePumpAmmMigrationEvent', () => {
    const body = encode('CompletePumpAmmMigrationEvent', {
      user: USER,
      mint: MINT,
      mint_amount: new BN('206900000000000'),
      sol_amount: new BN('84990359252'),
      pool_migration_fee: new BN('15000001'),
      bonding_curve: BONDING_CURVE,
      timestamp: new BN(TS),
      pool: POOL,
      quote_mint: PublicKey.default,
    })
    const idlDecoded = coder.types.decode('CompletePumpAmmMigrationEvent', body)
    expect(decodePumpLog(logLine('CompletePumpAmmMigrationEvent', body), SIG)).toEqual({
      type: 'graduation',
      mint: idlDecoded.mint.toBase58(),
      pool: idlDecoded.pool.toBase58(),
      timestamp: idlDecoded.timestamp.toNumber(),
      signature: SIG,
    })
    expect(idlDecoded.pool.toBase58()).toBe(POOL.toBase58())
    expect(idlDecoded.timestamp.toNumber()).toBe(TS)
  })
})

describe('decodePumpLog: TradeEvent', () => {
  it('agrees with PUMP_SDK.decodeTradeEventBc', () => {
    const body = encode('TradeEvent', {
      mint: MINT,
      sol_amount: new BN('1500000000'),
      token_amount: new BN('35000000000000'),
      is_buy: true,
      user: USER,
      timestamp: new BN(TS),
      virtual_sol_reserves: new BN('31500000000'),
      virtual_token_reserves: new BN('1038000000000000'),
      real_sol_reserves: new BN('1500000000'),
      real_token_reserves: new BN('758100000000000'),
      fee_recipient: key(6),
      fee_basis_points: new BN(95),
      fee: new BN(14250000),
      creator: CREATOR,
      creator_fee_basis_points: new BN(30),
      creator_fee: new BN(4500000),
      track_volume: true,
      total_unclaimed_tokens: new BN(0),
      total_claimed_tokens: new BN(0),
      current_sol_volume: new BN('1500000000'),
      last_update_timestamp: new BN(TS),
      ix_name: 'buy',
      mayhem_mode: false,
      cashback_fee_basis_points: new BN(0),
      cashback: new BN(0),
      buyback_fee_basis_points: new BN(0),
      buyback_fee: new BN(0),
      shareholders: [],
      quote_mint: PublicKey.default,
      quote_amount: new BN(0),
      virtual_quote_reserves: new BN(0),
      real_quote_reserves: new BN(0),
      holder_rewards_bps: new BN(0),
      holder_rewards: new BN(0),
    })
    const sdk = PUMP_SDK.decodeTradeEventBc(body)
    expect(decodePumpLog(logLine('TradeEvent', body), SIG)).toEqual({
      type: 'trade',
      mint: sdk.mint.toBase58(),
      side: sdk.isBuy ? 'buy' : 'sell',
      sol: sdk.solAmount.toNumber() / 1_000_000_000,
      tokens: sdk.tokenAmount.toNumber(),
      wallet: sdk.user.toBase58(),
      timestamp: sdk.timestamp.toNumber(),
      signature: SIG,
    })
  })
})

describe('decodePumpLog: DistributeFeeToHoldersEvent', () => {
  it('emits holder_reward_distribution matching PUMP_SDK.decodeDistributeFeeToHoldersEvent', () => {
    const body = encode('DistributeFeeToHoldersEvent', {
      timestamp: new BN(TS),
      mint: MINT,
      quote_mint: PublicKey.default,
      recipients: new BN(128),
      total: new BN('2500000000'),
    })
    const sdk = PUMP_SDK.decodeDistributeFeeToHoldersEvent(body)
    expect(decodePumpLog(logLine('DistributeFeeToHoldersEvent', body), SIG)).toEqual({
      type: 'holder_reward_distribution',
      mint: sdk.mint.toBase58(),
      quoteMint: sdk.quoteMint.toBase58(),
      recipients: sdk.recipients.toNumber(),
      total: sdk.total.toNumber(),
      timestamp: sdk.timestamp.toNumber(),
      signature: SIG,
    })
  })
})

describe('decodePumpLog: non-event lines', () => {
  it('ignores ordinary log lines and unknown discriminators', () => {
    expect(decodePumpLog('Program log: Instruction: Buy', SIG)).toBeNull()
    expect(decodePumpLog(`Program data: ${Buffer.alloc(40).toString('base64')}`, SIG)).toBeNull()
  })
})
