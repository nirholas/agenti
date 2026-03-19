/**
 * ShelbyGateway - Integrates x402a payments with Shelby Protocol sessions
 *
 * This class bridges HTTP 402 micropayments (via x402a) with Shelby's
 * session-based storage access system.
 */

import type { X402Facilitator } from "x402a/server";
import type { SubmitPaymentOptions } from "x402a";
import type {
	ShelbySession,
	CreateSessionFromPaymentOptions,
	PaymentVerificationResult,
	PricingConfig,
} from "../types/index.js";
import { ShelbyNodeClient, type ShelbyClientConfig } from "@shelby-protocol/sdk/node";
import { ShelbyRPCClient } from "./ShelbyRPCClient.js";
import { InMemorySessionStorage, type ISessionStorage } from "./SessionStorage.js";
import pino from "pino";

/**
 * Configuration for ShelbyGateway
 */
export interface ShelbyGatewayConfig {
	/** x402a facilitator instance for handling Aptos payments */
	facilitator: X402Facilitator;
	/** Shelby client instance (optional - will create default if not provided) */
	shelbyClient?: ShelbyNodeClient;
	/** Pricing configuration for converting APT → chunksets */
	pricing: PricingConfig;
	/** Optional logger */
	logger?: pino.Logger;
	/** Shelby network (defaults to SHELBYNET) */
	network?: "SHELBYNET";
	/** Shelby API key for RPC access (required for production) */
	apiKey: string;
	/** Optional session storage (defaults to InMemorySessionStorage) */
	sessionStorage?: ISessionStorage;
	/** Shelby RPC base URL (optional, defaults to production URL) */
	shelbyRpcUrl?: string;
}

/**
 * ShelbyGateway bridges x402a payments with Shelby sessions
 *
 * @example
 * ```typescript
 * import { X402Facilitator } from 'x402a/server';
 * import { ShelbyNodeClient } from '@shelby-protocol/sdk/node';
 * import { ShelbyGateway } from 'x402s/server';
 *
 * const gateway = new ShelbyGateway({
 *   facilitator: new X402Facilitator({
 *     privateKey: process.env.FACILITATOR_PRIVATE_KEY,
 *     contractAddress: process.env.CONTRACT_ADDRESS,
 *   }),
 *   shelbyClient: new ShelbyNodeClient({
 *     network: Network.SHELBYNET,
 *     apiKey: process.env.SHELBY_API_KEY,
 *   }),
 *   pricing: {
 *     octasPerChunkset: "100000", // 0.001 APT per chunkset
 *     minPaymentOctas: "1000000", // 0.01 APT minimum
 *     maxChunksetsPerSession: 1000,
 *   }
 * });
 *
 * // Accept payment and create Shelby session
 * const result = await gateway.createSessionFromPayment({
 *   userAddress: "0x123...",
 *   signedTransaction: "0xabc...",
 *   amount: "10000000", // 0.1 APT
 * });
 * ```
 */
export class ShelbyGateway {
	private static readonly REQUEST_ID_PREFIX = "req_";

	private facilitator: X402Facilitator;
	private pricing: PricingConfig;
	private logger: pino.Logger;
	private sessionStorage: ISessionStorage;
	private shelbyRPC: ShelbyRPCClient;
	// @ts-expect-error - shelbyClient will be used for blob operations once SDK is updated
	private shelbyClient: ShelbyNodeClient;

	constructor(config: ShelbyGatewayConfig) {
		this.facilitator = config.facilitator;
		this.pricing = config.pricing;
		this.logger =
			config.logger ||
			pino({
				name: "x402s-gateway",
				level: process.env.LOG_LEVEL || "info",
			});

		// Initialize session storage (persistent or in-memory)
		this.sessionStorage = config.sessionStorage || new InMemorySessionStorage();

		// Initialize Shelby RPC client for session management
		this.shelbyRPC = new ShelbyRPCClient({
			apiKey: config.apiKey,
			baseUrl: config.shelbyRpcUrl,
			logger: this.logger,
		});

		// Initialize Shelby SDK client for blob operations
		if (config.shelbyClient) {
			this.shelbyClient = config.shelbyClient;
		} else {
			const shelbyConfig: ShelbyClientConfig = {
				network: config.network || "SHELBYNET",
				apiKey: config.apiKey,
			};

			this.shelbyClient = new ShelbyNodeClient(shelbyConfig);
		}

		const storageType = config.sessionStorage
			? config.sessionStorage.constructor.name
			: "InMemorySessionStorage";

		this.logger.info(
			{
				network: config.network || "SHELBYNET",
				hasApiKey: !!config.apiKey,
				sessionStorage: storageType,
				shelbySDK: "initialized",
			},
			"ShelbyGateway initialized",
		);
	}

