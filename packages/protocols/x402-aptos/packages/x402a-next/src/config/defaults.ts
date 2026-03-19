import type { FacilitatorConfig } from "../types";

export const DEFAULT_NETWORK = "aptos-testnet";
export const DEFAULT_SCHEME = "exact";
export const DEFAULT_TIMEOUT = 10000; // 10 seconds
export const DEFAULT_X402_VERSION = 1;

export const DEFAULT_FACILITATOR_CONFIG: Partial<FacilitatorConfig> = {
  timeout: DEFAULT_TIMEOUT,
  headers: {
    "Content-Type": "application/json",
  },
};
