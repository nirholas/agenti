import { HTTPFacilitatorClient } from "aixyz/accepts";

export const facilitator = new HTTPFacilitatorClient({
  url: process.env.X402_FACILITATOR_URL ?? "https://x402.use-agently.com/facilitator",
});
