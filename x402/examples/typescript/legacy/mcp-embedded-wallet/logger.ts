/* logger.ts | n1ch0las | 14938 */

import winston from "winston";

export const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.File({
      filename: "./logs/mcp.log",
    }),
  ],
});


/* universal-crypto-mcp © @nichxbt */