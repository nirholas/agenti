import fs from 'fs';

// ERC-8004 standard metadata — follows https://best-practices.8004scan.io/docs/01-agent-metadata-standard
export interface AgentMetadata {
  type: string;  // "https://eips.ethereum.org/EIPS/eip-8004#registration-v1"
  name: string;
  description: string;
  image?: string;
  services: ServiceEntry[];
  active: boolean;
  x402Support: boolean;
  supportedTrust: string[];
  updatedAt: number;  // unix timestamp
  registrations?: { agentId: number; agentRegistry: string }[];
  // Extension: anet stack info (namespaced under "ext")
  ext?: {
    stack: string;       // "anet"
    version: string;
    features: string[];
  };
}

export interface ServiceEntry {
  name: string;      // "MCP", "A2A", "XMTP", "web", "x402", etc.
  endpoint: string;
  version?: string;
}

// anet protocol constants
export const ANET_PROTOCOL = {
  stack: 'anet',
  version: '0.2.0',
  features: ['skills', 'friends', 'rooms', 'hooks', 'auto-reputation'],
} as const;

export const ERC8004_TYPE = 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1';

export function buildAgentMetadata(config: {
  name: string;
  description: string;
  walletAddress: string;
  agentId?: number;
  chainId?: number;
  httpEndpoint?: string;
  mcpEndpoint?: string;
  a2aEndpoint?: string;
  xmtpEnv?: 'production' | 'dev';
  x402Support?: boolean;
  image?: string;
  anetCompatible?: boolean;
}): AgentMetadata {
  const services: ServiceEntry[] = [];

  // XMTP — declare the wallet address and network env so others know we're reachable
  services.push({
    name: 'XMTP',
    endpoint: config.walletAddress,
    version: config.xmtpEnv || 'production',
  });

  if (config.httpEndpoint) {
    services.push({ name: 'web', endpoint: config.httpEndpoint });
  }
  if (config.mcpEndpoint) {
    services.push({ name: 'MCP', endpoint: config.mcpEndpoint, version: '2025-06-18' });
  }
  if (config.a2aEndpoint) {
    services.push({ name: 'A2A', endpoint: config.a2aEndpoint, version: '0.3.0' });
  }

  const metadata: AgentMetadata = {
    type: ERC8004_TYPE,
    name: config.name,
    description: config.description,
    services,
    active: true,
    x402Support: config.x402Support ?? false,
    supportedTrust: ['reputation'],
    updatedAt: Math.floor(Date.now() / 1000),
  };

  if (config.image) {
    metadata.image = config.image;
  }

  // Cross-reference registration for bidirectional verification
  if (config.agentId && config.chainId) {
    const registry = config.chainId === 8453
      ? '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432'
      : '0x8004A818BFB912233c491871b3d84c89A494BD9e';
    metadata.registrations = [{
      agentId: config.agentId,
      agentRegistry: `eip155:${config.chainId}:${registry}`,
    }];
  }

  // Tag as anet-compatible
  if (config.anetCompatible !== false) {
    metadata.ext = { stack: ANET_PROTOCOL.stack, version: ANET_PROTOCOL.version, features: [...ANET_PROTOCOL.features] };
  }

  return metadata;
}

// Encode metadata as a data: URI for on-chain storage
export function toDataURI(metadata: AgentMetadata): string {
  const json = JSON.stringify(metadata);
  const encoded = Buffer.from(json).toString('base64');
  return `data:application/json;base64,${encoded}`;
}

// Reputation metrics — infrastructure-grade, not subjective
export interface ReputationMetrics {
  reachable: boolean;
  uptime: number;         // percentage (0-100)
  responseTime: number;   // milliseconds
  successRate: number;    // percentage (0-100)
  overall: number;        // computed (0-100)
}

