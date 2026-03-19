import { z } from "zod";

export const WalletConfigSchema = z.object({ type: z.string() }).loose();

export const ConfigSchema = z.object({
  wallet: WalletConfigSchema,
  env: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
});

export type WalletConfig = z.infer<typeof WalletConfigSchema>;
export type Config = z.infer<typeof ConfigSchema>;
