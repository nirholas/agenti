/**
 * History CLI Skill
 *
 * Commands:
 * /history - Recent trades
 * /history today - Today's trades
 * /history week - This week
 * /history pnl - P&L summary
 * /history stats - Full trading statistics
 * /history search <query> - Search trades by market
 * /history export [format] - Export trades
 * /history sync - Sync from exchanges
 */

async function execute(args: string): Promise<string> {
  const parts = args.trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase() || 'recent';

  try {
    const historyMod = await import('../../../history/index');
    const { createDatabase } = await import('../../../db/index');

    const db = createDatabase();

    // Build config from env vars if available
    const config: any = {};
    if (process.env.POLYMARKET_API_KEY) {
      config.polymarket = {
        apiKey: process.env.POLYMARKET_API_KEY,
        apiSecret: process.env.POLYMARKET_API_SECRET || '',
        apiPassphrase: process.env.POLYMARKET_API_PASSPHRASE || '',
      };
    }
    if (process.env.KALSHI_API_KEY_ID) {
      config.kalshi = {
        apiKeyId: process.env.KALSHI_API_KEY_ID,
        privateKeyPem: process.env.KALSHI_PRIVATE_KEY_PEM || '',
      };
    }

    const service = historyMod.createTradeHistoryService(config, db);

    switch (cmd) {
      case 'recent':
      case 'list':
      case 'ls': {
        const limit = parts[1] ? parseInt(parts[1], 10) : 10;
        return service.formatRecentTrades(isNaN(limit) ? 10 : limit);
      }

      case 'today': {
        const trades = service.getTrades({
          startDate: new Date(new Date().setHours(0, 0, 0, 0)),
          endDate: new Date(),
        });
        if (!trades.length) return '**Today\'s Trades**\n\nNo trades today.';

        const todayPnL = service.getTodayPnL();
        let output = `**Today's Trades** (${trades.length})\n\n`;
        for (const t of trades.slice(0, 20)) {
          const side = t.side === 'buy' ? 'BUY' : 'SELL';
          output += `${side} ${t.shares.toFixed(2)} ${t.outcome} @ $${t.price.toFixed(3)} = $${t.value.toFixed(2)} [${t.platform}]\n`;
        }
        output += `\nToday's PnL: $${todayPnL.toFixed(2)}`;
        return output;
      }

      case 'week': {
        const stats = service.getStats('week');
        const trades = service.getTrades({
          startDate: (() => {
            const d = new Date();
            d.setDate(d.getDate() - d.getDay());
            d.setHours(0, 0, 0, 0);
            return d;
          })(),
          endDate: new Date(),
        });
        let output = `**This Week's Trades** (${trades.length})\n\n`;
        output += `PnL: $${stats.totalPnL.toFixed(2)}\n`;
        output += `Volume: $${stats.totalVolume.toFixed(2)}\n`;
        output += `Win Rate: ${stats.winRate.toFixed(1)}%\n`;
        return output;
      }

      case 'pnl': {
        const days = parts[1] ? parseInt(parts[1], 10) : 30;
        const dailyPnL = service.getDailyPnL(isNaN(days) ? 30 : days);
        const totalPnL = service.getTotalPnL();

        const activeDays = dailyPnL.filter(d => d.trades > 0);
        if (!activeDays.length) {
          return `**P&L Summary**\n\nNo trading activity in the last ${days} days.\nTotal PnL: $${totalPnL.toFixed(2)}`;
        }

        let output = `**P&L Summary** (${days}d)\n\n`;
        output += `Total PnL: $${totalPnL.toFixed(2)}\n`;
        output += `Today: $${service.getTodayPnL().toFixed(2)}\n\n`;
        output += `| Date | PnL | Trades | Volume |\n|------|-----|--------|--------|\n`;
        for (const d of activeDays.slice(-15)) {
          output += `| ${d.date} | $${d.pnl.toFixed(2)} | ${d.trades} | $${d.volume.toFixed(2)} |\n`;
        }
        return output;
      }

      case 'stats': {
        return service.formatStats();
      }

      case 'search': {
        if (parts.length < 2) return 'Usage: /history search <market-id or keyword>';
        const query = parts.slice(1).join(' ').toLowerCase();
        const allTrades = service.getTrades({});
        const matched = allTrades.filter(t =>
          t.marketId.toLowerCase().includes(query) ||
          (t.marketQuestion && t.marketQuestion.toLowerCase().includes(query))
        );

        if (!matched.length) return `No trades found matching "${query}".`;

        let output = `**Search Results** (${matched.length} trades)\n\n`;
        for (const t of matched.slice(0, 15)) {
          const label = t.marketQuestion ? t.marketQuestion.slice(0, 40) : t.marketId.slice(0, 20);
          output += `${t.side.toUpperCase()} ${t.shares.toFixed(2)} ${t.outcome} @ $${t.price.toFixed(3)} [${t.platform}] - ${label}\n`;
        }
        return output;
      }

      case 'export': {
        const format = parts[1]?.toLowerCase() || 'csv';
        const allTrades = service.getTrades({});

        if (!allTrades.length) return 'No trades to export.';

        if (format === 'json') {
          const json = JSON.stringify(allTrades.slice(0, 100), null, 2);
          return `**Export** (${allTrades.length} trades, JSON)\n\n\`\`\`json\n${json.slice(0, 3000)}\n\`\`\``;
        }

        // Default CSV
        let csv = 'id,platform,marketId,outcome,side,shares,price,value,fee,timestamp\n';
        for (const t of allTrades.slice(0, 100)) {
          csv += `${t.id},${t.platform},${t.marketId},${t.outcome},${t.side},${t.shares},${t.price},${t.value},${t.fee},${t.timestamp.toISOString()}\n`;
        }
        return `**Export** (${allTrades.length} trades, CSV)\n\n\`\`\`csv\n${csv.slice(0, 3000)}\n\`\`\``;
      }

      case 'sync': {
        const fetched = await service.fetchTrades(100);
        const synced = await service.syncToDatabase();
        return `**Sync Complete**\n\nFetched ${fetched.length} trades from exchanges.\nSynced ${synced} trades to database.`;
      }

      default:
        return helpText();
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return `Error: ${msg}`;
  }
}

function helpText(): string {
  return `**History Commands**

  /history                           - Recent trades
  /history today                     - Today's trades
  /history week                      - This week's trades
  /history pnl [days]                - P&L summary (default 30d)
  /history stats                     - Full trading statistics
  /history search <query>            - Search trades by market
  /history export [csv|json]         - Export trades
  /history sync                      - Sync from exchanges`;
}

export default {
  name: 'history',
  description: 'Trade history tracking, sync, and performance analytics',
  commands: ['/history', '/trades'],
  handle: execute,
};
