import { randomUUID } from "node:crypto";
import { generateToken, hashToken } from "../tokens.js";
import type { ApiToken, CreateTokenInput, TokenStorage } from "./interface.js";

/**
 * In-memory token storage implementation
 * Suitable for development and testing
 * WARNING: All data is lost on process restart
 */
export class InMemoryTokenStorage implements TokenStorage {
  private tokens = new Map<string, ApiToken>();

  async getToken(tokenOrHash: string): Promise<ApiToken | null> {
    // Try direct lookup by token string
    let token = Array.from(this.tokens.values()).find(
      (t) => t.token === tokenOrHash,
    );

    // Try lookup by hash
    if (!token) {
      token = Array.from(this.tokens.values()).find(
        (t) => t.tokenHash === tokenOrHash,
      );
    }

    // Return null if not found or inactive
    if (!token || !token.isActive) {
      return null;
    }

    return token;
  }

  async createToken(
    input: CreateTokenInput,
    environment: "test" | "live",
  ): Promise<ApiToken> {
    const id = randomUUID();
    const tokenString = generateToken(environment);
    const tokenHash = hashToken(tokenString);
    const now = new Date();

    const token: ApiToken = {
      id,
      token: tokenString,
      tokenHash,
      name: input.name || null,
      userId: input.userId || null,
      tier: input.tier || "free",
      requestsPerMinute: input.requestsPerMinute ?? 100,
      requestsPerDay: input.requestsPerDay ?? 10000,
      monthlyRequestLimit: input.monthlyRequestLimit ?? null,
      monthlySettlementLimit: input.monthlySettlementLimit ?? null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      expiresAt: input.expiresAt || null,
      lastUsedAt: null,
      metadata: input.metadata || {},
    };

    this.tokens.set(id, token);
    return token;
  }

  async updateToken(id: string, data: Partial<ApiToken>): Promise<ApiToken> {
    const token = this.tokens.get(id);
    if (!token) {
      throw new Error(`Token not found: ${id}`);
    }

    const updated: ApiToken = {
      ...token,
      ...data,
      // Prevent modification of critical fields
      id: token.id,
      token: token.token,
      tokenHash: token.tokenHash,
      createdAt: token.createdAt,
      updatedAt: new Date(),
    };

    this.tokens.set(id, updated);
    return updated;
  }

  async revokeToken(id: string): Promise<void> {
    await this.updateToken(id, { isActive: false });
  }

  async touchToken(id: string): Promise<void> {
    await this.updateToken(id, { lastUsedAt: new Date() });
  }
}
