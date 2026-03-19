/**
 * AgentDEX Integration for Solana Agent Kit
 *
 * Provides swap routing, limit orders, portfolio tracking, and price feeds
 * through the AgentDEX API (https://agentdex.com).
 *
 * Usage:
 *   import { AgentDEXClient } from 'solana-agent-kit/src/integrations/agentdex';
 *
 *   const client = new AgentDEXClient({ apiKey: 'adx_xxx' });
 *   const quote = await client.getQuote(inputMint, outputMint, amount);
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface AgentDEXConfig {
  /** API key (Bearer token), e.g. "adx_xxx" */
  apiKey: string;
  /** Base URL override (default: https://api.agentdex.com) */
  baseUrl?: string;
  /** Agent ID sent with swap requests (optional, auto-set after register) */
  agentId?: string;
}

export interface Quote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: number;
  slippageBps: number;
  route: unknown;
}

export interface SwapResult {
  signature: string;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
}

export interface TokenBalance {
  mint: string;
  symbol: string;
  balance: string;
  usdValue: number;
}

export interface Portfolio {
  wallet: string;
  totalUsdValue: number;
  tokens: TokenBalance[];
}

export interface TokenPrice {
  mint: string;
  symbol?: string;
  priceUsd: number;
  updatedAt: string;
}

export interface LimitOrder {
  id: string;
  inputMint: string;
  outputMint: string;
  amount: string;
  targetPrice: number;
  status: string;
  createdAt: string;
}

export interface AgentInfo {
  id: string;
  name?: string;
  createdAt: string;
}

// ── Client ───────────────────────────────────────────────────────────────────

export class AgentDEXClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private agentId: string | undefined;

  constructor(config: AgentDEXConfig) {
    if (!config.apiKey) {
      throw new Error('AgentDEX: apiKey is required (e.g. "adx_xxx")');
    }
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? 'https://api.agentdex.com').replace(
      /\/$/,
      '',
    );
    this.agentId = config.agentId;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const opts: RequestInit = {
      method,
      headers: this.headers(),
    };
    if (body !== undefined) {
      opts.body = JSON.stringify(body);
    }

    const res = await fetch(url, opts);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `AgentDEX API ${method} ${path} failed (${res.status}): ${text}`,
      );
    }

    return res.json() as Promise<T>;
  }

  // ── Quotes & Swaps ──────────────────────────────────────────────────────

  /**
   * Get a swap quote from AgentDEX.
   *
   * @param inputMint  - Source token mint address
   * @param outputMint - Destination token mint address
   * @param amount     - Amount in smallest unit (lamports / base units)
   * @param slippageBps - Slippage tolerance in basis points (default 50 = 0.5%)
   */
  async getQuote(
    inputMint: string,
    outputMint: string,
    amount: string | number,
    slippageBps: number = 50,
  ): Promise<Quote> {
    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount: String(amount),
      slippageBps: String(slippageBps),
    });
    return this.request<Quote>('GET', `/api/v1/quote?${params}`);
  }

  /**
   * Execute a swap through AgentDEX.
   *
   * @param inputMint  - Source token mint address
   * @param outputMint - Destination token mint address
   * @param amount     - Amount in smallest unit
   * @param slippageBps - Slippage tolerance in basis points (default 50)
   */
  async swap(
    inputMint: string,
    outputMint: string,
    amount: string | number,
    slippageBps: number = 50,
  ): Promise<SwapResult> {
    return this.request<SwapResult>('POST', '/api/v1/swap', {
      inputMint,
      outputMint,
      amount: String(amount),
      slippageBps,
      agentId: this.agentId,
    });
  }

  // ── Portfolio ────────────────────────────────────────────────────────────

  /**
   * Get token balances and USD values for a wallet.
   *
   * @param wallet - Solana wallet public key
   */
  async getPortfolio(wallet: string): Promise<Portfolio> {
    return this.request<Portfolio>('GET', `/api/v1/portfolio/${wallet}`);
  }

  // ── Prices ───────────────────────────────────────────────────────────────

  /**
   * Get token prices. If mints are provided, returns prices for those tokens.
   * Otherwise returns all tracked prices.
   *
   * @param mints - Optional array of mint addresses (if single mint, returns that price)
   */
  async getPrices(mints?: string[]): Promise<TokenPrice[]> {
    if (mints && mints.length === 1) {
      const price = await this.request<TokenPrice>(
        'GET',
        `/api/v1/prices/${mints[0]}`,
      );
      return [price];
    }
    return this.request<TokenPrice[]>('GET', '/api/v1/prices');
  }

  // ── Limit Orders ────────────────────────────────────────────────────────

  /**
   * Place a limit order.
   *
   * @param inputMint   - Token to sell
   * @param outputMint  - Token to buy
   * @param amount      - Amount of input token (base units)
   * @param targetPrice - Target execution price
   */
  async createLimitOrder(
    inputMint: string,
    outputMint: string,
    amount: string | number,
    targetPrice: number,
  ): Promise<LimitOrder> {
    return this.request<LimitOrder>('POST', '/api/v1/limit-order', {
      inputMint,
      outputMint,
      amount: String(amount),
      targetPrice,
    });
  }

  /**
   * List all active limit orders for the authenticated agent.
   */
  async getLimitOrders(): Promise<LimitOrder[]> {
    return this.request<LimitOrder[]>('GET', '/api/v1/limit-order');
  }

  /**
   * Cancel a limit order by ID.
   *
   * @param id - Limit order ID
   */
  async cancelLimitOrder(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(
      'DELETE',
      `/api/v1/limit-order/${id}`,
    );
  }

  // ── Agent Management ─────────────────────────────────────────────────────

  /**
   * Register this agent with AgentDEX. Sets `agentId` on the client instance.
   */
  async register(): Promise<AgentInfo> {
    const info = await this.request<AgentInfo>(
      'POST',
      '/api/v1/agents/register',
    );
    this.agentId = info.id;
    return info;
  }

  /**
   * Get info about the currently authenticated agent.
   */
  async getAgentInfo(): Promise<AgentInfo> {
    return this.request<AgentInfo>('GET', '/api/v1/agents/me');
  }
}

export default AgentDEXClient;
