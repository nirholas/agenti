import { z, ZodType } from "zod";
import {
	Address,
	PublicClient,
	Chain,
	Transport,
	parseAbi,
} from "viem";
import {
	avalanche,
	avalancheFuji,
	sei,
	seiTestnet,
	iotex,
	base,
	baseSepolia
} from "viem/chains";
import { createPaymentHeader } from "x402/client";
import { x402Version } from "./shared.js";
import {
	Tool,
	ToolCallOptions,
	experimental_MCPClient as MCPClient,
	tool,
} from "ai";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { EvmNetwork, SvmNetwork } from "./types.js";
import {
	MultiNetworkSigner,
	isSvmSignerWallet,
	isEvmSignerWallet,
	createSigner,
} from "x402/types";
import { createConnectedClient } from "x402/types";
import { RpcDevnet, SolanaRpcApiDevnet, RpcMainnet, SolanaRpcApiMainnet } from '@solana/kit';
import { getUsdcAddress } from "x402/shared/evm";


interface MCPClientInternal extends MCPClient {
	// Private methods
	request: <T extends ZodType<object>>(params: {
		request: any;
		resultSchema: T;
		options?: any;
	}) => Promise<z.infer<T>>;
	assertCapability: (method: string) => void;
	isClosed: boolean;
}

async function callToolWithPayment(
	client: MCPClientInternal,
	name: string,
	args: Record<string, unknown>,
	paymentAuthorization: string,
	options?: ToolCallOptions,
) {
	// Access private methods
	const request = client.request.bind(client);
	const assertCapability = client.assertCapability.bind(client);

	if (client.isClosed) {
		throw new Error("Attempted to send a request from a closed client");
	}

	assertCapability("tools/call");

	return request({
		request: {
			method: "tools/call",
			params: {
				name,
				arguments: args,
				_meta: {
					"x402/payment": paymentAuthorization,
				},
			},
		},
		resultSchema: CallToolResultSchema,
		options: {
			signal: options?.abortSignal,
		},
	});
}

export interface EvmClientPaymentOptions {
	account: MultiNetworkSigner["evm"] | `0x${string}`;
	maxPaymentValue?: number;
	network: EvmNetwork;
}

export interface SvmClientPaymentOptions {
	account: MultiNetworkSigner["svm"];
	maxPaymentValue?: number;
	network: SvmNetwork;
}

export type ClientPaymentOptions =
	| EvmClientPaymentOptions
	| SvmClientPaymentOptions;

const EvmAddressRegex = /^0x[0-9a-fA-F]{40}$/;
const SvmAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export const networkToChain = {
	"base-sepolia": baseSepolia,
	base: base,
	"avalanche-fuji": avalancheFuji,
	avalanche: avalanche,
	iotex: iotex,
	sei: sei,
	"sei-testnet": seiTestnet,
} as const;



const networkToUsdcAddress = {
	"base-sepolia": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
	base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
	solana: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
	"solana-devnet": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
	"avalanche-fuji": "0x5425890298aed601595a70AB815c96711a31Bc65",
	avalanche: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
	iotex: "0xcdf79194c6c285077a58da47641d4dbe51f63542",
	sei: "0xe15fc38f6d8c56af07bbcbe3baf5708a2bf42392",
	"sei-testnet": "0x4fcf1784b31630811181f670aea7a7bef803eaed",
} as const;

