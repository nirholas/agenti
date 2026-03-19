/**
 * Paymaster types for AVNU Paymaster integration
 */

import type { Call, TypedData } from 'starknet';
import type { StarknetNetwork } from './network.js';

/**
 * Paymaster configuration
 */
export interface PaymasterConfig {
  /** Paymaster JSON-RPC endpoint URL */
  endpoint: string;
  /** API key for sponsored transactions (optional) */
  apiKey?: string;
  /** Network identifier */
  network: StarknetNetwork;
}

/**
 * Fee mode for paymaster transactions
 */
export type PaymasterFeeMode =
  | {
      /** Sponsored mode - facilitator pays all gas */
      mode: 'sponsored';
    }
  | {
      /** Default mode - user pays gas in specified token */
      mode: 'default';
      /** Token address for gas payment */
      gas_token: string;
    };

/**
 * Paymaster RPC Call format (different from starknet.js Call)
 */
export interface PaymasterCall {
  /** Contract address to call */
  to: string;
  /** Function selector (hex-encoded hash) */
  selector: string;
  /** Calldata array (hex strings) */
  calldata: Array<string>;
}

/**
 * Invoke transaction parameters (starknet.js format - for API)
 */
export interface InvokeParameters {
  /** User's account address */
  user_address: string;
  /** Calls to execute */
  calls: Array<Call>;
}

/**
 * Invoke transaction parameters (RPC format - for internal use)
 */
export interface InvokeParametersRpc {
  /** User's account address */
  user_address: string;
  /** Calls to execute in paymaster RPC format */
  calls: Array<PaymasterCall>;
}

/**
 * Transaction parameters for paymaster (using RPC format)
 */
export type TransactionParameters =
  | {
      type: 'invoke';
      invoke: InvokeParametersRpc;
    }
  | {
      type: 'deploy';
      deployment: unknown; // Not needed for x402
    }
  | {
      type: 'deploy_and_invoke';
      deployment: unknown;
      invoke: InvokeParametersRpc;
    };

/**
 * Execution parameters
 */
export interface ExecutionParameters {
  /** Transaction version */
  version: '0x1' | '0x2' | '0x3';
  /** Fee mode */
  fee_mode: PaymasterFeeMode;
}

/**
 * Fee estimate
 */
export interface FeeEstimate {
  /** Overall fee amount */
  overall_fee: string;
  /** Gas consumed */
  gas_consumed: string;
  /** Gas price */
  gas_price: string;
  /** Token used for gas (address) */
  gas_token?: string;
}

/**
 * Build transaction request
 */
export interface BuildTransactionRequest {
  /** Transaction parameters */
  transaction: TransactionParameters;
  /** Execution parameters */
  parameters: ExecutionParameters;
}

/**
 * Invoke transaction response
 */
export interface InvokeTransactionResponse {
  /** Typed data for user to sign */
  typed_data: TypedData;
  /** Execution parameters echoed back */
  parameters: ExecutionParameters;
  /** Fee estimate */
  fee: FeeEstimate;
}

/**
 * Build transaction response
 */
export type BuildTransactionResponse =
  | {
      type: 'invoke';
      typed_data: TypedData;
      parameters: ExecutionParameters;
      fee: FeeEstimate;
    }
  | {
      type: 'deploy';
      deployment: unknown;
      parameters: ExecutionParameters;
      fee: FeeEstimate;
    }
  | {
      type: 'deploy_and_invoke';
      typed_data: TypedData;
      deployment: unknown;
      parameters: ExecutionParameters;
      fee: FeeEstimate;
    };

/**
 * Execute transaction request
 */
export interface ExecuteTransactionRequest {
  /** Transaction that was built (with typed_data and signature inside invoke) */
  transaction: ExecutableTransactionParameters;
  /** Execution parameters */
  parameters: ExecutionParameters;
}

/** Executable transaction parameters (for execute endpoint) */
export type ExecutableTransactionParameters =
  | {
      type: 'invoke';
      invoke: {
        user_address: string;
        typed_data: TypedData;
        signature: Array<string>;
      };
    }
  | {
      type: 'deploy';
      deployment: unknown; // Deployment parameters (not implemented yet)
    }
  | {
      type: 'deploy_and_invoke';
      deployment: unknown; // Deployment parameters (not implemented yet)
      invoke: {
        user_address: string;
        typed_data: TypedData;
        signature: Array<string>;
      };
    };

/**
 * Execute transaction response
 */
export interface ExecuteTransactionResponse {
  /** Transaction hash */
  transaction_hash: string;
}

/**
 * Supported tokens response
 */
export interface SupportedTokensResponse {
  /** List of supported gas token addresses */
  tokens: Array<string>;
}

/**
 * Service availability response
 */
export interface IsAvailableResponse {
  /** Whether the paymaster service is available */
  available: boolean;
  /** Optional message */
  message?: string;
}

/**
 * JSON-RPC request
 */
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params: unknown;
  id: number | string;
}

/**
 * JSON-RPC response
 */
export interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
  id: number | string;
}
