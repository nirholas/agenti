/**
 * PayableAgent - AI Agent with payment capabilities
 * 
 * This module provides the base classes for creating AI agents that can
 * autonomously make and receive cryptocurrency payments via x402.
 * 
 * @example
 * ```typescript
 * import { PayableAgent } from "@nirholas/x402-ecosystem/agent";
 * 
 * const agent = new PayableAgent({
 *   privateKey: process.env.X402_PRIVATE_KEY,
 *   chain: "eip155:42161", // Arbitrum
 *   maxDailySpend: "50.00",
 * });
 * 
 * // Make a paid API request
 * const result = await agent.payForService("https://api.premium.com/data");
 * 
 * // Check balance
 * const balance = await agent.getBalance();
 * console.log(`Balance: $${balance.usds} USDs`);
 * ```
 */

import { createPublicClient, createWalletClient, http, parseUnits, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum, base } from "viem/chains";
import type { 
  Address, 
  Hash, 
  Caip2ChainId, 
  PaymentResult, 
  BalanceInfo,
  PaymentHistoryEntry,
} from "./types.js";
import { 
  DEFAULT_LIMITS, 
  USDC_ADDRESSES, 
  USDS_ADDRESS,
  DEFAULT_FACILITATOR_URL,
} from "./constants.js";

/**
 * Configuration for PayableAgent
 */
export interface PayableAgentConfig {
  /** Private key for signing transactions */
  privateKey?: `0x${string}`;
  /** Default chain for payments (CAIP-2 format) */
  chain?: Caip2ChainId;
  /** Maximum amount to spend per day in USD */
  maxDailySpend?: string;
  /** Maximum amount per single payment */
  maxPaymentPerRequest?: string;
  /** List of approved service domains */
  approvedServices?: string[];
  /** Enable auto-conversion to USDs for yield */
  enableYield?: boolean;
  /** Custom facilitator URL */
  facilitatorUrl?: string;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Configuration for AgentWallet
 */
export interface AgentWalletConfig {
  /** Private key for the wallet */
  privateKey: `0x${string}`;
  /** Chain to connect to */
  chain: Caip2ChainId;
  /** Custom RPC URL */
  rpcUrl?: string;
}

/**
 * Payment capabilities of an agent
 */
export interface PaymentCapabilities {
  canPay: boolean;
  canReceive: boolean;
  supportedChains: Caip2ChainId[];
  supportedTokens: string[];
  maxPaymentPerRequest: string;
  dailyLimitRemaining: string;
}

/**
 * AgentWallet - Low-level wallet operations for AI agents
 */
export class AgentWallet {
  private readonly account;
  private readonly publicClient;
  private readonly walletClient;
  private readonly chain: Caip2ChainId;
  
  constructor(config: AgentWalletConfig) {
    this.chain = config.chain;
    this.account = privateKeyToAccount(config.privateKey);
    
    const viemChain = this.getViemChain(config.chain);
    const transport = http(config.rpcUrl);
    
    this.publicClient = createPublicClient({
      chain: viemChain,
      transport,
    });
    
    this.walletClient = createWalletClient({
      account: this.account,
      chain: viemChain,
      transport,
    });
  }
  
  private getViemChain(caip2: Caip2ChainId) {
    const chainId = parseInt(caip2.split(":")[1]);
    switch (chainId) {
      case 42161: return arbitrum;
      case 8453: return base;
      default: return arbitrum;
    }
  }
  
  /** Get wallet address */
  get address(): Address {
    return this.account.address;
  }
  