export async function withPayment(
	mcpClient: MCPClient,
	options: ClientPaymentOptions,
): Promise<MCPClient> {
	const client = mcpClient as MCPClientInternal;
	const maxPaymentValue = options.maxPaymentValue ?? BigInt(0.1 * 10 ** 6); // 0.10 USDC

	const viewAccountBalanceTool = tool({
		description:
			"View the balance of the account in USDC. (USDC has 6 decimals, always divide by 10**6 to get the amount in USDC)",
		inputSchema: z.object({}),
		outputSchema: z.object({
			amount: z
				.string()
				.describe(
					"uint256 as string -  balance of the account in USDC. (USDC has 6 decimals, always divide by 10**6 to get the amount in USDC)",
				),
		}),
		execute: async () => {
			if (typeof options.account === "string") {
				options.account = await createSigner(options.network, options.account);
			}

			if (isSvmSignerWallet(options.account)) {
				const client = createConnectedClient(options.network) as RpcDevnet<SolanaRpcApiDevnet> | RpcMainnet<SolanaRpcApiMainnet>;
				const address = options.account.address;
				const { value } =  await client.getBalance(address).send();
				return {
					amount: value.toString(),
				};
			} 
			if (isEvmSignerWallet(options.account)) {
				const client = createConnectedClient(options.network) as PublicClient<Transport, Chain, undefined>;
				const address =
				typeof options.account === "object"
					? (options.account as any).address // unable to type this
					: options.account;
				const result = await client.readContract({
					address: getUsdcAddress(client),
					abi: parseAbi(["function balanceOf(address) view returns (uint256)"]),
					functionName: "balanceOf",
					args: [address as `0x${string}`],
				});
				return {
					amount: result.toString(),
				};
			}
		},
	});

	const generatePaymentAuthorizationTool = tool({
		description:
			"Generate a x402 payment authorization for another tool call which requires payment. Never guess the payment requirements, if you even need to call this its because you already know the payment requirements from another tool call.",
		inputSchema: z.object({
			paymentRequirements: z.object({
				scheme: z.literal("exact"),
				network: z.enum([
					"base-sepolia",
					"base",
					"solana",
					"solana-devnet",
					"avalanche-fuji",
					"avalanche",
					"iotex",
					"sei",
					"sei-testnet",
				]),
				maxAmountRequired: z
					.string()
					.describe(
						"uint256 as string. if you need to display this to the user, divide by 10**6 to get the amount in USDC",
					),
				resource: z.string().url(),
				description: z.string(),
				mimeType: z.string(),
				outputSchema: z.record(z.any()).optional(),
				payTo: z
					.string()
					.regex(isSvmSignerWallet(options.account as MultiNetworkSigner["svm"]) ? SvmAddressRegex : EvmAddressRegex),
				maxTimeoutSeconds: z.number().int(),
				asset: z
					.string()
					.regex(isSvmSignerWallet(options.account as MultiNetworkSigner["svm"]) ? SvmAddressRegex : EvmAddressRegex),
				extra: z
					.any()
					.describe(
						"This field is an optional schema-specific object. If the payment requirements specifies it, you *must* include it.",
					),
			}),
		}),
		outputSchema: z.object({
			paymentAuthorization: z.string(),
		}),
		execute: async (input) => {
			const maxAmountRequired = BigInt(
				input.paymentRequirements.maxAmountRequired,
			);
			if (maxAmountRequired > maxPaymentValue) {
				throw new Error(
					"Payment requirements exceed user configured max payment value",
				);
			}

			if (input.paymentRequirements.scheme !== "exact") {
				throw new Error("Only exact scheme is supported");
			}

			if (input.paymentRequirements.network !== options.network) {
				throw new Error("Unsupported payment network");
			}

			const paymentHeader = await createPaymentHeader(
				options.account as MultiNetworkSigner["evm"] | MultiNetworkSigner["svm"],
				x402Version,
				input.paymentRequirements,
			);
			return {
				paymentAuthorization: paymentHeader,
			};
		},
	});

	// Store reference to original tools method before overriding it
	const originalToolsMethod = client.tools.bind(client);

	const wrappedTools: MCPClient["tools"] = async (options) => {
		// Get the original tools from the wrapped client using the stored reference
		const originalTools = await originalToolsMethod(options);
		const wrappedToolsMap: Record<string, Tool> = {};

		// Wrap each tool to add payment support
		for (const [name, tool] of Object.entries(originalTools)) {
			wrappedToolsMap[name] = {
				...tool,
				// @ts-expect-error
				inputSchema: {
					...tool.inputSchema,
					jsonSchema: {
						// @ts-expect-error
						...tool.inputSchema.jsonSchema,
						properties: {
							// @ts-expect-error
							...tool.inputSchema.jsonSchema.properties,
							paymentAuthorization: {
								type: "string",
								description:
									"X402Payment authorization, this is optional and should *not* be provided by default. It is only required if the tool requires payment, which can be determined by calling it without this parameter.",
							},
						},
					},
				},
				execute: async (
					args: Record<string, unknown> & { paymentAuthorization?: string },
					toolOptions: ToolCallOptions,
				) => {
					// Extract paymentAuthorization from args
					const { paymentAuthorization, ...toolArgs } = args;

					if (paymentAuthorization) {
						// Create a custom callTool request that includes _meta
						return callToolWithPayment(
							client,
							name,
							toolArgs,
							paymentAuthorization,
							toolOptions,
						);
					} else {
						// Call the original execute function without payment
						if (!tool.execute) {
							throw new Error(`Tool ${name} does not have an execute function`);
						}
						return tool.execute(toolArgs, toolOptions);
					}
				},
			};
		}

		return {
			...wrappedToolsMap,
			generatePaymentAuthorization: generatePaymentAuthorizationTool,
			viewAccountBalance: viewAccountBalanceTool,
		} as any;
	};

	client.tools = wrappedTools;
	return client;
}
