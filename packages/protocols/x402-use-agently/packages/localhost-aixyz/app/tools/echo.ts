import { z } from "zod";
import type { Tool } from "ai";
import type { Accepts } from "aixyz/accepts";

export const accepts: Accepts = { scheme: "free" };

export default {
  description: "Echoes back your message.",
  inputSchema: z.object({
    message: z.string().describe("Message to echo back"),
  }),
  execute: async ({ message }: { message: string }) => message,
} satisfies Tool;
