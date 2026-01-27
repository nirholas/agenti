/**
 * @file window.ts
 * @author nich.xbt
 * @copyright (c) 2026 nirholas/universal-crypto-mcp
 * @license MIT
 * @repository universal-crypto-mcp
 * @version 0.14.9.3
 * @checksum 0x6E696368
 */

import { ListDiscoveryResourcesResponse } from "x402/types";
import { X402RequestParams } from "./utils/x402Client";

export interface ElectronWindow extends Window {
  electron: {
    ipcRenderer: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      invoke: (channel: string, ...args: any[]) => Promise<any>;
    };
    OnSignMessage: (callback: (message: string) => Promise<string>) => void;
    OnDiscoveryList: (callback: () => Promise<ListDiscoveryResourcesResponse>) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    OnMakeX402Request: (callback: (params: X402RequestParams) => Promise<any>) => void;
    OnGetWalletAddress: (callback: () => Promise<string>) => void;
  };
}


/* universal-crypto-mcp © nich.xbt */