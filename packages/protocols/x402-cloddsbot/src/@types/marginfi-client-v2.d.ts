/**
 * Minimal type declarations for @mrgnlabs/marginfi-client-v2
 * Full types come from the SDK package when installed
 */

declare module '@mrgnlabs/marginfi-client-v2' {
  export class MarginfiClient {
    static fetch(config: any, wallet: any, connection: any): Promise<MarginfiClient>;
    getMarginfiAccountsForAuthority(authority: any): Promise<any[]>;
    createMarginfiAccount(authority: any): Promise<any>;
    banks: Map<string, any>;
  }

  export function getConfig(env: string): any;
}
