/**
 * Trading System CLI Skill
 *
 * Commands:
 * /trading status - Trading system status
 * /trading stats - Trading statistics
 * /trading bots - List active bots
 * /trading safety - Safety/circuit breaker status
 * /trading kill - Emergency kill switch
 * /trading start <strategy> - Start a bot
 * /trading stop <strategy> - Stop a bot
 * /trading strategies - List available strategies
 * /trading config - View/set config
 */

let safetyInstance: any = null;

function helpText(): string {
  return `**Trading System Commands**

  /trading status                    - System status
  /trading stats                     - Trading statistics
  /trading bots                      - Active bots
  /trading start <strategy> [--dry-run] - Start a strategy bot
  /trading stop <strategy>             - Stop a bot
  /trading strategies                  - Available strategies
  /trading safety                    - Circuit breaker/safety status
  /trading kill [reason]             - Emergency kill switch
  /trading resume                    - Resume after kill
  /trading log [limit]               - Recent trades
  /trading pnl [days]                - P&L summary
  /trading config                    - System config`;
}

async function execute(args: string): Promise<string> {
  const parts = args.trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase() || 'help';

  try {
    const tradingMod = await import('../../../trading/index');
    const dbMod = await import('../../../db/index');

    // Get or create trading system instance
    const db = dbMod.createDatabase();
    if (!db) {
      return 'Database not available. Trading system requires a database instance.';
    }

    const system = tradingMod.createTradingSystem(db);

    switch (cmd) {
      case 'status': {
        const stats = system.getStats();
        const botStatuses = system.bots.getAllBotStatuses();
        const runningBots = botStatuses.filter(b => b.status === 'running').length;
        const portfolio = await system.getPortfolio();

        const safetyMod = await import('../../../trading/safety');
        let safetyStatus = 'unknown';
        try {
          if (!safetyInstance) safetyInstance = safetyMod.createSafetyManager(db);
          safetyStatus = safetyInstance.canTrade() ? 'OK' : 'BLOCKED';
        } catch {
          safetyStatus = 'not initialized';
        }

        return `**Trading System Status**

Execution: ready
Bots: ${runningBots} active / ${botStatuses.length} total
Circuit breaker: ${safetyStatus}
Auto-logging: enabled

**Portfolio:**
  Value: $${portfolio.value.toFixed(2)}
  Balance: $${portfolio.balance.toFixed(2)}
  Positions: ${portfolio.positions.length}

**Stats:**
  Total trades: ${stats.totalTrades}
  Win rate: ${stats.winRate.toFixed(1)}%
  Total PnL: $${stats.totalPnL.toFixed(2)}`;
      }

      case 'stats': {
        const stats = system.getStats();

        return `**Trading Statistics**

Total Trades: ${stats.totalTrades}
Wins: ${stats.winningTrades} | Losses: ${stats.losingTrades}
Win Rate: ${stats.winRate.toFixed(1)}%
Total PnL: $${stats.totalPnL.toFixed(2)}
Avg PnL: $${stats.avgPnL.toFixed(2)}
Avg Win: $${stats.avgWin.toFixed(2)} | Avg Loss: $${stats.avgLoss.toFixed(2)}
Largest Win: $${stats.largestWin.toFixed(2)}
Largest Loss: $${stats.largestLoss.toFixed(2)}
Profit Factor: ${stats.profitFactor.toFixed(2)}
Volume: $${stats.totalVolume.toFixed(2)}
Fees: $${stats.netFees.toFixed(2)} (maker: ${stats.makerTrades}, taker: ${stats.takerTrades})`;
      }

      case 'bots': {
        const statuses = system.bots.getAllBotStatuses();

        if (statuses.length === 0) {
          return 'No bots registered. Use `/trading strategies` to see available strategies, then `/trading start <strategy>`.';
        }

        const lines = ['**Active Bots**', ''];

        for (const bot of statuses) {
          const statusIcon = bot.status === 'running' ? '[RUNNING]'
            : bot.status === 'paused' ? '[PAUSED]'
            : bot.status === 'error' ? '[ERROR]'
            : '[STOPPED]';

          lines.push(`**${bot.name}** ${statusIcon}`);
          lines.push(`  ID: ${bot.id}`);
          lines.push(`  Trades: ${bot.tradesCount} | Win Rate: ${bot.winRate.toFixed(1)}% | PnL: $${bot.totalPnL.toFixed(2)}`);
          if (bot.lastCheck) lines.push(`  Last check: ${bot.lastCheck.toLocaleString()}`);
          if (bot.lastError) lines.push(`  Error: ${bot.lastError}`);
          lines.push('');
        }

        return lines.join('\n');
      }

      case 'start': {
        const strategyId = parts[1];
        if (!strategyId) return 'Usage: /trading start <strategy-id>';

        // Check if strategy is already registered, if not try built-in ones
        const strategies = system.bots.getStrategies();
        const found = strategies.find(s => s.id === strategyId || s.name?.toLowerCase() === strategyId.toLowerCase());

        if (!found) {
          // Try registering a built-in strategy
          if (strategyId === 'mean-reversion' || strategyId === 'meanreversion') {
            const strategy = tradingMod.createMeanReversionStrategy();
            system.bots.registerStrategy(strategy);
          } else if (strategyId === 'momentum') {
            const strategy = tradingMod.createMomentumStrategy();
            system.bots.registerStrategy(strategy);
          } else if (strategyId === 'arbitrage') {
            const strategy = tradingMod.createArbitrageStrategy();
            system.bots.registerStrategy(strategy);
          } else if (strategyId === 'crypto-hft' || strategyId === 'hft') {
            try {
              const { createCryptoHftAdapter } = await import('../../../trading/adapters/index.js');
              const { createCryptoFeed } = await import('../../../feeds/crypto/index.js');
              const feed = createCryptoFeed();
              feed.start();
              const dryRun = args.includes('--dry-run') || args.includes('--dry');
              const adapter = createCryptoHftAdapter({ feed, execution: dryRun ? null : system.execution, config: { dryRun } });
              system.bots.registerStrategy(adapter);
            } catch (e: any) {
              return `Failed to load crypto-hft adapter: ${e.message}`;
            }
          } else if (strategyId === 'hft-divergence' || strategyId === 'divergence') {
            try {
              const { createDivergenceAdapter } = await import('../../../trading/adapters/index.js');
              const { createCryptoFeed } = await import('../../../feeds/crypto/index.js');
              const feed = createCryptoFeed();
              feed.start();
              const dryRun = args.includes('--dry-run') || args.includes('--dry');
              const adapter = createDivergenceAdapter({ feed, execution: dryRun ? null : system.execution, config: { dryRun } });
              system.bots.registerStrategy(adapter);
            } catch (e: any) {
              return `Failed to load hft-divergence adapter: ${e.message}`;
            }
          } else {
            return `Strategy "${strategyId}" not found. Use /trading strategies to see available ones.`;
          }
        }

        const id = found?.id || strategyId;
        const started = await system.bots.startBot(id);

        if (started) {
          return `Bot started: **${id}**\n\nUse /trading bots to check status.`;
        }
        return `Failed to start bot: ${id}. It may already be running.`;
      }

      case 'stop': {
        const strategyId = parts[1];
        if (!strategyId) return 'Usage: /trading stop <strategy-id>';

        await system.bots.stopBot(strategyId);
        return `Bot stopped: **${strategyId}**`;
      }

      case 'strategies': {
        const strategies = system.bots.getStrategies();
        const lines = ['**Available Strategies**', ''];

        if (strategies.length > 0) {
          for (const s of strategies) {
            lines.push(`  **${s.name}** (${s.id})`);
            if (s.description) lines.push(`    ${s.description}`);
          }
        }

        lines.push('', '**Built-in Strategies:**');
        lines.push('  mean-reversion  - Mean reversion on prediction markets');
        lines.push('  momentum        - Momentum/trend following');
        lines.push('  arbitrage       - Cross-platform arbitrage');
        lines.push('  crypto-hft      - 15-min crypto binary market HFT (4 strategies)');
        lines.push('  hft-divergence  - Spot vs Polymarket divergence trading');
        lines.push('', 'Start with: /trading start <strategy-id> [--dry-run]');

        return lines.join('\n');
      }

      case 'safety': {
        const safetyMod = await import('../../../trading/safety');
        if (!safetyInstance) safetyInstance = safetyMod.createSafetyManager(db);
        const state = safetyInstance.getState();

        const breakerTripped = state.alerts.some((a: any) => a.type === 'breaker_tripped');

        const lines = [
          '**Safety Status**',
          '',
          `Trading Enabled: ${state.tradingEnabled ? 'YES' : 'NO (KILLED)'}`,
          `Daily PnL: $${state.dailyPnL.toFixed(2)}`,
          `Daily Trades: ${state.dailyTrades}`,
          `Circuit Breaker: ${breakerTripped ? 'TRIPPED' : 'OK'}`,
          `Current Drawdown: ${state.currentDrawdownPct.toFixed(1)}%`,
          `Peak Value: $${state.peakValue.toFixed(2)}`,
          `Current Value: $${state.currentValue.toFixed(2)}`,
        ];

        if (state.disabledReason) {
          lines.push(`Disabled Reason: ${state.disabledReason}`);
        }
        if (state.resumeAt) {
          lines.push(`Resume At: ${state.resumeAt.toLocaleString()}`);
        }

        if (state.alerts.length > 0) {
          lines.push('', `**Alerts (${state.alerts.length}):**`);
          for (const alert of state.alerts.slice(-5)) {
            lines.push(`  [${alert.type}] ${alert.message} (${alert.timestamp.toLocaleString()})`);
          }
        }

        return lines.join('\n');
      }

      case 'kill':
      case 'killswitch': {
        const reason = parts.slice(1).join(' ') || 'Manual kill via CLI';
        const safetyMod = await import('../../../trading/safety');
        if (!safetyInstance) safetyInstance = safetyMod.createSafetyManager(db);

        safetyInstance.killSwitch(reason);

        // Also shutdown all bots
        await system.shutdown();

        return `**KILL SWITCH ACTIVATED**

Reason: ${reason}
All bots stopped. Trading halted.
To resume: /trading resume`;
      }

      case 'resume': {
        const safetyMod = await import('../../../trading/safety');
        if (!safetyInstance) safetyInstance = safetyMod.createSafetyManager(db);

        const resumed = safetyInstance.resumeTrading();
        if (resumed) {
          return 'Trading resumed. Safety checks still active.\nRestart bots manually with /trading start <strategy>.';
        }
        return 'Failed to resume. Check safety conditions.';
      }

      case 'log':
      case 'trades': {
        const limit = parseInt(parts[1], 10) || 10;
        const trades = system.logger.getTrades({ limit });

        if (trades.length === 0) return 'No trades logged yet.';

        const lines = [`**Recent Trades (${trades.length})**`, ''];

        for (const trade of trades) {
          const pnlStr = trade.realizedPnL !== undefined ? ` | PnL: $${trade.realizedPnL.toFixed(2)}` : '';
          lines.push(`  ${trade.side.toUpperCase()} ${trade.outcome} @ $${trade.price.toFixed(3)} x${trade.size}${pnlStr}`);
          lines.push(`    ${trade.platform} | ${trade.status} | ${trade.createdAt.toLocaleString()}`);
        }

        return lines.join('\n');
      }

      case 'pnl': {
        const days = parseInt(parts[1], 10) || 30;
        const dailyPnl = system.getDailyPnL(days);

        if (dailyPnl.length === 0) return 'No PnL data available.';

        const totalPnl = dailyPnl.reduce((sum, d) => sum + d.pnl, 0);
        const totalTrades = dailyPnl.reduce((sum, d) => sum + d.trades, 0);
        const profitDays = dailyPnl.filter(d => d.pnl > 0).length;

        const lines = [
          `**P&L Summary (${days} days)**`,
          '',
          `Total PnL: $${totalPnl.toFixed(2)}`,
          `Total Trades: ${totalTrades}`,
          `Profitable Days: ${profitDays}/${dailyPnl.length}`,
          '',
          '**Daily Breakdown:**',
        ];

        for (const day of dailyPnl.slice(-10)) {
          const sign = day.pnl >= 0 ? '+' : '';
          lines.push(`  ${day.date}: ${sign}$${day.pnl.toFixed(2)} (${day.trades} trades)`);
        }

        if (dailyPnl.length > 10) {
          lines.push(`  ... and ${dailyPnl.length - 10} more days`);
        }

        return lines.join('\n');
      }

      case 'config': {
        return `**Trading System Config**

Auto-logging: enabled
Dry run: ${system.execution ? 'check execution config' : 'unknown'}
Bot interval: default

Use environment variables to configure:
  POLYMARKET_API_KEY - Polymarket credentials
  KALSHI_API_KEY     - Kalshi credentials
  DRY_RUN=true       - Paper trading mode`;
      }

      default:
        return helpText();
    }
  } catch (err: any) {
    if (cmd === 'help' || cmd === '') return helpText();
    return `Error: ${err?.message || 'Failed to load trading module'}\n\n${helpText()}`;
  }
}

export default {
  name: 'trading-system',
  description: 'Trading system management - bots, safety, circuit breakers, kill switch',
  commands: ['/trading', '/trading-system'],
  handle: execute,
};
