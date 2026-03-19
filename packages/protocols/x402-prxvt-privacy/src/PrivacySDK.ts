// @ts-nocheck
/**
 * Privacy SDK - Core class for private x402 payments
 */

import type { WalletClient } from 'viem';
import { logger } from './logger';
import { createWalletClient, http, createPublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, polygon } from 'viem/chains';
import type {
  PrivacySDKConfig,
  Note,
  NoteCommitment,
  ChainConfig,
  PaymentResult,
} from './types';
import {
  randomFieldElement,
  poseidonHash3,
  generateProof,
  generateBurnerWallet,
} from './crypto';
import {
  buildPaymentUserOp,
  submitUserOperation,
  waitForUserOpConfirmation,
} from './bundler';
import {
  getChainConfig,
  getBundlerUrl,
  calculateNoteBalance,
  getNonce,
  fetchMerkleProof,
  validateNote,
  parseUSDC,
  formatUSDC,
} from './utils';
import { fetchMerkleProofFromSubgraph, addPendingCommitment } from './merkle';
import {
  isCrossChain,
  getChainEid,
  getAttestationForPayment,
} from './attestor';

/**
 * Main Privacy SDK class
 */
export class PrivacySDK {
  private config: PrivacySDKConfig;
  private chainConfig: ChainConfig;
  private bundlerUrl: string;
  private walletClient?: WalletClient;
  private currentNote?: Note;

  // Circuit paths (can be overridden)
  private wasmPath: string;
  private zkeyPath: string;

  // Cross-chain attestor URL
  private attestorUrl?: string;

  constructor(config: PrivacySDKConfig = {}) {
    this.config = config;
    this.chainConfig = getChainConfig(config.chain || 'base');

    // Override RPC URL if provided
    if (config.rpcUrl) {
      this.chainConfig = { ...this.chainConfig, rpcUrl: config.rpcUrl };
    }

    // Get bundler URL (priority: bundlerUrl > bundlerApiKey > prxvt proxy)
    this.bundlerUrl = getBundlerUrl(this.chainConfig.chainId, {
      bundlerUrl: config.bundlerUrl,
      bundlerApiKey: config.bundlerApiKey,
    });

    // Default circuit paths - hosted on Cloudflare R2 CDN
    this.wasmPath = config.circuitWasmPath || 'https://circuits.prxvt.com/circuit_V16.wasm';
    this.zkeyPath = config.circuitZkeyPath || 'https://circuits.prxvt.com/circuit_V16.zkey';

    // Cross-chain attestor URL (default: https://attestor.prxvt.com)
    this.attestorUrl = config.attestorUrl;
  }

  /**
   * Connect wallet client (for browser/UI integration)
   */
  async connect(walletClient: WalletClient): Promise<void> {
    this.walletClient = walletClient;
  }

  /** Allowed deposit amounts in USDC */
  static readonly ALLOWED_AMOUNTS = [0.01, 0.1, 1, 10, 100];

  /**
   * Validate deposit amount
   */
  private validateDepositAmount(amount: number): void {
    if (!PrivacySDK.ALLOWED_AMOUNTS.includes(amount)) {
      throw new Error(
        `Invalid deposit amount: ${amount} USDC. ` +
        `Allowed amounts are: ${PrivacySDK.ALLOWED_AMOUNTS.join(', ')} USDC`
      );
    }
  }

