/**
 * API module exports
 */

export {
  AgentClient,
  createAgentClient,
} from './agent-client';

export type {
  AgentConfig,
  InvokeRequest,
  InvokeResponse,
  StreamChunk,
} from './agent-client';

export {
  GatewayClient,
  createGatewayClient,
} from './gateway-client';

export type {
  GatewayConfig,
  AgentTrace,
  AgentReasoning,
  AuthMethod,
  AuthConfig,
} from './gateway-client';

// Gateway-specific types (use these when working with GatewayClient)
export type {
  InvokeRequest as GatewayInvokeRequest,
  InvokeResponse as GatewayInvokeResponse,
  StreamChunk as GatewayStreamChunk,
} from './gateway-client';

export {
  AuthService,
  createAuthService,
} from './auth';

export type {
  AWSCredentials,
  AuthHeaders,
} from './auth';

export {
  sha256,
  hmacSha256,
  bufferToHex,
  hexToBuffer,
  base64Encode,
  base64Decode,
} from './crypto-utils';
