/**
 * Analytics CLI Skill
 *
 * Commands:
 * /analytics - View opportunity analytics summary
 * /analytics stats [--period Nd] - Performance statistics
 * /analytics platforms - Platform pair performance
 * /analytics opportunities [--type X] - Browse opportunities
 */

import type { Database } from '../../../db/index';

async function execute(args: string): Promise<string> {
  const parts = args.trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase() || 'summary';

  try {
    const { createOpportunityAnalytics } = await import('../../../opportunity/analytics');
    const { createDatabase } = await import('../../../db/index');
    const db: Database = createDatabase();
    const analytics = createOpportunityAnalytics(db);

    switch (cmd) {
      case 'summary':
      case 'stats': {
        const periodFlag = parts.find((p: string) => p.match(/^\d+d$/));
        const days = periodFlag ? parseInt(periodFlag, 10) : 30;
        const stats = analytics.getStats({ days });
        let output = `**Opportunity Analytics** (${days}d)\n\n`;
        output += `Total found: ${stats.totalFound}\n`;
        output += `Taken: ${stats.taken}\n`;
        output += `Win rate: ${stats.winRate.toFixed(1)}%\n`;
        output += `Total profit: $${stats.totalProfit.toLocaleString()}\n`;
        output += `Avg edge: ${stats.avgEdge.toFixed(2)}%\n`;
        return output;
      }

      case 'today': {
        const stats = analytics.getStats({ days: 1 });
        let output = `**Today's Performance**\n\n`;
        output += `Opportunities found: ${stats.totalFound}\n`;
        output += `Taken: ${stats.taken}\n`;
        output += `Win rate: ${stats.winRate.toFixed(1)}%\n`;
        output += `Profit: $${stats.totalProfit.toLocaleString()}\n`;
        output += `Avg edge: ${stats.avgEdge.toFixed(2)}%\n`;
        if (stats.bestPlatformPair) {
          output += `\nBest pair: ${stats.bestPlatformPair.platforms.join(' <-> ')} (${stats.bestPlatformPair.winRate.toFixed(0)}% WR)\n`;
        }
        return output;
      }

      case 'week': {
        const stats = analytics.getStats({ days: 7 });
        let output = `**Weekly Performance** (7d)\n\n`;
        output += `Opportunities found: ${stats.totalFound}\n`;
        output += `Taken: ${stats.taken}\n`;
        output += `Win rate: ${stats.winRate.toFixed(1)}%\n`;
        output += `Profit: $${stats.totalProfit.toLocaleString()}\n`;
        output += `Avg edge: ${stats.avgEdge.toFixed(2)}%\n`;
        if (Object.keys(stats.byType).length > 0) {
          output += `\n**By Type:**\n`;
          for (const [type, data] of Object.entries(stats.byType)) {
            output += `  ${type}: ${data.count} opps, ${data.winRate.toFixed(0)}% WR, $${data.profit.toFixed(2)}\n`;
          }
        }
        return output;
      }

      case 'month': {
        const stats = analytics.getStats({ days: 30 });
        let output = `**Monthly Performance** (30d)\n\n`;
        output += `Opportunities found: ${stats.totalFound}\n`;
        output += `Taken: ${stats.taken}\n`;
        output += `Win rate: ${stats.winRate.toFixed(1)}%\n`;
        output += `Profit: $${stats.totalProfit.toLocaleString()}\n`;
        output += `Avg edge: ${stats.avgEdge.toFixed(2)}%\n`;
        output += `Avg score: ${stats.avgScore.toFixed(1)}\n`;
        if (Object.keys(stats.byType).length > 0) {
          output += `\n**By Type:**\n`;
          for (const [type, data] of Object.entries(stats.byType)) {
            output += `  ${type}: ${data.count} opps, ${data.winRate.toFixed(0)}% WR, $${data.profit.toFixed(2)}, avg edge ${data.avgEdge.toFixed(2)}%\n`;
          }
        }
        if (stats.bestPlatformPair) {
          output += `\nBest pair: ${stats.bestPlatformPair.platforms.join(' <-> ')} (${stats.bestPlatformPair.count} opps, ${stats.bestPlatformPair.winRate.toFixed(0)}% WR)\n`;
        }
        return output;
      }

      case 'attribution': {
        const periodFlag = parts.find((p: string) => p.match(/^\d+d$/));
        const days = periodFlag ? parseInt(periodFlag, 10) : 30;
        const attr = analytics.getPerformanceAttribution({ days });
        let output = `**Performance Attribution** (${days}d)\n\n`;
        output += `**By Edge Source:**\n`;
        for (const [source, bucket] of Object.entries(attr.byEdgeSource)) {
          if (bucket.count === 0) continue;
          output += `  ${source}: ${bucket.count} opps, ${bucket.winRate.toFixed(0)}% WR, $${bucket.totalPnL.toFixed(2)} PnL, avg edge ${bucket.avgEdge.toFixed(2)}%\n`;
        }
        output += `\n**Execution Quality:**\n`;
        output += `  Avg slippage: ${attr.executionQuality.avgSlippagePct.toFixed(2)}%\n`;
        output += `  Avg execution: ${attr.executionQuality.avgExecutionTimeMs.toFixed(0)}ms\n`;
        output += `  Fill rate: ${attr.executionQuality.fillRatePct.toFixed(0)}%\n`;
        output += `  Partial fills: ${attr.executionQuality.partialFills}\n`;
        return output;
      }

      case 'by-platform': {
        const pairs = analytics.getPlatformPairs();
        const stats = analytics.getStats({ days: 30 });
        let output = '**Performance by Platform**\n\n';
        if (Object.keys(stats.byPlatform).length > 0) {
          for (const [platform, data] of Object.entries(stats.byPlatform)) {
            output += `  ${platform}: ${data.count} opps, ${data.winRate.toFixed(0)}% WR, $${data.profit.toFixed(2)}\n`;
          }
        }
        if (pairs.length > 0) {
          output += `\n**Platform Pairs:**\n`;
          for (const p of pairs) {
            output += `  ${p.platforms.join(' <-> ')}: ${p.count} opps, ${p.winRate.toFixed(0)}% WR, $${p.totalProfit.toFixed(2)} profit, avg edge ${p.avgEdge.toFixed(2)}%\n`;
          }
        }
        if (Object.keys(stats.byPlatform).length === 0 && pairs.length === 0) {
          output += 'No platform data yet.\n';
        }
        return output;
      }

      case 'by-category': {
        const stats = analytics.getStats({ days: 30 });
        let output = '**Performance by Category (Type)**\n\n';
        if (Object.keys(stats.byType).length === 0) return 'No category data yet.';
        for (const [type, data] of Object.entries(stats.byType)) {
          output += `  ${type}: ${data.count} opps, ${data.taken} taken, ${data.winRate.toFixed(0)}% WR, $${data.profit.toFixed(2)}, avg edge ${data.avgEdge.toFixed(2)}%\n`;
        }
        return output;
      }

      case 'by-strategy': {
        const periodFlag = parts.find((p: string) => p.match(/^\d+d$/));
        const days = periodFlag ? parseInt(periodFlag, 10) : 30;
        const strategies = analytics.getBestStrategies({ days, minSamples: 1 });
        if (!strategies.length) return 'No strategy data yet.';
        let output = `**Performance by Strategy** (${days}d)\n\n`;
        for (const s of strategies) {
          output += `  ${s.type}`;
          if (s.platformPair) output += ` (${s.platformPair.join(' <-> ')})`;
          output += `: ${s.samples} trades, ${s.winRate.toFixed(0)}% WR, avg $${s.avgProfit.toFixed(2)}\n`;
        }
        return output;
      }

      case 'best-times':
      case 'by-hour':
      case 'by-day': {
        const periodFlag = parts.find((p: string) => p.match(/^\d+d$/));
        const days = periodFlag ? parseInt(periodFlag, 10) : 30;
        const attr = analytics.getPerformanceAttribution({ days });
        let output = '';

        if (cmd === 'by-day') {
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          output = `**Performance by Day of Week** (${days}d)\n\n`;
          for (let d = 0; d < 7; d++) {
            const bucket = attr.byDayOfWeek[d];
            if (!bucket || bucket.count === 0) continue;
            output += `  ${dayNames[d]}: ${bucket.count} opps, ${bucket.winRate.toFixed(0)}% WR, $${bucket.totalPnL.toFixed(2)} PnL\n`;
          }
        } else {
          output = `**Performance by Hour (UTC)** (${days}d)\n\n`;
          const hourEntries: Array<{ hour: number; bucket: typeof attr.byHour[0] }> = [];
          for (let h = 0; h < 24; h++) {
            const bucket = attr.byHour[h];
            if (bucket && bucket.count > 0) {
              hourEntries.push({ hour: h, bucket });
            }
          }
          if (cmd === 'best-times') {
            hourEntries.sort((a, b) => b.bucket.avgPnL - a.bucket.avgPnL);
            output = `**Best Trading Hours (UTC)** (${days}d)\n\n`;
          }
          for (const { hour, bucket } of hourEntries) {
            output += `  ${String(hour).padStart(2, '0')}:00: ${bucket.count} opps, ${bucket.winRate.toFixed(0)}% WR, avg $${bucket.avgPnL.toFixed(2)}, total $${bucket.totalPnL.toFixed(2)}\n`;
          }
        }

        if (output.endsWith('\n\n')) output += 'No time data yet.\n';
        return output;
      }

      case 'edge-decay': {
        const typeFlag = parts.indexOf('--type');
        const type = typeFlag >= 0 ? parts[typeFlag + 1] : undefined;
        const periodFlag = parts.find((p: string) => p.match(/^\d+d$/));
        const days = periodFlag ? parseInt(periodFlag, 10) : 30;
        const decay = analytics.getEdgeDecayAnalysis({ type, days });
        if (decay.decayCurve.length === 0) return 'No edge decay data yet.';
        let output = `**Edge Decay Analysis** (${days}d)\n\n`;
        output += `Avg lifespan: ${(decay.avgLifespanMs / 60000).toFixed(1)} minutes\n\n`;
        output += `**Decay Curve:**\n`;
        for (const point of decay.decayCurve) {
          const bar = '#'.repeat(Math.round(point.remainingEdgePct * 2));
          output += `  ${String(point.minutesSinceDiscovery).padStart(3)}m: ${point.remainingEdgePct.toFixed(2)}% ${bar}\n`;
        }
        return output;
      }

      case 'edge-buckets': {
        const periodFlag = parts.find((p: string) => p.match(/^\d+d$/));
        const days = periodFlag ? parseInt(periodFlag, 10) : 30;
        const attr = analytics.getPerformanceAttribution({ days });
        let output = `**Performance by Edge Size** (${days}d)\n\n`;
        const labels: Record<string, string> = {
          tiny: '< 1%',
          small: '1-2%',
          medium: '2-5%',
          large: '5-10%',
          huge: '> 10%',
        };
        let hasData = false;
        for (const [key, bucket] of Object.entries(attr.byEdgeBucket)) {
          if (bucket.count === 0) continue;
          hasData = true;
          output += `  ${labels[key] || key}: ${bucket.count} opps, ${bucket.winRate.toFixed(0)}% WR, avg $${bucket.avgPnL.toFixed(2)}, total $${bucket.totalPnL.toFixed(2)}\n`;
        }
        if (!hasData) output += 'No edge bucket data yet.\n';
        return output;
      }

      case 'liquidity': {
        const periodFlag = parts.find((p: string) => p.match(/^\d+d$/));
        const days = periodFlag ? parseInt(periodFlag, 10) : 30;
        const attr = analytics.getPerformanceAttribution({ days });
        let output = `**Performance by Liquidity** (${days}d)\n\n`;
        const labels: Record<string, string> = {
          low: '< $500',
          medium: '$500 - $5,000',
          high: '> $5,000',
        };
        let hasData = false;
        for (const [key, bucket] of Object.entries(attr.byLiquidityBucket)) {
          if (bucket.count === 0) continue;
          hasData = true;
          output += `  ${labels[key] || key}: ${bucket.count} opps, ${bucket.winRate.toFixed(0)}% WR, avg $${bucket.avgPnL.toFixed(2)}, total $${bucket.totalPnL.toFixed(2)}\n`;
        }
        if (!hasData) output += 'No liquidity data yet.\n';
        return output;
      }

      case 'platforms': {
        const pairs = analytics.getPlatformPairs();
        if (!pairs.length) return 'No platform pair data yet.';
        let output = '**Platform Pair Performance**\n\n';
        for (const p of pairs) {
          output += `${p.platforms.join(' <-> ')}: ${p.count} opps, ${p.winRate.toFixed(0)}% WR, $${p.totalProfit.toFixed(2)} profit\n`;
        }
        return output;
      }

      case 'opportunities':
      case 'list': {
        const typeFlag = parts.indexOf('--type');
        const type = typeFlag >= 0 ? parts[typeFlag + 1] : undefined;
        const opps = analytics.getOpportunities({ type, limit: 20 });
        if (!opps.length) return 'No opportunities recorded yet.';
        let output = `**Recent Opportunities** (${opps.length})\n\n`;
        for (const o of opps) {
          output += `[${o.status}] ${o.type} — edge ${o.edgePct.toFixed(2)}%, score ${o.score}\n`;
        }
        return output;
      }

      default:
        return helpText();
    }
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function helpText(): string {
  return `**Analytics Commands**

  /analytics                         - Summary stats
  /analytics stats [Nd]              - Performance statistics
  /analytics today                   - Today's performance
  /analytics week                    - Weekly breakdown
  /analytics month                   - Monthly breakdown
  /analytics attribution [Nd]        - P&L by edge source
  /analytics by-platform             - P&L by platform
  /analytics by-category             - P&L by market category
  /analytics by-strategy [Nd]        - P&L by strategy
  /analytics best-times [Nd]         - Best trading hours
  /analytics by-hour [Nd]            - Hourly performance
  /analytics by-day [Nd]             - Day of week analysis
  /analytics edge-decay [Nd]         - Edge decay over time
  /analytics edge-buckets [Nd]       - Performance by edge size
  /analytics liquidity [Nd]          - Performance by liquidity
  /analytics platforms               - Platform pair performance
  /analytics opportunities [--type X] - Browse opportunities`;
}

export default {
  name: 'analytics',
  description: 'Opportunity analytics, win rates, and performance tracking',
  commands: ['/analytics'],
  handle: execute,
};
