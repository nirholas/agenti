import { createPublicClient, http, type Hex, type Address, type Chain, defineChain } from 'viem';
import { 
  avalanche, 
  avalancheFuji,
  base, 
  baseSepolia, 
  mainnet, 
  polygon,
  polygonAmoy,
  sepolia,
} from 'viem/chains';
import {
  getRequiredAmount,
  type FacilitatorConfig,
  type PaymentRequirements,
  type SettleResponse,
  type SupportedKind,
  type SupportedResponse,
  type VerifyResponse,
  type X402PaymentPayload,
  type ChainId,
} from './types.js';
import { getChainIdFromNetwork, getNetworkFromChainId, getCaip2FromNetwork, defaultChains, isStacksChain } from './chains.js';
import { executeERC3009Settlement } from './erc3009.js';
import { executeSolanaSettlement } from './solana.js';
import { executeStacksSettlement } from './stacks.js';
import {
  deserializeSolanaTransaction,
  validateSolanaTransaction,
} from './solana-validation.js';
import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';

/**
 * Custom chain definitions for chains not in viem
 */
const iotex = defineChain({
  id: 4689,
  name: 'IoTeX',
  nativeCurrency: { name: 'IOTX', symbol: 'IOTX', decimals: 18 },
  rpcUrls: { default: { http: ['https://babel-api.mainnet.iotex.io'] } },
  blockExplorers: { default: { name: 'IoTeXScan', url: 'https://iotexscan.io' } },
});

const peaq = defineChain({
  id: 3338,
  name: 'Peaq',
  nativeCurrency: { name: 'PEAQ', symbol: 'PEAQ', decimals: 18 },
  rpcUrls: { default: { http: ['https://peaq.api.onfinality.io/public'] } },
  blockExplorers: { default: { name: 'Subscan', url: 'https://peaq.subscan.io' } },
});

const sei = defineChain({
  id: 1329,
  name: 'Sei',
  nativeCurrency: { name: 'SEI', symbol: 'SEI', decimals: 18 },
  rpcUrls: { default: { http: ['https://evm-rpc.sei-apis.com'] } },
  blockExplorers: { default: { name: 'SeiTrace', url: 'https://seitrace.com' } },
});

const seiTestnet = defineChain({
  id: 1328,
  name: 'Sei Testnet',
  nativeCurrency: { name: 'SEI', symbol: 'SEI', decimals: 18 },
  rpcUrls: { default: { http: ['https://evm-rpc-testnet.sei-apis.com'] } },
  blockExplorers: { default: { name: 'SeiTrace Testnet', url: 'https://testnet.seitrace.com' } },
  testnet: true,
});

const xlayer = defineChain({
  id: 196,
  name: 'XLayer',
  nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.xlayer.tech'] } },
  blockExplorers: { default: { name: 'OKX Explorer', url: 'https://www.okx.com/explorer/xlayer' } },
});

const xlayerTestnet = defineChain({
  id: 195,
  name: 'XLayer Testnet',
  nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
  rpcUrls: { default: { http: ['https://testrpc.xlayer.tech'] } },
  blockExplorers: { default: { name: 'OKX Explorer', url: 'https://www.okx.com/explorer/xlayer-test' } },
  testnet: true,
});

/**
 * Chain ID to viem chain mapping (EVM chains only)
 */
