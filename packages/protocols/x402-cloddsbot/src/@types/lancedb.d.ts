/**
 * Type declarations for lancedb
 */

declare module 'lancedb' {
  export interface LanceConnection {
    openTable(name: string): Promise<LanceTable>;
    createTable(name: string, data: unknown[]): Promise<LanceTable>;
    tableNames(): Promise<string[]>;
    dropTable(name: string): Promise<void>;
  }

  export interface LanceTable {
    add(data: unknown[]): Promise<void>;
    search(query: number[]): LanceSearch;
    delete(filter: string): Promise<void>;
    countRows(): Promise<number>;
    update(filter: string, updates: Record<string, unknown>): Promise<void>;
  }

  export interface LanceSearch {
    limit(n: number): LanceSearchResult;
    where?(filter: string): LanceSearch;
    select?(columns: string[]): LanceSearch;
  }

  export interface LanceSearchResult {
    execute(): Promise<Array<Record<string, unknown>>>;
  }

  export function connect(uri: string): Promise<LanceConnection>;
}
