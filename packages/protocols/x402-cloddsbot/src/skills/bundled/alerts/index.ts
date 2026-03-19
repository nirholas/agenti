/**
 * Alerts CLI Skill
 *
 * Commands:
 * /alert "market" above <price> - Price above alert
 * /alert "market" below <price> - Price below alert
 * /alert "market" change <pct>% - Price change alert
 * /alert "market" volume <multiplier>x - Volume spike alert
 * /alert whale <amount> - Whale activity alert
 * /alert delete <id> - Delete an alert
 * /alerts - List all alerts
 */

import {
  createAlertService,
  type AlertService,
  type PriceProvider,
} from '../../../alerts/index';
import { logger } from '../../../utils/logger';

let alertService: AlertService | null = null;

function getService(): AlertService {
  if (!alertService) {
    // Wire PriceProvider to FeedManager for real price data
    let feedManagerInstance: any = null;
    async function getFeedManager() {
      if (!feedManagerInstance) {
        const { createFeedManager } = await import('../../../feeds/index');
        // Minimal config enabling polymarket (most common for alerts)
        feedManagerInstance = await createFeedManager({
          polymarket: { enabled: true },
          kalshi: { enabled: false },
          manifold: { enabled: false },
          metaculus: { enabled: false },
          drift: { enabled: false },
          betfair: { enabled: false },
          smarkets: { enabled: false },
          opinion: { enabled: false },
          predictfun: { enabled: false },
          hedgehog: { enabled: false },
          news: { enabled: false },
        } as any);
      }
      return feedManagerInstance;
    }

    const feedProvider: PriceProvider = {
      async getPrice(platform: string, marketId: string) {
        try {
          const fm = await getFeedManager();
          return await fm.getPrice(platform, marketId);
        } catch {
          return null;
        }
      },
      async getVolume24h(platform: string, marketId: string) {
        try {
          const fm = await getFeedManager();
          const market = await fm.getMarket(marketId, platform);
          return market?.volume24h ?? null;
        } catch {
          return null;
        }
      },
    };
    alertService = createAlertService(feedProvider, null);
  }
  return alertService;
}

async function handleList(): Promise<string> {
  const service = getService();
  const formatted = service.formatAlertsList('default');
  return formatted;
}

async function handleDelete(alertId: string): Promise<string> {
  const service = getService();
  const success = service.deleteAlert(alertId);
  return success
    ? `Alert \`${alertId}\` deleted.`
    : `Alert \`${alertId}\` not found.`;
}

async function handleCreatePriceAlert(
  market: string,
  type: 'price_above' | 'price_below',
  threshold: number
): Promise<string> {
  const service = getService();
  const alert = service.createPriceAlert({
    userId: 'default',
    platform: 'polymarket',
    marketId: market,
    marketQuestion: market,
    type,
    threshold,
    deliveryChannel: 'cli',
    deliveryChatId: 'cli',
    oneTime: true,
  });

  const direction = type === 'price_above' ? 'above' : 'below';
  return `**Alert Created**\n\n` +
    `ID: \`${alert.id}\`\n` +
    `Market: ${market}\n` +
    `Type: Price ${direction} $${threshold.toFixed(3)}\n` +
    `Status: ${alert.status}`;
}

async function handleCreateChangeAlert(
  market: string,
  changePct: number,
  timeWindowSecs: number
): Promise<string> {
  const service = getService();
  const alert = service.createPriceChangeAlert({
    userId: 'default',
    platform: 'polymarket',
    marketId: market,
    marketQuestion: market,
    changePct,
    timeWindowSecs,
    deliveryChannel: 'cli',
    deliveryChatId: 'cli',
  });

  return `**Price Change Alert Created**\n\n` +
    `ID: \`${alert.id}\`\n` +
    `Market: ${market}\n` +
    `Change: ${changePct}% in ${timeWindowSecs}s\n` +
    `Status: ${alert.status}`;
}

async function handleCreateVolumeAlert(
  market: string,
  threshold: number
): Promise<string> {
  const service = getService();
  const alert = service.createVolumeAlert({
    userId: 'default',
    platform: 'polymarket',
    marketId: market,
    marketQuestion: market,
    threshold,
    deliveryChannel: 'cli',
    deliveryChatId: 'cli',
  });

  return `**Volume Alert Created**\n\n` +
    `ID: \`${alert.id}\`\n` +
    `Market: ${market}\n` +
    `Volume threshold: ${threshold.toLocaleString()}\n` +
    `Status: ${alert.status}`;
}

export async function execute(args: string): Promise<string> {
  const parts = args.trim().split(/\s+/);
  const command = parts[0]?.toLowerCase() || 'help';

  switch (command) {
    case 'list':
    case 'ls':
      return handleList();

    case 'delete':
    case 'remove':
      if (!parts[1]) return 'Usage: /alert delete <alert-id>';
      return handleDelete(parts[1]);

    default: {
      // Parse: "market" above|below <price>
      // Parse: "market" change <pct>%
      // Parse: "market" volume <multiplier>x
      // Parse: whale <amount>

      if (command === 'whale') {
        const amount = parseFloat(parts[1] || '10000');
        if (isNaN(amount)) return 'Invalid whale amount. Usage: /alert whale <amount>';
        const market = parts.slice(2).join(' ') || 'all';
        return handleCreateVolumeAlert(market, amount);
      }

      // Try to extract quoted market name
      const fullArgs = args.trim();
      const quoteMatch = fullArgs.match(/^["'](.+?)["']\s+(.+)$/);

      if (quoteMatch) {
        const market = quoteMatch[1];
        const remainder = quoteMatch[2].trim().split(/\s+/);
        const action = remainder[0]?.toLowerCase();

        if (action === 'above' && remainder[1]) {
          const threshold = parseFloat(remainder[1]);
          if (isNaN(threshold)) return 'Invalid price threshold.';
          return handleCreatePriceAlert(market, 'price_above', threshold);
        }

        if (action === 'below' && remainder[1]) {
          const threshold = parseFloat(remainder[1]);
          if (isNaN(threshold)) return 'Invalid price threshold.';
          return handleCreatePriceAlert(market, 'price_below', threshold);
        }

        if (action === 'change' && remainder[1]) {
          const pct = parseFloat(remainder[1].replace('%', ''));
          if (isNaN(pct)) return 'Invalid percentage.';
          const parsedWindow = remainder[2] ? parseInt(remainder[2], 10) : 300;
          const window = isNaN(parsedWindow) ? 300 : parsedWindow;
          return handleCreateChangeAlert(market, pct, window);
        }

        if (action === 'volume' && remainder[1]) {
          const threshold = parseFloat(remainder[1].replace('x', ''));
          if (isNaN(threshold)) return 'Invalid volume threshold.';
          return handleCreateVolumeAlert(market, threshold);
        }
      }

      return `**Alerts Commands**

**Create Alerts:**
  /alert "market" above <price>       - Alert when price goes above
  /alert "market" below <price>       - Alert when price drops below
  /alert "market" change <pct>%       - Alert on price change
  /alert "market" volume <threshold>  - Alert on volume spike
  /alert whale <amount>               - Whale activity alert

**Manage Alerts:**
  /alerts                             - List all alerts
  /alert delete <id>                  - Delete an alert

**Examples:**
  /alert "Trump 2028" above 0.50
  /alert "Fed rate cut" below 0.30
  /alert "Trump 2028" change 5%
  /alert whale 50000`;
    }
  }
}

export default {
  name: 'alerts',
  description: 'Create and manage price alerts for prediction markets',
  commands: ['/alerts', '/alert'],
  handle: execute,
};
