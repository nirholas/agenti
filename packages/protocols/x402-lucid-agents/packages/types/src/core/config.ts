import type { AgentMeta } from '../a2a';

/**
 * Configuration for an agent instance.
 * Contains only the core agent metadata - extension configurations are managed by their respective runtimes.
 */
export type AgentConfig = {
  meta: AgentMeta;
};
