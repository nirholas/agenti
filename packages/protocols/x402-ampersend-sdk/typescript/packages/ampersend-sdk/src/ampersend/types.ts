import { Schema } from "effect"
import { isAddress, isHex } from "viem"

// ============ Primitives ============

export const Scheme = Schema.Literal("exact", "deferred")
export type Scheme = typeof Scheme.Type

export const Address = Schema.NonEmptyTrimmedString.pipe(
  Schema.filter(
    (val) => isAddress(val, { strict: false }) || "Must be a valid Ethereum address (0x followed by 40 hex characters)",
  ),
  Schema.annotations({
    jsonSchema: {
      type: "string",
      pattern: "^0x[a-fA-F0-9]{40}$",
      description: "Ethereum address",
    },
  }),
)
export type Address = typeof Address.Type

export const TxHash = Schema.NonEmptyTrimmedString.pipe(
  Schema.filter((val) => isHex(val) || "Must be a valid transaction hash (0x followed by hex characters)"),
)
export type TxHash = typeof TxHash.Type

type Caip2IDFormat = `eip155:${number}`
function isCaip2ID(val: string): val is Caip2IDFormat {
  return /^eip155:[0-9]{1,32}$/.test(val)
}

export const Caip2ID = Schema.NonEmptyTrimmedString.pipe(
  Schema.filter((val) => isCaip2ID(val) || "Must be a valid CAIP-2 chain ID (e.g., eip155:1)"),
)
export type Caip2ID = typeof Caip2ID.Type

// ============ SIWE Authentication Schemas ============

export class SIWENonceResponse extends Schema.Class<SIWENonceResponse>("SIWENonceResponse")({
  nonce: Schema.NonEmptyTrimmedString.annotations({
    description: "Random nonce for SIWE message",
  }),
  sessionId: Schema.NonEmptyTrimmedString.annotations({
    description: "Session identifier for nonce validation",
  }),
}) {}

export class SIWELoginRequest extends Schema.Class<SIWELoginRequest>("SIWELoginRequest")({
  signature: Schema.NonEmptyTrimmedString.annotations({
    description: "SIWE signature signed by session key",
  }),
  message: Schema.NonEmptyTrimmedString.annotations({
    description: "SIWE message that was signed",
  }),
  sessionId: Schema.NonEmptyTrimmedString.annotations({
    description: "Session identifier from nonce response",
  }),
  agentAddress: Address.annotations({
    description: "Agent smart account address",
  }),
}) {}

export class SIWELoginResponse extends Schema.Class<SIWELoginResponse>("SIWELoginResponse")({
  token: Schema.NonEmptyTrimmedString.annotations({
    description: "Random session token for agent",
  }),
  agentAddress: Address.annotations({
    description: "Agent smart account address (looked up from session key)",
  }),
  expiresAt: Schema.DateTimeUtc.annotations({
    description: "Token expiration time",
    jsonSchema: {
      type: "string",
      format: "date-time",
      description: "Token expiration time in ISO 8601 format",
    },
  }),
}) {}

// ============ Payment Requirements (from x402) ============

export class PaymentRequirements extends Schema.Class<PaymentRequirements>("PaymentRequirements")({
  scheme: Schema.Literal("exact").annotations({
    description: "Payment scheme - starting with exact only for MVP",
  }),
  network: Schema.NonEmptyTrimmedString.annotations({
    description: "Blockchain network identifier",
  }),
  maxAmountRequired: Schema.NonEmptyTrimmedString.annotations({
    description: "Maximum payment amount in atomic units (wei/gwei)",
  }),
  resource: Schema.NonEmptyTrimmedString.annotations({
    description: "Resource identifier for the payment",
  }),
  description: Schema.NonEmptyTrimmedString.annotations({
    description: "Human-readable payment description",
  }),
  mimeType: Schema.NonEmptyTrimmedString.annotations({
    description: "MIME type of the resource",
  }),
  payTo: Address.annotations({
    description: "Seller address to receive payment",
  }),
  maxTimeoutSeconds: Schema.Number.annotations({
    description: "Maximum timeout for payment completion",
  }),
  asset: Address.annotations({
    description: "Token contract address (e.g., USDC)",
  }),
  extra: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })).annotations({
    description: "Additional payment metadata",
  }),
}) {}

// ============ Agent Payment Authorization ============

export class AgentPaymentAuthRequest extends Schema.Class<AgentPaymentAuthRequest>("AgentPaymentAuthRequest")({
  requirements: Schema.NonEmptyArray(PaymentRequirements).annotations({
    description: "List of payment requirements from x402",
  }),
  context: Schema.optional(
    Schema.Struct({
      method: Schema.optional(Schema.NonEmptyTrimmedString),
      serverUrl: Schema.optional(Schema.NonEmptyTrimmedString),
      params: Schema.optional(Schema.Unknown),
    }),
  ).annotations({
    description: "Optional protocol call context for debugging (MCP method, A2A action, etc)",
  }),
}) {}

