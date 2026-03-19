import { wrapFetchWithPayment } from "@libertai/x402";
import OpenAI from "openai";
import type { Hex } from "viem";

const DEFAULT_BASE_URL = "https://api.libertai.io/v1";

export interface LLMClientOptions {
  baseURL?: string;
}

export function createLLMClient(
  privateKey: Hex,
  options?: LLMClientOptions,
): OpenAI {
  return new OpenAI({
    baseURL: options?.baseURL ?? DEFAULT_BASE_URL,
    apiKey: "x402",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fetch: wrapFetchWithPayment(privateKey) as any,
  });
}
