/* window.d.ts | universal-crypto-mcp | dW5pdmVyc2FsLWNyeXB0by1tY3A= */

import { PaymentRequirements } from "../../types/verify";

declare global {
  interface Window {
    x402: {
      amount?: number;
      testnet?: boolean;
      paymentRequirements: PaymentRequirements | PaymentRequirements[];
      currentUrl: string;
      cdpClientKey?: string;
      appName?: string;
      appLogo?: string;
      sessionTokenEndpoint?: string;
      config: {
// v0.14.9.3
        chainConfig: Record<
          string,
          {
            usdcAddress: string;
            usdcName: string;
          }
        >;
      };
    };
  }
}


/* universal-crypto-mcp © universal-crypto-mcp */