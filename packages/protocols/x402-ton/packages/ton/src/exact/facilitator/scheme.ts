import { TonClient, WalletContractV5R1, internal, SendMode } from '@ton/ton';
import { Cell, beginCell, loadMessage, Address, storeMessage, type Slice } from '@ton/core';
import { signVerify } from '@ton/crypto';
import { TonSigner } from '../../signer';
import { X402ErrorCode } from '../../types';
import type {
  ExactTonPayload,
  TonExtra,
  PaymentRequirements,
  VerifyResponse,
  SettleResponse,
  EmulationConfig,
  X402ErrorCodeValue,
  BudgetPersistence,
} from '../../types';
import {
  NETWORK_CONFIG,
  CLOCK_SKEW_BUFFER_SECONDS,
  SETTLEMENT_TIMEOUT_SECONDS,
  POLL_INTERVAL_SECONDS,
  TVM_CAIP_FAMILY,
  TON_MAINNET,
  TON_API_MAINNET,
  TON_API_TESTNET,
  DEFAULT_EMULATION_TIMEOUT,
  DEFAULT_RELAY_GAS_AMOUNT,
  W5_CODE_HASH,
  TON_EXIT_INSUFFICIENT_FUNDS,
  TON_EXIT_INSUFFICIENT_FEES,
  TON_EXIT_ACTION_FAILED,
  JETTON_EXIT_INSUFFICIENT,
  GASLESS_SETTLEMENT_TIMEOUT_SECONDS,
  TONAPI_REQUEST_TIMEOUT_MS,
  CIRCUIT_BREAKER_THRESHOLD,
  CIRCUIT_BREAKER_WINDOW_MS,
  CIRCUIT_BREAKER_COOLDOWN_MS,
  MAX_DAILY_SELF_RELAY_TON,
  MAX_COMMISSION_CAP,
  JETTON_TRANSFER_OP,
  SELF_RELAY_TIMEOUT_SECONDS,
  BUDGET_RESET_INTERVAL_MS,
} from '../../constants';
import { validateBoc } from '../../utils';

/** W5 v5r1 opcode for external auth (direct broadcast) */
const OPCODE_EXTERNAL = 0x7369676e; // 'sign'
/** W5 v5r1 opcode for internal auth (gasless relay) */
const OPCODE_INTERNAL = 0x73696e74; // 'sint'

/** Minimal shape for TonAPI emulation trace results */
interface TraceResult {
  transaction?: {
    aborted?: boolean;
    compute_phase?: { exit_code?: number };
    computePhase?: { exit_code?: number };
  };
  children?: TraceResult[];
}

/** Circuit breaker states */
type CircuitState = 'closed' | 'open' | 'half_open';

/** Extended options for the facilitator */
interface FacilitatorOptions {
  emulation?: EmulationConfig;
  settlementTimeoutSeconds?: number;
  pollIntervalSeconds?: number;
  /** TONAPI base URL for gasless relay (defaults based on network) */
  tonApiEndpoint?: string;
  /** TONAPI authentication key (also used for emulation) */
  tonApiKey?: string;
  /** TONAPI request timeout in ms (default: 10000) */
  tonApiTimeoutMs?: number;
  /** Allowed TONAPI relay addresses (validated at runtime) */
  allowedRelayAddresses?: string[];
  /** Circuit breaker: consecutive failures to open (default: 3) */
  circuitBreakerThreshold?: number;
  /** Circuit breaker: window for counting failures in ms (default: 60000) */
  circuitBreakerWindowMs?: number;
  /** Circuit breaker: cooldown before half-open in ms (default: 300000) */
  circuitBreakerCooldownMs?: number;
  /** Maximum daily TON spend for self-relay in nanoTON (default: 1_000_000_000) */
  maxDailySelfRelayTon?: bigint;
  /** Optional persistence for self-relay budget state (survives restarts) */
  budgetPersistence?: BudgetPersistence;
}

/**
 * Facilitator-side x402 payment verification and settlement for TON.
 *
 * The facilitator is a RELAY, not a custodial intermediary.
 * It verifies signed BOCs (correct destination, amount, signature, seqno)
 * and broadcasts them to the network. It never receives or holds funds.
 *
 * Supports two broadcast paths based on BOC opcode:
 * - 0x7369676e (external auth): direct sendFile broadcast
 * - 0x73696e74 (internal auth): TONAPI gasless relay with self-relay fallback
 */
export class SchemeNetworkFacilitator {
  readonly scheme = 'exact';
  readonly caipFamily = TVM_CAIP_FAMILY;
  private readonly emulationConfig: EmulationConfig;
  private readonly settlementTimeout: number;
  private readonly pollInterval: number;
  private readonly tonApiEndpoint: string;
  private readonly tonApiKey: string | undefined;
  private readonly tonApiTimeoutMs: number;

  // Circuit breaker state
  private circuitState: CircuitState = 'closed';
  private tonApiFailures: number = 0;
  private tonApiFirstFailureAt: number = 0;
  private circuitOpenedAt: number = 0;
  private readonly cbThreshold: number;
  private readonly cbWindowMs: number;
  private readonly cbCooldownMs: number;

  // Self-relay daily budget
  private selfRelayTonSpent: bigint = 0n;
  private selfRelayBudgetResetAt: number = Date.now() + BUDGET_RESET_INTERVAL_MS;
  private readonly maxDailySelfRelayTon: bigint;
  private readonly budgetPersistence?: BudgetPersistence;

