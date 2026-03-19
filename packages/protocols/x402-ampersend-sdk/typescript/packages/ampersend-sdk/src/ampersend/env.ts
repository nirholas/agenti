import { z } from "zod"

import { OWNABLE_VALIDATOR } from "../smart-account/constants.ts"

/**
 * Environment configuration for Ampersend smart account wallets.
 *
 * Supports two formats:
 * 1. Combined: AMPERSEND_AGENT_SECRET="agent_key:::agent_account"
 * 2. Separate: AMPERSEND_AGENT_ACCOUNT + AMPERSEND_AGENT_KEY
 *
 * The combined format is checked first. Error if both formats are present.
 */

/** Supported networks (Ampersend smart accounts only support Base) */
export const NETWORKS = ["base", "base-sepolia"] as const

export type Network = (typeof NETWORKS)[number]

/** Separator for AMPERSEND_AGENT_SECRET format */
const AGENT_SECRET_SEPARATOR = ":::"

/**
 * Parse AMPERSEND_AGENT_SECRET format: "agent_key:::agent_account"
 */
function parseAgentSecret(agentSecret: string): { agentKey: string; agentAccount: string } {
  const parts = agentSecret.split(AGENT_SECRET_SEPARATOR)
  if (parts.length !== 2) {
    throw new Error(
      `Invalid AMPERSEND_AGENT_SECRET format. Expected "agent_key${AGENT_SECRET_SEPARATOR}agent_account", got ${parts.length} parts`,
    )
  }
  const [agentKey, agentAccount] = parts
  if (!agentKey.startsWith("0x")) {
    throw new Error(`Invalid AMPERSEND_AGENT_SECRET: agent key must start with 0x`)
  }
  if (!agentAccount.startsWith("0x")) {
    throw new Error(`Invalid AMPERSEND_AGENT_SECRET: agent account must start with 0x`)
  }
  return { agentKey, agentAccount }
}

/**
 * Zod schema for validated config (after resolving AGENT_SECRET)
 */
const configSchema = z.object({
  AGENT_ACCOUNT: z.string().refine((val) => val.startsWith("0x"), {
    message: "AGENT_ACCOUNT must start with 0x",
  }),
  AGENT_KEY: z.string().refine((val) => val.startsWith("0x"), {
    message: "AGENT_KEY must start with 0x",
  }),
  VALIDATOR_ADDRESS: z
    .string()
    .refine((val) => val.startsWith("0x"), {
      message: "VALIDATOR_ADDRESS must start with 0x",
    })
    .default(OWNABLE_VALIDATOR),
  NETWORK: z.enum(NETWORKS).default("base"),
  API_URL: z.string().url().optional(),
})

/**
 * Ampersend environment configuration
 */
export type AmpersendEnvConfig = z.infer<typeof configSchema>

/**
 * Reads and validates Ampersend environment variables.
 *
 * Checks AMPERSEND_AGENT_SECRET first (combined format), then falls back to
 * separate AMPERSEND_AGENT_ACCOUNT + AMPERSEND_AGENT_KEY.
 *
 * @returns Validated environment configuration
 * @throws Error if configuration is invalid or missing
 */
export function parseEnvConfig(): AmpersendEnvConfig {
  const agentSecret = process.env.AMPERSEND_AGENT_SECRET
  const agentAccount = process.env.AMPERSEND_AGENT_ACCOUNT
  const agentKey = process.env.AMPERSEND_AGENT_KEY

  // Check for conflicting configuration
  if (agentSecret && (agentAccount || agentKey)) {
    throw new Error(
      "Cannot use both AMPERSEND_AGENT_SECRET and AMPERSEND_AGENT_ACCOUNT/AMPERSEND_AGENT_KEY. Use one or the other.",
    )
  }

  let account: string | undefined
  let key: string | undefined

  if (agentSecret) {
    // Parse combined format
    const parsed = parseAgentSecret(agentSecret)
    account = parsed.agentAccount
    key = parsed.agentKey
  } else {
    // Use separate env vars
    account = agentAccount
    key = agentKey
  }

  // Check required fields
  if (!account || !key) {
    throw new Error(
      "Missing wallet configuration. Provide either:\n" +
        "  AMPERSEND_AGENT_SECRET=agent_key:::agent_account\n" +
        "or:\n" +
        "  AMPERSEND_AGENT_ACCOUNT + AMPERSEND_AGENT_KEY",
    )
  }

  // Build and validate config
  return configSchema.parse({
    AGENT_ACCOUNT: account,
    AGENT_KEY: key,
    VALIDATOR_ADDRESS: process.env.AMPERSEND_VALIDATOR_ADDRESS,
    NETWORK: process.env.AMPERSEND_NETWORK,
    API_URL: process.env.AMPERSEND_API_URL,
  })
}
