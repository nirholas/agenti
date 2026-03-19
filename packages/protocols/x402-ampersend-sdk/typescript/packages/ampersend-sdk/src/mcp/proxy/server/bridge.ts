import type { IncomingMessage, ServerResponse } from "http"

import type { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js"
import type { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import type { Transport, TransportSendOptions } from "@modelcontextprotocol/sdk/shared/transport.js"
import {
  isJSONRPCRequest,
  isJSONRPCResponse,
  type JSONRPCMessage,
  type JSONRPCRequest,
  type MessageExtraInfo,
} from "@modelcontextprotocol/sdk/types.js"

import type { X402Treasurer } from "../../../x402/treasurer.ts"
import { X402Middleware } from "../../client/index.ts"
import { addMeta } from "../../client/protocol.ts"

export class X402BridgeTransport implements Transport {
  private _leftTransport: StreamableHTTPServerTransport
  private _rightTransport: StreamableHTTPClientTransport
  private _requestById: Map<string | number, JSONRPCRequest> = new Map()
  private _start?: Promise<void>
  private _close?: Promise<void>
  private readonly MAX_PENDING_REQUESTS = 1000

  // Bridge callbacks
  onclose?: () => void
  onerror?: (error: Error) => void
  onmessage?: (message: JSONRPCMessage, extra?: MessageExtraInfo) => void

  constructor({
    leftTransport,
    rightTransport,
    treasurer,
  }: {
    leftTransport: StreamableHTTPServerTransport
    treasurer: X402Treasurer
    rightTransport: StreamableHTTPClientTransport
  }) {
    const x402Middleware = new X402Middleware({
      treasurer,
    })

    this._leftTransport = leftTransport
    this._rightTransport = rightTransport

    // Forward messages from left to right
    this._leftTransport.onmessage = (message, _extra) => {
      this._sendRight(message).catch((err) => this.onerror?.(new Error(`Failed to send right: ${err}`)))
    }

    // Forward responses from right to left
    const syntheticIdPrefix = "retry_with_payment__" // avoid ID collisions on retries
    this._rightTransport.onmessage = (response) => {
      if (!("id" in response)) {
        this._leftTransport.send(response)
        return
      }

      const request = this._requestById.get(response.id)
      // Right transport sent a response we didn't request?
      if (!request) {
        this._leftTransport.send(response)
        return
      }

      // Always delete the request from tracking - prevents memory leak
      this._requestById.delete(response.id)

      const originalId = request.params?._meta?.["ampersend/original-id"] as number | string | undefined
      if (originalId !== undefined) {
        response = { ...response, id: originalId }
      }

      // Process ALL responses through middleware to detect payment responses
      x402Middleware
        .onMessage(request, response)
        .then((retryWithPayment) => {
          if (retryWithPayment) {
            const request = addMeta(retryWithPayment, "ampersend/original-id", retryWithPayment.id)
            request.id = `${syntheticIdPrefix}${retryWithPayment.id}`

            this._requestById.set(request.id, request)
            this._rightTransport.send(request)
          } else {
            // Middleware processed (e.g., payment status update) or just forwarding
            this._leftTransport.send(response)
          }
        })
        .catch((err) => {
          console.error("[MCP-PROXY] x402 middleware error:", err)
          // Forward response even on middleware error
          this._leftTransport.send(response)
        })
    }

    // Forward errors from both sides
    this._leftTransport.onerror = (error) => {
      console.error("[MCP-PROXY] Left transport error:", error.message)
      this.onerror?.(error)
    }
    this._rightTransport.onerror = (error) => {
      console.error("[MCP-PROXY] Right transport error:", error.message)
      this.onerror?.(error)
    }

    // Handle close from either side
    this._leftTransport.onclose = () => {
      this.close()
    }
    this._rightTransport.onclose = () => {
      this.close()
    }
  }

  async start(): Promise<void> {
    return (this._start ||= Promise.resolve().then(() => this._doStart()))
  }

  private async _doStart(): Promise<void> {
    await Promise.all([this._leftTransport.start(), this._rightTransport.start()])
  }

  async send(message: JSONRPCMessage, _options?: TransportSendOptions): Promise<void> {
    if (isJSONRPCRequest(message)) {
      return await this._sendRight(message)
    } else if (isJSONRPCResponse(message)) {
      return await this._leftTransport.send(message)
    }
  }

  async close(): Promise<void> {
    return (this._close ||= Promise.resolve().then(() => this._doClose()))
  }

  private async _doClose(): Promise<void> {
    await Promise.all([this._leftTransport.close(), this._rightTransport.close()]).catch((err) =>
      this.onerror?.(new Error(`Failed to close transports: ${err}`)),
    )
    this.onclose?.()
  }

  setProtocolVersion(version: string): void {
    this._rightTransport.setProtocolVersion?.(version)
  }

  async handleRequest(
    req: IncomingMessage & {
      auth?: AuthInfo
    },
    res: ServerResponse,
    parsedBody?: unknown,
  ): Promise<void> {
    await this._leftTransport.handleRequest(req, res, parsedBody)
  }

  private async _sendRight(message: JSONRPCMessage): Promise<void> {
    if (isJSONRPCRequest(message)) {
      if (this._requestById.size >= this.MAX_PENDING_REQUESTS) {
        throw new Error(`Request tracking limit reached (${this.MAX_PENDING_REQUESTS}). Server may be unresponsive.`)
      }
      this._requestById.set(message.id, message)
    }

    return await this._rightTransport.send(message)
  }
}
