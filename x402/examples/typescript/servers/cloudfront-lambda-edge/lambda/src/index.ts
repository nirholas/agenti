/**
 * @file index.ts
 * @author nich.xbt
 * @copyright (c) 2026 nirholas
 * @license MIT
 * @repository universal-crypto-mcp
 * @version 0.4.14.3
 * @checksum 6e696368-786274-4d43-5000-000000000000
 */

/**
 * x402 Lambda@Edge Exports
 * 
 * Two separate handlers for CloudFront events:
 * - origin-request.ts: Payment verification
 * - origin-response.ts: Payment settlement (only on success)
 */

// Handler exports for Lambda deployment
export { handler as originRequestHandler } from './origin-request';
export { handler as originResponseHandler } from './origin-response';

// Re-export library for custom integrations
export * from './lib';


/* ucm:n1ch98c1f9a1 */