  constructor(
    private readonly signer: TonSigner,
    private readonly network: string,
    private readonly tonClient: TonClient,
    emulationConfigOrOptions?: EmulationConfig | FacilitatorOptions,
  ) {
    if (emulationConfigOrOptions && 'emulation' in emulationConfigOrOptions) {
      // New FacilitatorOptions format
      const opts = emulationConfigOrOptions;
      this.emulationConfig = opts.emulation ?? {};
      this.settlementTimeout = opts.settlementTimeoutSeconds ?? SETTLEMENT_TIMEOUT_SECONDS;
      this.pollInterval = opts.pollIntervalSeconds ?? POLL_INTERVAL_SECONDS;
      this.tonApiEndpoint = opts.tonApiEndpoint ?? (network === TON_MAINNET ? TON_API_MAINNET : TON_API_TESTNET);
      this.tonApiKey = opts.tonApiKey ?? this.emulationConfig.tonApiKey;
      this.tonApiTimeoutMs = opts.tonApiTimeoutMs ?? TONAPI_REQUEST_TIMEOUT_MS;
      this.cbThreshold = opts.circuitBreakerThreshold ?? CIRCUIT_BREAKER_THRESHOLD;
      this.cbWindowMs = opts.circuitBreakerWindowMs ?? CIRCUIT_BREAKER_WINDOW_MS;
      this.cbCooldownMs = opts.circuitBreakerCooldownMs ?? CIRCUIT_BREAKER_COOLDOWN_MS;
      this.maxDailySelfRelayTon = opts.maxDailySelfRelayTon ?? MAX_DAILY_SELF_RELAY_TON;
      this.budgetPersistence = opts.budgetPersistence;
      if (this.budgetPersistence) {
        const saved = this.budgetPersistence.load();
        if (saved) {
          this.selfRelayTonSpent = saved.spent;
          this.selfRelayBudgetResetAt = saved.resetAt;
        }
      }
    } else {
      // Legacy: plain EmulationConfig
      const legacy = (emulationConfigOrOptions as EmulationConfig) ?? {};
      this.emulationConfig = legacy;
      this.settlementTimeout = SETTLEMENT_TIMEOUT_SECONDS;
      this.pollInterval = POLL_INTERVAL_SECONDS;
      this.tonApiEndpoint = legacy.tonApiEndpoint ?? (network === TON_MAINNET ? TON_API_MAINNET : TON_API_TESTNET);
      this.tonApiKey = legacy.tonApiKey;
      this.tonApiTimeoutMs = TONAPI_REQUEST_TIMEOUT_MS;
      this.cbThreshold = CIRCUIT_BREAKER_THRESHOLD;
      this.cbWindowMs = CIRCUIT_BREAKER_WINDOW_MS;
      this.cbCooldownMs = CIRCUIT_BREAKER_COOLDOWN_MS;
      this.maxDailySelfRelayTon = MAX_DAILY_SELF_RELAY_TON;
    }
  }

  /**
   * Verify a payment BOC against payment requirements.
   * Returns a result object — never throws.
   */
  async verify(
    payload: ExactTonPayload,
    requirements: PaymentRequirements,
  ): Promise<VerifyResponse> {
    try {
      return await this.verifyInternal(payload, requirements);
    } catch {
      return {
        isValid: false,
        invalidReason: X402ErrorCode.invalid_boc,
        invalidMessage: 'Unexpected verification error',
      };
    }
  }

