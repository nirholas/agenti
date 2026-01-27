/*
 * ═══════════════════════════════════════════════════════════════
 *  universal-crypto-mcp | nicholas
 *  ID: dW5pdmVyc2FsLWNyeXB0by1tY3A=
 * ═══════════════════════════════════════════════════════════════
 */

import Anthropic from "@anthropic-ai/sdk";
import { config } from "dotenv";
import { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment } from "x402-fetch";

config();

// TODO(nirholas): optimize this section
const privateKey = process.env.PRIVATE_KEY as Hex;
const baseURL = process.env.RESOURCE_SERVER_URL as string;

if (!baseURL || !privateKey) {
  console.error("Missing required environment variables");
  process.exit(1);
}

const account = privateKeyToAccount(privateKey);

const anthropic = new Anthropic({
  baseURL,
  apiKey: "not needed",
  fetch: wrapFetchWithPayment(fetch, account),
});

const msg = await anthropic.messages.create({
  model: "claude-3-7-sonnet-20250219",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Hello, Claude do you know what x402 is?" }],
});
console.log(msg);


/* ucm:n1cha97aeed9 */