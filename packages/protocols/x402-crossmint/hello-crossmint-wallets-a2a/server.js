import express from "express";
import { JsonRpcProvider, Contract, Interface } from "ethers";
import { DefaultRequestHandler, InMemoryTaskStore } from "@a2a-js/sdk/server";
import { A2AExpressApp } from "@a2a-js/sdk/server/express";

// x402 extension constants per spec
const X402_EXTENSION_URI = "https://github.com/google-a2a/a2a-x402/v0.1";
const X402_STATUS_KEY = "x402.payment.status";
const X402_REQUIRED_KEY = "x402.payment.required";
const X402_PAYLOAD_KEY = "x402.payment.payload";
const X402_RECEIPTS_KEY = "x402.payment.receipts";

// Merchant/token configuration (env configurable)
const MERCHANT_ADDRESS = process.env.MERCHANT_ADDRESS; // the payee/recipient (required)
const ASSET_ADDRESS = process.env.ASSET_ADDRESS || "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // usdc on base sepolia
const X402_NETWORK = process.env.X402_NETWORK || "base-sepolia"; // e.g., "base" or "base-sepolia"
const PRICE_USDC = process.env.PRICE_USDC || "1"; // decimal string, e.g., "1" or "1.50"
const PRICE_ATOMIC = process.env.PRICE_ATOMIC; // optional override in atomic units string
const MAX_TIMEOUT_SECONDS = parseInt(process.env.MAX_TIMEOUT_SECONDS || "600", 10);

// On-chain settlement configuration (set these for a fully functional demo)
const RPC_URL = process.env.RPC_URL; // e.g. Base mainnet/sepolia RPC

const ERC20_METADATA_ABI = [
  "function name() view returns (string)",
  "function version() view returns (string)",
  "function decimals() view returns (uint8)"
];
const ERC20_TRANSFER_EVENT_IFACE = new Interface([
  "event Transfer(address indexed from, address indexed to, uint256 value)"
]);

async function getDomain(provider, tokenAddress) {
  const net = await provider.getNetwork();
  const token = new Contract(tokenAddress, ERC20_METADATA_ABI, provider);
  let name = "USD Coin";
  let version = "2";
  try {
    name = await token.name();
  } catch (e) {
    console.warn(`[server] Failed to fetch token name for ${tokenAddress}. Using default.`, e?.message || e);
  }
  try {
    const v = await token.version();
    if (typeof v === "string" && v.length > 0) version = v;
  } catch (e) {
    console.warn(`[server] Failed to fetch token version for ${tokenAddress}. Using default.`, e?.message || e);
  }
  return {
    name,
    version,
    chainId: Number(net.chainId),
    verifyingContract: tokenAddress,
  };
}

function decimalToAtomic(decimalStr, decimals) {
  const [whole, frac = ""] = String(decimalStr).split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  const combined = `${whole}${fracPadded}`.replace(/^0+/, "");
  return combined.length ? combined : "0";
}

async function getTokenDecimals(provider, tokenAddress, fallbackDecimals) {
  try {
    const token = new Contract(tokenAddress, ERC20_METADATA_ABI, provider);
    const d = await token.decimals();
    const n = Number(d);
    if (!Number.isNaN(n) && n > 0 && n < 255) return n;
  } catch (e) {
    console.warn(`[server] Could not fetch token decimals for ${tokenAddress}, using fallback.`, e?.message || e);
  }
  return fallbackDecimals;
}

// Create a minimal AgentCard advertising the x402 extension
const agentCard = {
  name: "JS Merchant Agent",
  description: "Minimal merchant that requires x402 payment for a service",
  url: "http://localhost:10000",
  version: "0.1.0",
  defaultInputModes: ["text", "text/plain"],
  defaultOutputModes: ["text", "text/plain"],
  capabilities: {
    streaming: true,
    extensions: [
      {
        uri: X402_EXTENSION_URI,
        description: "Supports payments using the x402 protocol for on-chain settlement.",
        required: true,
      },
    ],
  },
};

// Simple executor that triggers payment for any request
class MerchantExecutor {
  constructor(provider, signer) {
    this.provider = provider;
    this.signer = signer;
  }

