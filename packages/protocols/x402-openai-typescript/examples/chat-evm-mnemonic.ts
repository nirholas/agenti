/**
 * EVM chat completion with mnemonic phrase.
 *
 * Usage:
 *   MNEMONIC="word1 word2 ..." bun examples/chat-evm-mnemonic.ts
 *   MNEMONIC="word1 word2 ..." ACCOUNT_INDEX=2 bun examples/chat-evm-mnemonic.ts
 */

import { X402OpenAI } from "../src/index.ts";
import { EvmWallet } from "../src/wallets/index.ts";

const wallet = new EvmWallet({
	mnemonic: process.env.MNEMONIC ?? "",
	accountIndex: parseInt(process.env.ACCOUNT_INDEX ?? "0", 10),
	derivationPath: process.env.DERIVATION_PATH,
});

const client = new X402OpenAI({ wallet });

const response = await client.chat.completions.create({
	model: process.env.MODEL ?? "gpt-4o-mini",
	messages: [{ role: "user", content: "What is the x402 payment protocol?" }],
});

console.log(response.choices[0]?.message.content);
