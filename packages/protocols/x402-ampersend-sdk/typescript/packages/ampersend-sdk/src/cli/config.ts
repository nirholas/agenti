import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

import { isAddress } from "viem"
import { generatePrivateKey, privateKeyToAddress } from "viem/accounts"

import { parseEnvConfig } from "../ampersend/env.ts"
import { err, ok, type ConfigStatus, type JsonEnvelope } from "./envelope.ts"

/** Config directory and file paths */
const CONFIG_DIR = join(homedir(), ".ampersend")
const CONFIG_FILE = join(CONFIG_DIR, "config.json")

/** Current config version */
const CONFIG_VERSION = 1

// Re-export ConfigStatus for consumers
export type { ConfigStatus }

/** Default API URL (production) */
export const DEFAULT_API_URL = "https://api.ampersend.ai"

/**
 * Generate a config name from agent key address and agent account.
 * Format: agentKeyAddress:::agentAccount (both lowercase)
 */
export function generateConfigName(agentKeyAddress: string, agentAccount: string): string {
  return `${agentKeyAddress.toLowerCase()}:::${agentAccount.toLowerCase()}`
}

/** Stored configuration V1 */
export interface StoredConfigV1 {
  version: 1
  agentKey: `0x${string}`
  agentAccount?: `0x${string}`
  apiUrl?: string
}

/** Current stored config type */
export type StoredConfig = StoredConfigV1

/** Runtime configuration with derived fields */
export interface RuntimeConfig extends Omit<StoredConfig, "version"> {
  agentKeyAddress: `0x${string}`
  status: ConfigStatus
}

/**
 * Ensure config directory exists with secure permissions
 */
function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { mode: 0o700, recursive: true })
  }
}

/**
 * Read config file if it exists
 */
export function readConfig(): StoredConfig | null {
  if (!existsSync(CONFIG_FILE)) {
    return null
  }
  const content = readFileSync(CONFIG_FILE, "utf-8")
  const parsed = JSON.parse(content) as Record<string, unknown>
  // Ensure version field exists (for forward compatibility)
  return {
    version: 1,
    agentKey: parsed.agentKey as `0x${string}`,
    ...(parsed.agentAccount ? { agentAccount: parsed.agentAccount as `0x${string}` } : {}),
    ...(parsed.apiUrl ? { apiUrl: parsed.apiUrl as string } : {}),
  }
}

/**
 * Write config file with secure permissions
 */
function writeConfig(config: Omit<StoredConfig, "version">): void {
  ensureConfigDir()
  const withVersion: StoredConfig = { version: CONFIG_VERSION, ...config }
  writeFileSync(CONFIG_FILE, JSON.stringify(withVersion, null, 2), { mode: 0o600 })
}

/**
 * Get runtime config with status and derived fields
 */
export function getRuntimeConfig(): RuntimeConfig | null {
  const stored = readConfig()
  if (!stored) {
    return null
  }

  const { version: _, ...rest } = stored
  const agentKeyAddress = privateKeyToAddress(rest.agentKey)
  const status: ConfigStatus = rest.agentAccount ? "ready" : "pending_agent"

  return {
    ...rest,
    agentKeyAddress,
    status,
  }
}

/**
 * Get configuration status for error messages
 */
export function getConfigStatus(): { status: ConfigStatus; agentKeyAddress?: `0x${string}` } {
  const config = getRuntimeConfig()
  if (!config) {
    return { status: "not_initialized" }
  }
  return { status: config.status, agentKeyAddress: config.agentKeyAddress }
}

/**
 * Initialize configuration with a new agent key
 */
export function initConfig(): JsonEnvelope<{ agentKeyAddress: string; status: ConfigStatus }> {
  const existing = readConfig()
  if (existing) {
    const agentKeyAddress = privateKeyToAddress(existing.agentKey)
    if (existing.agentAccount) {
      return err("ALREADY_CONFIGURED", "Already configured. Use `ampersend config status` to view.", {
        status: "ready",
        agentKeyAddress,
      })
    }
    // Return existing pending config
    return ok({ agentKeyAddress, status: "pending_agent" as ConfigStatus })
  }

  // Generate new agent key
  const agentKey = generatePrivateKey()
  const agentKeyAddress = privateKeyToAddress(agentKey)

  writeConfig({ agentKey })

  return ok({ agentKeyAddress, status: "pending_agent" as ConfigStatus })
}

/**
 * Set agent account address to complete configuration
 */
