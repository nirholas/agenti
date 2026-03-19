import { TonClient, internal } from '@ton/ton';
import { beginCell, Address, Cell, SendMode, storeMessage, storeMessageRelaxed } from '@ton/core';
import { TonSigner } from '../../signer';
import type { ExactTonPayload, TonExtra } from '../../types';
import { NETWORK_CONFIG, JETTON_TRANSFER_GAS, JETTON_FORWARD_AMOUNT, JETTON_TRANSFER_OP, TON_API_MAINNET, TON_API_TESTNET, TON_MAINNET } from '../../constants';
import type { MessageRelaxed } from '@ton/core';

/** Response shape from TONAPI /v2/gasless/estimate */
interface GaslessEstimateResponse {
  commission: string;
  relay_address: string;
  valid_until: number;
  messages: Array<{
    address: string;
    amount: string;
    payload: string; // hex-encoded BOC
  }>;
}

/**
 * Client-side x402 payment payload creator for TON.
 *
 * Constructs and signs external messages containing payment transfers
 * directly to the vendor (payTo) address. Used by AI agents or client
 * applications to create payment BOCs for x402 HTTP 402 flows.
 *
 * For native TON: signs with authType 'external' (opcode 0x7369676e).
 * For jetton gasless: calls TONAPI /v2/gasless/estimate, signs the returned
 * messages with authType 'internal' (opcode 0x73696e74).
 * signedBoc is always wrapped in an external-in message.
 */
export class SchemeNetworkClient {
  readonly scheme = 'exact';

  /**
   * @param signer Client wallet signer
   * @param opts Optional configuration for API keys
   */
  constructor(
    private readonly signer: TonSigner,
    private readonly opts?: {
      /** TonCenter API key to avoid public rate limits */
      toncenterApiKey?: string;
      /** TONAPI key for gasless estimation */
      tonApiKey?: string;
      /** TONAPI endpoint override (defaults based on network) */
      tonApiEndpoint?: string;
    } | string, // backward compat: plain string = toncenterApiKey
  ) {}

  private get toncenterApiKey(): string | undefined {
    return typeof this.opts === 'string' ? this.opts : this.opts?.toncenterApiKey;
  }

  private get tonApiKey(): string | undefined {
    return typeof this.opts === 'string' ? undefined : this.opts?.tonApiKey;
  }

  private getTonApiEndpoint(network: string): string {
    if (typeof this.opts !== 'string' && this.opts?.tonApiEndpoint) {
      return this.opts.tonApiEndpoint;
    }
    return network === TON_MAINNET ? TON_API_MAINNET : TON_API_TESTNET;
  }

  /**
   * Create a signed payment payload (BOC) for the given payment requirements.
   *
   * @param network CAIP-2 network identifier
   * @param amount Payment amount in atomic units
   * @param asset Asset identifier ("native" or jetton master address)
   * @param payTo Vendor address (raw hex) — payment goes directly here
   * @param maxTimeoutSeconds Maximum time before payment expires
   * @param extra Optional relay info (relayAddress + maxRelayCommission)
   * @returns Signed payment payload with BOC, public key, wallet address, seqno, validUntil
   * @throws Error if network is unsupported or gasless requested on undeployed wallet (seqno === 0)
   */
  async createPaymentPayload(
    network: string,
    amount: string,
    asset: string,
    payTo: string,
    maxTimeoutSeconds: number,
    extra?: TonExtra,
  ): Promise<ExactTonPayload> {
    const config = NETWORK_CONFIG[network];
    if (!config) {
      throw new Error(`Unsupported network: ${network}`);
    }

    const client = new TonClient({ endpoint: config.toncenterUrl, apiKey: this.toncenterApiKey });
    const walletContract = this.signer.getWalletContract();
    const contract = client.open(walletContract);
    let seqno: number;
    try {
      seqno = await contract.getSeqno();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      const isUninitWallet =
        message.includes('exit_code: -13') ||
        message.includes('Unable to execute get method') ||
        message.includes('-256');
      if (isUninitWallet) {
        seqno = 0;
      } else {
        throw new Error(`Failed to fetch wallet seqno: ${message}`);
      }
    }

    const paymentAmount = BigInt(amount);
    const validUntil = Math.floor(Date.now() / 1000) + maxTimeoutSeconds;
    const vendorAddress = Address.parse(payTo);
    const payerAddress = walletContract.address;

    // Auto-detect gasless: non-native asset + relayAddress present → TONAPI gasless flow
    const useGasless = asset !== 'native' && !!extra?.relayAddress;

    if (useGasless && seqno === 0) {
      throw new Error('Gasless signing requires a deployed wallet (seqno must not be 0)');
    }

    let messages: MessageRelaxed[];
    let effectiveValidUntil: number;

    if (useGasless) {
      // TONAPI gasless flow: estimate → sign returned messages
      const gaslessResult = await this.buildGaslessMessages(
        network, client, walletContract, payerAddress, vendorAddress, asset, paymentAmount,
      );
      messages = gaslessResult.messages;
      effectiveValidUntil = gaslessResult.validUntil;
    } else {
      // Native TON or non-gasless flow: build messages directly
      messages = this.buildNativeMessages(paymentAmount, vendorAddress, extra);
      // W5R1 library forces validUntil=0xFFFFFFFF for seqno=0 (first tx deploys wallet)
      effectiveValidUntil = seqno === 0 ? 0xFFFFFFFF : validUntil;
    }

    const sendMode = SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS;

    const transferCell = this.signer.signTransfer({
      seqno,
      messages,
      sendMode,
      timeout: useGasless ? effectiveValidUntil : validUntil,
      ...(useGasless ? { authType: 'internal' as const } : {}),
    });

    // Always wrap in external-in message (even for internal auth)
    const needsInit = seqno === 0;
    const extMsg = beginCell()
      .store(
        storeMessage({
          info: {
            type: 'external-in',
            dest: walletContract.address,
            importFee: 0n,
          },
          init: needsInit ? walletContract.init : undefined,
          body: transferCell,
        }),
      )
      .endCell();
    const boc = extMsg.toBoc().toString('base64');

    return {
      signedBoc: boc,
      walletPublicKey: this.signer.getPublicKey(),
      walletAddress: `${walletContract.address.workChain}:${walletContract.address.hash.toString('hex')}`,
      seqno,
      validUntil: effectiveValidUntil,
    };
  }

