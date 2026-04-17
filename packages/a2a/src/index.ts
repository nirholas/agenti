// Types & constants
export {
  X402_EXTENSION_URI,
  PaymentStatus,
  META,
  ErrorCode,
} from './types.js'

export type {
  PaymentStatusValue,
  ErrorCodeValue,
  MerchantConfig,
  ClientConfig,
  A2AMessage,
  A2ATask,
  A2AArtifact,
  A2APart,
  A2ATextPart,
  A2ADataPart,
  TaskState,
  TaskStatus,
  X402PaymentRequired,
  X402Receipt,
  // re-exported from @agenti/facilitator
  PaymentPayload,
  PaymentRequired,
  VerifyResult,
  SettleResult,
} from './types.js'

// Extension helpers
export {
  extensionDeclaration,
  isExtensionActive,
  addActivationHeader,
  createAgentCard,
} from './extension.js'

export type { ExtensionDeclaration, AgentCard } from './extension.js'

// Merchant (seller) side
export { merchantMiddleware, MerchantAgent } from './merchant.js'

// Client (buyer) side
export { A2AClient, sendWithPayment, PaymentRejectedError, PaymentFailedError } from './client.js'
