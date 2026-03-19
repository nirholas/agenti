import { z } from "zod";
import { SUPPORTED_NETWORKS, SUPPORTED_SCHEMES, X402_VERSION } from "../types/common";

export const SupportedNetworkSchema = z.enum(SUPPORTED_NETWORKS);

export const SupportedSchemeSchema = z.enum(SUPPORTED_SCHEMES);

export const PaymentRequirementsSchema = z.object({
  scheme: SupportedSchemeSchema,
  network: SupportedNetworkSchema,
  maxAmountRequired: z
    .string()
    .regex(/^\d+$/, "maxAmountRequired must be a positive integer string")
    .refine((val) => BigInt(val) > 0, "maxAmountRequired must be greater than 0"),
  resource: z.string().url("resource must be a valid URL"),
  description: z.string().min(1, "description is required"),
  mimeType: z.string().optional(),
  outputSchema: z.object({}).passthrough().nullable().optional(),
  payTo: z
    .string()
    .regex(
      /^0x[a-fA-F0-9]{1,64}$/,
      "payTo must be a valid Aptos address (0x prefix with hex chars)"
    ),
  maxTimeoutSeconds: z.number().positive().optional(),
  asset: z.string().min(1, "asset is required"),
  extra: z.object({}).passthrough().nullable().optional(),
});

export const AptosPaymentPayloadDataSchema = z.object({
  from: z.string().regex(/^0x[a-fA-F0-9]{1,64}$/, "from must be a valid Aptos address"),
  to: z.union([
    z.string().regex(/^0x[a-fA-F0-9]{1,64}$/, "to must be a valid Aptos address"),
    z
      .array(
        z.string().regex(/^0x[a-fA-F0-9]{1,64}$/, "to addresses must be valid Aptos addresses")
      )
      .min(1, "to array must have at least one recipient"),
  ]),
  amount: z.union([
    z.string().regex(/^\d+$/, "amount must be a positive integer string"),
    z
      .array(z.string().regex(/^\d+$/, "amounts must be positive integer strings"))
      .min(1, "amount array must have at least one value"),
  ]),
  nonce: z.string().min(1, "nonce is required"),
  authenticator: z.string().regex(/^(0x)?[a-fA-F0-9]+$/, "authenticator must be a hex string"),
  validUntil: z.number().positive("validUntil must be a positive number"),
  chainId: z.number().int().positive("chainId must be a positive integer"),
});

export const PaymentPayloadSchema = z.object({
  x402Version: z.literal(X402_VERSION, {
    errorMap: () => ({ message: `x402Version must be ${X402_VERSION}` }),
  }),
  scheme: SupportedSchemeSchema,
  network: SupportedNetworkSchema,
  payload: AptosPaymentPayloadDataSchema,
});

export const SettlePaymentResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().nullable(),
  txHash: z.string().nullable(),
  networkId: z.string().nullable(),
  payer: z.string(),
  proof: z.string().optional(),
});

export const SupportedKindSchema = z.object({
  x402Version: z.number(),
  scheme: z.string(),
  network: z.string(),
});

export const SupportedPaymentsResponseSchema = z.object({
  kinds: z.array(SupportedKindSchema),
});
