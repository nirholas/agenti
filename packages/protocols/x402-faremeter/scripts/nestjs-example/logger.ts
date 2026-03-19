import { configureApp, getLogger } from "@faremeter/logs";

await configureApp({
  level: "debug",
});

export const logger = await getLogger(["faremeter", "scripts"]);
