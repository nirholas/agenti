/**
 * Opportunity Finder CLI Skill
 *
 * Commands:
 * /opportunities scan [query] - Scan for cross-platform arbitrage
 * /opportunities active - View active opportunities
 * /opportunities realtime start|stop|status - Real-time monitoring
 * /opportunities link <a> <b> - Link equivalent markets
 * /opportunities unlink <a> <b> - Remove link
 * /opportunities links - View all linked markets
 * /opportunities execute <id> [--size N] - Execute an opportunity
 * /opportunities mark-taken <id> - Mark as taken
 * /opportunities stats [--period Nd] - Performance statistics
 * /opportunities history - Past opportunities
 * /opportunities risk <id> - Model execution risk
 * /opportunities kelly <id> - Calculate Kelly fraction
 */

import {
  createOpportunityFinder,
  OpportunityFinder,
  Opportunity,
} from '../../../opportunity/index';
import { logger } from '../../../utils/logger';

let finder: OpportunityFinder | null = null;

function formatOpportunity(opp: Opportunity): string {
  let output = `**${opp.type.replace('_', ' ').toUpperCase()}** (Score: ${opp.score}/100)\n`;
  output += `  ID: \`${opp.id.slice(0, 40)}\`\n`;
  output += `  Edge: ${opp.edgePct.toFixed(2)}%\n`;
  output += `  Profit per $100: $${opp.profitPer100.toFixed(2)}\n`;
  output += `  Liquidity: $${opp.totalLiquidity.toLocaleString()}\n`;
  output += `  Confidence: ${(opp.confidence * 100).toFixed(0)}%\n`;
  if (opp.kellyFraction > 0) {
    output += `  Kelly: ${(opp.kellyFraction * 100).toFixed(1)}%\n`;
  }

  for (const m of opp.markets) {
    output += `  ${m.platform}: ${m.action.toUpperCase()} ${m.outcome} @ ${(m.price * 100).toFixed(1)}c\n`;
    output += `    "${m.question.slice(0, 60)}${m.question.length > 60 ? '...' : ''}"\n`;
  }

  if (opp.matchVerification) {
    output += `  Match: ${opp.matchVerification.method} (${(opp.matchVerification.similarity * 100).toFixed(0)}%)\n`;
    if (opp.matchVerification.warnings?.length) {
      output += `  Warnings: ${opp.matchVerification.warnings.join('; ')}\n`;
    }
  }

  output += `  Status: ${opp.status}\n`;
  return output;
}

