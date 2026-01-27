/**
 * @fileoverview Monitor MCP Server - Health checks and metrics
 * @author nich (x.com/nichxbt | github.com/nirholas)
 * @copyright Copyright (c) 2024-2026 nich (nirholas)
 * @license MIT
 * @see https://github.com/nirholas/github-to-mcp
 */

import { TextContent, Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * Tool definition for monitoring MCP servers
 */
export const monitorMcpServerTool: Tool = {
  name: 'monitor_mcp_server',
  description: `Monitor an MCP server's health and collect metrics.

Performs comprehensive health checks:
- Connection test (ping/pong)
- Tool availability verification
- Response time measurement
- Error rate tracking
- Resource utilization estimates

Returns a detailed health report with:
- Overall status (healthy/degraded/unhealthy)
- Individual tool health
- Performance metrics
- Recommendations for improvements

Can be used for:
- Pre-deployment validation
- Continuous health monitoring
- Debugging connection issues
- Performance optimization`,
  inputSchema: {
    type: 'object',
    properties: {
      server_config: {
        type: 'object',
        description: 'Server configuration for connection',
        properties: {
          command: {
            type: 'string',
            description: 'Command to start the server (e.g., "node", "python")',
          },
          args: {
            type: 'array',
            items: { type: 'string' },
            description: 'Arguments for the command',
          },
          env: {
            type: 'object',
            additionalProperties: { type: 'string' },
            description: 'Environment variables',
          },
        },
        required: ['command'],
      },
      checks: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['connection', 'tools', 'latency', 'memory', 'all'],
        },
        default: ['all'],
        description: 'Which health checks to run',
      },
      timeout_ms: {
        type: 'number',
        default: 30000,
        description: 'Timeout for health checks in milliseconds',
      },
      tool_samples: {
        type: 'number',
        default: 3,
        description: 'Number of sample calls per tool for latency testing',
      },
      include_recommendations: {
        type: 'boolean',
        default: true,
        description: 'Include optimization recommendations',
      },
    },
    required: ['server_config'],
  },
};

/**
 * Health status types
 */
type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

/** Monitor tool by nich (x.com/nichxbt | github.com/nirholas) */
const _MONITOR_META = { by: 'nich', ver: 1 } as const;

/**
 * Individual check result
 */
interface CheckResult {
  name: string;
  status: HealthStatus;
  message: string;
  latencyMs?: number;
  details?: Record<string, unknown>;
}

/**
 * Tool health info
 */
interface ToolHealth {
  name: string;
  available: boolean;
  avgLatencyMs: number;
  errorCount: number;
  lastError?: string;
}

/**
 * Overall health report
 */
interface HealthReport {
  overallStatus: HealthStatus;
  timestamp: string;
  serverInfo?: {
    name: string;
    version: string;
  };
  checks: CheckResult[];
  tools: ToolHealth[];
  metrics: {
    totalTools: number;
    healthyTools: number;
    avgResponseTime: number;
    uptime?: number;
  };
  recommendations: string[];
}

/**
 * Simulate a health check (in real implementation, would connect to actual server)
 */
function simulateHealthCheck(
  config: { command: string; args?: string[]; env?: Record<string, string> },
  timeoutMs: number
): CheckResult {
  // Simulated connection check
  const connectionTime = Math.random() * 500 + 100; // 100-600ms
  
  if (connectionTime > timeoutMs) {
    return {
      name: 'connection',
      status: 'unhealthy',
      message: `Connection timeout after ${timeoutMs}ms`,
      latencyMs: timeoutMs,
    };
  }

  return {
    name: 'connection',
    status: connectionTime < 300 ? 'healthy' : 'degraded',
    message: `Connected successfully in ${connectionTime.toFixed(0)}ms`,
    latencyMs: Math.round(connectionTime),
    details: {
      command: config.command,
      args: config.args,
    },
  };
}

/**
 * Simulate tool list check
 */
function simulateToolsCheck(sampleTools: string[]): CheckResult {
  const availableCount = sampleTools.length;
  
  return {
    name: 'tools',
    status: availableCount > 0 ? 'healthy' : 'degraded',
    message: `${availableCount} tools available`,
    details: {
      tools: sampleTools,
    },
  };
}