  /**
   * Deposit USDC to create a private note
   * @param amount - Amount in USDC. Must be one of: 0.01, 0.1, 1, 10, 100
   * @param privateKey - Optional private key (if not using connect())
   */
  async deposit(amount: number, privateKey?: string): Promise<Note> {
    // Validate fixed deposit amount
    this.validateDepositAmount(amount);

    let walletClient = this.walletClient;

    // If private key provided, create wallet client from it
    if (privateKey) {
      const chain = this.chainConfig.chainId === 8453 ? base : polygon;
      const account = privateKeyToAccount(privateKey as `0x${string}`);
      walletClient = createWalletClient({
        account,
        chain,
        transport: http(this.chainConfig.rpcUrl),
      });
    }

    if (!walletClient) {
      throw new Error('No wallet connected. Provide privateKey or call connect() first.');
    }

    const address = walletClient.account?.address;
    if (!address) {
      throw new Error('No account found in wallet client');
    }

    // Generate secret and nullifier
    const secret = randomFieldElement();
    const nullifier = randomFieldElement();

    // Calculate net amount after fees
    const grossAmountMicro = parseUSDC(amount);

    // TODO: Fetch fee from contract
    const feeBps = 100n; // 1%
    const feeThreshold = 10000000n; // 10 USDC
    let feeAmount = 0n;
    if (grossAmountMicro > feeThreshold) {
      feeAmount = (grossAmountMicro * feeBps) / 10000n;
    }
    const netAmountMicro = grossAmountMicro - feeAmount;

    // Generate commitment
    const commitment = await poseidonHash3(secret, nullifier, netAmountMicro);

    // Create public client
    const chain = this.chainConfig.chainId === 8453 ? base : polygon;
    const publicClient = createPublicClient({
      chain,
      transport: http(this.chainConfig.rpcUrl),
    });

    // Check USDC balance
    const USDC_ABI = [
      {
        inputs: [{ name: 'account', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          { name: 'spender', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
        name: 'approve',
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
        ],
        name: 'allowance',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
    ] as const;

    const balance = (await publicClient.readContract({
      address: this.chainConfig.usdcAddress as `0x${string}`,
      abi: USDC_ABI,
      functionName: 'balanceOf',
      args: [address],
    })) as bigint;

    if (balance < grossAmountMicro) {
      throw new Error(
        `Insufficient USDC balance. Have ${formatUSDC(balance)} USDC, need ${formatUSDC(
          grossAmountMicro
        )} USDC`
      );
    }

    // Check allowance
    const allowance = (await publicClient.readContract({
      address: this.chainConfig.usdcAddress as `0x${string}`,
      abi: USDC_ABI,
      functionName: 'allowance',
      args: [address, this.chainConfig.poolAddress as `0x${string}`],
    })) as bigint;

    // Approve if needed
    if (allowance < grossAmountMicro) {
      const approveTx = await walletClient.writeContract({
        address: this.chainConfig.usdcAddress as `0x${string}`,
        abi: USDC_ABI,
        functionName: 'approve',
        args: [this.chainConfig.poolAddress as `0x${string}`, grossAmountMicro],
      });

      await publicClient.waitForTransactionReceipt({ hash: approveTx });
    }

    // Deposit to pool
    const POOL_ABI = [
      {
        inputs: [
          { name: 'commitment', type: 'bytes32' },
          { name: 'denomination', type: 'uint256' },
        ],
        name: 'deposit',
        outputs: [],
        stateMutability: 'payable',
        type: 'function',
      },
    ] as const;

    // Convert commitment to bytes32 hex format
    const commitmentHex = ('0x' + BigInt(commitment).toString(16).padStart(64, '0')) as `0x${string}`;

    const depositTx = await walletClient.writeContract({
      address: this.chainConfig.poolAddress as `0x${string}`,
      abi: POOL_ABI,
      functionName: 'deposit',
      args: [commitmentHex, grossAmountMicro],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: depositTx });

    // Register pending commitment for immediate use (no need to wait for subgraph)
    addPendingCommitment(commitmentHex, receipt.blockNumber);
    logger.debug(`✅ Deposit confirmed in block ${receipt.blockNumber}`);

    // Create note
    const note: Note = {
      version: '2.0',
      commitments: [
        {
          secret: secret.toString(),
          nullifier: nullifier.toString(),
          amount: Number(netAmountMicro),
          depositChain: this.chainConfig.chainName,
        },
      ],
    };

    this.currentNote = note;
    return note;
  }

  /**
   * Fast deposit using ERC-3009 receiveWithAuthorization (no approve TX needed!)
   * This is ~50% faster than regular deposit (10s vs 20s)
   * @param amount - Amount in USDC. Must be one of: 0.01, 0.1, 1, 10, 100
   * @param privateKey - Private key for signing
   */
  async depositFast(amount: number, privateKey: string): Promise<Note> {
    // Validate fixed deposit amount
    this.validateDepositAmount(amount);

    const chain = this.chainConfig.chainId === 8453 ? base : polygon;
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain,
      transport: http(this.chainConfig.rpcUrl),
    });

    const publicClient = createPublicClient({
      chain,
      transport: http(this.chainConfig.rpcUrl),
    });

    const address = account.address;

    // Generate secret and nullifier
    const secret = randomFieldElement();
    const nullifier = randomFieldElement();

    // Calculate amounts
    const grossAmountMicro = parseUSDC(amount);

    // Fee calculation (same as regular deposit)
    const feeBps = 100n; // 1%
    const feeThreshold = 10000000n; // 10 USDC
    let feeAmount = 0n;
    if (grossAmountMicro > feeThreshold) {
      feeAmount = (grossAmountMicro * feeBps) / 10000n;
    }
    const netAmountMicro = grossAmountMicro - feeAmount;

    // Generate commitment
    const commitment = await poseidonHash3(secret, nullifier, netAmountMicro);
    const commitmentHex = ('0x' + BigInt(commitment).toString(16).padStart(64, '0')) as `0x${string}`;

    // Check USDC balance
    const USDC_ABI = [
      {
        inputs: [{ name: 'account', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
    ] as const;

    const balance = (await publicClient.readContract({
      address: this.chainConfig.usdcAddress as `0x${string}`,
      abi: USDC_ABI,
      functionName: 'balanceOf',
      args: [address],
    })) as bigint;

    if (balance < grossAmountMicro) {
      throw new Error(
        `Insufficient USDC balance. Have ${formatUSDC(balance)} USDC, need ${formatUSDC(grossAmountMicro)} USDC`
      );
    }

    // Sign ERC-3009 receiveWithAuthorization (off-chain, instant!)
    logger.debug(`📝 Signing ERC-3009 authorization...`);

    const validAfter = 0n;
    const validBefore = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour
    const authNonce = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex')}` as `0x${string}`;

    // EIP-712 domain for USDC receiveWithAuthorization
    const domain = {
      name: 'USD Coin',
      version: '2',
      chainId: this.chainConfig.chainId,
      verifyingContract: this.chainConfig.usdcAddress as `0x${string}`,
    };

    const types = {
      ReceiveWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ],
    };

    const authMessage = {
      from: address,
      to: this.chainConfig.poolAddress as `0x${string}`,
      value: grossAmountMicro,
      validAfter,
      validBefore,
      nonce: authNonce,
    };

    // Sign the authorization (instant, off-chain)
    const signature = await account.signTypedData({
      domain,
      types,
      primaryType: 'ReceiveWithAuthorization',
      message: authMessage,
    });

    // Parse signature into v, r, s
    const sigBytes = signature.slice(2);
    const r = `0x${sigBytes.slice(0, 64)}` as `0x${string}`;
    const s = `0x${sigBytes.slice(64, 128)}` as `0x${string}`;
    const v = parseInt(sigBytes.slice(128, 130), 16);

    logger.debug(`✅ Authorization signed`);

    // Call depositWithAuthorization (single TX!)
    const POOL_ABI = [
      {
        inputs: [
          { name: 'commitment', type: 'bytes32' },
          { name: 'denomination', type: 'uint256' },
          { name: 'validAfter', type: 'uint256' },
          { name: 'validBefore', type: 'uint256' },
          { name: 'nonce', type: 'bytes32' },
          { name: 'v', type: 'uint8' },
          { name: 'r', type: 'bytes32' },
          { name: 's', type: 'bytes32' },
        ],
        name: 'depositWithAuthorization',
        outputs: [],
        stateMutability: 'payable',
        type: 'function',
      },
    ] as const;

    logger.debug(`📤 Submitting depositWithAuthorization...`);
    const depositTx = await walletClient.writeContract({
      address: this.chainConfig.poolAddress as `0x${string}`,
      abi: POOL_ABI,
      functionName: 'depositWithAuthorization',
      args: [commitmentHex, grossAmountMicro, validAfter, validBefore, authNonce, v, r, s],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: depositTx });

    // Register pending commitment for immediate use
    addPendingCommitment(commitmentHex, receipt.blockNumber);
    logger.debug(`✅ Fast deposit confirmed in block ${receipt.blockNumber}`);

    // Create note
    const note: Note = {
      version: '2.0',
      commitments: [
        {
          secret: secret.toString(),
          nullifier: nullifier.toString(),
          amount: Number(netAmountMicro),
          depositChain: this.chainConfig.chainName,
        },
      ],
    };

    this.currentNote = note;
    return note;
  }

  /**
   * Get balance from note
   */
  async getBalance(note: Note): Promise<number> {
    validateNote(note);
    return calculateNoteBalance(note);
  }

  /**
   * Make a private payment (internal - used by x402 wrappers)
   */
  async makePayment(
    note: Note,
    recipient: string,
    amount: number
  ): Promise<PaymentResult> {
    validateNote(note);

    // Get first commitment
    const commitment = note.commitments[0];
    if (!commitment) {
      throw new Error('No commitments in note');
    }

    const availableBalance = commitment.amount / 1_000_000;
    if (amount > availableBalance) {
      throw new Error(`Insufficient balance. Available: ${availableBalance} USDC`);
    }

    // Calculate amounts
    const paymentAmountMicro = parseUSDC(amount);
    const changeAmountMicro = BigInt(commitment.amount) - paymentAmountMicro;

    // Generate commitment hash
    const commitmentHash = await poseidonHash3(
      commitment.secret,
      commitment.nullifier,
      BigInt(commitment.amount)
    );

    // Check if cross-chain payment (deposit chain != payment chain)
    // Do this BEFORE fetching Merkle proof to use correct chain
    const depositChain = commitment.depositChain || this.chainConfig.chainName;
    const paymentChain = this.chainConfig.chainName;
    const crossChain = isCrossChain(depositChain, paymentChain);

    // For cross-chain, fetch Merkle proof from ORIGIN chain (where deposit exists)
    const merkleChainConfig = crossChain
      ? getChainConfig(depositChain as 'base' | 'polygon')
      : this.chainConfig;

    if (crossChain) {
      logger.debug(`🔀 Cross-chain payment: ${depositChain} → ${paymentChain}`);
      logger.debug(`⚡ Fetching Merkle proof from origin chain (${depositChain})...`);
    }

    // Fetch Merkle proof from the correct chain's subgraph
    const merkleProof = await fetchMerkleProofFromSubgraph(
      commitmentHash,
      merkleChainConfig
    );

    // Generate change commitment
    const newSecret = randomFieldElement();
    const newNullifier = randomFieldElement();
    const changeCommitment = await poseidonHash3(
      newSecret,
      newNullifier,
      changeAmountMicro
    );

    // Generate burner wallet
    const burner = generateBurnerWallet();
    const burnerAccount = privateKeyToAccount(burner.privateKey as `0x${string}`);

    // Generate ZK proof
    const { proof, publicSignals } = await generateProof(
      {
        secret: commitment.secret,
        nullifier: commitment.nullifier,
        amount: commitment.amount.toString(),
        newSecret: newSecret.toString(),
        newNullifier: newNullifier.toString(),
        merkleProof,
        paymentAmount: paymentAmountMicro.toString(),
        changeAmount: changeAmountMicro.toString(),
        recipient: burnerAccount.address, // Withdraw to burner
      },
      this.wasmPath,
      this.zkeyPath
    );

    // Get nonce
    const nonce = await getNonce(this.chainConfig);

    // Convert commitments to hex format for encoding
    const changeCommitmentHex = '0x' + BigInt(changeCommitment).toString(16).padStart(64, '0');
    const commitmentHashHex = '0x' + BigInt(commitmentHash).toString(16).padStart(64, '0');

    // Cross-chain attestation (already detected cross-chain status above)
    let originEid = 0;
    let attestationData: `0x${string}` | undefined;

    if (crossChain) {
      // Calculate nullifier hash for attestation request
      const nullifierHash = publicSignals[1]; // nullifierHash is the SECOND public signal (index 1)

      logger.debug(`🔐 Requesting cross-chain attestation...`);

      // Get attestation from attestor service
      const attestation = await getAttestationForPayment(
        this.attestorUrl,
        depositChain,
        paymentChain,
        nullifierHash
      );

      if (!attestation) {
        throw new Error('Cross-chain payment requires attestation but failed to get one');
      }

      originEid = attestation.originEid;
      attestationData = attestation.attestationData;

      logger.debug(`✅ Got attestation (originEid: ${originEid})`);
    }

    // Build UserOperation (with optional attestation data for cross-chain)
    const userOp = await buildPaymentUserOp(
      proof,
      publicSignals,
      burnerAccount.address,
      paymentAmountMicro,
      changeCommitmentHex,
      changeAmountMicro,
      originEid,
      commitmentHashHex,
      this.chainConfig,
      nonce,
      this.bundlerUrl,
      attestationData  // Pass attestation data for cross-chain
    );

    // Submit UserOperation
    const userOpHash = await submitUserOperation(
      userOp,
      this.bundlerUrl,
      this.chainConfig.entryPointAddress
    );

    // Wait for confirmation
    const receipt = await waitForUserOpConfirmation(userOpHash, this.bundlerUrl);

    // Update note (remove spent commitment, add change)
    const updatedCommitments: NoteCommitment[] = [];

    if (changeAmountMicro > 0n) {
      updatedCommitments.push({
        secret: newSecret.toString(),
        nullifier: newNullifier.toString(),
        amount: Number(changeAmountMicro),
        depositChain: this.chainConfig.chainName,
      });
    }

    const updatedNote: Note = {
      version: '2.0',
      commitments: updatedCommitments,
    };

    this.currentNote = updatedNote;

    return {
      note: updatedNote,
      txHash: receipt.transactionHash,
      nullifierHash: publicSignals[0],
      burnerAddress: burnerAccount.address,
      burnerPrivateKey: burner.privateKey,
    };
  }

  /**
   * Get current note (updated after payments)
   */
  getUpdatedNote(): Note | undefined {
    return this.currentNote;
  }

  /**
   * Set current note (for loading saved notes)
   */
  setNote(note: Note): void {
    validateNote(note);
    this.currentNote = note;
  }

  /**
   * Wrap fetch with automatic x402 payment handling
   * Usage:
   *   sdk.setNote(myNote);
   *   const fetchWithPay = sdk.wrapFetch(fetch);
   *   const response = await fetchWithPay('https://api.example.com/paid');
   *   const updatedNote = sdk.getUpdatedNote(); // Save this!
   */
  wrapFetch(baseFetch: typeof fetch): typeof fetch {
    const sdk = this;

    return async function fetchWithPayment(
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> {
      // Make initial request
      const response = await baseFetch(input, init);

      // If not 402, return as-is
      if (response.status !== 402) {
        return response;
      }

      // Parse x402 payment requirements from response body
      const responseBody = await response.json();

      if (!responseBody.accepts || responseBody.accepts.length === 0) {
        throw new Error('402 response missing payment accepts array');
      }

      // Find a crypto payment option (prefer base, then any)
      const cryptoOption = responseBody.accepts.find(
        (a: any) => a.network === sdk.chainConfig.chainName
      ) || responseBody.accepts.find(
        (a: any) => a.scheme === 'exact' || a.channel?.includes('crypto')
      );

      if (!cryptoOption) {
        throw new Error('No compatible payment option found in 402 response');
      }

      // Parse payment details from x402 format
      const paymentDetails = {
        // Amount in micro USDC (e.g., "10000" = 0.01 USDC)
        price: (parseInt(cryptoOption.maxAmountRequired || cryptoOption.amount) / 1_000_000).toString(),
        address: cryptoOption.payTo,
        network: cryptoOption.network,
        asset: cryptoOption.asset,
      };

      logger.debug(`📋 x402: Payment required - ${paymentDetails.price} USDC to ${paymentDetails.address}`);

      // Validate we have a note
      if (!sdk.currentNote || sdk.currentNote.commitments.length === 0) {
        throw new Error('No note available for payment. Call setNote() first.');
      }

      // Convert price to number (handle both string and number)
      const priceUSDC = typeof paymentDetails.price === 'string'
        ? parseFloat(paymentDetails.price)
        : paymentDetails.price;

      if (isNaN(priceUSDC) || priceUSDC <= 0) {
        throw new Error(`Invalid payment price: ${paymentDetails.price}`);
      }

      // Check balance
      const balance = calculateNoteBalance(sdk.currentNote);
      if (priceUSDC > balance) {
        throw new Error(`Insufficient balance. Need ${priceUSDC} USDC, have ${balance} USDC`);
      }

      // Step 1: ZK payment from note → burner wallet
      // makePayment creates a burner internally and returns its private key
      logger.debug(`💳 x402: Withdrawing ${priceUSDC} USDC to burner wallet`);

      const paymentResult = await sdk.makePayment(
        sdk.currentNote,
        '', // recipient is ignored - makePayment creates its own burner
        priceUSDC
      );

      // Use the burner that makePayment created (has the USDC!)
      const burnerAccount = privateKeyToAccount(paymentResult.burnerPrivateKey as `0x${string}`);

      logger.debug(`✅ x402: Withdrew to burner ${burnerAccount.address}. TX: ${paymentResult.txHash}`);

      // Step 3: Sign EIP-3009 transferWithAuthorization (gasless!)
      logger.debug(`📝 x402: Signing transfer authorization for ${priceUSDC} USDC to ${paymentDetails.address}`);

      const amountMicro = BigInt(Math.floor(priceUSDC * 1_000_000));
      const validAfter = 0n;  // Valid immediately
      const validBefore = BigInt(Math.floor(Date.now() / 1000) + 3600);  // Valid for 1 hour
      const nonce = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex')}` as `0x${string}`;

      // EIP-3009 transferWithAuthorization domain and types
      const domain = {
        name: 'USD Coin',  // USDC contract name
        version: '2',
        chainId: sdk.chainConfig.chainId,
        verifyingContract: sdk.chainConfig.usdcAddress as `0x${string}`,
      };

      const types = {
        TransferWithAuthorization: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'validAfter', type: 'uint256' },
          { name: 'validBefore', type: 'uint256' },
          { name: 'nonce', type: 'bytes32' },
        ],
      };

      const authMessage = {
        from: burnerAccount.address,
        to: paymentDetails.address as `0x${string}`,
        value: amountMicro,
        validAfter,
        validBefore,
        nonce,
      };

      // Sign the EIP-712 typed data
      const authSignature = await burnerAccount.signTypedData({
        domain,
        types,
        primaryType: 'TransferWithAuthorization',
        message: authMessage,
      });

      logger.debug(`✅ x402: Authorization signed`);

      // Step 4: Build payment proof with authorization
      const paymentProof = {
        // ZK withdrawal proof
        withdrawTxHash: paymentResult.txHash,
        nullifierHash: paymentResult.nullifierHash,

        // EIP-3009 authorization (server submits this to get paid)
        authorization: {
          from: burnerAccount.address,
          to: paymentDetails.address,
          value: amountMicro.toString(),
          validAfter: validAfter.toString(),
          validBefore: validBefore.toString(),
          nonce,
          signature: authSignature,
        },

        // Metadata
        network: sdk.chainConfig.chainName,
        chainId: sdk.chainConfig.chainId,
        usdcAddress: sdk.chainConfig.usdcAddress,
        amount: priceUSDC,
        timestamp: Date.now(),
      };

      // Sign the entire proof for integrity
      const proofMessage = JSON.stringify(paymentProof);
      const proofSignature = await burnerAccount.signMessage({ message: proofMessage });

      // Step 5: Retry request with x402 payment header
      // x402 expects the payment authorization in X-PAYMENT header (base64 encoded)
      const x402Payment = {
        x402Version: 1,
        scheme: 'exact',
        network: sdk.chainConfig.chainName,
        payload: {
          signature: paymentProof.authorization.signature,
          authorization: {
            from: paymentProof.authorization.from,
            to: paymentProof.authorization.to,
            value: paymentProof.authorization.value,
            validAfter: paymentProof.authorization.validAfter,
            validBefore: paymentProof.authorization.validBefore,
            nonce: paymentProof.authorization.nonce,
          },
        },
      };

      // Base64 encode the payment header (x402 standard)
      const x402PaymentBase64 = btoa(JSON.stringify(x402Payment));

      const retryInit: RequestInit = {
        ...init,
        headers: {
          ...init?.headers,
          'X-PAYMENT': x402PaymentBase64,
          // Also include full proof for servers that want more info
          'X-Payment-Proof': JSON.stringify({
            ...paymentProof,
            signature: proofSignature,
          }),
        },
      };

      return baseFetch(input, retryInit);
    };
  }
}