export function computeReputationScore(metrics: Partial<ReputationMetrics>): number {
  const weights = { successRate: 0.4, uptime: 0.3, responseTime: 0.2, reachable: 0.1 };
  let score = 0;

  if (metrics.successRate != null) score += (metrics.successRate / 100) * weights.successRate * 100;
  if (metrics.uptime != null) score += (metrics.uptime / 100) * weights.uptime * 100;
  if (metrics.responseTime != null) {
    const rtScore = Math.max(0, 1 - (metrics.responseTime / 5000));
    score += rtScore * weights.responseTime * 100;
  }
  if (metrics.reachable != null) score += (metrics.reachable ? 1 : 0) * weights.reachable * 100;

  return Math.round(score);
}

// Detection helpers
export function isAnetCompatible(metadata: any): boolean {
  return metadata?.ext?.stack === 'anet';
}

export function getAnetVersion(metadata: any): string | null {
  return metadata?.ext?.version || null;
}

export function hasService(metadata: any, serviceName: string): boolean {
  return metadata?.services?.some((s: any) => s.name?.toLowerCase() === serviceName.toLowerCase()) ?? false;
}

export function getService(metadata: any, serviceName: string): ServiceEntry | null {
  return metadata?.services?.find((s: any) => s.name?.toLowerCase() === serviceName.toLowerCase()) || null;
}

/**
 * Build ERC-8004 metadata from skills config + agent settings.
 * Used by `anet up` to generate on-chain metadata from skills.yaml.
 */
export function buildMetadataFromSkills(opts: {
  name: string;
  description: string;
  walletAddress: string;
  skills: { name: string; description: string; price?: string; tags?: string[] }[];
  agentId?: number;
  chainId?: number;
  httpEndpoint?: string;
  xmtpEnv?: 'production' | 'dev';
}): AgentMetadata {
  const services: ServiceEntry[] = [];

  // XMTP — always present
  services.push({
    name: 'XMTP',
    endpoint: opts.walletAddress,
    version: opts.xmtpEnv || 'production',
  });

  // HTTP endpoint
  if (opts.httpEndpoint) {
    services.push({ name: 'web', endpoint: opts.httpEndpoint });
  }

  // Each skill becomes a service entry
  for (const skill of opts.skills) {
    services.push({
      name: skill.name,
      endpoint: opts.httpEndpoint ? `${opts.httpEndpoint}/api/${skill.name}` : `/api/${skill.name}`,
      version: skill.price || 'free',
    });
  }

  // Build capabilities from skill names + tags
  const capabilities = new Set<string>();
  for (const skill of opts.skills) {
    capabilities.add(skill.name);
    if (skill.tags) {
      for (const tag of skill.tags) capabilities.add(tag);
    }
  }

  const metadata: AgentMetadata = {
    type: ERC8004_TYPE,
    name: opts.name,
    description: opts.description,
    services,
    active: true,
    x402Support: opts.skills.some(s => s.price),
    supportedTrust: ['reputation'],
    updatedAt: Math.floor(Date.now() / 1000),
  };

  if (opts.agentId && opts.chainId) {
    const registry = opts.chainId === 8453
      ? '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432'
      : '0x8004A818BFB912233c491871b3d84c89A494BD9e';
    metadata.registrations = [{
      agentId: opts.agentId,
      agentRegistry: `eip155:${opts.chainId}:${registry}`,
    }];
  }

  metadata.ext = {
    stack: ANET_PROTOCOL.stack,
    version: ANET_PROTOCOL.version,
    features: [...ANET_PROTOCOL.features, ...capabilities],
  };

  return metadata;
}

export function validateMetadata(metadata: AgentMetadata): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!metadata.type || metadata.type !== ERC8004_TYPE) errors.push('type must be ERC-8004 registration-v1');
  if (!metadata.name || metadata.name.length < 3) errors.push('name required (3+ chars)');
  if (!metadata.description || metadata.description.length < 20) errors.push('description required (20+ chars)');
  if (!metadata.services?.length) errors.push('at least one service required');

  return { valid: errors.length === 0, errors };
}

export function saveMetadata(metadata: AgentMetadata, filePath: string): void {
  fs.writeFileSync(filePath, JSON.stringify(metadata, null, 2));
}

export function loadMetadata(filePath: string): AgentMetadata {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
