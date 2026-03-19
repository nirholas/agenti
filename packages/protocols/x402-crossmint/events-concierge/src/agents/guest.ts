import { Agent, type Connection, type WSMessage } from "agents";
import { withX402Client } from "agents/x402";
import type { Env } from "../server";
import { NETWORK, GUEST_WALLET_LOCATOR } from "../constants";
import type { PaymentRequirements } from "x402/types";
import { CrossmintWallets, createCrossmint, type Wallet } from "@crossmint/wallets-sdk";
import { createX402Signer, checkWalletDeployment, deployWallet } from "../x402Adapter";
import { buildWalletInfo } from "./guest/utils";

/**
 * Guest Agent - Connects to Host MCP server and can pay for tools via x402
 * Uses Crossmint smart wallet to make payments
 */
export class Guest extends Agent<Env> {
  wallet!: Wallet<any>;
  confirmations: Record<string, (res: boolean) => void> = {};
  x402Client?: ReturnType<typeof withX402Client>;
  mcpConnected = false;
  mcpConnectionId?: string;
  mcpUrl?: string;
  hostWalletAddress?: string;

  /**
   * Broadcast a log message to all connected clients
   */
  private broadcastLog(type: 'info' | 'payment' | 'system' | 'error', message: string) {
    console.log(`[${type.toUpperCase()}] ${message}`);
    this.broadcast(
      JSON.stringify({
        type: "log",
        logType: type,
        message,
        timestamp: new Date().toISOString()
      })
    );
  }

  /**
   * Handle payment confirmation popup
   */
  async onPaymentRequired(paymentRequirements: PaymentRequirements[]) {
    const confirmationId = crypto.randomUUID().slice(0, 8);

    // Log 402 response received
    const req = paymentRequirements[0];
    const amountUSD = (Number(req.maxAmountRequired) / 1_000_000).toFixed(2);
    this.broadcastLog('payment', `🔒 402 Payment Required: $${amountUSD} USD for ${req.resource}`);
    this.broadcastLog('payment', `💳 Pay to: ${req.payTo}`);
    this.broadcastLog('payment', `🌐 Network: ${req.network}`);

    // Extract and store Host wallet address from payment requirements
    if (paymentRequirements.length > 0 && paymentRequirements[0].payTo) {
      const hostAddress = paymentRequirements[0].payTo;
      if (hostAddress !== this.hostWalletAddress) {
        this.hostWalletAddress = hostAddress;
        this.broadcastLog('info', `💼 Host wallet address discovered: ${hostAddress}`);

        const payload = await buildWalletInfo(this.wallet.address, this.hostWalletAddress);
        this.broadcast(JSON.stringify(payload));
      }
    }

    // Send payment popup to UI
    this.broadcast(
      JSON.stringify({
        type: "payment_required",
        confirmationId,
        requirements: paymentRequirements
      })
    );

    this.broadcastLog('payment', `⏳ Waiting for user confirmation (ID: ${confirmationId})...`);

    // Wait for user confirmation
    const prom = new Promise<boolean>((res) => {
      this.confirmations[confirmationId] = res;
    });

    const confirmed = await prom;

    if (confirmed) {
      this.broadcastLog('payment', `✅ Payment confirmed by user`);
      this.broadcastLog('payment', `🔐 Signing payment with EIP-712 typed data...`);
    } else {
      this.broadcastLog('payment', `❌ Payment cancelled by user`);
    }

    return confirmed;
  }

  async onStart() {
    console.log("👤 Guest Agent starting...");
    this.broadcastLog('system', `👤 Guest Agent initializing...`);

    // Initialize Crossmint SDK and create wallet with API key signer
    this.broadcastLog('info', `🔧 Creating Crossmint wallet with API key signer...`);

    const crossmint = createCrossmint({
      apiKey: this.env.CROSSMINT_API_KEY
    });
    const crossmintWallets = CrossmintWallets.from(crossmint);

    // Create or get wallet using consistent locator
    const locator = GUEST_WALLET_LOCATOR;
    this.wallet = await crossmintWallets.createWallet({
      chain: "base-sepolia",
      signer: { type: "api-key" },
      owner: locator
    });

    this.broadcastLog('system', `✅ Guest wallet ready: ${this.wallet.address}`);
    console.log(`💰 Guest wallet created: ${this.wallet.address}`);
  }

