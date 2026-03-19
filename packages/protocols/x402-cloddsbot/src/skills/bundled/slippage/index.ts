/**
 * Slippage CLI Skill
 *
 * Commands:
 * /slippage estimate <platform> <market> <size> - Estimate slippage
 * /slippage config - Show slippage config
 * /slippage set max <value> - Set max slippage
 */

// Session-level slippage config
const slippageConfig = {
  maxSlippagePct: 1.0,
};

async function execute(args: string): Promise<string> {
  const parts = args.trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase() || 'help';

  switch (cmd) {
    case 'estimate':
    case 'est': {
      const platform = parts[1];
      const market = parts[2];
      const size = parseFloat(parts[3]);
      if (!platform || !market || isNaN(size)) {
        return 'Usage: /slippage estimate <platform> <market-id> <size-usd>';
      }

      try {
        const { createExecutionService } = await import('../../../execution/index');
        const service = createExecutionService({} as any);
        const estimate = await service.estimateSlippage({
          platform: platform as any,
          marketId: market,
          side: 'buy',
          price: 0.50,
          size,
        });

        let output = `**Slippage Estimate**\n\n`;
        output += `Platform: ${platform}\n`;
        output += `Market: ${market}\n`;
        output += `Size: $${size}\n`;
        output += `Estimated slippage: ${(estimate.slippage * 100).toFixed(3)}%\n`;
        output += `Expected fill price: ${estimate.expectedPrice.toFixed(4)}\n`;
        if (estimate.slippage * 100 > slippageConfig.maxSlippagePct) {
          output += `\nWarning: Exceeds max slippage (${slippageConfig.maxSlippagePct}%)`;
        }
        return output;
      } catch (err: any) {
        return `Slippage estimation failed: ${err?.message || 'Could not load execution service'}`;
      }
    }

    case 'config':
      return `**Slippage Config**\n\nMax slippage: ${slippageConfig.maxSlippagePct}%\nSlippage model: orderbook-based\n\nUse \`/slippage set max <pct>\` to change.`;

    case 'set': {
      if (parts[1] === 'max') {
        const value = parseFloat(parts[2]);
        if (isNaN(value) || value <= 0 || value > 50) return 'Usage: /slippage set max <percentage> (0-50)';
        slippageConfig.maxSlippagePct = value;
        return `Max slippage set to ${value}%. Applied to all subsequent estimates.`;
      }
      return 'Usage: /slippage set max <percentage>';
    }

    default:
      return `**Slippage Commands**

  /slippage estimate <platform> <market> <size> - Estimate slippage
  /slippage config                   - Show configuration
  /slippage set max <pct>            - Set max slippage %`;
  }
}

export default {
  name: 'slippage',
  description: 'Slippage estimation and configuration for order execution',
  commands: ['/slippage'],
  handle: execute,
};
