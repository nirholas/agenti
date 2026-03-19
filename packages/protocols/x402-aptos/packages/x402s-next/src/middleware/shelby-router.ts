/**
 * Next.js middleware for Shelby Protocol integration with x402a payments
 *
 * This middleware:
 * 1. Checks for existing Shelby session
 * 2. Falls back to x402a payment if no session
 * 3. Creates/funds Shelby session from payment
 * 4. Attaches session to request for downstream use
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { ShelbyGateway } from "x402s/server";
import pino from "pino";

/**
 * Configuration for a Shelby-protected route
 */
export interface ShelbyRouteConfig {
	/** Price in octas (10^-8 APT) */
	price: string;
	/** Description of what this payment unlocks */
	description: string;
	/** Number of chunksets this payment purchases */
	chunksets?: number;
	/** Chunksets consumed per request (default: 1) */
	chunksetsPerRequest?: number;
}

/**
 * Middleware configuration for Shelby integration
 */
export interface ShelbyMiddlewareConfig {
	/** ShelbyGateway instance for handling payments + sessions */
	gateway: ShelbyGateway;
	/** Recipient address for payments */
	payTo: string;
	/** Routes that require Shelby sessions */
	routes: Record<string, ShelbyRouteConfig>;
	/** Optional logger */
	logger?: pino.Logger;
	/** Debug mode */
	debug?: boolean;
	/** Lifecycle hooks */
	onPaymentRequired?: (req: NextRequest, requirements: any) => Promise<void>;
	onSessionCreated?: (req: NextRequest, sessionId: string) => Promise<void>;
	onSessionUsed?: (req: NextRequest, sessionId: string, chunksetsRemaining: number) => Promise<void>;
	onError?: (req: NextRequest, error: Error) => Promise<void>;
}

/**
 * Create Shelby session middleware for Next.js
 *
 * @example
 * ```typescript
 * // middleware.ts
 * import { createShelbyMiddleware } from 'x402s-next/middleware';
 * import { ShelbyGateway } from 'x402s/server';
 * import { X402Facilitator } from 'x402a/server';
 * import { ShelbyNodeClient, Network } from '@shelby-protocol/sdk/node';
 *
 * const gateway = new ShelbyGateway({
 *   facilitator: new X402Facilitator({
 *     privateKey: process.env.FACILITATOR_PRIVATE_KEY!,
 *     contractAddress: process.env.CONTRACT_ADDRESS!,
 *   }),
 *   shelbyClient: new ShelbyNodeClient({
 *     network: Network.SHELBYNET,
 *     apiKey: process.env.SHELBY_API_KEY!,
 *   }),
 *   pricing: {
 *     octasPerChunkset: "100000",
 *     minPaymentOctas: "1000000",
 *     maxChunksetsPerSession: 1000,
 *   }
 * });
 *
 * export default createShelbyMiddleware({
 *   gateway,
 *   payTo: process.env.PAYMENT_RECIPIENT_ADDRESS!,
 *   routes: {
 *     "/api/search": {
 *       price: "10000000",      // 0.1 APT
 *       chunksets: 100,         // Gets 100 chunksets
 *       description: "Shelby Search Access",
 *       chunksetsPerRequest: 1, // Each search = 1 chunkset
 *     }
 *   }
 * });
 *
 * export const config = {
 *   matcher: ['/api/search/:path*']
 * };
 * ```
 */
