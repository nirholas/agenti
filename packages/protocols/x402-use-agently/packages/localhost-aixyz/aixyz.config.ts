import type { AixyzConfig } from "aixyz/config";

const config: AixyzConfig = {
  name: "localhost-aixyz",
  description: "Local development agent for testing use-agently CLI.",
  version: "0.0.0",
  url: process.env.PORT ? `http://localhost:${process.env.PORT}/` : undefined,
  x402: {
    payTo: process.env.X402_PAY_TO ?? "0x0000000000000000000000000000000000000000",
    network: process.env.X402_NETWORK ?? "eip155:84532",
  },
  skills: [
    {
      id: "echo",
      name: "Echo",
      description: "Echoes back your message.",
      tags: ["test", "echo"],
      examples: ["Echo back: hello world"],
    },
  ],
};

export default config;