  private async verifyInternal(
    payload: ExactTonPayload,
    requirements: PaymentRequirements,
  ): Promise<VerifyResponse> {
    // Step 2: Validate scheme
    if (requirements.scheme !== 'exact') {
      return {
        isValid: false,
        invalidReason: X402ErrorCode.invalid_scheme,
        invalidMessage: `Expected scheme "exact", got "${requirements.scheme}"`,
      };
    }

    // Step 3: Validate network
    if (!NETWORK_CONFIG[requirements.network]) {
      return {
        isValid: false,
        invalidReason: X402ErrorCode.invalid_network,
        invalidMessage: `Unsupported network: ${requirements.network}`,
      };
    }

    // Step 4 & 5: Decode and validate BOC
    let rootCell: Cell;
    try {
      rootCell = validateBoc(payload.signedBoc);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      const reason =
        message === 'boc_depth_exceeded'
          ? X402ErrorCode.boc_depth_exceeded
          : message === 'boc_cells_exceeded'
            ? X402ErrorCode.boc_cells_exceeded
            : X402ErrorCode.invalid_boc;
      return {
        isValid: false,
        invalidReason: reason,
        invalidMessage: 'BOC validation failed',
      };
    }

    // Step 5b: Extract body from BOC — always parse as external-in message
    let bodyRoot: Cell;
    try {
      const msg = loadMessage(rootCell.beginParse());
      if (msg.info.type !== 'external-in') {
        return {
          isValid: false,
          invalidReason: X402ErrorCode.invalid_boc,
          invalidMessage: 'Expected external-in message',
        };
      }
      bodyRoot = msg.body;
    } catch {
      return {
        isValid: false,
        invalidReason: X402ErrorCode.invalid_boc,
        invalidMessage: 'Failed to parse external message from BOC',
      };
    }

    // Step 7: Verify Ed25519 signature (V5R1 format: signature at tail)
    if (!/^[0-9a-fA-F]{64}$/.test(payload.walletPublicKey)) {
      return {
        isValid: false,
        invalidReason: X402ErrorCode.invalid_signature,
        invalidMessage: 'walletPublicKey must be exactly 64 hex characters',
      };
    }
    const publicKey = Buffer.from(payload.walletPublicKey, 'hex');
    if (publicKey.length !== 32) {
      return {
        isValid: false,
        invalidReason: X402ErrorCode.invalid_signature,
        invalidMessage: 'Public key must be 32 bytes',
      };
    }

    let signature: Buffer;
    let signedBody: Cell;
    try {
      const slice = bodyRoot.beginParse();
      const bodyBitLength = slice.remainingBits - 512;
      const bodyBits = slice.loadBits(bodyBitLength);
      signature = slice.loadBuffer(64);
      const builder = beginCell();
      builder.storeBits(bodyBits);
      while (slice.remainingRefs > 0) {
        builder.storeRef(slice.loadRef());
      }
      signedBody = builder.endCell();
    } catch {
      return {
        isValid: false,
        invalidReason: X402ErrorCode.invalid_signature,
        invalidMessage: 'Failed to parse signature from external message',
      };
    }

    if (!signVerify(signedBody.hash(), signature, publicKey)) {
      return {
        isValid: false,
        invalidReason: X402ErrorCode.invalid_signature,
        invalidMessage: 'Ed25519 signature verification failed',
      };
    }

    // Step 8: Derive wallet address and cross-check payload
    const derivedWallet = this.deriveWalletContract(publicKey);
    const payer = `${derivedWallet.address.workChain}:${derivedWallet.address.hash.toString('hex')}`;

    if (payer !== payload.walletAddress) {
      return {
        isValid: false,
        invalidReason: X402ErrorCode.invalid_signature,
        invalidMessage: `Wallet address mismatch: derived ${payer}, payload ${payload.walletAddress}`,
        payer,
      };
    }

    // Step 9: Parse the signed body to extract opcode, validUntil, seqno
    // V5R1 body: opcode(32) + walletId(32) + validUntil(32) + seqno(32) + actions
    let validUntil: number;
    let seqno: number;
    let detectedOpcode: number;
    const bodySlice = signedBody.beginParse();
    try {
      detectedOpcode = bodySlice.loadUint(32);
      // Accept both opcodes — route based on detected value
      if (detectedOpcode !== OPCODE_EXTERNAL && detectedOpcode !== OPCODE_INTERNAL) {
        return {
          isValid: false,
          invalidReason: X402ErrorCode.invalid_boc,
          invalidMessage: `Unknown opcode 0x${detectedOpcode.toString(16)}, expected 0x7369676e or 0x73696e74`,
          payer,
        };
      }
      bodySlice.loadUint(32); // wallet_id
      validUntil = bodySlice.loadUint(32);
      seqno = bodySlice.loadUint(32);
    } catch {
      return {
        isValid: false,
        invalidReason: X402ErrorCode.invalid_boc,
        invalidMessage: 'Failed to parse valid_until/seqno from external message',
        payer,
      };
    }

    // Cross-check seqno and validUntil against payload fields
    if (seqno !== payload.seqno) {
      return {
        isValid: false,
        invalidReason: X402ErrorCode.seqno_mismatch,
        invalidMessage: `Seqno mismatch: BOC=${seqno}, payload=${payload.seqno}`,
        payer,
      };
    }

    if (validUntil !== payload.validUntil) {
      return {
        isValid: false,
        invalidReason: X402ErrorCode.expired,
        invalidMessage: `validUntil mismatch: BOC=${validUntil}, payload=${payload.validUntil}`,
        payer,
      };
    }

    // Step 9b/9c: Expiry checks
    const now = Math.floor(Date.now() / 1000);
    const isFirstDeploy = seqno === 0 && validUntil === 0xFFFFFFFF;
    const isGasless = detectedOpcode === OPCODE_INTERNAL;

    if (!isFirstDeploy) {
      if (validUntil <= now - CLOCK_SKEW_BUFFER_SECONDS) {
        return {
          isValid: false,
          invalidReason: X402ErrorCode.expired,
          invalidMessage: `Message expired: valid_until=${validUntil}, now=${now}`,
          payer,
        };
      }

      // For gasless (internal auth), TONAPI sets validUntil — allow up to 5 min
      // For external auth, enforce strict maxTimeoutSeconds
      const maxAllowed = isGasless ? 300 : requirements.maxTimeoutSeconds;
      if (validUntil > now + maxAllowed + CLOCK_SKEW_BUFFER_SECONDS) {
        return {
          isValid: false,
          invalidReason: X402ErrorCode.expired,
          invalidMessage: `validUntil too far in the future: ${validUntil} > now(${now}) + maxTimeout(${maxAllowed})`,
          payer,
        };
      }
    }

    // Step 10: Check seqno against on-chain
    try {
      const contract = this.tonClient.open(derivedWallet);
      let onChainSeqno: number;
      try {
        onChainSeqno = await contract.getSeqno();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '';
        const isUninitWallet =
          message.includes('exit_code: -13') ||
          message.includes('Unable to execute get method') ||
          message.includes('-256');
        if (isUninitWallet) {
          onChainSeqno = 0;
        } else {
          return {
            isValid: false,
            invalidReason: X402ErrorCode.seqno_mismatch,
            invalidMessage: 'Failed to fetch on-chain wallet state',
            payer,
          };
        }
      }
      if (seqno !== onChainSeqno) {
        return {
          isValid: false,
          invalidReason: X402ErrorCode.seqno_mismatch,
          invalidMessage: `Seqno mismatch: payload=${seqno}, on-chain=${onChainSeqno}`,
          payer,
        };
      }
    } catch {
      return {
        isValid: false,
        invalidReason: X402ErrorCode.seqno_mismatch,
        invalidMessage: 'Failed to fetch on-chain seqno',
        payer,
      };
    }

    // Step 10b: stateInit validation (if seqno === 0, new wallet — only for external auth)
    if (seqno === 0 && detectedOpcode === OPCODE_EXTERNAL) {
      const msg = loadMessage(rootCell.beginParse());
      if (!msg.init) {
        return {
          isValid: false,
          invalidReason: X402ErrorCode.invalid_state_init,
          invalidMessage: 'seqno is 0 but no stateInit provided — wallet cannot be deployed',
          payer,
        };
      }
      if (msg.init.code) {
        const codeHash = msg.init.code.hash().toString('hex');
        if (codeHash !== W5_CODE_HASH) {
          return {
            isValid: false,
            invalidReason: X402ErrorCode.invalid_state_init,
            invalidMessage: `stateInit code hash mismatch: got ${codeHash}, expected W5 v5r1`,
            payer,
          };
        }
      }
    }
    // Internal auth (gasless) with seqno=0 is invalid — can't relay to undeployed wallet
    if (seqno === 0 && detectedOpcode === OPCODE_INTERNAL) {
      return {
        isValid: false,
        invalidReason: X402ErrorCode.invalid_state_init,
        invalidMessage: 'Gasless requires an already-deployed wallet (seqno > 0)',
        payer,
      };
    }

    // Step 11: Parse actions and validate amount/recipient/asset
    const facilitatorAddress = this.signer.getAddress('v5r1');
    if (payer === facilitatorAddress) {
      return {
        isValid: false,
        invalidReason: X402ErrorCode.invalid_boc,
        invalidMessage: 'Payer cannot be the facilitator/relay',
        payer,
      };
    }

    const extra = requirements.extra;

    // Extract actions from W5 body
    let actions: Cell[];
    try {
      const hasActionsRef = bodySlice.loadBit();
      if (!hasActionsRef) {
        return {
          isValid: false,
          invalidReason: X402ErrorCode.invalid_boc,
          invalidMessage: 'No actions in V5R1 message',
          payer,
        };
      }
      actions = this.extractActions(bodySlice.loadRef());
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.startsWith('Invalid sendMode:')) {
        return {
          isValid: false,
          invalidReason: X402ErrorCode.invalid_payload,
          invalidMessage: msg,
          payer,
        };
      }
      return {
        isValid: false,
        invalidReason: X402ErrorCode.invalid_boc,
        invalidMessage: 'Failed to extract actions from payload',
        payer,
      };
    }

