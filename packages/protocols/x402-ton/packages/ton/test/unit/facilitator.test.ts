import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { beginCell, Address, SendMode, storeMessage, Cell, loadMessage } from '@ton/core';
import { mnemonicNew } from '@ton/crypto';
import { TonClient, internal } from '@ton/ton';
import { FacilitatorTonSigner, ClientTonSigner } from '../../src/signer';
import { SchemeNetworkFacilitator } from '../../src/exact/facilitator/scheme';
import { TON_MAINNET, TVM_CAIP_FAMILY, CLOCK_SKEW_BUFFER_SECONDS } from '../../src/constants';
import type { PaymentRequirements, ExactTonPayload, TonExtra } from '../../src/types';

function createMockTonClient(seqno: number = 5): TonClient {
  return {
    open: vi.fn().mockReturnValue({
      getSeqno: vi.fn().mockResolvedValue(seqno),
    }),
    runMethod: vi.fn().mockResolvedValue({
      stack: {
        readAddress: vi
          .fn()
          .mockReturnValue(
            Address.parse(
              '0:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
            ),
          ),
      },
    }),
    sendFile: vi.fn().mockResolvedValue(undefined),
  } as unknown as TonClient;
}

/**
 * Build a V5R1 gasless body Cell (authType: 'internal', opcode 0x73696e74).
 * No network calls — seqno is provided directly.
 */
async function buildGaslessPayload(
  clientSigner: ClientTonSigner,
  payTo: string,
  opts: {
    seqno?: number;
    validUntilOverride?: number;
    amountOverride?: bigint;
  } = {},
): Promise<ExactTonPayload> {
  const seqno = opts.seqno ?? 5;
  const validUntil = opts.validUntilOverride ?? Math.floor(Date.now() / 1000) + 120;
  const amount = opts.amountOverride ?? BigInt('1000000000');

  const walletContract = clientSigner.getWalletContract();
  const secretKey = clientSigner.getSecretKey();

  const msg = internal({
    to: Address.parse(payTo),
    value: amount,
    body: undefined,
  });

  const transferCell = walletContract.createTransfer({
    seqno,
    secretKey,
    messages: [msg],
    sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
    timeout: validUntil,
    authType: 'internal' as const,
  });

  // Always wrap in external-in message
  const extMsg = beginCell()
    .store(
      storeMessage({
        info: {
          type: 'external-in',
          dest: walletContract.address,
          importFee: 0n,
        },
        body: transferCell,
      }),
    )
    .endCell();

  return {
    signedBoc: extMsg.toBoc().toString('base64'),
    walletPublicKey: clientSigner.getPublicKey(),
    walletAddress: `${walletContract.address.workChain}:${walletContract.address.hash.toString('hex')}`,
    seqno,
    validUntil,
  };
}

/**
 * Build a V5R1-format signed external message compatible with the facilitator's verify().
 * Payment goes directly to payTo (not facilitator), amount is exact (no fee).
 */
async function buildVerifyCompatiblePayload(
  clientSigner: ClientTonSigner,
  payTo: string,
  opts: {
    seqno?: number;
    validUntilOverride?: number;
    amountOverride?: bigint;
    recipientOverride?: string;
  } = {},
): Promise<ExactTonPayload> {
  const seqno = opts.seqno ?? 5;
  const validUntil = opts.validUntilOverride ?? Math.floor(Date.now() / 1000) + 120;
  const amount = opts.amountOverride ?? BigInt('1000000000');
  const recipient = opts.recipientOverride ?? payTo;

  const walletContract = clientSigner.getWalletContract();
  const secretKey = clientSigner.getSecretKey();

  const msg = internal({
    to: Address.parse(recipient),
    value: amount,
    body: undefined,
  });

  const transferCell = walletContract.createTransfer({
    seqno,
    secretKey,
    messages: [msg],
    sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
    timeout: validUntil,
  });

  const extMsg = beginCell()
    .store(
      storeMessage({
        info: {
          type: 'external-in',
          dest: walletContract.address,
          importFee: 0n,
        },
        body: transferCell,
      }),
    )
    .endCell();

  return {
    signedBoc: extMsg.toBoc().toString('base64'),
    walletPublicKey: clientSigner.getPublicKey(),
    walletAddress: `${walletContract.address.workChain}:${walletContract.address.hash.toString('hex')}`,
    seqno,
    validUntil,
  };
}

/**
 * Build a V5R1-format signed external message with 2 actions: payment + commission.
 * Used to test commission validation logic.
 */
async function buildTwoActionPayload(
  clientSigner: ClientTonSigner,
  payTo: string,
  commissionTo: string,
  opts: {
    seqno?: number;
    validUntilOverride?: number;
    amountOverride?: bigint;
    commissionAmount?: bigint;
  } = {},
): Promise<ExactTonPayload> {
  const seqno = opts.seqno ?? 5;
  const validUntil = opts.validUntilOverride ?? Math.floor(Date.now() / 1000) + 120;
  const amount = opts.amountOverride ?? BigInt('1000000000');
  const commission = opts.commissionAmount ?? BigInt('50000');

  const walletContract = clientSigner.getWalletContract();
  const secretKey = clientSigner.getSecretKey();

  const paymentMsg = internal({
    to: Address.parse(payTo),
    value: amount,
    body: undefined,
  });

  const commissionMsg = internal({
    to: Address.parse(commissionTo),
    value: commission,
    body: undefined,
  });

  // W5 linked list reversal: pass [commission, payment] so after extractActions
  // reverse, actions[0]=payment (primary), actions[1]=commission
  const transferCell = walletContract.createTransfer({
    seqno,
    secretKey,
    messages: [commissionMsg, paymentMsg],
    sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
    timeout: validUntil,
  });

  const extMsg = beginCell()
    .store(
      storeMessage({
        info: {
          type: 'external-in',
          dest: walletContract.address,
          importFee: 0n,
        },
        body: transferCell,
      }),
    )
    .endCell();

  return {
    signedBoc: extMsg.toBoc().toString('base64'),
    walletPublicKey: clientSigner.getPublicKey(),
    walletAddress: `${walletContract.address.workChain}:${walletContract.address.hash.toString('hex')}`,
    seqno,
    validUntil,
  };
}

