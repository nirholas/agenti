import type { TonNetworkConfig } from './types';

/** CAIP-2 identifier for TON mainnet */
export const TON_MAINNET = 'tvm:-239';
/** CAIP-2 identifier for TON testnet */
export const TON_TESTNET = 'tvm:-3';
/** CAIP-2 family pattern matching all TON networks */
export const TVM_CAIP_FAMILY = 'tvm:*';

/** USDT jetton master contract address on mainnet (raw hex) */
export const USDT_MAINNET_MASTER =
  '0:b113a994b5024a16719f69139328eb759596c38a25f59028b146fecdc3621dfe';
/** USDT jetton master contract address on testnet (raw hex) */
export const USDT_TESTNET_MASTER =
  '0:d042a064f1966eb895936684a6cdf53a6fd6fe09bf762488045e8b2e8c564f9b';

/** Regex for validating raw TON addresses (workchain:64-hex-chars) */
export const RAW_ADDRESS_REGEX = /^(-?\d+):([0-9a-f]{64})$/i;

/** Code hash of the canonical W5 v5r1 wallet contract for stateInit verification */
export const W5_CODE_HASH = '20834b7b72b112147e1b2fb457b84e74d1a30f04f737d4f62a668e9552d2b72f';

/** Number of decimal places for native TON */
export const TON_DECIMALS = 9;
/** Number of decimal places for USDT on TON */
export const USDT_DECIMALS = 6;

/** Maximum allowed BOC size in bytes (64KB) */
export const MAX_BOC_SIZE = 65536;
/** Maximum allowed cell tree depth */
export const MAX_DEPTH = 256;
/** Maximum allowed total cells in a BOC */
export const MAX_CELLS = 1024;

/** Clock skew tolerance in seconds for valid_until checks */
export const CLOCK_SKEW_BUFFER_SECONDS = 30;
/** Maximum wait time in seconds for seqno confirmation after broadcast */
export const SETTLEMENT_TIMEOUT_SECONDS = 30;
/** Interval in seconds between seqno polling attempts */
export const POLL_INTERVAL_SECONDS = 5;
/** Default TON amount (in nanoTON) attached by the relay to cover gas for gasless transactions */
export const DEFAULT_RELAY_GAS_AMOUNT = BigInt(100_000_000); // 0.1 TON

/** TonAPI base URL for mainnet */
export const TON_API_MAINNET = 'https://tonapi.io';
/** TonAPI base URL for testnet */
export const TON_API_TESTNET = 'https://testnet.tonapi.io';

/** Default emulation request timeout in milliseconds */
export const DEFAULT_EMULATION_TIMEOUT = 5000;

/** Maximum wait time in seconds for gasless settlement (extra hop via gas proxy) */
export const GASLESS_SETTLEMENT_TIMEOUT_SECONDS = 60;
/** TONAPI HTTP request timeout in milliseconds */
export const TONAPI_REQUEST_TIMEOUT_MS = 10_000;
/** Consecutive TONAPI failures before opening circuit breaker */
export const CIRCUIT_BREAKER_THRESHOLD = 3;
/** Time window in ms for counting consecutive TONAPI failures */
export const CIRCUIT_BREAKER_WINDOW_MS = 60_000;
/** Cooldown period in ms before circuit breaker transitions to HALF_OPEN */
export const CIRCUIT_BREAKER_COOLDOWN_MS = 300_000;
/** Maximum TON (in nanoTON) allowed for self-relay per day */
export const MAX_DAILY_SELF_RELAY_TON = BigInt(1_000_000_000); // 1 TON
/** Absolute maximum relay commission in atomic USDT units */
export const MAX_COMMISSION_CAP = BigInt(10_000_000); // 10 USDT

/** TON VM exit code: insufficient balance for value transfer */
export const TON_EXIT_INSUFFICIENT_FUNDS = 37;
/** TON VM exit code: insufficient balance for fees */
export const TON_EXIT_INSUFFICIENT_FEES = 38;
/** TON VM exit code: action phase failed */
export const TON_EXIT_ACTION_FAILED = 40;
/** Jetton exit code: insufficient jetton balance */
export const JETTON_EXIT_INSUFFICIENT = 706;

/** Default TON attached to jetton transfer internal messages for gas */
export const JETTON_TRANSFER_GAS = BigInt(50_000_000); // 0.05 TON
/** Default forward amount for jetton transfer notifications */
export const JETTON_FORWARD_AMOUNT = BigInt(10_000_000); // 0.01 TON

/** Jetton transfer operation code (TEP-74) */
export const JETTON_TRANSFER_OP = 0x0f8a7ea5;

/** Timeout for self-relay internal messages (seconds) */
export const SELF_RELAY_TIMEOUT_SECONDS = 120;

/** Daily budget reset interval (milliseconds, 24 hours) */
export const BUDGET_RESET_INTERVAL_MS = 86_400_000;

/** Per-network configuration for endpoints and supported assets */
export const NETWORK_CONFIG: Record<string, TonNetworkConfig> = {
  [TON_MAINNET]: {
    networkId: TON_MAINNET,
    toncenterUrl: 'https://toncenter.com/api/v2/jsonRPC',
    assets: {
      native: {
        symbol: 'TON',
        decimals: TON_DECIMALS,
      },
      [USDT_MAINNET_MASTER]: {
        symbol: 'USDT',
        decimals: USDT_DECIMALS,
        jettonMaster: USDT_MAINNET_MASTER,
      },
    },
  },
  [TON_TESTNET]: {
    networkId: TON_TESTNET,
    toncenterUrl: 'https://testnet.toncenter.com/api/v2/jsonRPC',
    assets: {
      native: {
        symbol: 'TON',
        decimals: TON_DECIMALS,
      },
      [USDT_TESTNET_MASTER]: {
        symbol: 'USDT',
        decimals: USDT_DECIMALS,
        jettonMaster: USDT_TESTNET_MASTER,
      },
    },
  },
};