  /** Get current balance */
  async getBalance(): Promise<BalanceInfo> {
    const nativeBalance = await this.publicClient.getBalance({
      address: this.account.address,
    });
    
    // Get USDC balance
    const usdcAddress = USDC_ADDRESSES[this.chain];
    let usdcBalance = "0";
    if (usdcAddress) {
      try {
        const balance = await this.publicClient.readContract({
          address: usdcAddress,
          abi: [{ 
            name: "balanceOf", 
            type: "function", 
            inputs: [{ name: "account", type: "address" }],
            outputs: [{ name: "", type: "uint256" }],
            stateMutability: "view",
          }],
          functionName: "balanceOf",
          args: [this.account.address],
        }) as bigint;
        usdcBalance = formatUnits(balance, 6);
      } catch {
        // Token might not exist on this chain
      }
    }
    
    // Get USDs balance (Arbitrum only)
    let usdsBalance = "0";
    if (this.chain === "eip155:42161") {
      try {
        const balance = await this.publicClient.readContract({
          address: USDS_ADDRESS,
          abi: [{ 
            name: "balanceOf", 
            type: "function", 
            inputs: [{ name: "account", type: "address" }],
            outputs: [{ name: "", type: "uint256" }],
            stateMutability: "view",
          }],
          functionName: "balanceOf",
          args: [this.account.address],
        }) as bigint;
        usdsBalance = formatUnits(balance, 18);
      } catch {
        // USDs not available
      }
    }
    
    return {
      usdc: usdcBalance,
      usds: usdsBalance,
      native: formatUnits(nativeBalance, 18),
      chain: this.chain,
      address: this.account.address,
    };
  }
  
  /** Sign a message */
  async signMessage(message: string): Promise<Hash> {
    return this.walletClient.signMessage({
      message,
    });
  }
}

/**
 * PayableAgent - High-level AI agent with x402 payment capabilities
 * 
 * Provides a convenient interface for AI agents to make payments,
 * manage spending limits, and interact with paid services.
 */
export class PayableAgent {
  private wallet?: AgentWallet;
  private readonly config: Required<PayableAgentConfig>;
  private dailySpend = 0;
  private lastDayReset = Date.now();
  private paymentHistory: PaymentHistoryEntry[] = [];
  
  constructor(config: PayableAgentConfig = {}) {
    this.config = {
      privateKey: config.privateKey,
      chain: config.chain ?? "eip155:42161",
      maxDailySpend: config.maxDailySpend ?? DEFAULT_LIMITS.maxDailySpend,
      maxPaymentPerRequest: config.maxPaymentPerRequest ?? DEFAULT_LIMITS.maxPaymentPerRequest,
      approvedServices: config.approvedServices ?? [],
      enableYield: config.enableYield ?? true,
      facilitatorUrl: config.facilitatorUrl ?? DEFAULT_FACILITATOR_URL,
      debug: config.debug ?? false,
    };
    
    if (config.privateKey) {
      this.wallet = new AgentWallet({
        privateKey: config.privateKey,
        chain: this.config.chain,
      });
    }
  }
  
  /** Check if agent has payment capabilities */
  get isConfigured(): boolean {
    return !!this.wallet;
  }
  
  /** Get wallet address */
  get address(): Address | undefined {
    return this.wallet?.address;
  }
  
  /** Get payment capabilities */
  getCapabilities(): PaymentCapabilities {
    const dailyLimitRemaining = Math.max(
      0,
      parseFloat(this.config.maxDailySpend) - this.dailySpend
    ).toFixed(2);
    
    return {
      canPay: this.isConfigured,
      canReceive: this.isConfigured,
      supportedChains: ["eip155:42161", "eip155:8453"],
      supportedTokens: ["USDs", "USDC"],
      maxPaymentPerRequest: this.config.maxPaymentPerRequest,
      dailyLimitRemaining,
    };
  }
  
  /** Get wallet balance */
  async getBalance(): Promise<BalanceInfo> {
    if (!this.wallet) {
      throw new Error("Agent wallet not configured. Set X402_PRIVATE_KEY.");
    }
    return this.wallet.getBalance();
  }
  
  /** Reset daily spend counter if needed */
  private checkDayReset(): void {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    if (now - this.lastDayReset >= dayMs) {
      this.dailySpend = 0;
      this.lastDayReset = now;
    }
  }
  
  /** Check if payment is within limits */
  canAfford(amount: string): { allowed: boolean; reason?: string } {
    if (!this.wallet) {
      return { allowed: false, reason: "Wallet not configured" };
    }
    
    this.checkDayReset();
    
    const amountFloat = parseFloat(amount);
    const maxPerRequest = parseFloat(this.config.maxPaymentPerRequest);
    const maxDaily = parseFloat(this.config.maxDailySpend);
    
    if (amountFloat > maxPerRequest) {
      return { 
        allowed: false, 
        reason: `Amount $${amount} exceeds per-request limit of $${this.config.maxPaymentPerRequest}` 
      };
    }
    
    if (this.dailySpend + amountFloat > maxDaily) {
      return { 
        allowed: false, 
        reason: `Payment would exceed daily limit. Remaining: $${(maxDaily - this.dailySpend).toFixed(2)}` 
      };
    }
    
    return { allowed: true };
  }
  
