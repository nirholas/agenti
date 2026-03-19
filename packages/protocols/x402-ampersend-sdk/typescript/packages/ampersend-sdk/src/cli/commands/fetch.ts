import { wrapFetchWithPayment } from "@x402/fetch"
import type { Command } from "commander"

import { NETWORKS, parseEnvConfig } from "../../ampersend/env.ts"
import { createAmpersendHttpClient } from "../../x402/http/factory.ts"
import { getConfigStatus, getRuntimeConfig } from "../config.ts"
import { err, ok, type JsonEnvelope } from "../envelope.ts"

interface FetchOptions {
  method: string
  header?: Array<string>
  data?: string
  inspect: boolean
  raw: boolean
  headers: boolean
}

interface ResponseData {
  status: number
  headers?: Record<string, string>
  body: unknown
  payment?: unknown
}

interface InspectData {
  url: string
  paymentRequired: boolean
  requirements?: unknown
  headers?: Record<string, string>
}

/**
 * Load configuration from env vars or config file
 * Env vars take precedence over config file
 * Returns structured error if not configured
 */
function loadConfig():
  | {
      ok: true
      config: { agentAccount: `0x${string}`; agentKey: `0x${string}`; network: string; apiUrl?: string }
    }
  | { ok: false; error: JsonEnvelope<never> } {
  // Try env vars first (takes precedence)
  try {
    const envConfig = parseEnvConfig()
    return {
      ok: true,
      config: {
        agentAccount: envConfig.AGENT_ACCOUNT as `0x${string}`,
        agentKey: envConfig.AGENT_KEY as `0x${string}`,
        network: envConfig.NETWORK,
        ...(envConfig.API_URL ? { apiUrl: envConfig.API_URL } : {}),
      },
    }
  } catch {
    // Fall back to config file
  }

  // Try config file
  const fileConfig = getRuntimeConfig()
  if (fileConfig) {
    if (fileConfig.status === "pending_agent") {
      return {
        ok: false,
        error: err("SETUP_INCOMPLETE", "Run `ampersend config set-agent <ADDRESS>` to complete setup", {
          status: "pending_agent",
          agentKeyAddress: fileConfig.agentKeyAddress,
        }),
      }
    }
    if (fileConfig.status === "ready" && fileConfig.agentAccount) {
      // Env var takes precedence over file config
      const apiUrl = process.env.AMPERSEND_API_URL ?? fileConfig.apiUrl
      return {
        ok: true,
        config: {
          agentAccount: fileConfig.agentAccount,
          agentKey: fileConfig.agentKey,
          network: process.env.AMPERSEND_NETWORK ?? "base",
          ...(apiUrl ? { apiUrl } : {}),
        },
      }
    }
  }

  // Neither env vars nor config file available
  const configStatus = getConfigStatus()
  if (configStatus.status === "not_initialized") {
    return {
      ok: false,
      error: err("NOT_CONFIGURED", "Run `ampersend config init`", { status: "not_initialized" }),
    }
  }
  return {
    ok: false,
    error: err("SETUP_INCOMPLETE", "Run `ampersend config set-agent <ADDRESS>`", {
      status: configStatus.status,
      ...(configStatus.agentKeyAddress ? { agentKeyAddress: configStatus.agentKeyAddress } : {}),
    }),
  }
}

/**
 * Parse headers from CLI format "Key: Value" to Headers object
 */
function parseHeaders(headerArgs: Array<string> | undefined): Headers {
  const headers = new Headers()
  for (const h of headerArgs ?? []) {
    const colonIndex = h.indexOf(":")
    if (colonIndex === -1) {
      console.error(`Invalid header format: ${h} (expected "Key: Value")`)
      process.exit(1)
    }
    const key = h.slice(0, colonIndex).trim()
    const value = h.slice(colonIndex + 1).trim()
    headers.set(key, value)
  }
  return headers
}

/**
 * Format headers for display
 */
function headersToObject(headers: Headers): Record<string, string> {
  const obj: Record<string, string> = {}
  headers.forEach((value, key) => {
    obj[key] = value
  })
  return obj
}

/**
 * Decode a base64-encoded JSON header value.
 * x402 v2 headers (PAYMENT-REQUIRED, PAYMENT-SIGNATURE, PAYMENT-RESPONSE) are base64-encoded.
 */
function decodeBase64Header(value: string): unknown {
  const decoded = Buffer.from(value, "base64").toString("utf-8")
  return JSON.parse(decoded)
}

/**
 * Build RequestInit from options, handling undefined body correctly
 */
function buildRequestInit(options: FetchOptions, headers: Headers): RequestInit {
  const init: RequestInit = {
    method: options.method,
    headers,
  }
  if (options.data !== undefined) {
    init.body = options.data
  }
  return init
}

/**
 * Inspect mode: fetch URL and display payment requirements without paying
 */