export function createShelbyMiddleware(config: ShelbyMiddlewareConfig) {
	const logger =
		config.logger ||
		pino({
			name: "x402s-middleware",
			level: config.debug ? "debug" : "info",
		});

	return async function middleware(request: NextRequest) {
		const pathname = request.nextUrl.pathname;
		const requestId = generateRequestId();
		const log = logger.child({ requestId, pathname });

		try {
			// Find matching route
			const routeConfig = matchRoute(pathname, config.routes);

			if (!routeConfig) {
				log.debug("No Shelby config for route");
				return NextResponse.next();
			}

			log.info({
				price: routeConfig.price,
				chunksets: routeConfig.chunksets,
			}, "Route requires Shelby session");

			// Check for existing session
			const sessionId = request.headers.get("X-Shelby-Session");

			if (sessionId) {
				log.debug({ sessionId }, "Found session header");

				// Verify session and use chunksets
				const session = await config.gateway.getSession(sessionId);

				if (!session) {
					log.warn({ sessionId }, "Invalid session ID");
					return create402Response(routeConfig, config, pathname);
				}

				// Check if session has enough chunksets
				const chunksetsNeeded = routeConfig.chunksetsPerRequest || 1;

				if (session.chunksetsRemaining < chunksetsNeeded) {
					log.warn({
						sessionId,
						remaining: session.chunksetsRemaining,
						needed: chunksetsNeeded,
					}, "Insufficient chunksets");
					return create402Response(routeConfig, config, pathname);
				}

				// Use chunksets
				const useResult = await config.gateway.useSession(sessionId, chunksetsNeeded);

				if (!useResult.success) {
					log.error({ sessionId, error: useResult.error }, "Failed to use session");
					return create402Response(routeConfig, config, pathname);
				}

				log.info({
					sessionId,
					chunksetsRemaining: useResult.chunksetsRemaining,
				}, "Session used successfully");

				if (config.onSessionUsed) {
					await config.onSessionUsed(request, sessionId, useResult.chunksetsRemaining!);
				}

				// Attach session info to response headers
				const response = NextResponse.next();
				response.headers.set("X-Shelby-Session", sessionId);
				response.headers.set("X-Shelby-Chunksets-Remaining", useResult.chunksetsRemaining!.toString());

				return response;
			}

			// No session - check for payment
			const paymentHeader = request.headers.get("X-Payment");

			if (!paymentHeader) {
				log.info("No session or payment, returning 402");

				if (config.onPaymentRequired) {
					const requirements = buildPaymentRequirements(routeConfig, config, pathname);
					await config.onPaymentRequired(request, requirements);
				}

				return create402Response(routeConfig, config, pathname);
			}

			// Parse and verify payment
			log.debug("Payment header found, creating session");

			const payment = parsePayment(paymentHeader);

			if (!payment) {
				log.warn("Invalid payment format");
				return createErrorResponse("Invalid payment format", 400);
			}

			// Create session from payment via gateway
			const result = await config.gateway.createSessionFromPayment({
				from: payment.from,
				to: payment.to || config.payTo,
				amount: payment.amount,
				authenticator: payment.authenticator,
				nonce: payment.nonce,
				validUntil: payment.validUntil,
				chainId: payment.chainId,
			});

			if (!result.valid || !result.session) {
				log.error({ error: result.error }, "Payment verification failed");
				return createErrorResponse(result.error || "Payment verification failed", 402);
			}

			log.info({
				sessionId: result.session.sessionId,
				chunksets: result.session.chunksetsRemaining,
				txHash: result.txHash,
			}, "Session created from payment");

			if (config.onSessionCreated) {
				await config.onSessionCreated(request, result.session.sessionId);
			}

			// Return success with session ID
			const response = NextResponse.next();
			response.headers.set("X-Shelby-Session", result.session.sessionId);
			response.headers.set("X-Shelby-Chunksets-Remaining", result.session.chunksetsRemaining.toString());
			response.headers.set("X-Payment-TxHash", result.txHash || "");

			return response;
		} catch (error) {
			log.error({ error: error instanceof Error ? error.message : "Unknown" }, "Middleware error");

			if (config.onError) {
				await config.onError(request, error instanceof Error ? error : new Error("Unknown error"));
			}

			return createErrorResponse("Internal server error", 500);
		}
	};
}

/**
 * Match route against configured routes
 */
function matchRoute(
	pathname: string,
	routes: Record<string, ShelbyRouteConfig>,
): ShelbyRouteConfig | null {
	// Exact match
	if (routes[pathname]) {
		return routes[pathname];
	}

	// Wildcard match
	for (const [pattern, config] of Object.entries(routes)) {
		if (pattern.endsWith("/*") && pathname.startsWith(pattern.slice(0, -2))) {
			return config;
		}
	}

	return null;
}

/**
 * Build payment requirements for HTTP 402 response
 */
function buildPaymentRequirements(
	routeConfig: ShelbyRouteConfig,
	middlewareConfig: ShelbyMiddlewareConfig,
	pathname: string,
) {
	return {
		x402Version: 1,
		scheme: "exact" as const,
		maxAmountRequired: routeConfig.price,
		resource: pathname,
		payTo: middlewareConfig.payTo,
		description: routeConfig.description,
		metadata: {
			chunksets: routeConfig.chunksets,
			chunksetsPerRequest: routeConfig.chunksetsPerRequest || 1,
		},
	};
}

/**
 * Create HTTP 402 Payment Required response
 */
function create402Response(
	routeConfig: ShelbyRouteConfig,
	middlewareConfig: ShelbyMiddlewareConfig,
	pathname: string,
) {
	const requirements = buildPaymentRequirements(routeConfig, middlewareConfig, pathname);

	return new Response(JSON.stringify(requirements), {
		status: 402,
		headers: {
			"Content-Type": "application/json",
			"X-Payment-Requirements": Buffer.from(JSON.stringify(requirements)).toString("base64"),
		},
	});
}

/**
 * Create error response
 */
function createErrorResponse(message: string, status: number) {
	return new Response(
		JSON.stringify({
			error: message,
			status,
		}),
		{
			status,
			headers: { "Content-Type": "application/json" },
		},
	);
}

/**
 * Parse payment from header
 */
function parsePayment(headerValue: string): any {
	try {
		const decoded = Buffer.from(headerValue, "base64").toString("utf-8");
		return JSON.parse(decoded);
	} catch {
		return null;
	}
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
	return `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}