  /** Check if service is approved */
  isServiceApproved(serviceUrl: string): boolean {
    if (this.config.approvedServices.length === 0) {
      return true; // No allowlist = all approved
    }
    const url = new URL(serviceUrl);
    return this.config.approvedServices.some(
      approved => url.hostname.includes(approved)
    );
  }
  
  /**
   * Pay for a service via x402
   * This makes a request to the URL and automatically handles 402 payments
   */
  async payForService(
    url: string,
    options: {
      method?: "GET" | "POST" | "PUT" | "DELETE";
      body?: unknown;
      headers?: Record<string, string>;
      maxPayment?: string;
    } = {}
  ): Promise<{ success: boolean; data?: unknown; payment?: PaymentResult; error?: string }> {
    if (!this.wallet) {
      return { success: false, error: "Wallet not configured" };
    }
    
    if (!this.isServiceApproved(url)) {
      return { success: false, error: `Service not in approved list: ${url}` };
    }
    
    const maxPayment = options.maxPayment ?? this.config.maxPaymentPerRequest;
    const affordCheck = this.canAfford(maxPayment);
    if (!affordCheck.allowed) {
      return { success: false, error: affordCheck.reason };
    }
    
    try {
      // Make the request - x402 handling would be integrated here
      // For now, return a placeholder
      const response = await fetch(url, {
        method: options.method ?? "GET",
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
      
      // Check for 402 Payment Required
      if (response.status === 402) {
        // Parse payment requirements from response
        const paymentInfo = response.headers.get("X-Payment");
        if (paymentInfo) {
          // TODO: Integrate with @x402/fetch for actual payment
          return { 
            success: false, 
            error: "402 Payment Required - x402 payment flow not yet integrated",
            payment: undefined,
          };
        }
      }
      
      const data = await response.json().catch(() => response.text());
      return { success: true, data };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
  
  /** Record a payment for tracking */
  recordPayment(payment: PaymentResult): void {
    this.checkDayReset();
    
    const amount = parseFloat(payment.amount);
    this.dailySpend += amount;
    
    this.paymentHistory.push({
      id: payment.txHash ?? `pending-${Date.now()}`,
      type: "sent",
      amount: payment.amount,
      token: payment.token,
      counterparty: payment.recipient,
      txHash: payment.txHash ?? ("0x" as Hash),
      timestamp: payment.timestamp,
      status: payment.success ? "confirmed" : "failed",
    });
  }
  
  /** Get payment history */
  getPaymentHistory(): PaymentHistoryEntry[] {
    return [...this.paymentHistory];
  }
  
  /** Get daily spending stats */
  getDailyStats(): { spent: number; limit: number; remaining: number } {
    this.checkDayReset();
    const limit = parseFloat(this.config.maxDailySpend);
    return {
      spent: this.dailySpend,
      limit,
      remaining: Math.max(0, limit - this.dailySpend),
    };
  }
}

/**
 * Create a new agent wallet
 */
export function createAgentWallet(config: AgentWalletConfig): AgentWallet {
  return new AgentWallet(config);
}

/**
 * Create a PayableAgent from environment variables
 */
export function createPayableAgentFromEnv(): PayableAgent {
  return new PayableAgent({
    privateKey: process.env.X402_PRIVATE_KEY as `0x${string}` | undefined,
    chain: (process.env.X402_CHAIN as Caip2ChainId) ?? "eip155:42161",
    maxDailySpend: process.env.X402_MAX_DAILY_SPEND,
    maxPaymentPerRequest: process.env.X402_MAX_PAYMENT,
    approvedServices: process.env.X402_APPROVED_SERVICES?.split(","),
    enableYield: process.env.X402_ENABLE_YIELD !== "false",
    debug: process.env.X402_DEBUG === "true",
  });
}
