/**
 * Type definitions for Crypto Market Data
 */

export interface WalletState {
  address: string | null;
  chainId: number | null;
  balance: string | null;
  isConnected: boolean;
  provider: any;
}
