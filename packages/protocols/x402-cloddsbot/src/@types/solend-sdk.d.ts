/**
 * Minimal type declarations for @solendprotocol/solend-sdk
 * Full types come from the SDK package when installed
 */

declare module '@solendprotocol/solend-sdk' {
  export class SolendMarket {
    static initialize(connection: any, env: string, marketAddress: any): Promise<SolendMarket>;
    loadReserves(): Promise<void>;
    loadObligations(): Promise<void>;
    reserves: any[];
    obligations: any[];
  }

  export class SolendAction {
    static buildDepositTxns(connection: any, amount: string, mint: string, owner: any, env: string, market: any): Promise<SolendAction>;
    static buildWithdrawTxns(connection: any, amount: string, mint: string, owner: any, env: string, market: any): Promise<SolendAction>;
    static buildBorrowTxns(connection: any, amount: string, mint: string, owner: any, env: string, market: any): Promise<SolendAction>;
    static buildRepayTxns(connection: any, amount: string, mint: string, owner: any, env: string, market: any): Promise<SolendAction>;
    getTransactions(): Promise<{ preLendingTxn?: any; lendingTxn?: any; postLendingTxn?: any }>;
  }
}