const viemChains: Record<number, Chain> = {
  // Mainnets
  43114: avalanche,
  8453: base,
  1: mainnet,
  4689: iotex,
  3338: peaq,
  137: polygon,
  1329: sei,
  196: xlayer,
  // Testnets
  43113: avalancheFuji,
  84532: baseSepolia,
  80002: polygonAmoy,
  1328: seiTestnet,
  11155111: sepolia,
  195: xlayerTestnet,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPublicClient = ReturnType<typeof createPublicClient<any, any>>;

/**
 * Check if a chain ID is an EVM chain
 */
function isEVMChain(chainId: ChainId): chainId is number {
  return typeof chainId === 'number';
}

/**
 * Facilitator class for handling x402 payment verification and settlement
 */
export class Facilitator {
  private config: FacilitatorConfig;
  private clients: Map<number, AnyPublicClient> = new Map();

  constructor(config: FacilitatorConfig) {
    this.config = config;
    this.initializeClients();
  }

  /**
   * Initialize viem clients for supported EVM chains
   */
  private initializeClients(): void {
    for (const chainId of this.config.supportedChains) {
      // Only initialize clients for EVM chains
      if (!isEVMChain(chainId)) continue;

      const chain = viemChains[chainId];
      const chainConfig = defaultChains[String(chainId)];

      if (chain && chainConfig) {
        const client = createPublicClient({
          chain,
          transport: http(chainConfig.rpcUrl),
        }) as AnyPublicClient;
        this.clients.set(chainId, client);
      }
    }
  }

  /**
   * Get the facilitator configuration
   */
  getConfig(): FacilitatorConfig {
    return this.config;
  }

  /**
   * Get supported payment kinds for this facilitator
   * Returns both v1 (human-readable network) and v2 (CAIP-2) format kinds
   * Deduped by network (one entry per network, not per token)
   */
  getSupported(): SupportedResponse {
    const kinds: SupportedKind[] = [];
    const seenNetworks = new Set<string>();

    for (const chainId of this.config.supportedChains) {
      const network = getNetworkFromChainId(chainId);
      if (!network || seenNetworks.has(network)) continue;
      seenNetworks.add(network);

      const caip2Network = getCaip2FromNetwork(network);
      const isSolana = chainId === 'solana' || chainId === 'solana-devnet';

      // v1 format - human-readable network name
      const v1Kind: SupportedKind = {
        x402Version: 1,
        scheme: 'exact',
        network,
      };

      // Add feePayer extra for Solana only (Stacks has no fee-payer model)
      if (isSolana) {
        v1Kind.extra = { feePayer: this.config.ownerAddress };
      }

      kinds.push(v1Kind);

      // v2 format - CAIP-2 network identifier
      if (caip2Network) {
        const v2Kind: SupportedKind = {
          x402Version: 2,
          scheme: 'exact',
          network: caip2Network,
        };

        if (isSolana) {
          v2Kind.extra = { feePayer: this.config.ownerAddress };
        }

        kinds.push(v2Kind);
      }
    }

    return {
      kinds,
    };
  }

  /**
   * Verify a payment payload
   */
  async verify(
    paymentPayload: string,
    requirements: PaymentRequirements
  ): Promise<VerifyResponse> {
    try {
      // Parse the base64-encoded payment payload
      const decoded = Buffer.from(paymentPayload, 'base64').toString('utf-8');
      const payload = JSON.parse(decoded);

      // Get chain ID from network
      const chainId = getChainIdFromNetwork(requirements.network);
      if (!chainId) {
        return {
          isValid: false,
          invalidReason: `Unsupported network: ${requirements.network}`,
        };
      }

      // Check if chain is supported by this facilitator
      const isSupported = this.config.supportedChains.some(
        (c) => String(c) === String(chainId)
      );
      if (!isSupported) {
        return {
          isValid: false,
          invalidReason: `Chain ${chainId} not supported by this facilitator`,
        };
      }

      // Handle Solana verification with full instruction validation
      if (chainId === 'solana' || chainId === 'solana-devnet') {
        const solanaPayload = payload.payload || payload;
        if (!solanaPayload.transaction) {
          return {
            isValid: false,
            invalidReason: 'Missing transaction in Solana payment payload',
          };
        }

        // Deserialize the transaction
        let transaction: Transaction | VersionedTransaction;
        try {
          transaction = deserializeSolanaTransaction(solanaPayload.transaction);
        } catch (e) {
          return {
            isValid: false,
            invalidReason: `Failed to deserialize Solana transaction: ${e instanceof Error ? e.message : 'Unknown error'}`,
          };
        }

        // Get the facilitator's Solana public key from the transaction's fee payer (index 0).
        // ownerAddress may be an EVM hex address for multi-chain facilitators,
        // but the fee payer in the transaction is always the Solana address.
        let facilitatorPubkey: PublicKey;
        if (transaction instanceof VersionedTransaction) {
          facilitatorPubkey = transaction.message.staticAccountKeys[0];
        } else {
          if (!transaction.feePayer) {
            return {
              isValid: false,
              invalidReason: 'Transaction missing fee payer',
            };
          }
          facilitatorPubkey = transaction.feePayer;
        }
        const validationResult = validateSolanaTransaction(transaction, facilitatorPubkey, {
          amount: getRequiredAmount(requirements),
          asset: requirements.asset,
          payTo: requirements.payTo,
        });

        if (!validationResult.valid) {
          return {
            isValid: false,
            invalidReason: validationResult.error || 'Transaction validation failed',
          };
        }

        return {
          isValid: true,
          payer: validationResult.payer || 'solana-payer',
        };
      }

      // Handle Stacks verification
      if (isStacksChain(chainId)) {
        // Stacks payloads have transaction in payload.payload.transaction
        const stacksPayload = payload.payload || payload;
        if (!stacksPayload.transaction) {
          return {
            isValid: false,
            invalidReason: 'Missing transaction in Stacks payment payload',
          };
        }
        // For Stacks, like Solana, we trust the pre-signed transaction
        // Full verification happens during settlement (broadcast + confirmation)
        return {
          isValid: true,
          payer: 'stacks-payer', // Payer is embedded in the transaction
        };
      }

      // EVM verification
      if (isEVMChain(chainId)) {
        const client = this.clients.get(chainId);
        if (!client) {
          return {
            isValid: false,
            invalidReason: `No client configured for chain ${chainId}`,
          };
        }

        // Extract authorization - handle both nested (payload.authorization) and flat (authorization) formats
        // Format 1: { authorization: {...}, signature: "..." }
        // Format 2: { payload: { authorization: {...}, signature: "..." } }
        let authorization = (payload as X402PaymentPayload).authorization;
        if (!authorization && payload.payload) {
          authorization = payload.payload.authorization;
        }
        
        if (!authorization) {
          return {
            isValid: false,
            invalidReason: 'Missing authorization in EVM payment payload',
          };
        }

        // Check timestamp validity
        const now = Math.floor(Date.now() / 1000);
        if (authorization.validAfter > now) {
          return {
            isValid: false,
            invalidReason: 'Payment not yet valid',
          };
        }
        if (authorization.validBefore < now) {
          return {
            isValid: false,
            invalidReason: 'Payment has expired',
          };
        }

        // Check amount meets requirements
        const paymentAmount = BigInt(authorization.value);
        const requiredAmount = BigInt(getRequiredAmount(requirements));
        if (paymentAmount < requiredAmount) {
          return {
            isValid: false,
            invalidReason: `Payment amount ${paymentAmount} is less than required ${requiredAmount}`,
          };
        }

        return {
          isValid: true,
          payer: authorization.from,
        };
      }

      return {
        isValid: false,
        invalidReason: `Unknown chain type: ${chainId}`,
      };
    } catch (error) {
      return {
        isValid: false,
        invalidReason: error instanceof Error ? error.message : 'Unknown error during verification',
      };
    }
  }

  /**
   * Settle a payment (execute the transfer)
   */
  async settle(
    paymentPayload: string,
    requirements: PaymentRequirements,
    privateKey?: string // Can be Hex for EVM or base58 for Solana
  ): Promise<SettleResponse> {
    try {
      // First verify the payment
      const verification = await this.verify(paymentPayload, requirements);
      if (!verification.isValid) {
        return {
          success: false,
          transaction: '',
          payer: verification.payer || '',
          network: requirements.network,
          errorReason: verification.invalidReason,
        };
      }

      // Parse payload
      const decoded = Buffer.from(paymentPayload, 'base64').toString('utf-8');
      const payload = JSON.parse(decoded);

      const chainId = getChainIdFromNetwork(requirements.network);
      if (!chainId) {
        return {
          success: false,
          transaction: '',
          payer: verification.payer || '',
          network: requirements.network,
          errorReason: `Unsupported network: ${requirements.network}`,
        };
      }

      if (!privateKey) {
        return {
          success: false,
          transaction: '',
          payer: verification.payer || '',
          network: requirements.network,
          errorReason: 'Private key required for settlement',
        };
      }

      // Handle Solana chains FIRST (before EVM check)
      if (chainId === 'solana' || chainId === 'solana-devnet') {
        // Solana payload structure: { payload: { transaction: "...", signature: "..." } }
        const solanaPayload = payload.payload || payload;
        const signedTransaction = solanaPayload.transaction;

        if (!signedTransaction) {
          return {
            success: false,
            transaction: '',
            payer: verification.payer || 'solana-payer',
            network: requirements.network,
            errorReason: 'Missing transaction in Solana payment payload',
          };
        }

        // For Solana, private key is base58 encoded (not hex)
        const result = await executeSolanaSettlement({
          network: chainId as 'solana' | 'solana-devnet',
          signedTransaction,
          facilitatorPrivateKey: privateKey,
        });

        if (result.success) {
          return {
            success: true,
            transaction: result.transactionHash || '',
            payer: verification.payer || 'solana-payer',
            network: requirements.network,
          };
        } else {
          return {
            success: false,
            transaction: '',
            payer: verification.payer || 'solana-payer',
            network: requirements.network,
            errorReason: result.errorMessage,
          };
        }
      }

      // Handle Stacks chains
      if (isStacksChain(chainId)) {
        const stacksPayload = payload.payload || payload;
        const signedTransaction = stacksPayload.transaction;

        if (!signedTransaction) {
          return {
            success: false,
            transaction: '',
            payer: verification.payer || 'stacks-payer',
            network: requirements.network,
            errorReason: 'Missing transaction in Stacks payment payload',
          };
        }

        // SECURITY: Pass payment requirements for post-confirmation verification
        const result = await executeStacksSettlement({
          network: chainId as 'stacks' | 'stacks-testnet',
          signedTransaction,
          facilitatorPrivateKey: privateKey,
          expectedRecipient: requirements.payTo,
          expectedAmount: getRequiredAmount(requirements),
          expectedAsset: requirements.asset,
        });

        return {
          success: result.success,
          transaction: result.transactionHash || '',
          payer: result.payer || verification.payer || 'stacks-payer',
          network: requirements.network,
          errorReason: result.errorMessage,
        };
      }

      // Handle EVM chains (Base, Ethereum)
      if (isEVMChain(chainId)) {
        // Extract authorization and signature - handle both nested and flat formats
        // Format 1: { authorization: {...}, signature: "..." }
        // Format 2: { payload: { authorization: {...}, signature: "..." } }
        let authorization = (payload as X402PaymentPayload).authorization;
        let signature = (payload as X402PaymentPayload).signature;

        if (!authorization && payload.payload) {
          authorization = payload.payload.authorization;
          signature = payload.payload.signature;
        }

        if (!authorization) {
          return {
            success: false,
            transaction: '',
            payer: verification.payer || '',
            network: requirements.network,
            errorReason: 'Missing authorization in EVM payment payload',
          };
        }

        const payerAddress = authorization.from as string;

        // Debug logging for EVM authorization
        console.log('[Facilitator] EVM authorization received:', JSON.stringify(authorization, null, 2));
        console.log('[Facilitator] EVM signature received:', signature);

        const result = await executeERC3009Settlement({
          chainId,
          tokenAddress: requirements.asset as Address,
          authorization: {
            from: authorization.from as Address,
            to: authorization.to as Address,
            value: authorization.value,
            validAfter: authorization.validAfter,
            validBefore: authorization.validBefore,
            nonce: authorization.nonce as Hex,
          },
          signature: signature as Hex,
          facilitatorPrivateKey: privateKey as Hex,
        });

        if (result.success) {
          return {
            success: true,
            transaction: result.transactionHash || '',
            payer: payerAddress,
            network: requirements.network,
          };
        } else {
          return {
            success: false,
            transaction: '',
            payer: payerAddress,
            network: requirements.network,
            errorReason: result.errorMessage,
          };
        }
      }

      return {
        success: false,
        transaction: '',
        payer: verification.payer || '',
        network: requirements.network,
        errorReason: `Unknown chain type: ${chainId}`,
      };
    } catch (error) {
      return {
        success: false,
        transaction: '',
        payer: '',
        network: requirements.network,
        errorReason: error instanceof Error ? error.message : 'Unknown error during settlement',
      };
    }
  }
}

/**
 * Create a new facilitator instance
 */
export function createFacilitator(config: FacilitatorConfig): Facilitator {
  return new Facilitator(config);
}
