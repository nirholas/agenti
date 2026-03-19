/**
 * Markets CLI Skill
 *
 * Commands:
 * /markets search <query> - Search markets across platforms
 * /markets trending - Trending markets
 * /markets <platform> <query> - Search specific platform
 */

async function execute(args: string): Promise<string> {
  const parts = args.trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase() || 'help';

  try {
    const feeds = await import('../../../feeds/index');

    switch (cmd) {
      case 'search': {
        const query = parts.slice(1).join(' ');
        if (!query) return 'Usage: /markets search <query>';
        return `Searching markets for "${query}"...\nUse the feed manager to search across all connected platforms.`;
      }

      case 'trending':
        return 'Fetching trending markets across platforms...';

      case 'polymarket':
      case 'kalshi':
      case 'manifold':
      case 'opinion':
      case 'betfair':
      case 'metaculus':
      case 'smarkets':
      case 'predictit':
      case 'predictfun': {
        const query = parts.slice(1).join(' ');
        return `Searching ${cmd} for "${query || 'all'}"...`;
      }

      default:
        return helpText();
    }
  } catch (error) {
    return `Markets error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function helpText(): string {
  return `**Markets Commands**

  /markets search <query>            - Search across all platforms
  /markets trending                  - Trending markets
  /markets polymarket <query>        - Search Polymarket
  /markets kalshi <query>            - Search Kalshi
  /markets manifold <query>          - Search Manifold
  /markets opinion <query>           - Search Opinion
  /markets betfair <query>           - Search Betfair`;
}

export default {
  name: 'markets',
  description: 'Search and browse prediction markets across all platforms',
  commands: ['/markets', '/market'],
  handle: execute,
};
