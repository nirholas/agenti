import { configure, getConsoleSink, getLogger } from "@logtape/logtape";

await configure({
  sinks: { console: getConsoleSink() },
  loggers: [
    {
      category: ["logtape", "meta"],
      lowestLevel: "warning",
      sinks: ["console"],
    },
    { category: "faremeter", lowestLevel: "info", sinks: ["console"] },
  ],
});

export const logger = getLogger(["faremeter", "scripts"]);

export async function logResponse(r: Response) {
  logger.info(`Status: ${r.status}`);
  logger.info("Headers: {*}", Object.fromEntries(r.headers));
  logger.info("Response: {*}", (await r.json()) as Record<string, unknown>);
}