export function setAgent(
  agentAccount: string,
): JsonEnvelope<{ configName: string; agentKeyAddress: string; agentAccount: string; status: ConfigStatus }> {
  const existing = readConfig()
  if (!existing) {
    return err("NOT_INITIALIZED", "Not initialized. Run `ampersend config init` first.", { status: "not_initialized" })
  }

  // Validate address format using viem's isAddress (handles checksum validation)
  if (!isAddress(agentAccount)) {
    return err("INVALID_ADDRESS", "Invalid Ethereum address format.")
  }

  const agentKeyAddress = privateKeyToAddress(existing.agentKey)

  writeConfig({
    agentKey: existing.agentKey,
    agentAccount: agentAccount as `0x${string}`,
    ...(existing.apiUrl ? { apiUrl: existing.apiUrl } : {}),
  })

  return ok({
    configName: generateConfigName(agentKeyAddress, agentAccount),
    agentKeyAddress,
    agentAccount,
    status: "ready" as ConfigStatus,
  })
}

/**
 * Set API URL (for non-production environments)
 */
export function setApiUrl(apiUrl: string): JsonEnvelope<{ apiUrl: string }> {
  const existing = readConfig()
  if (!existing) {
    return err("NOT_INITIALIZED", "Not initialized. Run `ampersend config init` first.", { status: "not_initialized" })
  }

  // Validate URL format
  try {
    new URL(apiUrl)
  } catch {
    return err("INVALID_URL", "Invalid URL format.")
  }

  writeConfig({
    agentKey: existing.agentKey,
    ...(existing.agentAccount ? { agentAccount: existing.agentAccount } : {}),
    apiUrl,
  })

  return ok({ apiUrl })
}

/**
 * Clear API URL (revert to production default)
 */
export function clearApiUrl(): JsonEnvelope<{ apiUrl: string }> {
  const existing = readConfig()
  if (!existing) {
    return err("NOT_INITIALIZED", "Not initialized. Run `ampersend config init` first.", { status: "not_initialized" })
  }

  writeConfig({
    agentKey: existing.agentKey,
    ...(existing.agentAccount ? { agentAccount: existing.agentAccount } : {}),
  })

  return ok({ apiUrl: DEFAULT_API_URL })
}

/** Configuration source */
export type ConfigSource = "env" | "file" | "none"

/** Status output options */
export interface StatusOptions {
  verbose?: boolean
}

/**
 * Get current configuration status
 * Checks env vars first (takes precedence), then config file
 * @param options.verbose - Include raw addresses in output
 */
export function getStatus(options: StatusOptions = {}): JsonEnvelope<{
  status: ConfigStatus
  source: ConfigSource
  configName?: string
  agentKeyAddress?: string
  agentAccount?: string
  apiUrl?: string
}> {
  const { verbose = false } = options

  // Check env vars first (takes precedence)
  try {
    const envConfig = parseEnvConfig()
    const apiUrl = envConfig.API_URL
    const agentKeyAddress = privateKeyToAddress(envConfig.AGENT_KEY as `0x${string}`)
    const agentAccount = envConfig.AGENT_ACCOUNT

    const baseResult = {
      status: "ready" as ConfigStatus,
      source: "env" as ConfigSource,
      configName: generateConfigName(agentKeyAddress, agentAccount),
    }

    if (verbose) {
      return ok({
        ...baseResult,
        agentKeyAddress,
        agentAccount,
        ...(apiUrl && apiUrl !== DEFAULT_API_URL ? { apiUrl } : {}),
      })
    }

    return ok(baseResult)
  } catch {
    // No env vars, check file
  }

  // Check config file
  const config = getRuntimeConfig()
  if (!config) {
    return ok({ status: "not_initialized", source: "none" })
  }

  // Determine effective API URL (env var takes precedence over file)
  const envApiUrl = process.env.AMPERSEND_API_URL
  const effectiveApiUrl = envApiUrl ?? config.apiUrl

  const baseResult = {
    status: config.status,
    source: "file" as ConfigSource,
    // Only include configName when ready (both addresses exist)
    ...(config.agentAccount ? { configName: generateConfigName(config.agentKeyAddress, config.agentAccount) } : {}),
  }

  if (verbose) {
    return ok({
      ...baseResult,
      agentKeyAddress: config.agentKeyAddress,
      ...(config.agentAccount ? { agentAccount: config.agentAccount } : {}),
      ...(effectiveApiUrl && effectiveApiUrl !== DEFAULT_API_URL ? { apiUrl: effectiveApiUrl } : {}),
    })
  }

  return ok(baseResult)
}
