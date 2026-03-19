/**
 * Shared JSON envelope types for CLI output.
 *
 * All CLI commands use this consistent envelope format for machine-readable output.
 * Error envelopes always include a code and message for programmatic handling.
 */

/** Configuration status - defined here to avoid circular dependencies */
export type ConfigStatus = "not_initialized" | "pending_agent" | "ready"

/** Success envelope */
export type JsonOk<T> = { ok: true; data: T }

/** Error envelope - always includes code and message for consistency */
export type JsonErr = {
  ok: false
  error: {
    code: string
    message: string
    status?: ConfigStatus
    agentKeyAddress?: string
  }
}

/** Union type for all envelope responses */
export type JsonEnvelope<T> = JsonOk<T> | JsonErr

/**
 * Create a success envelope
 */
export function ok<T>(data: T): JsonEnvelope<T> {
  return { ok: true, data }
}

/**
 * Create an error envelope with code and message
 */
export function err(
  code: string,
  message: string,
  extra?: { status?: ConfigStatus; agentKeyAddress?: string },
): JsonEnvelope<never> {
  return { ok: false, error: { code, message, ...extra } }
}
