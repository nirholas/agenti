/**
 * XActions Premium - Main Entry Point
 * 
 * x402 paid premium features for XActions Twitter automation.
 * 
 * @example
 * ```typescript
 * import { createXActionsPaymentClient, PREMIUM_PRICING } from '@nirholas/xactions-premium';
 * 
 * const client = await createXActionsPaymentClient({
 *   privateKey: process.env.X402_PRIVATE_KEY,
 *   sessionCookie: process.env.X_AUTH_TOKEN,
 *   network: 'base-sepolia',
 * });
 * 
 * // Analyze sentiment ($0.001/tweet)
 * const sentiment = await client.analyzeSentiment(['Great product!', 'Terrible service']);
 * 
 * // Predict engagement ($0.005/prediction)
 * const prediction = await client.predictEngagement('🚀 Launching our new feature!');
 * 
 * // Subscribe to auto-engagement ($0.10/day)
 * const subscription = await client.subscribeAutoEngagement(7);
 * ```
 * 
 * @packageDocumentation
 */

// Client
export {
  XActionsPaymentClient,
  createXActionsPaymentClient,
  NETWORK_CONFIGS,
  PREMIUM_PRICING,
  BULK_DISCOUNTS,
  type XActionsPaymentClientConfig,
  type PremiumPricing,
  type PaymentResult,
  type SentimentResult,
  type EngagementPrediction,
  type SubscriptionStatus,
  type NetworkConfig,
} from './client.js';

// MCP Tools
export {
  PREMIUM_TOOLS,
  XActionsPremiumToolExecutor,
  registerPremiumTools,
  type MCPTool,
  type MCPToolResult,
} from './mcp-tools.js';

// Default export
import { createXActionsPaymentClient } from './client.js';
export default createXActionsPaymentClient;
