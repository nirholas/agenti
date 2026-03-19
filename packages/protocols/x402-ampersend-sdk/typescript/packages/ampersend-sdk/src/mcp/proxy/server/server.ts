import type { Server } from "node:http"

import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import express, { type Request, type Response } from "express"

import type { X402Treasurer } from "../../../x402/treasurer.ts"
import { X402BridgeTransport } from "./bridge.ts"
import { URLValidationError, validateTargetURL } from "./validation.ts"

export class ProxyServer {
  private _app = express()
  private _bridges = new Map<string, X402BridgeTransport>()
  private _httpServer: Server | null = null

  constructor(treasurer: X402Treasurer) {
    this._app.use(express.json())

    this._app.post("/mcp", async (req: Request, res: Response) => {
      const targetUrl = req.query.target as string

      if (!targetUrl) {
        res.status(400).json({ error: "Missing target URL parameter" })
        return
      }

      // Validate target URL format and protocol
      let validatedUrl: URL
      try {
        validatedUrl = validateTargetURL(targetUrl)
      } catch (err) {
        if (err instanceof URLValidationError) {
          res.status(400).json({ error: err.message, code: err.code })
          return
        }
        throw err
      }

      const sessionId = req.headers["mcp-session-id"] as string | undefined

      // For new sessions, create a bridge
      if (!sessionId || !this._bridges.has(sessionId)) {
        const leftTransport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => crypto.randomUUID(),
          onsessioninitialized: (sid) => {
            // Store the bridge
            this._bridges.set(sid, bridge)

            // Cleanup when bridge closes
            bridge.onclose = () => {
              this._bridges.delete(sid)
            }
          },
        })

        const bridge = new X402BridgeTransport({
          leftTransport,
          rightTransport: new StreamableHTTPClientTransport(validatedUrl),
          treasurer,
        })

        bridge.onerror = (err) => {
          if (err.message.includes("AbortError")) {
            console.log("Bridge aborted by client")
          }
          console.error(`Bridge error: ${err.message}`)
        }

        await bridge.start()

        await bridge.handleRequest(req, res, req.body)
      } else {
        // Use existing bridge
        const bridge = this._bridges.get(sessionId)!
        await bridge.handleRequest(req, res, req.body)
      }
    })

    this._app.delete("/mcp", async (req: Request, res: Response) => {
      const sessionId = req.headers["mcp-session-id"] as string
      if (!sessionId) {
        res.status(400).json({ error: "Missing session ID header" })
        return
      }

      const bridge = this._bridges.get(sessionId)
      if (!bridge) {
        res.status(404).json({ error: "Session not found" })
        return
      }

      await bridge.close()
      this._bridges.delete(sessionId)
      res.status(200).end()
    })
  }

  async start(port: number): Promise<void> {
    return new Promise((resolve) => {
      this._httpServer = this._app.listen(port, () => {
        console.info(`Starting HTTP proxy server on port ${port}`)
        console.info(`Connect with: http://localhost:${port}/mcp?target=<TARGET_URL>`)
        resolve()
      })
    })
  }

  async stop(): Promise<void> {
    // Close all bridges
    for (const bridge of this._bridges.values()) {
      await bridge.close()
    }
    this._bridges.clear()

    if (this._httpServer) {
      const server = this._httpServer
      return new Promise((resolve) => {
        server.close(() => resolve())
      })
    }
  }
}