	/**
	 * Verify x402a payment and create/fund Shelby session
	 *
	 * Flow:
	 * 1. Submit signed transaction via x402a facilitator
	 * 2. Verify payment succeeded on-chain
	 * 3. Calculate chunksets based on payment amount
	 * 4. Create Shelby session with those chunksets
	 * 5. Return session info to client
	 */
	async createSessionFromPayment(
		paymentOptions: SubmitPaymentOptions,
	): Promise<PaymentVerificationResult> {
		const requestId = this.generateRequestId();
		const log = this.logger.child({ requestId, userAddress: paymentOptions.from });

		try {
			log.info("Processing payment for Shelby session creation");

			// Step 1: Submit payment via x402a
			const paymentResult = await this.facilitator.submitPayment(paymentOptions);

			if (!paymentResult.success || !paymentResult.txHash) {
				log.error({ error: paymentResult.error }, "Payment submission failed");
				return {
					valid: false,
					error: paymentResult.error || "Payment submission failed",
				};
			}

			log.info({ txHash: paymentResult.txHash }, "Payment submitted successfully");

			// Step 2: Calculate chunksets from payment amount
			const chunksets = this.calculateChunksets(paymentOptions.amount);

			if (chunksets === 0) {
				return {
					valid: false,
					error: "Payment amount too low to purchase any chunksets",
					txHash: paymentResult.txHash,
				};
			}

			// Step 3: Create Shelby session
			const session = await this.createShelbySession({
				userAddress: paymentOptions.from,
				amountInOctas: this.normalizeAmount(paymentOptions.amount),
				txHash: paymentResult.txHash,
				octasPerChunkset: this.pricing.octasPerChunkset,
			});

			log.info(
				{
					sessionId: session.sessionId,
					chunksets: session.chunksetsRemaining,
				},
				"Shelby session created",
			);

			// Store session in persistent storage
			await this.sessionStorage.set(session.sessionId, session);

			return {
				valid: true,
				session: {
					sessionId: session.sessionId,
					chunksetsRemaining: session.chunksetsRemaining,
				},
				txHash: paymentResult.txHash,
			};
		} catch (error) {
			log.error({ error }, "Error creating session from payment");
			return {
				valid: false,
				error: this.getErrorMessage(error),
			};
		}
	}

	/**
	 * Get session information
	 */
	async getSession(sessionId: string): Promise<ShelbySession | null> {
		// Try local storage first
		const session = await this.sessionStorage.get(sessionId);
		if (session) {
			return session;
		}

		// Try Shelby RPC (when API is available)
		const rpcSession = await this.shelbyRPC.getSession(sessionId);
		if (rpcSession) {
			// Convert RPC session to local format and cache
			const localSession: ShelbySession = {
				sessionId: rpcSession.sessionId,
				userAddress: rpcSession.userIdentity,
				chunksetsRemaining: rpcSession.chunksetsRemaining,
				createdAt: rpcSession.createdAt,
				expiresAt: rpcSession.expiresAt,
			};
			await this.sessionStorage.set(sessionId, localSession);
			return localSession;
		}

		return null;
	}

	/**
	 * Use a session (decrement chunksets)
	 */
	async useSession(
		sessionId: string,
		chunksetsToConsume: number,
	): Promise<{ success: boolean; chunksetsRemaining?: number; error?: string }> {
		const session = await this.getSession(sessionId);

		if (!session) {
			return { success: false, error: "Session not found" };
		}

		if (session.chunksetsRemaining < chunksetsToConsume) {
			return { success: false, error: "Insufficient chunksets in session" };
		}

		// Try using Shelby RPC first (when API is available)
		const rpcResult = await this.shelbyRPC.useSession({
			sessionId,
			chunksetsToConsume,
		});

		// Update local storage
		const newChunksets = session.chunksetsRemaining - chunksetsToConsume;
		await this.sessionStorage.updateChunksets(sessionId, newChunksets);

		return {
			success: rpcResult.success,
			chunksetsRemaining: rpcResult.chunksetsRemaining || newChunksets,
			error: rpcResult.error,
		};
	}

	/**
	 * Calculate how many chunksets can be purchased with payment amount
	 */
	private calculateChunksets(amount: string | string[]): number {
		const amountInOctas = BigInt(this.normalizeAmount(amount));
		const octasPerChunkset = BigInt(this.pricing.octasPerChunkset);

		const chunksets = Number(amountInOctas / octasPerChunkset);

		return Math.min(chunksets, this.pricing.maxChunksetsPerSession);
	}

	/**
	 * Create Shelby session via RPC client
	 *
	 * Uses ShelbyRPCClient for session creation
	 * (Virtual session until Shelby RPC exposes the endpoint)
	 */
	private async createShelbySession(
		options: CreateSessionFromPaymentOptions,
	): Promise<ShelbySession> {
		const amountInOctas = BigInt(options.amountInOctas);
		const octasPerChunkset = BigInt(this.pricing.octasPerChunkset);
		const chunksets = Number(amountInOctas / octasPerChunkset);

		// Create session via Shelby RPC
		const rpcSession = await this.shelbyRPC.createSession({
			userIdentity: options.userAddress,
			chunksets,
			fundingTxHash: options.txHash,
			expirationSeconds: 86400, // 24 hours
		});

		// Convert RPC session to local format
		const session: ShelbySession = {
			sessionId: rpcSession.sessionId,
			userAddress: rpcSession.userIdentity,
			chunksetsRemaining: rpcSession.chunksetsRemaining,
			createdAt: rpcSession.createdAt,
			expiresAt: rpcSession.expiresAt,
			fundingTxHash: options.txHash,
		};

		this.logger.info(
			{
				sessionId: session.sessionId,
				userAddress: options.userAddress,
				chunksets,
				txHash: options.txHash,
			},
			"Shelby session created via RPC",
		);

		return session;
	}

	/**
	 * Generate unique ID with given prefix
	 */
	private generateId(prefix: string): string {
		return `${prefix}${Date.now()}_${Math.random().toString(36).substring(7)}`;
	}

	/**
	 * Generate request ID for logging
	 */
	private generateRequestId(): string {
		return this.generateId(ShelbyGateway.REQUEST_ID_PREFIX);
	}

	/**
	 * Normalize amount to string (handles both single and array formats)
	 */
	private normalizeAmount(amount: string | string[]): string {
		return typeof amount === "string" ? amount : amount[0] || "0";
	}

	/**
	 * Extract error message from unknown error type
	 */
	private getErrorMessage(error: unknown): string {
		return error instanceof Error ? error.message : "Unknown error";
	}
}
