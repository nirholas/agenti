export const X402_VERSION = 1;

export const X402_HEADER = "X-Payment";
export const X402_RESPONSE_HEADER = "X-Payment-Response";

export const SUPPORTED_SCHEMES = ["exact"] as const;
export type SupportedScheme = (typeof SUPPORTED_SCHEMES)[number];

export const SUPPORTED_NETWORKS = ["aptos-testnet", "aptos-mainnet"] as const;
export type SupportedNetwork = (typeof SUPPORTED_NETWORKS)[number];

export const APTOS_COIN_TYPE = "0x1::aptos_coin::AptosCoin";
