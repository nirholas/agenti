/**
 * Routing CLI Skill
 *
 * Commands:
 * /agents - List available agents
 * /agent <id> - Switch to or view an agent
 * /agent status - Current agent info
 * /bind <agent> - Bind channel to agent
 * /unbind - Remove channel binding
 * /bindings - List all bindings
 * /tools - List available tools
 * /tools allow <agent> <tool> - Allow tool for agent
 * /tools deny <agent> <tool> - Deny tool for agent
 * /tools policy <agent> - View agent's tool policy
 */

import { createRoutingService, type RoutingService } from '../../../routing/index';

let service: RoutingService | null = null;

function getService(): RoutingService {
  if (!service) {
    service = createRoutingService();
  }
  return service;
}

function handleAgents(): string {
  const svc = getService();
  const agents = svc.getAgents();

  if (agents.length === 0) {
    return 'No agents configured.';
  }

  let output = `**Available Agents** (${agents.length})\n\n`;
  for (const agent of agents) {
    const status = agent.enabled ? 'enabled' : 'disabled';
    output += `**${agent.name}** (\`${agent.id}\`) - ${status}\n`;
    output += `  ${agent.description}\n`;
    if (agent.model) {
      output += `  Model: ${agent.model}\n`;
    }
    output += '\n';
  }
  return output;
}

function handleAgent(agentId: string): string {
  const svc = getService();
  const agent = svc.getAgent(agentId);

  if (!agent) {
    return `Agent \`${agentId}\` not found.\n\nUse \`/agents\` to list available agents.`;
  }

  let output = `**${agent.name}** (\`${agent.id}\`)\n\n`;
  output += `Description: ${agent.description}\n`;
  output += `Enabled: ${agent.enabled}\n`;
  if (agent.model) {
    output += `Model: ${agent.model}\n`;
  }
  if (agent.systemPrompt) {
    output += `\nSystem Prompt:\n\`\`\`\n${agent.systemPrompt.slice(0, 200)}${agent.systemPrompt.length > 200 ? '...' : ''}\n\`\`\`\n`;
  }

  const tools = svc.getAllowedTools(agent.id);
  if (tools) {
    output += `\nAllowed Tools: ${tools.join(', ')}\n`;
  } else {
    output += `\nAllowed Tools: All\n`;
  }

  return output;
}

function handleAgentStatus(): string {
  const svc = getService();
  const defaultAgent = svc.getDefaultAgent();
  return `**Current Agent:** ${defaultAgent.name} (\`${defaultAgent.id}\`)\n\n${defaultAgent.description}`;
}

function handleBindings(): string {
  const svc = getService();
  const bindings = svc.getBindings();

  if (bindings.length === 0) {
    return 'No bindings configured.';
  }

  let output = `**Routing Bindings** (${bindings.length})\n\n`;
  for (const binding of bindings) {
    const status = binding.enabled ? 'active' : 'inactive';
    output += `\`${binding.id}\` [${binding.type}] -> **${binding.agentId}** (priority: ${binding.priority}, ${status})\n`;
    output += `  Pattern: \`${binding.pattern}\`\n`;
    if (binding.channel) {
      output += `  Channel: ${binding.channel}\n`;
    }
  }
  return output;
}

function handleBind(agentId: string): string {
  const svc = getService();
  const agent = svc.getAgent(agentId);

  if (!agent) {
    return `Agent \`${agentId}\` not found.\n\nUse \`/agents\` to list available agents.`;
  }

  const bindingId = `channel-bind-${Date.now()}`;
  svc.addBinding({
    id: bindingId,
    type: 'channel',
    pattern: 'current',
    agentId,
    priority: 90,
    enabled: true,
  });

  return `Channel bound to **${agent.name}** agent.`;
}

function handleUnbind(): string {
  const svc = getService();
  const bindings = svc.getBindings().filter(b => b.type === 'channel' && b.id.startsWith('channel-bind-'));

  if (bindings.length === 0) {
    return 'No channel bindings to remove.';
  }

  for (const binding of bindings) {
    svc.removeBinding(binding.id);
  }

  return `Removed ${bindings.length} channel binding(s).`;
}

function handleTools(): string {
  const svc = getService();
  const agents = svc.getAgents();

  let output = '**Tool Policies by Agent**\n\n';
  for (const agent of agents) {
    const tools = svc.getAllowedTools(agent.id);
    output += `**${agent.name}** (\`${agent.id}\`):\n`;
    if (tools) {
      output += `  Allowed: ${tools.join(', ')}\n`;
    } else {
      output += `  Allowed: All tools\n`;
    }
    output += '\n';
  }
  return output;
}

