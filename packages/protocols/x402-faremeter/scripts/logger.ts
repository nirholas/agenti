import { configureApp, getLogger } from "@faremeter/logs";

await configureApp();

export const logger = await getLogger(["faremeter", "scripts"]);

export async function logResponse(r: Response) {
  logger.info(`Status: ${r.status}`);
  logger.info("Headers", Object.fromEntries(r.headers));
  logger.info("Response", (await r.json()) as Record<string, unknown>);
}
