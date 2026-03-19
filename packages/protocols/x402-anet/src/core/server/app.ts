import express from 'express';
import axios from 'axios';
import { execSync } from 'child_process';
import { config } from '../../config.js';
import { authMiddleware } from '../auth/middleware.js';
import { createPaymentMiddleware } from '../payments/server.js';
import { AgentIndexer } from '../discovery/indexer.js';
import { searchAgents, getTopAgents } from '../discovery/search.js';
import type { SkillDefinition } from '../../skills/types.js';

export interface ServerOptions {
  walletAddress: string;
  indexer: AgentIndexer;
  agentId?: string;
  agentName?: string;
  skills?: SkillDefinition[];
  serviceHandlers?: Record<string, (req: express.Request, res: express.Response) => Promise<void>>;
}

export function createApp(options: ServerOptions): express.Express {
  const app = express();
  app.use(express.json());

  const skills = options.skills || [];
  const agentName = options.agentName || config.agentName;
  const paidSkills = skills.filter(s => s.price);

  // X402 Payment middleware — dynamic routes from skills with prices
  if (paidSkills.length > 0) {
    const routes: Record<string, { price: string; network: string }> = {};
    for (const skill of paidSkills) {
      const method = skill.method || 'POST';
      routes[`${method} /api/${skill.name}`] = {
        price: skill.price!,
        network: `base-${config.network}`,
      };
    }
    app.use(createPaymentMiddleware(options.walletAddress, routes));
  }

  // ERC-8128 Auth middleware — protect only paid skill routes (free skills are open)
  const paidSkillRoutes = paidSkills.map(s => `${s.method || 'POST'} /api/${s.name}`);
  if (paidSkillRoutes.length > 0) {
    app.use(authMiddleware({ protectedRoutes: paidSkillRoutes }));
  }

  // Health check
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      agent: agentName,
      network: config.network,
      timestamp: new Date().toISOString(),
    });
  });

  // Agent info — dynamic from skills
  app.get('/api/info', (_req, res) => {
    const skillInfo = skills.map(s => ({
      name: s.name,
      description: s.description,
      price: s.price || 'free',
      method: s.method || 'POST',
      endpoint: `/api/${s.name}`,
    }));

    res.json({
      name: agentName,
      address: options.walletAddress,
      network: config.network,
      chainId: config.chainId,
      skills: skillInfo,
      authentication: 'ERC-8128 (Ethereum-signed HTTP requests)',
      payment: 'X402 (HTTP 402 payment flow, USDC on Base)',
      messaging: {
        protocol: 'XMTP',
        address: options.walletAddress,
      },
      registry: {
        standard: 'ERC-8004',
        contract: config.identityRegistryAddress,
        agentId: options.agentId,
      },
      agentCount: options.indexer.getAgentCount(),
    });
  });

  // Register dynamic skill routes
  for (const skill of skills) {
    const method = (skill.method || 'POST').toLowerCase() as 'get' | 'post';
    const path = `/api/${skill.name}`;

    app[method](path, async (req, res) => {
      // Check for programmatic handler first
      const handler = options.serviceHandlers?.[skill.name];
      if (handler) return handler(req, res);

      // Route by handler type
      switch (skill.handler) {
        case 'webhook': {
          if (!skill.webhook) {
            return res.status(500).json({ error: 'Webhook URL not configured' });
          }
          try {
            const resp = await axios({
              method: req.method as any,
              url: skill.webhook,
              data: req.body,
              headers: {
                'content-type': 'application/json',
                'x-signer-address': req.signerAddress || '',
              },
              timeout: 30000,
            });
            res.status(resp.status).json(resp.data);
          } catch (e: any) {
            const status = e.response?.status || 502;
            res.status(status).json({ error: 'Webhook failed', detail: e.message });
          }
          break;
        }

        case 'script': {
          if (!skill.script) {
            return res.status(500).json({ error: 'Script path not configured' });
          }
          try {
            const output = execSync(skill.script, {
              input: JSON.stringify(req.body),
              encoding: 'utf8',
              timeout: 30000,
            });
            try {
              res.json(JSON.parse(output));
            } catch {
              res.json({ status: 'ok', output: output.trim() });
            }
          } catch (e: any) {
            res.status(500).json({ error: 'Script failed', detail: e.message });
          }
          break;
        }

        case 'placeholder':
        default: {
          res.json({
            status: 'ok',
            skill: skill.name,
            description: skill.description,
            signer: req.signerAddress,
            timestamp: new Date().toISOString(),
          });
          break;
        }
      }
    });
  }

  // Discovery endpoints
  app.get('/api/agents', (req, res) => {
    const { capability, minRep, limit } = req.query;
    const agents = searchAgents(options.indexer, {
      capability: capability as string,
      minReputation: minRep ? Number(minRep) : undefined,
      limit: limit ? Number(limit) : 20,
    });

    res.json({
      count: agents.length,
      agents: agents.map(a => ({
        id: a.agent_id,
        name: a.name,
        description: a.description,
        capabilities: a.capabilities,
        reputation: a.reputation,
        endpoints: { xmtp: a.xmtp_address, http: a.http_endpoint },
      })),
    });
  });

  app.get('/api/agents/top', (req, res) => {
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const agents = getTopAgents(options.indexer, limit);
    res.json({ agents });
  });

  app.get('/api/agents/:id', (req, res) => {
    const agent = options.indexer.getAgent(Number(req.params.id));
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    res.json(agent);
  });

  return app;
}