  async execute(requestContext, eventBus) {
    const { taskId, contextId, userMessage } = requestContext;
    const meta = (userMessage && userMessage.metadata) || {};

    console.log("[server] execute start", {
      taskId,
      contextId,
      status: meta[X402_STATUS_KEY] || null,
      hasPayload: Boolean(meta[X402_PAYLOAD_KEY]),
    });

    if (meta[X402_STATUS_KEY] === "payment-submitted" && taskId) {
      console.log("[server] payment-submitted received", {
        taskId,
        contextId,
      });

      // Extract direct-transfer fields from payload
      const payload = meta[X402_PAYLOAD_KEY];
      const selected = payload?.payload || {};
      const asset = selected.asset || ASSET_ADDRESS;
      const payer = selected.payer; // crossmint wallet address
      const to = selected.payTo || MERCHANT_ADDRESS;
      const value = selected.value;
      const txHash = selected.transaction;
      if (!payer || !to || !value || !txHash) {
        console.error("[server] missing required direct-transfer fields in payload");
        eventBus.publish({
          kind: "status-update",
          taskId,
          contextId,
          status: {
            state: "failed",
            message: {
              kind: "message",
              role: "agent",
              parts: [{ kind: "text", text: "Payment verification failed: invalid payload." }],
              metadata: { [X402_STATUS_KEY]: "payment-failed" },
            },
            timestamp: new Date().toISOString(),
          },
          final: true,
        });
        eventBus.finished();
        return;
      }
      // Publish payment-pending before verification
      eventBus.publish({
        kind: "status-update",
        taskId,
        contextId,
        status: {
          state: "working",
          message: {
            kind: "message",
            role: "agent",
            parts: [{ kind: "text", text: "Verifying on-chain transfer..." }],
            metadata: { [X402_STATUS_KEY]: "payment-pending" },
          },
        },
        final: false,
      });
      console.log("[server] payment-pending published", { taskId });

      if (!this.provider) {
        console.error("[server] RPC_URL not set. Cannot verify on-chain.");
        eventBus.publish({
          kind: "status-update",
          taskId,
          contextId,
          status: {
            state: "failed",
            message: {
              kind: "message",
              role: "agent",
              parts: [{ kind: "text", text: "Verification configuration missing (RPC_URL)." }],
              metadata: { [X402_STATUS_KEY]: "payment-failed" },
            },
            timestamp: new Date().toISOString(),
          },
          final: true,
        });
        eventBus.finished();
        return;
      }

      // Verify direct transfer by inspecting receipt logs (poll briefly until available)
      let txReceipt = null;
      for (let i = 0; i < 15; i++) {
        txReceipt = await this.provider.getTransactionReceipt(txHash);
        if (txReceipt != null) break;
        await new Promise((r) => setTimeout(r, 1000));
      }
      if (!txReceipt || txReceipt.status !== 1) {
        console.error("[server] receipt missing or failed", { txHash, status: txReceipt?.status });
        eventBus.publish({
          kind: "status-update",
          taskId,
          contextId,
          status: {
            state: "failed",
            message: {
              kind: "message",
              role: "agent",
              parts: [{ kind: "text", text: "Payment verification failed on-chain." }],
              metadata: { [X402_STATUS_KEY]: "payment-failed" },
            },
            timestamp: new Date().toISOString(),
          },
          final: true,
        });
        eventBus.finished();
        return;
      }

      // Confirm Transfer event exists on the token contract
      const transferEvent = txReceipt.logs
        .filter((l) => l.address.toLowerCase() === String(asset).toLowerCase())
        .map((l) => { try { return ERC20_TRANSFER_EVENT_IFACE.parseLog(l); } catch { return null; } })
        .find((e) => e && e.name === "Transfer");
      if (!transferEvent) {
        console.error("[server] token transfer not found in receipt", { txHash, token: asset });
        eventBus.publish({
          kind: "status-update",
          taskId,
          contextId,
          status: {
            state: "failed",
            message: {
              kind: "message",
              role: "agent",
              parts: [{ kind: "text", text: "Payment verification failed: no Transfer event." }],
              metadata: { [X402_STATUS_KEY]: "payment-failed" },
            },
            timestamp: new Date().toISOString(),
          },
          final: true,
        });
        eventBus.finished();
        return;
      }
      const { from, to: toAddr, value: amount } = transferEvent.args;
      if (
        String(from).toLowerCase() !== String(payer).toLowerCase() ||
        String(toAddr).toLowerCase() !== String(to).toLowerCase() ||
        String(amount.toString()) !== String(value)
      ) {
        console.error("[server] transfer mismatch", { from, toAddr, amount: amount.toString(), payer, to, value });
        eventBus.publish({
          kind: "status-update",
          taskId,
          contextId,
          status: {
            state: "failed",
            message: {
              kind: "message",
              role: "agent",
              parts: [{ kind: "text", text: "Payment verification failed: mismatch." }],
              metadata: { [X402_STATUS_KEY]: "payment-failed" },
            },
            timestamp: new Date().toISOString(),
          },
          final: true,
        });
        eventBus.finished();
        return;
      }

      // Append receipts history
      const prevReceipts = requestContext?.task?.status?.message?.metadata?.[X402_RECEIPTS_KEY] || [];
      const receipt = {
        success: true,
        transaction: txHash,
        network: X402_NETWORK,
        payer,
      };

      // Working update with completed payment and receipt
      eventBus.publish({
        kind: "status-update",
        taskId,
        contextId,
        status: {
          state: "working",
          message: {
            kind: "message",
            role: "agent",
            parts: [{ kind: "text", text: "Payment successful. Processing your request." }],
            metadata: {
              [X402_STATUS_KEY]: "payment-completed",
              [X402_RECEIPTS_KEY]: [...prevReceipts, receipt],
            },
          },
        },
        final: false,
      });
      console.log("[server] published working with payment-completed", { taskId });

      // Final completion (include payment metadata and receipts)
      eventBus.publish({
        kind: "status-update",
        taskId,
        contextId,
        status: {
          state: "completed",
          message: {
            kind: "message",
            role: "agent",
            parts: [{ kind: "text", text: "Payment successful. Your result is ready." }],
            metadata: {
              [X402_STATUS_KEY]: "payment-completed",
              [X402_RECEIPTS_KEY]: [...prevReceipts, receipt],
            },
          },
          timestamp: new Date().toISOString(),
        },
        final: true,
      });
      console.log("[server] published completed with receipt", receipt);
      eventBus.finished();
      return;
    }

    console.log("[server] publishing payment-required", { taskId, contextId });

    // Default path: require payment first — publish a Task and finish
    let domainForClient = undefined;
    let tokenDecimals = 6;
    try {
      if (this.provider) {
        domainForClient = await getDomain(this.provider, ASSET_ADDRESS);
        tokenDecimals = await getTokenDecimals(this.provider, ASSET_ADDRESS, 6);
      }
    } catch (e) {
      console.warn("[server] failed to derive token domain; client will use defaults", e?.message || e);
    }

    eventBus.publish({
      kind: "task",
      id: taskId,
      contextId,
      status: {
        state: "input-required",
        message: {
          kind: "message",
          role: "agent",
          parts: [{ kind: "text", text: "Payment is required to generate the result." }],
          metadata: {
            [X402_STATUS_KEY]: "payment-required",
            [X402_REQUIRED_KEY]: {
              x402Version: 1,
              accepts: [
                {
                  scheme: "direct-transfer",
                  network: X402_NETWORK,
                  resource: "https://api.example.com/generate",
                  description: "Generate a response",
                  mimeType: "application/json",
                  outputSchema: {},
                  asset: ASSET_ADDRESS,
                  payTo: MERCHANT_ADDRESS,
                  maxAmountRequired: PRICE_ATOMIC || decimalToAtomic(PRICE_USDC, tokenDecimals),
                  maxTimeoutSeconds: MAX_TIMEOUT_SECONDS,
                  extra: null,
                },
              ],
            },
          },
        },
      },
    });
    eventBus.finished();
    console.log("[server] published input-required and finished", { taskId, contextId });
  }