    // Must have 1 or 2 actions (payment + optional commission)
    if (actions.length === 0 || actions.length > 2) {
      return {
        isValid: false,
        invalidReason: X402ErrorCode.too_many_actions,
        invalidMessage: `Expected 1 or 2 actions, got ${actions.length}`,
        payer,
      };
    }

    // Validate actions: identify primary payment vs commission by destination
    // (TONAPI gasless may return actions in any order)
    const expectedAmount = BigInt(requirements.amount);
    if (expectedAmount <= 0n) {
      return {
        isValid: false,
        invalidReason: X402ErrorCode.invalid_payload,
        invalidMessage: 'Payment amount must be positive',
        payer,
      };
    }

    if (actions.length === 1) {
      // Single action: must be the primary payment
      const paymentValidation = this.validateAction(
        actions[0] as Cell,
        requirements.asset,
        requirements.payTo,
        expectedAmount,
        facilitatorAddress,
        payer,
        true,
      );
      if (paymentValidation) {
        return paymentValidation;
      }
    } else {
      // 2 actions: identify which is primary payment and which is commission
      // Try to find the primary payment by matching against payTo destination
      if (!extra?.relayAddress) {
        return {
          isValid: false,
          invalidReason: X402ErrorCode.invalid_payload,
          invalidMessage: 'Second action not allowed without relay configuration',
          payer,
        };
      }

      // Try actions[0] as primary first, then actions[1]
      const firstAsPrimary = this.validateAction(
        actions[0] as Cell,
        requirements.asset,
        requirements.payTo,
        expectedAmount,
        facilitatorAddress,
        payer,
        true,
      );
      let primaryIdx: number;
      if (!firstAsPrimary) {
        primaryIdx = 0;
      } else {
        // actions[0] failed as primary — try actions[1]
        const secondAsPrimary = this.validateAction(
          actions[1] as Cell,
          requirements.asset,
          requirements.payTo,
          expectedAmount,
          facilitatorAddress,
          payer,
          true,
        );
        if (secondAsPrimary) {
          // Neither action matched as primary payment
          return secondAsPrimary;
        }
        primaryIdx = 1;
      }

      // Validate the other action as commission
      const commissionIdx = primaryIdx === 0 ? 1 : 0;
      const maxCommission = extra?.maxRelayCommission ? BigInt(extra.maxRelayCommission) : undefined;
      const commissionValidation = this.validateCommissionAction(
        actions[commissionIdx] as Cell,
        requirements.asset,
        facilitatorAddress,
        maxCommission,
        extra.relayAddress,
        payer,
      );
      if (commissionValidation) {
        return commissionValidation;
      }
    }

    // Step 12: Optional TonAPI emulation (skip for internal-auth BOCs — cannot be emulated)
    if (detectedOpcode === OPCODE_EXTERNAL) {
      const emulationResult = await this.runEmulation(payload.signedBoc, requirements.asset);
      if (emulationResult) {
        return { ...emulationResult, payer };
      }
    }

