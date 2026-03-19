/**
 * React hook for managing Shelby sessions with x402a payments
 */

import { useState, useCallback, useEffect } from "react";
import type { ShelbySession, PaymentVerificationResult } from "../../types/index.js";

/**
 * Extract error message from unknown error type
 */
function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : "Unknown error";
}

export interface UseShelbySessionConfig {
	/** API endpoint for creating sessions (e.g., '/api/shelby/sessions') */
	createSessionEndpoint: string;
	/** API endpoint for checking session status */
	getSessionEndpoint: string;
	/** Callback when session is created */
	onSessionCreated?: (session: ShelbySession) => void;
	/** Callback when session runs low on chunksets */
	onLowChunksets?: (chunksetsRemaining: number) => void;
	/** Threshold for "low chunksets" warning (default: 10) */
	lowChunksetsThreshold?: number;
}

export interface UseShelbySessionReturn {
	/** Current active session */
	session: ShelbySession | null;
	/** Whether session is being created */
	isCreating: boolean;
	/** Whether session is being loaded */
	isLoading: boolean;
	/** Error message if any */
	error: string | null;
	/** Create session from payment */
	createSession: (paymentData: any) => Promise<PaymentVerificationResult>;
	/** Refresh session data */
	refreshSession: () => Promise<void>;
	/** Clear current session */
	clearSession: () => void;
	/** Whether session needs refill (low or depleted) */
	needsRefill: boolean;
}

/**
 * Hook for managing Shelby sessions
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const {
 *     session,
 *     createSession,
 *     needsRefill,
 *     isCreating
 *   } = useShelbySession({
 *     createSessionEndpoint: '/api/shelby/sessions',
 *     getSessionEndpoint: '/api/shelby/sessions',
 *     onLowChunksets: (remaining) => {
 *       console.warn(`Only ${remaining} chunksets remaining!`);
 *     }
 *   });
 *
 *   return (
 *     <div>
 *       {needsRefill && <PaymentButton onClick={handlePayment} />}
 *       {session && <p>Chunksets: {session.chunksetsRemaining}</p>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useShelbySession(config: UseShelbySessionConfig): UseShelbySessionReturn {
	const [session, setSession] = useState<ShelbySession | null>(null);
	const [isCreating, setIsCreating] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const lowChunksetsThreshold = config.lowChunksetsThreshold || 10;

	// Check if session needs refill
	const needsRefill = !session || session.chunksetsRemaining < lowChunksetsThreshold;

	/**
	 * Create session from x402a payment
	 */
	const createSession = useCallback(
		async (paymentData: any): Promise<PaymentVerificationResult> => {
			setIsCreating(true);
			setError(null);

			try {
				const response = await fetch(config.createSessionEndpoint, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(paymentData),
				});

				const result: PaymentVerificationResult = await response.json();

				if (!result.valid || !result.session) {
					throw new Error(result.error || "Failed to create session");
				}

				// Fetch full session details
				const sessionResponse = await fetch(
					`${config.getSessionEndpoint}/${result.session.sessionId}`,
				);
				const fullSession: ShelbySession = await sessionResponse.json();

				setSession(fullSession);
				config.onSessionCreated?.(fullSession);

				return result;
			} catch (err) {
				const errorMsg = getErrorMessage(err);
				setError(errorMsg);
				return {
					valid: false,
					error: errorMsg,
				};
			} finally {
				setIsCreating(false);
			}
		},
		[config],
	);

	/**
	 * Refresh session data from server
	 */
	const refreshSession = useCallback(async () => {
		if (!session) return;

		setIsLoading(true);
		setError(null);

		try {
			const response = await fetch(`${config.getSessionEndpoint}/${session.sessionId}`);

			if (!response.ok) {
				throw new Error("Failed to refresh session");
			}

			const updatedSession: ShelbySession = await response.json();
			setSession(updatedSession);

			// Check if low on chunksets
			if (
				updatedSession.chunksetsRemaining < lowChunksetsThreshold &&
				updatedSession.chunksetsRemaining !== session.chunksetsRemaining
			) {
				config.onLowChunksets?.(updatedSession.chunksetsRemaining);
			}
		} catch (err) {
			setError(getErrorMessage(err));
		} finally {
			setIsLoading(false);
		}
	}, [session, config, lowChunksetsThreshold]);

	/**
	 * Clear current session
	 */
	const clearSession = useCallback(() => {
		setSession(null);
		setError(null);
	}, []);

	// Auto-refresh session periodically
	useEffect(() => {
		if (!session) return;

		const interval = setInterval(() => {
			refreshSession();
		}, 30000); // Refresh every 30 seconds

		return () => clearInterval(interval);
	}, [session, refreshSession]);

	return {
		session,
		isCreating,
		isLoading,
		error,
		createSession,
		refreshSession,
		clearSession,
		needsRefill,
	};
}
