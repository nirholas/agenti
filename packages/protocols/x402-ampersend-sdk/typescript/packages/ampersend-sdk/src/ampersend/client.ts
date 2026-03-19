import { Mutex } from "async-mutex"
import { DateTime, Schema } from "effect"
import { SiweMessage } from "siwe"
import { privateKeyToAccount } from "viem/accounts"

import {
  AgentPaymentAuthResponse,
  AgentPaymentEventResponse,
  ApiError,
  SIWELoginResponse,
  SIWENonceResponse,
  type Address,
  type AgentPaymentAuthRequest,
  type AgentPaymentEventReport,
  type ApiClientOptions,
  type AuthenticationState,
  type PaymentEvent,
  type PaymentPayload,
  type PaymentRequirements,
  type SIWELoginRequest,
} from "./types.js"

export * from "./types.js"

/**
 * TypeScript SDK for the API
 *
 * Provides simple methods to interact with the payment authorization API,
 * including SIWE authentication and payment lifecycle management.
 */
export class ApiClient {
  private baseUrl: string
  private sessionKeyPrivateKey: `0x${string}` | undefined
  private agentAddress: Address
  private timeout: number
  private authMutex = new Mutex()
  private auth: AuthenticationState = {
    token: null,
    expiresAt: null,
  }

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "") // Remove trailing slash
    this.sessionKeyPrivateKey = options.sessionKeyPrivateKey
    this.agentAddress = options.agentAddress
    this.timeout = options.timeout ?? 30000
  }

  /**
   * Internal method to perform authentication without mutex (for use within mutex)
   */
  private async performAuthentication(): Promise<void> {
    if (!this.sessionKeyPrivateKey) {
      throw new ApiError("Session key private key is required for authentication")
    }

    try {
      const account = privateKeyToAccount(this.sessionKeyPrivateKey)
      const sessionKeyAddress = account.address

      // Step 1: Get nonce
      const nonceResponse = await this.fetch("/api/v1/agents/auth/nonce", { method: "GET" }, SIWENonceResponse)
      const nonce = nonceResponse.nonce
      const sessionId = nonceResponse.sessionId

      // Step 2: Create SIWE message
      const domain = new URL(this.baseUrl).host
      const siweMessage = new SiweMessage({
        domain,
        address: sessionKeyAddress,
        statement: "Sign in to API",
        uri: this.baseUrl,
        version: "1",
        chainId: 1, // Could be configurable
        nonce,
        issuedAt: new Date().toISOString(),
      })

      // Step 3: Sign the message
      const message = siweMessage.prepareMessage()
      const signature = await account.signMessage({ message })

      // Step 4: Login with signature
      const loginRequest: SIWELoginRequest = {
        message,
        signature,
        sessionId,
        agentAddress: this.agentAddress,
      }

      const loginResponse = await this.fetch(
        "/api/v1/agents/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(loginRequest),
        },
        SIWELoginResponse,
      )

      // Verify returned agentAddress matches what we configured
      if (loginResponse.agentAddress.toLowerCase() !== this.agentAddress.toLowerCase()) {
        throw new ApiError(`Agent address mismatch: requested ${this.agentAddress}, got ${loginResponse.agentAddress}`)
      }

      // Store authentication state (agentAddress comes from config, not server)
      this.auth = {
        token: loginResponse.token,
        expiresAt: DateTime.toDateUtc(loginResponse.expiresAt),
      }
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      throw new ApiError(`Authentication failed: ${error}`)
    }
  }

  /**
   * Request authorization for a payment
   */
  async authorizePayment(
    requirements: readonly [PaymentRequirements, ...Array<PaymentRequirements>],
    context?: AgentPaymentAuthRequest["context"],
  ): Promise<AgentPaymentAuthResponse> {
    await this.ensureAuthenticated()

    const request: AgentPaymentAuthRequest = {
      requirements,
      context,
    }

    return this.fetch(
      `/api/v1/agents/${this.agentAddress}/payment/authorize`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.auth.token}`,
        },
        body: JSON.stringify(request),
      },
      AgentPaymentAuthResponse,
    )
  }

  /**
   * Report a payment lifecycle event
   */
  async reportPaymentEvent(
    eventId: string,
    payment: PaymentPayload,
    event: PaymentEvent,
  ): Promise<AgentPaymentEventResponse> {
    await this.ensureAuthenticated()

    const report: AgentPaymentEventReport = {
      id: eventId,
      payment,
      event,
    }

    return this.fetch(
      `/api/v1/agents/${this.agentAddress}/payment/events`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.auth.token}`,
        },
        body: JSON.stringify(report),
      },
      AgentPaymentEventResponse,
    )
  }

  /**
   * Clear the current authentication state
   */
  clearAuth(): void {
    this.auth = {
      token: null,
      expiresAt: null,
    }
  }

  /**
   * Get the configured agent address
   */
  getAgentAddress(): Address {
    return this.agentAddress
  }

  /**
   * Check if currently authenticated and token is valid
   */
  isAuthenticated(): boolean {
    return !!(this.auth.token && this.auth.expiresAt && this.auth.expiresAt > new Date())
  }

  /**
   * Ensure the client is authenticated, performing authentication if needed
   */
  private async ensureAuthenticated(): Promise<void> {
    return this.authMutex.runExclusive(async () => {
      if (!this.isAuthenticated()) {
        await this.performAuthentication()
      }
    })
  }

  /**
   * Internal fetch wrapper with error handling and schema decoding
   */
  private async fetch<A, I>(path: string, init: RequestInit, schema: Schema.Schema<A, I>): Promise<A> {
    const url = `${this.baseUrl}${path}`

    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(this.timeout),
      })

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status} ${response.statusText}`
        try {
          const errorBody = await response.text()
          if (errorBody) {
            errorMessage += `: ${errorBody}`
          }
        } catch {
          // Ignore error body parsing failures
        }
        throw new ApiError(errorMessage, response.status, response)
      }

      const data = await response.json()
      return Schema.decodeUnknownSync(schema)(data)
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new ApiError(`Request timeout after ${this.timeout}ms`)
      }
      throw new ApiError(`Request failed: ${error}`)
    }
  }
}
