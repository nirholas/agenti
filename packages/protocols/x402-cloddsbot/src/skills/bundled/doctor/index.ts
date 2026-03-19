/**
 * Doctor CLI Skill
 *
 * Commands:
 * /doctor - Run full system diagnostics
 * /doctor <component> - Run specific check (system|node|network|channels|mcp|dependencies)
 * /doctor quick - Run critical checks only (node version, network)
 * /health, /status - Aliases for /doctor
 */

// Map user-facing component names to internal check names
const COMPONENT_MAP: Record<string, string[]> = {
  system: ['os', 'memory', 'diskSpace', 'configDir'],
  node: ['nodeVersion'],
  network: ['internet', 'anthropicApi'],
  channels: ['configDir'],           // channels use config dir
  mcp: ['configDir', 'nodeVersion'], // MCP depends on config + node
  dependencies: ['git', 'python', 'docker', 'macosPermissions'],
};

const QUICK_CHECKS = ['nodeVersion', 'internet'];

async function execute(args: string): Promise<string> {
  const parts = args.trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase() || 'full';

  try {
    const { runDoctor, getCheckNames } = await import('../../../doctor/index');
    const allCheckNames = getCheckNames();

    let categories: string[] | undefined;
    let title = 'System Diagnostics';

    if (cmd === 'quick') {
      categories = QUICK_CHECKS.filter(c => allCheckNames.includes(c));
      title = 'Quick Health Check';
    } else if (cmd in COMPONENT_MAP) {
      categories = COMPONENT_MAP[cmd].filter(c => allCheckNames.includes(c));
      title = `Diagnostics: ${cmd}`;
    } else if (cmd === 'full' || cmd === 'all' || cmd === '') {
      // Run all checks (no category filter)
      categories = undefined;
    } else {
      // Check if the arg matches an actual internal check name
      if (allCheckNames.includes(cmd)) {
        categories = [cmd];
        title = `Diagnostics: ${cmd}`;
      } else {
        // Unknown argument - show help and run full
        categories = undefined;
      }
    }

    const options = categories ? { categories } : {};
    const report = await runDoctor(options);
    let output = `**${title}**\n\n`;

    for (const check of report.checks) {
      const icon = check.status === 'pass' ? '[OK]' : check.status === 'warn' ? '[WARN]' : check.status === 'fail' ? '[FAIL]' : '[SKIP]';
      output += `${icon} ${check.name}`;
      if (check.message) output += ` - ${check.message}`;
      output += '\n';
    }

    output += `\n${report.summary.passed} passed, ${report.summary.warnings} warnings, ${report.summary.failed} failed, ${report.summary.skipped} skipped`;
    if (report.healthy) {
      output += '\nSystem is healthy.';
    } else {
      output += '\nIssues detected.';
    }

    return output;
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export default {
  name: 'doctor',
  description: 'System health diagnostics and troubleshooting',
  commands: ['/doctor', '/diag', '/health', '/status'],
  handle: execute,
};