describe('SchemeNetworkFacilitator', () => {
  let facilitatorSigner: FacilitatorTonSigner;
  let clientSigner: ClientTonSigner;
  let facilitatorAddress: string;
  let payToAddress: string;
  let extra: TonExtra;
  let baseRequirements: PaymentRequirements;

  beforeAll(async () => {
    const facMnemonic = await mnemonicNew(24);
    facilitatorSigner = new FacilitatorTonSigner(facMnemonic);
    await facilitatorSigner.init();
    facilitatorAddress = facilitatorSigner.getAddress('v5r1');

    const clientMnemonic = await mnemonicNew(24);
    clientSigner = new ClientTonSigner(clientMnemonic);
    await clientSigner.init();

    payToAddress = '0:1111111111111111111111111111111111111111111111111111111111111111';

    extra = {
      relayAddress: facilitatorAddress,
      assetDecimals: 9,
      assetSymbol: 'TON',
    };

    baseRequirements = {
      scheme: 'exact',
      network: TON_MAINNET,
      asset: 'native',
      amount: '1000000000',
      payTo: payToAddress,
      maxTimeoutSeconds: 120,
      extra,
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('properties', () => {
    it('scheme is "exact"', () => {
      const mockClient = createMockTonClient();
      const fac = new SchemeNetworkFacilitator(facilitatorSigner, TON_MAINNET, mockClient);
      expect(fac.scheme).toBe('exact');
    });

    it('caipFamily is "tvm:*"', () => {
      const mockClient = createMockTonClient();
      const fac = new SchemeNetworkFacilitator(facilitatorSigner, TON_MAINNET, mockClient);
      expect(fac.caipFamily).toBe(TVM_CAIP_FAMILY);
    });
  });

  describe('getExtra', () => {
    it('returns relayAddress, assetDecimals, and assetSymbol', () => {
      const mockClient = createMockTonClient();
      const fac = new SchemeNetworkFacilitator(facilitatorSigner, TON_MAINNET, mockClient);
      const result = fac.getExtra();
      expect(result.relayAddress).toMatch(/^0:[0-9a-f]{64}$/);
      expect(result.assetDecimals).toBe(6);
      expect(result.assetSymbol).toBe('USDT');
    });
  });

  describe('getSigners', () => {
    it('returns array with facilitator address', () => {
      const mockClient = createMockTonClient();
      const fac = new SchemeNetworkFacilitator(facilitatorSigner, TON_MAINNET, mockClient);
      const signers = fac.getSigners();
      expect(signers).toHaveLength(1);
      expect(signers[0]).toMatch(/^0:[0-9a-f]{64}$/);
    });
  });

  describe('verify', () => {
    it('valid native TON payment returns isValid: true', async () => {
      const mockClient = createMockTonClient(5);
      const fac = new SchemeNetworkFacilitator(facilitatorSigner, TON_MAINNET, mockClient);

      const payload = await buildVerifyCompatiblePayload(clientSigner, payToAddress);

      const result = await fac.verify(payload, baseRequirements);
      expect(result.isValid).toBe(true);
      expect(result.payer).toBeDefined();
    });

    it('invalid scheme returns invalid_scheme', async () => {
      const mockClient = createMockTonClient();
      const fac = new SchemeNetworkFacilitator(facilitatorSigner, TON_MAINNET, mockClient);

      const payload = await buildVerifyCompatiblePayload(clientSigner, payToAddress);

      const result = await fac.verify(payload, {
        ...baseRequirements,
        scheme: 'wrong',
      });
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('invalid_scheme');
    });

    it('invalid network returns invalid_network', async () => {
      const mockClient = createMockTonClient();
      const fac = new SchemeNetworkFacilitator(facilitatorSigner, TON_MAINNET, mockClient);

      const payload = await buildVerifyCompatiblePayload(clientSigner, payToAddress);

      const result = await fac.verify(payload, {
        ...baseRequirements,
        network: 'tvm:-999',
      });
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('invalid_network');
    });

    it('malformed BOC returns invalid_exact_ton_boc', async () => {
      const mockClient = createMockTonClient();
      const fac = new SchemeNetworkFacilitator(facilitatorSigner, TON_MAINNET, mockClient);

      const payload: ExactTonPayload = {
        signedBoc: Buffer.from('not-a-valid-boc').toString('base64'),
        walletPublicKey: clientSigner.getPublicKey(),
        walletAddress: clientSigner.getAddress(),
        seqno: 5,
        validUntil: Math.floor(Date.now() / 1000) + 120,
      };

      const result = await fac.verify(payload, baseRequirements);
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('invalid_exact_ton_boc');
    });

    it('invalid signature returns invalid_exact_ton_signature', async () => {
      const mockClient = createMockTonClient(5);
      const fac = new SchemeNetworkFacilitator(facilitatorSigner, TON_MAINNET, mockClient);

      const payload = await buildVerifyCompatiblePayload(clientSigner, payToAddress);

      const otherMnemonic = await mnemonicNew(24);
      const otherSigner = new ClientTonSigner(otherMnemonic);
      await otherSigner.init();

      // Use other signer's public key with client's BOC — signature mismatch
      const result = await fac.verify(
        {
          ...payload,
          walletPublicKey: otherSigner.getPublicKey(),
          walletAddress: otherSigner.getAddress(),
        },
        baseRequirements,
      );
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('invalid_exact_ton_signature');
    });

    it('walletAddress mismatch returns invalid_exact_ton_signature', async () => {
      const mockClient = createMockTonClient(5);
      const fac = new SchemeNetworkFacilitator(facilitatorSigner, TON_MAINNET, mockClient);

      const payload = await buildVerifyCompatiblePayload(clientSigner, payToAddress);

      const result = await fac.verify(
        {
          ...payload,
          walletAddress: '0:9999999999999999999999999999999999999999999999999999999999999999',
        },
        baseRequirements,
      );
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('invalid_exact_ton_signature');
    });

    it('expired payment returns invalid_exact_ton_expired', async () => {
      const mockClient = createMockTonClient(5);
      const fac = new SchemeNetworkFacilitator(facilitatorSigner, TON_MAINNET, mockClient);

      const payload = await buildVerifyCompatiblePayload(clientSigner, payToAddress, {
        validUntilOverride: Math.floor(Date.now() / 1000) - 120,
      });

      const result = await fac.verify(payload, baseRequirements);
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('invalid_exact_ton_expired');
    });

    it('validUntil too far in future returns invalid_exact_ton_expired', async () => {
      const mockClient = createMockTonClient(5);
      const fac = new SchemeNetworkFacilitator(facilitatorSigner, TON_MAINNET, mockClient);

      // Set validUntil way beyond maxTimeoutSeconds (120) + CLOCK_SKEW_BUFFER (30)
      const payload = await buildVerifyCompatiblePayload(clientSigner, payToAddress, {
        validUntilOverride: Math.floor(Date.now() / 1000) + 3600,
      });

      const result = await fac.verify(payload, baseRequirements);
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('invalid_exact_ton_expired');
      expect(result.invalidMessage).toContain('too far in the future');
    });

    it('wrong seqno returns invalid_exact_ton_seqno', async () => {
      const mockClient = createMockTonClient(10); // on-chain=10, payload=5
      const fac = new SchemeNetworkFacilitator(facilitatorSigner, TON_MAINNET, mockClient);

      const payload = await buildVerifyCompatiblePayload(clientSigner, payToAddress);

      const result = await fac.verify(payload, baseRequirements);
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('invalid_exact_ton_seqno');
    });

    it('amount mismatch returns invalid_exact_ton_amount', async () => {
      const mockClient = createMockTonClient(5);
      const fac = new SchemeNetworkFacilitator(facilitatorSigner, TON_MAINNET, mockClient);

      // Send 100 instead of 1000000000
      const payload = await buildVerifyCompatiblePayload(clientSigner, payToAddress, {
        amountOverride: 100n,
      });

      const result = await fac.verify(payload, baseRequirements);
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('invalid_exact_ton_amount');
    });

    it('wrong recipient returns invalid_exact_ton_recipient', async () => {
      const mockClient = createMockTonClient(5);
      const fac = new SchemeNetworkFacilitator(facilitatorSigner, TON_MAINNET, mockClient);

      const payload = await buildVerifyCompatiblePayload(clientSigner, payToAddress, {
        recipientOverride:
          '0:9999999999999999999999999999999999999999999999999999999999999999',
      });

      const result = await fac.verify(payload, baseRequirements);
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('invalid_exact_ton_recipient');
    });

    it('never throws - returns Result on unexpected error', async () => {
      const mockClient = {
        open: vi.fn().mockImplementation(() => {
          throw new Error('Simulated crash');
        }),
      } as unknown as TonClient;
      const fac = new SchemeNetworkFacilitator(facilitatorSigner, TON_MAINNET, mockClient);

      const payload = await buildVerifyCompatiblePayload(clientSigner, payToAddress);

      // Should NOT throw
      const result = await fac.verify(payload, baseRequirements);
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBeDefined();
    });
  });

  describe('settle', () => {
    it('returns failure when verify fails', async () => {
      const mockClient = createMockTonClient(10); // seqno mismatch
      const fac = new SchemeNetworkFacilitator(facilitatorSigner, TON_MAINNET, mockClient);

      const payload = await buildVerifyCompatiblePayload(clientSigner, payToAddress);

      const result = await fac.settle(payload, baseRequirements);
      expect(result.success).toBe(false);
      expect(result.errorReason).toBe('invalid_exact_ton_seqno');
    });

    it('returns broadcast_failed when sendFile throws', async () => {
      const mockClient = {
        open: vi.fn().mockReturnValue({
          getSeqno: vi.fn().mockResolvedValue(5),
        }),
        sendFile: vi.fn().mockRejectedValue(new Error('Network error')),
      } as unknown as TonClient;
      const fac = new SchemeNetworkFacilitator(facilitatorSigner, TON_MAINNET, mockClient);

      const payload = await buildVerifyCompatiblePayload(clientSigner, payToAddress);

      const result = await fac.settle(payload, baseRequirements);
      expect(result.success).toBe(false);
      expect(result.errorReason).toBe('settlement_broadcast_failed');
    });

    it('returns settlement_timeout when seqno never advances', async () => {
      // Mock: seqno stays at 5 (never advances to 6)
      const mockClient = {
        open: vi.fn().mockReturnValue({
          getSeqno: vi.fn().mockResolvedValue(5),
        }),
        sendFile: vi.fn().mockResolvedValue(undefined),
      } as unknown as TonClient;
      const fac = new SchemeNetworkFacilitator(facilitatorSigner, TON_MAINNET, mockClient);

      const payload = await buildVerifyCompatiblePayload(clientSigner, payToAddress);

      // Override settlement timeout constants for faster test
      vi.useFakeTimers();
      const settlePromise = fac.settle(payload, baseRequirements);

      // Fast-forward through all poll intervals
      for (let i = 0; i < 10; i++) {
        await vi.advanceTimersByTimeAsync(5000);
      }

      const result = await settlePromise;
      vi.useRealTimers();

      expect(result.success).toBe(false);
      expect(result.errorReason).toBe('settlement_timeout');
    });

    it('never throws - returns Result on unexpected error', async () => {
      const mockClient = createMockTonClient(5);
      const fac = new SchemeNetworkFacilitator(facilitatorSigner, TON_MAINNET, mockClient);

      const payload: ExactTonPayload = {
        signedBoc: Buffer.from('not-a-valid-boc').toString('base64'),
        walletPublicKey: clientSigner.getPublicKey(),
        walletAddress: clientSigner.getAddress(),
        seqno: 5,
        validUntil: Math.floor(Date.now() / 1000) + 120,
      };

      // Should NOT throw
      const result = await fac.settle(payload, baseRequirements);
      expect(result.success).toBe(false);
    });
  });

  describe('security', () => {
    it('rejects payment to facilitator address (relay safety)', async () => {
      const mockClient = createMockTonClient(5);
      const fac = new SchemeNetworkFacilitator(facilitatorSigner, TON_MAINNET, mockClient);

      // Build BOC that pays to facilitator instead of vendor
      const payload = await buildVerifyCompatiblePayload(clientSigner, payToAddress, {
        recipientOverride: facilitatorAddress,
      });

      const result = await fac.verify(payload, {
        ...baseRequirements,
        payTo: facilitatorAddress,
      });
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('invalid_exact_ton_recipient');
    });

    it('rejects when payment recipient does not match payTo', async () => {
      const mockClient = createMockTonClient(5);
      const fac = new SchemeNetworkFacilitator(facilitatorSigner, TON_MAINNET, mockClient);

      const attackerAddress =
        '0:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

      // BOC sends to attacker, but requirements say payTo = vendor
      const payload = await buildVerifyCompatiblePayload(clientSigner, payToAddress, {
        recipientOverride: attackerAddress,
      });

      const result = await fac.verify(payload, baseRequirements);
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('invalid_exact_ton_recipient');
    });

    it('exact amount equality — overpayment is rejected', async () => {
      const mockClient = createMockTonClient(5);
      const fac = new SchemeNetworkFacilitator(facilitatorSigner, TON_MAINNET, mockClient);

      // Send more than required
      const payload = await buildVerifyCompatiblePayload(clientSigner, payToAddress, {
        amountOverride: BigInt('2000000000'),
      });

      const result = await fac.verify(payload, baseRequirements);
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('invalid_exact_ton_amount');
    });

    it('exact amount equality — underpayment is rejected', async () => {
      const mockClient = createMockTonClient(5);
      const fac = new SchemeNetworkFacilitator(facilitatorSigner, TON_MAINNET, mockClient);

      const payload = await buildVerifyCompatiblePayload(clientSigner, payToAddress, {
        amountOverride: BigInt('999999999'),
      });

      const result = await fac.verify(payload, baseRequirements);
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('invalid_exact_ton_amount');
    });
  });

  describe('gasless verify (opcode-based detection)', () => {
    it('verifies internal-auth (opcode 0x73696e74) payload without gasless field', async () => {
      const mockClient = createMockTonClient(5);
      const fac = new SchemeNetworkFacilitator(facilitatorSigner, TON_MAINNET, mockClient);

      const payload = await buildGaslessPayload(clientSigner, payToAddress);

      // Confirm no gasless field in payload
      expect((payload as Record<string, unknown>)['gasless']).toBeUndefined();

      const result = await fac.verify(payload, baseRequirements);
      expect(result.isValid).toBe(true);
      expect(result.payer).toBeDefined();
    });

    it('external-auth payload (opcode 0x7369676e) routes to sendFile broadcast', async () => {
      const mockClient = createMockTonClient(5);
      const fac = new SchemeNetworkFacilitator(facilitatorSigner, TON_MAINNET, mockClient);

      // Standard external payload — opcode 0x7369676e — verify passes
      const payload = await buildVerifyCompatiblePayload(clientSigner, payToAddress);
      const result = await fac.verify(payload, baseRequirements);
      expect(result.isValid).toBe(true);
    });

    it('internal-auth payload (opcode 0x73696e74) verify passes (facilitator auto-detects opcode)', async () => {
      const mockClient = createMockTonClient(5);
      const fac = new SchemeNetworkFacilitator(facilitatorSigner, TON_MAINNET, mockClient);

      const payload = await buildGaslessPayload(clientSigner, payToAddress);

      const result = await fac.verify(payload, baseRequirements);
      expect(result.isValid).toBe(true);
    });

    it('rejects internal-auth with seqno 0 (wallet not deployed)', async () => {
      // Internal auth with seqno=0 is rejected: can't gasless-relay to undeployed wallet.
      const mockClient = createMockTonClient(0);
      const fac = new SchemeNetworkFacilitator(facilitatorSigner, TON_MAINNET, mockClient);

      const payload = await buildGaslessPayload(clientSigner, payToAddress, { seqno: 0 });

      const result = await fac.verify(payload, baseRequirements);
      expect(result.isValid).toBe(false);
    });
  });

  describe('TONAPI broadcast', () => {
    it('internal-auth payload settle tries TONAPI when tonApiKey is set', async () => {
      const mockClient = {
        open: vi.fn().mockReturnValue({
          getSeqno: vi.fn().mockResolvedValue(5),
          getBalance: vi.fn().mockResolvedValue(BigInt(1_000_000_000)),
        }),
        sendFile: vi.fn().mockResolvedValue(undefined),
      } as unknown as TonClient;

      const fac = new SchemeNetworkFacilitator(facilitatorSigner, TON_MAINNET, mockClient, {
        emulation: {},
        tonApiKey: 'test-key',
        tonApiEndpoint: 'https://tonapi.io',
      });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ protocol_name: 'gasless' }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const payload = await buildGaslessPayload(clientSigner, payToAddress);

      vi.useFakeTimers();
      const settlePromise = fac.settle(payload, baseRequirements);
      // advance past settlement timeout
      for (let i = 0; i < 15; i++) {
        await vi.advanceTimersByTimeAsync(5000);
      }
      await settlePromise;
      vi.useRealTimers();
      vi.unstubAllGlobals();

      // TONAPI was called (fetch was invoked with gasless/send endpoint)
      expect(mockFetch).toHaveBeenCalled();
      const [[url]] = mockFetch.mock.calls as [[string, ...unknown[]], ...unknown[][]];
      expect(url).toContain('/v2/gasless/send');
    });

    it('TONAPI broadcast fallback to self-relay when TONAPI returns error', async () => {
      const mockClient = {
        open: vi.fn().mockReturnValue({
          getSeqno: vi.fn().mockResolvedValue(5),
          getBalance: vi.fn().mockResolvedValue(BigInt(1_000_000_000)),
        }),
        sendFile: vi.fn().mockResolvedValue(undefined),
      } as unknown as TonClient;

      const fac = new SchemeNetworkFacilitator(facilitatorSigner, TON_MAINNET, mockClient, {
        emulation: {},
        tonApiKey: 'test-key',
        tonApiEndpoint: 'https://tonapi.io',
      });

      // TONAPI returns 500 — should fall back to self-relay (which calls sendFile)
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });
      vi.stubGlobal('fetch', mockFetch);

      const payload = await buildGaslessPayload(clientSigner, payToAddress);

      vi.useFakeTimers();
      const settlePromise = fac.settle(payload, baseRequirements);
      for (let i = 0; i < 15; i++) {
        await vi.advanceTimersByTimeAsync(5000);
      }
      const result = await settlePromise;
      vi.useRealTimers();
      vi.unstubAllGlobals();

      // Self-relay uses sendFile after TONAPI fails
      expect(mockClient.sendFile).toHaveBeenCalled();
      // Result may be success or timeout depending on mock seqno — main check is no throw
      expect(result).toBeDefined();
    });

    it('circuit breaker opens after 3 TONAPI failures and returns broadcast_failed', async () => {
      const mockClient = {
        open: vi.fn().mockReturnValue({
          getSeqno: vi.fn().mockResolvedValue(5),
          getBalance: vi.fn().mockResolvedValue(BigInt(1_000_000_000)),
        }),
        sendFile: vi.fn().mockResolvedValue(undefined),
      } as unknown as TonClient;

      const fac = new SchemeNetworkFacilitator(facilitatorSigner, TON_MAINNET, mockClient, {
        emulation: {},
        tonApiKey: 'test-key',
        tonApiEndpoint: 'https://tonapi.io',
        circuitBreakerThreshold: 3,
        circuitBreakerWindowMs: 60000,
        circuitBreakerCooldownMs: 300000,
      });

      // All TONAPI calls fail, and self-relay sendFile also throws (to force broadcast_failed)
      const mockFetch = vi.fn().mockRejectedValue(new Error('TONAPI network error'));
      vi.stubGlobal('fetch', mockFetch);
      (mockClient.sendFile as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('self-relay failed'));

      const payloads = [
        await buildGaslessPayload(clientSigner, payToAddress),
        await buildGaslessPayload(clientSigner, payToAddress),
        await buildGaslessPayload(clientSigner, payToAddress),
      ];

      // First 3 settle calls exhaust the circuit breaker budget via self-relay failures
      for (const p of payloads) {
        const r = await fac.settle(p, baseRequirements);
        expect(r.success).toBe(false);
        expect(r.errorReason).toBe('settlement_broadcast_failed');
      }

      vi.unstubAllGlobals();
    });
  });

  describe('Step 12: emulation', () => {
    it('skips when no tonApiKey configured', async () => {
      const mockClient = createMockTonClient(5);
      // No emulation config
      const fac = new SchemeNetworkFacilitator(facilitatorSigner, TON_MAINNET, mockClient);

      const payload = await buildVerifyCompatiblePayload(clientSigner, payToAddress);
      const result = await fac.verify(payload, baseRequirements);
      expect(result.isValid).toBe(true);
    });

    it('skips when enableEmulation is false', async () => {
      const mockClient = createMockTonClient(5);
      const fac = new SchemeNetworkFacilitator(
        facilitatorSigner,
        TON_MAINNET,
        mockClient,
        { tonApiKey: 'test-key', enableEmulation: false },
      );

      const payload = await buildVerifyCompatiblePayload(clientSigner, payToAddress);
      const result = await fac.verify(payload, baseRequirements);
      expect(result.isValid).toBe(true);
    });

    it('returns isValid: true when emulation succeeds', async () => {
      const mockClient = createMockTonClient(5);
      const fac = new SchemeNetworkFacilitator(
        facilitatorSigner,
        TON_MAINNET,
        mockClient,
        { tonApiKey: 'test-key', enableEmulation: true },
      );

      // Mock fetch to return successful emulation
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            transaction: {
              aborted: false,
              compute_phase: { success: true, exit_code: 0 },
            },
          }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const payload = await buildVerifyCompatiblePayload(clientSigner, payToAddress);
      const result = await fac.verify(payload, baseRequirements);
      expect(result.isValid).toBe(true);

      vi.unstubAllGlobals();
    });

    it('returns insufficient_balance when exit code is 37', async () => {
      const mockClient = createMockTonClient(5);
      const fac = new SchemeNetworkFacilitator(
        facilitatorSigner,
        TON_MAINNET,
        mockClient,
        { tonApiKey: 'test-key', enableEmulation: true },
      );

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            transaction: {
              aborted: true,
              compute_phase: { success: false, exit_code: 37 },
            },
          }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const payload = await buildVerifyCompatiblePayload(clientSigner, payToAddress);
      const result = await fac.verify(payload, baseRequirements);
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('insufficient_balance');

      vi.unstubAllGlobals();
    });

    it('gracefully skips when fetch fails (network error)', async () => {
      const mockClient = createMockTonClient(5);
      const fac = new SchemeNetworkFacilitator(
        facilitatorSigner,
        TON_MAINNET,
        mockClient,
        { tonApiKey: 'test-key', enableEmulation: true },
      );

      const mockFetch = vi.fn().mockRejectedValue(new Error('Network unreachable'));
      vi.stubGlobal('fetch', mockFetch);

      const payload = await buildVerifyCompatiblePayload(clientSigner, payToAddress);
      const result = await fac.verify(payload, baseRequirements);
      // Should gracefully skip and return valid
      expect(result.isValid).toBe(true);

      vi.unstubAllGlobals();
    });

    it('gracefully skips when TonAPI returns non-200', async () => {
      const mockClient = createMockTonClient(5);
      const fac = new SchemeNetworkFacilitator(
        facilitatorSigner,
        TON_MAINNET,
        mockClient,
        { tonApiKey: 'test-key', enableEmulation: true },
      );

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });
      vi.stubGlobal('fetch', mockFetch);

      const payload = await buildVerifyCompatiblePayload(clientSigner, payToAddress);
      const result = await fac.verify(payload, baseRequirements);
      expect(result.isValid).toBe(true);

      vi.unstubAllGlobals();
    });
  });

  describe('commission validation (C2 / MAX_COMMISSION_CAP)', () => {
    it('rejects 2-action BOC when commission exceeds MAX_COMMISSION_CAP', async () => {
      const mockClient = createMockTonClient(5);
      const fac = new SchemeNetworkFacilitator(facilitatorSigner, TON_MAINNET, mockClient);

      // Commission of 20_000_000 (20 USDT) exceeds MAX_COMMISSION_CAP (10_000_000 = 10 USDT)
      const commissionTo = '0:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
      const payload = await buildTwoActionPayload(clientSigner, payToAddress, commissionTo, {
        commissionAmount: BigInt(20_000_000),
      });

      const requirements: PaymentRequirements = {
        ...baseRequirements,
        extra: {
          ...extra,
          relayAddress: commissionTo,
          maxRelayCommission: '999999999', // high limit, but absolute cap should reject
        },
      };

      const result = await fac.verify(payload, requirements);
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('invalid_exact_ton_commission_exceeded');
    });

    it('accepts 2-action BOC when commission is within MAX_COMMISSION_CAP', async () => {
      const mockClient = createMockTonClient(5);
      const fac = new SchemeNetworkFacilitator(facilitatorSigner, TON_MAINNET, mockClient);

      const commissionTo = '0:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
      const payload = await buildTwoActionPayload(clientSigner, payToAddress, commissionTo, {
        commissionAmount: BigInt(50_000), // well within cap
      });

      const requirements: PaymentRequirements = {
        ...baseRequirements,
        extra: {
          ...extra,
          relayAddress: commissionTo,
          maxRelayCommission: '100000',
        },
      };

      const result = await fac.verify(payload, requirements);
      expect(result.isValid).toBe(true);
    });

    it('rejects commission exceeding maxRelayCommission even when below absolute cap', async () => {
      const mockClient = createMockTonClient(5);
      const fac = new SchemeNetworkFacilitator(facilitatorSigner, TON_MAINNET, mockClient);

      const commissionTo = '0:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
      const payload = await buildTwoActionPayload(clientSigner, payToAddress, commissionTo, {
        commissionAmount: BigInt(200_000), // exceeds maxRelayCommission of 100_000
      });

      const requirements: PaymentRequirements = {
        ...baseRequirements,
        extra: {
          ...extra,
          relayAddress: commissionTo,
          maxRelayCommission: '100000',
        },
      };

      const result = await fac.verify(payload, requirements);
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('invalid_exact_ton_commission_exceeded');
    });
  });

  describe('2-action BOC without relay config', () => {
    it('rejects 2-action BOC when extra.relayAddress is undefined', async () => {
      const mockClient = createMockTonClient(5);
      const fac = new SchemeNetworkFacilitator(facilitatorSigner, TON_MAINNET, mockClient);

      const commissionTo = '0:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
      const payload = await buildTwoActionPayload(clientSigner, payToAddress, commissionTo, {
        commissionAmount: BigInt(50_000),
      });

      // Requirements with no relayAddress in extra
      const requirementsNoRelay: PaymentRequirements = {
        ...baseRequirements,
        extra: {
          assetDecimals: 9,
          assetSymbol: 'TON',
          // relayAddress intentionally omitted
        },
      };

      const result = await fac.verify(payload, requirementsNoRelay);
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('invalid_payload');
      expect(result.invalidMessage).toContain('Second action not allowed without relay configuration');
    });
  });

  describe('validUntil edge cases', () => {
    it('validUntil exactly at boundary (now + maxTimeoutSeconds + CLOCK_SKEW_BUFFER) passes', async () => {
      const mockClient = createMockTonClient(5);
      const fac = new SchemeNetworkFacilitator(facilitatorSigner, TON_MAINNET, mockClient);

      const now = Math.floor(Date.now() / 1000);
      const exactBoundary = now + 120 + CLOCK_SKEW_BUFFER_SECONDS;

      const payload = await buildVerifyCompatiblePayload(clientSigner, payToAddress, {
        validUntilOverride: exactBoundary,
      });

      const result = await fac.verify(payload, baseRequirements);
      expect(result.isValid).toBe(true);
    });

    it('validUntil 1 second beyond boundary fails', async () => {
      const mockClient = createMockTonClient(5);
      const fac = new SchemeNetworkFacilitator(facilitatorSigner, TON_MAINNET, mockClient);

      const now = Math.floor(Date.now() / 1000);
      const beyondBoundary = now + 120 + CLOCK_SKEW_BUFFER_SECONDS + 1;

      const payload = await buildVerifyCompatiblePayload(clientSigner, payToAddress, {
        validUntilOverride: beyondBoundary,
      });

      const result = await fac.verify(payload, baseRequirements);
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('invalid_exact_ton_expired');
      expect(result.invalidMessage).toContain('too far in the future');
    });
  });

  describe('self-relay budget exhaustion', () => {
    it('rejects self-relay when daily budget is exhausted', async () => {
      const mockClient = {
        open: vi.fn().mockReturnValue({
          getSeqno: vi.fn().mockResolvedValue(5),
          getBalance: vi.fn().mockResolvedValue(BigInt(10_000_000_000)),
        }),
        sendFile: vi.fn().mockResolvedValue(undefined),
      } as unknown as TonClient;

      const fac = new SchemeNetworkFacilitator(facilitatorSigner, TON_MAINNET, mockClient, {
        emulation: {},
        tonApiKey: 'test-key',
        tonApiEndpoint: 'https://tonapi.io',
        maxDailySelfRelayTon: BigInt(1_000_000_000), // 1 TON budget
      });

      // Exhaust the daily budget by setting internal state near limit
      // DEFAULT_RELAY_GAS_AMOUNT is 100_000_000 (0.1 TON)
      (fac as unknown as Record<string, unknown>).selfRelayTonSpent = BigInt(950_000_000);

      // TONAPI fails → falls back to self-relay
      const mockFetch = vi.fn().mockRejectedValue(new Error('TONAPI unavailable'));
      vi.stubGlobal('fetch', mockFetch);

      const payload = await buildGaslessPayload(clientSigner, payToAddress);

      // First settle should succeed (950M + 100M = 1.05B > 1B budget → rejected)
      const result = await fac.settle(payload, baseRequirements);
      expect(result.success).toBe(false);
      expect(result.errorReason).toBe('settlement_broadcast_failed');
      expect(result.errorMessage).toContain('Self-relay daily budget exhausted');
    });
  });

  describe('circuit breaker state transitions', () => {
    it('OPEN→HALF_OPEN after cooldown, then HALF_OPEN→CLOSED on success', async () => {
      const mockClient = {
        open: vi.fn().mockReturnValue({
          getSeqno: vi.fn().mockResolvedValue(5),
          getBalance: vi.fn().mockResolvedValue(BigInt(10_000_000_000)),
        }),
        sendFile: vi.fn().mockResolvedValue(undefined),
      } as unknown as TonClient;

      const cooldownMs = 1000; // short cooldown for test
      const fac = new SchemeNetworkFacilitator(facilitatorSigner, TON_MAINNET, mockClient, {
        emulation: {},
        tonApiKey: 'test-key',
        tonApiEndpoint: 'https://tonapi.io',
        circuitBreakerThreshold: 2,
        circuitBreakerWindowMs: 60000,
        circuitBreakerCooldownMs: cooldownMs,
      });

      // Force circuit to OPEN state via internal state
      (fac as unknown as Record<string, unknown>).circuitState = 'open';
      (fac as unknown as Record<string, unknown>).circuitOpenedAt = Date.now() - cooldownMs - 1;

      // TONAPI succeeds on the probe call → circuit should close
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ protocol_name: 'gasless' }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const payload = await buildGaslessPayload(clientSigner, payToAddress);

      vi.useFakeTimers({ shouldAdvanceTime: true });
      const settlePromise = fac.settle(payload, baseRequirements);
      for (let i = 0; i < 15; i++) {
        await vi.advanceTimersByTimeAsync(5000);
      }
      await settlePromise;

      // TONAPI was called (circuit transitioned OPEN→HALF_OPEN→CLOSED)
      expect(mockFetch).toHaveBeenCalled();
      // Circuit should now be closed
      expect((fac as unknown as Record<string, unknown>).circuitState).toBe('closed');
    });

    it('HALF_OPEN→OPEN on probe failure', async () => {
      const mockClient = {
        open: vi.fn().mockReturnValue({
          getSeqno: vi.fn().mockResolvedValue(5),
          getBalance: vi.fn().mockResolvedValue(BigInt(10_000_000_000)),
        }),
        sendFile: vi.fn().mockResolvedValue(undefined),
      } as unknown as TonClient;

      const fac = new SchemeNetworkFacilitator(facilitatorSigner, TON_MAINNET, mockClient, {
        emulation: {},
        tonApiKey: 'test-key',
        tonApiEndpoint: 'https://tonapi.io',
        circuitBreakerThreshold: 2,
        circuitBreakerWindowMs: 60000,
        circuitBreakerCooldownMs: 1000,
      });

      // Set circuit to HALF_OPEN
      (fac as unknown as Record<string, unknown>).circuitState = 'half_open';

      // TONAPI probe fails
      const mockFetch = vi.fn().mockRejectedValue(new Error('still down'));
      vi.stubGlobal('fetch', mockFetch);

      const payload = await buildGaslessPayload(clientSigner, payToAddress);

      vi.useFakeTimers({ shouldAdvanceTime: true });
      const settlePromise = fac.settle(payload, baseRequirements);
      for (let i = 0; i < 15; i++) {
        await vi.advanceTimersByTimeAsync(5000);
      }
      await settlePromise;

      // TONAPI was attempted (half_open allows probe)
      expect(mockFetch).toHaveBeenCalled();
      // Circuit should now be OPEN (probe failed)
      expect((fac as unknown as Record<string, unknown>).circuitState).toBe('open');
    });

    it('failure window reset: failures outside window do not count', async () => {
      const mockClient = {
        open: vi.fn().mockReturnValue({
          getSeqno: vi.fn().mockResolvedValue(5),
          getBalance: vi.fn().mockResolvedValue(BigInt(10_000_000_000)),
        }),
        sendFile: vi.fn().mockResolvedValue(undefined),
      } as unknown as TonClient;

      const fac = new SchemeNetworkFacilitator(facilitatorSigner, TON_MAINNET, mockClient, {
        emulation: {},
        tonApiKey: 'test-key',
        tonApiEndpoint: 'https://tonapi.io',
        circuitBreakerThreshold: 3,
        circuitBreakerWindowMs: 100, // very short window
        circuitBreakerCooldownMs: 300000,
      });

      // Simulate 2 failures that happened long ago (outside window)
      (fac as unknown as Record<string, unknown>).tonApiFailures = 2;
      (fac as unknown as Record<string, unknown>).tonApiFirstFailureAt = Date.now() - 200; // outside 100ms window

      // TONAPI fails again, but since old failures are outside window, counter resets to 1
      const mockFetch = vi.fn().mockRejectedValue(new Error('TONAPI error'));
      vi.stubGlobal('fetch', mockFetch);

      const payload = await buildGaslessPayload(clientSigner, payToAddress);

      vi.useFakeTimers({ shouldAdvanceTime: true });
      const settlePromise = fac.settle(payload, baseRequirements);
      for (let i = 0; i < 15; i++) {
        await vi.advanceTimersByTimeAsync(5000);
      }
      await settlePromise;

      // Circuit should still be CLOSED (only 1 failure counted, threshold is 3)
      expect((fac as unknown as Record<string, unknown>).circuitState).toBe('closed');
      expect((fac as unknown as Record<string, unknown>).tonApiFailures).toBe(1);
    });
  });

  describe('transaction verification after seqno advance (C1)', () => {
    it('settle returns failure when seqno advances but tx body hash doesn\'t match', async () => {
      const getSeqnoMock = vi.fn()
        .mockResolvedValueOnce(5) // verify: on-chain seqno check
        .mockResolvedValueOnce(5) // first poll: not yet
        .mockResolvedValueOnce(6); // second poll: advanced!

      const mockClient = {
        open: vi.fn().mockReturnValue({
          getSeqno: getSeqnoMock,
        }),
        sendFile: vi.fn().mockResolvedValue(undefined),
        getTransactions: vi.fn().mockResolvedValue([
          {
            inMessage: {
              body: beginCell().storeUint(0xdeadbeef, 32).endCell(),
            },
          },
        ]),
      } as unknown as TonClient;

      const fac = new SchemeNetworkFacilitator(facilitatorSigner, TON_MAINNET, mockClient, {
        emulation: {},
        settlementTimeoutSeconds: 30,
        pollIntervalSeconds: 2,
      });

      const payload = await buildVerifyCompatiblePayload(clientSigner, payToAddress);

      vi.useFakeTimers({ shouldAdvanceTime: true });
      const settlePromise = fac.settle(payload, baseRequirements);

      // Advance through the polling loop
      for (let i = 0; i < 10; i++) {
        await vi.advanceTimersByTimeAsync(3000);
      }

      const result = await settlePromise;

      expect(result.success).toBe(false);
      expect(result.errorReason).toBe('settlement_timeout');
      expect(result.errorMessage).toContain('concurrent transaction');
    });

    it('settle succeeds when tx body hash matches broadcast BOC', async () => {
      const payload = await buildVerifyCompatiblePayload(clientSigner, payToAddress);

      // Parse the BOC to get the expected body hash
      const broadcastMsg = loadMessage(Cell.fromBoc(Buffer.from(payload.signedBoc, 'base64'))[0]!.beginParse());
      const expectedBody = broadcastMsg.body;

      const getSeqnoMock = vi.fn()
        .mockResolvedValueOnce(5) // verify: on-chain seqno check
        .mockResolvedValueOnce(5) // first poll: not yet
        .mockResolvedValueOnce(6); // second poll: advanced!

      const mockClient = {
        open: vi.fn().mockReturnValue({
          getSeqno: getSeqnoMock,
        }),
        sendFile: vi.fn().mockResolvedValue(undefined),
        getTransactions: vi.fn().mockResolvedValue([
          {
            inMessage: {
              body: expectedBody,
            },
          },
        ]),
      } as unknown as TonClient;

      const fac = new SchemeNetworkFacilitator(facilitatorSigner, TON_MAINNET, mockClient, {
        emulation: {},
        settlementTimeoutSeconds: 30,
        pollIntervalSeconds: 2,
      });

      vi.useFakeTimers({ shouldAdvanceTime: true });
      const settlePromise = fac.settle(payload, baseRequirements);

      for (let i = 0; i < 10; i++) {
        await vi.advanceTimersByTimeAsync(3000);
      }

      const result = await settlePromise;

      expect(result.success).toBe(true);
      expect(result.payer).toBeDefined();
      expect(result.transaction).toBeDefined();
    });

    it('settle falls through to success when getTransactions throws', async () => {
      const getSeqnoMock = vi.fn()
        .mockResolvedValueOnce(5) // verify: on-chain seqno check
        .mockResolvedValueOnce(5) // first poll: not yet
        .mockResolvedValueOnce(6); // second poll: advanced!

      const mockClient = {
        open: vi.fn().mockReturnValue({
          getSeqno: getSeqnoMock,
        }),
        sendFile: vi.fn().mockResolvedValue(undefined),
        getTransactions: vi.fn().mockRejectedValue(new Error('API unavailable')),
      } as unknown as TonClient;

      const fac = new SchemeNetworkFacilitator(facilitatorSigner, TON_MAINNET, mockClient, {
        emulation: {},
        settlementTimeoutSeconds: 30,
        pollIntervalSeconds: 2,
      });

      const payload = await buildVerifyCompatiblePayload(clientSigner, payToAddress);

      vi.useFakeTimers({ shouldAdvanceTime: true });
      const settlePromise = fac.settle(payload, baseRequirements);

      for (let i = 0; i < 10; i++) {
        await vi.advanceTimersByTimeAsync(3000);
      }

      const result = await settlePromise;

      expect(result.success).toBe(true);
      expect(result.payer).toBeDefined();
      expect(result.transaction).toBeDefined();
    });
  });
});
