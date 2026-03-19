import { Hono } from 'hono';
import type { ServerConfig } from '../config';
import type { GaslessConfigCache } from 'x402ton';

export function supportedRoute(
  config: ServerConfig,
  facilitatorAddress: string,
  gaslessCache?: GaslessConfigCache,
  assetInfo?: { decimals: number; symbol: string },
) {
  const app = new Hono();

  app.get('/supported', (c) => {
    // Use TONAPI relay address if available, otherwise fallback to facilitator
    const relayAddress = gaslessCache?.relayAddress ?? facilitatorAddress;
    // Use discovered commission if available, otherwise config value
    const maxRelayCommission = gaslessCache?.maxRelayCommission ?? config.maxRelayCommission;

    return c.json({
      kinds: [
        {
          x402Version: 2,
          scheme: 'exact',
          network: config.tonNetwork,
          extra: {
            relayAddress,
            maxRelayCommission,
            assetDecimals: assetInfo?.decimals ?? 6,
            assetSymbol: assetInfo?.symbol ?? 'USDT',
          },
        },
      ],
      extensions: [],
      signers: {
        'tvm:*': [facilitatorAddress],
      },
    });
  });

  return app;
}
