/**
 * Gateway command - starts the Clodds server
 */

import { loadConfig } from '../../utils/config';
import { logger } from '../../utils/logger';

// gateway module is private (gitignored) — lazy-load at runtime
const _gwPath = '../../gateway/index.js';

export async function startGateway(options: { config?: string }): Promise<void> {
  try {
    logger.info('Starting Clodds gateway...');

    const config = await loadConfig(options.config);
    const { createGateway } = await import(_gwPath);
    const gateway = await createGateway(config);
    await gateway.start();

    logger.info('Clodds is running!');
    logger.info(`Gateway: ws://127.0.0.1:${config.gateway.port}`);

    // Handle shutdown
    const shutdown = async () => {
      logger.info('Shutting down...');
      await gateway.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    logger.error('Failed to start gateway:', error);
    process.exit(1);
  }
}
