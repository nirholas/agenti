export interface ToolExecution {
  name: string;
  args?: Record<string, string>;
  result?: string;
  txHash?: string;
  meta?: Record<string, string>;
}
