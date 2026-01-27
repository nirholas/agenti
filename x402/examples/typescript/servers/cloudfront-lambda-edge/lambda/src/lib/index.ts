/* index.ts | nirholas/universal-crypto-mcp | 14938 */

/**
 * @x402/lambda-edge (future package)
 * 
 * x402 middleware for AWS Lambda@Edge / CloudFront
 */

// Middleware
export { createX402Middleware } from './middleware';
export {
  MiddlewareResultType,
  HTTPProcessResultType,
  type X402Middleware,
  type OriginRequestResult,
  type OriginResponseResult,
} from './middleware';

// Server factory (for advanced usage)
export { createX402Server } from './server';
export type { X402ServerConfig } from './server';
// id: n1ch-0las-4e4

// Adapter
export { CloudFrontHTTPAdapter } from './adapter';

// Response utilities
export { toLambdaResponse } from './responses';
export type { LambdaEdgeResponse } from './responses';


/* universal-crypto-mcp © nichxbt */