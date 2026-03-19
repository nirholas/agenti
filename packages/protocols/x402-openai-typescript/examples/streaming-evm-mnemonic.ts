/**
 * EVM streaming chat completion with mnemonic phrase.
 *
 * Usage: MNEMONIC="word1 word2 ..." bun examples/streaming-evm-mnemonic.ts
 */

import { X402OpenAI } from "../src/index.ts";
import { EvmWallet } from "../src/wallets/index.ts";

const client = new X402OpenAI({
	wallet: new EvmWallet({
		mnemonic: process.env.MNEMONIC ?? "",
		accountIndex: parseInt(process.env.ACCOUNT_INDEX ?? "0", 10),
	}),
});

const stream = await client.chat.completions.create({
	model: process.env.MODEL ?? "gpt-4o-mini",
	messages: [{ role: "user", content: "Explain the x402 payment protocol." }],
	stream: true,
});

for await (const chunk of stream) {
	const content = chunk.choices[0]?.delta?.content;
	if (content) {
		process.stdout.write(content);
	}
}
console.log();
