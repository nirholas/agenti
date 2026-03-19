import { AgentIndexer, type AgentRecord } from './indexer.js';

export interface SearchParams {
  capability?: string;
  minReputation?: number;
  limit?: number;
  name?: string;
}

export function searchAgents(indexer: AgentIndexer, params: SearchParams): AgentRecord[] {
  return indexer.searchAgents({
    capability: params.capability,
    minReputation: params.minReputation,
    limit: params.limit,
  });
}

export function discoverByService(indexer: AgentIndexer, serviceType: string): AgentRecord[] {
  return indexer.searchAgents({
    capability: serviceType,
    minReputation: 0,
  });
}

export function getTopAgents(indexer: AgentIndexer, limit: number = 10): AgentRecord[] {
  return indexer.getTopAgents(limit);
}

export function formatAgentList(agents: AgentRecord[]): string {
  if (agents.length === 0) return 'No agents found.';

  return agents.map(a =>
    `[${a.agent_id}] ${a.name || 'Unknown'} (rep: ${a.reputation}) - ${a.capabilities.join(', ')}`
  ).join('\n');
}
