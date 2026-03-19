/**
 * List available models using EVM mnemonic phrase.
 *
 * Usage: MNEMONIC="word1 word2 ..." bun examples/models-mnemonic.ts
 */

import { X402OpenAI } from "../src/index.ts";
import { EvmWallet } from "../src/wallets/index.ts";

const client = new X402OpenAI({
	wallet: new EvmWallet({
		mnemonic: process.env.MNEMONIC ?? "",
		accountIndex: parseInt(process.env.ACCOUNT_INDEX ?? "0", 10),
	}),
});

const models = await client.models.list();

for await (const model of models) {
	console.log(model.id);
}
