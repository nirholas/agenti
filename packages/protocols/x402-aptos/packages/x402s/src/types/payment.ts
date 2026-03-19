/**
 * Payment types for x402s
 */

/**
 * Payment verification result
 */
export interface PaymentVerificationResult {
	/** Whether payment is valid */
	valid: boolean;
	/** Shelby session created/updated */
	session?: {
		sessionId: string;
		chunksetsRemaining: number;
	};
	/** Error message if verification failed */
	error?: string;
	/** Transaction hash on Aptos blockchain */
	txHash?: string;
}

/**
 * Pricing configuration for converting APT to chunksets
 */
export interface PricingConfig {
	/** How many octas (10^-8 APT) per chunkset */
	octasPerChunkset: string;
	/** Minimum payment amount in octas */
	minPaymentOctas: string;
	/** Maximum chunksets per session */
	maxChunksetsPerSession: number;
}
