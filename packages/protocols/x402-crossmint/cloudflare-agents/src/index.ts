import { Hono } from "hono";
import { Agent, getAgentByName } from "agents";
import { wrapFetchWithPayment } from "x402-fetch";
import { paymentMiddleware } from "x402-hono";
import { CrossmintWallets, createCrossmint, type Wallet } from "@crossmint/wallets-sdk";
import { createX402Signer } from "./x402Adapter";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

// Environment type definition
type Env = {
  PAY_AGENT: DurableObjectNamespace;
  CROSSMINT_API_KEY: string;
};

/**
 * Check if a wallet is deployed on-chain
 */
async function checkWalletDeployment(walletAddress: string, chain: string): Promise<boolean> {
  try {
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http("https://sepolia.base.org")
    });

    const code = await publicClient.getCode({
      address: walletAddress as `0x${string}`
    });

    // If bytecode exists and is not just "0x", the wallet is deployed
    return code !== undefined && code !== '0x' && code.length > 2;
  } catch (error) {
    console.error('❌ Failed to check wallet deployment:', error);
    return false;
  }
}

/**
 * Deploy a pre-deployed wallet by making a minimal self-transfer
 */
async function deployWallet(wallet: Wallet<any>): Promise<string> {
  console.log("🚀 Deploying agent wallet on-chain...");

  try {
    const { EVMWallet } = await import("@crossmint/wallets-sdk");
    const evmWallet = EVMWallet.from(wallet);

    // Deploy wallet with a minimal self-transfer (1 wei)
    const deploymentTx = await evmWallet.sendTransaction({
      to: wallet.address,
      value: 1n, // 1 wei
      data: "0x"
    });

    console.log(`✅ Wallet deployed! Transaction: ${deploymentTx.hash}`);
    return deploymentTx.hash || `deployment_tx_${Date.now()}`;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("❌ Deployment error:", error);

    if (errorMsg.includes('insufficient') || errorMsg.includes('balance')) {
      throw new Error("Insufficient ETH balance for deployment gas fees");
    }

    throw new Error(`Wallet deployment failed: ${errorMsg}`);
  }
}

/**
 * PayAgent - An AI agent with a Crossmint wallet that automatically pays for protected APIs
 *
 * This agent demonstrates:
 * 1. Crossmint smart wallet creation (no private keys!)
 * 2. x402 payment protocol for autonomous payments
 * 3. Agent-to-agent wallet payments
 */
export class PayAgent extends Agent<Env> {
  wallet!: Wallet<any>;
  fetchWithPay!: ReturnType<typeof wrapFetchWithPayment>;

  async onRequest(req: Request) {
    const url = new URL(req.url);
    console.log("🤖 Agent attempting to fetch protected API");

    // Agent uses x402-enabled fetch to access paid endpoint
    const paidUrl = new URL("/protected-route", url.origin).toString();
    try {
      // Check wallet balance
      const balance = await this.wallet.balances();
      console.log("💵 Agent wallet balance:", {
        usdc: balance.usdc?.amount || "0",
        eth: balance.nativeToken?.amount || "0"
      });

      // Check if wallet is deployed on-chain
      const isDeployed = await checkWalletDeployment(this.wallet.address, "base-sepolia");
      console.log(`🏗️ Agent wallet deployment status: ${isDeployed ? "✅ DEPLOYED" : "⚠️ PRE-DEPLOYED (ERC-6492)"}`);

      // If wallet is not deployed, deploy it first
      if (!isDeployed) {
        console.log("⚠️ Wallet not deployed - deploying now for x402 compatibility...");
        try {
          const txHash = await deployWallet(this.wallet);
          console.log(`✅ Wallet deployed successfully! TX: ${txHash}`);
          console.log("⏳ Waiting 5 seconds for deployment to propagate...");
          await new Promise(resolve => setTimeout(resolve, 5000));
        } catch (deployError) {
          console.error("❌ Deployment failed:", deployError);
          throw new Error(`Cannot make payment: ${deployError}`);
        }
      }

      const response = await this.fetchWithPay(paidUrl, {});
      const responseText = await response.text();
      console.log("✅ Payment response:", {
        status: response.status,
        statusText: response.statusText,
        paymentResponseHeader: response.headers.get("X-PAYMENT-RESPONSE"),
        body: responseText.substring(0, 500)
      });

      // Return reconstructed response
      return new Response(responseText, {
        status: response.status,
        headers: response.headers
      });
    } catch (error) {
      console.error("❌ Payment error:", error);
      throw error;
    }
  }

