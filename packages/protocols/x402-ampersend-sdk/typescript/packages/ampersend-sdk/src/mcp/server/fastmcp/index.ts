export type { OnExecute, OnPayment, WithX402PaymentOptions } from "./middleware.ts"
export { createX402Execute, withX402Payment } from "./middleware.ts"

// Re-export from aliased fastmcp so users don't need to install it separately
export { FastMCP } from "fastmcp"
