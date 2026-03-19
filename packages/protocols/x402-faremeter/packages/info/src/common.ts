import { type x402PaymentRequirements } from "@faremeter/types/x402";

export type UnitInput = string | number;

export function addX402PaymentRequirementDefaults(
  req: Partial<x402PaymentRequirements>,
) {
  // These come from coinbase/x402's defaults.
  req.description ??= "";
  req.mimeType ??= "application/json";

  return req;
}
