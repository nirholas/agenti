/**
 * @fileoverview Module exports and initialization
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

/**
 * X402 Payment Protocol
 * 
 * Complete X402 implementation for AI agent payments
 * Exports all X402 functionality for easy integration
 * 
 * @see README_V2.md for usage examples
 * @since November 30, 2025
 */

export * from './types';
export * from './client';
export * from './tool-creator';
export * from './arbitrum-adapter';

export {
  X402Client,
  type X402ClientOptions,
  type PaymentRequest,
  type PaymentTransaction,
  type PaymentVerification,
} from './client';

export {
  createX402Tool,
  executeX402Tool,
  calculateRevenueSplit,
  getToolStats,
  getAllToolsStats,
  resetRateLimit,
  create402Response,
  type X402Tool,
  type ToolHandler,
  type ToolContext,
} from './tool-creator';

export {
  X402Config,
  X402Chain,
  X402Token,
  PricingTier,
  X402ToolPricing,
  RevenueSplit,
  PaymentAnalytics,
  PaymentEvent,
  PaymentEventListener,
  HTTP402Response,
  X402Error,
  X402ErrorCode,
  TOKEN_DECIMALS,
  CHAIN_IDS,
} from './types';