    // All checks passed
    return {
      isValid: true,
      payer,
    };
  }

  /**
   * Settle a payment: verify, broadcast BOC, poll for confirmation.
   * The facilitator never routes funds — the client pays the vendor directly.
   * Returns a result object — never throws.
   */
  async settle(
    payload: ExactTonPayload,
    requirements: PaymentRequirements,
  ): Promise<SettleResponse> {
    // Step 1: Verify first
    const verifyResult = await this.verify(payload, requirements);
    if (!verifyResult.isValid) {
      return {
        success: false,
        payer: verifyResult.payer,
        transaction: '',
        network: requirements.network,
        errorReason: verifyResult.invalidReason,
        errorMessage: verifyResult.invalidMessage,
      };
    }

    const payer = verifyResult.payer ?? '';

    // Detect opcode from BOC for broadcast routing
    const detectedOpcode = this.detectOpcode(payload.signedBoc);

    // Step 2: Broadcast
    let bocHash: string;
    const isGasless = detectedOpcode === OPCODE_INTERNAL;
    const timeout = isGasless ? GASLESS_SETTLEMENT_TIMEOUT_SECONDS : this.settlementTimeout;

    try {
      if (isGasless) {
        bocHash = await this.broadcastGasless(payload);
      } else {
        const bocBuffer = Buffer.from(payload.signedBoc, 'base64');
        const cells = Cell.fromBoc(bocBuffer);
        const rootCell = cells[0];
        if (!rootCell) {
          return {
            success: false,
            payer,
            transaction: '',
            network: requirements.network,
            errorReason: X402ErrorCode.broadcast_failed,
            errorMessage: 'Empty BOC',
          };
        }
        bocHash = rootCell.hash().toString('hex');
        await this.tonClient.sendFile(bocBuffer);
      }
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : '';
      // Preserve known business error messages; sanitize unknown/internal ones
      const knownMessages = ['Self-relay daily budget exhausted', 'Empty BOC', 'balance too low'];
      const safeMessage = knownMessages.some((m) => rawMsg.includes(m))
        ? rawMsg
        : 'Failed to broadcast transaction';
      return {
        success: false,
        payer,
        transaction: '',
        network: requirements.network,
        errorReason: X402ErrorCode.broadcast_failed,
        errorMessage: safeMessage,
      };
    }

    // Step 3: Poll for confirmation (seqno advance)
    const derivedWallet = this.deriveWalletContract(
      Buffer.from(payload.walletPublicKey, 'hex'),
    );
    const contract = this.tonClient.open(derivedWallet);
    const expectedSeqno = payload.seqno + 1;

    let confirmed = false;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout * 1000) {
      await this.sleep(this.pollInterval * 1000);
      try {
        const currentSeqno = await contract.getSeqno();
        if (currentSeqno >= expectedSeqno) {
          confirmed = true;
          break;
        }
      } catch {
        // Continue polling
      }
    }

    if (!confirmed) {
      return {
        success: false,
        payer,
        transaction: bocHash,
        network: requirements.network,
        errorReason: X402ErrorCode.settlement_timeout,
        errorMessage: `Transaction not confirmed within ${timeout} seconds`,
      };
    }

    // Step 4: Verify the actual on-chain transaction matches our broadcast BOC
    try {
      const broadcastMsg = loadMessage(Cell.fromBoc(Buffer.from(payload.signedBoc, 'base64'))[0]!.beginParse());
      const expectedBodyHash = broadcastMsg.body.hash();
      const walletAddress = Address.parse(payload.walletAddress);
      const txs = await this.tonClient.getTransactions(walletAddress, { limit: 5 });
      const txVerified = txs.some(
        (tx) => tx.inMessage?.body.hash().equals(expectedBodyHash),
      );
      if (!txVerified) {
        return {
          success: false,
          payer,
          transaction: bocHash,
          network: requirements.network,
          errorReason: X402ErrorCode.settlement_timeout,
          errorMessage:
            'Seqno advanced but transaction body hash does not match broadcast BOC — possible concurrent transaction',
        };
      }
    } catch {
      // Transaction verification is best-effort — if the API call fails,
      // fall through to the success path (seqno confirmation is still valid)
    }

    return {
      success: true,
      payer,
      transaction: bocHash,
      network: requirements.network,
    };
  }

  /** Get relay extra info (address + asset defaults) for payment requirements */
  getExtra(assetDecimals?: number, assetSymbol?: string): TonExtra {
    const relayAddress = this.signer.getAddress('v5r1');
    return {
      relayAddress,
      assetDecimals: assetDecimals ?? 6,
      assetSymbol: assetSymbol ?? 'USDT',
    };
  }

  /** Get list of facilitator signer addresses */
  getSigners(): string[] {
    return [this.signer.getAddress('v5r1')];
  }

  // --------------- private helpers ---------------

  /**
   * Detect the W5 opcode from a base64 signedBoc.
   * Returns the opcode (0x7369676e or 0x73696e74) or 0 on parse failure.
   */
  private detectOpcode(signedBoc: string): number {
    try {
      const rootCell = Cell.fromBoc(Buffer.from(signedBoc, 'base64'))[0];
      if (!rootCell) return 0;
      const msg = loadMessage(rootCell.beginParse());
      const bodySlice = msg.body.beginParse();
      // Skip past signature bits to get to the signed body
      const bodyBitLength = bodySlice.remainingBits - 512;
      bodySlice.loadBits(bodyBitLength); // signed body bits
      bodySlice.loadBuffer(64); // signature
      // Can't read opcode from here — need to reconstruct signed body
      // Re-parse: signedBody starts at the bits we skipped
      const slice2 = msg.body.beginParse();
      const bodyBits2 = slice2.loadBits(slice2.remainingBits - 512);
      slice2.loadBuffer(64);
      const builder = beginCell();
      builder.storeBits(bodyBits2);
      while (slice2.remainingRefs > 0) {
        builder.storeRef(slice2.loadRef());
      }
      const signedBody = builder.endCell();
      return signedBody.beginParse().loadUint(32);
    } catch {
      return 0;
    }
  }

  /**
   * Broadcast a gasless (internal auth) transaction.
   * Try TONAPI first, fall back to self-relay if circuit allows.
   */
  private async broadcastGasless(payload: ExactTonPayload): Promise<string> {
    const bocBuffer = Buffer.from(payload.signedBoc, 'base64');
    const rootCell = Cell.fromBoc(bocBuffer)[0];
    if (!rootCell) throw new Error('Empty gasless BOC');
    const bocHash = rootCell.hash().toString('hex');

    // Try TONAPI gasless if endpoint is configured (key is optional) and circuit allows
    if (this.tonApiEndpoint) {
      const circuitAllows = this.shouldTryTonApi();

      if (circuitAllows) {
        try {
          await this.broadcastViaTonApi(payload);
          this.recordTonApiSuccess();
          return bocHash;
        } catch (err) {
          this.recordTonApiFailure();
          // Log TONAPI error for debugging, then fall through to self-relay
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error(`[x402] TONAPI gasless broadcast failed: ${errMsg}`);
        }
      }
    }

    // Self-relay fallback (only when circuit is CLOSED — just failed but threshold not reached)
    if (this.circuitState === 'open') {
      throw new Error('TONAPI circuit breaker OPEN and self-relay not available — try again later');
    }

    return this.broadcastSelfRelay(payload);
  }

  /**
   * Broadcast via TONAPI /v2/gasless/send.
   * Sends hex-encoded BOC.
   */
  private async broadcastViaTonApi(payload: ExactTonPayload): Promise<void> {
    const cells = Cell.fromBoc(Buffer.from(payload.signedBoc, 'base64'));
    const rootCell = cells[0];
    if (!rootCell) throw new Error('Empty BOC for TONAPI broadcast');
    const hexBoc = rootCell.toBoc().toString('hex');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.tonApiTimeoutMs);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-tonapi-client': 'x402-ton/1.0.0',
      };
      if (this.tonApiKey) {
        headers['Authorization'] = `Bearer ${this.tonApiKey}`;
      }

      const response = await fetch(`${this.tonApiEndpoint}/v2/gasless/send`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          wallet_public_key: payload.walletPublicKey,
          boc: hexBoc,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'unknown');
        throw new Error(`TONAPI /v2/gasless/send returned ${response.status}: ${errorBody}`);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Self-relay fallback: wrap client's signed body in an internal message
   * from the facilitator's wallet, sign, and broadcast.
   */
  private async broadcastSelfRelay(payload: ExactTonPayload): Promise<string> {
    // Check daily budget
    this.resetBudgetIfNeeded();
    if (this.selfRelayTonSpent + DEFAULT_RELAY_GAS_AMOUNT > this.maxDailySelfRelayTon) {
      throw new Error('Self-relay daily budget exhausted');
    }

    // Parse the external message to extract the body Cell
    const rootCell = Cell.fromBoc(Buffer.from(payload.signedBoc, 'base64'))[0];
    if (!rootCell) throw new Error('Empty self-relay BOC');

    const msg = loadMessage(rootCell.beginParse());
    const clientBodyCell = msg.body;

    // Check facilitator has enough balance for gas — any error aborts self-relay
    const facWallet = this.signer.getWalletContract();
    const facContract = this.tonClient.open(facWallet);
    const balance = await facContract.getBalance();
    if (balance < DEFAULT_RELAY_GAS_AMOUNT * 2n) {
      throw new Error(
        `Facilitator balance too low for gasless relay: ${balance} < ${DEFAULT_RELAY_GAS_AMOUNT * 2n}`,
      );
    }

    // Construct internal message: facilitator → client's W5 wallet
    const clientAddress = Address.parseRaw(payload.walletAddress);
    const relayMsg = internal({
      to: clientAddress,
      value: DEFAULT_RELAY_GAS_AMOUNT,
      body: clientBodyCell,
      bounce: true,
    });

    // Sign from facilitator's wallet
    const facSeqno = await facContract.getSeqno();

    const facTransfer = this.signer.signTransfer({
      seqno: facSeqno,
      messages: [relayMsg],
      sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
      timeout: Math.floor(Date.now() / 1000) + SELF_RELAY_TIMEOUT_SECONDS,
    });

    // Wrap in external-in message and broadcast
    const extMsg = beginCell()
      .store(
        storeMessage({
          info: {
            type: 'external-in' as const,
            dest: facWallet.address,
            importFee: 0n,
          },
          body: facTransfer,
        }),
      )
      .endCell();

    const bocBuffer = extMsg.toBoc();
    await this.tonClient.sendFile(bocBuffer);

    // Track spending
    this.selfRelayTonSpent += DEFAULT_RELAY_GAS_AMOUNT;
    this.budgetPersistence?.save(this.selfRelayTonSpent, this.selfRelayBudgetResetAt);

    return extMsg.hash().toString('hex');
  }

  // --------------- circuit breaker ---------------

  private shouldTryTonApi(): boolean {
    const now = Date.now();
    switch (this.circuitState) {
      case 'closed':
        return true;
      case 'open':
        if (now - this.circuitOpenedAt >= this.cbCooldownMs) {
          this.circuitState = 'half_open';
          return true;
        }
        return false;
      case 'half_open':
        return true;
    }
  }

  private recordTonApiSuccess(): void {
    this.tonApiFailures = 0;
    this.tonApiFirstFailureAt = 0;
    this.circuitState = 'closed';
  }

  private recordTonApiFailure(): void {
    const now = Date.now();

    if (this.circuitState === 'half_open') {
      // Half-open probe failed — reopen
      this.circuitState = 'open';
      this.circuitOpenedAt = now;
      return;
    }

    // Reset failure count if outside window
    if (this.tonApiFirstFailureAt === 0 || now - this.tonApiFirstFailureAt > this.cbWindowMs) {
      this.tonApiFailures = 1;
      this.tonApiFirstFailureAt = now;
    } else {
      this.tonApiFailures++;
    }

    if (this.tonApiFailures >= this.cbThreshold) {
      this.circuitState = 'open';
      this.circuitOpenedAt = now;
    }
  }

  private resetBudgetIfNeeded(): void {
    if (Date.now() >= this.selfRelayBudgetResetAt) {
      this.selfRelayTonSpent = 0n;
      this.selfRelayBudgetResetAt = Date.now() + BUDGET_RESET_INTERVAL_MS;
      this.budgetPersistence?.save(this.selfRelayTonSpent, this.selfRelayBudgetResetAt);
    }
  }

  // --------------- action parsing ---------------

  /**
   * Parse the common internal message header fields from a message cell slice.
   * Returns the destination address, TON value, and remaining slice for further parsing.
   * Throws if the message is not an internal message (prefix bit is 1).
   */
  private parseInternalMessageFields(msgCell: Cell): { dest: Address; value: bigint; slice: Slice } {
    const slice = msgCell.beginParse();
    const prefix = slice.loadBit();
    if (prefix) {
      throw new Error('Expected internal message, got external');
    }
    slice.loadBit(); // ihr_disabled
    slice.loadBit(); // bounce
    slice.loadBit(); // bounced
    slice.loadMaybeAddress(); // src (addr_none from wallets)
    const dest = slice.loadAddress();
    const value = slice.loadCoins();
    return { dest, value, slice };
  }

  /** Extract action cells from the W5 outListPacked linked list */
  private extractActions(actionsCell: Cell): Cell[] {
    const actions: Cell[] = [];
    let current = actionsCell;
    let iter = 0;

    while (true) {
      if (++iter > 4) break;
      const slice = current.beginParse();
      if (slice.remainingRefs === 0 && slice.remainingBits === 0) {
        break;
      }
      const prevCell = slice.loadRef();
      slice.loadUint(32); // action_send_msg tag
      const sendMode = slice.loadUint(8);
      if (sendMode !== 3) {
        throw new Error(`Invalid sendMode: expected 3, got ${sendMode}`);
      }
      const msgCell = slice.loadRef();
      actions.push(msgCell);
      current = prevCell;
    }

    actions.reverse();
    return actions;
  }

  /** Validate a payment action (native or jetton transfer) */
  private validateAction(
    msgCell: Cell,
    asset: string,
    expectedDest: string,
    expectedAmount: bigint,
    facilitatorAddress: string,
    payer: string,
    isPrimary: boolean,
  ): VerifyResponse | null {
    try {
      if (asset === 'native') {
        return this.validateNativeAction(msgCell, expectedDest, expectedAmount, facilitatorAddress, payer, isPrimary);
      } else {
        return this.validateJettonAction(msgCell, expectedDest, expectedAmount, facilitatorAddress, payer, isPrimary);
      }
    } catch {
      return {
        isValid: false,
        invalidReason: X402ErrorCode.invalid_boc,
        invalidMessage: 'Failed to parse internal message',
        payer,
      };
    }
  }

  private validateNativeAction(
    msgCell: Cell,
    expectedDest: string,
    expectedAmount: bigint,
    facilitatorAddress: string,
    payer: string,
    isPrimary: boolean,
  ): VerifyResponse | null {
    const { dest, value } = this.parseInternalMessageFields(msgCell);

    const destRaw = `${dest.workChain}:${dest.hash.toString('hex')}`;

    if (destRaw === facilitatorAddress) {
      return {
        isValid: false,
        invalidReason: X402ErrorCode.wrong_recipient,
        invalidMessage: 'Transfer destination cannot be the facilitator/relay',
        payer,
      };
    }

    if (isPrimary) {
      if (destRaw !== expectedDest) {
        return {
          isValid: false,
          invalidReason: X402ErrorCode.wrong_recipient,
          invalidMessage: `Recipient mismatch: got ${destRaw}, expected ${expectedDest}`,
          payer,
        };
      }

      if (value !== expectedAmount) {
        return {
          isValid: false,
          invalidReason: X402ErrorCode.amount_mismatch,
          invalidMessage: `Amount mismatch: got ${value}, required ${expectedAmount}`,
          payer,
        };
      }
    }

    return null;
  }

  private validateJettonAction(
    msgCell: Cell,
    expectedDest: string,
    expectedAmount: bigint,
    facilitatorAddress: string,
    payer: string,
    isPrimary: boolean,
  ): VerifyResponse | null {
    const { slice: internalMsg } = this.parseInternalMessageFields(msgCell);
    internalMsg.loadBit(); // extra currencies
    internalMsg.loadCoins(); // ihr_fee
    internalMsg.loadCoins(); // fwd_fee
    internalMsg.loadUintBig(64); // created_lt (can exceed Number.MAX_SAFE_INTEGER)
    internalMsg.loadUint(32); // created_at

    const hasStateInit = internalMsg.loadBit();
    if (hasStateInit) {
      if (internalMsg.loadBit()) {
        internalMsg.loadRef();
      }
    }

    const hasBody = internalMsg.loadBit();
    const jettonBody = hasBody ? internalMsg.loadRef().beginParse() : internalMsg;

    const opcode = jettonBody.loadUint(32);
    if (opcode !== JETTON_TRANSFER_OP) {
      return {
        isValid: false,
        invalidReason: X402ErrorCode.asset_mismatch,
        invalidMessage: `Expected jetton transfer opcode 0x${JETTON_TRANSFER_OP.toString(16)}, got 0x${opcode.toString(16)}`,
        payer,
      };
    }

    jettonBody.loadUintBig(64); // query_id (can exceed Number.MAX_SAFE_INTEGER)
    const jettonAmount = jettonBody.loadCoins();
    const jettonDest = jettonBody.loadAddress();
    const destRaw = `${jettonDest.workChain}:${jettonDest.hash.toString('hex')}`;

    if (destRaw === facilitatorAddress) {
      return {
        isValid: false,
        invalidReason: X402ErrorCode.wrong_recipient,
        invalidMessage: 'Jetton transfer destination cannot be the facilitator/relay',
        payer,
      };
    }

    if (isPrimary) {
      if (destRaw !== expectedDest) {
        return {
          isValid: false,
          invalidReason: X402ErrorCode.wrong_recipient,
          invalidMessage: `Jetton recipient mismatch: got ${destRaw}, expected ${expectedDest}`,
          payer,
        };
      }

      if (jettonAmount !== expectedAmount) {
        return {
          isValid: false,
          invalidReason: X402ErrorCode.amount_mismatch,
          invalidMessage: `Jetton amount mismatch: got ${jettonAmount}, required ${expectedAmount}`,
          payer,
        };
      }
    }

    return null;
  }

  /** Validate a commission action (second action in a 2-action batch) */
  private validateCommissionAction(
    msgCell: Cell,
    asset: string,
    facilitatorAddress: string,
    maxCommission: bigint | undefined,
    expectedCommissionDest: string | undefined,
    payer: string,
  ): VerifyResponse | null {
    try {
      const { amount: commissionAmount, dest: commissionDest } = this.extractActionDetails(msgCell, asset);

      if (commissionDest === facilitatorAddress) {
        return {
          isValid: false,
          invalidReason: X402ErrorCode.wrong_recipient,
          invalidMessage: 'Commission destination cannot be the facilitator/relay',
          payer,
        };
      }

      if (expectedCommissionDest && commissionDest !== expectedCommissionDest) {
        return {
          isValid: false,
          invalidReason: X402ErrorCode.wrong_recipient,
          invalidMessage: `Commission destination mismatch: got ${commissionDest}, expected ${expectedCommissionDest}`,
          payer,
        };
      }

      if (commissionAmount > MAX_COMMISSION_CAP) {
        return {
          isValid: false,
          invalidReason: X402ErrorCode.commission_exceeded,
          invalidMessage: `Commission ${commissionAmount} exceeds absolute cap ${MAX_COMMISSION_CAP}`,
          payer,
        };
      }

      if (maxCommission !== undefined && commissionAmount > maxCommission) {
        return {
          isValid: false,
          invalidReason: X402ErrorCode.commission_exceeded,
          invalidMessage: `Commission ${commissionAmount} exceeds max ${maxCommission}`,
          payer,
        };
      }

      return null;
    } catch {
      return {
        isValid: false,
        invalidReason: X402ErrorCode.invalid_boc,
        invalidMessage: 'Failed to parse commission action',
        payer,
      };
    }
  }

  /** Extract amount and destination from an action message */
  private extractActionDetails(
    msgCell: Cell,
    asset: string,
  ): { amount: bigint; dest: string } {
    const { dest, value, slice: internalMsg } = this.parseInternalMessageFields(msgCell);

    const destRaw = `${dest.workChain}:${dest.hash.toString('hex')}`;

    if (asset === 'native') {
      return { amount: value, dest: destRaw };
    }

    internalMsg.loadBit(); // extra currencies
    internalMsg.loadCoins(); // ihr_fee
    internalMsg.loadCoins(); // fwd_fee
    internalMsg.loadUintBig(64); // created_lt (can exceed Number.MAX_SAFE_INTEGER)
    internalMsg.loadUint(32); // created_at

    const hasStateInit = internalMsg.loadBit();
    if (hasStateInit) {
      if (internalMsg.loadBit()) {
        internalMsg.loadRef();
      }
    }

    const hasBody = internalMsg.loadBit();
    const jettonBody = hasBody ? internalMsg.loadRef().beginParse() : internalMsg;

    jettonBody.loadUint(32); // opcode
    jettonBody.loadUintBig(64); // query_id (can exceed Number.MAX_SAFE_INTEGER)
    const jettonAmount = jettonBody.loadCoins();
    const jettonDest = jettonBody.loadAddress();
    const jettonDestRaw = `${jettonDest.workChain}:${jettonDest.hash.toString('hex')}`;

    return { amount: jettonAmount, dest: jettonDestRaw };
  }

  // --------------- emulation ---------------

  private async runEmulation(
    boc: string,
    asset: string,
  ): Promise<Omit<VerifyResponse, 'payer'> | null> {
    const { tonApiKey, enableEmulation } = this.emulationConfig;

    if (!tonApiKey || enableEmulation === false) {
      return null;
    }

    try {
      const result = await this.emulateTransaction(boc, asset);
      if (!result.success) {
        if (result.reason === X402ErrorCode.emulation_unavailable) {
          return null;
        }
        return {
          isValid: false,
          invalidReason: result.reason,
          invalidMessage: result.message,
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  private async emulateTransaction(
    boc: string,
    asset: string,
  ): Promise<{ success: true } | { success: false; reason: X402ErrorCodeValue; message: string }> {
    const endpoint =
      this.emulationConfig.tonApiEndpoint ??
      (this.network === TON_MAINNET ? TON_API_MAINNET : TON_API_TESTNET);
    const timeout = this.emulationConfig.emulationTimeout ?? DEFAULT_EMULATION_TIMEOUT;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (this.emulationConfig.tonApiKey) {
        headers['Authorization'] = `Bearer ${this.emulationConfig.tonApiKey}`;
      }

      const res = await fetch(`${endpoint}/v2/traces/emulate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ boc }),
        signal: controller.signal,
      });

      if (!res.ok) {
        return {
          success: false,
          reason: X402ErrorCode.emulation_unavailable as X402ErrorCodeValue,
          message: `TonAPI returned ${res.status} — emulation skipped`,
        };
      }

      const trace = await res.json();
      if (!trace || typeof trace !== 'object' || !trace.transaction) {
        return {
          success: false,
          reason: X402ErrorCode.emulation_failed as X402ErrorCodeValue,
          message: 'Invalid TonAPI trace response',
        };
      }
      return this.analyzeTrace(trace, asset);
    } finally {
      clearTimeout(timer);
    }
  }

  private analyzeTrace(
    trace: TraceResult,
    asset: string,
  ): { success: true } | { success: false; reason: X402ErrorCodeValue; message: string } {
    const tx = trace?.transaction;
    if (!tx) return { success: true };

    if (tx.aborted) {
      const exitCode = tx.compute_phase?.exit_code ?? tx.computePhase?.exit_code;
      if (
        exitCode === TON_EXIT_INSUFFICIENT_FUNDS ||
        exitCode === TON_EXIT_INSUFFICIENT_FEES ||
        exitCode === TON_EXIT_ACTION_FAILED
      ) {
        return {
          success: false,
          reason: X402ErrorCode.insufficient_balance,
          message: `Emulation failed: insufficient balance (exit code ${exitCode})`,
        };
      }
      return {
        success: false,
        reason: X402ErrorCode.emulation_failed,
        message: `Emulation failed: transaction aborted (exit code ${exitCode ?? 'unknown'})`,
      };
    }

    if (asset !== 'native' && trace.children) {
      for (const child of trace.children) {
        const childTx = child?.transaction;
        if (!childTx) continue;
        if (childTx.aborted) {
          const exitCode = childTx.compute_phase?.exit_code ?? childTx.computePhase?.exit_code;
          if (exitCode === JETTON_EXIT_INSUFFICIENT) {
            return {
              success: false,
              reason: X402ErrorCode.insufficient_balance,
              message: `Emulation failed: insufficient jetton balance (exit code ${JETTON_EXIT_INSUFFICIENT})`,
            };
          }
          return {
            success: false,
            reason: X402ErrorCode.emulation_failed,
            message: `Emulation failed: child transaction aborted (exit code ${exitCode ?? 'unknown'})`,
          };
        }
      }
    }

    return { success: true };
  }

  // --------------- utilities ---------------

  private deriveWalletContract(publicKey: Buffer): WalletContractV5R1 {
    return WalletContractV5R1.create({ workchain: 0, publicKey });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
