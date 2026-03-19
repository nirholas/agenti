/**
 * Backtest CLI Skill
 *
 * Commands:
 * /backtest run <strategy> --market <id> - Run backtest
 * /backtest results - Show last results
 * /backtest compare <s1> <s2> - Compare strategies
 * /backtest monte-carlo - Run Monte Carlo simulation
 * /backtest list - List saved runs
 */

// Session storage for backtest results
const sessionResults: Array<{ id: string; result: any }> = [];

async function execute(args: string): Promise<string> {
  const parts = args.trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase() || 'help';

  try {
    const backtestMod = await import('../../../trading/backtest');
    const { createDatabase } = await import('../../../db/index');
    const db = createDatabase();
    const engine = backtestMod.createBacktestEngine(db);

    switch (cmd) {
      case 'run': {
        const strategyName = parts[1];
        if (!strategyName) return 'Usage: /backtest run <strategy> --market <id> [--days <n>] [--capital <n>]\n\nStrategies: momentum, reversion, divergence, trend-follow, mean-revert';

        const marketIdx = parts.indexOf('--market');
        const marketId = marketIdx >= 0 ? parts[marketIdx + 1] : undefined;
        if (!marketId) return 'Market ID required. Usage: /backtest run <strategy> --market <id>';

        const daysIdx = parts.indexOf('--days');
        const days = daysIdx >= 0 ? parseInt(parts[daysIdx + 1], 10) : 30;
        const capitalIdx = parts.indexOf('--capital');
        const capital = capitalIdx >= 0 ? parseFloat(parts[capitalIdx + 1]) : 10000;

        const config: any = {
          startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
          endDate: new Date(),
          initialCapital: capital,
          commissionPct: 0.1,
          slippagePct: 0.05,
          resolutionMs: 60 * 60 * 1000,
          riskFreeRate: 5,
        };

        // Load historical data
        const bars = await engine.loadHistoricalData('polymarket', marketId, config.startDate, config.endDate);
        if (!bars.length) return `No historical data found for market \`${marketId}\` in last ${days} days.`;

        // Build a simple strategy to run
        const { createMeanReversionStrategy, createMomentumStrategy } = await import('../../../trading/index') as any;
        let strategy: any;
        try {
          if (strategyName === 'momentum' && createMomentumStrategy) {
            strategy = createMomentumStrategy();
          } else if (createMeanReversionStrategy) {
            strategy = createMeanReversionStrategy();
          }
        } catch { /* fallback below */ }

        if (!strategy) {
          // If no built-in strategy factory, show data summary
          let output = `**Backtest: ${strategyName}**\n\n`;
          output += `Market: ${marketId}\n`;
          output += `Period: ${days} days (${config.startDate.toLocaleDateString()} - ${config.endDate.toLocaleDateString()})\n`;
          output += `Initial capital: $${capital.toFixed(2)}\n`;
          output += `Data points: ${bars.length} bars\n`;
          output += `\nNo strategy factory found for "${strategyName}". Available built-in: momentum, reversion.`;
          return output;
        }

        // Ensure strategy config has the market
        if (strategy.config) {
          strategy.config.markets = strategy.config.markets || [];
          if (!strategy.config.markets.includes(marketId)) {
            strategy.config.markets.push(marketId);
          }
          strategy.config.platforms = strategy.config.platforms || ['polymarket'];
        }

        const data = new Map<string, typeof bars>();
        data.set(`polymarket:${marketId}`, bars);

        const result = await engine.runWithData(strategy, config, data);

        // Store in session
        const runId = `bt-${Date.now()}`;
        sessionResults.push({ id: runId, result });

        const m = result.metrics;
        let output = `**Backtest: ${strategyName}**\n\n`;
        output += `Market: ${marketId}\n`;
        output += `Period: ${days} days | Bars: ${bars.length}\n`;
        output += `Initial: $${capital.toFixed(2)} | Final: $${m.finalEquity.toFixed(2)}\n\n`;
        output += `**Results:**\n`;
        output += `  Return: ${m.totalReturnPct.toFixed(2)}% (annualized: ${m.annualizedReturnPct.toFixed(2)}%)\n`;
        output += `  Trades: ${m.totalTrades} | Win Rate: ${m.winRate.toFixed(1)}%\n`;
        output += `  Profit Factor: ${m.profitFactor.toFixed(2)}\n`;
        output += `  Avg Trade: ${m.avgTradePct.toFixed(2)}% | Avg Win: ${m.avgWinPct.toFixed(2)}% | Avg Loss: ${m.avgLossPct.toFixed(2)}%\n`;
        output += `  Max Drawdown: ${m.maxDrawdownPct.toFixed(2)}% (${m.maxDrawdownDays.toFixed(0)} days)\n`;
        output += `  Sharpe: ${m.sharpeRatio.toFixed(2)} | Sortino: ${m.sortinoRatio.toFixed(2)} | Calmar: ${m.calmarRatio.toFixed(2)}\n`;
        output += `  Commission: $${m.totalCommission.toFixed(2)} | Slippage: $${m.totalSlippage.toFixed(2)}\n`;
        output += `\nRun ID: \`${runId}\``;
        return output;
      }

      case 'stats':
      case 'results':
      case 'last': {
        if (sessionResults.length === 0) {
          return 'No backtest results in current session. Run one with `/backtest run <strategy> --market <id>`.';
        }
        const last = sessionResults[sessionResults.length - 1];
        const m = last.result.metrics;
        let output = `**Last Backtest Result** (\`${last.id}\`)\n\n`;
        output += `Return: ${m.totalReturnPct.toFixed(2)}% | Trades: ${m.totalTrades} | Win Rate: ${m.winRate.toFixed(1)}%\n`;
        output += `Final Equity: $${m.finalEquity.toFixed(2)} | Sharpe: ${m.sharpeRatio.toFixed(2)}\n`;
        output += `Max Drawdown: ${m.maxDrawdownPct.toFixed(2)}% | Profit Factor: ${m.profitFactor.toFixed(2)}\n`;
        output += `Trades in result: ${last.result.trades.length}\n`;
        if (last.result.trades.length > 0) {
          output += `\n**Last 5 Trades:**\n`;
          for (const t of last.result.trades.slice(-5)) {
            const pnl = t.pnl !== undefined ? ` PnL: $${t.pnl.toFixed(2)}` : '';
            output += `  ${t.side.toUpperCase()} ${t.size} @ ${t.price.toFixed(4)}${pnl}\n`;
          }
        }
        return output;
      }

      case 'monte-carlo':
      case 'mc': {
        if (sessionResults.length === 0) {
          return 'Run a backtest first with `/backtest run <strategy> --market <id>`, then use Monte Carlo.';
        }
        const sims = parts[1] ? parseInt(parts[1], 10) : 1000;
        if (isNaN(sims) || sims < 10) return 'Usage: /backtest monte-carlo [num-sims]\n\nDefault: 1000 simulations. Min: 10.';

        const last = sessionResults[sessionResults.length - 1];
        const mc = engine.monteCarlo(last.result, sims);

        let output = `**Monte Carlo Simulation** (${mc.simulations} runs)\n\n`;
        output += `Based on last backtest: \`${last.id}\`\n\n`;
        output += `**Return Percentiles:**\n`;
        output += `  5th: ${mc.percentiles.p5.toFixed(2)}%\n`;
        output += `  25th: ${mc.percentiles.p25.toFixed(2)}%\n`;
        output += `  50th (median): ${mc.percentiles.p50.toFixed(2)}%\n`;
        output += `  75th: ${mc.percentiles.p75.toFixed(2)}%\n`;
        output += `  95th: ${mc.percentiles.p95.toFixed(2)}%\n\n`;
        output += `Probability of profit: ${(mc.probabilityOfProfit * 100).toFixed(1)}%\n`;
        output += `Probability of >20% loss: ${(mc.probabilityOfMajorLoss * 100).toFixed(1)}%\n`;
        output += `Expected value: ${mc.expectedValue.toFixed(2)}%`;
        return output;
      }

      case 'compare': {
        if (parts.length < 3) return 'Usage: /backtest compare <strategy1> <strategy2> [--market <id>]';
        const s1Name = parts[1];
        const s2Name = parts[2];

        // Find matching results in session
        const r1 = sessionResults.find(r => r.id.includes(s1Name) || r.result.strategyId === s1Name);
        const r2 = sessionResults.find(r => r.id.includes(s2Name) || r.result.strategyId === s2Name);

        if (!r1 || !r2) {
          return `Run backtests for both strategies first.\nSession has ${sessionResults.length} results: ${sessionResults.map(r => r.id).join(', ') || 'none'}`;
        }

        const m1 = r1.result.metrics;
        const m2 = r2.result.metrics;

        let output = `**Strategy Comparison**\n\n`;
        output += `| Metric | ${s1Name} | ${s2Name} |\n`;
        output += `|--------|--------|--------|\n`;
        output += `| Return | ${m1.totalReturnPct.toFixed(2)}% | ${m2.totalReturnPct.toFixed(2)}% |\n`;
        output += `| Win Rate | ${m1.winRate.toFixed(1)}% | ${m2.winRate.toFixed(1)}% |\n`;
        output += `| Sharpe | ${m1.sharpeRatio.toFixed(2)} | ${m2.sharpeRatio.toFixed(2)} |\n`;
        output += `| Max DD | ${m1.maxDrawdownPct.toFixed(2)}% | ${m2.maxDrawdownPct.toFixed(2)}% |\n`;
        output += `| Profit Factor | ${m1.profitFactor.toFixed(2)} | ${m2.profitFactor.toFixed(2)} |\n`;
        output += `| Trades | ${m1.totalTrades} | ${m2.totalTrades} |`;
        return output;
      }

      case 'list':
      case 'ls': {
        if (sessionResults.length === 0) {
          return 'No backtest runs in current session. Run one with `/backtest run <strategy> --market <id>`.';
        }
        let output = `**Saved Backtest Runs** (${sessionResults.length})\n\n`;
        for (const r of sessionResults) {
          const m = r.result.metrics;
          output += `\`${r.id}\` - Return: ${m.totalReturnPct.toFixed(2)}% | Trades: ${m.totalTrades} | Sharpe: ${m.sharpeRatio.toFixed(2)}\n`;
        }
        return output;
      }

      case 'export': {
        if (sessionResults.length === 0) {
          return 'No backtest results to export. Run one with `/backtest run <strategy> --market <id>`.';
        }
        const last = sessionResults[sessionResults.length - 1];
        const m = last.result.metrics;
        let csv = 'metric,value\n';
        csv += `run_id,${last.id}\n`;
        csv += `total_return_pct,${m.totalReturnPct.toFixed(4)}\n`;
        csv += `annualized_return_pct,${m.annualizedReturnPct.toFixed(4)}\n`;
        csv += `final_equity,${m.finalEquity.toFixed(2)}\n`;
        csv += `total_trades,${m.totalTrades}\n`;
        csv += `win_rate,${m.winRate.toFixed(2)}\n`;
        csv += `profit_factor,${m.profitFactor.toFixed(4)}\n`;
        csv += `avg_trade_pct,${m.avgTradePct.toFixed(4)}\n`;
        csv += `avg_win_pct,${m.avgWinPct.toFixed(4)}\n`;
        csv += `avg_loss_pct,${m.avgLossPct.toFixed(4)}\n`;
        csv += `max_drawdown_pct,${m.maxDrawdownPct.toFixed(4)}\n`;
        csv += `max_drawdown_days,${m.maxDrawdownDays.toFixed(0)}\n`;
        csv += `sharpe_ratio,${m.sharpeRatio.toFixed(4)}\n`;
        csv += `sortino_ratio,${m.sortinoRatio.toFixed(4)}\n`;
        csv += `calmar_ratio,${m.calmarRatio.toFixed(4)}\n`;
        csv += `total_commission,${m.totalCommission.toFixed(2)}\n`;
        csv += `total_slippage,${m.totalSlippage.toFixed(2)}\n`;
        if (last.result.trades.length > 0) {
          csv += '\n--- trades ---\nside,size,price,pnl\n';
          for (const t of last.result.trades) {
            const pnl = t.pnl !== undefined ? t.pnl.toFixed(4) : '';
            csv += `${t.side},${t.size},${t.price.toFixed(6)},${pnl}\n`;
          }
        }
        return `**CSV Export** (\`${last.id}\`)\n\n\`\`\`csv\n${csv}\`\`\``;
      }

      case 'config': {
        const cfg = (backtestMod as any).DEFAULT_CONFIG || {
          initialCapital: 10000, commissionPct: 0.1, slippagePct: 0.05,
          resolutionMs: 3600000, riskFreeRate: 5,
        };
        return `**Backtest Config**\n\nInitial Capital: $${(cfg as any).initialCapital?.toLocaleString() ?? '10,000'}\nCommission: ${(cfg as any).commissionPct ?? 0.1}%\nSlippage: ${(cfg as any).slippagePct ?? 0.05}%\nResolution: ${((cfg as any).resolutionMs ?? 3600000) / 60000} min bars\nRisk-free rate: ${(cfg as any).riskFreeRate ?? 5}% annual\n\nOverride with flags: --capital, --days`;
      }

      default:
        return helpText();
    }
  } catch (err: any) {
    if (cmd === 'help' || cmd === '') return helpText();
    return `Error: ${err?.message || 'Failed to load backtest module'}\n\n${helpText()}`;
  }
}

function helpText(): string {
  return `**Backtest Commands**

  /backtest run <strategy> --market <id> [--days <n>] [--capital <n>]
  /backtest results                    - Show last results
  /backtest stats                      - Alias for results
  /backtest export                     - Export last results as CSV
  /backtest monte-carlo [sims]         - Monte Carlo simulation
  /backtest compare <s1> <s2>          - Compare strategies
  /backtest list                       - List saved runs
  /backtest config                     - Show default config

**Strategies:** momentum, reversion, divergence, mean-revert, trend-follow
**Metrics:** Sharpe, Sortino, Calmar, profit factor, max drawdown`;
}

export default {
  name: 'backtest',
  description: 'Test trading strategies on historical data with Monte Carlo simulation',
  commands: ['/backtest', '/bt'],
  handle: execute,
};
