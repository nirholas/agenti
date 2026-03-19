/**
 * Security Shield Skill
 *
 * Commands:
 * /shield scan <code>                — Scan code for malicious patterns
 * /shield check <address>            — Check address safety (auto-detect chain)
 * /shield validate <dest> <amt> [token] — Pre-flight transaction check
 * /shield scams [chain]              — List known scam addresses
 * /shield status                     — Scanner statistics
 * /shield help                       — Show help
 */

const HELP = `Security Shield — Multi-chain security scanner

Usage:
  /shield scan <code>                    Scan code/plugin for malicious patterns
  /shield check <address>                Check address safety (auto-detect chain)
  /shield validate <dest> <amt> [token]  Pre-flight transaction validation
  /shield scams [solana|evm]             List known scam addresses
  /shield status                         Show scanner statistics
  /shield help                           Show this help

Examples:
  /shield scan "eval(atob('...'))"
  /shield check So11111111111111111111111111111111
  /shield check 0xdAC17F958D2ee523a2206206994597C13D831ec7
  /shield validate 0xABC...123 100 SOL
  /shield scams solana
  /shield status`;

function riskBar(score: number): string {
  const filled = Math.round(score / 10);
  const empty = 10 - filled;
  return '[' + '#'.repeat(filled) + '-'.repeat(empty) + ']';
}

function levelEmoji(level: string): string {
  switch (level) {
    case 'clean': return 'SAFE';
    case 'low': return 'LOW';
    case 'medium': return 'MEDIUM';
    case 'high': return 'HIGH';
    case 'critical': return 'CRITICAL';
    default: return level.toUpperCase();
  }
}

export default {
  name: 'shield',
  description: 'Security shield — code scanning, address checking, transaction validation, scam detection',
  commands: [
    { name: 'shield', description: 'Security shield scanner', usage: '/shield <subcommand> [args]' },
  ],
  async handle(args: string): Promise<string> {
    const trimmed = args.trim();
    if (!trimmed || trimmed === 'help') return HELP;

    const spaceIdx = trimmed.indexOf(' ');
    const subcommand = spaceIdx === -1 ? trimmed : trimmed.substring(0, spaceIdx);
    const rest = spaceIdx === -1 ? '' : trimmed.substring(spaceIdx + 1).trim();

    try {
      switch (subcommand.toLowerCase()) {
        case 'scan': return await handleScan(rest);
        case 'check': return await handleCheck(rest);
        case 'validate': return await handleValidate(rest);
        case 'scams': return await handleScams(rest);
        case 'status': return await handleStatus();
        default: return `Unknown subcommand: ${subcommand}\n\n${HELP}`;
      }
    } catch (err: any) {
      return `Shield error: ${err.message || err}`;
    }
  },
};

async function handleScan(code: string): Promise<string> {
  if (!code) return 'Please provide code to scan. Usage: /shield scan <code>';

  const { getSecurityShield } = await import('../../../security/shield.js');
  const shield = getSecurityShield();
  const result = shield.scanCode(code);

  const lines: string[] = [];
  lines.push('Code Security Scan');
  lines.push('='.repeat(40));
  lines.push(`Risk Score: ${result.score}/100 ${riskBar(result.score)} ${levelEmoji(result.level)}`);
  if (result.entropy !== undefined) {
    lines.push(`Entropy: ${result.entropy.toFixed(2)} bits/char`);
  }
  lines.push('');

  if (result.detections.length === 0) {
    lines.push('No threats detected.');
  } else {
    lines.push(`Detections (${result.detections.length}):`);
    for (const d of result.detections) {
      lines.push(`  [${d.category}] ${d.description} (weight: ${d.weight}${d.line ? `, line ${d.line}` : ''})`);
    }
  }

  return lines.join('\n');
}