  async onConnect(conn: Connection) {
    console.log("🔗 New connection established, sending wallet info");
    this.broadcastLog('info', `🔗 WebSocket connection established`);

    // Send wallet info to the new connection
    if (!this.wallet) {
      conn.send(JSON.stringify({
        type: "error",
        message: "Guest wallet not initialized"
      }));
      return;
    }

    const payload = await buildWalletInfo(this.wallet.address, this.hostWalletAddress);
    conn.send(JSON.stringify(payload));
  }

  async onMessage(conn: Connection, message: WSMessage) {
    if (typeof message !== "string") {
      console.log("⚠️ Non-string message received:", message);
      return;
    }

    console.log("📨 Guest received message:", message);

    try {
      const parsed = JSON.parse(message);
      console.log("📦 Parsed message type:", parsed.type);

      switch (parsed.type) {

        case "disconnect_mcp": {
          // Disconnect from current MCP
          console.log("🔌 Disconnecting from MCP...");
          this.mcpConnected = false;
          this.x402Client = undefined;
          this.mcpConnectionId = undefined;
          this.hostWalletAddress = undefined;
          this.mcpUrl = undefined;

          // Broadcast updated wallet info
          const payload = await buildWalletInfo(this.wallet.address, undefined);
          this.broadcast(JSON.stringify({ ...payload, hostAddress: "Not connected to MCP" }));

          conn.send(JSON.stringify({
            type: "mcp_disconnected",
            message: "Disconnected from MCP"
          }));
          break;
        }

        case "connect_mcp": {
          // Connect to Host MCP server
          let mcpUrl = parsed.url || "https://events-concierge.angela-temp.workers.dev/mcp";
          // Normalize to fully-qualified https URL if missing protocol
          if (typeof mcpUrl === "string" && !/^https?:\/\//i.test(mcpUrl)) {
            mcpUrl = `https://${mcpUrl}`;
          }

          // If already connected to the SAME URL, just resend the tools list
          if (this.mcpConnected && this.x402Client && this.mcpUrl === mcpUrl) {
            console.log("🔄 Already connected to same MCP URL, resending tools list");
            try {
              const tools = await this.x402Client.listTools({});
              conn.send(JSON.stringify({
                type: "mcp_connected",
                mcpUrl: this.mcpUrl || mcpUrl,
                tools: tools.tools.map(t => ({
                  name: t.name,
                  description: t.description,
                  isPaid: t.annotations?.paymentHint || false,
                  price: t.annotations?.paymentPriceUSD || null
                }))
              }));
              console.log(`✅ Resent tools list (${tools.tools.length} tools)`);
            } catch (error) {
              console.error("❌ Failed to resend tools:", error);
              conn.send(JSON.stringify({
                type: "error",
                message: `Failed to get tools: ${error instanceof Error ? error.message : String(error)}`
              }));
            }
            return;
          }

          // If connected to a DIFFERENT URL, reset connection state
          if (this.mcpConnected && this.mcpConnectionId && this.mcpUrl !== mcpUrl) {
            console.log(`🔄 Switching from old MCP (${this.mcpUrl}) to new URL (${mcpUrl})`);
            // Reset connection state to allow new connection
            this.mcpConnected = false;
            this.x402Client = undefined;
            this.mcpConnectionId = undefined;
            this.hostWalletAddress = undefined; // Clear old host address

            // Broadcast updated wallet info with cleared host address
            const isDeployed = await checkWalletDeployment(this.wallet.address, "base-sepolia");
            this.broadcast(JSON.stringify({
              type: "wallet_info",
              guestAddress: this.wallet.address,
              hostAddress: "Connecting to new MCP...",
              network: NETWORK,
              guestWalletDeployed: isDeployed
            }));
          }

          try {
            this.broadcastLog('info', `🔌 Connecting to MCP server at ${mcpUrl}...`);
            this.broadcastLog('info', `📡 Using transport: streamable-http`);

            // Retry logic for demo stability
            let id: string | undefined;
            let lastError: Error | undefined;

            for (let attempt = 1; attempt <= 3; attempt++) {
              try {
                this.broadcastLog('info', `🔄 Connection attempt ${attempt}/3...`);
                const result = await this.mcp.connect(mcpUrl, {
                  transport: { type: "streamable-http" }
                });
                id = result.id;
                this.broadcastLog('system', `✅ MCP connection established with ID: ${id}`);
                break;
              } catch (err) {
                lastError = err instanceof Error ? err : new Error(String(err));
                this.broadcastLog('error', `⚠️ Attempt ${attempt} failed: ${lastError.message}`);
                if (attempt < 3) {
                  await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
              }
            }

            if (!id) {
              throw lastError || new Error("Failed to connect after 3 attempts");
            }

            // Wait for connection to be fully ready (discover completed)
            const waitForReady = async (connId: string, timeoutMs = 5000) => {
              const start = Date.now();
              while (Date.now() - start < timeoutMs) {
                const state = this.mcp.mcpConnections[connId]?.connectionState;
                if (state === "ready") return true;
                if (state === "failed") return false;
                await new Promise((r) => setTimeout(r, 150));
              }
              return this.mcp.mcpConnections[connId]?.connectionState === "ready";
            };

            let isReady = await waitForReady(id);

            if (!isReady) {
              const state = this.mcp.mcpConnections[id]?.connectionState;
              throw new Error(`MCP not ready (state: ${state || "unknown"}). Ensure the MCP server supports streamable-http transport.`);
            }

            // Build x402 client using Crossmint wallet
            if (!this.wallet) {
              conn.send(JSON.stringify({
                type: "error",
                message: "Guest wallet not initialized"
              }));
              return;
            }

            this.broadcastLog('info', `💰 Creating x402 payment client with wallet: ${this.wallet.address.slice(0, 10)}...`);

            const x402Signer = createX402Signer(this.wallet);

            this.x402Client = withX402Client(this.mcp.mcpConnections[id].client, {
              network: NETWORK,
              account: x402Signer
            });

            this.mcpConnected = true;
            this.mcpConnectionId = id;
            this.mcpUrl = mcpUrl;

            this.broadcastLog('info', `🔍 Discovering available MCP tools...`);

            // List available tools
            const tools = await this.x402Client.listTools({});

            const paidTools = tools.tools.filter(t => t.annotations?.paymentHint).length;
            const freeTools = tools.tools.length - paidTools;

            this.broadcastLog('system', `✅ MCP connected! Found ${tools.tools.length} tools (${freeTools} free, ${paidTools} paid)`);

            conn.send(JSON.stringify({
              type: "mcp_connected",
              mcpUrl,
              tools: tools.tools.map(t => ({
                name: t.name,
                description: t.description,
                isPaid: t.annotations?.paymentHint || false,
                price: t.annotations?.paymentPriceUSD || null
              }))
            }));
          } catch (error) {
            console.error("❌ MCP connection failed:", error);
            conn.send(JSON.stringify({
              type: "error",
              message: `Failed to connect to MCP: ${error instanceof Error ? error.message : String(error)}`
            }));
          }
          break;
        }

        case "call_tool": {
          // Call an MCP tool
          if (!this.x402Client) {
            conn.send(JSON.stringify({ type: "error", message: "Not connected to MCP" }));
            return;
          }

          try {
            this.broadcastLog('info', `🔧 Calling MCP tool: ${parsed.tool}`);
            this.broadcastLog('info', `📦 Arguments: ${JSON.stringify(parsed.arguments || {})}`);

            const result = await this.x402Client.callTool(
              this.onPaymentRequired.bind(this),
              {
                name: parsed.tool,
                arguments: parsed.arguments || {}
              }
            );

            if (result.isError) {
              this.broadcastLog('error', `❌ Tool call failed: ${parsed.tool}`);
            } else {
              this.broadcastLog('system', `✅ Tool call successful: ${parsed.tool}`);
            }

            // Forward tool result to client UI
            conn.send(JSON.stringify({
              type: result.isError ? "tool_error" : "tool_result",
              tool: parsed.tool,
              result: result.content[0]?.text || JSON.stringify(result)
            }));

            // If x402 settlement metadata is present, forward tx hash to UI
            try {
              const paymentMeta = (result as any)?._meta?.["x402/payment-response"]; // { success, transaction, network, payer }
              console.log("Payment metadata:", paymentMeta);
              if (paymentMeta?.transaction) {
                conn.send(JSON.stringify({
                  type: "payment_receipt",
                  txHash: paymentMeta.transaction,
                  network: paymentMeta.network,
                  payer: paymentMeta.payer
                }));
              }
            } catch (_) {
              // best-effort; ignore if structure is unexpected
            }
          } catch (error) {
            this.broadcastLog('error', `❌ Tool call failed: ${error instanceof Error ? error.message : String(error)}`);
            conn.send(JSON.stringify({
              type: "error",
              message: `Tool call failed: ${error instanceof Error ? error.message : String(error)}`
            }));
          }
          break;
        }

        case "confirm":
        case "cancel": {
          // Handle payment confirmation
          const confirmed = parsed.type === "confirm";

          // If payment is confirmed, check wallet deployment status
          if (confirmed && this.wallet) {
            try {
              this.broadcastLog('payment', `💳 Checking wallet deployment status...`);

              const isDeployed = await checkWalletDeployment(this.wallet.address, "base-sepolia");

              if (!isDeployed) {
                this.broadcastLog('payment', `⚠️ Wallet is pre-deployed (ERC-6492 mode)`);
                this.broadcastLog('payment', `🚀 Deploying wallet on-chain for settlement...`);

                conn.send(JSON.stringify({
                  type: "info",
                  message: "Deploying wallet for settlement..."
                }));

                const deploymentTxHash = await deployWallet(this.wallet);

                this.broadcastLog('system', `✅ Wallet deployed successfully!`);
                this.broadcastLog('system', `📝 Deployment tx: ${deploymentTxHash}`);

                // Broadcast updated wallet info with deployment status
                this.broadcast(
                  JSON.stringify({
                    type: "wallet_info",
                    guestAddress: this.wallet.address,
                    hostAddress: this.hostWalletAddress || "Will be retrieved from Host agent",
                    network: NETWORK,
                    guestWalletDeployed: true
                  })
                );

                conn.send(JSON.stringify({
                  type: "wallet_deployed",
                  txHash: deploymentTxHash,
                  message: "Wallet deployed for settlement"
                }));
              } else {
                this.broadcastLog('payment', `✅ Wallet already deployed, proceeding with payment signature`);
              }
            } catch (deployError) {
              this.broadcastLog('error', `❌ Wallet deployment failed: ${deployError instanceof Error ? deployError.message : String(deployError)}`);

              conn.send(JSON.stringify({
                type: "warning",
                message: `Wallet deployment failed: ${deployError instanceof Error ? deployError.message : String(deployError)}. Payment may fail.`
              }));
            }
          }

          this.confirmations[parsed.confirmationId]?.(confirmed);

          conn.send(JSON.stringify({
            type: "payment_response",
            confirmed,
            confirmationId: parsed.confirmationId
          }));
          break;
        }
      }
    } catch (error) {
      console.error("❌ Message handling error:", error);
    }
  }
}
