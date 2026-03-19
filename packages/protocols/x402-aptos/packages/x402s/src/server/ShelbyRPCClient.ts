/**
 * Shelby RPC Client for Session Management
 *
 * Direct HTTP client for Shelby Protocol session APIs
 * (Until @shelby-protocol/sdk exposes session management)
 */

import pino from "pino";

export interface ShelbyRPCConfig {
	/** Shelby API base URL (default: https://api.shelbynet.shelby.xyz/shelby) */
	baseUrl?: string;
	/** Shelby API key from geomi.dev */
	apiKey: string;
	/** Optional logger */
	logger?: pino.Logger;
	/** Request timeout in ms (default: 10000) */
	timeout?: number;
}

export interface CreateSessionRequest {
	/** User's Aptos address */
	userIdentity: string;
	/** Number of chunksets for this session */
	chunksets: number;
	/** Funding transaction hash (for tracking) */
	fundingTxHash: string;
	/** Session expiration in seconds (default: 86400 = 24 hours) */
	expirationSeconds?: number;
}

export interface ShelbyRPCSession {
	sessionId: string;
	userIdentity: string;
	chunksetsRemaining: number;
	createdAt: number;
	expiresAt: number;
}

export interface UseSessionRequest {
	sessionId: string;
	chunksetsToConsume: number;
}

/**
 * Shelby RPC Client for direct API access
 *
 * Provides session management functionality not yet available in the TypeScript SDK
 */
export class ShelbyRPCClient {
	private baseUrl: string;
	// @ts-expect-error - apiKey will be used when Shelby RPC session APIs are available
	private apiKey: string;
	private logger: pino.Logger;
	// @ts-expect-error - timeout will be used for fetch calls when Shelby RPC APIs are available
	private timeout: number;

	constructor(config: ShelbyRPCConfig) {
		this.baseUrl = config.baseUrl || "https://api.shelbynet.shelby.xyz/shelby";
		this.apiKey = config.apiKey;
		this.timeout = config.timeout || 10000;
		this.logger =
			config.logger ||
			pino({
				name: "shelby-rpc-client",
				level: process.env.LOG_LEVEL || "info",
			});

		this.logger.info({ baseUrl: this.baseUrl }, "Shelby RPC Client initialized");
	}

	/**
	 * Create a new Shelby session
	 *
	 * NOTE: This is a workaround until Shelby SDK exposes session APIs.
	 * Currently creates a virtual session tracked by x402s.
	 */
	async createSession(request: CreateSessionRequest): Promise<ShelbyRPCSession> {
		const { userIdentity, chunksets, fundingTxHash, expirationSeconds = 86400 } = request;

		this.logger.info(
			{
				userIdentity,
				chunksets,
				fundingTxHash,
			},
			"Creating Shelby session",
		);

		try {
			// TODO: Call actual Shelby RPC endpoint when available
			// const response = await fetch(`${this.baseUrl}/v1/sessions`, {
			// 	method: "POST",
			// 	headers: {
			// 		"Content-Type": "application/json",
			// 		"Authorization": `Bearer ${this.apiKey}`,
			// 	},
			// 	body: JSON.stringify({
			// 		userIdentity,
			// 		chunksets,
			// 		metadata: { fundingTxHash },
			// 	}),
			// 	signal: AbortSignal.timeout(this.timeout),
			// });

			// if (!response.ok) {
			// 	const error = await response.text();
			// 	throw new Error(`Shelby RPC error: ${error}`);
			// }

			// const data = await response.json();
			// return data as ShelbyRPCSession;

			// WORKAROUND: Create virtual session until API is available
			const now = Date.now();
			const session: ShelbyRPCSession = {
				sessionId: this.generateSessionId(),
				userIdentity,
				chunksetsRemaining: chunksets,
				createdAt: now,
				expiresAt: now + expirationSeconds * 1000,
			};

			this.logger.info(
				{
					sessionId: session.sessionId,
					chunksets: session.chunksetsRemaining,
				},
				"Virtual session created (waiting for Shelby RPC API)",
			);

			return session;
		} catch (error) {
			this.logger.error({ error }, "Failed to create Shelby session");
			throw error;
		}
	}

	/**
	 * Get session information by ID
	 *
	 * NOTE: This will query Shelby RPC when the API is available
	 */
	async getSession(sessionId: string): Promise<ShelbyRPCSession | null> {
		this.logger.debug({ sessionId }, "Getting Shelby session");

		try {
			// TODO: Call actual Shelby RPC endpoint when available
			// const response = await fetch(`${this.baseUrl}/v1/sessions/${sessionId}`, {
			// 	headers: {
			// 		"Authorization": `Bearer ${this.apiKey}`,
			// 	},
			// 	signal: AbortSignal.timeout(this.timeout),
			// });

			// if (response.status === 404) {
			// 	return null;
			// }

			// if (!response.ok) {
			// 	const error = await response.text();
			// 	throw new Error(`Shelby RPC error: ${error}`);
			// }

			// return await response.json() as ShelbyRPCSession;

			// WORKAROUND: Return null until API is available (relies on local storage)
			this.logger.debug("Session query not implemented (waiting for Shelby RPC API)");
			return null;
		} catch (error) {
			this.logger.error({ error, sessionId }, "Failed to get Shelby session");
			return null;
		}
	}

	/**
	 * Use a session (consume chunksets)
	 *
	 * NOTE: This will call Shelby RPC when the API is available
	 */
	async useSession(request: UseSessionRequest): Promise<{
		success: boolean;
		chunksetsRemaining?: number;
		error?: string;
	}> {
		const { sessionId, chunksetsToConsume } = request;

		this.logger.info({ sessionId, chunksetsToConsume }, "Using Shelby session");

		try {
			// TODO: Call actual Shelby RPC endpoint when available
			// const response = await fetch(`${this.baseUrl}/v1/sessions/${sessionId}/use`, {
			// 	method: "POST",
			// 	headers: {
			// 		"Content-Type": "application/json",
			// 		"Authorization": `Bearer ${this.apiKey}`,
			// 	},
			// 	body: JSON.stringify({
			// 		chunksetsToConsume,
			// 	}),
			// 	signal: AbortSignal.timeout(this.timeout),
			// });

			// if (!response.ok) {
			// 	const error = await response.text();
			// 	throw new Error(`Shelby RPC error: ${error}`);
			// }

			// const data = await response.json();
			// return {
			// 	success: true,
			// 	chunksetsRemaining: data.chunksetsRemaining,
			// };

			// WORKAROUND: Return success until API is available (local tracking)
			this.logger.warn("Session usage not implemented (waiting for Shelby RPC API)");
			return {
				success: true,
			};
		} catch (error) {
			this.logger.error({ error, sessionId }, "Failed to use Shelby session");
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	/**
	 * Create a micropayment channel (for future integration)
	 *
	 * NOTE: x402s currently uses direct x402a payments instead of micropayment channels
	 */
	async createMicropaymentChannel(userAddress: string): Promise<string> {
		this.logger.info({ userAddress }, "Creating micropayment channel");

		// TODO: Implement when needed
		// This would integrate with Shelby's micropayment system
		// For now, x402s uses direct APT payments via x402a

		throw new Error("Micropayment channels not implemented - using x402a direct payments");
	}

	/**
	 * Generate unique session ID
	 */
	private generateSessionId(): string {
		return `shelby_${Date.now()}_${Math.random().toString(36).substring(7)}`;
	}
}