function handleToolAllow(agentId: string, tool: string): string {
  const svc = getService();
  const agent = svc.getAgent(agentId);

  if (!agent) {
    return `Agent \`${agentId}\` not found.`;
  }

  const policy = agent.toolPolicy || { allow: [], deny: [] };
  if (!policy.allow) policy.allow = [];
  policy.allow.push(tool);

  // Remove from deny list if present
  if (policy.deny) {
    policy.deny = policy.deny.filter(t => t !== tool);
  }

  svc.updateAgent(agentId, { toolPolicy: policy });
  return `Tool \`${tool}\` is now **allowed** for agent \`${agentId}\`.`;
}

function handleToolDeny(agentId: string, tool: string): string {
  const svc = getService();
  const agent = svc.getAgent(agentId);

  if (!agent) {
    return `Agent \`${agentId}\` not found.`;
  }

  const policy = agent.toolPolicy || { allow: [], deny: [] };
  if (!policy.deny) policy.deny = [];
  policy.deny.push(tool);

  // Remove from allow list if present
  if (policy.allow) {
    policy.allow = policy.allow.filter(t => t !== tool);
  }

  svc.updateAgent(agentId, { toolPolicy: policy });
  return `Tool \`${tool}\` is now **denied** for agent \`${agentId}\`.`;
}

function handleToolPolicy(agentId: string): string {
  const svc = getService();
  const agent = svc.getAgent(agentId);

  if (!agent) {
    return `Agent \`${agentId}\` not found.`;
  }

  const policy = agent.toolPolicy;
  if (!policy) {
    return `Agent \`${agentId}\` has no tool policy (all tools allowed).`;
  }

  let output = `**Tool Policy for ${agent.name}**\n\n`;
  if (policy.allow?.length) {
    output += `Allowed: ${policy.allow.join(', ')}\n`;
  }
  if (policy.deny?.length) {
    output += `Denied: ${policy.deny.join(', ')}\n`;
  }
  if (policy.allowGroups?.length) {
    output += `Allowed Groups: ${policy.allowGroups.join(', ')}\n`;
  }
  if (policy.denyGroups?.length) {
    output += `Denied Groups: ${policy.denyGroups.join(', ')}\n`;
  }
  output += `Confirm Dangerous: ${policy.confirmDangerous ? 'Yes' : 'No'}\n`;

  return output;
}

export async function execute(args: string): Promise<string> {
  const parts = args.trim().split(/\s+/);
  const command = parts[0]?.toLowerCase() || 'help';
  const rest = parts.slice(1);

  switch (command) {
    case 'agents':
      return handleAgents();

    case 'agent':
      if (!rest[0] || rest[0] === 'status') return handleAgentStatus();
      return handleAgent(rest[0]);

    case 'bind':
      if (!rest[0]) return 'Usage: /routing bind <agentId>';
      return handleBind(rest[0]);

    case 'unbind':
      return handleUnbind();

    case 'bindings':
      return handleBindings();

    case 'tools':
      if (!rest[0]) return handleTools();
      if (rest[0] === 'allow' && rest[1] && rest[2]) return handleToolAllow(rest[1], rest[2]);
      if (rest[0] === 'deny' && rest[1] && rest[2]) return handleToolDeny(rest[1], rest[2]);
      if (rest[0] === 'policy' && rest[1]) return handleToolPolicy(rest[1]);
      return 'Usage: /routing tools [allow|deny|policy] [agent] [tool]';

    case 'help':
    default:
      return `**Routing Commands**

**Agents:**
  /routing agents                       List available agents
  /routing agent <id>                   View agent details
  /routing agent status                 Current agent info

**Bindings:**
  /routing bind <agent>                 Bind channel to agent
  /routing unbind                       Remove channel binding
  /routing bindings                     List all bindings

**Tool Policies:**
  /routing tools                        List all tool policies
  /routing tools allow <agent> <tool>   Allow tool for agent
  /routing tools deny <agent> <tool>    Deny tool for agent
  /routing tools policy <agent>         View agent's tool policy

**Examples:**
  /routing agent trading
  /routing bind research
  /routing tools allow trading futures`;
  }
}

export default {
  name: 'routing',
  description: 'Multi-agent routing, channel bindings, and tool policies',
  commands: ['/routing', '/agents', '/agent', '/bind', '/unbind', '/bindings'],
  handle: execute,
};
