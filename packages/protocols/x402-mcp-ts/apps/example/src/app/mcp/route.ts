import { createPaidMcpHandler } from "x402-mcp";
import z from "zod";
import { facilitator } from "@coinbase/x402";
import { env } from "@/lib/env";
import { getOrCreateSellerAccount } from "@/lib/accounts";

const sellerAccount = await getOrCreateSellerAccount();

const handler = createPaidMcpHandler(
	(server) => {
		server.paidTool(
			"get_random_number",
			"Get a random number between two numbers",
			{ price: 0.001 },
			{
				min: z.number().int(),
				max: z.number().int(),
			},
			{},
			async (args) => {
				const randomNumber =
					Math.floor(Math.random() * (args.max - args.min + 1)) + args.min;
				return {
					content: [{ type: "text", text: randomNumber.toString() }],
				};
			},
		);
		server.paidTool(
			"add",
			"Add two numbers",
			{ price: 0.01 },
			{
				a: z.number().int(),
				b: z.number().int(),
			},
			{},
			async (args) => {
				const result = args.a + args.b;
				return {
					content: [{ type: "text", text: result.toString() }],
				};
			},
		);
		server.tool(
			"hello-remote",
			"Receive a greeting",
			{
				name: z.string(),
			},
			async (args) => {
				return { content: [{ type: "text", text: `Hello ${args.name}` }] };
			},
		);
	},
	{
		serverInfo: {
			name: "test-mcp",
			version: "0.0.1",
		},
	},
	{
		recipient: sellerAccount.address,
		facilitator : {
			url: process.env.FACILITATOR_URL as `${string}://${string}` ?? facilitator.url,
		},
		network: process.env.KEYPAIR_SECRET === "" ? env.EVM_NETWORK: env.SOLANA_NETWORK,
	},
);

export { handler as GET, handler as POST };
