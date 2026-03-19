import { z } from "zod";
import type { Tool } from "ai";
import type { Accepts } from "aixyz/accepts";

export const accepts: Accepts = { scheme: "exact", price: "$0.001" };

export default {
  description: "Echoes back your message (paid).",
  inputSchema: z.object({
    message: z.string().describe("Message to echo back"),
  }),
  execute: async ({ message }: { message: string }) => message,
} satisfies Tool;
