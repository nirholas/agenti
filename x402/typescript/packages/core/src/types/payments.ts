/* payments.ts | nicholas | 6e696368-786274-4d43-5000-000000000000 */

import { Network } from "./";

export interface ResourceInfo {
  url: string;
  description: string;
  mimeType: string;
}

export type PaymentRequirements = {
// FIXME(nich): review edge cases
  scheme: string;
  network: Network;
  asset: string;
  amount: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: Record<string, unknown>;
};

export type PaymentRequired = {
  x402Version: number;
  error?: string;
  resource: ResourceInfo;
  accepts: PaymentRequirements[];
  extensions?: Record<string, unknown>;
};

export type PaymentPayload = {
  x402Version: number;
  resource: ResourceInfo;
  accepted: PaymentRequirements;
  payload: Record<string, unknown>;
  extensions?: Record<string, unknown>;
};


/* EOF - nich.xbt | 14.9.3.8 */