async function handleScan(query?: string, flags?: Record<string, string>): Promise<string> {
  if (!finder) return 'Opportunity finder not initialized. Platform API keys required (POLY_API_KEY or KALSHI_API_KEY).';

  try {
    const minEdge = flags?.['min-edge'] ? parseFloat(flags['min-edge']) : undefined;
    const minLiquidity = flags?.['min-liquidity'] ? parseFloat(flags['min-liquidity']) : undefined;

    const opps = await finder.scan({
      query: query || undefined,
      minEdge,
      minLiquidity,
      limit: 20,
    });

    if (opps.length === 0) {
      return 'No opportunities found matching criteria.';
    }

    let output = `**Opportunities Found** (${opps.length})\n\n`;
    for (const opp of opps) {
      output += formatOpportunity(opp) + '\n';
    }
    return output;
  } catch (error) {
    return `Error scanning: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function handleActive(sortBy?: string): Promise<string> {
  if (!finder) return 'Opportunity finder not initialized.';

  const active = finder.getActive();
  if (active.length === 0) {
    return 'No active opportunities. Run `/opportunities scan` to find some.';
  }

  const sorted = [...active];
  if (sortBy === 'edge') sorted.sort((a, b) => b.edgePct - a.edgePct);
  else if (sortBy === 'liquidity') sorted.sort((a, b) => b.totalLiquidity - a.totalLiquidity);
  else sorted.sort((a, b) => b.score - a.score);

  let output = `**Active Opportunities** (${sorted.length})\n\n`;
  for (const opp of sorted) {
    output += formatOpportunity(opp) + '\n';
  }
  return output;
}

async function handleRealtime(action: string): Promise<string> {
  if (!finder) return 'Opportunity finder not initialized.';

  switch (action) {
    case 'start':
      await finder.startRealtime();
      return 'Real-time opportunity scanning started.';
    case 'stop':
      finder.stopRealtime();
      return 'Real-time opportunity scanning stopped.';
    case 'status': {
      const active = finder.getActive();
      return `**Real-time Status**\n\nActive opportunities: ${active.length}`;
    }
    default:
      return 'Usage: /opportunities realtime start|stop|status';
  }
}

async function handleLink(marketA: string, marketB: string): Promise<string> {
  if (!finder) return 'Opportunity finder not initialized.';
  if (!marketA || !marketB) return 'Usage: /opportunities link <market-a> <market-b>';

  finder.linkMarkets(marketA, marketB);
  return `Markets linked: ${marketA} <-> ${marketB}`;
}

async function handleUnlink(marketA: string, marketB: string): Promise<string> {
  if (!finder) return 'Opportunity finder not initialized.';
  if (!marketA || !marketB) return 'Usage: /opportunities unlink <market-a> <market-b>';

  finder.unlinkMarkets(marketA, marketB);
  return `Markets unlinked: ${marketA} <-> ${marketB}`;
}

async function handleStats(period?: string): Promise<string> {
  if (!finder) return 'Opportunity finder not initialized.';

  const days = period ? parseInt(period.replace('d', '')) : 30;
  const stats = finder.getAnalytics({ days: isNaN(days) ? 30 : days });

  let output = `**Opportunity Statistics** (${days}d)\n\n`;
  output += `Total found: ${stats.totalFound}\n`;
  output += `Taken: ${stats.taken}\n`;
  output += `Win rate: ${stats.winRate.toFixed(1)}%\n`;
  output += `Total profit: $${stats.totalProfit.toLocaleString()}\n`;
  output += `Avg edge: ${stats.avgEdge.toFixed(2)}%\n`;

  if (stats.bestPlatformPair) {
    output += `\nBest pair: ${stats.bestPlatformPair.platforms.join(' <-> ')}\n`;
    output += `  Win rate: ${stats.bestPlatformPair.winRate.toFixed(1)}%\n`;
    output += `  Profit: $${stats.bestPlatformPair.profit.toLocaleString()}\n`;
  }

  return output;
}

async function handleMarkTaken(id: string): Promise<string> {
  if (!finder) return 'Opportunity finder not initialized.';
  if (!id) return 'Usage: /opportunities mark-taken <id>';

  finder.markTaken(id);
  return `Opportunity ${id.slice(0, 30)}... marked as taken.`;
}

async function handleRisk(id: string): Promise<string> {
  if (!finder) return 'Opportunity finder not initialized.';
  if (!id) return 'Usage: /opportunities risk <id>';

  const opp = finder.get(id);
  if (!opp) return `Opportunity ${id} not found.`;

  const risk = finder.modelRisk(opp, 100) as unknown as Record<string, number>;

  let output = `**Risk Model: ${id.slice(0, 30)}...**\n\n`;
  output += `Fill probability: ${((risk.fillProbability ?? 0) * 100).toFixed(0)}%\n`;
  output += `Expected slippage: ${(risk.expectedSlippage ?? 0).toFixed(2)}%\n`;
  output += `Net expected edge: ${(risk.netExpectedEdge ?? 0).toFixed(2)}%\n`;
  output += `Recommended size: $${(risk.recommendedSize ?? 0).toFixed(2)}\n`;
  output += `Risk level: ${risk.riskLevel}\n`;

  return output;
}

function parseFlags(parts: string[]): { args: string[]; flags: Record<string, string> } {
  const args: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].startsWith('--')) {
      const key = parts[i].slice(2);
      flags[key] = parts[i + 1] || 'true';
      i++;
    } else {
      args.push(parts[i]);
    }
  }
  return { args, flags };
}

export async function execute(args: string): Promise<string> {
  const parts = args.trim().split(/\s+/);
  const command = parts[0]?.toLowerCase() || 'help';
  const rest = parts.slice(1);
  const { args: restArgs, flags } = parseFlags(rest);

  if (!finder) {
    try {
      const { createDatabase } = await import('../../../db/index');
      const { createFeedManager } = await import('../../../feeds/index');
      const db = createDatabase();
      const feeds = await createFeedManager({} as any);
      finder = createOpportunityFinder(db, feeds);
    } catch { /* leave null if dependencies missing */ }
  }

  switch (command) {
    case 'scan':
    case 'search':
      return handleScan(restArgs.join(' ') || undefined, flags);

    case 'active':
      return handleActive(flags.sort);

    case 'realtime':
      return handleRealtime(restArgs[0] || '');

    case 'link':
      return handleLink(restArgs[0], restArgs[1]);

    case 'unlink':
      return handleUnlink(restArgs[0], restArgs[1]);

    case 'links': {
      if (!finder) return 'Opportunity finder not initialized.';
      const pairs = finder.getPlatformPairs();
      if (pairs.length === 0) return 'No linked platform pairs.';
      let output = '**Platform Pairs**\n\n';
      for (const pair of pairs) {
        output += `${pair.platforms.join(' <-> ')}: ${pair.count} opportunities, avg edge ${pair.avgEdge.toFixed(2)}%\n`;
      }
      return output;
    }

    case 'execute':
      if (!restArgs[0]) return 'Usage: /opportunities execute <id> [--size N]';
      return `Execution not available in CLI mode. Use the TypeScript API to execute opportunity ${restArgs[0]}.`;

    case 'mark-taken':
      return handleMarkTaken(restArgs[0]);

    case 'record-outcome':
      if (!finder) return 'Opportunity finder not initialized.';
      if (restArgs.length < 2) return 'Usage: /opportunities record-outcome <id> <pnl>';
      finder.recordOutcome(restArgs[0], {
        taken: true,
        realizedPnL: parseFloat(restArgs[1]),
        closedAt: new Date(),
      });
      return `Outcome recorded for ${restArgs[0].slice(0, 30)}...`;

    case 'stats':
      return handleStats(flags.period || restArgs[0]);

    case 'history':
      return handleStats('30d');

    case 'by-platform':
    case 'by-type':
      return handleStats();

    case 'risk':
      return handleRisk(restArgs[0]);

    case 'estimate':
    case 'kelly':
      if (!finder) return 'Opportunity finder not initialized.';
      if (!restArgs[0]) return `Usage: /opportunities ${command} <id>`;
      const opp = finder.get(restArgs[0]);
      if (!opp) return `Opportunity ${restArgs[0]} not found.`;
      return `Kelly fraction: ${(opp.kellyFraction * 100).toFixed(1)}%\nRecommended size: $${(opp.kellyFraction * 1000).toFixed(2)} per $1000 bankroll`;

    case 'auto-match':
      return 'Auto-matching requires the embeddings service. Use `/opportunities scan` for standard matching.';

    case 'help':
    default:
      return `**Opportunity Finder Commands**

**Scanning:**
  /opportunities scan [query]              - Scan for opportunities
  /opportunities scan --min-edge 2         - Min 2% edge
  /opportunities scan --min-liquidity 1000 - Min $1000 liquidity
  /opportunities active [--sort edge|liquidity] - View active

**Real-Time:**
  /opportunities realtime start            - Start continuous scanning
  /opportunities realtime stop             - Stop scanning
  /opportunities realtime status           - Check status

**Market Linking:**
  /opportunities link <a> <b>              - Link markets
  /opportunities unlink <a> <b>            - Remove link
  /opportunities links                     - View linked pairs

**Execution:**
  /opportunities execute <id> [--size N]   - Execute opportunity
  /opportunities mark-taken <id>           - Mark as taken
  /opportunities record-outcome <id> <pnl> - Record P&L

**Analytics:**
  /opportunities stats [--period 7d]       - Statistics
  /opportunities history                   - Past opportunities

**Risk:**
  /opportunities risk <id>                 - Model risk
  /opportunities kelly <id>                - Kelly fraction`;
  }
}

export default {
  name: 'opportunity',
  description: 'Find and execute cross-platform arbitrage opportunities across prediction markets',
  commands: ['/opportunities', '/opportunity', '/opp'],
  handle: execute,
};
