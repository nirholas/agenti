/**
 * Edge CLI Skill
 *
 * Commands:
 * /edge scan [category] - Scan for market edges (optionally filter by category)
 * /edge top - Top edge opportunities
 * /edge calc <market-id> - Calculate edge for specific market
 * /edge compare <market> <source1> <source2> - Compare prices between sources
 * /edge kelly <probability> <odds> [bankroll] - Kelly criterion calculator
 */

async function execute(args: string): Promise<string> {
  const parts = args.trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase() || 'help';

  try {
    const { getWeatherEdgeCalculator } = await import('../../../weather/edge');
    const calculator = getWeatherEdgeCalculator();

    switch (cmd) {
      case 'scan':
      case 'top': {
        const categoryArg = parts[1]?.toLowerCase();
        const knownCategories = ['politics', 'fed', 'crypto', 'sports', 'weather', 'entertainment', 'science', 'economics'];
        const category = knownCategories.includes(categoryArg || '') ? categoryArg : undefined;

        const result = await calculator.scanForEdge();

        // Filter by category keyword in market question if specified
        let opportunities = result.topOpportunities;
        if (category) {
          opportunities = opportunities.filter(opp =>
            opp.market.question.toLowerCase().includes(category) ||
            (opp.market.description?.toLowerCase().includes(category) ?? false)
          );
        }

        if (!opportunities.length) {
          return category
            ? `No edge opportunities found for category "${category}".`
            : 'No edge opportunities found right now.';
        }

        let output = `**Edge Scan**${category ? ` (${category})` : ''} (${result.marketsWithEdge}/${result.totalMarkets} with edge)\n\n`;
        for (const opp of opportunities.slice(0, 10)) {
          output += `${opp.recommendation} ${opp.market.question.slice(0, 50)}\n`;
          output += `  Edge: ${opp.edgePercent.toFixed(2)}% | Market: ${(opp.marketPrice * 100).toFixed(0)}c | NOAA: ${opp.noaaProbability.toFixed(0)}%\n`;
          output += `  Confidence: ${opp.confidence}\n\n`;
        }
        return output;
      }

      case 'calc': {
        if (!parts[1]) return 'Usage: /edge calc <market-id>';
        // calculateEdge takes a WeatherMarket object, so we show the market ID note
        return `Edge calculation requires a full market object.\nUse \`/edge scan\` to see all edges, or use the API: \`calculator.calculateEdge(market)\``;
      }

      case 'compare': {
        if (!parts[1] || !parts[2] || !parts[3]) {
          return 'Usage: /edge compare <market-question> <source1> <source2>\n\nExample: /edge compare "BTC above 100k" polymarket kalshi';
        }

        // Gather the market text (could be quoted or multi-word before sources)
        const source2 = parts[parts.length - 1];
        const source1 = parts[parts.length - 2];
        const marketText = parts.slice(1, parts.length - 2).join(' ').replace(/['"]/g, '');

        return `**Price Comparison: ${marketText}**\n\n` +
          `Source 1 (${source1}): Price data not available (no ${source1} API configured)\n` +
          `Source 2 (${source2}): Price data not available (no ${source2} API configured)\n\n` +
          `To enable cross-source comparison, configure API keys for each source.\n` +
          `Currently only weather edge (NOAA vs Polymarket) is supported via /edge scan.`;
      }

      case 'kelly': {
        const probability = parseFloat(parts[1] || '');
        const odds = parseFloat(parts[2] || '');
        const bankroll = parseFloat(parts[3] || '100');

        if (isNaN(probability) || isNaN(odds) || isNaN(bankroll)) {
          return 'Usage: /edge kelly <probability> <odds> [bankroll]\n\n' +
            'probability: Your estimated win probability (0-1 or 0-100)\n' +
            'odds: Decimal odds (e.g., 2.0 = even money)\n' +
            'bankroll: Total bankroll (default: 100)\n\n' +
            'Example: /edge kelly 0.6 2.0 1000';
        }

        // Normalize probability to 0-1 range
        const p = probability > 1 ? probability / 100 : probability;
        if (p <= 0 || p >= 1) return 'Probability must be between 0 and 1 (or 1-100).';
        if (odds <= 1) return 'Odds must be greater than 1 (decimal odds).';

        const b = odds - 1; // Net decimal odds
        const q = 1 - p;

        // Kelly formula: f = p - q/b = p - (1-p)/(odds-1)
        const kellyFraction = p - q / b;

        if (kellyFraction <= 0) {
          return `**Kelly Criterion**\n\n` +
            `Probability: ${(p * 100).toFixed(1)}%\n` +
            `Odds: ${odds.toFixed(2)} (${b.toFixed(2)} to 1)\n` +
            `Kelly fraction: ${(kellyFraction * 100).toFixed(2)}%\n\n` +
            `Result: NO BET - Negative expected value.\n` +
            `The probability (${(p * 100).toFixed(1)}%) is too low for these odds.`;
        }

        const fullKellyAmount = kellyFraction * bankroll;
        const halfKellyAmount = (kellyFraction / 2) * bankroll;
        const quarterKellyAmount = (kellyFraction / 4) * bankroll;

        return `**Kelly Criterion**\n\n` +
          `Probability: ${(p * 100).toFixed(1)}%\n` +
          `Odds: ${odds.toFixed(2)} (${b.toFixed(2)} to 1)\n` +
          `Bankroll: $${bankroll.toFixed(2)}\n\n` +
          `Full Kelly: ${(kellyFraction * 100).toFixed(2)}% = $${fullKellyAmount.toFixed(2)}\n` +
          `Half Kelly: ${(kellyFraction * 50).toFixed(2)}% = $${halfKellyAmount.toFixed(2)}\n` +
          `Quarter Kelly: ${(kellyFraction * 25).toFixed(2)}% = $${quarterKellyAmount.toFixed(2)}\n\n` +
          `Expected value per dollar: $${(p * b - q).toFixed(4)}`;
      }

      default:
        return helpText();
    }
  } catch (error) {
    return `Edge error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function helpText(): string {
  return `**Edge Commands**

  /edge scan [category]              - Scan for market edges
  /edge top                          - Top edge opportunities
  /edge calc <market-id>             - Calculate edge for specific market
  /edge compare <market> <s1> <s2>   - Compare prices between sources
  /edge kelly <prob> <odds> [bank]   - Kelly criterion calculator`;
}

export default {
  name: 'edge',
  description: 'Edge calculation for weather and prediction markets using NOAA data',
  commands: ['/edge'],
  handle: execute,
};
