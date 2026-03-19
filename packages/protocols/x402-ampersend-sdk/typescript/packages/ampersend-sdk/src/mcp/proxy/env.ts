import { z } from "zod"

import { OWNABLE_VALIDATOR } from "../../smart-account/constants.ts"

/**
 * Environment configuration schema for MCP proxy
 *
 * Supports two modes:
 * 1. Smart Account + AmpersendTreasurer (recommended)
 * 2. EOA + NaiveTreasurer (standalone testing)
 */

/**
 * Creates a Zod schema for environment variable validation with configurable prefix.
 *
 * @param envPrefix - The environment variable prefix (empty string for no prefix)
 * @returns Zod schema for validating environment variables
 */
export function createEnvSchema(envPrefix = "") {
  return z
    .object({
      PORT: z.coerce.number().int().min(1).max(65535).optional(),
      BUYER_PRIVATE_KEY: z
        .string()
        .refine((val) => val.startsWith("0x"), {
          message: `${envPrefix}BUYER_PRIVATE_KEY must start with 0x`,
        })
        .optional(),
      BUYER_SMART_ACCOUNT_ADDRESS: z
        .string()
        .refine((val) => val.startsWith("0x"), {
          message: `${envPrefix}BUYER_SMART_ACCOUNT_ADDRESS must start with 0x`,
        })
        .optional(),
      BUYER_SMART_ACCOUNT_KEY_PRIVATE_KEY: z
        .string()
        .refine((val) => val.startsWith("0x"), {
          message: `${envPrefix}BUYER_SMART_ACCOUNT_KEY_PRIVATE_KEY must start with 0x`,
        })
        .optional(),
      BUYER_SMART_ACCOUNT_VALIDATOR_ADDRESS: z
        .string()
        .refine((val) => val.startsWith("0x"), {
          message: `${envPrefix}BUYER_SMART_ACCOUNT_VALIDATOR_ADDRESS must start with 0x`,
        })
        .optional()
        .default(OWNABLE_VALIDATOR),
      BUYER_SMART_ACCOUNT_CHAIN_ID: z.coerce.number().int().optional(),
      AMPERSEND_API_URL: z.string().url().optional(),
    })
    .refine(
      (data) => {
        // Cannot have both EOA and Smart Account config
        return !(data.BUYER_PRIVATE_KEY && data.BUYER_SMART_ACCOUNT_ADDRESS)
      },
      {
        message: `Cannot specify both ${envPrefix}BUYER_PRIVATE_KEY and ${envPrefix}BUYER_SMART_ACCOUNT_ADDRESS. Only one wallet type allowed.`,
        path: ["BUYER_PRIVATE_KEY"],
      },
    )
    .refine(
      (data) => {
        // If smart account address is set, session key must be set (validator has default)
        if (data.BUYER_SMART_ACCOUNT_ADDRESS) {
          return data.BUYER_SMART_ACCOUNT_KEY_PRIVATE_KEY !== undefined
        }
        return true
      },
      {
        message: `Smart Account mode requires: ${envPrefix}BUYER_SMART_ACCOUNT_ADDRESS, ${envPrefix}BUYER_SMART_ACCOUNT_KEY_PRIVATE_KEY (${envPrefix}BUYER_SMART_ACCOUNT_VALIDATOR_ADDRESS is optional)`,
        path: ["BUYER_SMART_ACCOUNT_ADDRESS"],
      },
    )
    .refine(
      (data) => {
        // At least one wallet type must be configured
        return data.BUYER_PRIVATE_KEY || data.BUYER_SMART_ACCOUNT_ADDRESS
      },
      {
        message:
          `Missing wallet configuration. Provide either:\n` +
          `  - EOA mode: ${envPrefix}BUYER_PRIVATE_KEY\n` +
          `  - Smart Account mode: ${envPrefix}BUYER_SMART_ACCOUNT_ADDRESS, ` +
          `${envPrefix}BUYER_SMART_ACCOUNT_KEY_PRIVATE_KEY (${envPrefix}BUYER_SMART_ACCOUNT_VALIDATOR_ADDRESS is optional)`,
        path: ["BUYER_PRIVATE_KEY"],
      },
    )
}

/**
 * Type inferred from the env schema
 */
export type ProxyEnvConfig = z.infer<ReturnType<typeof createEnvSchema>>

/**
 * Reads and validates environment variables with the given prefix
 *
 * @param envPrefix - The environment variable prefix (empty string for no prefix)
 * @returns Validated environment configuration
 * @throws ZodError if validation fails
 */
export function parseEnvConfig(envPrefix = ""): ProxyEnvConfig {
  // Read env vars with prefix
  const envVars: Record<string, string | undefined> = {
    PORT: process.env[`${envPrefix}PORT`],
    BUYER_PRIVATE_KEY: process.env[`${envPrefix}BUYER_PRIVATE_KEY`],
    BUYER_SMART_ACCOUNT_ADDRESS: process.env[`${envPrefix}BUYER_SMART_ACCOUNT_ADDRESS`],
    BUYER_SMART_ACCOUNT_KEY_PRIVATE_KEY: process.env[`${envPrefix}BUYER_SMART_ACCOUNT_KEY_PRIVATE_KEY`],
    BUYER_SMART_ACCOUNT_VALIDATOR_ADDRESS: process.env[`${envPrefix}BUYER_SMART_ACCOUNT_VALIDATOR_ADDRESS`],
    BUYER_SMART_ACCOUNT_CHAIN_ID: process.env[`${envPrefix}BUYER_SMART_ACCOUNT_CHAIN_ID`],
    AMPERSEND_API_URL: process.env[`${envPrefix}AMPERSEND_API_URL`],
  }

  // Validate with schema
  const schema = createEnvSchema(envPrefix)
  return schema.parse(envVars)
}