export class AgentPaymentAuthResponse extends Schema.Class<AgentPaymentAuthResponse>("AgentPaymentAuthResponse")({
  authorized: Schema.Struct({
    recommended: Schema.NullOr(Schema.NonNegativeInt).annotations({
      description:
        "Index of recommended payment requirement (cheapest option). Null if no requirements are authorized.",
    }),
    requirements: Schema.Array(
      Schema.Struct({
        requirement: PaymentRequirements.annotations({
          description: "Authorized payment requirement",
        }),
        limits: Schema.Struct({
          dailyRemaining: Schema.NonEmptyTrimmedString.annotations({
            description: "Remaining daily budget after this requirement (in wei)",
          }),
          monthlyRemaining: Schema.NonEmptyTrimmedString.annotations({
            description: "Remaining monthly budget after this requirement (in wei)",
          }),
        }).annotations({
          description: "Remaining spend limits after this specific requirement is used",
        }),
      }),
    ).annotations({
      description: "List of authorized payment requirements. Empty if none authorized.",
    }),
  }).annotations({
    description: "Authorized payment requirements with recommendation",
  }),
  rejected: Schema.Array(
    Schema.Struct({
      requirement: PaymentRequirements.annotations({
        description: "Rejected payment requirement",
      }),
      reason: Schema.NonEmptyTrimmedString.annotations({
        description: "Reason why this requirement was rejected",
      }),
    }),
  ).annotations({
    description: "List of rejected payment requirements with reasons",
  }),
}) {}

// ============ Payment Event Types ============

export const PaymentEventType = Schema.Union(
  Schema.Struct({
    type: Schema.Literal("sending").annotations({ description: "Payment is being sent" }),
  }),
  Schema.Struct({
    type: Schema.Literal("accepted").annotations({ description: "Payment was accepted" }),
  }),
  Schema.Struct({
    type: Schema.Literal("rejected"),
    reason: Schema.NonEmptyTrimmedString.annotations({ description: "Rejection reason" }),
  }),
  Schema.Struct({
    type: Schema.Literal("error"),
    reason: Schema.NonEmptyTrimmedString.annotations({ description: "Error details" }),
  }),
).annotations({
  description: "Payment lifecycle event types",
})
export type PaymentEventType = typeof PaymentEventType.Type

// ============ Exact EVM Payment ============

export class ExactEvmAuthorization extends Schema.Class<ExactEvmAuthorization>("ExactEvmAuthorization")({
  from: Address.annotations({
    description: "Payer address",
  }),
  to: Address.annotations({
    description: "Payee address",
  }),
  value: Schema.NonEmptyTrimmedString.annotations({
    description: "Payment amount in wei",
  }),
  validAfter: Schema.NonEmptyTrimmedString.annotations({
    description: "Valid after timestamp",
  }),
  validBefore: Schema.NonEmptyTrimmedString.annotations({
    description: "Valid before timestamp",
  }),
  nonce: Schema.NonEmptyTrimmedString.annotations({
    description: "Unique nonce for this authorization",
  }),
}) {}

export class ExactEvmPayload extends Schema.Class<ExactEvmPayload>("ExactEvmPayload")({
  signature: Schema.NonEmptyTrimmedString.annotations({
    description: "EIP-3009 signature",
  }),
  authorization: ExactEvmAuthorization.annotations({
    description: "Payment authorization details",
  }),
}) {}

// ============ x402 Payment Payload ============

export class PaymentPayload extends Schema.Class<PaymentPayload>("PaymentPayload")({
  x402Version: Schema.Number.annotations({
    description: "x402 protocol version",
  }),
  scheme: Schema.NonEmptyTrimmedString.annotations({
    description: "Payment scheme (exact/deferred)",
  }),
  network: Schema.NonEmptyTrimmedString.annotations({
    description: "Blockchain network",
  }),
  payload: Schema.Union(ExactEvmPayload, Schema.Unknown).annotations({
    description: "Scheme-specific payload (ExactEvmPayload or DeferredEvmPayload)",
  }),
}) {}

// ============ Agent Payment Event Report ============

export class AgentPaymentEventReport extends Schema.Class<AgentPaymentEventReport>("AgentPaymentEventReport")({
  id: Schema.NonEmptyTrimmedString.annotations({
    description: "Unique event ID from client",
  }),
  payment: PaymentPayload.annotations({
    description: "x402 payment payload",
  }),
  event: PaymentEventType.annotations({
    description: "Payment lifecycle event",
  }),
}) {}

export class AgentPaymentEventResponse extends Schema.Class<AgentPaymentEventResponse>("AgentPaymentEventResponse")({
  received: Schema.Boolean.annotations({
    description: "Confirmation that event was received",
  }),
  paymentId: Schema.optional(Schema.UUID).annotations({
    description: "Internal payment record ID if created",
  }),
}) {}

// ============ SDK-specific types ============

export interface ApiClientOptions {
  baseUrl: string
  sessionKeyPrivateKey?: `0x${string}`
  agentAddress: Address
  timeout?: number
}

export interface AuthenticationState {
  token: string | null
  expiresAt: Date | null
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public response?: Response,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

// Type alias for PaymentEvent (re-export PaymentEventType as PaymentEvent for convenience)
export type PaymentEvent = PaymentEventType