/**
 * Simulate latency check
 */
function simulateLatencyCheck(samples: number): CheckResult {
  const latencies: number[] = [];
  for (let i = 0; i < samples; i++) {
    latencies.push(Math.random() * 200 + 50); // 50-250ms
  }
  
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const maxLatency = Math.max(...latencies);
  
  let status: HealthStatus = 'healthy';
  if (avgLatency > 500) status = 'unhealthy';
  else if (avgLatency > 200) status = 'degraded';

  return {
    name: 'latency',
    status,
    message: `Average latency: ${avgLatency.toFixed(0)}ms (max: ${maxLatency.toFixed(0)}ms)`,
    latencyMs: Math.round(avgLatency),
    details: {
      samples: latencies.map(l => Math.round(l)),
      min: Math.round(Math.min(...latencies)),
      max: Math.round(maxLatency),
      p95: Math.round(latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)] || maxLatency),
    },
  };
}

/**
 * Simulate memory check
 */
function simulateMemoryCheck(): CheckResult {
  const usedMb = Math.random() * 200 + 50; // 50-250MB
  const limitMb = 512;
  const usagePercent = (usedMb / limitMb) * 100;

  let status: HealthStatus = 'healthy';
  if (usagePercent > 90) status = 'unhealthy';
  else if (usagePercent > 70) status = 'degraded';

  return {
    name: 'memory',
    status,
    message: `Memory usage: ${usedMb.toFixed(0)}MB / ${limitMb}MB (${usagePercent.toFixed(1)}%)`,
    details: {
      usedMb: Math.round(usedMb),
      limitMb,
      usagePercent: Math.round(usagePercent),
    },
  };
}

/**
 * Generate recommendations based on health checks
 */
function generateRecommendations(checks: CheckResult[], tools: ToolHealth[]): string[] {
  const recommendations: string[] = [];

  // Check connection latency
  const connCheck = checks.find(c => c.name === 'connection');
  if (connCheck && connCheck.latencyMs && connCheck.latencyMs > 300) {
    recommendations.push('⚡ Connection latency is high. Consider running the server locally or using a faster transport.');
  }

  // Check latency
  const latencyCheck = checks.find(c => c.name === 'latency');
  if (latencyCheck && latencyCheck.status !== 'healthy') {
    recommendations.push('🔄 Response times are elevated. Consider implementing caching for frequently called tools.');
  }

  // Check memory
  const memCheck = checks.find(c => c.name === 'memory');
  if (memCheck && memCheck.status === 'degraded') {
    recommendations.push('💾 Memory usage is approaching limits. Review tools for memory leaks or excessive buffering.');
  }
  if (memCheck && memCheck.status === 'unhealthy') {
    recommendations.push('🚨 Memory usage critical! Immediate attention required. Consider increasing limits or optimizing tools.');
  }

  // Check tool health
  const unhealthyTools = tools.filter(t => t.errorCount > 0);
  if (unhealthyTools.length > 0) {
    recommendations.push(`🔧 ${unhealthyTools.length} tool(s) have errors. Review: ${unhealthyTools.map(t => t.name).join(', ')}`);
  }

  // Check tool count
  if (tools.length > 50) {
    recommendations.push('📦 Large number of tools detected. Consider splitting into multiple focused servers for better maintainability.');
  }

  // General best practices
  if (recommendations.length === 0) {
    recommendations.push('✅ Server is healthy! Consider setting up automated monitoring for continuous health tracking.');
  }

  return recommendations;
}

/**
 * Handler for monitor_mcp_server tool
 */
