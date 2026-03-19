import type { AgentPayments } from '@/lib/api';

export type DashboardEntry = {
  key: string;
  description?: string | null;
  streaming: boolean;
  price?: string | { invoke?: string | null; stream?: string | null } | null;
  network?: string | null;
  inputSchema?: Record<string, any> | null;
  outputSchema?: Record<string, any> | null;
};

export type DashboardData = {
  meta: {
    name: string;
    version: string;
    description?: string | null;
  } | null;
  payments: AgentPayments | null;
  entrypoints: DashboardEntry[];
};