async function handleCheck(address: string): Promise<string> {
  if (!address) return 'Please provide an address. Usage: /shield check <address>';

  const { getSecurityShield } = await import('../../../security/shield.js');
  const shield = getSecurityShield();
  const result = await shield.checkAddress(address);

  const lines: string[] = [];
  lines.push('Address Security Check');
  lines.push('='.repeat(40));
  lines.push(`Address: ${result.address}`);
  lines.push(`Chain: ${result.chain.toUpperCase()}`);
  lines.push(`Risk Score: ${result.riskScore}/100 ${riskBar(result.riskScore)} ${levelEmoji(result.level)}`);
  lines.push('');

  if (result.scamMatch) {
    lines.push(`SCAM MATCH: ${result.scamMatch.label}`);
    lines.push(`Type: ${result.scamMatch.type}`);
    lines.push('');
  }

  lines.push('Details:');
  lines.push(`  Exists: ${result.details.exists ? 'Yes' : 'No'}`);
  if (result.details.isContract !== undefined) lines.push(`  Contract: ${result.details.isContract ? 'Yes' : 'No'}`);
  if (result.details.balance !== undefined) lines.push(`  Balance: ${result.details.balance}`);
  if (result.details.ageEstimate) lines.push(`  Age: ${result.details.ageEstimate}`);
  if (result.details.txVelocity !== undefined) lines.push(`  Tx Velocity: ${result.details.txVelocity}/hr`);
  lines.push('');

  if (result.flags.length > 0) {
    lines.push('Flags:');
    for (const f of result.flags) {
      lines.push(`  - ${f}`);
    }
  }

  return lines.join('\n');
}

async function handleValidate(input: string): Promise<string> {
  if (!input) return 'Usage: /shield validate <destination> <amount> [token]';

  const parts = input.split(/\s+/);
  if (parts.length < 2) return 'Usage: /shield validate <destination> <amount> [token]';

  const destination = parts[0];
  const amount = parseFloat(parts[1]);
  const token = parts[2] || undefined;

  if (isNaN(amount)) return `Invalid amount: ${parts[1]}`;

  const { getSecurityShield } = await import('../../../security/shield.js');
  const shield = getSecurityShield();
  const result = await shield.validateTx({ destination, amount, token });

  const lines: string[] = [];
  lines.push('Transaction Validation');
  lines.push('='.repeat(40));
  lines.push(`Destination: ${destination}`);
  lines.push(`Amount: ${amount}${token ? ` ${token}` : ''}`);
  lines.push(`Risk Score: ${result.riskScore}/100 ${riskBar(result.riskScore)} ${levelEmoji(result.addressCheck?.level || 'clean')}`);
  lines.push(`Recommendation: ${result.recommendation.toUpperCase()}`);
  lines.push(`Allowed: ${result.allowed ? 'Yes' : 'NO — BLOCKED'}`);
  lines.push('');

  if (result.flags.length > 0) {
    lines.push('Flags:');
    for (const f of result.flags) {
      lines.push(`  - ${f}`);
    }
  }

  return lines.join('\n');
}

async function handleScams(filter: string): Promise<string> {
  const { getScamEntries } = await import('../../../security/scam-db.js');

  const chain = filter.toLowerCase() === 'solana' ? 'solana'
    : filter.toLowerCase() === 'evm' ? 'evm'
    : undefined;

  const entries = getScamEntries(chain as any);
  const lines: string[] = [];
  lines.push(`Known Scam Addresses${chain ? ` (${chain.toUpperCase()})` : ''}`);
  lines.push('='.repeat(40));
  lines.push(`Total: ${entries.length}`);
  lines.push('');

  // Group by type
  const byType = new Map<string, typeof entries>();
  for (const e of entries) {
    const arr = byType.get(e.type) || [];
    arr.push(e);
    byType.set(e.type, arr);
  }

  for (const [type, list] of byType) {
    lines.push(`${type} (${list.length}):`);
    for (const e of list.slice(0, 5)) {
      const short = e.address.length > 20 ? e.address.substring(0, 10) + '...' + e.address.slice(-6) : e.address;
      lines.push(`  ${short} — ${e.label} [${e.chain}]`);
    }
    if (list.length > 5) lines.push(`  ... and ${list.length - 5} more`);
    lines.push('');
  }

  return lines.join('\n');
}

async function handleStatus(): Promise<string> {
  const { getSecurityShield } = await import('../../../security/shield.js');
  const shield = getSecurityShield();
  const stats = shield.getStats();

  const lines: string[] = [];
  lines.push('Security Shield Status');
  lines.push('='.repeat(40));
  lines.push(`Code Scans:       ${stats.codeScans}`);
  lines.push(`Address Checks:   ${stats.addressChecks}`);
  lines.push(`Tx Validations:   ${stats.txValidations}`);
  lines.push(`Sanitizations:    ${stats.sanitizations}`);
  lines.push(`Threats Blocked:  ${stats.threatsBlocked}`);
  lines.push(`Scam DB Size:     ${stats.scamDbSize} entries`);

  return lines.join('\n');
}