async function runInspect(url: string, options: FetchOptions): Promise<void> {
  const headers = parseHeaders(options.header)
  const response = await fetch(url, buildRequestInit(options, headers))

  const data: InspectData = {
    url,
    paymentRequired: response.status === 402,
  }

  // Include headers if requested
  if (options.headers) {
    data.headers = headersToObject(response.headers)
  }

  if (response.status === 402) {
    // Try to parse payment requirements
    try {
      // Check for v2 header first (base64-encoded JSON)
      const v2Header = response.headers.get("payment-required")
      if (v2Header) {
        data.requirements = decodeBase64Header(v2Header)
      } else {
        // Fall back to body (v1)
        const body = await response.text()
        if (body) {
          data.requirements = JSON.parse(body)
        }
      }
    } catch (e) {
      // Return error envelope for parse failures
      if (!options.raw) {
        console.log(
          JSON.stringify(
            err("PARSE_ERROR", `Failed to parse payment requirements: ${e instanceof Error ? e.message : String(e)}`),
            null,
            2,
          ),
        )
        return
      }
      console.error(`Error: Failed to parse payment requirements: ${e instanceof Error ? e.message : String(e)}`)
      return
    }
  }

  if (options.raw) {
    if (data.paymentRequired) {
      console.log(`Payment Required: YES`)
      console.log(`URL: ${url}`)
      if (data.requirements) {
        console.log(`\nRequirements:`)
        console.log(JSON.stringify(data.requirements, null, 2))
      }
    } else {
      console.log(`Payment Required: NO`)
      console.log(`URL: ${url}`)
      console.log(`Status: ${response.status} ${response.statusText}`)
    }
  } else {
    console.log(JSON.stringify(ok(data), null, 2))
  }
}

/**
 * Handle response output
 */
async function handleResponse(response: Response, options: FetchOptions): Promise<void> {
  if (options.raw) {
    const body = await response.text()
    console.log(body)
  } else {
    const body = await response.text()
    const contentType = response.headers.get("content-type") ?? ""
    let parsedBody: unknown = body
    if (contentType.includes("application/json")) {
      try {
        parsedBody = JSON.parse(body)
      } catch {
        // Keep as string if parsing fails
      }
    }
    const data: ResponseData = {
      status: response.status,
      body: parsedBody,
    }

    // Include headers only if requested
    if (options.headers) {
      data.headers = headersToObject(response.headers)
    }

    // Check if payment was made (look for payment response header, base64-encoded in x402 v2)
    const paymentResponse = response.headers.get("payment-response")
    if (paymentResponse) {
      data.payment = decodeBase64Header(paymentResponse)
    }

    console.log(JSON.stringify(ok(data), null, 2))
  }
}

/**
 * Execute fetch with automatic x402 payment handling
 */
async function runFetch(url: string, options: FetchOptions): Promise<void> {
  // Load configuration from file or env
  const configResult = loadConfig()
  if (!configResult.ok) {
    console.log(JSON.stringify(configResult.error, null, 2))
    process.exit(1)
  }

  const config = configResult.config

  // Create Ampersend HTTP client
  const ampersendClient = createAmpersendHttpClient({
    smartAccountAddress: config.agentAccount,
    sessionKeyPrivateKey: config.agentKey,
    apiUrl: config.apiUrl ?? "https://api.ampersend.ai",
    network: config.network as "base" | "base-sepolia",
  })

  // Wrap fetch with payment handling
  const fetchWithPayment = wrapFetchWithPayment(
    fetch,
    ampersendClient as unknown as Parameters<typeof wrapFetchWithPayment>[1],
  )

  // Build request
  const headers = parseHeaders(options.header)

  // Execute request
  const response = await fetchWithPayment(url, buildRequestInit(options, headers))

  await handleResponse(response, options)
}

/**
 * Execute the fetch command
 */
async function executeFetch(url: string, options: FetchOptions): Promise<void> {
  try {
    if (options.inspect) {
      await runInspect(url, options)
    } else {
      await runFetch(url, options)
    }
  } catch (error) {
    if (options.raw) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`)
    } else {
      console.log(JSON.stringify(err("REQUEST_ERROR", error instanceof Error ? error.message : String(error)), null, 2))
    }
    process.exit(1)
  }
}

/**
 * Register the fetch subcommand on a Commander program
 */
export function registerFetchCommand(program: Command): void {
  program
    .command("fetch")
    .description("Make HTTP requests with automatic x402 payment handling")
    .argument("<url>", "URL to request")
    .option("-X, --method <method>", "HTTP method", "GET")
    .option("-H, --header <header...>", "HTTP header (format: 'Key: Value')")
    .option("-d, --data <data>", "Request body data")
    .option("--inspect", "Show payment requirements without executing payment", false)
    .option("--raw", "Output raw response body instead of JSON", false)
    .option("--headers", "Include response headers in JSON output", false)
    .addHelpText(
      "after",
      `
Configuration:
  Run 'ampersend config init' to set up, or use environment variables:
  AMPERSEND_AGENT_SECRET           Combined format: agent_key:::agent_account
  AMPERSEND_NETWORK                Network: ${NETWORKS.join(", ")} (default: base)
  AMPERSEND_API_URL                Ampersend API URL (optional)

Examples:
  ampersend fetch https://api.example.com/endpoint
  ampersend fetch -X POST -H "Content-Type: application/json" -d '{"query":"test"}' https://api.example.com/
`,
    )
    .action(async (url: string, options: FetchOptions) => {
      await executeFetch(url, options)
    })
}

export { buildRequestInit, decodeBase64Header, executeFetch, headersToObject, parseHeaders, runFetch, runInspect }