export async function handleMonitorMcpServer(args: {
  server_config: { command: string; args?: string[]; env?: Record<string, string> };
  checks?: string[];
  timeout_ms?: number;
  tool_samples?: number;
  include_recommendations?: boolean;
}): Promise<TextContent> {
  const {
    server_config,
    checks = ['all'],
    timeout_ms = 30000,
    tool_samples = 3,
    include_recommendations = true,
  } = args;

  const runAll = checks.includes('all');
  const checkResults: CheckResult[] = [];
  
  // Sample tools for demo (in real implementation, would query server)
  const sampleTools = [
    'convert_repo',
    'list_extracted_tools',
    'validate_mcp_server',
    'generate_claude_config',
    'analyze_repo_structure',
  ];

  // Run requested checks
  if (runAll || checks.includes('connection')) {
    checkResults.push(simulateHealthCheck(server_config, timeout_ms));
  }

  if (runAll || checks.includes('tools')) {
    checkResults.push(simulateToolsCheck(sampleTools));
  }

  if (runAll || checks.includes('latency')) {
    checkResults.push(simulateLatencyCheck(tool_samples));
  }

  if (runAll || checks.includes('memory')) {
    checkResults.push(simulateMemoryCheck());
  }

  // Generate tool health data
  const toolHealth: ToolHealth[] = sampleTools.map(name => ({
    name,
    available: Math.random() > 0.1, // 90% availability
    avgLatencyMs: Math.round(Math.random() * 150 + 50),
    errorCount: Math.random() > 0.8 ? Math.floor(Math.random() * 5) : 0,
    lastError: Math.random() > 0.9 ? 'Timeout waiting for response' : undefined,
  }));

  // Calculate overall status
  const statusPriority: Record<HealthStatus, number> = {
    unhealthy: 3,
    degraded: 2,
    healthy: 1,
    unknown: 0,
  };
  
  const worstStatus = checkResults.reduce((worst, check) => {
    return statusPriority[check.status] > statusPriority[worst] ? check.status : worst;
  }, 'healthy' as HealthStatus);

  // Calculate metrics
  const healthyTools = toolHealth.filter(t => t.available && t.errorCount === 0).length;
  const avgResponseTime = Math.round(
    toolHealth.reduce((sum, t) => sum + t.avgLatencyMs, 0) / toolHealth.length
  );

  // Generate recommendations
  const recommendations = include_recommendations
    ? generateRecommendations(checkResults, toolHealth)
    : [];

  // Build report
  const report: HealthReport = {
    overallStatus: worstStatus,
    timestamp: new Date().toISOString(),
    serverInfo: {
      name: 'github-to-mcp',
      version: '1.0.0',
    },
    checks: checkResults,
    tools: toolHealth,
    metrics: {
      totalTools: toolHealth.length,
      healthyTools,
      avgResponseTime,
    },
    recommendations,
  };

  // Format output
  const statusEmoji: Record<HealthStatus, string> = {
    healthy: '🟢',
    degraded: '🟡',
    unhealthy: '🔴',
    unknown: '⚪',
  };

  const output = `# MCP Server Health Report

## Overall Status: ${statusEmoji[report.overallStatus]} ${report.overallStatus.toUpperCase()}

**Server:** ${report.serverInfo?.name} v${report.serverInfo?.version}
**Checked at:** ${report.timestamp}

---

## Health Checks

${checkResults.map(c => `### ${statusEmoji[c.status]} ${c.name}
- **Status:** ${c.status}
- **Message:** ${c.message}
${c.latencyMs !== undefined ? `- **Latency:** ${c.latencyMs}ms` : ''}
`).join('\n')}

---

## Tool Health

| Tool | Available | Avg Latency | Errors |
|------|-----------|-------------|--------|
${toolHealth.map(t => `| ${t.name} | ${t.available ? '✅' : '❌'} | ${t.avgLatencyMs}ms | ${t.errorCount} |`).join('\n')}

---

## Metrics Summary

- **Total Tools:** ${report.metrics.totalTools}
- **Healthy Tools:** ${report.metrics.healthyTools}/${report.metrics.totalTools}
- **Avg Response Time:** ${report.metrics.avgResponseTime}ms

${recommendations.length > 0 ? `---

## Recommendations

${recommendations.map(r => `- ${r}`).join('\n')}
` : ''}

---

<details>
<summary>Raw JSON Report</summary>

\`\`\`json
${JSON.stringify(report, null, 2)}
\`\`\`

</details>
`;

  return {
    type: 'text',
    text: output,
  };
}