  /**
   * Build native TON transfer messages (direct, non-gasless).
   */
  private buildNativeMessages(
    paymentAmount: bigint,
    vendorAddress: Address,
    extra?: TonExtra,
  ): MessageRelaxed[] {
    const messages: MessageRelaxed[] = [];

    messages.push(
      internal({
        to: vendorAddress,
        value: paymentAmount,
        body: undefined,
      }),
    );

    if (extra?.relayAddress && extra?.maxRelayCommission) {
      const commissionAmount = BigInt(extra.maxRelayCommission);
      if (commissionAmount > 0n) {
        messages.push(
          internal({
            to: Address.parse(extra.relayAddress),
            value: commissionAmount,
            body: undefined,
          }),
        );
      }
    }

    return messages;
  }

  /**
   * TONAPI gasless flow: build the jetton transfer message, call /estimate,
   * and return the messages TONAPI wants us to sign.
   */
  private async buildGaslessMessages(
    network: string,
    client: TonClient,
    walletContract: ReturnType<TonSigner['getWalletContract']>,
    payerAddress: Address,
    vendorAddress: Address,
    asset: string,
    paymentAmount: bigint,
  ): Promise<{ messages: MessageRelaxed[]; validUntil: number }> {
    // Resolve the payer's jetton wallet address
    const jettonMaster = Address.parse(asset);
    const jettonWalletResult = await client.runMethod(jettonMaster, 'get_wallet_address', [
      { type: 'slice', cell: beginCell().storeAddress(payerAddress).endCell() },
    ]);
    const payerJettonWallet = jettonWalletResult.stack.readAddress();

    // Build the jetton transfer internal message
    const paymentBody = this.buildJettonTransferBody(paymentAmount, vendorAddress, payerAddress);
    const transferMsg = internal({
      to: payerJettonWallet,
      value: JETTON_TRANSFER_GAS,
      body: paymentBody,
    });

    // Serialize to hex BOC for TONAPI
    const msgCell = beginCell().store(storeMessageRelaxed(transferMsg)).endCell();
    const msgHex = msgCell.toBoc().toString('hex');

    // Call TONAPI /v2/gasless/estimate
    const tonApiEndpoint = this.getTonApiEndpoint(network);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.tonApiKey) {
      headers['Authorization'] = `Bearer ${this.tonApiKey}`;
    }

    const walletAddress = `${walletContract.address.workChain}:${walletContract.address.hash.toString('hex')}`;
    const publicKey = this.signer.getPublicKey();

    const estimateRes = await fetch(`${tonApiEndpoint}/v2/gasless/estimate/${asset}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        wallet_address: walletAddress,
        wallet_public_key: publicKey,
        messages: [{ boc: msgHex }],
      }),
    });

    if (!estimateRes.ok) {
      const errBody = await estimateRes.text().catch(() => 'unknown');
      throw new Error(`TONAPI gasless estimate failed (${estimateRes.status}): ${errBody}`);
    }

    const estimate = (await estimateRes.json()) as GaslessEstimateResponse;

    // Convert TONAPI messages to MessageRelaxed[]
    const messages: MessageRelaxed[] = estimate.messages.map((msg) => {
      const bodyCell = Cell.fromBoc(Buffer.from(msg.payload, 'hex'))[0];
      return internal({
        to: Address.parseRaw(msg.address),
        value: BigInt(msg.amount),
        body: bodyCell,
      });
    });

    return {
      messages,
      validUntil: estimate.valid_until,
    };
  }

  /** Build a TEP-74 jetton transfer message body */
  private buildJettonTransferBody(amount: bigint, dest: Address, responseAddr: Address): Cell {
    return beginCell()
      .storeUint(JETTON_TRANSFER_OP, 32) // jetton_transfer opcode
      .storeUint(0, 64) // query_id
      .storeCoins(amount)
      .storeAddress(dest)
      .storeAddress(responseAddr) // response_address
      .storeBit(0) // no custom payload
      .storeCoins(JETTON_FORWARD_AMOUNT) // forward amount
      .storeBit(0)
      .endCell();
  }
}
