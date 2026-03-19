/**
 * Metrics CLI Skill
 *
 * Commands:
 * /metrics - Show key metrics summary
 * /metrics http - HTTP request metrics
 * /metrics feeds - Feed metrics
 * /metrics trading - Trading metrics
 * /metrics export - Full Prometheus export
 */

async function execute(args: string): Promise<string> {
  const parts = args.trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase() || 'summary';

  try {
    const { registry } = await import('../../../monitoring/metrics');
    const text = registry.toPrometheusText();

    switch (cmd) {
      case 'summary': {
        const lines = text.split('\n').filter((l: string) => !l.startsWith('#')).filter(Boolean).slice(0, 20);
        return `**Metrics Summary**\n\n\`\`\`\n${lines.join('\n')}\n\`\`\``;
      }

      case 'http':
      case 'feeds':
      case 'trading':
      case 'system': {
        const filtered = text.split('\n').filter((l: string) => l.includes(cmd) || l.startsWith('#'));
        return `**${cmd.charAt(0).toUpperCase() + cmd.slice(1)} Metrics**\n\n\`\`\`\n${filtered.slice(0, 30).join('\n')}\n\`\`\``;
      }

      case 'export':
      case 'prometheus':
        return `\`\`\`\n${text}\n\`\`\``;

      default:
        return helpText();
    }
  } catch (error) {
    return `Metrics error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function helpText(): string {
  return `**Metrics Commands**

  /metrics                           - Key metrics summary
  /metrics http                      - HTTP request metrics
  /metrics feeds                     - Feed connection metrics
  /metrics trading                   - Trading metrics
  /metrics system                    - System metrics (memory, CPU)
  /metrics export                    - Full Prometheus export`;
}

export default {
  name: 'metrics',
  description: 'Prometheus-compatible metrics, counters, gauges, and histograms',
  commands: ['/metrics'],
  handle: execute,
};
