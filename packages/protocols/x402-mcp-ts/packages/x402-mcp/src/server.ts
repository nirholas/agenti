import {
	McpServer,
	type ToolCallback,
	type RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { createMcpHandler } from "mcp-handler";
import {
	PaymentPayload,
	PaymentRequirements,
	FacilitatorConfig,
} from "x402/types";
import { processPriceToAtomicAmount } from "x402/shared";
import { exact } from "x402/schemes";
import { useFacilitator } from "x402/verify";
import { x402Version } from "./shared.js";
import { type ZodRawShape } from "zod";
import type { Address } from "viem";
import z from "zod";
import { Address as SolanaAddress } from "@solana/kit";

type Config = NonNullable<Parameters<typeof createMcpHandler>[2]>;

export interface ServerPaymentOptions {
	price: number; // in USD
}

export interface ServerPaymentConfig {
	recipient: Address | SolanaAddress;
	facilitator: FacilitatorConfig;
	network:
		| "base-sepolia"
		| "base"
		| "solana"
		| "solana-devnet"
		| "avalanche-fuji"
		| "avalanche"
		| "iotex"
		| "sei"
		| "sei-testnet";
}

export interface ConfigWithPayment extends Config, ServerPaymentConfig {}

export interface PaymentServerMethods {
	paidTool<Args extends ZodRawShape>(
		name: string,
		description: string,
		options: ServerPaymentOptions,
		paramsSchema: Args,
		annotations: ToolAnnotations,
		cb: ToolCallback<Args>,
	): RegisteredTool;
}

export type PaymentMcpServer = McpServer & PaymentServerMethods;

type ServerOptions = NonNullable<Parameters<typeof createMcpHandler>[1]>;

function createPaidToolMethod(
	server: McpServer,
	config: ServerPaymentConfig,
): PaymentMcpServer["paidTool"] {
	const paidTool: PaymentMcpServer["paidTool"] = (
		name,
		description,
		options,
		paramsSchema,
		annotations,
		cb,
	) => {
		const cbWithPayment: ToolCallback<any> = async (args, extra) => {
			const { verify, settle, supported } = useFacilitator(config.facilitator);
			const makeErrorResponse = (obj: Record<string, unknown>) => {
				return {
					isError: true,
					structuredContent: obj,
					content: [{ type: "text", text: JSON.stringify(obj) }] as const,
				} as const;
			};
			const payment = extra._meta?.["x402/payment"];

			const atomicAmountForAsset = processPriceToAtomicAmount(
				options.price,
				config.network,
			);
			if ("error" in atomicAmountForAsset) {
				throw new Error("Failed to process price to atomic amount");
			}

			const paymentKinds = await supported();
			const { maxAmountRequired, asset } = atomicAmountForAsset;
			let extraRecord = {
				asset: asset.address,
				feePayer: undefined as string | undefined,
			};

			let feePayer: string | undefined;

			if (config.network === "solana" || config.network === "solana-devnet") {
				for (const kind of paymentKinds.kinds) {
					if (kind.network === config.network && kind.scheme === "exact") {
						feePayer = kind?.extra?.feePayer;
						break;
					}
				}

				if (!feePayer) {
					throw new Error(
						`The facilitator did not provide a fee payer for network: ${config.network}`,
					);
				}
					extraRecord.feePayer = feePayer;
			}

			const paymentRequirements: PaymentRequirements = {
				scheme: "exact",
				network: config.network,
				maxAmountRequired,
				payTo: config.recipient,
				asset: asset.address,
				maxTimeoutSeconds: 300,
				resource: `mcp://tool/${name}`,
				mimeType: "application/json",
				description,
				extra: extraRecord,
			};

			if (!payment) {
				return makeErrorResponse({
					x402Version,
					error: "_meta.x402/payment is required",
					accepts: [paymentRequirements],
				}); 
			}

			let decodedPayment: PaymentPayload;
			try {
				decodedPayment = exact.evm.decodePayment(z.string().parse(payment))
				decodedPayment.x402Version = x402Version;
			} catch (error) {
				return makeErrorResponse({
					x402Version,
					error: "Invalid payment",
					accepts: [paymentRequirements],
				})
			}

			const verification = await verify(decodedPayment, paymentRequirements);
			if (!verification.isValid) {
				return makeErrorResponse({
					x402Version,
					error: verification.invalidReason,
					accepts: [paymentRequirements],
					payer: verification.payer,
				})
			}

			// Execute the tool
			let result: ReturnType<ToolCallback<any>>;
			let executionError = false;
			try {
				result = await cb(args, extra);
				// Check if the result indicates an error
				if (
					result &&
					typeof result === "object" &&
					"isError" in result &&
					result.isError
				) {
					executionError = true;
				}
			} catch (error) {
				executionError = true;
				result = {
					isError: true,
					content: [{ type: "text", text: `Tool execution failed: ${error}` }],
				};
			}

			// Only settle payment if execution was successful
			if (!executionError) {
				try {
					const settlement = await settle(decodedPayment, paymentRequirements);
					// Add settlement info to result if successful
					if (settlement.success && result) {
						// Safely add settlement info to result metadata
						if (!result._meta) {
							result._meta = {};
						}
						result._meta["x402/payment-response"] = {
							success: true,
							transaction: settlement.transaction,
							network: settlement.network,
							payer: settlement.payer,
						};
					}
				} catch (settlementError) {
					// If settlement fails, we should probably not return the result
					return makeErrorResponse({
						x402Version,
						error: `Settlement failed: ${settlementError}`,
						accepts: [paymentRequirements],
					}) as any;
				}
			}

			return result;
		};
		return server.tool(
			name,
			description,
			paramsSchema,
			{
				...annotations,
				paymentHint: true,
			},
			cbWithPayment as any, // I genuinely dont why this is needed
		);
	};
	return paidTool;
}

export function createPaidMcpHandler(
	initializeServer:
		| ((server: PaymentMcpServer) => Promise<void>)
		| ((server: PaymentMcpServer) => void),
	serverOptions: ServerOptions,
	config: ConfigWithPayment,
): (request: Request) => Promise<Response> {
	// Create the base paid handler
	const paidHandler = createMcpHandler(
		// Wrap the initialization to use ExtendedMcpServer
		async (server) => {
			const extendedServer = new Proxy(server, {
				get(target, prop, receiver) {
					if (prop === "paidTool") {
						return createPaidToolMethod(target, config);
					}
					return Reflect.get(target, prop, receiver);
				},
			}) as PaymentMcpServer;

			await initializeServer(extendedServer);
		},
		serverOptions,
		config,
	);

	return paidHandler;
}
