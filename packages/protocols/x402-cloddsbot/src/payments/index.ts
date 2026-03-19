/**
 * Clodds Payments Module
 *
 * Supports:
 * - x402: HTTP 402 machine-to-machine crypto payments
 *
 * Future:
 * - Lightning Network
 * - Stripe (fiat)
 */

// x402 Protocol
export {
  // Client
  createX402Client,
  createPaidFetch,
  createX402AxiosInterceptor,

  // Server
  createX402Server,

  // EVM (Base)
  createEvmWallet,
  signEvmPayment,
  verifyEvmPayment,

  // Solana
  createSolanaWallet,
  signSolanaPayment,
  verifySolanaPayment,

  // Utilities
  formatX402Amount,
  getUsdcAddress,
  checkX402Support,
} from './x402/index';

export type {
  X402Network,
  X402Scheme,
  X402PaymentDetails,
  X402PaymentOption,
  X402PaymentPayload,
  X402Config,
  X402PaymentResult,
  X402Client,
  X402ServerConfig,
  X402EndpointConfig,
  X402Middleware,
  EvmWallet,
  SolanaWallet,
} from './x402/index';