  async onStart() {
    // Initialize Crossmint SDK
    const crossmint = createCrossmint({
      apiKey: this.env.CROSSMINT_API_KEY,
    });
    const crossmintWallets = CrossmintWallets.from(crossmint);

    // Get or create agent's Crossmint wallet using locator
    const walletLocator = "userId:crossmint-pay-agent-1:evm:smart";
    try {
      this.wallet = await crossmintWallets.getWallet(walletLocator, {
        chain: "base-sepolia",
        signer: { type: "api-key" }
      });
      console.log("🤖 Agent wallet found:", this.wallet.address);
    } catch (error) {
      // Wallet doesn't exist, create it
      this.wallet = await crossmintWallets.createWallet({
        chain: "base-sepolia",
        signer: { type: "api-key" },
        owner: "userId:crossmint-pay-agent-1"
      });
      console.log("🤖 Agent wallet created:", this.wallet.address);
    }

    console.log("💰 Agent will pay from Crossmint smart wallet");

    // Create x402-compatible signer and wrap fetch
    const x402Signer = createX402Signer(this.wallet);
    this.fetchWithPay = wrapFetchWithPayment(fetch, x402Signer);
  }
}

// Server wallet - receives payments
let serverWallet: Wallet<any>;
let paymentMiddlewareHandler: any;

// Initialize server's Crossmint wallet
async function initializeServerWallet(apiKey: string): Promise<string> {
  const crossmint = createCrossmint({ apiKey });
  const crossmintWallets = CrossmintWallets.from(crossmint);

  // Get or create server's Crossmint wallet using locator
  const walletLocator = "userId:crossmint-x402-server:evm:smart";
  try {
    serverWallet = await crossmintWallets.getWallet(walletLocator, {
      chain: "base-sepolia",
      signer: { type: "api-key" }
    });
    console.log("💼 Server wallet found:", serverWallet.address);
  } catch (error) {
    // Wallet doesn't exist, create it
    serverWallet = await crossmintWallets.createWallet({
      chain: "base-sepolia",
      signer: { type: "api-key" },
      owner: "userId:crossmint-x402-server"
    });
    console.log("💼 Server wallet created:", serverWallet.address);
  }

  console.log("💰 Will receive payments at Crossmint smart wallet");

  // Create payment middleware
  paymentMiddlewareHandler = paymentMiddleware(
    serverWallet.address as `0x${string}`,
    {
      "/protected-route": {
        price: "$0.10",
        network: "base-sepolia",
        config: {
          description: "Access to premium Crossmint API content"
        }
      }
    },
    { url: "https://x402.org/facilitator" }
  );

  return serverWallet.address;
}

// Create Hono app
const app = new Hono<{ Bindings: Env }>();

// Initialize server wallet and apply payment middleware
app.use("*", async (c, next) => {
  // Initialize server wallet on first request
  if (!serverWallet) {
    await initializeServerWallet(c.env.CROSSMINT_API_KEY);
  }

  // Always apply payment middleware if it exists
  if (paymentMiddlewareHandler) {
    return paymentMiddlewareHandler(c, next);
  }

  await next();
});

/**
 * Protected Route - Requires payment to access
 * GET /protected-route
 *
 * Returns premium content after payment is verified
 */
app.get("/protected-route", (c) => {
  return c.json({
    message: "🎉 This content is behind a paywall. Thanks for paying!",
    data: {
      premium: true,
      timestamp: new Date().toISOString(),
      service: "Crossmint Premium API"
    }
  });
});

/**
 * Agent Endpoint - Triggers the agent to fetch protected content
 * GET /agent
 *
 * The agent will automatically pay for the protected route and return the content
 */
app.get("/agent", async (c) => {
  const agent = await getAgentByName(
    c.env.PAY_AGENT,
    "crossmint-pay-agent-1"
  );
  return agent.fetch(c.req.raw);
});

/**
 * Wallet Status - Check both wallet balances
 * GET /wallets/status
 */
app.get("/wallets/status", async (c) => {
  if (!serverWallet) {
    return c.json({ error: "Server wallet not initialized" }, 500);
  }

  try {
    const serverBalance = await serverWallet.balances();
    const agent = await getAgentByName(c.env.PAY_AGENT, "crossmint-pay-agent-1");
    const agentBalance = await agent.wallet.balances();

    return c.json({
      server: {
        address: serverWallet.address,
        balance: {
          usdc: serverBalance.usdc?.amount || "0",
          eth: serverBalance.nativeToken?.amount || "0"
        }
      },
      agent: {
        address: agent.wallet.address,
        balance: {
          usdc: agentBalance.usdc?.amount || "0",
          eth: agentBalance.nativeToken?.amount || "0"
        }
      }
    });
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * Root Endpoint - Health check and info
 * GET /
 */
app.get("/", async (c) => {
  const walletInfo = serverWallet ? {
    server: { address: serverWallet.address, role: "Receives payments" },
    agent: { address: "Created on first request", role: "Makes payments" }
  } : "Wallets not yet initialized";

  return c.json({
    service: "Crossmint x402 Payment Demo",
    description: "Agent-to-agent payments using Crossmint smart wallets",
    wallets: walletInfo,
    endpoints: {
      "/": "This info page",
      "/protected-route": "Protected endpoint (requires $0.10 payment)",
      "/agent": "Trigger agent to fetch and pay for protected content",
      "/wallets/status": "Check both wallet balances"
    },
    documentation: "See README.md for setup instructions"
  });
});

export default app;