  async cancelTask(taskId, eventBus) {
    // contextId is not available here; publish without it
    console.log("[server] cancelTask", { taskId });
    eventBus.publish({
      kind: "status-update",
      taskId,
      status: { state: "canceled", timestamp: new Date().toISOString() },
      final: true,
    });
    eventBus.finished();
    console.log("[server] cancellation published", { taskId });
  }
}

async function main() {
  // Validate critical configuration before starting the server
  if (!RPC_URL) {
    console.error("[server] RPC_URL is required for settlement. Set it in your environment.");
    process.exit(1);
  }
  if (!MERCHANT_ADDRESS) {
    console.error("[server] MERCHANT_ADDRESS is required. Set MERCHANT_ADDRESS in your environment.");
    process.exit(1);
  }

  const app = express();
  app.use(express.json());

  // CORS middleware to allow requests from browser client
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-A2A-Extensions");
    res.setHeader("Access-Control-Expose-Headers", "X-A2A-Extensions");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    next();
  });

  // Echo extension activation header on all responses
  app.use((req, res, next) => {
    res.setHeader("X-A2A-Extensions", X402_EXTENSION_URI);
    next();
  });

  const taskStore = new InMemoryTaskStore();
  const sharedProvider = RPC_URL ? new JsonRpcProvider(RPC_URL) : undefined;
  const executor = new MerchantExecutor(sharedProvider, undefined);
  const requestHandler = new DefaultRequestHandler(agentCard, taskStore, executor);

  const a2a = new A2AExpressApp(requestHandler);
  a2a.setupRoutes(app);

  const port = 10000;
  app.listen(port, () => {
    console.log(`Merchant server listening on http://localhost:${port}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
